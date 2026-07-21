import { useEffect, useId, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Camera, CameraOff } from 'lucide-react';

type QrScannerProps = {
  onScan: (value: string) => void;
  onError?: (message: string) => void;
};

function formatCameraError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err ?? '');
  const lower = msg.toLowerCase();
  if (lower.includes('permission') || lower.includes('notallowed') || lower.includes('denied')) {
    return 'Camera permission denied. Allow camera access in the browser address bar, then try again.';
  }
  if (lower.includes('notfound') || lower.includes('no camera') || lower.includes('requested device')) {
    return 'No camera found. Connect a camera or paste the QR content manually.';
  }
  if (lower.includes('notreadable') || lower.includes('trackstart') || lower.includes('in use')) {
    return 'Camera is in use by another app. Close it and try again.';
  }
  return msg || 'Camera access denied or unavailable. Paste the QR content manually.';
}

async function waitForLayout(): Promise<void> {
  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
}

export function QrScanner({ onScan, onError }: QrScannerProps) {
  const reactId = useId().replace(/:/g, '');
  const containerId = `shieldai-qr-scanner-${reactId}`;
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const startingRef = useRef(false);
  const [active, setActive] = useState(false);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    return () => {
      void teardown();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const teardown = async () => {
    const scanner = scannerRef.current;
    scannerRef.current = null;
    if (!scanner) return;
    try {
      if (scanner.isScanning) await scanner.stop();
      scanner.clear();
    } catch {
      // ignore cleanup errors
    }
  };

  const stopScanner = async () => {
    await teardown();
    setActive(false);
  };

  const startWithConstraints = async (
    scanner: Html5Qrcode,
    cameraConfig: string | MediaTrackConstraints,
  ) => {
    await scanner.start(
      cameraConfig,
      {
        fps: 10,
        qrbox: (viewfinderWidth, viewfinderHeight) => {
          const edge = Math.floor(Math.min(viewfinderWidth, viewfinderHeight) * 0.72);
          return { width: Math.max(edge, 120), height: Math.max(edge, 120) };
        },
        aspectRatio: 1,
      },
      (decoded) => {
        onScan(decoded);
        void stopScanner();
      },
      () => undefined,
    );
  };

  const startScanner = async () => {
    if (startingRef.current) return;
    startingRef.current = true;
    setStarting(true);

    try {
      await teardown();

      // Container must be visible with real dimensions before html5-qrcode starts.
      setActive(true);
      await waitForLayout();

      const el = document.getElementById(containerId);
      if (!el || el.clientWidth < 40) {
        throw new Error('Camera view is not ready. Try again.');
      }

      const scanner = new Html5Qrcode(containerId, { verbose: false });
      scannerRef.current = scanner;

      const attempts: Array<string | MediaTrackConstraints> = [
        { facingMode: { ideal: 'environment' } },
        { facingMode: { ideal: 'user' } },
      ];

      let lastError: unknown;
      for (const config of attempts) {
        try {
          await startWithConstraints(scanner, config);
          return;
        } catch (err) {
          lastError = err;
          // If start partially mounted a video, clear before next attempt.
          try {
            if (scanner.isScanning) await scanner.stop();
          } catch {
            // ignore
          }
        }
      }

      const cameras = await Html5Qrcode.getCameras().catch(() => []);
      if (cameras.length > 0) {
        await startWithConstraints(scanner, cameras[0].id);
        return;
      }

      throw lastError ?? new Error('No camera found on this device.');
    } catch (err) {
      onError?.(formatCameraError(err));
      await teardown();
      setActive(false);
    } finally {
      startingRef.current = false;
      setStarting(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="relative mx-auto aspect-square w-full max-w-[260px] overflow-hidden rounded-2xl bg-black">
        <div
          id={containerId}
          className={`absolute inset-0 [&_video]:h-full [&_video]:w-full [&_video]:object-cover ${
            active ? 'block' : 'invisible'
          }`}
        />
        {!active && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="absolute inset-8 pointer-events-none">
              <span className="absolute left-0 top-0 h-8 w-8 rounded-tl-lg border-l-2 border-t-2 border-blue-500" />
              <span className="absolute right-0 top-0 h-8 w-8 rounded-tr-lg border-r-2 border-t-2 border-blue-500" />
              <span className="absolute bottom-0 left-0 h-8 w-8 rounded-bl-lg border-b-2 border-l-2 border-blue-500" />
              <span className="absolute bottom-0 right-0 h-8 w-8 rounded-br-lg border-b-2 border-r-2 border-blue-500" />
            </div>
            <Camera className="h-8 w-8 text-slate-500" />
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={() => (active && !starting ? void stopScanner() : void startScanner())}
        disabled={starting}
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/[0.08] bg-surface-input py-3 text-sm font-medium text-white transition hover:bg-white/[0.04] disabled:opacity-50"
      >
        {active && !starting ? <CameraOff className="h-4 w-4" /> : <Camera className="h-4 w-4" />}
        {starting ? 'Starting camera...' : active ? 'Stop camera' : 'Scan with camera'}
      </button>
    </div>
  );
}
