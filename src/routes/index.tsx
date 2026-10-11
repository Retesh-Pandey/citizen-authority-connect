import { createFileRoute } from "@tanstack/react-router";
import { useState, useRef, type ReactNode } from "react";
import {
  Plus, Camera, MapPin, Sparkles, CheckCircle2, Clock, Loader2, Home, ListChecks,
  User, Building2, Layers, Trash2, Construction, Droplets, Lightbulb, ArrowLeft, ThumbsUp,
} from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "CivicConnect — Report & resolve local civic issues" },
      { name: "description", content: "Citizens report potholes, garbage and waterlogging; authorities track and resolve them." },
      { property: "og:title", content: "CivicConnect" },
      { property: "og:description", content: "Report local civic issues and track their resolution." },
    ],
  }),
  component: App,
});

type Status = "Pending" | "In Progress" | "Resolved";
type Dept = "Roads" | "Sanitation" | "Water" | "Electrical";
type Issue = {
  id: number; title: string; location: string; dept: Dept; status: Status;
  merged: number; date: string; confirmed?: boolean; mine?: boolean; photo?: string;
};

const deptIcon: Record<Dept, typeof Construction> = {
  Roads: Construction, Sanitation: Trash2, Water: Droplets, Electrical: Lightbulb,
};

const seed: Issue[] = [
  { id: 1, title: "Pothole on Main St", location: "Main St & 4th Ave", dept: "Roads", status: "Pending", merged: 4, date: "2h ago", mine: true },
  { id: 2, title: "Overflowing garbage bin", location: "Park Lane Market", dept: "Sanitation", status: "In Progress", merged: 2, date: "Yesterday", mine: true },
  { id: 3, title: "Waterlogging near school", location: "Elm Road", dept: "Water", status: "Resolved", merged: 6, date: "3 days ago", mine: true },
  { id: 4, title: "Streetlight not working", location: "Oak Avenue", dept: "Electrical", status: "Pending", merged: 1, date: "5h ago" },
  { id: 5, title: "Broken footpath tiles", location: "Station Road", dept: "Roads", status: "In Progress", merged: 3, date: "1 day ago" },
  { id: 6, title: "Illegal dumping", location: "River Bank Rd", dept: "Sanitation", status: "Pending", merged: 5, date: "4h ago" },
];

const statuses: Status[] = ["Pending", "In Progress", "Resolved"];

