import { LanguagePicker } from "@/components/LanguagePicker";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Building2, Loader2, MapPin, User, CheckCircle2, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { STATES, getPosition, reverseGeocode, sameState } from "@/lib/locations";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — CivicConnect" },
      { name: "description", content: "Sign in as a citizen or municipal authority on CivicConnect." },
      { property: "og:title", content: "Sign in — CivicConnect" },
      { property: "og:description", content: "Citizens report, authorities resolve." },
    ],
  }),
  component: AuthPage,
});

const field = "w-full rounded-full border bg-card px-5 py-3 outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring";

function AuthPage() {
  const nav = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [role, setRole] = useState<"citizen" | "authority">("citizen");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [country] = useState("India");
  const [state, setState] = useState("");
  const [district, setDistrict] = useState("");
  const [loc, setLoc] = useState<"idle" | "checking" | "match" | "mismatch">("idle");
  const [locMsg, setLocMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string }>();

  const checkLocation = async () => {
    setLoc("checking");
    try {
      const me = await getPosition();
      const g = await reverseGeocode(me);
      if (g && g.state && !sameState(g.state, state)) { setLoc("mismatch"); setLocMsg(`You appear to be in ${g.state}, not ${state}.`); return; }
      const city = g?.city || state;
      setDistrict(city);
      setLoc("match"); setLocMsg(`Location confirmed: ${city}`);
    } catch (e) { setLoc("mismatch"); setLocMsg((e as Error).message); }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setMsg(undefined);
    if (mode === "signin") {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) { setBusy(false); return setMsg({ ok: false, text: error.message }); }
      const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", data.user.id);
      const actual = roles?.some((r) => r.role === "authority") ? "authority" : "citizen";
      if (actual !== role) {
        await supabase.auth.signOut();
        setBusy(false);
        return setMsg({ ok: false, text: `This email is not registered as a ${role}. Please switch to the ${actual} tab.` });
      }
      setBusy(false);
      nav({ to: "/app" });
    } else {
      if (loc !== "match") { setBusy(false); return setMsg({ ok: false, text: "Please confirm your current location matches the selected state." }); }
      const { error } = await supabase.auth.signUp({
        email, password,
        options: { emailRedirectTo: `${window.location.origin}/app`, data: { role, display_name: name, country, state, district } },
      });
      setBusy(false);
      if (error) return setMsg({ ok: false, text: error.message });
      setMsg({ ok: true, text: "Check your email to confirm your account, then sign in." });
      setMode("signin");
    }
  };

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-10">
      <div className="mb-6 flex items-center gap-2">
        <span className="grid size-10 place-items-center rounded-full bg-warm text-primary-foreground"><MapPin className="size-5" /></span>
        <span className="font-display text-xl font-bold">CivicConnect</span>
        <div className="ml-auto"><LanguagePicker /></div>
      </div>
      <h1 className="text-3xl font-bold">{mode === "signin" ? "Welcome back" : "Join your city"}</h1>

      <div className="mt-5 flex rounded-full bg-secondary p-1 text-sm font-semibold">
        {(["citizen", "authority"] as const).map((r) => (
          <button key={r} type="button" onClick={() => setRole(r)}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-full py-2.5 transition ${role === r ? "bg-card text-primary shadow-soft" : "text-secondary-foreground"}`}>
            {r === "citizen" ? <User className="size-4" /> : <Building2 className="size-4" />}
            {r === "citizen" ? "Citizen" : "Authority"}
          </button>
        ))}
      </div>

      <form onSubmit={submit} className="mt-5 space-y-3">
        {mode === "signup" && (
          <>
            <input required value={name} onChange={(e) => setName(e.target.value)} placeholder={role === "authority" ? "Name / Department" : "Your name"} className={field} aria-label="Name" />
            <select required value={state} onChange={(e) => { setState(e.target.value); setDistrict(""); setLoc("idle"); }} className={field} aria-label="State">
              <option value="">Select state</option>
              {STATES.map((s) => <option key={s}>{s}</option>)}
            </select>
            {state && (
              <button type="button" onClick={checkLocation}
                className={`flex w-full items-center justify-center gap-2 rounded-full py-3 font-semibold ${loc === "match" ? "bg-resolved-soft text-resolved" : loc === "mismatch" ? "bg-pending-soft text-pending" : "bg-secondary text-secondary-foreground"}`}>
                {loc === "checking" ? <Loader2 className="size-4 animate-spin" /> : loc === "match" ? <CheckCircle2 className="size-4" /> : loc === "mismatch" ? <AlertCircle className="size-4" /> : <MapPin className="size-4" />}
                {loc === "idle" ? "Verify my current location" : loc === "checking" ? "Checking location…" : locMsg}
              </button>
            )}
          </>
        )}
        <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" className={field} aria-label="Email" />
        <input required type="password" minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" className={field} aria-label="Password" />
        {msg && <p className={`rounded-full px-4 py-2 text-center text-sm font-medium ${msg.ok ? "bg-resolved-soft text-resolved" : "bg-pending-soft text-pending"}`}>{msg.text}</p>}
        <button disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-full bg-warm py-4 text-lg font-bold text-primary-foreground shadow-soft disabled:opacity-50">
          {busy && <Loader2 className="size-5 animate-spin" />}
          {mode === "signin" ? `Sign in as ${role}` : `Create ${role} account`}
        </button>
      </form>
      <button onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setMsg(undefined); }} className="mt-4 text-sm font-semibold text-primary">
        {mode === "signin" ? "New here? Create an account" : "Already have an account? Sign in"}
      </button>
    </main>
  );
}
