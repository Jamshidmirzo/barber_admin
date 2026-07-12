"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Eye, EyeOff } from "lucide-react";
import api, { parseApiError } from "@/lib/api";

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

  function saveToken(token: string) {
    localStorage.setItem("barber_admin_token", token);
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
    const token = res.data?.tokens?.access_token;
    if (token) saveToken(token);
    else setError(t("errors.serverResponseInvalid"));
  } catch (err) {
    setError(parseApiError(err, t("errors.loginFailed")));
  } finally { setLoading(false); }
}

  async function handleRegister(e: React.FormEvent) {
  e.preventDefault();
  setError("");
  if (!isValidPhone(regPhone, regCountry)) {
    setError(regCountry === "82" ? t("errors.phoneInvalidKr") : t("errors.phoneInvalidUz"));
    return;
  }
  if (regPass !== regPass2) { setError(t("errors.passwordMismatch")); return; }
  if (regPass.length < 6) { setError(t("errors.passwordTooShort")); return; }
  setLoading(true);
  try {
    const res = await api.post("/auth/register", {
      phone: regPhone.replace(/\s/g, ""), password: regPass,
      name: regName, last_name: regLastName,
    });
    const token = res.data?.tokens?.access_token;
    if (token) saveToken(token);
    else setError(t("errors.serverResponseInvalid"));
  } catch (err) {
    setError(parseApiError(err, t("errors.registerFailed")));
  } finally { setLoading(false); }
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

              <form onSubmit={handleRegister} style={{ display:"flex", flexDirection:"column", gap:0 }}>
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
        </div>
      </div>
    </div>
  );
}