function StatusBadge({ s }: { s: Status }) {
  const cls = s === "Pending" ? "bg-pending-soft text-pending" : s === "In Progress" ? "bg-progress-soft text-progress" : "bg-resolved-soft text-resolved";
  const Icon = s === "Pending" ? Clock : s === "In Progress" ? Loader2 : CheckCircle2;
  return <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold ${cls}`}><Icon className="size-3.5" />{s}</span>;
}

function IconPill({ children, tone = "soft" }: { children: ReactNode; tone?: "soft" | "warm" }) {
  return <span className={`grid size-11 shrink-0 place-items-center rounded-full ${tone === "warm" ? "bg-warm text-primary-foreground" : "bg-secondary text-secondary-foreground"}`}>{children}</span>;
}

function App() {
  const [view, setView] = useState<"citizen" | "authority">("citizen");
  const [issues, setIssues] = useState<Issue[]>(seed);
  const update = (id: number, patch: Partial<Issue>) => setIssues((l) => l.map((i) => (i.id === id ? { ...i, ...patch } : i)));

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b bg-background/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="grid size-9 place-items-center rounded-full bg-warm text-primary-foreground"><MapPin className="size-5" /></span>
            <span className="font-display text-lg font-bold">CivicConnect</span>
          </div>
          <div className="flex rounded-full bg-secondary p-1 text-sm font-semibold" role="tablist">
            {(["citizen", "authority"] as const).map((v) => (
              <button key={v} role="tab" aria-selected={view === v} onClick={() => setView(v)}
                className={`flex items-center gap-1.5 rounded-full px-4 py-2 transition ${view === v ? "bg-card text-primary shadow-soft" : "text-secondary-foreground"}`}>
                {v === "citizen" ? <User className="size-4" /> : <Building2 className="size-4" />}
                <span className="hidden sm:inline">{v === "citizen" ? "Citizen" : "Authority"}</span>
              </button>
            ))}
          </div>
        </div>
      </header>
      <main>
        {view === "citizen"
          ? <Citizen issues={issues} add={(i) => setIssues((l) => [i, ...l])} update={update} />
          : <Authority issues={issues} update={update} />}
      </main>
    </div>
  );
}

/* ---------------- Citizen ---------------- */

function Citizen({ issues, add, update }: { issues: Issue[]; add: (i: Issue) => void; update: (id: number, p: Partial<Issue>) => void }) {
  const [tab, setTab] = useState<"home" | "report" | "mine">("home");
  const mine = issues.filter((i) => i.mine);

  return (
    <div className="mx-auto max-w-md px-4 pb-28 pt-5">
      {tab === "home" && (
        <div className="space-y-6 animate-in fade-in">
          <div>
            <p className="text-muted-foreground">Good evening 👋</p>
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
          <div>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Recent activity</h2>
              <button onClick={() => setTab("mine")} className="rounded-full bg-secondary px-3 py-1 text-sm font-semibold text-secondary-foreground">See all</button>
            </div>
            <div className="space-y-3">{mine.slice(0, 2).map((i) => <ReportCard key={i.id} i={i} update={update} />)}</div>
          </div>
        </div>
      )}
      {tab === "report" && <ReportFlow onDone={(i) => { add(i); setTab("mine"); }} onBack={() => setTab("home")} />}
      {tab === "mine" && (
        <div className="space-y-3 animate-in fade-in">
          <h1 className="mb-2 text-2xl font-bold">My Reports</h1>
          {mine.map((i) => <ReportCard key={i.id} i={i} update={update} />)}
        </div>
      )}

      <nav className="fixed inset-x-0 bottom-4 z-20 mx-auto flex w-[min(92%,24rem)] justify-around rounded-full border bg-card/95 p-2 shadow-soft backdrop-blur">
        {([["home", Home, "Home"], ["report", Plus, "Report"], ["mine", ListChecks, "My Reports"]] as const).map(([k, Icon, label]) => (
          <button key={k} onClick={() => setTab(k)} aria-label={label}
            className={`flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold transition ${tab === k ? "bg-warm text-primary-foreground" : "text-muted-foreground"}`}>
            <Icon className="size-5" />{tab === k && label}
          </button>
        ))}
      </nav>
    </div>
  );
}

function ReportCard({ i, update }: { i: Issue; update: (id: number, p: Partial<Issue>) => void }) {
  const Icon = deptIcon[i.dept];
  return (
    <div className="rounded-3xl bg-card p-4 shadow-soft">
      <div className="flex gap-3">
        {i.photo ? <img src={i.photo} alt="" className="size-11 rounded-full object-cover" /> : <IconPill><Icon className="size-5" /></IconPill>}
        <div className="min-w-0 flex-1">
          <div className="font-semibold">{i.title}</div>
          <div className="flex items-center gap-1 text-sm text-muted-foreground"><MapPin className="size-3.5" />{i.location} · {i.date}</div>
          <div className="mt-2 flex flex-wrap gap-2">
            <StatusBadge s={i.status} />
            <span className="rounded-full bg-muted px-3 py-1 text-xs font-semibold text-muted-foreground">{i.dept}</span>
          </div>
        </div>
      </div>
      {i.status === "Resolved" && (
        <button disabled={i.confirmed} onClick={() => update(i.id, { confirmed: true })}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-full bg-resolved-soft py-3 font-semibold text-resolved transition active:scale-95 disabled:opacity-70">
          {i.confirmed ? <><CheckCircle2 className="size-4" />Thanks for confirming!</> : <><ThumbsUp className="size-4" />Confirm Fixed</>}
        </button>
      )}
    </div>
  );
}

const tagOptions: { title: string; dept: Dept }[] = [
  { title: "Pothole detected", dept: "Roads" },
  { title: "Garbage accumulation", dept: "Sanitation" },
  { title: "Waterlogging", dept: "Water" },
  { title: "Faulty streetlight", dept: "Electrical" },
];

function ReportFlow({ onDone, onBack }: { onDone: (i: Issue) => void; onBack: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [photo, setPhoto] = useState<string>();
  const [phase, setPhase] = useState<"idle" | "analyzing" | "done">("idle");
  const [tag, setTag] = useState(tagOptions[0]);
  const [location, setLocation] = useState("");
  const [locating, setLocating] = useState(false);
  const [note, setNote] = useState("");

  const onFile = (f?: File) => {
    if (!f) return;
    setPhoto(URL.createObjectURL(f));
    setPhase("analyzing");
    setTimeout(() => { setTag(tagOptions[Math.floor(Math.random() * tagOptions.length)]); setPhase("done"); }, 2200);
  };
  const locate = () => { setLocating(true); setTimeout(() => { setLocation("12 Main St, Ward 7"); setLocating(false); }, 1000); };

  return (
    <div className="space-y-5 animate-in fade-in">
      <div className="flex items-center gap-3">
        <button onClick={onBack} aria-label="Back" className="grid size-11 place-items-center rounded-full bg-secondary"><ArrowLeft className="size-5" /></button>
        <h1 className="text-2xl font-bold">Report an issue</h1>
      </div>

      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
      <button onClick={() => fileRef.current?.click()}
        className="relative flex aspect-[4/3] w-full flex-col items-center justify-center gap-3 overflow-hidden rounded-[2rem] border-2 border-dashed border-accent bg-card">
        {photo ? <img src={photo} alt="Uploaded issue" className="absolute inset-0 size-full object-cover" /> : (
          <>
            <IconPill tone="warm"><Camera className="size-5" /></IconPill>
            <span className="font-semibold">Tap to add a photo</span>
            <span className="text-sm text-muted-foreground">Potholes, garbage, waterlogging…</span>
          </>
        )}
        {phase === "analyzing" && (
          <div className="absolute inset-x-4 bottom-4 flex items-center gap-2 rounded-full bg-card/95 px-4 py-3 text-sm font-semibold text-primary shadow-soft">
            <Sparkles className="size-4 animate-pulse" /> AI analyzing image…<Loader2 className="ml-auto size-4 animate-spin" />
          </div>
        )}
      </button>

      {phase === "done" && (
        <div className="space-y-2 rounded-3xl bg-secondary p-4 animate-in fade-in slide-in-from-bottom-2">
          <div className="flex items-center gap-2 text-sm font-semibold text-secondary-foreground"><Sparkles className="size-4" />AI auto-tagged this issue</div>
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full bg-card px-3 py-1.5 text-sm font-semibold">{tag.title}</span>
            <span className="rounded-full bg-warm px-3 py-1.5 text-sm font-semibold text-primary-foreground">→ {tag.dept} Dept.</span>
          </div>
        </div>
      )}

      <div className="space-y-2">
        <label htmlFor="loc" className="text-sm font-semibold">Location</label>
        <div className="flex gap-2">
          <input id="loc" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Enter address or landmark"
            className="min-w-0 flex-1 rounded-full border bg-card px-5 py-3 outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring" />
          <button onClick={locate} aria-label="Use my location" className="grid size-12 shrink-0 place-items-center rounded-full bg-warm text-primary-foreground">
            {locating ? <Loader2 className="size-5 animate-spin" /> : <MapPin className="size-5" />}
          </button>
        </div>
      </div>
      <div className="space-y-2">
        <label htmlFor="note" className="text-sm font-semibold">Note (optional)</label>
        <input id="note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Anything else we should know?"
          className="w-full rounded-full border bg-card px-5 py-3 outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring" />
      </div>

      <button disabled={phase !== "done" || !location}
        onClick={() => onDone({ id: Date.now(), title: tag.title.replace(" detected", ""), location, dept: tag.dept, status: "Pending", merged: 1, date: "Just now", mine: true, photo })}
        className="w-full rounded-full bg-warm py-4 text-lg font-bold text-primary-foreground shadow-soft transition active:scale-95 disabled:opacity-40">
        Submit Report
      </button>
    </div>
  );
}

/* ---------------- Authority ---------------- */

function Authority({ issues, update }: { issues: Issue[]; update: (id: number, p: Partial<Issue>) => void }) {
  const [dept, setDept] = useState<Dept | "All">("All");
  const list = issues.filter((i) => dept === "All" || i.dept === dept);
  const totalReports = issues.reduce((a, i) => a + i.merged, 0);

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-6 animate-in fade-in">
      <div>
        <h1 className="text-3xl font-bold">Authority Dashboard</h1>
        <p className="text-muted-foreground">Ward 7 Municipal Office</p>
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          ["Open tickets", issues.filter((i) => i.status !== "Resolved").length, Clock],
          ["Citizen reports", totalReports, User],
          ["AI merged", totalReports - issues.length, Layers],
          ["Resolved", issues.filter((i) => i.status === "Resolved").length, CheckCircle2],
        ].map(([l, v, I]) => {
          const Icon = I as typeof Clock;
          return (
            <div key={l as string} className="flex items-center gap-3 rounded-3xl bg-card p-4 shadow-soft">
              <IconPill><Icon className="size-5" /></IconPill>
              <div><div className="font-display text-2xl font-bold">{v as number}</div><div className="text-xs text-muted-foreground">{l as string}</div></div>
            </div>
          );
        })}
      </div>

      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {(["All", "Roads", "Sanitation", "Water", "Electrical"] as const).map((d) => (
          <button key={d} onClick={() => setDept(d)}
            className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition ${dept === d ? "bg-warm text-primary-foreground shadow-soft" : "bg-secondary text-secondary-foreground"}`}>{d}</button>
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
              {list.filter((i) => i.status === s).map((i) => <Ticket key={i.id} i={i} update={update} />)}
              {!list.some((i) => i.status === s) && <p className="py-6 text-center text-sm text-muted-foreground">Nothing here 🎉</p>}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

