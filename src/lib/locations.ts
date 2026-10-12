export type District = { name: string; lat: number; lng: number };
export const LOCATIONS: Record<string, Record<string, District[]>> = {
  India: {
    "West Bengal": [
      { name: "Kolkata", lat: 22.5726, lng: 88.3639 },
      { name: "Howrah", lat: 22.5958, lng: 88.2636 },
      { name: "Darjeeling", lat: 27.041, lng: 88.2663 },
    ],
    Maharashtra: [
      { name: "Mumbai", lat: 19.076, lng: 72.8777 },
      { name: "Pune", lat: 18.5204, lng: 73.8567 },
      { name: "Nagpur", lat: 21.1458, lng: 79.0882 },
    ],
    Delhi: [{ name: "New Delhi", lat: 28.6139, lng: 77.209 }],
    Karnataka: [
      { name: "Bengaluru", lat: 12.9716, lng: 77.5946 },
      { name: "Mysuru", lat: 12.2958, lng: 76.6394 },
    ],
    "Tamil Nadu": [
      { name: "Chennai", lat: 13.0827, lng: 80.2707 },
      { name: "Coimbatore", lat: 11.0168, lng: 76.9558 },
    ],
    "Uttar Pradesh": [
      { name: "Lucknow", lat: 26.8467, lng: 80.9462 },
      { name: "Varanasi", lat: 25.3176, lng: 82.9739 },
    ],
    Telangana: [{ name: "Hyderabad", lat: 17.385, lng: 78.4867 }],
    Gujarat: [
      { name: "Ahmedabad", lat: 23.0225, lng: 72.5714 },
      { name: "Surat", lat: 21.1702, lng: 72.8311 },
    ],
  },
};

export function findDistrict(country?: string | null, state?: string | null, district?: string | null) {
  if (!country || !state || !district) return undefined;
  return LOCATIONS[country]?.[state]?.find((d) => d.name === district);
}

export function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371, toR = Math.PI / 180;
  const dLat = (b.lat - a.lat) * toR, dLng = (b.lng - a.lng) * toR;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * toR) * Math.cos(b.lat * toR) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Current location must be within this radius of the district centre to count as "same city". */
export const CITY_RADIUS_KM = 40;
/** Authority must be this close to the issue to upload the resolution photo. */
export const SPOT_RADIUS_KM = 0.3;

export function getPosition(): Promise<{ lat: number; lng: number }> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error("Location is not supported on this device"));
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => reject(new Error("Please allow location access to continue")),
      { enableHighAccuracy: true, timeout: 15000 },
    );
  });
}

export const STATES = ["Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh", "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka", "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal", "Andaman and Nicobar Islands", "Chandigarh", "Dadra and Nagar Haveli and Daman and Diu", "Delhi", "Jammu and Kashmir", "Ladakh", "Lakshadweep", "Puducherry"];

/** Looks up the city/town name and state for a GPS position. */
export async function reverseGeocode(pos: { lat: number; lng: number }): Promise<{ city: string; state: string } | null> {
  try {
    const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=10&lat=${pos.lat}&lon=${pos.lng}`);
    if (!r.ok) return null;
    const a = (await r.json()).address ?? {};
    const city = a.city || a.town || a.village || a.city_district || a.county || a.state_district || "";
    return { city, state: a.state || "" };
  } catch { return null; }
}
const norm = (x: string) => x.toLowerCase().replace(/&/g, "and").replace(/[^a-z]/g, "");
export const sameState = (a: string, b: string) => !!a && !!b && (norm(a) === norm(b) || norm(a).includes(norm(b)) || norm(b).includes(norm(a)));
