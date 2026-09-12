const cardS: React.CSSProperties = { background:"var(--surface)", border:"1px solid var(--border)", borderRadius:"var(--radius-lg)" };
const pulse: React.CSSProperties = { animation:"pulse 1.5s infinite" };

export default function BarberDetailLoading() {
  return (
    <div style={{ padding:"32px 36px", maxWidth:900 }}>
      <div style={{ height:16, width:100, background:"var(--surface)", borderRadius:4, marginBottom:20, ...pulse }} />

      {/* Header */}
      <div style={{ display:"flex", alignItems:"center", gap:16, marginBottom:24 }}>
        <div style={{ width:56, height:56, borderRadius:"50%", background:"var(--surface)", flexShrink:0, ...pulse }} />
        <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
          <div style={{ height:18, width:160, background:"var(--surface)", borderRadius:4, ...pulse }} />
          <div style={{ height:12, width:110, background:"var(--surface)", borderRadius:4, ...pulse }} />
        </div>
      </div>

      {/* Credentials + price list */}
      <div style={{ ...cardS, height:70, marginBottom:16, ...pulse }} />
      <div style={{ ...cardS, height:120, marginBottom:16, ...pulse }} />

      {/* Summary bar */}
      <div style={{ ...cardS, height:76, marginBottom:24, ...pulse }} />

      {/* Period selector */}
      <div style={{ height:38, width:260, background:"var(--surface)", border:"1px solid var(--border)", borderRadius:"var(--radius)", marginBottom:24, ...pulse }} />

      {/* Stats cards */}
      <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
        {[80, 64, 260, 180].map((h, i) => (
          <div key={i} style={{ ...cardS, height:h, ...pulse }} />
        ))}
      </div>

      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.5}}`}</style>
    </div>
  );
}
