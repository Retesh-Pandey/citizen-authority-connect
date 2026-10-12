import { useEffect, useRef, useState } from "react";
import { Camera, RefreshCw, X, Smartphone } from "lucide-react";

/** Live camera only — no gallery uploads, so photos are taken on the spot.
 *  Falls back to the device's native camera (capture attribute) when in-page camera is blocked. */
export function LiveCamera({ onCapture, onClose, label = "Capture" }: {
  onCapture: (blob: Blob, preview: string) => void;
  onClose?: () => void;
  label?: string;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string>();
  const [ready, setReady] = useState(false);
  const [inFrame, setInFrame] = useState(false);
  useEffect(() => { try { setInFrame(window.self !== window.top); } catch { setInFrame(true); } }, []);
  const [facing, setFacing] = useState<"environment" | "user">("environment");

  useEffect(() => {
    let stream: MediaStream | undefined;
    let cancelled = false;
    setReady(false);
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("In-page camera isn't available here. Use your phone camera below.");
      return;
    }
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: { ideal: facing } }, audio: false })
      .catch(() => navigator.mediaDevices.getUserMedia({ video: true, audio: false }))
      .then(async (s) => {
        if (cancelled) { s.getTracks().forEach((t) => t.stop()); return; }
        stream = s;
        setError(undefined);
        const v = videoRef.current;
        if (v) { v.srcObject = s; try { await v.play(); } catch { /* autoplay */ } }
      })
      .catch(() => setError("Camera is blocked here. The editor preview window doesn't allow camera access — open the app in its own tab, allow camera when asked, or use your phone camera below."));
    return () => { cancelled = true; stream?.getTracks().forEach((t) => t.stop()); };
  }, [facing]);

  const capture = () => {
    const v = videoRef.current;
    if (!v || !v.videoWidth) return;
    const c = document.createElement("canvas");
    const scale = Math.min(1, 1280 / v.videoWidth);
    c.width = v.videoWidth * scale;
    c.height = v.videoHeight * scale;
    c.getContext("2d")!.drawImage(v, 0, 0, c.width, c.height);
    c.toBlob((b) => b && onCapture(b, URL.createObjectURL(b)), "image/jpeg", 0.85);
  };

  const onNative = async (f?: File) => {
    if (!f) return;
    // Recompress to jpeg so uploads stay small
    const img = await createImageBitmap(f);
    const c = document.createElement("canvas");
    const scale = Math.min(1, 1280 / img.width);
    c.width = img.width * scale; c.height = img.height * scale;
    c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
    c.toBlob((b) => b && onCapture(b, URL.createObjectURL(b)), "image/jpeg", 0.85);
    if (fileRef.current) fileRef.current.value = "";
  };

  return (
    <div className="space-y-3">
      <div className="relative aspect-[3/4] w-full overflow-hidden rounded-[2rem] bg-secondary">
        {error ? (
          <div className="grid h-full place-content-center gap-4 p-6 text-center text-sm text-secondary-foreground">
            <p>{error}</p>
            {inFrame && (
              <a href={window.location.href} target="_blank" rel="noreferrer" className="mx-auto rounded-full bg-warm px-5 py-3 font-bold text-primary-foreground">Open app in a new tab</a>
            )}
          </div>
        ) : (
          <video ref={videoRef} autoPlay playsInline muted onLoadedData={() => setReady(true)} className="size-full object-cover" />
        )}
        <span className="absolute left-4 top-4 flex items-center gap-1.5 rounded-full bg-card/90 px-3 py-1 text-xs font-bold text-primary">
          <span className="size-2 animate-pulse rounded-full bg-primary" /> LIVE
        </span>
        {onClose && (
          <button onClick={onClose} aria-label="Close camera" className="absolute right-4 top-4 grid size-10 place-items-center rounded-full bg-card/90">
            <X className="size-5" />
          </button>
        )}
        {!error && (
          <div className="absolute inset-x-0 bottom-5 flex items-center justify-center gap-4">
            <button onClick={() => setFacing((f) => (f === "user" ? "environment" : "user"))} aria-label="Switch camera" className="grid size-12 place-items-center rounded-full bg-card/90">
              <RefreshCw className="size-5" />
            </button>
            <button onClick={capture} disabled={!ready} className="flex items-center gap-2 rounded-full bg-warm px-6 py-4 font-bold text-primary-foreground shadow-soft active:scale-95 disabled:opacity-60">
              <Camera className="size-5" /> {label}
            </button>
          </div>
        )}
      </div>
      <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => onNative(e.target.files?.[0])} />
      <button onClick={() => fileRef.current?.click()} className="flex w-full items-center justify-center gap-2 rounded-full border bg-card py-3 text-sm font-semibold">
        <Smartphone className="size-4" /> Use phone camera instead
      </button>
    </div>
  );
}
