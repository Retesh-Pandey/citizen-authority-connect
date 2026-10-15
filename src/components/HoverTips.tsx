import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

/** Shows a small pill label above any icon button with an aria-label while hovered; hides on click or pointer leave. */
export function HoverTips() {
  const [tip, setTip] = useState<{ text: string; x: number; y: number } | null>(null);
  useEffect(() => {
    let current: Element | null = null;
    const over = (e: PointerEvent) => {
      if (e.pointerType === "touch") return;
      const el = (e.target as Element)?.closest?.("button[aria-label], a[aria-label], [data-tip]");
      if (!el || el === current) return;
      current = el;
      const text = el.getAttribute("data-tip") ?? el.getAttribute("aria-label") ?? "";
      if (!text) return;
      const r = el.getBoundingClientRect();
      setTip({ text, x: r.left + r.width / 2, y: r.bottom + 8 });
    };
    const out = (e: PointerEvent) => {
      if (!current) return;
      const to = e.relatedTarget as Node | null;
      if (to && current.contains(to)) return;
      current = null; setTip(null);
    };
    const hide = () => { current = null; setTip(null); };
    document.addEventListener("pointerover", over);
    document.addEventListener("pointerout", out);
    document.addEventListener("pointerdown", hide, true);
    window.addEventListener("scroll", hide, true);
    return () => {
      document.removeEventListener("pointerover", over);
      document.removeEventListener("pointerout", out);
      document.removeEventListener("pointerdown", hide, true);
      window.removeEventListener("scroll", hide, true);
    };
  }, []);
  if (!tip || typeof document === "undefined") return null;
  const x = Math.min(Math.max(tip.x, 60), window.innerWidth - 60);
  return createPortal(
    <div role="tooltip" style={{ left: x, top: tip.y }}
      className="pointer-events-none fixed z-[100] -translate-x-1/2 whitespace-nowrap rounded-full bg-foreground px-3 py-1 text-xs font-semibold text-background shadow-soft animate-in fade-in">
      {tip.text}
    </div>,
    document.body,
  );
}
