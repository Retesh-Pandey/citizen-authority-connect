import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { useQueryClient, useSuspenseQuery, useQuery } from "@tanstack/react-query";
import { X,
  Plus, MapPin, Sparkles, CheckCircle2, Clock, Loader2, Home, ListChecks, Map as MapIcon, Trophy,
  Building2, Layers, Trash2, Construction, Droplets, Lightbulb, ArrowLeft, ThumbsUp, LogOut, Navigation, Camera, Star, XCircle,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { meQuery, issuesQuery, leaderboardQuery, useLiveIssues, usePhotoUrls, uploadPhoto, type IssueRow } from "@/lib/useCivic";
import { reportIssue, resolveIssue, deleteMyIssue, deleteMyAccount } from "@/lib/issues.functions";
import { HoverTips } from "@/components/HoverTips";
import { UserX } from "lucide-react";
import { LiveCamera } from "@/components/LiveCamera";
import { LanguagePicker } from "@/components/LanguagePicker";
import { NotificationBell } from "@/components/NotificationBell";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { IssueMap, directionsUrl } from "@/components/IssueMap";
import { getPosition, distanceKm } from "@/lib/locations";

export const Route = createFileRoute("/_authenticated/app")({
  head: () => ({
    meta: [
      { title: "Dashboard — CivicConnect" },
      { name: "description", content: "Report, track and resolve civic issues in your city." },
      { property: "og:title", content: "CivicConnect Dashboard" },
      { property: "og:description", content: "Report, track and resolve civic issues in your city." },
    ],
  }),
  loader: ({ context }) => Promise.all([context.queryClient.ensureQueryData(meQuery), context.queryClient.ensureQueryData(issuesQuery)]),
  component: AppPage,
});

type Status = "Pending" | "In Progress" | "Resolved";
const statuses: Status[] = ["Pending", "In Progress", "Resolved"];
const deptIcon: Record<string, typeof Construction> = { Roads: Construction, Sanitation: Trash2, Water: Droplets, Electrical: Lightbulb };

function ago(d: string) {
  const h = (Date.now() - new Date(d).getTime()) / 36e5;
  return h < 1 ? `${Math.max(1, Math.round(h * 60))}m ago` : h < 24 ? `${Math.round(h)}h ago` : `${Math.round(h / 24)}d ago`;
}

function StatusBadge({ s }: { s: string }) {
  const cls = s === "Pending" ? "bg-pending-soft text-pending" : s === "In Progress" ? "bg-progress-soft text-progress" : "bg-resolved-soft text-resolved";
  const Icon = s === "Pending" ? Clock : s === "In Progress" ? Loader2 : CheckCircle2;
  return <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold ${cls}`}><Icon className="size-3.5" />{s}</span>;
}
function Severity({ n }: { n: number }) {
  return <span className="inline-flex items-center gap-0.5 rounded-full bg-muted px-2.5 py-1 text-xs font-semibold text-muted-foreground" aria-label={`Severity ${n} of 5`}>
    {Array.from({ length: 5 }).map((_, k) => <Star key={k} className={`size-3 ${k < n ? "fill-current text-primary" : ""}`} />)}
  </span>;
}
function IconPill({ children }: { children: ReactNode }) {
  return <span className="grid size-11 shrink-0 place-items-center rounded-full bg-secondary text-secondary-foreground">{children}</span>;
}

function AppPage() {
  useLiveIssues();
  const { data: me } = useSuspenseQuery(meQuery);
  const { data: issues } = useSuspenseQuery(issuesQuery);
  const qc = useQueryClient();
  const nav = useNavigate();

  const signOut = async () => {
    await qc.cancelQueries(); qc.clear();
    await supabase.auth.signOut();
    nav({ to: "/auth", replace: true });
  };
  const deleteAccount = async () => {
    if (!window.confirm("Delete your profile permanently? Your points and open reports will be removed. This cannot be undone.")) return;
    if (window.prompt('Type DELETE to confirm') !== "DELETE") return;
    try { await deleteMyAccount(); } catch { toast.error("Could not delete your profile."); return; }
    await qc.cancelQueries(); qc.clear();
    await supabase.auth.signOut();
    nav({ to: "/auth", replace: true });
  };

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b bg-background/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="grid size-9 place-items-center rounded-full bg-warm text-primary-foreground"><MapPin className="size-5" /></span>
            <span className="hidden font-display text-lg font-bold sm:inline">CivicConnect</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1 rounded-full bg-accent px-3 py-1.5 text-sm font-bold text-accent-foreground"><Trophy className="size-4" />{me.profile?.points ?? 0}</span>
            <span className="rounded-full bg-secondary px-3 py-1.5 text-sm font-semibold capitalize text-secondary-foreground">{me.role}</span>
            <LanguagePicker />
            <NotificationBell userId={me.id} />
            <button onClick={deleteAccount} aria-label="Delete my profile" className="grid size-10 place-items-center rounded-full bg-secondary text-destructive"><UserX className="size-4" /></button>
            <button onClick={signOut} aria-label="Sign out" className="grid size-10 place-items-center rounded-full bg-secondary"><LogOut className="size-4" /></button>
            <HoverTips />
          </div>
        </div>
      </header>
      <main>{me.role === "citizen" ? <Citizen me={me} issues={issues} /> : <Authority me={me} issues={issues} />}</main>
      <Toaster position="top-center" />
    </div>
  );
}

type Me = Awaited<ReturnType<NonNullable<typeof meQuery.queryFn>>>;

function useCenter(_me: Me) {
  const [c, setC] = useState({ lat: 22.5726, lng: 88.3639 });
  useEffect(() => { getPosition().then(setC).catch(() => {}); }, []);
  return c;
}

/* ---------------- Citizen ---------------- */

function Citizen({ me, issues }: { me: Me; issues: IssueRow[] }) {
  const [tab, setTab] = useState<"home" | "report" | "mine" | "map" | "ranks">("home");
  const mine = issues.filter((i) => i.reporter_id === me.id);
  const center = useCenter(me);

  return (
    <div className="mx-auto max-w-md px-4 pb-28 pt-5">
      {tab === "home" && (
        <div className="space-y-6 animate-in fade-in">
          <div>
            <p className="text-muted-foreground">Hi {me.profile?.display_name} 👋 · {me.profile?.district}</p>
            <h1 className="text-3xl font-bold leading-tight">Let's make your<br />neighbourhood better.</h1>
          </div>
          <button onClick={() => setTab("report")} className="flex w-full items-center justify-center gap-3 rounded-full bg-warm px-6 py-5 text-lg font-bold text-primary-foreground shadow-soft transition active:scale-95">
            <span className="grid size-9 place-items-center rounded-full bg-card/25"><Plus className="size-5" /></span> Report New Issue
          </button>
          <div className="grid grid-cols-3 gap-3">
            {statuses.map((s) => (
              <div key={s} className="rounded-3xl bg-card p-4 text-center shadow-soft">
                <div className="font-display text-2xl font-bold">{mine.filter((i) => i.status === s).length}</div>
                <div className="text-xs text-muted-foreground">{s}</div>
              </div>
            ))}
          </div>
          <div className="rounded-3xl bg-secondary p-4 text-sm text-secondary-foreground">
            <b>Earn points:</b> +10 per report, +5 per severity star, +5 when your report backs up an existing one.
          </div>
          <div>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Recent reports</h2>
              <button onClick={() => setTab("mine")} className="rounded-full bg-secondary px-3 py-1 text-sm font-semibold text-secondary-foreground">See all</button>
            </div>
            <ReportList list={mine.slice(0, 2)} />
          </div>
        </div>
      )}
      {tab === "report" && <ReportFlow me={me} onDone={() => setTab("mine")} onBack={() => setTab("home")} />}
      {tab === "mine" && (
        <div className="space-y-3 animate-in fade-in">
          <h1 className="mb-2 text-2xl font-bold">My Reports</h1>
          {mine.length ? <ReportList list={mine} /> : <p className="py-10 text-center text-muted-foreground">No reports yet.</p>}
        </div>
      )}
      {tab === "map" && <MapView issues={issues} center={center} />}
      {tab === "ranks" && <Leaderboard role="citizen" meId={me.id} />}

      <nav className="fixed inset-x-0 bottom-4 z-20 mx-auto flex w-[min(94%,26rem)] justify-around rounded-full border bg-card/95 p-1.5 shadow-soft backdrop-blur">
        {([["home", Home, "Home"], ["report", Plus, "Report"], ["mine", ListChecks, "Mine"], ["map", MapIcon, "Map"], ["ranks", Trophy, "Ranks"]] as const).map(([k, Icon, label]) => (
          <button key={k} onClick={() => setTab(k)} aria-label={label}
            className={`flex items-center gap-1.5 rounded-full px-3 py-2.5 text-sm font-semibold transition ${tab === k ? "bg-warm text-primary-foreground" : "text-muted-foreground"}`}>
            <Icon className="size-5" />{tab === k && label}
          </button>
        ))}
      </nav>
    </div>
  );
}

function ReportList({ list }: { list: IssueRow[] }) {
  const urls = usePhotoUrls(list.map((i) => i.photo_url));
  return <div className="space-y-3">{list.map((i) => <ReportCard key={i.id} i={i} photo={urls[i.photo_url]} />)}</div>;
}

function ReportCard({ i, photo }: { i: IssueRow; photo?: string | undefined }) {
  const qc = useQueryClient();
  const confirm = async () => {
    await supabase.from("issues").update({ citizen_confirmed: true }).eq("id", i.id);
    qc.invalidateQueries({ queryKey: ["issues"] });
  };
  const canDelete = i.status !== "Resolved" && i.merged_count <= 1;
  const remove = async () => {
    if (!window.confirm("Delete this report? This cannot be undone.")) return;
    try {
      const r = await deleteMyIssue({ data: { id: i.id } });
      toast.success(r.removedPoints ? `Report deleted · ${r.removedPoints} points removed` : "Report deleted");
    } catch { toast.error("Could not delete this report."); return; }
    qc.invalidateQueries({ queryKey: ["issues"] });
    qc.invalidateQueries({ queryKey: ["me"] });
    qc.invalidateQueries({ queryKey: ["leaderboard"] });
  };
  return (
    <div className="rounded-3xl bg-card p-4 shadow-soft">
      <div className="flex gap-3">
        {photo ? <img src={photo} alt="" className="size-14 rounded-full object-cover" /> : <IconPill><MapPin className="size-5" /></IconPill>}
        <div className="min-w-0 flex-1">
          <div className="font-semibold">{i.title}</div>
          <div className="text-sm text-muted-foreground">{i.category} · {ago(i.created_at)}</div>
          <div className="mt-2 flex flex-wrap gap-2">
            <StatusBadge s={i.status} />
            <span className="rounded-full bg-muted px-3 py-1 text-xs font-semibold text-muted-foreground">{i.department}</span>
            <Severity n={i.severity} />
            {i.merged_count > 1 && <span className="rounded-full bg-accent px-3 py-1 text-xs font-bold text-accent-foreground">{i.merged_count} reports</span>}
          </div>
          {i.ai_verdict && <p className="mt-2 text-xs text-muted-foreground"><Sparkles className="mr-1 inline size-3" />{i.ai_verdict}</p>}
        </div>
      </div>
      {canDelete && (
        <button onClick={remove} className="mt-3 flex w-full items-center justify-center gap-2 rounded-full bg-muted py-2.5 text-sm font-semibold text-destructive transition active:scale-95">
          <Trash2 className="size-4" />Delete my report
        </button>
      )}
      {i.status === "Resolved" && (
        <button disabled={i.citizen_confirmed} onClick={confirm}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-full bg-resolved-soft py-3 font-semibold text-resolved transition active:scale-95 disabled:opacity-70">
          {i.citizen_confirmed ? <><CheckCircle2 className="size-4" />Thanks for confirming!</> : <><ThumbsUp className="size-4" />Confirm Fixed</>}
        </button>
      )}
    </div>
  );
}

const DEPTS = ["Roads", "Sanitation", "Water", "Electrical"] as const;
const SUGGESTIONS: { t: string; d: string }[] = [
  { t: "Large pothole on the main road", d: "Roads" },
  { t: "Broken footpath / damaged pavement", d: "Roads" },
  { t: "Road cave-in or crack", d: "Roads" },
  { t: "Missing or broken speed breaker", d: "Roads" },
  { t: "Garbage pile not collected for days", d: "Sanitation" },
  { t: "Overflowing dustbin", d: "Sanitation" },
  { t: "Dead animal on the road", d: "Sanitation" },
  { t: "Open sewage / blocked drain", d: "Sanitation" },
  { t: "Waterlogging after rain", d: "Water" },
  { t: "Leaking water pipeline", d: "Water" },
  { t: "No water supply in the area", d: "Water" },
  { t: "Dirty / contaminated tap water", d: "Water" },
  { t: "Streetlight not working", d: "Electrical" },
  { t: "Hanging or exposed electric wires", d: "Electrical" },
  { t: "Damaged electric pole", d: "Electrical" },
  { t: "Traffic signal not working", d: "Electrical" },
];

function ReportFlow({ me, onDone, onBack }: { me: Me; onDone: () => void; onBack: () => void }) {
  const qc = useQueryClient();
  const [shot, setShot] = useState<{ blob: Blob; preview: string; pos: { lat: number; lng: number } }>();
  const [note, setNote] = useState("");
  const [dept, setDept] = useState<string>();
  const [focus, setFocus] = useState(false);
  const [phase, setPhase] = useState<"camera" | "review" | "analyzing" | "done">("camera");
  const [err, setErr] = useState<string>();
  const [result, setResult] = useState<Awaited<ReturnType<typeof reportIssue>>>();

  const onCapture = async (blob: Blob, preview: string) => {
    setErr(undefined);
    try {
      const pos = await getPosition();
      setShot({ blob, preview, pos }); setPhase("review");
    } catch (e) { setErr((e as Error).message); }
  };

  const submit = async () => {
    if (!shot) return;
    setPhase("analyzing"); setErr(undefined);
    try {
      const photoPath = await uploadPhoto(me.id, shot.blob);
      const r = await reportIssue({ data: { photoPath, lat: shot.pos.lat, lng: shot.pos.lng, description: note || undefined, department: dept, country: me.profile?.country ?? undefined, state: me.profile?.state ?? undefined, district: me.profile?.district ?? undefined } });
      setResult(r); setPhase("done");
      qc.invalidateQueries({ queryKey: ["issues"] }); qc.invalidateQueries({ queryKey: ["me"] });
    } catch (e) { setErr((e as Error).message); setPhase("review"); }
  };

  return (
    <div className="space-y-5 animate-in fade-in">
      <div className="flex items-center gap-3">
        <button onClick={onBack} aria-label="Back" className="grid size-11 place-items-center rounded-full bg-secondary"><ArrowLeft className="size-5" /></button>
        <h1 className="text-2xl font-bold">Report an issue</h1>
      </div>
      {phase === "camera" && <><p className="text-sm text-muted-foreground">Take a live photo at the spot. Your location is attached automatically.</p><LiveCamera onCapture={onCapture} /></>}
      {shot && phase !== "camera" && (
        <div className="relative overflow-hidden rounded-[2rem]">
          <img src={shot.preview} alt="Captured issue" className="aspect-[3/4] w-full object-cover" />
          <span className="absolute left-4 top-4 flex items-center gap-1 rounded-full bg-card/90 px-3 py-1 text-xs font-semibold"><MapPin className="size-3.5" />{shot.pos.lat.toFixed(4)}, {shot.pos.lng.toFixed(4)}</span>
          {phase === "analyzing" && (
            <div className="absolute inset-x-4 bottom-4 flex items-center gap-2 rounded-full bg-card/95 px-4 py-3 text-sm font-semibold text-primary shadow-soft">
              <Sparkles className="size-4 animate-pulse" /> AI analyzing image…<Loader2 className="ml-auto size-4 animate-spin" />
            </div>
          )}
        </div>
      )}
      {err && <p className="rounded-full bg-pending-soft px-4 py-2 text-center text-sm font-medium text-pending">{err}</p>}
      {phase === "review" && (
        <>
          <div className="space-y-2">
            <span className="text-sm font-semibold">Which department? <span className="font-normal text-muted-foreground">(optional — AI decides if left empty)</span></span>
            <div className="flex flex-wrap gap-2">
              {DEPTS.map((d) => (
                <button key={d} type="button" onClick={() => setDept(dept === d ? undefined : d)}
                  className={`rounded-full px-4 py-2 text-sm font-semibold ${dept === d ? "bg-warm text-primary-foreground" : "bg-secondary text-secondary-foreground"}`}>{d}</button>
              ))}
            </div>
          </div>
          <label className="relative block space-y-2">
            <span className="text-sm font-semibold">Describe the issue <span className="font-normal text-muted-foreground">(optional — AI detects the problem from the photo)</span></span>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} onFocus={() => setFocus(true)} onBlur={() => setTimeout(() => setFocus(false), 150)} maxLength={500} rows={3} placeholder="Start typing, e.g. pothole, garbage, streetlight…" aria-label="Description"
              className="w-full resize-none rounded-3xl border bg-card px-5 py-4 outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring" />
            {focus && (() => {
              const q = note.toLowerCase().trim();
              const sug = SUGGESTIONS.filter((x) => (!dept || x.d === dept) && (!q || x.t.toLowerCase().includes(q) || q.split(/\s+/).some((w) => w.length > 2 && x.t.toLowerCase().includes(w)))).slice(0, 6);
              return sug.length > 0 && (
                <div className="absolute inset-x-0 top-full z-20 mt-1 overflow-hidden rounded-3xl border bg-card p-1 shadow-soft">
                  {sug.map((x) => (
                    <button key={x.t} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => { setNote(x.t); setDept(x.d); setFocus(false); }}
                      className="flex w-full items-center justify-between gap-2 rounded-full px-4 py-2 text-left text-sm hover:bg-secondary">
                      <span>{x.t}</span><span className="shrink-0 rounded-full bg-accent px-2 py-0.5 text-xs font-semibold text-accent-foreground">{x.d}</span>
                    </button>
                  ))}
                </div>
              );
            })()}
            <span className="block text-right text-xs text-muted-foreground">{note.length}/500</span>
          </label>
          <div className="flex gap-3">
            <button onClick={() => { setShot(undefined); setPhase("camera"); }} className="flex-1 rounded-full bg-secondary py-4 font-bold text-secondary-foreground">Retake</button>
            <button onClick={submit} className="flex-[2] rounded-full bg-warm py-4 font-bold text-primary-foreground shadow-soft active:scale-95">Submit Report</button>
          </div>
        </>
      )}
      {phase === "done" && result && (
        <div className="space-y-3 rounded-3xl bg-secondary p-5 animate-in fade-in slide-in-from-bottom-2">
          <div className="flex items-center gap-2 font-semibold text-secondary-foreground"><Sparkles className="size-4" />AI tagged this issue</div>
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full bg-card px-3 py-1.5 text-sm font-semibold">{result.title}</span>
            <span className="rounded-full bg-warm px-3 py-1.5 text-sm font-semibold text-primary-foreground">→ {result.department} Dept.</span>
            <Severity n={result.severity} />
          </div>
          {result.merged && <p className="text-sm">This was already reported nearby — your report was merged to raise its priority.</p>}
          <p className="flex items-center gap-2 font-bold text-primary"><Trophy className="size-4" />+{result.points} points</p>
          <button onClick={onDone} className="w-full rounded-full bg-warm py-3 font-bold text-primary-foreground">View my reports</button>
        </div>
      )}
    </div>
  );
}

/* ---------------- Shared ---------------- */

function SpotRow({ i, photo, onResolve }: { i: IssueRow; photo?: string | undefined; onResolve?: ((i: IssueRow) => void) | undefined }) {
  const n = Math.max(1, i.merged_count);
  return (
    <div className="flex gap-3 rounded-3xl border p-3">
      {photo ? <img src={photo} alt="" className="size-14 shrink-0 rounded-full object-cover" /> : <IconPill><MapPin className="size-5" /></IconPill>}
      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="font-semibold">{i.title}</div>
        <div className="flex flex-wrap items-center gap-1.5">
          <StatusBadge s={i.status} /><Severity n={i.severity} />
          <span className="rounded-full bg-accent px-2.5 py-1 text-xs font-semibold text-accent-foreground">{n} {n === 1 ? "citizen" : "citizens"}</span>
          <span className="rounded-full bg-secondary px-2.5 py-1 text-xs font-semibold text-secondary-foreground">{i.department}</span>
        </div>
        <p className="text-xs text-muted-foreground">Reported {ago(i.created_at)}{i.status === "Resolved" && i.resolved_at ? ` · fixed ${ago(i.resolved_at)}` : ""}</p>
        {onResolve && i.status !== "Resolved" && <button onClick={() => onResolve(i)} className="inline-flex items-center gap-1.5 rounded-full bg-resolved-soft px-3 py-1.5 text-xs font-bold text-resolved"><Camera className="size-3.5" />Verify fix</button>}
      </div>
    </div>
  );
}

function MapView({ issues, center, onResolve }: { issues: IssueRow[]; center: { lat: number; lng: number }; onResolve?: ((i: IssueRow) => void) | undefined }) {
  const [sel, setSel] = useState<IssueRow>();
  const [me, setMe] = useState<{ lat: number; lng: number }>();
  const [filter, setFilter] = useState<"open" | "all">("all");
  useEffect(() => { getPosition().then(setMe).catch(() => {}); }, []);
  const list = issues.filter((i) => filter === "all" || i.status !== "Resolved");
  const urls = usePhotoUrls(sel ? list.filter((i) => distanceKm(i, sel) < 0.05).map((i) => i.photo_url) : []);
  return (
    <div className="space-y-3 animate-in fade-in">
      <div className="flex items-center justify-between gap-2">
        <div><h1 className="text-2xl font-bold">City map</h1><p className="text-xs text-muted-foreground">{list.length} issues · <span className="text-pending">●</span> Pending <span className="text-primary">●</span> In progress <span className="text-resolved">●</span> Resolved · <span style={{ color: "#3b82f6" }}>●</span> You</p></div>
        <div className="flex gap-2">
          <button onClick={() => setFilter(filter === "open" ? "all" : "open")} className="rounded-full bg-secondary px-3 py-2 text-sm font-semibold text-secondary-foreground">{filter === "open" ? "Open only" : "All issues"}</button>
          <button onClick={() => getPosition().then(setMe).catch(() => {})} aria-label="Show my location" className="grid size-10 place-items-center rounded-full bg-warm text-primary-foreground"><Navigation className="size-4" /></button>
        </div>
      </div>
      <IssueMap issues={list} center={me ?? center} me={me} onSelect={setSel} />
      {sel && (() => {
        const spot = list
          .filter((i) => distanceKm(i, sel) < 0.05)
          .sort((a, b) => (a.status === "Resolved" ? 1 : 0) - (b.status === "Resolved" ? 1 : 0) || b.severity - a.severity);
        const reporters = spot.reduce((n, i) => n + Math.max(1, i.merged_count), 0);
        const open = spot.filter((i) => i.status !== "Resolved");
        const maxSev = Math.max(...spot.map((i) => i.severity));
        return (
          <div className="space-y-3 rounded-3xl bg-card p-4 shadow-soft animate-in fade-in">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h2 className="text-lg font-bold">Issues at this spot</h2>
                <p className="text-xs text-muted-foreground">{sel.lat.toFixed(4)}, {sel.lng.toFixed(4)}</p>
              </div>
              <button onClick={() => setSel(undefined)} aria-label="Close" className="grid size-9 place-items-center rounded-full bg-secondary"><X className="size-4" /></button>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-full bg-secondary px-2 py-2"><div className="font-display text-lg font-bold">{spot.length}</div><div className="text-[11px] text-muted-foreground">Problems</div></div>
              <div className="rounded-full bg-secondary px-2 py-2"><div className="font-display text-lg font-bold">{reporters}</div><div className="text-[11px] text-muted-foreground">Citizens reported</div></div>
              <div className="rounded-full bg-secondary px-2 py-2"><div className="font-display text-lg font-bold">{open.length}</div><div className="text-[11px] text-muted-foreground">Still open</div></div>
            </div>
            <p className="text-sm"><span className="font-semibold">Highest severity here:</span> {maxSev}/5 — {maxSev >= 4 ? "urgent, fix first" : maxSev >= 3 ? "moderate priority" : "low priority"}</p>
            <div className="max-h-80 space-y-2 overflow-y-auto">
              {spot.map((i) => (
                <SpotRow key={i.id} i={i} photo={urls[i.photo_url]} onResolve={onResolve} />
              ))}
            </div>
            <a href={directionsUrl(sel)} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-1.5 rounded-full bg-warm py-3 text-sm font-bold text-primary-foreground"><Navigation className="size-4" />Directions to this spot</a>
          </div>
        );
      })()}
    </div>
  );
}

function Leaderboard({ role, meId }: { role: "citizen" | "authority"; meId: string }) {
  const [r, setR] = useState(role);
  const { data: raw = [], isLoading } = useQuery(leaderboardQuery(r));
  // One row per person: accounts sharing the same name are combined and their points added together.
  const data = Object.values(raw.reduce<Record<string, (typeof raw)[number] & { ids: string[] }>>((acc, p) => {
    const key = p.display_name.trim().toLowerCase();
    const cur = acc[key];
    if (cur) { cur.points += p.points; cur.ids.push(p.id); }
    else acc[key] = { ...p, display_name: p.display_name.trim(), ids: [p.id] };
    return acc;
  }, {})).sort((a, b) => b.points - a.points).map((p) => ({ ...p, isMe: p.ids.includes(meId) }));
  return (
    <div className="space-y-4 animate-in fade-in">
      <h1 className="text-2xl font-bold">Leaderboard</h1>
      <div className="flex rounded-full bg-secondary p-1 text-sm font-semibold">
        {(["citizen", "authority"] as const).map((x) => (
          <button key={x} onClick={() => setR(x)} className={`flex-1 rounded-full py-2 capitalize ${r === x ? "bg-card text-primary shadow-soft" : "text-secondary-foreground"}`}>{x === "citizen" ? "Citizens" : "Authorities"}</button>
        ))}
      </div>
      {isLoading ? <Loader2 className="mx-auto size-6 animate-spin text-primary" /> : (
        <ol className="space-y-2">
          {data.map((p, k) => (
            <li key={p.id} className={`flex items-center gap-3 rounded-full bg-card p-2 pr-5 shadow-soft ${p.isMe ? "ring-2 ring-ring" : ""}`}>
              <span className={`grid size-10 place-items-center rounded-full font-bold ${k < 3 ? "bg-warm text-primary-foreground" : "bg-secondary text-secondary-foreground"}`}>{k + 1}</span>
              <span className="flex-1 truncate font-semibold">{p.display_name}<span className="ml-2 text-xs font-normal text-muted-foreground">{p.district}</span></span>
              <span className="flex items-center gap-1 font-bold text-primary"><Trophy className="size-4" />{p.points}</span>
            </li>
          ))}
          {!data.length && <p className="py-6 text-center text-muted-foreground">No one here yet.</p>}
        </ol>
      )}
    </div>
  );
}

/* ---------------- Authority ---------------- */

function Authority({ me, issues }: { me: Me; issues: IssueRow[] }) {
  const [tab, setTab] = useState<"board" | "map" | "ranks">("board");
  const [dept, setDept] = useState("All");
  const [verifying, setVerifying] = useState<IssueRow>();
  const center = useCenter(me);
  const list = issues.filter((i) => dept === "All" || i.department === dept);
  const urls = usePhotoUrls(list.map((i) => i.photo_url));
  const totalReports = issues.reduce((a, i) => a + i.merged_count, 0);

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-6 animate-in fade-in">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Authority Dashboard</h1>
          <p className="text-muted-foreground">{me.profile?.display_name} · {me.profile?.district}</p>
        </div>
        <div className="flex rounded-full bg-secondary p-1 text-sm font-semibold">
          {([["board", ListChecks, "Pipeline"], ["map", MapIcon, "Map"], ["ranks", Trophy, "Ranks"]] as const).map(([k, Icon, l]) => (
            <button key={k} onClick={() => setTab(k)} className={`flex items-center gap-1.5 rounded-full px-4 py-2 ${tab === k ? "bg-card text-primary shadow-soft" : "text-secondary-foreground"}`}><Icon className="size-4" />{l}</button>
          ))}
        </div>
      </div>

      {tab === "board" && (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {([["Open tickets", issues.filter((i) => i.status !== "Resolved").length, Clock], ["Citizen reports", totalReports, Building2], ["AI merged", totalReports - issues.length, Layers], ["Resolved", issues.filter((i) => i.status === "Resolved").length, CheckCircle2]] as const).map(([l, v, Icon]) => (
              <div key={l} className="flex items-center gap-3 rounded-3xl bg-card p-4 shadow-soft">
                <IconPill><Icon className="size-5" /></IconPill>
                <div><div className="font-display text-2xl font-bold">{v}</div><div className="text-xs text-muted-foreground">{l}</div></div>
              </div>
            ))}
          </div>
          <div className="rounded-3xl bg-secondary p-4 text-sm text-secondary-foreground">
            <b>Earn points:</b> 20 × severity per verified fix · ×2 if fixed within 24h, ×1.5 within 3 days · +5 per merged report.
          </div>
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
            {["All", "Roads", "Sanitation", "Water", "Electrical"].map((d) => (
              <button key={d} onClick={() => setDept(d)} className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition ${dept === d ? "bg-warm text-primary-foreground shadow-soft" : "bg-secondary text-secondary-foreground"}`}>{d}</button>
            ))}
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {statuses.map((s) => (
              <section key={s} className="rounded-[2rem] bg-muted p-3">
                <div className="flex items-center justify-between px-2 pb-3 pt-1">
                  <StatusBadge s={s} />
                  <span className="grid size-7 place-items-center rounded-full bg-card text-xs font-bold">{list.filter((i) => i.status === s).length}</span>
                </div>
                <div className="space-y-3">
                  {list.filter((i) => i.status === s).map((i) => <Ticket key={i.id} i={i} photo={urls[i.photo_url]} onVerify={() => setVerifying(i)} />)}
                  {!list.some((i) => i.status === s) && <p className="py-6 text-center text-sm text-muted-foreground">Nothing here 🎉</p>}
                </div>
              </section>
            ))}
          </div>
        </>
      )}
      {tab === "map" && <MapView issues={issues} center={center} onResolve={setVerifying} />}
      {tab === "ranks" && <div className="max-w-md"><Leaderboard role="authority" meId={me.id} /></div>}
      {verifying && <VerifyDialog me={me} issue={verifying} onClose={() => setVerifying(undefined)} />}
    </div>
  );
}

