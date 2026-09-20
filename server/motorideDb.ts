import fs from 'fs';
import path from 'path';
import {
  MotorideRide,
  Captain,
  Passenger,
  Profile,
  Vehicle,
  FareSettings,
  RideChargeSettings,
  CourierChargeSettings,
  QRCodeSetting,
  WalletTransaction,
  MotorideNotification,
  RideOffer,
  AdminDashboardStats,
  RideMessage,
} from '../src/types/motoride';

// Real-time Event Broadcaster Subscribers (SSE)
type SSEClient = (data: { event: string; payload: any }) => void;
const sseClients = new Set<SSEClient>();

export function subscribeSSE(client: SSEClient) {
  sseClients.add(client);
  return () => {
    sseClients.delete(client);
  };
}

export function broadcastEvent(event: string, payload: any) {
  for (const client of sseClients) {
    try {
      client({ event, payload });
    } catch {
      sseClients.delete(client);
    }
  }
}

// 1. Initial Fare Settings & Separate Ride/Courier Configurations
const DATA_DIR = path.join(process.cwd(), 'data');
const FARE_FILE = path.join(DATA_DIR, 'fare_settings.json');

export const defaultRideCharges: RideChargeSettings = {
  base_fare: 25.0,
  per_km_rate: 12.0,
  minimum_fare: 30.0,
  platform_commission_pct: 10.0,
  min_offer_pct: 70.0,
  max_offer_pct: 180.0,
  night_surcharge_pct: 10.0,
  auto_multiplier: 1.25,
  car_multiplier: 1.8,
  cancellation_fee: 20.0,
  updated_at: new Date().toISOString(),
};

export const defaultCourierCharges: CourierChargeSettings = {
  base_fare: 35.0,
  per_km_rate: 14.0,
  minimum_fare: 40.0,
  platform_commission_pct: 12.0,
  min_offer_pct: 70.0,
  max_offer_pct: 180.0,
  handling_fee: 10.0,
  express_surcharge: 15.0,
  max_weight_kg: 15.0,
  cancellation_fee: 25.0,
  updated_at: new Date().toISOString(),
};

export let fareSettings: FareSettings = {
  base_fare: 25.0,
  per_km_rate: 12.0,
  minimum_fare: 30.0,
  platform_commission_pct: 10.0,
  min_offer_pct: 70.0,
  max_offer_pct: 180.0,
  currency_symbol: '₹',
  updated_at: new Date().toISOString(),
  ride_charges: { ...defaultRideCharges },
  courier_charges: { ...defaultCourierCharges },
};

export function saveFareSettingsToDisk() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(FARE_FILE, JSON.stringify(fareSettings, null, 2), 'utf-8');
  } catch (err) {
    console.warn('Failed to save fare settings to disk:', err);
  }
}

export function loadFareSettingsFromDisk() {
  try {
    if (fs.existsSync(FARE_FILE)) {
      const raw = fs.readFileSync(FARE_FILE, 'utf-8');
      const data = JSON.parse(raw);
      if (data && typeof data === 'object') {
        fareSettings = {
          ...fareSettings,
          ...data,
          ride_charges: {
            ...defaultRideCharges,
            ...(data.ride_charges || {}),
          },
          courier_charges: {
            ...defaultCourierCharges,
            ...(data.courier_charges || {}),
          },
        };
      }
    }
  } catch (err) {
    console.warn('Failed to load fare settings from disk:', err);
  }
}

// Automatically load persisted fare settings
loadFareSettingsFromDisk();

