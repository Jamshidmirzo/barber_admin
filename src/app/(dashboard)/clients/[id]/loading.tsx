const cardS: React.CSSProperties = { background:"var(--surface)", border:"1px solid var(--border)", borderRadius:"var(--radius-lg)" };
const pulse: React.CSSProperties = { animation:"pulse 1.5s infinite" };

export default function ClientDetailLoading() {
  return (
    <div style={{ padding:"32px 36px", maxWidth:900 }}>
      <div style={{ height:16, width:100, background:"var(--surface)", borderRadius:4, marginBottom:20, ...pulse }} />

      {/* Header card */}
      <div style={{ ...cardS, padding:24, marginBottom:16 }}>
        <div style={{ display:"flex", alignItems:"center", gap:16 }}>
          <div style={{ width:56, height:56, borderRadius:"var(--radius-lg)", background:"var(--bg)", flexShrink:0, ...pulse }} />
          <div style={{ display:"flex", flexDirection:"column", gap:8, flex:1 }}>
            <div style={{ height:18, width:160, background:"var(--bg)", borderRadius:4, ...pulse }} />
            <div style={{ height:12, width:200, background:"var(--bg)", borderRadius:4, ...pulse }} />
          </div>
        </div>
      </div>

      {/* KPI */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(2,1fr)", gap:12, marginBottom:16 }}>
        <div style={{ ...cardS, height:66, ...pulse }} />
        <div style={{ ...cardS, height:66, ...pulse }} />
      </div>

      {/* History */}
      <div style={{ ...cardS, height:220, ...pulse }} />

      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.5}}`}</style>
    </div>
  );
}
