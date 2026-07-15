"use client";

import { useEffect, useRef, useState } from "react";
import Script from "next/script";
import { useTranslations } from "next-intl";
import { Locate, Loader2, Search } from "lucide-react";
import type { PickedPlace } from "@/components/KakaoMapPicker";

// Yandex Maps JS API 2.1 doesn't ship official TS types — minimal shapes for
// the subset of the API this component actually uses. Coordinates are
// [latitude, longitude] tuples throughout, matching the API's default order.
type YmapsCoords = [number, number];
interface YmapsGeoObject {
  geometry: { getCoordinates(): YmapsCoords };
  getAddressLine(): string;
  getLocalities(): string[];
}
interface YmapsGeocodeResult {
  geoObjects: { get(index: number): YmapsGeoObject | undefined };
}
interface YmapsPlacemark {
  geometry: { setCoordinates(coords: YmapsCoords): void };
}
interface YmapsClickEvent {
  get(key: "coords"): YmapsCoords;
}
interface YmapsMap {
  setCenter(coords: YmapsCoords): void;
  geoObjects: { add(obj: YmapsPlacemark): void };
  events: {
    add(type: "click", handler: (e: YmapsClickEvent) => void): void;
  };
}
interface YmapsNamespace {
  ready(callback: () => void): void;
  Map: new (
    container: HTMLElement,
    options: { center: YmapsCoords; zoom: number }
  ) => YmapsMap;
  Placemark: new (coords: YmapsCoords) => YmapsPlacemark;
  geocode(request: YmapsCoords | string): Promise<YmapsGeocodeResult>;
}

declare global {
  interface Window {
    ymaps: YmapsNamespace;
  }
}

interface YandexMapPickerProps {
  /** Currently selected location (from a previous map pick). */
  selected: PickedPlace | null;
  /** Fired when the user picks a point directly on the map (click or "use my location"). */
  onPick: (place: PickedPlace) => void;
}

// Tashkent — fallback center when geolocation is unavailable/denied and
// nothing has been selected yet.
const DEFAULT_CENTER = { lat: 41.311081, lng: 69.240562 };

