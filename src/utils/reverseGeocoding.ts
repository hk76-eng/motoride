import { calculateRoadDistanceKm } from './distanceCalculator';
import { getApiUrl } from './apiUrl';

export interface GeocodedAddressResult {
  fullAddress: string;
  placeName?: string;
  street?: string;
  locality?: string;
  city?: string;
  postalCode?: string;
  isFallback?: boolean;
}

const geocodeCache = new Map<string, GeocodedAddressResult>();

// Google Maps API Key from environment
const GOOGLE_MAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';

// Local known Tricity landmarks for ultra-fast matching if within 140m
const KNOWN_LANDMARKS = [
  { name: 'Apple Heights, Dhakoli, Zirakpur', lat: 30.635814, lng: 76.848214 },
  { name: 'Cozy Homes, Dhakoli, Zirakpur', lat: 30.636814, lng: 76.844514 },
  { name: 'Motia City, Dhakoli, Zirakpur', lat: 30.637214, lng: 76.843114 },
  { name: 'Motia Blue Ridge, Dhakoli, Zirakpur', lat: 30.638914, lng: 76.845814 },
  { name: 'Savitri Greens, Gazipur Road, Zirakpur', lat: 30.632514, lng: 76.834124 },
  { name: 'Savitri Greens 2, Gazipur Road, Zirakpur', lat: 30.628514, lng: 76.836514 },
  { name: 'Maya Garden City, Gazipur Road, Zirakpur', lat: 30.635514, lng: 76.838514 },
  { name: 'Maya Garden Phase 1, Dhakoli, Zirakpur', lat: 30.634814, lng: 76.840214 },
  { name: 'Green Enclave, Dhakoli, Zirakpur', lat: 30.641514, lng: 76.839514 },
  { name: 'Gulmohar City, Dhakoli, Zirakpur', lat: 30.638214, lng: 76.847514 },
  { name: 'Platinum Homes, Old Ambala Road, Zirakpur', lat: 30.651514, lng: 76.848514 },
  { name: 'Teleperformance, Sector 75, Mohali', lat: 30.701124, lng: 76.702514 },
  { name: 'Infosys Limited, IT Park, Chandigarh', lat: 30.728514, lng: 76.843124 },
  { name: 'Kishangarh Village, Chandigarh', lat: 30.732514, lng: 76.818514 },
  { name: 'Elante Mall, Phase 1, Chandigarh', lat: 30.705514, lng: 76.801124 },
  { name: 'Mani Majra & Rajiv Gandhi IT Park, Chandigarh', lat: 30.724514, lng: 76.841514 },
  { name: 'Sector 70, Mohali Market', lat: 30.704649, lng: 76.717873 },
  { name: 'Phase 8B, Industrial Area, Mohali', lat: 30.718214, lng: 76.732124 },
  { name: 'Phase 7 Food Street, Mohali', lat: 30.710412, lng: 76.721415 },
  { name: 'Phase 3B2 Market, Mohali', lat: 30.718912, lng: 76.711245 },
  { name: 'Phase 5 Market, Mohali', lat: 30.722415, lng: 76.718214 },
  { name: 'ISBT Sector 43, Chandigarh', lat: 30.722511, lng: 76.745632 },
  { name: 'ISBT Sector 17, Chandigarh', lat: 30.737514, lng: 76.780124 },
  { name: 'Sector 17 Plaza, Chandigarh', lat: 30.739834, lng: 76.782702 },
  { name: 'Sector 7 Panchkula Market', lat: 30.706433, lng: 76.845153 },
  { name: 'Sector 5 Panchkula, Town Park', lat: 30.697514, lng: 76.855124 },
  { name: 'Sector 20 Panchkula Highrise Hub', lat: 30.672514, lng: 76.868124 },
  { name: 'Kharar Bus Stand, NH 21', lat: 30.745124, lng: 76.648214 },
  { name: 'VR Punjab Mall, Kharar Road', lat: 30.748231, lng: 76.689241 },
];

/**
 * Parses Google Geocoding API response into a rich human-readable place description
 * preferring Place/Business Name, Street/Road, Area/Locality, City, and Postal Code.
 */