export function updateFareSettings(newSettings: Partial<FareSettings>): FareSettings {
  const mergedRide: RideChargeSettings = {
    ...(fareSettings.ride_charges || defaultRideCharges),
    ...(newSettings.ride_charges || {}),
  };
  if (newSettings.ride_charges) {
    if (newSettings.ride_charges.base_fare !== undefined) mergedRide.base_fare = Number(newSettings.ride_charges.base_fare);
    if (newSettings.ride_charges.per_km_rate !== undefined) mergedRide.per_km_rate = Number(newSettings.ride_charges.per_km_rate);
    if (newSettings.ride_charges.minimum_fare !== undefined) mergedRide.minimum_fare = Number(newSettings.ride_charges.minimum_fare);
    if (newSettings.ride_charges.platform_commission_pct !== undefined) mergedRide.platform_commission_pct = Number(newSettings.ride_charges.platform_commission_pct);
    if (newSettings.ride_charges.min_offer_pct !== undefined) mergedRide.min_offer_pct = Number(newSettings.ride_charges.min_offer_pct);
    if (newSettings.ride_charges.max_offer_pct !== undefined) mergedRide.max_offer_pct = Number(newSettings.ride_charges.max_offer_pct);
    if (newSettings.ride_charges.night_surcharge_pct !== undefined) mergedRide.night_surcharge_pct = Number(newSettings.ride_charges.night_surcharge_pct);
    if (newSettings.ride_charges.auto_multiplier !== undefined) mergedRide.auto_multiplier = Number(newSettings.ride_charges.auto_multiplier);
    if (newSettings.ride_charges.car_multiplier !== undefined) mergedRide.car_multiplier = Number(newSettings.ride_charges.car_multiplier);
    if (newSettings.ride_charges.cancellation_fee !== undefined) mergedRide.cancellation_fee = Number(newSettings.ride_charges.cancellation_fee);
  }

  const mergedCourier: CourierChargeSettings = {
    ...(fareSettings.courier_charges || defaultCourierCharges),
    ...(newSettings.courier_charges || {}),
  };
  if (newSettings.courier_charges) {
    if (newSettings.courier_charges.base_fare !== undefined) mergedCourier.base_fare = Number(newSettings.courier_charges.base_fare);
    if (newSettings.courier_charges.per_km_rate !== undefined) mergedCourier.per_km_rate = Number(newSettings.courier_charges.per_km_rate);
    if (newSettings.courier_charges.minimum_fare !== undefined) mergedCourier.minimum_fare = Number(newSettings.courier_charges.minimum_fare);
    if (newSettings.courier_charges.platform_commission_pct !== undefined) mergedCourier.platform_commission_pct = Number(newSettings.courier_charges.platform_commission_pct);
    if (newSettings.courier_charges.min_offer_pct !== undefined) mergedCourier.min_offer_pct = Number(newSettings.courier_charges.min_offer_pct);
    if (newSettings.courier_charges.max_offer_pct !== undefined) mergedCourier.max_offer_pct = Number(newSettings.courier_charges.max_offer_pct);
    if (newSettings.courier_charges.handling_fee !== undefined) mergedCourier.handling_fee = Number(newSettings.courier_charges.handling_fee);
    if (newSettings.courier_charges.express_surcharge !== undefined) mergedCourier.express_surcharge = Number(newSettings.courier_charges.express_surcharge);
    if (newSettings.courier_charges.max_weight_kg !== undefined) mergedCourier.max_weight_kg = Number(newSettings.courier_charges.max_weight_kg);
    if (newSettings.courier_charges.cancellation_fee !== undefined) mergedCourier.cancellation_fee = Number(newSettings.courier_charges.cancellation_fee);
  }

  fareSettings = {
    ...fareSettings,
    ...newSettings,
    base_fare: Number(newSettings.base_fare ?? mergedRide.base_fare ?? fareSettings.base_fare),
    per_km_rate: Number(newSettings.per_km_rate ?? mergedRide.per_km_rate ?? fareSettings.per_km_rate),
    minimum_fare: Number(newSettings.minimum_fare ?? mergedRide.minimum_fare ?? fareSettings.minimum_fare),
    platform_commission_pct: Number(newSettings.platform_commission_pct ?? mergedRide.platform_commission_pct ?? fareSettings.platform_commission_pct),
    min_offer_pct: Number(newSettings.min_offer_pct ?? mergedRide.min_offer_pct ?? fareSettings.min_offer_pct),
    max_offer_pct: Number(newSettings.max_offer_pct ?? mergedRide.max_offer_pct ?? fareSettings.max_offer_pct),
    ride_charges: mergedRide,
    courier_charges: mergedCourier,
    updated_at: new Date().toISOString(),
  };

  saveFareSettingsToDisk();
  broadcastEvent('FARE_SETTINGS_UPDATED', fareSettings);
  return fareSettings;
}

