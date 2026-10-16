import { BrowserQRCodeReader, type IScannerControls } from '@zxing/browser';
import { BarcodeFormat, DecodeHintType } from '@zxing/library';
import { Camera, Flashlight, Keyboard, RotateCcw, ScanLine, Square } from 'lucide-react';
import { FormEvent, useEffect, useRef, useState } from 'react';
import { StatusBadge } from '../components/StatusBadge';
import { useAuth } from '../features/auth/use-auth';
import { manualCheckIn, scanQr, undoCheckIn } from '../features/checkin/api';
import { getGoogleLoginUrl } from '../lib/api-client';
import { getApiErrorMessage } from '../lib/api-error';
import type { CheckInResponseData } from '../types/checkin';

const resultText: Record<string, string> = {
  success: 'Soát vé thành công',
  already_checked_in: 'Vé đã được sử dụng',
  invalid: 'Mã QR không hợp lệ',
  revoked: 'Vé đã bị thu hồi',
  refunded: 'Vé đã hoàn tiền',
  unpaid: 'Đơn chưa thanh toán',
  undone: 'Đã hoàn tác soát vé',
};

interface NativeBarcodeDetector {
  detect(source: HTMLVideoElement): Promise<Array<{ rawValue: string }>>;
}

interface NativeBarcodeDetectorConstructor {
  new (options: { formats: string[] }): NativeBarcodeDetector;
  getSupportedFormats(): Promise<string[]>;
}

function getNativeBarcodeDetector() {
  return (window as typeof window & { BarcodeDetector?: NativeBarcodeDetectorConstructor })
    .BarcodeDetector;
}

