import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, KeyRound, Loader2, Mail } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { confirmRecoveryCode } from "@/lib/password-reset";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Reset password — CivicConnect" },
      { name: "description", content: "Recover your CivicConnect account with an email code and choose a new password." },
      { property: "og:title", content: "Reset password — CivicConnect" },
      { property: "og:description", content: "Recover your CivicConnect account and choose a new password." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ResetPasswordPage,
});

const field = "w-full rounded-full border bg-card px-5 py-3 outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring";

function ResetPasswordPage() {
  const nav = useNavigate();
  const [stage, setStage] = useState<"email" | "code" | "password">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ ok: boolean; text: string }>();

  useEffect(() => {
    let active = true;
    const hash = new URLSearchParams(window.location.hash.slice(1));
    if (hash.get("type") === "recovery") {
      void supabase.auth.getSession().then(({ data }) => {
        if (active && data.session) setStage("password");
      });
    }
    return () => { active = false; };
  }, []);

  const sendCode = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setNotice(undefined);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setBusy(false);
    if (error) return setNotice({ ok: false, text: error.message });
    setStage("code");
    setNotice({ ok: true, text: "If an account exists for this email, a recovery code has been sent." });
  };

  const updatePassword = async (event: React.FormEvent) => {
    event.preventDefault();
    if (password !== confirmation) return setNotice({ ok: false, text: "The passwords do not match." });
    setBusy(true);
    setNotice(undefined);
    if (stage === "code") {
      try {
        await confirmRecoveryCode(supabase.auth, email, code.trim());
      } catch {
        setBusy(false);
        return setNotice({ ok: false, text: "That code could not be verified. Check it and try again." });
      }
    }
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) return setNotice({ ok: false, text: error.message });
    await supabase.auth.signOut();
    nav({ to: "/auth", replace: true });
  };

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-10">
      <div className="mb-6 flex items-center gap-3">
        <button type="button" onClick={() => nav({ to: "/auth" })} aria-label="Back to sign in" className="grid size-10 place-items-center rounded-full bg-secondary">
          <ArrowLeft className="size-4" />
        </button>
        <span className="grid size-10 place-items-center rounded-full bg-warm text-primary-foreground"><KeyRound className="size-5" /></span>
        <span className="font-display text-xl font-bold">CivicConnect</span>
      </div>
      <h1 className="text-3xl font-bold">{stage === "email" ? "Reset your password" : stage === "code" ? "Enter your recovery code" : "Choose a new password"}</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {stage === "email" ? "We’ll send a recovery code to your email address." : stage === "code" ? `Enter the code sent to ${email}.` : "Set a new password for your account."}
      </p>

      {stage === "email" ? (
        <form onSubmit={sendCode} className="mt-5 space-y-3">
          <input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Email" aria-label="Email" className={field} />
          {notice && <p role="status" className={`rounded-full px-4 py-2 text-center text-sm font-medium ${notice.ok ? "bg-resolved-soft text-resolved" : "bg-pending-soft text-pending"}`}>{notice.text}</p>}
          <button disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-full bg-warm py-4 text-lg font-bold text-primary-foreground shadow-soft disabled:opacity-50">
            {busy ? <Loader2 className="size-5 animate-spin" /> : <Mail className="size-5" />}Send recovery code
          </button>
        </form>
      ) : (
        <form onSubmit={updatePassword} className="mt-5 space-y-3">
          {stage === "code" && (
            <>
              <input required type="email" value={email} readOnly aria-label="Email" className={field} />
              <input required inputMode="numeric" autoComplete="one-time-code" minLength={6} maxLength={8} value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))} placeholder="6–8 digit code" aria-label="Recovery code" className={field} />
            </>
          )}
          <input required type="password" minLength={6} autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="New password" aria-label="New password" className={field} />
          <input required type="password" minLength={6} autoComplete="new-password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} placeholder="Confirm new password" aria-label="Confirm new password" className={field} />
          {notice && <p role="status" className={`rounded-full px-4 py-2 text-center text-sm font-medium ${notice.ok ? "bg-resolved-soft text-resolved" : "bg-pending-soft text-pending"}`}>{notice.text}</p>}
          <button disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-full bg-warm py-4 text-lg font-bold text-primary-foreground shadow-soft disabled:opacity-50">
            {busy && <Loader2 className="size-5 animate-spin" />}Update password
          </button>
          {stage === "code" && <button type="button" onClick={() => { setStage("email"); setCode(""); setNotice(undefined); }} className="w-full py-2 text-sm font-semibold text-primary">Use a different email</button>}
        </form>
      )}
    </main>
  );
}