// 2. Official Admin QR Code & Payment Setting
export let qrSettings: QRCodeSetting = {
  qr_image_url: 'https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=upi://pay?pa=motoride.platform@upi%26pn=Motoride%20Technologies%26cu=INR',
  upi_id: 'motoride.platform@upi',
  merchant_name: 'Motoride Technologies Ltd',
  note: 'Scan using any UPI app (Google Pay, PhonePe, Paytm) to deposit platform commission or top-up driver wallet balance.',
  is_active: true,
  updated_at: new Date().toISOString(),
};

export function updateQRSettings(newSettings: Partial<QRCodeSetting>): QRCodeSetting {
  qrSettings = {
    ...qrSettings,
    ...newSettings,
    updated_at: new Date().toISOString(),
  };
  broadcastEvent('QR_SETTINGS_UPDATED', qrSettings);
  return qrSettings;
}

// 2b. Registered Accounts Store (Persists real registered passengers and captains across tabs & sessions)
export interface ServerRegisteredAccount {
  id: string;
  email: string;
  password_hash: string;
  name: string;
  role: 'passenger' | 'captain' | 'admin';
  phone?: string;
  avatar_url?: string;
  vehicle_model?: string;
  plate_number?: string;
  vehicle_type?: 'bike' | 'auto' | 'car' | 'courier';
  wallet_balance?: number;
  member_since: string;
  created_at: string;
}

export const accountsStore = new Map<string, ServerRegisteredAccount>();

// 3. Captains Catalog (Real registered captains only)
export const captainsStore = new Map<string, Captain>();

// 4. Passengers Catalog (Real registered passengers only)
export const passengersStore = new Map<string, Passenger>();

// 5. Wallets & Transactions (Starts empty for fresh accounts)
export const walletsStore = new Map<string, { balance: number; currency: string }>();

export const walletTransactionsStore: WalletTransaction[] = [];

// Persistent Disk Storage helpers for server container reliability
const DB_FILE = path.join(DATA_DIR, 'motoride_db.json');

export function persistDbToDisk() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    const data = {
      accounts: Array.from(accountsStore.entries()),
      captains: Array.from(captainsStore.entries()),
      passengers: Array.from(passengersStore.entries()),
      wallets: Array.from(walletsStore.entries()),
    };
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.warn('Failed to persist DB to disk:', err);
  }
}

export function purgeAllDataFromDb() {
  accountsStore.clear();
  captainsStore.clear();
  passengersStore.clear();
  walletsStore.clear();
  ridesStore.clear();
  walletTransactionsStore.length = 0;
  notificationsStore.length = 0;
  passengerLocationsStore.clear();
  messagesStore.clear();
  persistDbToDisk();
}

export function clearAllRidesFromDb() {
  ridesStore.clear();
  messagesStore.clear();
  passengerLocationsStore.clear();
  notificationsStore.length = 0;
}

export function deleteCaptainFromDb(id: string): boolean {
  let found = captainsStore.delete(id);
  walletsStore.delete(id);
  for (const [key, acc] of accountsStore.entries()) {
    if (acc.id === id || acc.email === id) {
      accountsStore.delete(key);
      found = true;
    }
  }
  persistDbToDisk();
  return found;
}

export function deletePassengerFromDb(id: string): boolean {
  let found = passengersStore.delete(id);
  walletsStore.delete(id);
  for (const [key, acc] of accountsStore.entries()) {
    if (acc.id === id || acc.email === id) {
      accountsStore.delete(key);
      found = true;
    }
  }
  persistDbToDisk();
  return found;
}

