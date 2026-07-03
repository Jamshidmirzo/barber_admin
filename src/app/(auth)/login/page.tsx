"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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

function formatPhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  const local = digits.startsWith("998") ? digits.slice(3) : digits;
  let out = "+998";
  if (local.length > 0) out += " " + local.slice(0, 2);
  if (local.length > 2) out += " " + local.slice(2, 5);
  if (local.length > 5) out += " " + local.slice(5, 7);
  if (local.length > 7) out += " " + local.slice(7, 9);
  return out;
}

type View = "login" | "register";

export default function LoginPage() {
  const router = useRouter();
  const [view, setView] = useState<View>("login");
  const [phone, setPhone] = useState("+998");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
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
    setError(""); setLoading(true);
    try {
      const res = await api.post("/auth/login", { phone: phone.replace(/\s/g, ""), password });
      const token = res.data?.tokens?.access_token;
      if (token) saveToken(token);
      else setError("Неверный ответ сервера");
    } catch (err) {
      setError(parseApiError(err, "Неверный телефон или пароль"));
    } finally { setLoading(false); }
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (regPass !== regPass2) { setError("Пароли не совпадают"); return; }
    if (regPass.length < 6) { setError("Пароль минимум 6 символов"); return; }
    setLoading(true);
    try {
      const res = await api.post("/auth/register", {
        phone: regPhone.replace(/\s/g, ""), password: regPass,
        name: regName, last_name: regLastName,
      });
      const token = res.data?.tokens?.access_token;
      if (token) saveToken(token);
      else setError("Неверный ответ сервера");
    } catch (err) {
      setError(parseApiError(err, "Ошибка регистрации"));
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
            Панель управления барбершопом
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
              <div style={{ fontFamily:"'Playfair Display',serif", fontSize:19, fontWeight:600, marginBottom:2 }}>С возвращением</div>
              <div style={{ color:"var(--text2)", fontSize:12.5, marginBottom:22 }}>Войдите, чтобы продолжить работу</div>

              <form onSubmit={handleLogin} style={{ display:"flex", flexDirection:"column", gap:0 }}>
                <label style={lbl}>Номер телефона</label>
                <input
                  type="tel" value={phone} placeholder="+998 90 000 00 00" required
                  onChange={(e) => {
                    const raw = e.target.value;
                    if (!raw.startsWith("+998")) { setPhone("+998"); return; }
                    setPhone(formatPhone(raw));
                  }}
                  style={{ ...inp, marginBottom:16 }}
                />
                <label style={lbl}>Пароль</label>
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
                  {loading ? "Входим…" : "Войти"}
                </button>

                <div style={{ textAlign:"center", marginTop:16, fontSize:12, color:"var(--text3)" }}>
                  Нет аккаунта?{" "}
                  <span
                    onClick={() => { setView("register"); setError(""); }}
                    style={{ color:"var(--gold)", cursor:"pointer", fontWeight:600 }}
                  >
                    Создать салон
                  </span>
                </div>
              </form>
            </>
          ) : (
            <>
              <div style={{ fontFamily:"'Playfair Display',serif", fontSize:19, fontWeight:600, marginBottom:2 }}>Создать салон</div>
              <div style={{ color:"var(--text2)", fontSize:12.5, marginBottom:22 }}>Зарегистрируйтесь и начните работу</div>

              <form onSubmit={handleRegister} style={{ display:"flex", flexDirection:"column", gap:0 }}>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:16 }}>
                  <div>
                    <label style={lbl}>Имя</label>
                    <input value={regName} onChange={(e) => setRegName(e.target.value)} placeholder="Алишер" required style={inp} />
                  </div>
                  <div>
                    <label style={lbl}>Фамилия</label>
                    <input value={regLastName} onChange={(e) => setRegLastName(e.target.value)} placeholder="Каримов" style={inp} />
                  </div>
                </div>

                <label style={lbl}>Номер телефона</label>
                <input
                  type="tel" value={regPhone} placeholder="+998 90 000 00 00" required
                  onChange={(e) => {
                    const raw = e.target.value;
                    if (!raw.startsWith("+998")) { setRegPhone("+998"); return; }
                    setRegPhone(formatPhone(raw));
                  }}
                  style={{ ...inp, marginBottom:16 }}
                />

                <label style={lbl}>Пароль</label>
                <div style={{ position:"relative", marginBottom:16 }}>
                  <input
                    type={showRegPass ? "text" : "password"} value={regPass} placeholder="Минимум 6 символов" required
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

                <label style={lbl}>Повторите пароль</label>
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
                  {loading ? "Регистрируем…" : "Создать аккаунт"}
                </button>

                <div style={{ textAlign:"center", marginTop:16, fontSize:12, color:"var(--text3)" }}>
                  Уже есть аккаунт?{" "}
                  <span
                    onClick={() => { setView("login"); setError(""); }}
                    style={{ color:"var(--gold)", cursor:"pointer", fontWeight:600 }}
                  >
                    Войти
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
