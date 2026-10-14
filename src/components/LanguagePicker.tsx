import { useEffect, useState } from "react";
import { Languages } from "lucide-react";

/** Whole-app translation into Indian languages, powered by Google's free website translator. */
export const LANGS = [
  ["en", "English"], ["hi", "हिन्दी"], ["bn", "বাংলা"], ["te", "తెలుగు"], ["mr", "मराठी"],
  ["ta", "தமிழ்"], ["gu", "ગુજરાતી"], ["kn", "ಕನ್ನಡ"], ["ml", "മലയാളം"], ["pa", "ਪੰਜਾਬੀ"],
  ["or", "ଓଡ଼ିଆ"], ["as", "অসমীয়া"], ["ur", "اردو"],
] as const;

declare global {
  interface Window { googleTranslateElementInit?: () => void }
}

function currentLang() {
  const m = document.cookie.match(/(?:^|;\s*)googtrans=\/[^/]+\/([^;]+)/);
  return m?.[1] ?? "en";
}

function setLang(code: string) {
  const host = window.location.hostname;
  const exp = code === "en" ? "expires=Thu, 01 Jan 1970 00:00:00 GMT" : "max-age=31536000";
  const val = code === "en" ? "" : `/en/${code}`;
  document.cookie = `googtrans=${val};path=/;${exp}`;
  document.cookie = `googtrans=${val};path=/;domain=${host};${exp}`;
  document.cookie = `googtrans=${val};path=/;domain=.${host.split(".").slice(-2).join(".")};${exp}`;
  // Switch instantly without reloading: drive Google's hidden language selector.
  const combo = document.querySelector<HTMLSelectElement>("select.goog-te-combo");
  if (combo) {
    combo.value = code;
    combo.dispatchEvent(new Event("change"));
    if (code === "en") window.location.reload();
    return;
  }
  window.location.reload();
}

let loaded = false;
function loadTranslator() {
  if (loaded) return;
  loaded = true;
  window.googleTranslateElementInit = () => {
    const g = (window as any).google;
    new g.translate.TranslateElement({ pageLanguage: "en", autoDisplay: false }, "google_translate_element");
  };
  const s = document.createElement("script");
  s.src = "https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit";
  s.async = true;
  document.body.appendChild(s);
}

export function LanguagePicker() {
  const [lang, setL] = useState("en");
  const [open, setOpen] = useState(false);
  useEffect(() => { setL(currentLang()); loadTranslator(); }, []);
  const label = LANGS.find(([c]) => c === lang)?.[1] ?? "English";

  return (
    <div className="relative notranslate" translate="no">
      <div id="google_translate_element" className="hidden" />
      <button onClick={() => setOpen((o) => !o)} aria-label="Choose language"
        className="flex h-10 items-center gap-1.5 rounded-full bg-secondary px-3 text-sm font-semibold text-secondary-foreground">
        <Languages className="size-4" /><span className="hidden sm:inline">{label}</span>
      </button>
      {open && (
        <div className="absolute right-0 top-12 z-40 grid w-56 grid-cols-2 gap-1 rounded-3xl border bg-card p-2 shadow-soft">
          {LANGS.map(([c, n]) => (
            <button key={c} onClick={() => { setOpen(false); if (c !== lang) { setL(c); setLang(c); } }}
              className={`rounded-full px-3 py-2 text-sm font-semibold ${c === lang ? "bg-warm text-primary-foreground" : "hover:bg-secondary"}`}>{n}</button>
          ))}
        </div>
      )}
    </div>
  );
}
