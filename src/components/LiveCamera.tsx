import { useEffect, useRef, useState } from "react";
import { Camera, RefreshCw, X } from "lucide-react";

/** Live camera only — no gallery uploads, so photos are taken on the spot. */
export function LiveCamera({ onCapture, onClose, label = "Capture" }: {
  onCapture: (blob: Blob, preview: string) => void;
  onClose?: () => void;
  label?: string;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string>();
  const [facing, setFacing] = useState<"environment" | "user">("environment");

  useEffect(() => {
    let stream: MediaStream | undefined;
    navigator.mediaDevices
      ?.getUserMedia({ video: { facingMode: facing }, audio: false })
      .then((s) => {
        stream = s;
        if (videoRef.current) videoRef.current.srcObject = s;
      })
      .catch(() => setError("Camera access is needed to take a live photo. Please allow it in your browser."));
    if (!navigator.mediaDevices) setError("Camera not available on this device.");
    return () => stream?.getTracks().forEach((t) => t.stop());
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

  return (
    <div className="relative aspect-[3/4] w-full overflow-hidden rounded-[2rem] bg-secondary">
      {error ? (
        <p className="grid h-full place-items-center p-6 text-center text-sm text-secondary-foreground">{error}</p>
      ) : (
        <video ref={videoRef} autoPlay playsInline muted className="size-full object-cover" />
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
          <button onClick={capture} className="flex items-center gap-2 rounded-full bg-warm px-6 py-4 font-bold text-primary-foreground shadow-soft active:scale-95">
            <Camera className="size-5" /> {label}
          </button>
        </div>
      )}
    </div>
  );
}
