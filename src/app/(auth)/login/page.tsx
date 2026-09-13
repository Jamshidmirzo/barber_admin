"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { Eye, EyeOff, MessageCircle, Send } from "lucide-react";
import api, { parseApiError } from "@/lib/api";

const KAKAO_YELLOW = "#FEE500";
const KAKAO_INK = "#191919";
const TELEGRAM_BLUE = "#26A5E4";

// /auth/telegram/web-login only accepts these — anything else falls back to
// Russian, same default the backend's widget page uses.
const TELEGRAM_WIDGET_LANGS = new Set(["ru", "uz", "en", "ko"]);

const inp: React.CSSProperties = {
  width:"100%", background:"var(--surface)", color:"var(--text)",
  border:"1px solid var(--border)", borderRadius:11,
  padding:"12px 14px", fontSize:14, fontFamily:"inherit", outline:"none",
};

const lbl: React.CSSProperties = {
  display:"block", fontSize:11.5, color:"var(--text2)", marginBottom:7, letterSpacing:".02em",
};

type CountryCode = "998" | "82";

const COUNTRIES: { code: CountryCode; flag: string; placeholder: string; digitLength: number }[] = [
  { code:"998", flag:"🇺🇿", placeholder:"+998 90 000 00 00", digitLength: 9 },
  { code:"82",  flag:"🇰🇷", placeholder:"+82 10 0000 0000", digitLength: 10 },
];


function formatPhone(raw: string, cc: CountryCode = "998"): string {
  const digits = raw.replace(/\D/g, "");
  const local = digits.startsWith(cc) ? digits.slice(cc.length) : digits;
  let out = "+" + cc;
  if (cc === "998") {
    // XX XXX XX XX (9 digits total)
    if (local.length > 0) out += " " + local.slice(0, 2);
    if (local.length > 2) out += " " + local.slice(2, 5);
    if (local.length > 5) out += " " + local.slice(5, 7);
    if (local.length > 7) out += " " + local.slice(7, 9);
  } else {
    // Korean mobile: always starts with "10", then 8 digits => 10 XXXX XXXX (10 digits total)
    let normalized = local;
    // if user starts typing without the leading "10", force it
    if (normalized.length > 0 && !normalized.startsWith("1")) {
      normalized = "1" + normalized;
    }
    if (normalized.length > 1 && normalized[1] !== "0") {
      normalized = normalized[0] + "0" + normalized.slice(1);
    }
    if (normalized.length > 0) out += " " + normalized.slice(0, 2);
    if (normalized.length > 2) out += " " + normalized.slice(2, 6);
    if (normalized.length > 6) out += " " + normalized.slice(6, 10);
  }
  return out;
}
function isValidPhone(phone: string, cc: CountryCode): boolean {
  const digits = phone.replace(/\D/g, "");
  const local = digits.startsWith(cc) ? digits.slice(cc.length) : digits;
  const expected = COUNTRIES.find((c) => c.code === cc)!.digitLength;
  if (local.length !== expected) return false;
  if (cc === "82" && !local.startsWith("10")) return false;
  return true;
}