function parseGoogleGeocodeResult(data: any): GeocodedAddressResult | null {
  if (!data || data.status !== 'OK' || !Array.isArray(data.results) || data.results.length === 0) {
    if (data?.status === 'REQUEST_DENIED') {
      console.warn(
        '⚠️ Google Maps Geocoding API: REQUEST_DENIED. Please ensure the Geocoding API is enabled on your Google Cloud Console project.',
        data.error_message || ''
      );
    } else if (data?.status === 'OVER_QUERY_LIMIT') {
      console.warn('⚠️ Google Maps Geocoding API: Quota reached (OVER_QUERY_LIMIT).');
    }
    return null;
  }

  // Find the most descriptive result: prefer establishments, points of interest, premises, or sublocalities
  const establishmentResult = data.results.find((r: any) =>
    r.types?.some((t: string) =>
      ['establishment', 'point_of_interest', 'premise', 'subpremise', 'shopping_mall', 'hospital', 'transit_station', 'park', 'lodging'].includes(t)
    )
  );

  const sublocalityResult = data.results.find((r: any) =>
    r.types?.some((t: string) => ['sublocality_level_1', 'sublocality_level_2', 'neighborhood', 'route'].includes(t))
  );

  const bestResult = establishmentResult || sublocalityResult || data.results[0];

  let placeName = '';
  let streetNumber = '';
  let route = '';
  let sublocality = '';
  let locality = '';
  let city = '';
  let postalCode = '';

  // Extract components from all results to ensure we have the best POI name
  if (establishmentResult && Array.isArray(establishmentResult.address_components)) {
    for (const comp of establishmentResult.address_components) {
      const types = comp.types || [];
      if (types.includes('point_of_interest') || types.includes('establishment') || types.includes('premise')) {
        placeName = comp.long_name;
        break;
      }
    }
  }

  if (Array.isArray(bestResult.address_components)) {
    for (const comp of bestResult.address_components) {
      const types = comp.types || [];
      if (!placeName && (types.includes('point_of_interest') || types.includes('establishment') || types.includes('premise'))) {
        placeName = comp.long_name;
      }
      if (types.includes('street_number')) {
        streetNumber = comp.long_name;
      }
      if (types.includes('route')) {
        route = comp.long_name;
      }
      if (types.includes('sublocality_level_1') || types.includes('sublocality') || types.includes('neighborhood')) {
        if (!sublocality) sublocality = comp.long_name;
      }
      if (types.includes('locality')) {
        locality = comp.long_name;
      }
      if (types.includes('administrative_area_level_2')) {
        city = comp.long_name;
      }
      if (types.includes('postal_code')) {
        postalCode = comp.long_name;
      }
    }
  }

  const street = [streetNumber, route].filter(Boolean).join(' ');
  const finalCity = locality || city || 'Chandigarh';

  // Construct best human-readable full address string
  // Priority order: Place Name -> Street/Road -> Area/Locality -> City -> Postal Code
  const parts: string[] = [];

  if (placeName && !parts.includes(placeName)) {
    parts.push(placeName);
  }
  if (street && !parts.some((p) => p.toLowerCase().includes(street.toLowerCase()))) {
    parts.push(street);
  }
  if (sublocality && !parts.some((p) => p.toLowerCase().includes(sublocality.toLowerCase()))) {
    parts.push(sublocality);
  }
  if (finalCity && !parts.some((p) => p.toLowerCase().includes(finalCity.toLowerCase()))) {
    parts.push(finalCity);
  }
  if (postalCode && !parts.some((p) => p.includes(postalCode))) {
    parts.push(postalCode);
  }

  let fullAddress = parts.join(', ');

  // If component assembly produced empty or too short string, use formatted_address cleaned up
  if (!fullAddress || fullAddress.length < 5) {
    if (bestResult.formatted_address) {
      // Remove trailing ", India" for cleaner local readability
      fullAddress = bestResult.formatted_address.replace(/, India$/, '').trim();
    }
  }

  return {
    fullAddress: fullAddress || 'Selected Location',
    placeName: placeName || undefined,
    street: street || undefined,
    locality: sublocality || undefined,
    city: finalCity || undefined,
    postalCode: postalCode || undefined,
  };
}

/**
 * Reverse geocodes latitude/longitude coordinates into a rich, human-readable place description.
 * Adheres strictly to requirements:
 * 1. Uses Google Maps reverse geocoding with project API key.
 * 2. Proxies through backend `/api/motoride/geocode/reverse` for resilience.
 * 3. Never displays raw lat/long coordinates.
 * 4. Includes Place/Business Name, Street/Road, Area/Locality, City, and Postal Code where available.
 * 5. Caches results to prevent redundant API hits.
 */
