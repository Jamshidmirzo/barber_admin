/**
 * Shared map-pick helpers for the two location pickers (Kakao for Korea,
 * Yandex for Uzbekistan).
 *
 * The important rule encoded here: a map click is always a valid pick. The
 * coordinates come from the map itself and are correct even when the
 * provider's reverse geocoder is unreachable, misconfigured, or simply has
 * no address for that point — so a pick must never be dropped just because
 * the address lookup failed.
 */

export interface PickedPlace {
  place_name: string;
  address_name: string;
  road_address_name: string | null;
  phone: string | null;
  latitude: number;
  longitude: number;
  /** City/region, when the geocoder gave us a structured one (not always available). */
  city?: string | null;
}

/** Human-readable stand-in for an address we couldn't resolve. */
export function coordsLabel(lat: number, lng: number): string {
  return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
}

/**
 * What a reverse geocoder gave us. Every field is optional — the whole point
 * is to still produce a usable pick when it gave us nothing at all.
 */
export interface ResolvedAddress {
  address?: string | null;
  roadAddress?: string | null;
  city?: string | null;
}

/**
 * Build the pick to hand to the parent form. Pass `resolved` as null (or with
 * empty fields) when the lookup failed: the place then carries the
 * coordinates as its address, which keeps the selection — and the submit
 * button — alive.
 */
export function buildPickedPlace(
  lat: number,
  lng: number,
  resolved: ResolvedAddress | null,
  fallbackName: string
): PickedPlace {
  const road = resolved?.roadAddress || null;
  const address = resolved?.address || "";
  return {
    place_name: road || address || fallbackName,
    address_name: address || road || coordsLabel(lat, lng),
    road_address_name: road,
    phone: null,
    latitude: lat,
    longitude: lng,
    city: resolved?.city ?? null,
  };
}

/**
 * True when the pick carries no resolved address — i.e. `buildPickedPlace`
 * fell back to the coordinate label. Callers use this to decide whether an
 * address still has to come from the user.
 */
export function isCoordsOnly(place: PickedPlace): boolean {
  return !place.road_address_name &&
    place.address_name === coordsLabel(place.latitude, place.longitude);
}
