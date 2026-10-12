import { useEffect, useRef, useState } from "react";
import type { IssueRow } from "@/lib/useCivic";

declare global {
  interface Window { __civicMapsReady?: () => void; google?: any }
}

let loader: Promise<void> | undefined;
function loadMaps() {
  if (window.google?.maps) return Promise.resolve();
  loader ??= new Promise<void>((resolve, reject) => {
    window.__civicMapsReady = () => resolve();
    const s = document.createElement("script");
    const env = import.meta.env as Record<string, string>;
    s.src = `https://maps.googleapis.com/maps/api/js?key=${env["VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY"]}&loading=async&callback=__civicMapsReady&channel=${env["VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_TRACKING_ID"]}`;
    s.async = true;
    s.onerror = () => reject(new Error("Map failed to load"));
    document.head.appendChild(s);
  });
  return loader;
}

const statusColor: Record<string, string> = { Pending: "#d4a03a", "In Progress": "#d0703c", Resolved: "#5a9a5c" };

export function IssueMap({ issues, center, me, onSelect, className = "h-[60vh]" }: {
  issues: IssueRow[];
  center: { lat: number; lng: number };
  me?: { lat: number; lng: number } | undefined;
  onSelect?: (i: IssueRow) => void;
  className?: string;
}) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<any>(null);
  const markers = useRef<any[]>([]);
  const [err, setErr] = useState<string>();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    loadMaps()
      .then(() => {
        if (!el.current || map.current) return;
        map.current = new window.google.maps.Map(el.current, {
          center, zoom: 13, clickableIcons: false, disableDefaultUI: true, zoomControl: true,
          styles: [{ featureType: "poi", stylers: [{ visibility: "off" }] }],
        });
        setReady(true);
      })
      .catch((e) => setErr(e.message));
  }, []);

  useEffect(() => {
    if (!ready) return;
    const g = window.google.maps;
    markers.current.forEach((m) => m.setMap(null));
    markers.current = issues.map((i) => {
      const m = new g.Marker({
        position: { lat: i.lat, lng: i.lng }, map: map.current, title: i.title,
        icon: { path: g.SymbolPath.CIRCLE, scale: 9 + Math.min(i.merged_count, 6), fillColor: statusColor[i.status] ?? "#d0703c", fillOpacity: 0.95, strokeColor: "#fff", strokeWeight: 2 },
      });
      m.addListener("click", () => onSelect?.(i));
      return m;
    });
    if (me) {
      markers.current.push(new g.Marker({
        position: me, map: map.current, title: "You are here",
        icon: { path: g.SymbolPath.CIRCLE, scale: 7, fillColor: "#3b82f6", fillOpacity: 1, strokeColor: "#fff", strokeWeight: 3 },
      }));
    }
  }, [ready, issues, me, onSelect]);

  useEffect(() => { if (ready) map.current.panTo(center); }, [ready, center.lat, center.lng]);

  return (
    <div className={`relative overflow-hidden rounded-[2rem] bg-secondary shadow-soft ${className}`}>
      <div ref={el} className="size-full" />
      {err && <p className="absolute inset-0 grid place-items-center text-sm text-muted-foreground">{err}</p>}
    </div>
  );
}

export function directionsUrl(i: { lat: number; lng: number }) {
  return `https://www.google.com/maps/dir/?api=1&destination=${i.lat},${i.lng}`;
}
