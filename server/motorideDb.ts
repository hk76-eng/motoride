import fs from 'fs';
import path from 'path';
import {
  MotorideRide,
  Captain,
  Passenger,
  Profile,
  Vehicle,
  FareSettings,
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

// 1. Initial Fare Settings
export let fareSettings: FareSettings = {
  base_fare: 25.0,
  per_km_rate: 12.0,
  minimum_fare: 30.0,
  platform_commission_pct: 10.0,
  min_offer_pct: 70.0,
  max_offer_pct: 180.0,
  currency_symbol: '₹',
  updated_at: new Date().toISOString(),
};

export function updateFareSettings(newSettings: Partial<FareSettings>): FareSettings {
  fareSettings = {
    ...fareSettings,
    ...newSettings,
    base_fare: Number(newSettings.base_fare ?? fareSettings.base_fare),
    per_km_rate: Number(newSettings.per_km_rate ?? fareSettings.per_km_rate),
    minimum_fare: Number(newSettings.minimum_fare ?? fareSettings.minimum_fare),
    platform_commission_pct: Number(newSettings.platform_commission_pct ?? fareSettings.platform_commission_pct),
    min_offer_pct: Number(newSettings.min_offer_pct ?? fareSettings.min_offer_pct),
    max_offer_pct: Number(newSettings.max_offer_pct ?? fareSettings.max_offer_pct),
    updated_at: new Date().toISOString(),
  };
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
const DATA_DIR = path.join(process.cwd(), 'data');
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

export function loadDbFromDisk() {
  try {
    if (fs.existsSync(DB_FILE)) {
      const raw = fs.readFileSync(DB_FILE, 'utf-8');
      const data = JSON.parse(raw);
      if (Array.isArray(data.accounts)) {
        for (const [k, v] of data.accounts) {
          if (v && v.email) accountsStore.set(k, v);
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

// Helper: Calculate Today's Earnings for a captain dynamically from completed rides
// The user prompt mandates:
// "Today's earnings must be calculated from completed rides for the current local calendar date.
// At the beginning of the next day, today's earnings must automatically show ₹0 and begin counting the new day's completed rides.
// Do not permanently store yesterday's total as today's total."
export function calculateCaptainTodayEarnings(captainId: string): number {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const endOfDay = startOfDay + 24 * 60 * 60 * 1000;

  let todayTotal = 0;
  for (const ride of ridesStore.values()) {
    if (
      ride.captain_id === captainId &&
      ride.status === 'trip_completed' &&
      ride.trip_completed_at
    ) {
      const completedTime = new Date(ride.trip_completed_at).getTime();
      if (completedTime >= startOfDay && completedTime < endOfDay) {
        // Net earning after platform commission
        const gross = Number(ride.final_fare || ride.offered_fare || 0);
        const commission = (gross * fareSettings.platform_commission_pct) / 100;
        todayTotal += gross - commission;
      }
    }
  }
  return Number(todayTotal.toFixed(2));
}

export function calculateCaptainTotalEarnings(captainId: string): number {
  let total = 0;
  for (const ride of ridesStore.values()) {
    if (
      ride.captain_id === captainId &&
      ride.status === 'trip_completed' &&
      ride.trip_completed_at
    ) {
      const gross = Number(ride.final_fare || ride.offered_fare || 0);
      const commission = (gross * fareSettings.platform_commission_pct) / 100;
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
        todayPlatformRevenue += (fare * fareSettings.platform_commission_pct) / 100;
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