function Ticket({ i, update }: { i: Issue; update: (id: number, p: Partial<Issue>) => void }) {
  const Icon = deptIcon[i.dept];
  return (
    <div className="rounded-3xl bg-card p-4 shadow-soft animate-in fade-in zoom-in-95">
      <div className="flex gap-3">
        <IconPill><Icon className="size-5" /></IconPill>
        <div className="min-w-0">
          <div className="font-semibold">{i.title}</div>
          <div className="text-sm text-muted-foreground">{i.location} · {i.date}</div>
        </div>
      </div>
      {i.merged > 1 && (
        <div className="mt-3 flex items-center gap-2">
          <div className="flex -space-x-2">
            {Array.from({ length: Math.min(i.merged, 4) }).map((_, k) => (
              <span key={k} className="grid size-6 place-items-center rounded-full border-2 border-card bg-accent text-accent-foreground"><User className="size-3" /></span>
            ))}
          </div>
          <span className="inline-flex items-center gap-1 rounded-full bg-accent px-3 py-1 text-xs font-bold text-accent-foreground">
            <Layers className="size-3.5" />{i.merged} Similar Reports Merged
          </span>
        </div>
      )}
      <div className="mt-3 flex rounded-full bg-muted p-1">
        {statuses.map((s) => (
          <button key={s} onClick={() => update(i.id, { status: s })}
            className={`flex-1 rounded-full py-1.5 text-xs font-semibold transition ${i.status === s ? "bg-warm text-primary-foreground" : "text-muted-foreground"}`}>{s}</button>
        ))}
      </div>
    </div>
  );
}