export default function LoginPage() {
  const t = useTranslations("Login");
  const locale = useLocale();
  const router = useRouter();
  const qc = useQueryClient();
  const [phone, setPhone] = useState("+998");
  const [loginCountry, setLoginCountry] = useState<CountryCode>("998");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Phone+password signup is retired — Kakao is the only way to create a
  // new salon-owner account now (see the backend commit that added the
  // Kakao button). This screen only serves accounts that already exist from
  // before that change; /auth/register still exists server-side for them,
  // but nothing here calls it anymore.
  function saveTokens(tokens: { access_token: string; refresh_token?: string }) {
    localStorage.setItem("barber_admin_token", tokens.access_token);
    if (tokens.refresh_token) {
      localStorage.setItem("barber_admin_refresh_token", tokens.refresh_token);
    }
    // Every cached query (profile, salon-context, etc.) is scoped to whichever
    // account was logged in when it was fetched, but none of the query keys
    // encode the user — without this, switching accounts client-side (no full
    // reload) can serve a previous account's stale profile/salon/country data.
    qc.clear();
    router.push("/schedule");
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!isValidPhone(phone, loginCountry)) {
      setError(loginCountry === "82" ? t("errors.phoneInvalidKr") : t("errors.phoneInvalidUz"));
      return;
    }
    setLoading(true);
    try {
      const res = await api.post("/auth/login", { phone: phone.replace(/\s/g, ""), password });
      const tokens = res.data?.tokens;
      if (tokens?.access_token) saveTokens(tokens);
      else setError(t("errors.serverResponseInvalid"));
    } catch (err) {
      setError(parseApiError(err, t("errors.loginFailed")));
    } finally {
      setLoading(false);
    }
  }

  function handleKakaoLogin() {
    setError("");
    const baseUrl = api.defaults.baseURL || "";
    const absoluteBase = baseUrl.startsWith("http") ? baseUrl : `${window.location.origin}${baseUrl}`;
    const url = `${absoluteBase}/auth/kakao/authorize?role=master&origin=${encodeURIComponent(window.location.origin)}`;

    const popup = window.open(url, "kakao-login", "width=480,height=640");
    if (!popup) {
      setError(t("errors.kakaoPopupBlocked"));
      return;
    }
    setLoading(true);

    function cleanup() {
      window.removeEventListener("message", onMessage);
      clearInterval(closedPoll);
      setLoading(false);
    }

    function onMessage(event: MessageEvent) {
      // Comparing by window reference (not event.origin) is what actually
      // ties this message to the popup we opened — the callback runs on
      // the backend's own origin, which varies by env (proxied same-origin
      // in prod, a different port in dev).
      if (event.source !== popup) return;
      const data = event.data as
        | { type: "kakao-login"; tokens?: { access_token?: string; refresh_token?: string }; is_new_user?: boolean }
        | { type: "kakao-login-error"; message?: string }
        | undefined;
      if (!data || (data.type !== "kakao-login" && data.type !== "kakao-login-error")) return;

      cleanup();
      if (data.type === "kakao-login-error") {
        setError(data.message || t("errors.kakaoFailed"));
        return;
      }
      if (!data.tokens?.access_token) {
        setError(t("errors.serverResponseInvalid"));
        return;
      }
      saveTokens({ access_token: data.tokens.access_token, refresh_token: data.tokens.refresh_token });
    }

    const closedPoll = setInterval(() => {
      if (popup.closed) cleanup();
    }, 500);

    window.addEventListener("message", onMessage);
  }

  function handleTelegramLogin() {
    setError("");
    const baseUrl = api.defaults.baseURL || "";
    const absoluteBase = baseUrl.startsWith("http") ? baseUrl : `${window.location.origin}${baseUrl}`;
    const widgetLang = TELEGRAM_WIDGET_LANGS.has(locale) ? locale : "ru";
    // role=master + country=UZ are fixed, not user-editable: Telegram is how
    // the Uzbek market reaches us (mirrors the backend's own
    // PROVIDER_DEFAULT_COUNTRY mapping) — a salon owner signing up here must
    // always land as an Uzbek master (Yandex map, no business-registration
    // number, UZS currency), the same way the Kakao button above always
    // implies Korea. This is forced explicitly rather than left to the
    // backend's IP/locale fallback so it can never drift with a VPN or a
    // browser set to a Korean locale.
    const url = `${absoluteBase}/auth/telegram/web-login?role=master&country=UZ&lang=${widgetLang}&origin=${encodeURIComponent(window.location.origin)}`;

    const popup = window.open(url, "telegram-login", "width=480,height=640");
    if (!popup) {
      setError(t("errors.telegramPopupBlocked"));
      return;
    }
    setLoading(true);

    function cleanup() {
      window.removeEventListener("message", onMessage);
      clearInterval(closedPoll);
      setLoading(false);
    }

    function onMessage(event: MessageEvent) {
      // Same window-reference check as the Kakao handler above, for the
      // same reason: the popup's origin varies by env, but its window
      // reference doesn't.
      if (event.source !== popup) return;
      const data = event.data as
        | { type: "telegram-login"; tokens?: { access_token?: string; refresh_token?: string }; is_new_user?: boolean }
        | { type: "telegram-login-error"; message?: string }
        | undefined;
      if (!data || (data.type !== "telegram-login" && data.type !== "telegram-login-error")) return;

      cleanup();
      if (data.type === "telegram-login-error") {
        setError(data.message || t("errors.telegramFailed"));
        return;
      }
      if (!data.tokens?.access_token) {
        setError(t("errors.serverResponseInvalid"));
        return;
      }
      saveTokens({ access_token: data.tokens.access_token, refresh_token: data.tokens.refresh_token });
    }

    const closedPoll = setInterval(() => {
      if (popup.closed) cleanup();
    }, 500);

    window.addEventListener("message", onMessage);
  }

  return (
    <div style={{
      minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center",
      background:"var(--bg)",
      backgroundImage:"radial-gradient(ellipse 80% 50% at 50% -10%, rgba(201,164,92,0.08) 0%, transparent 70%)",
    }}>
      <div style={{ width:"100%", maxWidth:400, padding:"0 20px" }}>

        {/* Logo */}
        <div style={{ textAlign:"center", marginBottom:36 }}>
          <div style={{
            display:"inline-flex", alignItems:"center", justifyContent:"center",
            width:60, height:60, borderRadius:16,
            border:"1px solid rgba(201,164,92,0.20)", background:"rgba(201,164,92,0.12)",
            marginBottom:20,
          }}>
            <span style={{ fontFamily:"'Playfair Display',serif", fontSize:30, fontWeight:700, color:"var(--gold)", lineHeight:1 }}>H</span>
          </div>
          <div style={{ fontFamily:"'Playfair Display',serif", fontSize:28, fontWeight:700, letterSpacing:".14em", color:"var(--text)" }}>
            HÁYRLI
          </div>
          <div style={{ color:"var(--text2)", fontSize:13, marginTop:6, letterSpacing:".02em" }}>
            {t("tagline")}
          </div>
        </div>

        {/* Card */}
        <div style={{
          background:"var(--card)", border:"1px solid var(--border)",
          borderRadius:18, padding:28,
          boxShadow:"0 24px 48px rgba(0,0,0,0.18)",
        }}>
          <div style={{ fontFamily:"'Playfair Display',serif", fontSize:19, fontWeight:600, marginBottom:2 }}>{t("login.title")}</div>
          <div style={{ color:"var(--text2)", fontSize:12.5, marginBottom:22 }}>{t("login.subtitle")}</div>

          <form onSubmit={handleLogin} style={{ display:"flex", flexDirection:"column", gap:0 }}>
            <label style={lbl}>{t("login.phoneLabel")}</label>
            <div style={{ display:"flex", gap:8, marginBottom:16 }}>
              {COUNTRIES.map((c) => (
                <button
                  key={c.code} type="button"
                  onClick={() => { setLoginCountry(c.code); setPhone("+" + c.code); }}
                  style={{
                    display:"flex", alignItems:"center", gap:6,
                    padding:"10px 12px", borderRadius:11, cursor:"pointer",
                    border: loginCountry === c.code ? "1px solid var(--gold)" : "1px solid var(--border)",
                    background: loginCountry === c.code ? "var(--gold-dim)" : "var(--surface)",
                    color:"var(--text)", fontSize:13, fontFamily:"inherit",
                  }}
                >
                  <span>{c.flag}</span>
                  <span>+{c.code}</span>
                </button>
              ))}
            </div>
            <input
              type="tel" value={phone} placeholder={COUNTRIES.find((c) => c.code === loginCountry)!.placeholder} required
              onChange={(e) => {
                const raw = e.target.value;
                if (!raw.startsWith("+" + loginCountry)) { setPhone("+" + loginCountry); return; }
                setPhone(formatPhone(raw, loginCountry));
              }}
              style={{ ...inp, marginBottom:16 }}
            />
            <label style={lbl}>{t("login.passwordLabel")}</label>
            <div style={{ position:"relative", marginBottom:22 }}>
              <input
                type={showPass ? "text" : "password"} value={password} placeholder="••••••••" required
                onChange={(e) => setPassword(e.target.value)}
                style={{ ...inp, paddingRight:42 }}
              />
              <button type="button" onClick={() => setShowPass((s) => !s)} style={{
                position:"absolute", right:12, top:"50%", transform:"translateY(-50%)",
                background:"none", border:"none", cursor:"pointer", color:"var(--text3)", display:"flex", alignItems:"center", padding:0,
              }}>
                {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>

            {error && (
              <div style={{ background:"rgba(224,90,90,0.08)", border:"1px solid rgba(224,90,90,0.2)", borderRadius:10, padding:"10px 14px", color:"var(--red)", fontSize:13, marginBottom:16 }}>
                {error}
              </div>
            )}

            <button type="submit" disabled={loading} style={{
              width:"100%", padding:13, background:"var(--gold)", color:"#171205",
              border:"none", borderRadius:11, fontWeight:700, fontSize:14,
              cursor: loading ? "not-allowed" : "pointer", letterSpacing:".01em",
              opacity: loading ? 0.6 : 1, fontFamily:"inherit",
            }}>
              {loading ? t("login.submitting") : t("login.submit")}
            </button>
          </form>

          <div style={{ display:"flex", alignItems:"center", gap:10, margin:"20px 0" }}>
            <div style={{ flex:1, height:1, background:"var(--border)" }} />
            <span style={{ fontSize:11.5, color:"var(--text3)" }}>{t("orContinueWith")}</span>
            <div style={{ flex:1, height:1, background:"var(--border)" }} />
          </div>

          <button
            type="button" onClick={handleKakaoLogin} disabled={loading}
            style={{
              width:"100%", height:48, display:"flex", alignItems:"center", justifyContent:"center", gap:8,
              background: KAKAO_YELLOW, color: KAKAO_INK, border:"none", borderRadius:11,
              fontWeight:600, fontSize:14, fontFamily:"inherit",
              cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.6 : 1,
              marginBottom:10,
            }}
          >
            <MessageCircle size={18} />
            {t("continueWithKakao")}
          </button>

          <button
            type="button" onClick={handleTelegramLogin} disabled={loading}
            style={{
              width:"100%", height:48, display:"flex", alignItems:"center", justifyContent:"center", gap:8,
              background: TELEGRAM_BLUE, color: "#fff", border:"none", borderRadius:11,
              fontWeight:600, fontSize:14, fontFamily:"inherit",
              cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.6 : 1,
            }}
          >
            <Send size={18} />
            {t("continueWithTelegram")}
          </button>
        </div>
      </div>
    </div>
  );
}