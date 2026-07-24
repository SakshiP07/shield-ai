import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { api } from '../lib/api';
import { getToken } from '../lib/storage';
import ShieldAndroidSms, { type DeviceSms } from '../../modules/shield-android-sms/src';
import { SmsAuditEvent } from './auditEvents';

const QUEUE_KEY = 'shield_sms_offline_queue_v1';
const SYNCED_IDS_KEY = 'shield_sms_synced_ids_v1';
const KNOWN_DEVICE_KEY = 'shield_sms_known_device_v1';

export type QueuedSms = DeviceSms & { queued_at: string };

type KnownDeviceEntry = { id: string; timestamp: number };

async function requireAuth(): Promise<boolean> {
  const token = await getToken();
  return Boolean(token?.trim());
}

function deviceInfo() {
  const constants = Platform.constants as Record<string, unknown> | undefined;
  return {
    platform: 'android',
    device_id: Constants.sessionId ?? undefined,
    device_model: Constants.deviceName ?? undefined,
    manufacturer: typeof constants?.Manufacturer === 'string' ? constants.Manufacturer : undefined,
    android_version: String(Platform.Version),
    app_version: Constants.expoConfig?.version ?? '1.0.0',
  };
}

async function loadQueue(): Promise<QueuedSms[]> {
  const raw = await AsyncStorage.getItem(QUEUE_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as QueuedSms[];
  } catch {
    return [];
  }
}

async function saveQueue(items: QueuedSms[]) {
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(items.slice(-500)));
}

async function loadSyncedIds(): Promise<Set<string>> {
  const raw = await AsyncStorage.getItem(SYNCED_IDS_KEY);
  if (!raw) return new Set();
  try {
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return new Set();
  }
}

async function markSynced(ids: string[]) {
  const set = await loadSyncedIds();
  ids.forEach((id) => set.add(id));
  const trimmed = Array.from(set).slice(-5000);
  await AsyncStorage.setItem(SYNCED_IDS_KEY, JSON.stringify(trimmed));
}

async function loadKnownDevice(): Promise<KnownDeviceEntry[]> {
  const raw = await AsyncStorage.getItem(KNOWN_DEVICE_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as KnownDeviceEntry[];
  } catch {
    return [];
  }
}

async function saveKnownDevice(entries: KnownDeviceEntry[]) {
  await AsyncStorage.setItem(KNOWN_DEVICE_KEY, JSON.stringify(entries.slice(0, 200)));
}

function safeIso(receivedAt: string | undefined, timestamp: number | undefined): string {
  if (receivedAt) {
    const parsed = Date.parse(receivedAt);
    if (!Number.isNaN(parsed)) return new Date(parsed).toISOString();
  }
  const ts = Number(timestamp);
  if (Number.isFinite(ts) && ts > 0) {
    const ms = ts > 1e12 ? ts : ts * 1000;
    return new Date(ms).toISOString();
  }
  return new Date().toISOString();
}

function toIngestPayload(messages: DeviceSms[]) {
  return messages
    .map((m) => {
      const id = String(m.android_sms_id || m.id || '').trim().slice(0, 64);
      const address = String(m.address || m.phone_number || m.sender || 'unknown')
        .trim()
        .slice(0, 256);
      if (!id || !address) return null;
      return {
        android_sms_id: id,
        address,
        body: String(m.body ?? '').slice(0, 10000),
        sender: String(m.sender || m.address || address).slice(0, 120),
        received_at: safeIso(m.received_at, m.timestamp),
        is_read: Boolean(m.is_read),
        thread_id: m.thread_id != null ? String(m.thread_id).slice(0, 64) : null,
        is_otp: Boolean(m.is_otp),
        otp_code: m.otp_code ? String(m.otp_code).slice(0, 16) : null,
        folder: String(m.folder || 'inbox').slice(0, 20),
      };
    })
    .filter((m): m is NonNullable<typeof m> => m != null);
}

type IngestItem = NonNullable<ReturnType<typeof toIngestPayload>[number]>;

type IngestOptions = {
  /** Run fraud pipeline. Prefer false for bulk historical sync (much faster). */
  autoScan?: boolean;
};

/** Serialize uploads so connect/alerts/profile are not starved by SMS floods. */
let ingestChain: Promise<unknown> = Promise.resolve();

