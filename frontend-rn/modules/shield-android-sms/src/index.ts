import { NativeModule, requireNativeModule, Platform, type EventSubscription } from 'expo-modules-core';

export type DeviceSms = {
  id: string;
  android_sms_id: string;
  address: string;
  phone_number: string;
  sender: string;
  body: string;
  timestamp: number;
  received_at: string;
  is_read: boolean;
  thread_id: string | null;
  folder: string;
  is_otp: boolean;
  otp_code: string | null;
};

type ShieldAndroidSmsNative = NativeModule & {
  isAndroid(): boolean;
  hasReadSmsPermission(): boolean;
  readInbox(limit: number, offset: number): Promise<DeviceSms[]>;
  readSince(afterEpochMs: number, limit: number): Promise<DeviceSms[]>;
  startWatching(): Promise<boolean>;
  stopWatching(): Promise<boolean>;
  addListener(
    eventName: 'onSmsChanged',
    listener: (event: { messages?: DeviceSms[] }) => void,
  ): EventSubscription;
};

function loadNative(): ShieldAndroidSmsNative | null {
  if (Platform.OS !== 'android') return null;
  try {
    return requireNativeModule<ShieldAndroidSmsNative>('ShieldAndroidSms');
  } catch {
    return null;
  }
}

const NativeShieldSms = loadNative();

export const ShieldAndroidSms = {
  isAvailable(): boolean {
    return Platform.OS === 'android' && NativeShieldSms != null;
  },

  hasPermission(): boolean {
    if (!NativeShieldSms) return false;
    try {
      return NativeShieldSms.hasReadSmsPermission();
    } catch {
      return false;
    }
  },

  async readInbox(limit = 50, offset = 0): Promise<DeviceSms[]> {
    if (!NativeShieldSms) return [];
    return NativeShieldSms.readInbox(limit, offset);
  },

  async readSince(afterEpochMs: number, limit = 50): Promise<DeviceSms[]> {
    if (!NativeShieldSms) return [];
    return NativeShieldSms.readSince(afterEpochMs, limit);
  },

  async startWatching(): Promise<boolean> {
    if (!NativeShieldSms) return false;
    return NativeShieldSms.startWatching();
  },

  async stopWatching(): Promise<boolean> {
    if (!NativeShieldSms) return false;
    return NativeShieldSms.stopWatching();
  },

  addSmsListener(listener: (messages: DeviceSms[]) => void): { remove: () => void } {
    if (!NativeShieldSms) {
      return { remove: () => undefined };
    }
    const sub = NativeShieldSms.addListener('onSmsChanged', (event) => {
      listener(event?.messages ?? []);
    });
    return { remove: () => sub.remove() };
  },
};

export default ShieldAndroidSms;
