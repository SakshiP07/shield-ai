import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Eye } from 'lucide-react';
import { QrScanner } from '../../components/scan/QrScanner';
import { Badge } from '../../components/mobile/Badge';
import { MobileCard, MobilePage } from '../../components/mobile/MobilePage';
import { useToast } from '../../hooks/ToastContext';
import { ApiError, api, type ScanResult } from '../../lib/api';

const TABS = [
  { id: 'qr', label: 'QR Code' },
  { id: 'sms', label: 'SMS' },
  { id: 'upi', label: 'UPI ID' },
  { id: 'phone', label: 'Phone No.' },
  { id: 'link', label: 'Link' },
] as const;

type TabId = (typeof TABS)[number]['id'];

const TAB_CONFIG: Record<
  TabId,
  { label: string; placeholder: string; button: string; multiline?: boolean }
> = {
  qr: { label: '', placeholder: 'Or paste QR payload / URL', button: 'Analyze QR' },
  sms: { label: 'SMS CONTENT', placeholder: 'Paste SMS text here...', button: 'Analyze SMS', multiline: true },
  upi: { label: 'UPI ID', placeholder: 'e.g. merchant@okaxis', button: 'Analyze UPI ID' },
  phone: { label: 'PHONE NUMBER', placeholder: '+91 XXXXX XXXXX', button: 'Analyze Phone' },
  link: { label: 'LINK', placeholder: 'https://payment-link.com/...', button: 'Analyze Link' },
};

const DECISION_VARIANT: Record<string, 'safe' | 'warning' | 'danger'> = {
  approve: 'safe',
  otp: 'warning',
  hold: 'warning',
  block: 'danger',
};

const DECISION_TOAST: Record<string, 'success' | 'error' | 'info'> = {
  approve: 'success',
  otp: 'info',
  hold: 'info',
  block: 'error',
};

function formatScanError(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 401) return 'Session expired. Please sign in again.';
    if (err.status >= 500) return 'Scan service is temporarily unavailable.';
    return err.message;
  }
  if (err instanceof TypeError && String(err.message).includes('fetch')) {
    return 'Cannot reach the server. Check your connection.';
  }
  return err instanceof Error ? err.message : 'Scan failed';
}

export function ScanPage() {
  const [searchParams] = useSearchParams();
  const initialTab = (searchParams.get('tab') as TabId) || 'qr';
  const [activeTab, setActiveTab] = useState<TabId>(
    TABS.some((t) => t.id === initialTab) ? initialTab : 'qr',
  );
  const [value, setValue] = useState('');
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<ScanResult | null>(null);
  const { showToast } = useToast();

  const config = TAB_CONFIG[activeTab];

  const runScan = async (content: string) => {
    const trimmed = content.trim();
    if (!trimmed) {
      setError('Enter or scan content to analyze.');
      return;
    }

    setScanning(true);
    setError('');
    try {
      const scanResult = await api.analyzeScan(activeTab, trimmed);
      setResult(scanResult);
      const toastType = DECISION_TOAST[scanResult.decision] ?? 'info';
      showToast(`${scanResult.decision.toUpperCase()}: ${scanResult.message}`, toastType);
      if (scanResult.decision === 'approve') setValue('');
    } catch (err) {
      setResult(null);
      const message = formatScanError(err);
      setError(message);
      showToast(message, 'error');
    } finally {
      setScanning(false);
    }
  };

  return (
    <MobilePage>
      <div className="mb-4 flex gap-2 overflow-x-auto pb-1 scrollbar-none">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => {
              setActiveTab(tab.id);
              setValue('');
              setError('');
              setResult(null);
            }}
            className={`btn-touch shrink-0 rounded-full px-4 py-2.5 text-[13px] font-medium transition ${
              activeTab === tab.id ? 'bg-blue-600 text-white' : 'bg-surface-card text-slate-400'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'qr' ? (
        <MobileCard padding="lg">
          <QrScanner
            onScan={(decoded) => {
              setValue(decoded);
              void runScan(decoded);
            }}
            onError={(message) => setError(message)}
          />
          <input
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={config.placeholder}
            className="mt-4 w-full bg-transparent text-center text-[15px] text-white outline-none placeholder:text-slate-600"
          />
        </MobileCard>
      ) : (
        <MobileCard>
          <p className="mb-3 text-[13px] font-semibold tracking-wider text-slate-500">{config.label}</p>
          {config.multiline ? (
            <textarea
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={config.placeholder}
              rows={6}
              className="w-full resize-none bg-transparent text-[15px] leading-relaxed text-white outline-none placeholder:text-slate-600"
            />
          ) : (
            <input
              type="text"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={config.placeholder}
              className="w-full bg-transparent text-[15px] text-white outline-none placeholder:text-slate-600"
            />
          )}
        </MobileCard>
      )}

      <button
        type="button"
        onClick={() => void runScan(value)}
        disabled={scanning}
        className="btn-primary mt-4 gap-2"
      >
        <Eye className="h-4 w-4" />
        {scanning ? 'Analyzing...' : config.button}
      </button>

      {error && <p className="mt-3 text-[15px] text-rose-400">{error}</p>}

      {result && (
        <MobileCard className="mt-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-[15px] font-semibold text-white">Scan result</h2>
            <Badge variant={DECISION_VARIANT[result.decision] ?? 'warning'}>
              {result.decision.toUpperCase()}
            </Badge>
          </div>
          <p className="text-[15px] leading-relaxed text-slate-300">{result.message}</p>
          <div className="mt-4 grid grid-cols-3 gap-3 text-center">
            <div>
              <p className="text-lg font-bold text-blue-400">{result.risk_score}</p>
              <p className="text-[13px] text-slate-500">Risk score</p>
            </div>
            <div>
              <p className="text-lg font-bold text-blue-400">{Math.round(result.fraud_score * 100)}%</p>
              <p className="text-[13px] text-slate-500">Fraud probability</p>
            </div>
            <div>
              <p className="truncate text-lg font-bold capitalize text-white">{result.risk_level}</p>
              <p className="text-[13px] text-slate-500">Risk level</p>
            </div>
          </div>
        </MobileCard>
      )}
    </MobilePage>
  );
}
