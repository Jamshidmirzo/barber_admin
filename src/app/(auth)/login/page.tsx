"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import api, { parseApiError } from "@/lib/api";

type Tab = "login" | "register";

const inputStyle: React.CSSProperties = {
  width:"100%", background:"var(--bg2)", color:"var(--text)",
  border:"1px solid var(--border)", borderRadius:"var(--radius)",
  padding:"11px 14px", fontSize:14, fontFamily:"'Manrope',sans-serif",
  outline:"none", transition:"border-color 0.15s",
};

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  const [foc, setFoc] = useState(false);
  return (
    <input
      {...props}
      onFocus={(e) => { setFoc(true); props.onFocus?.(e); }}
      onBlur={(e) => { setFoc(false); props.onBlur?.(e); }}
      style={{ ...inputStyle, borderColor: foc ? "var(--gold)" : "var(--border)" }}
    />
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <label style={{ display:"block", fontSize:12, color:"var(--text2)", marginBottom:6, fontWeight:500 }}>{children}</label>;
}

export default function LoginPage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("login");

  const [phone, setPhone] = useState("+998");
  const [password, setPassword] = useState("");

  const [regPhone, setRegPhone] = useState("+998");
  const [regName, setRegName] = useState("");
  const [regLastName, setRegLastName] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regPassword2, setRegPassword2] = useState("");

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function saveToken(token: string) {
    localStorage.setItem("barber_admin_token", token);
    router.push("/appointments");
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await api.post("/auth/login", { phone, password });
      const token = res.data?.tokens?.access_token;
      if (token) saveToken(token);
      else setError("Неверный ответ сервера");
    } catch (err) {
      setError(parseApiError(err, "Неверный телефон или пароль"));
    } finally {
      setLoading(false);
    }
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (regPassword !== regPassword2) { setError("Пароли не совпадают"); return; }
    if (regPassword.length < 6) { setError("Пароль минимум 6 символов"); return; }
    setLoading(true);
    try {
      const res = await api.post("/auth/register", {
        phone: regPhone, password: regPassword,
        name: regName, last_name: regLastName,
      });
      const token = res.data?.tokens?.access_token;
      if (token) saveToken(token);
      else setError("Неверный ответ сервера");
    } catch (err) {
      setError(parseApiError(err, "Ошибка регистрации"));
    } finally {
      setLoading(false);
    }
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
            width:56, height:56, borderRadius:14, background:"var(--gold)",
            display:"flex", alignItems:"center", justifyContent:"center",
            margin:"0 auto 16px",
          }}>
            <span style={{ fontFamily:"'Playfair Display',serif", fontSize:26, fontWeight:700, color:"#0a0a0b" }}>H</span>
          </div>
          <h1 style={{ fontFamily:"'Playfair Display',serif", fontSize:26, fontWeight:600, color:"var(--text)", margin:0 }}>
            BarberAdmin
          </h1>
          <p style={{ color:"var(--text2)", fontSize:13, marginTop:6 }}>Панель управления барбершопом</p>
        </div>

        {/* Tab switcher */}
        <div style={{
          display:"flex", background:"var(--surface)", border:"1px solid var(--border)",
          borderRadius:"var(--radius)", padding:4, marginBottom:20,
        }}>
          {(["login","register"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => { setTab(t); setError(""); }}
              style={{
                flex:1, padding:"8px 0", fontSize:13, fontWeight:600,
                borderRadius:9, border:"none", cursor:"pointer",
                transition:"background 0.15s, color 0.15s",
                background: tab === t ? "var(--gold)" : "transparent",
                color: tab === t ? "#0a0a0b" : "var(--text2)",
              }}
            >
              {t === "login" ? "Войти" : "Регистрация"}
            </button>
          ))}
        </div>

        {/* Card */}
        <div style={{
          background:"var(--surface)", border:"1px solid var(--border)",
          borderRadius:"var(--radius-lg)", padding:28,
        }}>
          {tab === "login" ? (
            <form onSubmit={handleLogin} style={{ display:"flex", flexDirection:"column", gap:16 }}>
              <div>
                <Label>Телефон</Label>
                <Input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+998901234567" required />
              </div>
              <div>
                <Label>Пароль</Label>
                <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••" required />
              </div>
              {error && (
                <div style={{ background:"rgba(224,90,90,0.08)", border:"1px solid rgba(224,90,90,0.2)", borderRadius:"var(--radius)", padding:"10px 14px", color:"var(--red)", fontSize:13 }}>
                  {error}
                </div>
              )}
              <button
                type="submit" disabled={loading}
                style={{
                  width:"100%", background:"var(--gold)", color:"#0a0a0b",
                  border:"none", borderRadius:"var(--radius)", padding:"12px",
                  fontSize:14, fontWeight:700, cursor: loading ? "not-allowed" : "pointer",
                  opacity: loading ? 0.6 : 1, fontFamily:"'Manrope',sans-serif",
                  transition:"opacity 0.15s",
                }}
              >
                {loading ? "Входим..." : "Войти"}
              </button>
            </form>
          ) : (
            <form onSubmit={handleRegister} style={{ display:"flex", flexDirection:"column", gap:14 }}>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
                <div>
                  <Label>Имя</Label>
                  <Input type="text" value={regName} onChange={(e) => setRegName(e.target.value)} placeholder="Алишер" required />
                </div>
                <div>
                  <Label>Фамилия</Label>
                  <Input type="text" value={regLastName} onChange={(e) => setRegLastName(e.target.value)} placeholder="Каримов" />
                </div>
              </div>
              <div>
                <Label>Телефон</Label>
                <Input type="tel" value={regPhone} onChange={(e) => setRegPhone(e.target.value)} placeholder="+998901234567" required />
              </div>
              <div>
                <Label>Пароль</Label>
                <Input type="password" value={regPassword} onChange={(e) => setRegPassword(e.target.value)} placeholder="Минимум 6 символов" required />
              </div>
              <div>
                <Label>Повторите пароль</Label>
                <Input type="password" value={regPassword2} onChange={(e) => setRegPassword2(e.target.value)} placeholder="••••••" required />
              </div>
              {error && (
                <div style={{ background:"rgba(224,90,90,0.08)", border:"1px solid rgba(224,90,90,0.2)", borderRadius:"var(--radius)", padding:"10px 14px", color:"var(--red)", fontSize:13 }}>
                  {error}
                </div>
              )}
              <button
                type="submit" disabled={loading}
                style={{
                  width:"100%", background:"var(--gold)", color:"#0a0a0b",
                  border:"none", borderRadius:"var(--radius)", padding:"12px",
                  fontSize:14, fontWeight:700, cursor: loading ? "not-allowed" : "pointer",
                  opacity: loading ? 0.6 : 1, fontFamily:"'Manrope',sans-serif",
                  transition:"opacity 0.15s",
                }}
              >
                {loading ? "Регистрируем..." : "Создать аккаунт"}
              </button>
              <p style={{ textAlign:"center", color:"var(--text3)", fontSize:12 }}>
                После регистрации создашь свой барбершоп
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
