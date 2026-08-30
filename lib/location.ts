import * as Location from 'expo-location';

/**
 * Post-time location capture. A post IS a completed quest, and the fact line wants the
 * neighbourhood it happened in ("SHOREDITCH"). We take the device's current position at compose
 * time and reverse-geocode it to a short area name — a reasonable proxy for "where I did this",
 * captured opt-in (the author taps to add it; permission may be denied and that's fine).
 *
 * `pickNeighbourhood` is pure so Jest can prove the field-preference without a device or a
 * geocoder; `captureLocation` is the thin permission + GPS + reverse-geocode glue.
 */

export type CapturedLocation = {
  lat: number;
  lon: number;
  /** short area name for the fact line, or null when the geocoder gives nothing usable. */
  neighbourhood: string | null;
};

/**
 * Choose the best short area name from a reverse-geocode result. Prefer the most local label
 * (district / neighbourhood) and fall back outward toward the city, so we show "Shoreditch"
 * when we can and "London" only as a last resort. Trimmed and length-capped to stay a fact-line
 * label, never prose. Returns null when nothing usable is present.
 */
export function pickNeighbourhood(
  addresses: Pick<Location.LocationGeocodedAddress, 'district' | 'subregion' | 'city' | 'name'>[],
): string | null {
  const a = addresses[0];
  if (!a) return null;
  const candidate = a.district ?? a.subregion ?? a.city ?? a.name ?? null;
  const trimmed = candidate?.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, 60);
}

/**
 * Just the device coordinates — for the "nearby" feed (no reverse geocode needed, we only sort
 * by distance). Resolves to null on denial/failure so the caller can show a "needs location"
 * state instead of an error.
 */
export async function getCoords(): Promise<{ lat: number; lon: number } | null> {
  try {
    const perm = await Location.requestForegroundPermissionsAsync();
    if (!perm.granted) return null;
    const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    return { lat: pos.coords.latitude, lon: pos.coords.longitude };
  } catch {
    return null;
  }
}

/**
 * Request foreground location, read the current position, and reverse-geocode it to a
 * neighbourhood name. Resolves to null when permission is denied or anything fails — location is
 * optional, so a refusal is a quiet skip, never an error the author has to clear.
 */
export async function captureLocation(): Promise<CapturedLocation | null> {
  try {
    const perm = await Location.requestForegroundPermissionsAsync();
    if (!perm.granted) return null;

    const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    const { latitude, longitude } = pos.coords;

    let neighbourhood: string | null = null;
    try {
      neighbourhood = pickNeighbourhood(await Location.reverseGeocodeAsync({ latitude, longitude }));
    } catch {
      // A geocoder miss still leaves us with coordinates (they drive phase-2 nearby); the fact
      // line just shows "—" for the name.
    }
    return { lat: latitude, lon: longitude, neighbourhood };
  } catch {
    return null;
  }
}
