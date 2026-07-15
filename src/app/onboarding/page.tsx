"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { Scissors, Loader2, MapPin, Check } from "lucide-react";
import api, { parseApiError } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { useSalonContextQuery } from "@/hooks/useSalon";
import { useProfileQuery } from "@/hooks/useProfile";
import KakaoMapPicker, { type PickedPlace } from "@/components/KakaoMapPicker";
import YandexMapPicker from "@/components/YandexMapPicker";

type PlaceResult = PickedPlace;

const BRN_RE = /^\d{10}$/;

// The Kakao place-search/geocode and Yandex manual-geocode results all go
// through our own backend (no structured locality field — see
// PlaceResultSchema), so `place.city` is only set when the map SDK resolved
// it directly (map click / "use my location"). Fall back to parsing the
// address string for the common search/manual-entry paths.
function deriveCity(place: PickedPlace, korea: boolean): string | null {
  if (place.city) return place.city;
  const source = place.road_address_name || place.address_name;
  if (!source) return null;
  if (korea) {
    // Korean addresses lead with the region/city: "서울특별시 강남구 ..."
    return source.trim().split(/\s+/)[0] || null;
  }
  // Yandex-formatted addresses are comma-separated and often lead with the
  // country name before the city ("Узбекистан, Ташкент, ...").
  const parts = source.split(",").map((p) => p.trim()).filter(Boolean);
  return parts.find((p) => !/узбекистан|uzbekistan/i.test(p)) ?? parts[0] ?? null;
}

const inp: React.CSSProperties = {
  width:"100%", background:"rgba(255,255,255,0.04)", color:"var(--text)",
  border:"1px solid var(--border)", borderRadius:"var(--radius)",
  padding:"12px 16px", fontSize:14, fontFamily:"'Manrope',sans-serif",
  outline:"none", boxSizing:"border-box",
};

