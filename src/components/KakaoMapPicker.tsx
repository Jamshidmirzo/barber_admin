"use client";

import { useEffect, useRef, useState } from "react";
import Script from "next/script";
import { useTranslations } from "next-intl";
import { Locate, Loader2 } from "lucide-react";

// Kakao Maps JS SDK doesn't ship official TS types — minimal shapes for the
// subset of the API this component actually uses.
interface KakaoLatLng {
  getLat(): number;
  getLng(): number;
}
interface KakaoMarker {
  setPosition(pos: KakaoLatLng): void;
}
interface KakaoMap {
  panTo(pos: KakaoLatLng): void;
}
interface KakaoGeocoderAddressResult {
  road_address?: { address_name: string } | null;
  address?: { address_name: string } | null;
}
interface KakaoGeocoder {
  coord2Address(
    lng: number,
    lat: number,
    callback: (result: KakaoGeocoderAddressResult[], status: string) => void
  ): void;
}
interface KakaoMapsNamespace {
  Map: new (container: HTMLElement, options: { center: KakaoLatLng; level: number }) => KakaoMap;
  Marker: new (options: { position: KakaoLatLng; map: KakaoMap }) => KakaoMarker;
  LatLng: new (lat: number, lng: number) => KakaoLatLng;
  event: {
    addListener(
      target: KakaoMap,
      type: string,
      handler: (e: { latLng: KakaoLatLng }) => void
    ): void;
  };
  services: {
    Geocoder: new () => KakaoGeocoder;
    Status: { OK: string };
  };
  load(callback: () => void): void;
}

declare global {
  interface Window {
    kakao: { maps: KakaoMapsNamespace };
  }
}

export interface PickedPlace {
  place_name: string;
  address_name: string;
  road_address_name: string | null;
  phone: string | null;
  latitude: number;
  longitude: number;
}

interface KakaoMapPickerProps {
  /** Currently selected location (from search results, geocode fallback, or a previous map pick). */
  selected: PickedPlace | null;
  /** Fired when the user picks a point directly on the map (click or "use my location"). */
  onPick: (place: PickedPlace) => void;
}

// Seoul City Hall — fallback center when geolocation is unavailable/denied
// and nothing has been selected yet.
const DEFAULT_CENTER = { lat: 37.5665, lng: 126.978 };

export default function KakaoMapPicker({ selected, onPick }: KakaoMapPickerProps) {
  const t = useTranslations("KakaoMap");
  const jsKey = process.env.NEXT_PUBLIC_KAKAO_JS_KEY;
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<KakaoMap | null>(null);
  const markerRef = useRef<KakaoMarker | null>(null);
  const geocoderRef = useRef<KakaoGeocoder | null>(null);
  const onPickRef = useRef(onPick);

  const [sdkReady, setSdkReady] = useState(false);
  const [locating, setLocating] = useState(false);
  const [mapError, setMapError] = useState("");

  useEffect(() => { onPickRef.current = onPick; }, [onPick]);

  function reverseGeocode(lat: number, lng: number) {
    const geocoder = geocoderRef.current;
    if (!geocoder) return;
    geocoder.coord2Address(lng, lat, (result, status) => {
      if (status !== window.kakao?.maps?.services?.Status?.OK || !result?.[0]) return;
      const doc = result[0];
      const road = doc.road_address?.address_name;
      const jibun = doc.address?.address_name;
      onPickRef.current({
        place_name: road || jibun || t("selectedPointFallback"),
        address_name: jibun || road || "",
        road_address_name: road || null,
        phone: null,
        latitude: lat,
        longitude: lng,
      });
    });
  }

  function moveMarker(lat: number, lng: number, pan = true) {
    const kakao = window.kakao;
    const map = mapRef.current;
    if (!kakao || !map) return;
    const pos = new kakao.maps.LatLng(lat, lng);
    if (!markerRef.current) {
      markerRef.current = new kakao.maps.Marker({ position: pos, map });
    } else {
      markerRef.current.setPosition(pos);
    }
    if (pan) map.panTo(pos);
  }

  function initMap() {
    const kakao = window.kakao;
    if (!kakao?.maps || !containerRef.current || mapRef.current) return;

    const startAt = selected
      ? { lat: selected.latitude, lng: selected.longitude }
      : DEFAULT_CENTER;

    const map = new kakao.maps.Map(containerRef.current, {
      center: new kakao.maps.LatLng(startAt.lat, startAt.lng),
      level: 4,
    });
    mapRef.current = map;
    geocoderRef.current = new kakao.maps.services.Geocoder();

    if (selected) moveMarker(selected.latitude, selected.longitude, false);

    kakao.maps.event.addListener(map, "click", (e) => {
      const lat = e.latLng.getLat();
      const lng = e.latLng.getLng();
      moveMarker(lat, lng, false);
      reverseGeocode(lat, lng);
    });

    setSdkReady(true);
  }

  // The SDK script can load (200 response) but leave `window.kakao`
  // unpopulated if the app's domain isn't registered in the Kakao console —
  // never assume it's there, and never let a script callback throw.
  function safeLoadAndInit() {
    try {
      window.kakao?.maps?.load(initMap);
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

  // Keep the marker in sync when selection changes from outside (search
  // result click, address geocode fallback) rather than a direct map click.
  useEffect(() => {
    if (!sdkReady || !selected) return;
    moveMarker(selected.latitude, selected.longitude, true);
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
        moveMarker(latitude, longitude, true);
        reverseGeocode(latitude, longitude);
      },
      () => { setLocating(false); setMapError(t("errors.locateFailed")); },
      { timeout: 8000 }
    );
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
        id="kakao-maps-sdk"
        src={`https://dapi.kakao.com/v2/maps/sdk.js?appkey=${jsKey}&autoload=false&libraries=services`}
        strategy="afterInteractive"
        onLoad={safeLoadAndInit}
        onError={() => setMapError(t("errors.sdkLoadFailed"))}
      />
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