function enqueueIngest<T>(fn: () => Promise<T>): Promise<T> {
  const run = ingestChain.then(fn, fn);
  ingestChain = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

async function ingestInChunks(messages: DeviceSms[], options: IngestOptions = {}) {
  return enqueueIngest(async () => {
    if (!(await requireAuth())) {
      return { created: 0, updated: 0, scanned: 0, failed: messages.length };
    }
    const autoScan = options.autoScan !== false;
    const pairs: { source: DeviceSms; item: IngestItem }[] = [];
    for (const m of messages) {
      const item = toIngestPayload([m])[0];
      if (item) pairs.push({ source: m, item });
    }
    if (!pairs.length) return { created: 0, updated: 0, scanned: 0, failed: 0 };

    const chunkSize = 40;
    let created = 0;
    let updated = 0;
    let scanned = 0;
    const failed: DeviceSms[] = [];

    for (let i = 0; i < pairs.length; i += chunkSize) {
      const chunkPairs = pairs.slice(i, i + chunkSize);
      const chunk = chunkPairs.map((p) => p.item);
      try {
        const res = await api.smsIngest({
          messages: chunk,
          device_info: deviceInfo(),
          auto_scan: autoScan,
        });
        created += res.created ?? 0;
        updated += res.updated ?? 0;
        scanned += res.scanned ?? 0;
        await markSynced(chunk.map((c) => c.android_sms_id));
      } catch {
        // Queue the whole chunk — never fall back to one-by-one (starves the API).
        for (const pair of chunkPairs) failed.push(pair.source);
      }
    }

    if (failed.length) {
      const queue = await loadQueue();
      const synced = await loadSyncedIds();
      const byId = new Map(queue.map((q) => [q.android_sms_id || q.id, q]));
      for (const m of failed) {
        const id = m.android_sms_id || m.id;
        if (!id || synced.has(id) || byId.has(id)) continue;
        byId.set(id, { ...m, queued_at: new Date().toISOString() });
      }
      await saveQueue(Array.from(byId.values()));
    }

    return { created, updated, scanned, failed: failed.length };
  });
}

export const SmsSyncService = {
  isNativeAvailable: () => ShieldAndroidSms.isAvailable(),
  hasPermission: () => ShieldAndroidSms.hasPermission(),
  deviceInfo,

  async audit(
    event_type: string,
    description?: string,
    metadata?: Record<string, unknown>,
    sms_id?: string,
    status: 'success' | 'failure' = 'success',
  ) {
    if (!(await requireAuth())) return;
    try {
      await api.smsClientAudit({
        event_type,
        description,
        sms_id,
        status,
        metadata: { ...deviceInfo(), ...(metadata || {}) },
      });
    } catch {
      // best-effort append-only client audit
    }
  },

  async connectBackend() {
    if (!(await requireAuth())) {
      throw new Error('Sign in to connect SMS');
    }
    return api.smsConnect({ device_info: deviceInfo() });
  },

  async disconnectBackend() {
    await ShieldAndroidSms.stopWatching().catch(() => undefined);
    if (!(await requireAuth())) {
      return { connected: false, platform: 'android', ios_supported: false };
    }
    return api.smsDisconnect({ device_info: deviceInfo() });
  },

  /**
   * Detect SMS removed from the device Content Provider (when detectable).
   * Compares the previous inbox window to the current one; only flags IDs
   * that should still fall within the current time window.
   */
  async reconcileDeletions(limit = 100) {
    if (!ShieldAndroidSms.isAvailable() || !ShieldAndroidSms.hasPermission()) return;
    const messages = await ShieldAndroidSms.readInbox(limit, 0);
    const current: KnownDeviceEntry[] = messages.map((m) => ({
      id: m.android_sms_id || m.id,
      timestamp: Number(m.timestamp) || 0,
    }));
    const prev = await loadKnownDevice();
    if (prev.length && current.length) {
      const currentIds = new Set(current.map((c) => c.id));
      const oldestCurrent = Math.min(...current.map((c) => c.timestamp).filter(Boolean));
      const deleted = prev.filter(
        (p) => p.id && p.timestamp >= oldestCurrent && !currentIds.has(p.id),
      );
      for (const entry of deleted.slice(0, 25)) {
        await this.audit(
          SmsAuditEvent.DELETED_FROM_DEVICE,
          `SMS ${entry.id} no longer on device`,
          { android_sms_id: entry.id, timestamp: entry.timestamp },
          entry.id,
          'success',
        );
      }
    }
    await saveKnownDevice(current);
  },

  async enqueue(messages: DeviceSms[]) {
    if (!messages.length) return;
    const synced = await loadSyncedIds();
    const queue = await loadQueue();
    const byId = new Map(queue.map((q) => [q.android_sms_id || q.id, q]));
    for (const m of messages) {
      const id = m.android_sms_id || m.id;
      if (!id || synced.has(id) || byId.has(id)) continue;
      byId.set(id, { ...m, queued_at: new Date().toISOString() });
    }
    await saveQueue(Array.from(byId.values()));
  },

  async flushQueue(): Promise<{ uploaded: number; failed: boolean }> {
    if (!(await requireAuth())) return { uploaded: 0, failed: false };
    const queue = await loadQueue();
    if (!queue.length) return { uploaded: 0, failed: false };

    await this.audit(SmsAuditEvent.RETRY_ATTEMPT, `Flushing ${queue.length} queued SMS`);

    // Clear first so ingestInChunks only re-queues true failures.
    await saveQueue([]);
    const result = await ingestInChunks(queue, { autoScan: false });
    const uploaded = Math.max(0, queue.length - result.failed);
    if (result.failed > 0) {
      await this.audit(
        SmsAuditEvent.API_FAILURE,
        `Offline queue partial flush; ${result.failed} left`,
        undefined,
        undefined,
        'failure',
      );
      return { uploaded, failed: true };
    }
    return { uploaded, failed: false };
  },

  async syncInboxPage(
    limit = 50,
    offset = 0,
    options: { autoScan?: boolean } = {},
  ) {
    if (!ShieldAndroidSms.isAvailable()) {
      throw new Error('Android SMS module requires a development build (not Expo Go).');
    }
    if (!ShieldAndroidSms.hasPermission()) {
      await this.audit(
        SmsAuditEvent.PERMISSION_REVOKED,
        'READ_SMS missing during sync',
        undefined,
        undefined,
        'failure',
      );
      throw new Error('READ_SMS permission is required');
    }

    await this.audit(SmsAuditEvent.SYNC_STARTED, 'Reading device SMS inbox');
    await this.reconcileDeletions(Math.max(limit, 100)).catch(() => undefined);
    const messages = await ShieldAndroidSms.readInbox(limit, offset);
    const synced = await loadSyncedIds();
    const fresh = messages.filter((m) => !synced.has(m.android_sms_id || m.id));

    if (!fresh.length) {
      await this.audit(SmsAuditEvent.SYNC_COMPLETED, 'No new SMS to upload');
      return { read: messages.length, uploaded: 0, queued: 0 };
    }

    // Bulk history: store + classify without full fraud pipeline (keeps UI responsive).
    // Live/incoming paths pass autoScan: true.
    const result = await ingestInChunks(fresh, { autoScan: options.autoScan ?? false });
    const uploaded = Math.max(0, fresh.length - result.failed);
    if (result.failed > 0 && uploaded === 0) {
      await this.audit(
        SmsAuditEvent.API_FAILURE,
        'Ingest failed; queued offline',
        undefined,
        undefined,
        'failure',
      );
      throw new Error('Upload failed — messages queued for retry');
    }
    if (result.failed > 0) {
      await this.audit(
        SmsAuditEvent.SYNC_COMPLETED,
        `Uploaded ${uploaded} SMS; ${result.failed} queued for retry`,
      );
      return { read: messages.length, uploaded, queued: result.failed };
    }
    await this.audit(SmsAuditEvent.SYNC_COMPLETED, `Uploaded ${uploaded} SMS`);
    return { read: messages.length, uploaded, queued: 0 };
  },

  async handleIncoming(messages: DeviceSms[]) {
    if (!messages.length) return;
    await this.audit(SmsAuditEvent.INCOMING_DETECTED, `Incoming ${messages.length} SMS`);
    const result = await ingestInChunks(messages, { autoScan: true });
    if (result.failed > 0) {
      await this.audit(
        SmsAuditEvent.CONNECTION_LOST,
        `Incoming SMS partial upload; ${result.failed} queued`,
        undefined,
        undefined,
        'failure',
      );
    }
  },

  startWatching(onIncoming: (messages: DeviceSms[]) => void) {
    const sub = ShieldAndroidSms.addSmsListener((msgs) => {
      onIncoming(msgs);
      void this.handleIncoming(msgs);
    });
    void ShieldAndroidSms.startWatching();
    return sub;
  },
};
