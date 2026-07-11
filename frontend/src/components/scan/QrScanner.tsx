import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Camera, CameraOff } from 'lucide-react';

type QrScannerProps = {
  onScan: (value: string) => void;
  onError?: (message: string) => void;
};

export function QrScanner({ onScan, onError }: QrScannerProps) {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [active, setActive] = useState(false);
  const [starting, setStarting] = useState(false);
  const containerId = 'shieldai-qr-scanner';

  useEffect(() => {
    return () => {
      void stopScanner();
    };
  }, []);

  const stopScanner = async () => {
    const scanner = scannerRef.current;
    if (!scanner) return;
    try {
      if (scanner.isScanning) {
        await scanner.stop();
      }
      scanner.clear();
    } catch {
      // ignore cleanup errors
    } finally {
      scannerRef.current = null;
      setActive(false);
    }
  };

  const startScanner = async () => {
    setStarting(true);
    try {
      await stopScanner();
      const scanner = new Html5Qrcode(containerId);
      scannerRef.current = scanner;
      await scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 220, height: 220 } },
        (decoded) => {
          onScan(decoded);
          void stopScanner();
        },
        () => {
          // ignore per-frame scan misses
        },
      );
      setActive(true);
    } catch {
      onError?.('Camera access denied or unavailable. Paste the QR content manually.');
      await stopScanner();
    } finally {
      setStarting(false);
    }
  };

  return (
    <div className="space-y-3">
      <div
        id={containerId}
        className={`relative mx-auto overflow-hidden rounded-2xl bg-black/60 ${active ? 'aspect-square max-w-[260px]' : 'hidden'}`}
      />
      {!active && (
        <div className="relative mx-auto flex aspect-square max-w-[260px] items-center justify-center rounded-2xl bg-black/60">
          <div className="absolute inset-8">
            <span className="absolute left-0 top-0 h-8 w-8 rounded-tl-lg border-l-2 border-t-2 border-blue-500" />
            <span className="absolute right-0 top-0 h-8 w-8 rounded-tr-lg border-r-2 border-t-2 border-blue-500" />
            <span className="absolute bottom-0 left-0 h-8 w-8 rounded-bl-lg border-b-2 border-l-2 border-blue-500" />
            <span className="absolute bottom-0 right-0 h-8 w-8 rounded-br-lg border-b-2 border-r-2 border-blue-500" />
          </div>
          <Camera className="h-8 w-8 text-slate-500" />
        </div>
      )}
      <button
        type="button"
        onClick={() => (active ? void stopScanner() : void startScanner())}
        disabled={starting}
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/[0.08] bg-surface-input py-3 text-sm font-medium text-white transition hover:bg-white/[0.04] disabled:opacity-50"
      >
        {active ? <CameraOff className="h-4 w-4" /> : <Camera className="h-4 w-4" />}
        {starting ? 'Starting camera...' : active ? 'Stop camera' : 'Scan with camera'}
      </button>
    </div>
  );
}