export default function OnboardingPage() {
  const t = useTranslations("Onboarding");
  useAuth();
  const router = useRouter();
  const qc = useQueryClient();

  const { data: salonCtx } = useSalonContextQuery();
  useEffect(() => { if (salonCtx?.salon) router.replace("/appointments"); }, [salonCtx, router]);

  const { data: profile } = useProfileQuery();
  const isKorea = profile?.country === "kr";
  const isUzbek = profile?.country === "uz";
  const countryKnown = profile?.country != null;

  const [name, setName] = useState("");
  const [brn, setBrn] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Kakao place search — resolves the location NTS can't provide.
  const [placeQuery, setPlaceQuery] = useState("");
  const [placeResults, setPlaceResults] = useState<PlaceResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedPlace, setSelectedPlace] = useState<PlaceResult | null>(null);
  const [manualMode, setManualMode] = useState(false);
  const [manualAddress, setManualAddress] = useState("");
  const [geocoding, setGeocoding] = useState(false);
  const [geocodeError, setGeocodeError] = useState("");
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!isKorea || manualMode || selectedPlace) return;
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(async () => {
      const q = placeQuery.trim();
      if (q.length < 2) { setPlaceResults([]); return; }
      setSearching(true);
      try {
        const res = await api.get("/salons/places/search", { params: { query: q } });
        setPlaceResults(res.data?.results ?? []);
      } catch { setPlaceResults([]); }
      finally { setSearching(false); }
    }, 500);
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current); };
  }, [placeQuery, isKorea, manualMode, selectedPlace]);

  async function handleGeocode() {
    if (manualAddress.trim().length < 3) return;
    setGeocoding(true); setGeocodeError("");
    try {
      const res = await api.get("/salons/places/geocode", { params: { address: manualAddress.trim() } });
      setSelectedPlace(res.data);
    } catch (err) { setGeocodeError(parseApiError(err, t("errors.geocode"))); }
    finally { setGeocoding(false); }
  }

  const brnValid = !isKorea || BRN_RE.test(brn.replace(/[\s-]/g, ""));
  const locationValid = !countryKnown || selectedPlace !== null;
  const canSubmit = name.trim().length >= 2 && brnValid && locationValid && !submitting;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setError(""); setSubmitting(true);
    const city = selectedPlace ? deriveCity(selectedPlace, isKorea) : null;
    try {
      await api.post("/salons", {
        name: name.trim(),
        ...(isKorea ? { business_registration_number: brn.replace(/[\s-]/g, "") } : {}),
        ...(selectedPlace ? {
          address: selectedPlace.road_address_name || selectedPlace.address_name,
          latitude: selectedPlace.latitude,
          longitude: selectedPlace.longitude,
        } : {}),
        ...(city ? { city } : {}),
      });

      // The salon's city doesn't automatically carry over to the owner's own
      // profile (separate records) — save it there too so the Profile screen
      // is pre-filled instead of asking the user to type it again.
      if (city) {
        try {
          await api.put("/profile", { city });
          qc.setQueryData(["profile"], (prev: { city?: string | null } | undefined) => (prev ? { ...prev, city } : prev));
        } catch { /* non-critical — salon creation already succeeded */ }
      }

      await qc.invalidateQueries({ queryKey:["salon-context"] });
      router.replace("/barbers");
    } catch (err) { setError(parseApiError(err, t("errors.submit"))); setSubmitting(false); }
  }

  return (
    <div style={{ minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", background:"var(--bg)", padding:"40px 16px" }}>
      <div style={{ width:"100%", maxWidth:420 }}>

        {/* Logo */}
        <div style={{ textAlign:"center", marginBottom:32 }}>
          <div style={{ width:64, height:64, borderRadius:20, background:"var(--gold)", display:"inline-flex", alignItems:"center", justifyContent:"center", marginBottom:16 }}>
            <Scissors size={28} style={{ color:"#0a0a0b" }} />
          </div>
          <h1 style={{ fontFamily:"'Playfair Display',serif", fontSize:26, fontWeight:700, color:"var(--text)", margin:0 }}>{t("title")}</h1>
          <p style={{ color:"var(--text2)", fontSize:14, marginTop:8 }}>
            {t("subtitle")}
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ background:"var(--surface)", border:"1px solid var(--border)", borderRadius:"var(--radius-lg)", padding:28, display:"flex", flexDirection:"column", gap:20 }}>

          {/* Name */}
          <div>
            <label style={{ display:"block", color:"var(--text2)", fontSize:13, marginBottom:8 }}>{t("name.label")}</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder={t("name.placeholder")} maxLength={200} required autoFocus style={inp} />
          </div>

          {/* Business registration number — Korea only */}
          {isKorea && (
            <div>
              <label style={{ display:"block", color:"var(--text2)", fontSize:13, marginBottom:8 }}>{t("brn.label")}</label>
              <input
                type="text" value={brn}
                onChange={(e) => setBrn(e.target.value)}
                placeholder={t("brn.placeholder")} maxLength={20}
                style={inp}
              />
              {brn && !brnValid && (
                <p style={{ color:"var(--red)", fontSize:11, margin:"6px 0 0" }}>{t("brn.error")}</p>
              )}
            </div>
          )}

          {/* Kakao Map location — Korea only */}
          {isKorea && (
            <div>
              <label style={{ display:"block", color:"var(--text2)", fontSize:13, marginBottom:8 }}>{t("location.label")}</label>

              {selectedPlace ? (
                <div style={{ display:"flex", alignItems:"flex-start", gap:10, padding:"12px 14px", background:"rgba(56,161,105,0.08)", border:"1px solid var(--green,#38a169)", borderRadius:"var(--radius)" }}>
                  <Check size={16} style={{ color:"var(--green,#38a169)", flexShrink:0, marginTop:2 }} />
                  <div style={{ minWidth:0, flex:1 }}>
                    <p style={{ color:"var(--text)", fontSize:13, fontWeight:600, margin:0 }}>{selectedPlace.place_name}</p>
                    <p style={{ color:"var(--text2)", fontSize:12, margin:"2px 0 0" }}>{selectedPlace.road_address_name || selectedPlace.address_name}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => { setSelectedPlace(null); setManualMode(false); setManualAddress(""); setGeocodeError(""); }}
                    style={{ background:"transparent", border:"none", color:"var(--text2)", fontSize:12, cursor:"pointer", flexShrink:0 }}
                  >{t("location.change")}</button>
                </div>
              ) : manualMode ? (
                <div>
                  <div style={{ display:"flex", gap:8 }}>
                    <input
                      type="text" value={manualAddress}
                      onChange={(e) => setManualAddress(e.target.value)}
                      placeholder={t("location.manualPlaceholder")}
                      style={{ ...inp, flex:1 }}
                    />
                    <button
                      type="button" onClick={handleGeocode} disabled={geocoding || manualAddress.trim().length < 3}
                      style={{ padding:"0 16px", background:"var(--gold)", color:"#0a0a0b", border:"none", borderRadius:"var(--radius)", fontSize:13, fontWeight:600, cursor:"pointer", opacity: geocoding || manualAddress.trim().length < 3 ? 0.5 : 1, display:"flex", alignItems:"center", gap:6 }}
                    >
                      {geocoding && <Loader2 size={13} style={{ animation:"spin 1s linear infinite" }} />}
                      {t("location.findButton")}
                    </button>
                  </div>
                  {geocodeError && <p style={{ color:"var(--red)", fontSize:11, margin:"6px 0 0" }}>{geocodeError}</p>}
                  <button type="button" onClick={() => setManualMode(false)} style={{ background:"transparent", border:"none", color:"var(--text2)", fontSize:11, cursor:"pointer", marginTop:8, padding:0 }}>
                    {t("location.backToSearch")}
                  </button>
                </div>
              ) : (
                <div>
                  <div style={{ position:"relative" }}>
                    <MapPin size={14} style={{ position:"absolute", left:14, top:"50%", transform:"translateY(-50%)", color:"var(--text3)" }} />
                    <input
                      type="text" value={placeQuery}
                      onChange={(e) => setPlaceQuery(e.target.value)}
                      placeholder={t("location.searchPlaceholder")}
                      style={{ ...inp, paddingLeft:36 }}
                    />
                    {searching && <Loader2 size={14} style={{ position:"absolute", right:14, top:"50%", transform:"translateY(-50%)", color:"var(--text3)", animation:"spin 1s linear infinite" }} />}
                  </div>

                  {placeResults.length > 0 && (
                    <div style={{ marginTop:8, border:"1px solid var(--border)", borderRadius:"var(--radius)", overflow:"hidden" }}>
                      {placeResults.map((p, i) => (
                        <button
                          key={i} type="button" onClick={() => setSelectedPlace(p)}
                          style={{ display:"block", width:"100%", textAlign:"left", padding:"10px 14px", background:"transparent", border:"none", borderBottom: i < placeResults.length - 1 ? "1px solid var(--border)" : "none", cursor:"pointer" }}
                        >
                          <p style={{ color:"var(--text)", fontSize:13, fontWeight:600, margin:0 }}>{p.place_name}</p>
                          <p style={{ color:"var(--text2)", fontSize:11.5, margin:"2px 0 0" }}>{p.road_address_name || p.address_name}</p>
                        </button>
                      ))}
                    </div>
                  )}

                  {!searching && placeQuery.trim().length >= 2 && placeResults.length === 0 && (
                    <p style={{ color:"var(--text3)", fontSize:12, margin:"8px 0 0" }}>{t("location.noResults")}</p>
                  )}

                  <button type="button" onClick={() => setManualMode(true)} style={{ background:"transparent", border:"none", color:"var(--text2)", fontSize:11, cursor:"pointer", marginTop:8, padding:0 }}>
                    {t("location.manualToggle")}
                  </button>
                </div>
              )}

              <div style={{ marginTop:12 }}>
                <KakaoMapPicker selected={selectedPlace} onPick={setSelectedPlace} />
              </div>
            </div>
          )}

          {/* Yandex Map location — Uzbekistan only */}
          {isUzbek && (
            <div>
              <label style={{ display:"block", color:"var(--text2)", fontSize:13, marginBottom:8 }}>{t("locationUz.label")}</label>

              {selectedPlace && (
                <div style={{ display:"flex", alignItems:"flex-start", gap:10, padding:"12px 14px", background:"rgba(56,161,105,0.08)", border:"1px solid var(--green,#38a169)", borderRadius:"var(--radius)", marginBottom:12 }}>
                  <Check size={16} style={{ color:"var(--green,#38a169)", flexShrink:0, marginTop:2 }} />
                  <div style={{ minWidth:0, flex:1 }}>
                    <p style={{ color:"var(--text)", fontSize:13, fontWeight:600, margin:0 }}>{selectedPlace.place_name}</p>
                    <p style={{ color:"var(--text2)", fontSize:12, margin:"2px 0 0" }}>{selectedPlace.road_address_name || selectedPlace.address_name}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedPlace(null)}
                    style={{ background:"transparent", border:"none", color:"var(--text2)", fontSize:12, cursor:"pointer", flexShrink:0 }}
                  >{t("locationUz.change")}</button>
                </div>
              )}

              <YandexMapPicker selected={selectedPlace} onPick={setSelectedPlace} />
            </div>
          )}

          {error && (
            <p style={{ color:"var(--red)", fontSize:13, background:"rgba(224,90,90,0.08)", borderRadius:"var(--radius)", padding:"10px 14px", margin:0 }}>{error}</p>
          )}

          <button type="submit" disabled={!canSubmit} style={{ width:"100%", background:"var(--gold)", color:"#0a0a0b", border:"none", borderRadius:"var(--radius)", padding:"13px", fontSize:14, fontWeight:700, cursor: canSubmit ? "pointer" : "not-allowed", opacity: canSubmit ? 1 : 0.45, display:"flex", alignItems:"center", justifyContent:"center", gap:8 }}>
            {submitting && <Loader2 size={15} style={{ animation:"spin 1s linear infinite" }} />}
            {submitting ? t("submit.submitting") : t("submit.button")}
          </button>
        </form>
      </div>
      <style>{`@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