function Ticket({ i, photo, onVerify }: { i: IssueRow; photo?: string | undefined; onVerify: () => void }) {
  const qc = useQueryClient();
  const Icon = deptIcon[i.department] ?? MapPin;
  const setStatus = async (s: Status) => {
    await supabase.from("issues").update({ status: s }).eq("id", i.id);
    qc.invalidateQueries({ queryKey: ["issues"] });
  };
  return (
    <div className="rounded-3xl bg-card p-4 shadow-soft animate-in fade-in zoom-in-95">
      <div className="flex gap-3">
        {photo ? <img src={photo} alt="" className="size-11 rounded-full object-cover" /> : <IconPill><Icon className="size-5" /></IconPill>}
        <div className="min-w-0">
          <div className="font-semibold">{i.title}</div>
          <div className="text-sm text-muted-foreground">{i.department} · {ago(i.created_at)}</div>
        </div>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Severity n={i.severity} />
        {i.merged_count > 1 && <span className="inline-flex items-center gap-1 rounded-full bg-accent px-3 py-1 text-xs font-bold text-accent-foreground"><Layers className="size-3.5" />{i.merged_count} Similar Reports Merged</span>}
      </div>
      {i.ai_verdict && i.status !== "Resolved" && <p className="mt-2 rounded-2xl bg-pending-soft px-3 py-2 text-xs text-pending"><XCircle className="mr-1 inline size-3" />AI: {i.ai_verdict}</p>}
      {i.status !== "Resolved" ? (
        <div className="mt-3 flex gap-2">
          <div className="flex flex-1 rounded-full bg-muted p-1">
            {(["Pending", "In Progress"] as const).map((s) => (
              <button key={s} onClick={() => setStatus(s)} className={`flex-1 rounded-full py-1.5 text-xs font-semibold transition ${i.status === s ? "bg-warm text-primary-foreground" : "text-muted-foreground"}`}>{s}</button>
            ))}
          </div>
          <a href={directionsUrl(i)} target="_blank" rel="noreferrer" aria-label="Directions" className="grid size-9 place-items-center rounded-full bg-secondary"><Navigation className="size-4" /></a>
          <button onClick={onVerify} className="flex items-center gap-1 rounded-full bg-resolved-soft px-3 text-xs font-bold text-resolved"><Camera className="size-3.5" />Resolve</button>
        </div>
      ) : (
        <p className="mt-2 text-xs text-resolved"><CheckCircle2 className="mr-1 inline size-3" />{i.ai_verdict ?? "Verified by AI"}{i.citizen_confirmed && " · Citizen confirmed"}</p>
      )}
    </div>
  );
}