export function deleteRideFromDb(id: string): boolean {
  const found = ridesStore.delete(id);
  messagesStore.delete(id);
  passengerLocationsStore.delete(`ride_${id}`);
  return found;
}

export function loadDbFromDisk() {
  try {
    if (fs.existsSync(DB_FILE)) {
      const raw = fs.readFileSync(DB_FILE, 'utf-8');
      const data = JSON.parse(raw);
      if (Array.isArray(data.accounts)) {
        for (const [k, v] of data.accounts) {
          if (v && v.email) {
            accountsStore.set(k, v);
            if (v.role === 'passenger' && !passengersStore.has(v.id)) {
              passengersStore.set(v.id, {
                id: v.id,
                profile_id: `prof_${v.id}`,
                full_name: v.name,
                email: v.email,
                phone: v.phone || '',
                total_rides: 0,
                rating: 5.0,
                wallet_balance: v.wallet_balance ?? 200,
                emergency_contact: v.phone || '',
                created_at: v.created_at || v.member_since || new Date().toISOString(),
              });
            }
          }
        }
      }
      if (Array.isArray(data.captains)) {
        for (const [k, v] of data.captains) {
          if (v && v.id) captainsStore.set(k, v);
        }
      }
      if (Array.isArray(data.passengers)) {
        for (const [k, v] of data.passengers) {
          if (v && v.id) passengersStore.set(k, v);
        }
      }
      if (Array.isArray(data.wallets)) {
        for (const [k, v] of data.wallets) {
          if (k && v) walletsStore.set(k, v);
        }
      }
    }
  } catch (err) {
    console.warn('Failed to load DB from disk:', err);
  }
}

// Automatically load existing persisted records on module startup
loadDbFromDisk();

// 6. Motoride Rides Store (Starts empty for fresh rides)
export const ridesStore = new Map<string, MotorideRide>();

// 7. Notifications Store
export const notificationsStore: MotorideNotification[] = [];

// Helper: Calculate Today's Income for a captain dynamically from completed rides
// The user prompt mandates:
// 1. "Today's Income must include ONLY rides that were successfully completed today."
// 2. "Calculate it from the rides database using the ride's completed_at timestamp and the captain's ID."
// 3. "Do NOT use yesterday's total as today's starting balance."
// 4. "When the calendar date changes to a new day, Today's Income must automatically become ₹0 if no rides have been completed on the new day."
// 5. "SUM(fare_amount) for rides where captain_id = currentCaptainId AND status = 'completed' AND completed_at >= startOfToday AND completed_at < startOfTomorrow"
export function calculateCaptainTodayIncome(
  captainId: string,
  timezone: string = 'Asia/Kolkata'
): {
  today_income: number;
  completed_rides_today: number;
  today_date: string;
} {
  const now = new Date();
  let todayDateStr: string;
  try {
    todayDateStr = new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).format(now);
  } catch {
    todayDateStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(now);
  }

  let totalIncome = 0;
  let count = 0;

  for (const ride of ridesStore.values()) {
    // Only completed rides
    const isCompleted = ride.status === 'completed' || ride.status === 'trip_completed';
    if (ride.captain_id === captainId && isCompleted) {
      const completionTimestamp = ride.completed_at || ride.trip_completed_at;
      if (completionTimestamp) {
        const rideDate = new Date(completionTimestamp);
        if (!isNaN(rideDate.getTime())) {
          let rideDateStr: string;
          try {
            rideDateStr = new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).format(rideDate);
          } catch {
            rideDateStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(rideDate);
          }
          if (rideDateStr === todayDateStr) {
            // SUM(fare_amount)
            const fare = Number(ride.fare_amount ?? ride.final_fare ?? ride.offered_fare ?? 0);
            totalIncome += fare;
            count++;
          }
        }
      }
    }
  }

  return {
    today_income: Number(totalIncome.toFixed(2)),
    completed_rides_today: count,
    today_date: todayDateStr,
  };
}

