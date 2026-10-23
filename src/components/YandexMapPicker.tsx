"use client";

import { useEffect, useRef, useState } from "react";
import Script from "next/script";
import { useTranslations } from "next-intl";
import { Locate, Loader2, Search } from "lucide-react";
import { buildPickedPlace, type PickedPlace, type ResolvedAddress } from "@/lib/geo";

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

/** One geocoder hit, in the shape both lookup paths below produce. */
interface GeocodeHit {
  lat: number;
  lng: number;
  address: string;
  city: string | null;
}

// Yandex's developer console now sells "JavaScript API" and "API Геокодера"
// as separate products with separate keys, and a JavaScript-API-only key
// can't geocode — `ymaps.geocode` just fails. When a geocoder key is set, the
// lookups go straight to the HTTP Geocoder (it answers CORS for any origin)
// instead; without one they fall back to `ymaps.geocode`, which still works
// for an old combined "JavaScript API и HTTP Геокодер" key.
interface HttpGeocoderResponse {
  response?: {
    GeoObjectCollection?: {
      featureMember?: {
        GeoObject?: {
          Point?: { pos?: string };
          metaDataProperty?: {
            GeocoderMetaData?: {
              text?: string;
              Address?: { Components?: { kind?: string; name?: string }[] };
            };
          };
        };
      }[];
    };
  };
}

async function httpGeocode(apiKey: string, request: YmapsCoords | string): Promise<GeocodeHit | null> {
  // The HTTP Geocoder takes "longitude,latitude" — the reverse of the JS API.
  const geocode = typeof request === "string" ? request : `${request[1]},${request[0]}`;
  const params = new URLSearchParams({ apikey: apiKey, geocode, format: "json", lang: "ru_RU", results: "1" });
  const res = await fetch(`https://geocode-maps.yandex.ru/v1/?${params}`);
  if (!res.ok) throw new Error(`geocoder ${res.status}`);
  const data = (await res.json()) as HttpGeocoderResponse;
  const geoObject = data.response?.GeoObjectCollection?.featureMember?.[0]?.GeoObject;
  const [lng, lat] = (geoObject?.Point?.pos ?? "").split(" ").map(Number);
  if (!geoObject || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const meta = geoObject.metaDataProperty?.GeocoderMetaData;
  return {
    lat,
    lng,
    address: meta?.text ?? "",
    city: meta?.Address?.Components?.find((c) => c.kind === "locality")?.name ?? null,
  };
}

export default function YandexMapPicker({ selected, onPick }: YandexMapPickerProps) {
  const t = useTranslations("YandexMap");
  const jsKey = process.env.NEXT_PUBLIC_YANDEX_JS_KEY;
  const geocoderKey = process.env.NEXT_PUBLIC_YANDEX_GEOCODER_KEY;
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
  const [geocodeNotice, setGeocodeNotice] = useState("");

  useEffect(() => { onPickRef.current = onPick; }, [onPick]);

  // The pick is committed on every path, including failure: the coordinates
  // came from the map and are valid on their own, so a geocoder that is
  // unavailable (an unscoped API key makes every call 503) must not cost the
  // user their selection.
  function commit(lat: number, lng: number, resolved: ResolvedAddress | null) {
    onPickRef.current(buildPickedPlace(lat, lng, resolved, t("selectedPointFallback")));
  }

  // Resolves to null for "no match", rejects when the geocoder itself failed
  // (bad key, network) — callers report those two differently.
  async function geocode(request: YmapsCoords | string): Promise<GeocodeHit | null> {
    if (geocoderKey) return httpGeocode(geocoderKey, request);
    const ymaps = window.ymaps;
    if (!ymaps) throw new Error("ymaps not loaded");
    // `geocode` can throw synchronously as well as reject; inside an async
    // function both end up as a rejection.
    const res = await ymaps.geocode(request);
    const geoObject = res.geoObjects.get(0);
    if (!geoObject) return null;
    const [lat, lng] = geoObject.geometry.getCoordinates();
    return { lat, lng, address: geoObject.getAddressLine(), city: geoObject.getLocalities()[0] ?? null };
  }

  function reverseGeocode(lat: number, lng: number) {
    setGeocodeNotice("");
    geocode([lat, lng])
      .then((hit) => {
        if (!hit) {
          setGeocodeNotice(t("errors.addressLookupFailed"));
          commit(lat, lng, null);
          return;
        }
        commit(lat, lng, { address: hit.address, city: hit.city });
      })
      .catch(() => {
        setGeocodeNotice(t("errors.addressLookupFailed"));
        commit(lat, lng, null);
      });
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
    if (!geocoderKey && !window.ymaps) return;
    setSearching(true); setSearchError("");
    try {
      const hit = await geocode(query);
      // A rejected call and an empty result mean different things: the first
      // is the geocoder refusing us (usually a bad/unscoped API key), the
      // second is a query that genuinely matches nothing. Saying "address not
      // found" for both sends people off hunting for a typo that isn't there.
      if (!hit) { setSearchError(t("errors.noResults")); return; }
      movePlacemark(hit.lat, hit.lng, true);
      setGeocodeNotice("");
      commit(hit.lat, hit.lng, { address: hit.address, city: hit.city });
    } catch {
      setSearchError(t("errors.geocoderUnavailable"));
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
          style={{ padding:"0 16px", background:"var(--gold)", color:"var(--on-gold)", border:"none", borderRadius:"var(--radius)", fontSize:13, fontWeight:600, cursor:"pointer", opacity: searching || searchQuery.trim().length < 3 ? 0.5 : 1, display:"flex", alignItems:"center", gap:6 }}
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
      {geocodeNotice && <p style={{ color:"var(--text3)", fontSize:11, margin:"6px 0 0" }}>{geocodeNotice}</p>}
      {mapError && <p style={{ color:"var(--red)", fontSize:11, margin:"6px 0 0" }}>{mapError}</p>}
    </div>
  );
}