function VerifyDialog({ me, issue, onClose }: { me: Me; issue: IssueRow; onClose: () => void }) {
  const qc = useQueryClient();
  const [phase, setPhase] = useState<"camera" | "checking" | "done">("camera");
  const [preview, setPreview] = useState<string>();
  const [err, setErr] = useState<string>();
  const [res, setRes] = useState<Awaited<ReturnType<typeof resolveIssue>>>();
  const urls = usePhotoUrls([issue.photo_url]);

  const onCapture = async (blob: Blob, p: string) => {
    setPreview(p); setPhase("checking"); setErr(undefined);
    try {
      const pos = await getPosition();
      const photoPath = await uploadPhoto(me.id, blob);
      const r = await resolveIssue({ data: { issueId: issue.id, photoPath, lat: pos.lat, lng: pos.lng } });
      setRes(r); setPhase("done");
      qc.invalidateQueries({ queryKey: ["issues"] }); qc.invalidateQueries({ queryKey: ["me"] });
    } catch (e) { setErr((e as Error).message); setPhase("camera"); }
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-foreground/30 p-4 backdrop-blur-sm" role="dialog" aria-modal="true">
      <div className="max-h-[95vh] w-full max-w-md space-y-4 overflow-y-auto rounded-[2rem] bg-background p-5 shadow-soft">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold">Verify fix</h2>
          <button onClick={onClose} className="rounded-full bg-secondary px-4 py-2 text-sm font-semibold">Close</button>
        </div>
        <div className="flex items-center gap-3 rounded-3xl bg-card p-3">
          {urls[issue.photo_url] && <img src={urls[issue.photo_url]} alt="Original report" className="size-16 rounded-full object-cover" />}
          <div className="text-sm"><b>{issue.title}</b><br /><span className="text-muted-foreground">Take a live photo of the same spot. You must be within 300 m.</span></div>
        </div>
        {err && <p className="rounded-full bg-pending-soft px-4 py-2 text-center text-sm font-medium text-pending">{err}</p>}
        {phase === "camera" && <LiveCamera onCapture={onCapture} label="Capture fix" />}
        {phase !== "camera" && preview && (
          <div className="relative overflow-hidden rounded-[2rem]">
            <img src={preview} alt="Resolution" className="aspect-[3/4] w-full object-cover" />
            {phase === "checking" && <div className="absolute inset-x-4 bottom-4 flex items-center gap-2 rounded-full bg-card/95 px-4 py-3 text-sm font-semibold text-primary"><Sparkles className="size-4 animate-pulse" />AI comparing before & after…<Loader2 className="ml-auto size-4 animate-spin" /></div>}
          </div>
        )}
        {phase === "done" && res && (
          <div className={`space-y-2 rounded-3xl p-4 ${res.resolved ? "bg-resolved-soft text-resolved" : "bg-pending-soft text-pending"}`}>
            <p className="flex items-center gap-2 font-bold">{res.resolved ? <CheckCircle2 className="size-5" /> : <XCircle className="size-5" />}{res.resolved ? "Verified as resolved!" : "Not resolved yet"}</p>
            <p className="text-sm">{res.reason}</p>
            {res.resolved && <p className="flex items-center gap-1 font-bold"><Trophy className="size-4" />+{res.points} points</p>}
            <button onClick={onClose} className="w-full rounded-full bg-card py-3 font-bold text-foreground">Done</button>
          </div>
        )}
      </div>
    </div>
  );
}