export default function YandexMapPicker({ selected, onPick }: YandexMapPickerProps) {
  const t = useTranslations("YandexMap");
  const jsKey = process.env.NEXT_PUBLIC_YANDEX_JS_KEY;
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<YmapsMap | null>(null);
  const placemarkRef = useRef<YmapsPlacemark | null>(null);
  const onPickRef = useRef(onPick);

  const [sdkReady, setSdkReady] = useState(false);
  const [locating, setLocating] = useState(false);
  const [mapError, setMapError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");

  useEffect(() => { onPickRef.current = onPick; }, [onPick]);

  function reverseGeocode(lat: number, lng: number) {
    const ymaps = window.ymaps;
    if (!ymaps) return;
    ymaps
      .geocode([lat, lng])
      .then((res) => {
        const geoObject = res.geoObjects.get(0);
        if (!geoObject) return;
        const address = geoObject.getAddressLine();
        onPickRef.current({
          place_name: address || t("selectedPointFallback"),
          address_name: address || "",
          road_address_name: null,
          phone: null,
          latitude: lat,
          longitude: lng,
          city: geoObject.getLocalities()[0] ?? null,
        });
      })
      .catch(() => {});
  }

  function movePlacemark(lat: number, lng: number, pan = true) {
    const ymaps = window.ymaps;
    const map = mapRef.current;
    if (!ymaps || !map) return;
    const coords: YmapsCoords = [lat, lng];
    if (!placemarkRef.current) {
      placemarkRef.current = new ymaps.Placemark(coords);
      map.geoObjects.add(placemarkRef.current);
    } else {
      placemarkRef.current.geometry.setCoordinates(coords);
    }
    if (pan) map.setCenter(coords);
  }

  function initMap() {
    const ymaps = window.ymaps;
    if (!ymaps || !containerRef.current || mapRef.current) return;

    const startAt = selected
      ? { lat: selected.latitude, lng: selected.longitude }
      : DEFAULT_CENTER;

    const map = new ymaps.Map(containerRef.current, {
      center: [startAt.lat, startAt.lng],
      zoom: 15,
    });
    mapRef.current = map;

    if (selected) movePlacemark(selected.latitude, selected.longitude, false);

    map.events.add("click", (e) => {
      const [lat, lng] = e.get("coords");
      movePlacemark(lat, lng, false);
      reverseGeocode(lat, lng);
    });

    setSdkReady(true);
  }

  // The SDK script can load (200 response) but leave `window.ymaps`
  // unpopulated if the key is invalid for this product/domain — never
  // assume it's there, and never let a script callback throw.
  function safeLoadAndInit() {
    try {
      window.ymaps?.ready(initMap);
    } catch {
      setMapError(t("errors.mapLoadFailed"));
    }
  }

  // Re-init if the script was already loaded by an earlier mount (Next's
  // Script dedupes by src, so onLoad won't fire twice). Deferred a tick so
  // any setState triggered by the SDK callback isn't synchronous within
  // the effect body.
  useEffect(() => {
    const kick = setTimeout(safeLoadAndInit, 0);
    const timeout = setTimeout(() => {
      if (!mapRef.current) {
        setMapError(t("errors.mapLoadFailed"));
      }
    }, 6000);
    return () => { clearTimeout(kick); clearTimeout(timeout); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep the marker in sync when selection changes from outside (e.g. "use
  // my location") rather than a direct map click.
  useEffect(() => {
    if (!sdkReady || !selected) return;
    movePlacemark(selected.latitude, selected.longitude, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sdkReady, selected?.latitude, selected?.longitude]);

  function useMyLocation() {
    if (!navigator.geolocation) {
      setMapError(t("errors.geolocationUnavailable"));
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        const { latitude, longitude } = pos.coords;
        movePlacemark(latitude, longitude, true);
        reverseGeocode(latitude, longitude);
      },
      () => { setLocating(false); setMapError(t("errors.locateFailed")); },
      { timeout: 8000 }
    );
  }

  async function handleSearch() {
    const query = searchQuery.trim();
    if (query.length < 3) return;
    const ymaps = window.ymaps;
    if (!ymaps) return;
    setSearching(true); setSearchError("");
    try {
      const res = await ymaps.geocode(query);
      const geoObject = res.geoObjects.get(0);
      if (!geoObject) { setSearchError(t("errors.noResults")); return; }
      const [lat, lng] = geoObject.geometry.getCoordinates();
      const address = geoObject.getAddressLine();
      movePlacemark(lat, lng, true);
      onPickRef.current({
        place_name: address || t("selectedPointFallback"),
        address_name: address || "",
        road_address_name: null,
        phone: null,
        latitude: lat,
        longitude: lng,
        city: geoObject.getLocalities()[0] ?? null,
      });
    } catch {
      setSearchError(t("errors.geocodeFailed"));
    } finally {
      setSearching(false);
    }
  }

  if (!jsKey) {
    return (
      <p style={{ color:"var(--text3)", fontSize:12, margin:0 }}>
        {t("errors.missingKey")}
      </p>
    );
  }

  return (
    <div>
      <Script
        id="yandex-maps-sdk"
        src={`https://api-maps.yandex.ru/2.1/?apikey=${jsKey}&lang=ru_RU`}
        strategy="afterInteractive"
        onLoad={safeLoadAndInit}
        onError={() => setMapError(t("errors.sdkLoadFailed"))}
      />
      <div style={{ display:"flex", gap:8, marginBottom:10 }}>
        <div style={{ position:"relative", flex:1 }}>
          <Search size={14} style={{ position:"absolute", left:14, top:"50%", transform:"translateY(-50%)", color:"var(--text3)" }} />
          <input
            type="text" value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleSearch(); } }}
            placeholder={t("searchPlaceholder")}
            style={{
              width:"100%", background:"rgba(255,255,255,0.04)", color:"var(--text)",
              border:"1px solid var(--border)", borderRadius:"var(--radius)",
              padding:"11px 14px 11px 36px", fontSize:13, outline:"none", boxSizing:"border-box",
            }}
          />
        </div>
        <button
          type="button" onClick={handleSearch} disabled={searching || searchQuery.trim().length < 3}
          style={{ padding:"0 16px", background:"var(--gold)", color:"#0a0a0b", border:"none", borderRadius:"var(--radius)", fontSize:13, fontWeight:600, cursor:"pointer", opacity: searching || searchQuery.trim().length < 3 ? 0.5 : 1, display:"flex", alignItems:"center", gap:6 }}
        >
          {searching && <Loader2 size={13} style={{ animation:"spin 1s linear infinite" }} />}
          {t("searchButton")}
        </button>
      </div>
      {searchError && <p style={{ color:"var(--red)", fontSize:11, margin:"0 0 10px" }}>{searchError}</p>}
      <div style={{ position:"relative" }}>
        <div
          ref={containerRef}
          style={{ width:"100%", height:220, borderRadius:"var(--radius)", border:"1px solid var(--border)", background:"var(--bg)" }}
        />
        <button
          type="button" onClick={useMyLocation} disabled={locating}
          style={{
            position:"absolute", top:10, right:10, display:"flex", alignItems:"center", gap:6,
            background:"var(--surface)", border:"1px solid var(--border)", borderRadius:"var(--radius)",
            padding:"7px 11px", fontSize:12, color:"var(--text)", cursor: locating ? "default" : "pointer",
            boxShadow:"0 1px 4px rgba(0,0,0,0.15)",
          }}
        >
          {locating ? <Loader2 size={13} style={{ animation:"spin 1s linear infinite" }} /> : <Locate size={13} />}
          {t("myLocation")}
        </button>
      </div>
      <p style={{ color:"var(--text3)", fontSize:11.5, margin:"6px 0 0" }}>
        {t("helperText")}
      </p>
      {mapError && <p style={{ color:"var(--red)", fontSize:11, margin:"6px 0 0" }}>{mapError}</p>}
    </div>
  );
}
