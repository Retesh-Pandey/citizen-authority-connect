import { createFileRoute, Link } from "@tanstack/react-router";
import hero from "@/assets/hero-civic.jpg";
import { Camera, MapPin, Sparkles, Trophy } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "CivicConnect — Report & resolve local civic issues" },
      { name: "description", content: "Citizens report potholes, garbage and waterlogging with live photos; authorities resolve them with AI verification." },
      { property: "og:title", content: "CivicConnect" },
      { property: "og:description", content: "Report local civic issues and track their resolution." },
    ],
  }),
  component: Landing,
});

function Landing() {
  const features = [
    [Camera, "Live photo reports", "Snap the issue on the spot — location attached."],
    [Sparkles, "AI triage & verification", "Auto-tagged, merged, and fix-checked by AI."],
    [MapPin, "City map", "See every issue and get directions fast."],
    [Trophy, "Points & leaderboard", "Rewards for reporting and fast fixes."],
  ] as const;
  return (
    <div className="relative min-h-screen overflow-hidden">
    <img src={hero} alt="City worker repairing a pothole while a citizen photographs the fix" width={1600} height={1008} className="absolute inset-0 size-full object-cover" />
    <div className="absolute inset-0 bg-gradient-to-b from-background/40 via-background/80 to-background md:bg-gradient-to-r md:from-background md:via-background/85 md:to-background/10" />
    <main className="relative mx-auto flex min-h-screen max-w-md flex-col justify-center gap-8 px-5 py-10 md:ml-[8vw]">
      <div className="flex items-center gap-2">
        <span className="grid size-10 place-items-center rounded-full bg-warm text-primary-foreground"><MapPin className="size-5" /></span>
        <span className="font-display text-xl font-bold">CivicConnect</span>
      </div>
      <div className="space-y-3">
        <h1 className="text-5xl font-bold leading-tight">Fix your city,<br />together.</h1>
        <p className="text-muted-foreground">Snap a live photo, AI sends it to the right department, and authorities verify the fix on the spot.</p>
      </div>
      <div className="space-y-3">
        {features.map(([Icon, t, d]) => (
          <div key={t} className="flex items-center gap-3 rounded-full bg-card p-2 pr-5 shadow-soft">
            <span className="grid size-11 shrink-0 place-items-center rounded-full bg-secondary text-secondary-foreground"><Icon className="size-5" /></span>
            <div><div className="font-semibold">{t}</div><div className="text-sm text-muted-foreground">{d}</div></div>
          </div>
        ))}
      </div>
      <Link to="/app" className="rounded-full bg-warm py-4 text-center text-lg font-bold text-primary-foreground shadow-soft">Get started</Link>
    </main>
    </div>
  );
}
