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

// Google Maps API Key from environment or provisioned Maps key
const GOOGLE_MAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || 'AIzaSyB9pAU6h7_1zk9j7hEWdhcwmwQA80Ep0ZE';

// Comprehensive Tricity POI spatial index (Hotels, Hospitals, Markets, Homes/Societies, Gardens, Institutions)
const KNOWN_LANDMARKS = [
  // --- HOTELS ---
  { name: 'JW Marriott Hotel, Sector 35, Chandigarh', lat: 30.724514, lng: 76.764124 },
  { name: 'Hotel Mountview, Sector 10, Chandigarh', lat: 30.751514, lng: 76.789124 },
  { name: 'Taj Chandigarh, Sector 17, Chandigarh', lat: 30.741214, lng: 76.783514 },
  { name: 'Hyatt Regency, Industrial Area Phase 1, Chandigarh', lat: 30.707514, lng: 76.802514 },
  { name: 'Radisson RED, Sector 66, Mohali', lat: 30.689514, lng: 76.738514 },
  { name: 'The Lalit, Rajiv Gandhi IT Park, Chandigarh', lat: 30.728514, lng: 76.845514 },
  { name: 'Hotel Shivalikview, Sector 17, Chandigarh', lat: 30.738514, lng: 76.780514 },
  { name: 'Hotel Maya, Sector 35B, Chandigarh', lat: 30.723514, lng: 76.765514 },
  { name: 'Hotel Aroma, Sector 22C, Chandigarh', lat: 30.732814, lng: 76.772514 },
  { name: 'Hotel Western Court, Sector 43, Chandigarh', lat: 30.721514, lng: 76.746514 },
  { name: 'Hotel Suraj & Restaurant, Sector 22, Chandigarh', lat: 30.732814, lng: 76.772514 },
  { name: 'Hotel Paradise, Sector 7C, Chandigarh', lat: 30.732514, lng: 76.804514 },
  { name: 'Hotel Paradise, Sector 22, Chandigarh', lat: 30.731514, lng: 76.772124 },
  { name: 'Hotel Paradise, Sector 52, Chandigarh', lat: 30.718514, lng: 76.726514 },
  { name: 'Holiday Inn, Sector 3, Panchkula', lat: 30.701514, lng: 76.842514 },
  { name: 'The Bella Vista, Sector 5, Panchkula', lat: 30.698514, lng: 76.854514 },
  { name: 'Park Plaza, Ambala-Chandigarh Highway, Zirakpur', lat: 30.642514, lng: 76.822514 },
  { name: 'Ramada Plaza, VIP Road, Zirakpur', lat: 30.645514, lng: 76.818514 },

  // --- HOSPITALS ---
  { name: 'Fortis Hospital, Phase 8, Mohali', lat: 30.712514, lng: 76.734124 },
  { name: 'Max Super Speciality Hospital, Phase 6, Mohali', lat: 30.732145, lng: 76.708234 },
  { name: 'PGIMER (Post Graduate Institute), Sector 12, Chandigarh', lat: 30.763514, lng: 76.776514 },
  { name: 'GMSH (Govt Multi Speciality Hospital), Sector 16, Chandigarh', lat: 30.748514, lng: 76.782514 },
  { name: 'GMCH-32 (Govt Medical College Hospital), Sector 32, Chandigarh', lat: 30.712514, lng: 76.778514 },
  { name: 'Civil Hospital, Sector 6, Panchkula', lat: 30.712214, lng: 76.852514 },
  { name: 'Ivy Hospital, Sector 71, Mohali', lat: 30.708914, lng: 76.709214 },
  { name: 'Sohana Hospital, Sector 77, Mohali', lat: 30.682514, lng: 76.714514 },
  { name: 'Alchemist Hospital, Sector 21, Panchkula', lat: 30.665514, lng: 76.872514 },
  { name: 'Ojas Hospital, Sector 26, Panchkula', lat: 30.661514, lng: 76.878514 },
  { name: 'Grecian Super Speciality Hospital, Sector 69, Mohali', lat: 30.704214, lng: 76.710514 },
  { name: 'Paras Hospital, Sector 22, Panchkula', lat: 30.668514, lng: 76.874514 },
  { name: 'Amar Hospital, Sector 70, Mohali', lat: 30.703514, lng: 76.716514 },
  { name: 'Cloudnine Hospital, Sector 43, Chandigarh', lat: 30.723514, lng: 76.744514 },
  { name: 'Eden Hospital, Industrial Area Phase 1, Chandigarh', lat: 30.708514, lng: 76.804514 },
  { name: 'Dhawan Hospital, Sector 7, Panchkula', lat: 30.706433, lng: 76.845153 },

  // --- MARKETS ---
  { name: 'Sector 17 Plaza & Shopping Center, Chandigarh', lat: 30.739834, lng: 76.782702 },
  { name: 'Phase 7 Food Street & Main Market, Mohali', lat: 30.710412, lng: 76.721415 },
  { name: 'Phase 3B2 Market & Food Hub, Mohali', lat: 30.718912, lng: 76.711245 },
  { name: 'Sector 22 Shastri Market, Chandigarh', lat: 30.731514, lng: 76.772124 },
  { name: 'Sector 35 Commercial Market, Chandigarh', lat: 30.724514, lng: 76.764124 },
  { name: 'Sector 70 Market, Mohali', lat: 30.704649, lng: 76.717873 },
  { name: 'Sector 7 Market, Panchkula', lat: 30.706433, lng: 76.845153 },
  { name: 'Sector 8 Market, Panchkula', lat: 30.699814, lng: 76.848814 },
  { name: 'Sector 9 Market, Panchkula', lat: 30.708814, lng: 76.859814 },
  { name: 'Sector 10 Market, Panchkula', lat: 30.693514, lng: 76.858514 },
  { name: 'Sector 11 Market, Panchkula', lat: 30.689514, lng: 76.861124 },
  { name: 'Sector 15 Market, Chandigarh', lat: 30.754514, lng: 76.774124 },
  { name: 'Sector 19 Sadar Bazar & Market, Chandigarh', lat: 30.731514, lng: 76.796124 },
  { name: 'Phase 5 Market, Mohali', lat: 30.722415, lng: 76.718214 },
  { name: 'Phase 10 Market, Mohali', lat: 30.691214, lng: 76.731124 },
  { name: 'Phase 11 Market, Mohali', lat: 30.684514, lng: 76.724124 },
  { name: 'Dhakoli Main Market & Housing Board, Zirakpur', lat: 30.638514, lng: 76.842514 },
  { name: 'VIP Road Commercial Hub, Zirakpur', lat: 30.642514, lng: 76.818124 },
  { name: 'Cosmo Mall & Market, Zirakpur', lat: 30.645514, lng: 76.822124 },
  { name: 'Elante Mall, Phase 1, Chandigarh', lat: 30.705514, lng: 76.801124 },
  { name: 'VR Punjab Mall, Kharar Road, Mohali', lat: 30.748231, lng: 76.689241 },
  { name: 'CP67 Mall, Sector 67, Mohali', lat: 30.695214, lng: 76.718912 },
  { name: 'Bestech Square Mall, Sector 66, Mohali', lat: 30.690514, lng: 76.736124 },

  // --- HOMES & RESIDENTIAL SOCIETIES ---
  { name: 'Apple Heights, Dhakoli, Zirakpur', lat: 30.635814, lng: 76.848214 },
  { name: 'Cozy Homes, Dhakoli, Zirakpur', lat: 30.636814, lng: 76.844514 },
  { name: 'Cozy Homes, Sector 126 Kharar Road, Mohali', lat: 30.749124, lng: 76.654124 },
  { name: 'Motia City, Dhakoli, Zirakpur', lat: 30.637214, lng: 76.843114 },
  { name: 'Motia Blue Ridge, Dhakoli, Zirakpur', lat: 30.638914, lng: 76.845814 },
  { name: 'Motia Guild, Dhakoli, Zirakpur', lat: 30.636114, lng: 76.842214 },
  { name: 'Savitri Greens, Gazipur Road, Zirakpur', lat: 30.632514, lng: 76.834124 },
  { name: 'Savitri Greens 2, Gazipur Road, Zirakpur', lat: 30.628514, lng: 76.836514 },
  { name: 'Maya Garden City, Gazipur Road, Zirakpur', lat: 30.635514, lng: 76.838514 },
  { name: 'Maya Garden Phase 1, Dhakoli, Zirakpur', lat: 30.634814, lng: 76.840214 },
  { name: 'Maya Garden Phase 2, Dhakoli, Zirakpur', lat: 30.633914, lng: 76.841114 },
  { name: 'Maya Garden Avenue, Dhakoli, Zirakpur', lat: 30.634124, lng: 76.839124 },
  { name: 'Maya Garden Magnesia, Dhakoli, Zirakpur', lat: 30.631214, lng: 76.841514 },
  { name: 'Green Valley Enclave, Dhakoli, Zirakpur', lat: 30.639514, lng: 76.844214 },
  { name: 'Green Enclave, Dhakoli, Zirakpur', lat: 30.641514, lng: 76.839514 },
  { name: 'Gulmohar City, Dhakoli, Zirakpur', lat: 30.638214, lng: 76.847514 },
  { name: 'Gulmohar City Heights, Dhakoli, Zirakpur', lat: 30.637514, lng: 76.848114 },
  { name: 'Gulmohar Trends, Dhakoli, Zirakpur', lat: 30.639114, lng: 76.846514 },
  { name: 'MS Enclave, Dhakoli, Zirakpur', lat: 30.640214, lng: 76.841214 },
  { name: 'Platinum Homes, Old Ambala Road, Zirakpur', lat: 30.651514, lng: 76.848514 },
  { name: 'Sanskriti Enclave, Dhakoli, Zirakpur', lat: 30.639514, lng: 76.848514 },
  { name: 'Anand Complex, Dhakoli, Zirakpur', lat: 30.638514, lng: 76.844114 },
  { name: 'Panchkula Heights, Dhakoli, Zirakpur', lat: 30.633114, lng: 76.850514 },
  { name: 'Ghuman Nagar, Dhakoli, Zirakpur', lat: 30.639214, lng: 76.841514 },
  { name: 'Maple Apartments, Dhakoli, Zirakpur', lat: 30.636514, lng: 76.846214 },
  { name: 'Fortune Classic, Dhakoli, Zirakpur', lat: 30.638814, lng: 76.843514 },
  { name: 'Hermitage Park, Dhakoli, Zirakpur', lat: 30.641214, lng: 76.845214 },
  { name: 'Shri Balaji Enclave, Dhakoli, Zirakpur', lat: 30.639814, lng: 76.842814 },
  { name: 'Penta Homes, Dhakoli, Zirakpur', lat: 30.642114, lng: 76.838914 },
  { name: 'Sushma Urban Views, Dhakoli, Zirakpur', lat: 30.635214, lng: 76.845514 },
  { name: 'Sushma Crescent, Dhakoli, Zirakpur', lat: 30.633514, lng: 76.847214 },
  { name: 'Highland Park, Dhakoli, Zirakpur', lat: 30.643214, lng: 76.846114 },
  { name: 'Royal Mansion, Dhakoli, Zirakpur', lat: 30.640814, lng: 76.847814 },
  { name: 'Victoria Heights, Dhakoli, Zirakpur', lat: 30.634214, lng: 76.852114 },
  { name: 'Aastha Apartments, Dhakoli, Zirakpur', lat: 30.637814, lng: 76.841914 },
  { name: 'Paras Panorama, Dhakoli, Zirakpur', lat: 30.642514, lng: 76.843814 },
  { name: 'Shree Vardhman Green Space, Dhakoli, Zirakpur', lat: 30.631814, lng: 76.846514 },
  { name: 'Golden Sand Apartments, Dhakoli, Zirakpur', lat: 30.636214, lng: 76.849514 },
  { name: 'Skynet Enclave, Dhakoli, Zirakpur', lat: 30.641814, lng: 76.840514 },
  { name: 'Imperial Apartments, Dhakoli, Zirakpur', lat: 30.638514, lng: 76.849814 },
  { name: 'Modern Housing Complex (MHC), Mani Majra', lat: 30.718514, lng: 76.838514 },
  { name: 'Homeland Heights, Sector 70, Mohali', lat: 30.702514, lng: 76.719514 },
  { name: 'Jal Vayu Vihar, Sector 67, Mohali', lat: 30.697514, lng: 76.721514 },
  { name: 'JLPL Falcon View, Sector 66, Mohali', lat: 30.688514, lng: 76.734514 },
  { name: 'Wave Estate, Sector 85, Mohali', lat: 30.672514, lng: 76.715514 },
  { name: 'Sunny Enclave, Kharar, Mohali', lat: 30.752514, lng: 76.662514 },
  { name: 'Gillco Valley, Kharar, Mohali', lat: 30.758514, lng: 76.658514 },

  // --- GARDENS & PARKS ---
  { name: 'Zakir Hussain Rose Garden, Sector 16, Chandigarh', lat: 30.746514, lng: 76.781514 },
  { name: 'Rock Garden of Chandigarh, Sector 1', lat: 30.752514, lng: 76.806514 },
  { name: 'Sukhna Lake Promenade & Garden, Sector 1', lat: 30.742514, lng: 76.818514 },
  { name: 'Japanese Garden, Sector 31, Chandigarh', lat: 30.712514, lng: 76.772514 },
  { name: 'Terraced Garden, Sector 33, Chandigarh', lat: 30.718514, lng: 76.768514 },
  { name: 'Bougainvillea Garden, Sector 3, Chandigarh', lat: 30.756514, lng: 76.798514 },
  { name: 'Garden of Fragrance, Sector 36, Chandigarh', lat: 30.728514, lng: 76.754514 },
  { name: 'Shanti Kunj Park, Sector 16, Chandigarh', lat: 30.744514, lng: 76.784514 },
  { name: 'Topiary Park, Sector 35, Chandigarh', lat: 30.726514, lng: 76.761514 },
  { name: 'Butterfly Park, Sector 26, Chandigarh', lat: 30.731514, lng: 76.808514 },
  { name: 'Silvi Park, Phase 10, Mohali', lat: 30.693514, lng: 76.733514 },
  { name: 'Town Park, Sector 5, Panchkula', lat: 30.697514, lng: 76.855124 },
  { name: 'National Cactus & Succulent Botanical Garden, Sector 5, Panchkula', lat: 30.695514, lng: 76.858514 },
  { name: 'Pinjore Heritage Garden (Yadavindra Gardens)', lat: 30.796514, lng: 76.915514 },
  { name: 'Leisure Valley, Sector 10, Chandigarh', lat: 30.754514, lng: 76.792514 },

  // --- INSTITUTIONS ---
  { name: 'Panjab University (PU Campus), Sector 14, Chandigarh', lat: 30.759514, lng: 76.768124 },
  { name: 'PEC University of Technology, Sector 12, Chandigarh', lat: 30.766514, lng: 76.778514 },
  { name: 'PGGC (Post Graduate Govt College), Sector 11, Chandigarh', lat: 30.756514, lng: 76.781514 },
  { name: 'MCM DAV College for Women, Sector 36, Chandigarh', lat: 30.731514, lng: 76.751514 },
  { name: 'DAV College, Sector 10, Chandigarh', lat: 30.752514, lng: 76.787514 },
  { name: 'GGDSD College, Sector 32, Chandigarh', lat: 30.715514, lng: 76.776514 },
  { name: 'Indian School of Business (ISB), Sector 81, Mohali', lat: 30.655514, lng: 76.728514 },
  { name: 'IISER (Indian Institute of Science Education), Sector 81, Mohali', lat: 30.659514, lng: 76.732514 },
  { name: 'NIPER, Sector 67, Mohali', lat: 30.691514, lng: 76.724514 },
  { name: 'NABI (National Agri-Food Biotechnology Inst.), Sector 81, Mohali', lat: 30.662514, lng: 76.735514 },
  { name: 'Plaksha University, Sector 101 IT City, Mohali', lat: 30.642514, lng: 76.748514 },
  { name: 'Amity University, Sector 82A, Mohali', lat: 30.651514, lng: 76.741514 },
  { name: 'CCET (Chandigarh College of Engg. & Tech.), Sector 26, Chandigarh', lat: 30.727514, lng: 76.806514 },
  { name: 'Chandigarh University (CU), NH 21, Gharuan', lat: 30.768514, lng: 76.575514 },
  { name: 'Chitkara University, Chandigarh-Patiala National Highway', lat: 30.516514, lng: 76.659514 },
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

  // Find the most descriptive result: prefer establishments, hospitals, hotels, markets, institutions, parks, premises
  const establishmentResult = data.results.find((r: any) =>
    r.types?.some((t: string) =>
      [
        'establishment',
        'point_of_interest',
        'premise',
        'subpremise',
        'shopping_mall',
        'hospital',
        'lodging',
        'hotel',
        'school',
        'university',
        'college',
        'park',
        'market',
        'stadium',
        'museum',
        'place_of_worship',
        'transit_station',
      ].includes(t)
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

  if (establishmentResult && Array.isArray(establishmentResult.address_components)) {
    for (const comp of establishmentResult.address_components) {
      const types = comp.types || [];
      if (types.includes('point_of_interest') || types.includes('establishment') || types.includes('premise') || types.includes('hospital') || types.includes('lodging') || types.includes('school')) {
        if (!placeName) placeName = comp.long_name;
      }
    }
  }

  if (Array.isArray(bestResult.address_components)) {
    for (const comp of bestResult.address_components) {
      const types = comp.types || [];
      if (!placeName && (types.includes('point_of_interest') || types.includes('establishment') || types.includes('premise') || types.includes('hospital') || types.includes('lodging') || types.includes('school'))) {
        placeName = comp.long_name;
      }
      if (types.includes('street_number')) streetNumber = comp.long_name;
      if (types.includes('route')) route = comp.long_name;
      if (types.includes('sublocality_level_1') || types.includes('sublocality') || types.includes('neighborhood')) {
        if (!sublocality) sublocality = comp.long_name;
      }
      if (types.includes('locality')) locality = comp.long_name;
      if (types.includes('administrative_area_level_2')) city = comp.long_name;
      if (types.includes('postal_code')) postalCode = comp.long_name;
    }
  }

  // If placeName is still empty, derive from formatted_address first segment if it looks like a specific place/building/hospital/hotel/market/institution
  const rawFormatted = (bestResult.formatted_address || '').replace(/, India$/, '').trim();
  const firstSegment = rawFormatted.split(',')[0]?.trim() || '';
  if (!placeName && firstSegment && !/^\d+/.test(firstSegment) && firstSegment.length > 2) {
    placeName = firstSegment;
  }

  const street = [streetNumber, route].filter(Boolean).join(' ');
  const finalCity = locality || city || 'Chandigarh';

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
  if (!fullAddress || fullAddress.length < 5) {
    fullAddress = rawFormatted;
  }

  return {
    fullAddress: fullAddress || rawFormatted || 'Selected Location',
    placeName: placeName || firstSegment || undefined,
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

  // 1. Primary: Backend Reverse Geocoding Proxy Route (uses Google Maps API key & multi-source discovery)
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

  // 2. Secondary Client Direct: Google Maps Geocoding API if key is available
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

  // 3. Check if user is near a recognized Hotel, Hospital, Market, Home/Society, Garden, or Institution (< 260m)
  let closestPoi: { name: string; dist: number } | null = null;
  for (const loc of KNOWN_LANDMARKS) {
    const distMeters = calculateRoadDistanceKm(lat, lng, loc.lat, loc.lng) * 1000;
    if (!closestPoi || distMeters < closestPoi.dist) {
      closestPoi = { name: loc.name, dist: distMeters };
    }
  }

  if (closestPoi && closestPoi.dist <= 260) {
    const cleanName = closestPoi.name.replace(/^near\s+/i, '').trim();
    const res: GeocodedAddressResult = {
      fullAddress: cleanName,
      placeName: cleanName.split(',')[0].trim(),
      locality: cleanName.split(',')[1]?.trim(),
      city: cleanName.split(',')[2]?.trim() || 'Chandigarh Tricity',
    };
    geocodeCache.set(cacheKey, res);
    return res;
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
    const cleanName = closest.name.replace(/^near\s+/i, '').trim();
    if (closest.dist <= 600) {
      return cleanName;
    }
    const parts = cleanName.split(',');
    if (parts.length >= 2) {
      return `${parts[parts.length - 2].trim()}, ${parts[parts.length - 1].trim()}`;
    }
    return cleanName;
  }

  return 'Location unavailable';
}