export function calculateCaptainTodayEarnings(captainId: string, timezone: string = 'Asia/Kolkata'): number {
  const now = new Date();
  let todayDateStr: string;
  try {
    todayDateStr = new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).format(now);
  } catch {
    todayDateStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(now);
  }

  let todayTotal = 0;
  for (const ride of ridesStore.values()) {
    const isCompleted = ride.status === 'completed' || ride.status === 'trip_completed';
    if (ride.captain_id === captainId && isCompleted) {
      const completionTimestamp = ride.completed_at || ride.trip_completed_at;
      if (completionTimestamp) {
        const rideDate = new Date(completionTimestamp);
        if (!isNaN(rideDate.getTime())) {
          let rideDateStr: string;
          try {
            rideDateStr = new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).format(rideDate);
          } catch {
            rideDateStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(rideDate);
          }
          if (rideDateStr === todayDateStr) {
            const gross = Number(ride.fare_amount ?? ride.final_fare ?? ride.offered_fare ?? 0);
            const commPct = ride.ride_type === 'courier'
              ? (fareSettings.courier_charges?.platform_commission_pct ?? fareSettings.platform_commission_pct)
              : (fareSettings.ride_charges?.platform_commission_pct ?? fareSettings.platform_commission_pct);
            const commission = (gross * commPct) / 100;
            todayTotal += gross - commission;
          }
        }
      }
    }
  }
  return Number(todayTotal.toFixed(2));
}

export function calculateCaptainTotalEarnings(captainId: string): number {
  let total = 0;
  for (const ride of ridesStore.values()) {
    const isCompleted = ride.status === 'completed' || ride.status === 'trip_completed';
    if (ride.captain_id === captainId && isCompleted) {
      const gross = Number(ride.fare_amount ?? ride.final_fare ?? ride.offered_fare ?? 0);
      const commPct = ride.ride_type === 'courier'
        ? (fareSettings.courier_charges?.platform_commission_pct ?? fareSettings.platform_commission_pct)
        : (fareSettings.ride_charges?.platform_commission_pct ?? fareSettings.platform_commission_pct);
      const commission = (gross * commPct) / 100;
      total += gross - commission;
    }
  }
  return Number(total.toFixed(2));
}

// 8. Admin Dashboard Stats
export function getAdminStats(): AdminDashboardStats {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

  let activeCount = 0;
  let completedCount = 0;
  let cancelledCount = 0;
  let todayRidesCount = 0;
  let todayPlatformRevenue = 0;
  let totalVolume = 0;

  for (const ride of ridesStore.values()) {
    const createdTime = new Date(ride.created_at).getTime();
    if (createdTime >= startOfDay) {
      todayRidesCount++;
    }

    if (
      ride.status === 'requested' ||
      ride.status === 'captain_offered' ||
      ride.status === 'captain_accepted' ||
      ride.status === 'captain_arrived' ||
      ride.status === 'trip_started'
    ) {
      activeCount++;
    } else if (ride.status === 'trip_completed') {
      completedCount++;
      const fare = Number(ride.final_fare || 0);
      totalVolume += fare;
      if (ride.trip_completed_at && new Date(ride.trip_completed_at).getTime() >= startOfDay) {
        const commPct = ride.ride_type === 'courier'
          ? (fareSettings.courier_charges?.platform_commission_pct ?? fareSettings.platform_commission_pct)
          : (fareSettings.ride_charges?.platform_commission_pct ?? fareSettings.platform_commission_pct);
        todayPlatformRevenue += (fare * commPct) / 100;
      }
    } else if (
      ride.status === 'cancelled_by_passenger' ||
      ride.status === 'cancelled_by_captain'
    ) {
      cancelledCount++;
    }
  }

  let onlineCaptainsCount = 0;
  for (const cpt of captainsStore.values()) {
    if (cpt.is_online) onlineCaptainsCount++;
  }

  return {
    totalPassengers: passengersStore.size,
    totalCaptains: captainsStore.size,
    onlineCaptains: onlineCaptainsCount,
    activeRides: activeCount,
    completedRides: completedCount,
    cancelledRides: cancelledCount,
    todayRides: todayRidesCount,
    todayPlatformRevenue: Number(todayPlatformRevenue.toFixed(2)),
    totalVolume: Number(totalVolume.toFixed(2)),
  };
}

