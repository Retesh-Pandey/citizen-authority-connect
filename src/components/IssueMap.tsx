import "leaflet/dist/leaflet.css";
import { useEffect, useRef, useState } from "react";
import type { LayerGroup, Map as LeafletMap } from "leaflet";
import type { IssueRow } from "@/lib/useCivic";

function tokenColor(name: string) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || `var(${name})`;
}

export function IssueMap({ issues, center, me, onSelect, className = "h-[60vh]" }: {
  issues: IssueRow[];
  center: { lat: number; lng: number };
  me?: { lat: number; lng: number } | undefined;
  onSelect?: (i: IssueRow) => void;
  className?: string;
}) {
  const el = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markerLayerRef = useRef<LayerGroup | null>(null);
  const [leaflet, setLeaflet] = useState<typeof import("leaflet")>();
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    let cancelled = false;
    import("leaflet")
      .then((L) => {
        if (cancelled || !el.current) return;
        const map = L.map(el.current, { scrollWheelZoom: true }).setView([center.lat, center.lng], 13);
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 19,
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        }).addTo(map);
        mapRef.current = map;
        markerLayerRef.current = L.layerGroup().addTo(map);
        setLeaflet(L);
        setReady(true);
      })
      .catch((reason: unknown) => {
        if (!cancelled) setError(reason instanceof Error ? reason.message : "The map could not be loaded.");
      });

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      markerLayerRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!ready || !leaflet || !mapRef.current || !markerLayerRef.current) return;
    const layer = markerLayerRef.current;
    layer.clearLayers();
    const colors = {
      pending: tokenColor("--pending"),
      progress: tokenColor("--progress"),
      resolved: tokenColor("--resolved"),
      primary: tokenColor("--primary"),
      border: tokenColor("--border"),
      card: tokenColor("--card"),
    };
    for (const issue of issues) {
      const fillColor = issue.status === "Resolved" ? colors.resolved : issue.status === "In Progress" ? colors.progress : colors.pending;
      leaflet.circleMarker([issue.lat, issue.lng], {
        radius: 9 + Math.min(issue.merged_count, 6),
        color: colors.card,
        weight: 2,
        fillColor,
        fillOpacity: 0.95,
      }).bindTooltip(issue.title).on("click", () => onSelect?.(issue)).addTo(layer);
    }
    if (me) {
      leaflet.circleMarker([me.lat, me.lng], {
        radius: 8,
        color: colors.card,
        weight: 3,
        fillColor: colors.primary,
        fillOpacity: 1,
      }).bindTooltip("You are here").addTo(layer);
    }
  }, [ready, leaflet, issues, me, onSelect]);

  useEffect(() => {
    if (ready) mapRef.current?.panTo([center.lat, center.lng]);
  }, [ready, center.lat, center.lng]);

  return (
    <div className={`relative overflow-hidden rounded-[2rem] bg-secondary shadow-soft ${className}`}>
      <div ref={el} className="size-full" aria-label="Map of civic issues" />
      {error && <p className="absolute inset-0 grid place-items-center bg-background/80 text-sm text-muted-foreground">{error}</p>}
    </div>
  );
}

export function locationUrl(i: { lat: number; lng: number }) {
  return `https://www.openstreetmap.org/?mlat=${i.lat}&mlon=${i.lng}#map=17/${i.lat}/${i.lng}`;
}