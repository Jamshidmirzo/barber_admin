"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { Eye, EyeOff, MessageCircle } from "lucide-react";
import api, { parseApiError } from "@/lib/api";
import type { Profile } from "@/hooks/useProfile";

const KAKAO_YELLOW = "#FEE500";
const KAKAO_INK = "#191919";

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

type View = "login" | "register";

export default function LoginPage() {
  const t = useTranslations("Login");
  const router = useRouter();
  const qc = useQueryClient();
  const [view, setView] = useState<View>("login");
  const [phone, setPhone] = useState("+998");
  const [loginCountry, setLoginCountry] = useState<CountryCode>("998");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [regCountry, setRegCountry] = useState<CountryCode>("998");
  const [regPhone, setRegPhone] = useState("+998");
  const [regName, setRegName] = useState("");
  const [regLastName, setRegLastName] = useState("");
  const [regPass, setRegPass] = useState("");
  const [regPass2, setRegPass2] = useState("");
  const [showRegPass, setShowRegPass] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function saveTokens(tokens: { access_token: string; refresh_token?: string }, profilePrimer?: Profile) {
    localStorage.setItem("barber_admin_token", tokens.access_token);
    if (tokens.refresh_token) {
      localStorage.setItem("barber_admin_refresh_token", tokens.refresh_token);
    }
    // Every cached query (profile, salon-context, etc.) is scoped to whichever
    // account was logged in when it was fetched, but none of the query keys
    // encode the user — without this, switching accounts client-side (no full
    // reload) can serve a previous account's stale profile/salon/country data.
    qc.clear();
    // Registration already gave us name/last_name/phone/country — seed the
    // profile cache with them so the onboarding screen right after doesn't
    // have to block on a fresh GET /profile for data we already typed in.
    // staleTime on useProfileQuery still lets it reconcile with the backend
    // (real id, bio, photo_url, ...) in the background once it goes stale.
    if (profilePrimer) qc.setQueryData(["profile"], profilePrimer);
    router.push("/appointments");
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

  function handleRegisterFormSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!isValidPhone(regPhone, regCountry)) {
      setError(regCountry === "82" ? t("errors.phoneInvalidKr") : t("errors.phoneInvalidUz"));
      return;
    }
    if (regPass !== regPass2) { setError(t("errors.passwordMismatch")); return; }
    if (regPass.length < 6) { setError(t("errors.passwordTooShort")); return; }
    void submitRegister();
  }

  async function submitRegister() {
    const cleanPhone = regPhone.replace(/\s/g, "");
    setLoading(true);
    try {
      const res = await api.post("/auth/register", {
        phone: cleanPhone, password: regPass,
        name: regName, last_name: regLastName,
      });
      const tokens = res.data?.tokens;
      if (!tokens?.access_token) {
        setError(t("errors.serverResponseInvalid"));
        return;
      }
      saveTokens(tokens, {
        // The register response only carries tokens, no user object — the
        // real id/created_at/etc. get filled in on the first real /profile
        // fetch once this primer goes stale.
        id: "",
        phone: cleanPhone,
        name: regName.trim() || null,
        last_name: regLastName.trim() || null,
        bio: null,
        photo_url: null,
        city: null,
        specializations: [],
        country: regCountry === "82" ? "kr" : "uz",
        is_onboarded: false,
      });
    } catch (err) {
      setError(parseApiError(err, t("errors.registerFailed")));
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
          {view === "login" ? (
            <>
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

                <div style={{ textAlign:"center", marginTop:16, fontSize:12, color:"var(--text3)" }}>
                  {t("login.noAccount")}{" "}
                  <span
                    onClick={() => { setView("register"); setError(""); }}
                    style={{ color:"var(--gold)", cursor:"pointer", fontWeight:600 }}
                  >
                    {t("login.createSalonLink")}
                  </span>
                </div>
              </form>
            </>
          ) : (
            <>
              <div style={{ fontFamily:"'Playfair Display',serif", fontSize:19, fontWeight:600, marginBottom:2 }}>{t("register.title")}</div>
              <div style={{ color:"var(--text2)", fontSize:12.5, marginBottom:22 }}>{t("register.subtitle")}</div>

              <form onSubmit={handleRegisterFormSubmit} style={{ display:"flex", flexDirection:"column", gap:0 }}>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:16 }}>
                  <div>
                    <label style={lbl}>{t("register.firstNameLabel")}</label>
                    <input value={regName} onChange={(e) => setRegName(e.target.value)} placeholder={t("register.firstNamePlaceholder")} required style={inp} />
                  </div>
                  <div>
                    <label style={lbl}>{t("register.lastNameLabel")}</label>
                    <input value={regLastName} onChange={(e) => setRegLastName(e.target.value)} placeholder={t("register.lastNamePlaceholder")} style={inp} />
                  </div>
                </div>

                <label style={lbl}>{t("register.phoneLabel")}</label>
                <div style={{ display:"flex", gap:8, marginBottom:16 }}>
                  {COUNTRIES.map((c) => (
                    <button
                      key={c.code} type="button"
                      onClick={() => { setRegCountry(c.code); setRegPhone("+" + c.code); }}
                      style={{
                        display:"flex", alignItems:"center", gap:6,
                        padding:"10px 12px", borderRadius:11, cursor:"pointer",
                        border: regCountry === c.code ? "1px solid var(--gold)" : "1px solid var(--border)",
                        background: regCountry === c.code ? "var(--gold-dim)" : "var(--surface)",
                        color:"var(--text)", fontSize:13, fontFamily:"inherit",
                      }}
                    >
                      <span>{c.flag}</span>
                      <span>+{c.code}</span>
                    </button>
                  ))}
                </div>
                <input
                  type="tel" value={regPhone} placeholder={COUNTRIES.find((c) => c.code === regCountry)!.placeholder} required
                  onChange={(e) => {
                    const raw = e.target.value;
                    if (!raw.startsWith("+" + regCountry)) { setRegPhone("+" + regCountry); return; }
                    setRegPhone(formatPhone(raw, regCountry));
                  }}
                  style={{ ...inp, marginBottom:16 }}
                />

                <label style={lbl}>{t("register.passwordLabel")}</label>
                <div style={{ position:"relative", marginBottom:16 }}>
                  <input
                    type={showRegPass ? "text" : "password"} value={regPass} placeholder={t("register.passwordPlaceholder")} required
                    onChange={(e) => setRegPass(e.target.value)}
                    style={{ ...inp, paddingRight:42 }}
                  />
                  <button type="button" onClick={() => setShowRegPass((s) => !s)} style={{
                    position:"absolute", right:12, top:"50%", transform:"translateY(-50%)",
                    background:"none", border:"none", cursor:"pointer", color:"var(--text3)", display:"flex", alignItems:"center", padding:0,
                  }}>
                    {showRegPass ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>

                <label style={lbl}>{t("register.confirmPasswordLabel")}</label>
                <input
                  type="password" value={regPass2} placeholder="••••••" required
                  onChange={(e) => setRegPass2(e.target.value)}
                  style={{ ...inp, marginBottom:22 }}
                />

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
                  {loading ? t("register.submitting") : t("register.submit")}
                </button>

                <div style={{ textAlign:"center", marginTop:16, fontSize:12, color:"var(--text3)" }}>
                  {t("register.haveAccount")}{" "}
                  <span
                    onClick={() => { setView("login"); setError(""); }}
                    style={{ color:"var(--gold)", cursor:"pointer", fontWeight:600 }}
                  >
                    {t("register.loginLink")}
                  </span>
                </div>
              </form>
            </>
          )}

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
            }}
          >
            <MessageCircle size={18} />
            {t("continueWithKakao")}
          </button>
        </div>
      </div>
    </div>
  );
}