// 9. Passenger Live Locations Store (Single latest record per passenger/ride)
export const passengerLocationsStore = new Map<string, {
  passenger_id: string;
  ride_id?: string | null;
  latitude: number;
  longitude: number;
  accuracy?: number | null;
  heading?: number | null;
  speed?: number | null;
  updated_at: string;
}>();

export function upsertPassengerLocation(data: {
  passenger_id: string;
  ride_id?: string | null;
  latitude: number;
  longitude: number;
  accuracy?: number | null;
  heading?: number | null;
  speed?: number | null;
}) {
  const key = data.ride_id ? `ride_${data.ride_id}` : `psg_${data.passenger_id}`;
  const record = {
    ...data,
    updated_at: new Date().toISOString(),
  };
  passengerLocationsStore.set(key, record);
  // Also index by passenger_id directly
  passengerLocationsStore.set(`psg_${data.passenger_id}`, record);
  return record;
}

export function getPassengerLocation(rideId?: string, passengerId?: string) {
  if (rideId && passengerLocationsStore.has(`ride_${rideId}`)) {
    return passengerLocationsStore.get(`ride_${rideId}`);
  }
  if (passengerId && passengerLocationsStore.has(`psg_${passengerId}`)) {
    return passengerLocationsStore.get(`psg_${passengerId}`);
  }
  return null;
}

// 10. In-Ride Chat Messages Store
export const messagesStore = new Map<string, RideMessage[]>();

export function addRideMessage(data: {
  ride_id: string;
  sender_id: string;
  sender_role: 'passenger' | 'captain';
  sender_name: string;
  message: string;
}): RideMessage {
  const msg: RideMessage = {
    id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    ride_id: data.ride_id,
    sender_id: data.sender_id,
    sender_role: data.sender_role,
    sender_name: data.sender_name,
    message: data.message,
    created_at: new Date().toISOString(),
  };

  const list = messagesStore.get(data.ride_id) || [];
  list.push(msg);
  messagesStore.set(data.ride_id, list);

  broadcastEvent('RIDE_MESSAGE_RECEIVED', msg);
  return msg;
}

export function getRideMessages(rideId: string): RideMessage[] {
  return messagesStore.get(rideId) || [];
}

// 11. APK Release Management & Disk Storage
export interface ServerApkRelease {
  version: string;
  fileName: string;
  fileSize: string;
  fileSizeBytes?: number;
  releaseNotes: string;
  uploadedAt: string;
  downloadsCount: number;
  isDeleted: boolean;
  hasBinary: boolean;
}