export function CheckInPage() {
  const authQuery = useAuth();
  const user = authQuery.data?.user;
  const allowed = user?.roles.some((role) => ['check_in', 'admin', 'super_admin'].includes(role));
  const canUndo = user?.roles.some((role) => ['admin', 'super_admin'].includes(role));
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const inFlightRef = useRef(new Set<string>());
  const recentlySeenRef = useRef(new Map<string, number>());
  const codeInputRef = useRef<HTMLInputElement>(null);
  const nativeScannerActiveRef = useRef(false);
  const nativeScannerTimerRef = useRef<number | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [torchAvailable, setTorchAvailable] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [result, setResult] = useState<CheckInResponseData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(
    () => () => {
      controlsRef.current?.stop();
      nativeScannerActiveRef.current = false;
      if (nativeScannerTimerRef.current) window.clearTimeout(nativeScannerTimerRef.current);
    },
    [],
  );

  const processToken = async (value: string, source: 'camera' | 'usb') => {
    const normalized = value.trim();
    const now = Date.now();
    if (
      inFlightRef.current.has(normalized) ||
      now - (recentlySeenRef.current.get(normalized) ?? 0) < 2_500
    )
      return;
    inFlightRef.current.add(normalized);
    recentlySeenRef.current.set(normalized, now);
    window.setTimeout(() => recentlySeenRef.current.delete(normalized), 2_500);
    setError(null);
    try {
      const response = normalized.startsWith('gala:')
        ? await scanQr(
            { requestId: crypto.randomUUID(), qrToken: normalized, source },
            authQuery.data?.csrfToken ?? '',
          )
        : await manualCheckIn(
            { requestId: crypto.randomUUID(), ticketCode: normalized.toUpperCase() },
            authQuery.data?.csrfToken ?? '',
          );
      setResult(response);
    } catch (scanError) {
      setError(getApiErrorMessage(scanError, 'Không thể kiểm tra vé.'));
    } finally {
      inFlightRef.current.delete(normalized);
      codeInputRef.current?.focus();
    }
  };

  const startCamera = async () => {
    setError(null);
    try {
      const hints = new Map();
      hints.set(DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.QR_CODE]);
      hints.set(DecodeHintType.TRY_HARDER, true);
      const reader = new BrowserQRCodeReader(hints, { delayBetweenScanAttempts: 100 });
      controlsRef.current = await reader.decodeFromConstraints(
        {
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        },
        videoRef.current ?? undefined,
        (scanResult) => {
          if (scanResult) void processToken(scanResult.getText(), 'camera');
        },
      );
      const Detector = getNativeBarcodeDetector();
      const nativeFormats = Detector ? await Detector.getSupportedFormats().catch(() => []) : [];
      if (Detector && nativeFormats.includes('qr_code')) {
        const detector = new Detector({ formats: ['qr_code'] });
        nativeScannerActiveRef.current = true;
        const scanNative = async () => {
          if (!nativeScannerActiveRef.current) return;
          const video = videoRef.current;
          if (video?.readyState && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
            const barcodes = await detector.detect(video).catch(() => []);
            for (const barcode of barcodes) {
              if (barcode.rawValue) void processToken(barcode.rawValue, 'camera');
            }
          }
          nativeScannerTimerRef.current = window.setTimeout(scanNative, 120);
        };
        void scanNative();
      }
      const track = (videoRef.current?.srcObject as MediaStream | null)?.getVideoTracks()[0];
      if (track) {
        const capabilities = track.getCapabilities() as MediaTrackCapabilities & {
          focusMode?: string[];
          torch?: boolean;
        };
        if (capabilities.focusMode?.includes('continuous')) {
          await track
            .applyConstraints({
              advanced: [{ focusMode: 'continuous' } as MediaTrackConstraintSet],
            })
            .catch(() => undefined);
        }
        setTorchAvailable(Boolean(capabilities.torch && controlsRef.current?.switchTorch));
      }
      setCameraActive(true);
    } catch {
      setError('Không mở được camera. Hãy cấp quyền camera hoặc dùng máy quét USB.');
    }
  };

  const stopCamera = () => {
    controlsRef.current?.stop();
    controlsRef.current = null;
    nativeScannerActiveRef.current = false;
    if (nativeScannerTimerRef.current) window.clearTimeout(nativeScannerTimerRef.current);
    nativeScannerTimerRef.current = null;
    setCameraActive(false);
    setTorchAvailable(false);
    setTorchOn(false);
  };

  if (authQuery.isPending) return <div className="min-h-[70dvh] animate-pulse" />;
  if (!authQuery.data?.authenticated)
    return (
      <section className="mx-auto min-h-[60dvh] max-w-4xl px-4 py-16">
        <ScanLine className="text-coral-600" size={30} />
        <h1 className="mt-5 text-3xl font-black">Đăng nhập để soát vé</h1>
        <a
          href={getGoogleLoginUrl('/check-in')}
          className="mt-7 inline-flex h-12 items-center rounded-md bg-coral-600 px-5 font-bold text-white"
        >
          Đăng nhập Google
        </a>
      </section>
    );
  if (!allowed)
    return (
      <section className="mx-auto min-h-[60dvh] max-w-4xl px-4 py-16">
        <h1 className="text-3xl font-black">Không có quyền soát vé</h1>
      </section>
    );

  const submitCode = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const value = String(form.get('code') || '').trim();
    if (value) void processToken(value, 'usb');
    event.currentTarget.reset();
    codeInputRef.current?.focus();
  };

  return (
    <section className="mx-auto max-w-6xl px-4 pb-10 pt-5 sm:px-6 sm:py-8 lg:px-8">
      <div className="flex items-center gap-3">
        <ScanLine className="text-coral-600" size={28} />
        <div>
          <h1 className="text-3xl font-black">Soát vé</h1>
          <p className="mt-1 text-sm text-zinc-500">Quét QR hoặc nhập mã vé.</p>
        </div>
      </div>
      <div className="mt-5 grid gap-5 sm:mt-7 sm:gap-7 lg:grid-cols-[1.2fr_0.8fr]">
        <section className="overflow-hidden rounded-md border border-zinc-200 bg-zinc-950 dark:border-zinc-800">
          <div className="relative aspect-[4/3] max-h-[55dvh] min-h-64">
            <video ref={videoRef} muted playsInline className="h-full w-full object-cover" />
            {cameraActive ? (
              <div
                className="pointer-events-none absolute inset-0 grid place-items-center"
                aria-hidden="true"
              >
                <div className="aspect-square w-[62%] max-w-72 border-2 border-white/90 shadow-[0_0_0_999px_rgba(9,9,11,0.34)]" />
              </div>
            ) : null}
            {!cameraActive ? (
              <div className="absolute inset-0 grid place-items-center text-center text-zinc-300">
                <div>
                  <Camera className="mx-auto" size={36} />
                  <p className="mt-3 font-bold">Camera đang tắt</p>
                </div>
              </div>
            ) : null}
          </div>
          <div className="flex justify-center gap-3 border-t border-zinc-800 p-3 sm:p-4">
            {cameraActive ? (
              <button
                onClick={stopCamera}
                className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-md bg-zinc-800 px-4 font-bold text-white sm:flex-none"
              >
                <Square size={16} /> Dừng camera
              </button>
            ) : (
              <button
                onClick={startCamera}
                className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-md bg-coral-600 px-4 font-bold text-white sm:flex-none"
              >
                <Camera size={17} /> Mở camera sau
              </button>
            )}
            {cameraActive && torchAvailable ? (
              <button
                type="button"
                onClick={async () => {
                  const next = !torchOn;
                  await controlsRef.current?.switchTorch?.(next);
                  setTorchOn(next);
                }}
                className="grid size-12 shrink-0 place-items-center rounded-md border border-zinc-700 text-white"
                title={torchOn ? 'Tắt đèn pin' : 'Bật đèn pin'}
              >
                <Flashlight size={18} />
                <span className="sr-only">{torchOn ? 'Tắt đèn pin' : 'Bật đèn pin'}</span>
              </button>
            ) : null}
          </div>
        </section>
        <section>
          <form
            onSubmit={submitCode}
            className="rounded-md border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900"
          >
            <label className="grid gap-2 font-bold">
              <span className="flex items-center gap-2">
                <Keyboard size={18} /> Máy quét USB hoặc mã vé
              </span>
              <input
                ref={codeInputRef}
                autoFocus
                name="code"
                autoComplete="off"
                onInput={(event) => {
                  event.currentTarget.value = event.currentTarget.value.toUpperCase();
                }}
                placeholder="Quét QR hoặc nhập GT-..."
                className="h-12 rounded-md border border-zinc-300 bg-transparent px-3 font-mono uppercase dark:border-zinc-700"
              />
            </label>
            <button className="mt-3 h-11 w-full rounded-md bg-coral-600 px-4 font-bold text-white">
              Kiểm tra vé
            </button>
          </form>
          {error ? (
            <p
              role="alert"
              className="mt-4 rounded-md bg-coral-500/10 p-4 font-bold text-coral-600"
            >
              {error}
            </p>
          ) : null}
          {result ? (
            <div
              className={`mt-4 rounded-md border p-5 ${result.result === 'success' ? 'border-emerald-500 bg-emerald-500/10' : 'border-coral-500 bg-coral-500/10'}`}
            >
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-xl font-black">{resultText[result.result]}</h2>
                <StatusBadge status={result.result} />
              </div>
              {result.ticket ? (
                <div className="mt-4 grid gap-2 text-sm">
                  <p>
                    <strong>Mã vé:</strong> {result.ticket.code}
                  </p>
                  <p>
                    <strong>Người mua:</strong> {result.ticket.buyerName}
                  </p>
                  <p>
                    <strong>Đơn:</strong> {result.ticket.orderReference}
                  </p>
                  {result.ticket.checkedInAt ? (
                    <p>
                      <strong>Soát vé lúc:</strong>{' '}
                      {new Intl.DateTimeFormat('vi-VN', {
                        timeStyle: 'medium',
                        dateStyle: 'short',
                      }).format(new Date(result.ticket.checkedInAt))}
                    </p>
                  ) : null}
                </div>
              ) : null}
              {canUndo && result.result === 'already_checked_in' && result.ticket ? (
                <button
                  onClick={async () => {
                    const reason = window.prompt('Lý do hoàn tác soát vé');
                    if (!reason) return;
                    try {
                      setResult(
                        await undoCheckIn(
                          result.ticket!.code,
                          reason,
                          authQuery.data?.csrfToken ?? '',
                        ),
                      );
                    } catch (undoError) {
                      setError(getApiErrorMessage(undoError, 'Không thể hoàn tác.'));
                    }
                  }}
                  className="mt-4 inline-flex items-center gap-2 rounded-md border border-zinc-400 px-3 py-2 text-sm font-bold"
                >
                  <RotateCcw size={16} /> Hoàn tác
                </button>
              ) : null}
            </div>
          ) : null}
        </section>
      </div>
    </section>
  );
}