export async function reverseGeocodeCoordinates(
  lat: number,
  lng: number,
  signal?: AbortSignal
): Promise<GeocodedAddressResult> {
  if (!lat || !lng || isNaN(lat) || isNaN(lng) || (lat === 0 && lng === 0)) {
    return { fullAddress: 'Selected Location', isFallback: true };
  }

  const cacheKey = `${lat.toFixed(5)},${lng.toFixed(5)}`;
  const cached = geocodeCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  // 1. Check if user is right on a known Tricity society/landmark (< 140m)
  for (const loc of KNOWN_LANDMARKS) {
    const distMeters = calculateRoadDistanceKm(lat, lng, loc.lat, loc.lng) * 1000;
    if (distMeters <= 140) {
      const res: GeocodedAddressResult = {
        fullAddress: loc.name,
        placeName: loc.name.split(',')[0].trim(),
        locality: loc.name.split(',')[1]?.trim(),
        city: loc.name.split(',')[2]?.trim() || 'Chandigarh Tricity',
      };
      geocodeCache.set(cacheKey, res);
      return res;
    }
  }

  // 2. Secondary/Server: Backend Reverse Geocoding Proxy Route (uses server-side Google Maps API key)
  try {
    const serverUrl = getApiUrl(`/api/motoride/geocode/reverse?lat=${lat}&lng=${lng}`);
    const res = await fetch(serverUrl, { signal: signal || AbortSignal.timeout(3500) });
    if (res.ok) {
      const text = await res.text();
      if (text && !text.trim().startsWith('<') && !text.trim().startsWith('The page')) {
        const data = JSON.parse(text);
        if (data && (data.address || data.name)) {
          const rawAddress = (data.address || data.name || '').replace(/^near\s+/i, '').trim();
          // Filter out raw coordinate strings
          if (
            rawAddress &&
            !rawAddress.toLowerCase().includes('pin point') &&
            !rawAddress.startsWith('Location (') &&
            !/^\s*-?\d+\.\d+\s*,\s*-?\d+\.\d+\s*$/.test(rawAddress)
          ) {
            const rawPlace = (data.name || rawAddress.split(',')[0] || '').replace(/^near\s+/i, '').trim();
            const result: GeocodedAddressResult = {
              fullAddress: rawAddress,
              placeName: rawPlace || undefined,
              locality: data.locality || undefined,
              city: data.city || undefined,
              postalCode: data.postal_code || undefined,
            };
            geocodeCache.set(cacheKey, result);
            return result;
          }
        }
      }
    }
  } catch (err: any) {
    if (err.name !== 'AbortError') {
      console.warn('Backend geocoding proxy note:', err.message);
    }
  }

  // 3. Primary Client Direct: Google Maps Geocoding API if key is available
  if (GOOGLE_MAPS_KEY) {
    try {
      const gUrl = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${GOOGLE_MAPS_KEY}&region=in&language=en`;
      const gResponse = await fetch(gUrl, { signal: signal || AbortSignal.timeout(3000) });
      if (gResponse.ok) {
        const gData = await gResponse.json();
        const parsed = parseGoogleGeocodeResult(gData);
        if (parsed && parsed.fullAddress) {
          geocodeCache.set(cacheKey, parsed);
          return parsed;
        }
      }
    } catch (gErr: any) {
      if (gErr.name !== 'AbortError') {
        console.warn('Google Maps client reverse geocoding note:', gErr.message);
      }
    }
  }

  // 4. Graceful Fallback to nearest Tricity area centroid without crashing
  const nearest = findNearestTricityArea(lat, lng);
  const fallbackResult: GeocodedAddressResult = {
    fullAddress: nearest,
    locality: nearest,
    isFallback: true,
  };
  geocodeCache.set(cacheKey, fallbackResult);
  return fallbackResult;
}

function findNearestTricityArea(lat: number, lng: number): string {
  let closest: { name: string; dist: number } | null = null;
  for (const loc of KNOWN_LANDMARKS) {
    const dist = calculateRoadDistanceKm(lat, lng, loc.lat, loc.lng) * 1000;
    if (!closest || dist < closest.dist) {
      closest = { name: loc.name, dist };
    }
  }

  if (closest) {
    return closest.name.replace(/^near\s+/i, '').trim();
  }

  return 'Location unavailable';
}