export function formatRealFileSize(bytes?: number | null): string {
  if (!bytes || bytes <= 0 || isNaN(bytes)) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

const APK_META_FILE = path.join(DATA_DIR, 'apk_release.json');
const APK_BINARY_FILE = path.join(DATA_DIR, 'motoride-release.apk');

export let serverApkRelease: ServerApkRelease = {
  version: '2.4.1',
  fileName: 'motoride-v2.4.1.apk',
  fileSize: '',
  fileSizeBytes: 0,
  releaseNotes: 'Official Android APK release with live GPS tracking, instant rider-captain matching, and secure wallet payments.',
  uploadedAt: new Date().toISOString().split('T')[0],
  downloadsCount: 148,
  isDeleted: false,
  hasBinary: false,
};

// Initialize from disk if available
try {
  if (fs.existsSync(APK_META_FILE)) {
    const raw = fs.readFileSync(APK_META_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    serverApkRelease = { ...serverApkRelease, ...parsed };
  }
  if (fs.existsSync(APK_BINARY_FILE)) {
    serverApkRelease.hasBinary = true;
    const stats = fs.statSync(APK_BINARY_FILE);
    serverApkRelease.fileSizeBytes = stats.size;
    serverApkRelease.fileSize = formatRealFileSize(stats.size);
  } else {
    // If no binary file exists on disk, never show a fake file size
    serverApkRelease.hasBinary = false;
    serverApkRelease.fileSizeBytes = 0;
    serverApkRelease.fileSize = '';
  }
} catch (e) {
  console.warn('Could not load APK metadata on startup:', e);
}

export function saveServerApkRelease(updated: Partial<ServerApkRelease>): ServerApkRelease {
  // If binary is present on disk, ensure fileSize is accurately synced with disk stat
  let realSize = serverApkRelease.fileSize;
  let hasBin = serverApkRelease.hasBinary;
  let bytes = serverApkRelease.fileSizeBytes || 0;

  if (fs.existsSync(APK_BINARY_FILE)) {
    hasBin = true;
    bytes = fs.statSync(APK_BINARY_FILE).size;
    realSize = formatRealFileSize(bytes);
  } else if (!hasBin) {
    realSize = '';
    bytes = 0;
  }

  serverApkRelease = {
    ...serverApkRelease,
    ...updated,
    fileSize: realSize,
    fileSizeBytes: bytes,
    hasBinary: hasBin,
  };
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(APK_META_FILE, JSON.stringify(serverApkRelease, null, 2), 'utf-8');
  } catch (err) {
    console.warn('Failed to save APK release metadata to disk:', err);
  }
  broadcastEvent('APK_RELEASE_UPDATED', serverApkRelease);
  return serverApkRelease;
}

export function saveServerApkBinary(
  buffer: Buffer,
  fileName?: string,
  version?: string
): ServerApkRelease {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(APK_BINARY_FILE, buffer);
    const realBytes = buffer.length;
    const realSize = formatRealFileSize(realBytes);
    serverApkRelease = {
      ...serverApkRelease,
      fileName: fileName || serverApkRelease.fileName || 'motoride-release.apk',
      fileSize: realSize,
      fileSizeBytes: realBytes,
      version: version || serverApkRelease.version,
      uploadedAt: new Date().toISOString().split('T')[0],
      hasBinary: true,
      isDeleted: false,
    };
    fs.writeFileSync(APK_META_FILE, JSON.stringify(serverApkRelease, null, 2), 'utf-8');
    broadcastEvent('APK_RELEASE_UPDATED', serverApkRelease);
  } catch (err) {
    console.warn('Failed to save APK binary to disk:', err);
  }
  return serverApkRelease;
}

export function deleteServerApkBinary(): ServerApkRelease {
  try {
    if (fs.existsSync(APK_BINARY_FILE)) {
      fs.unlinkSync(APK_BINARY_FILE);
    }
  } catch (err) {
    console.warn('Error deleting APK binary file:', err);
  }
  serverApkRelease = {
    ...serverApkRelease,
    hasBinary: false,
    fileSize: '',
    fileSizeBytes: 0,
    isDeleted: true,
  };
  try {
    fs.writeFileSync(APK_META_FILE, JSON.stringify(serverApkRelease, null, 2), 'utf-8');
  } catch {}
  broadcastEvent('APK_RELEASE_UPDATED', serverApkRelease);
  return serverApkRelease;
}

export function getServerApkBinary(): { buffer: Buffer; fileName: string; fileSize: string } | null {
  try {
    if (fs.existsSync(APK_BINARY_FILE)) {
      const buffer = fs.readFileSync(APK_BINARY_FILE);
      return {
        buffer,
        fileName: serverApkRelease.fileName || 'motoride-release.apk',
        fileSize: serverApkRelease.fileSize,
      };
    }
  } catch (e) {
    console.warn('Could not read APK binary file:', e);
  }
  return null;
}

