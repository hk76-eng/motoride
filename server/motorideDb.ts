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

// 3. Captains Catalog
export const captainsStore = new Map<string, Captain>();

// Seed default captains for immediate out-of-the-box multi-device demo
const defaultCaptain1: Captain = {
  id: 'cpt_vikram_01',
  profile_id: 'prof_cpt_01',
  full_name: 'Vikram Singh',
  phone: '+91 98765 43210',
  is_online: true,
  is_approved: true,
  is_active: true,
  current_lat: 30.704649,
  current_lng: 76.717873,
  current_heading: 45,
  rating: 4.92,
  total_rides: 48,
  today_earnings: 0,
  total_earnings: 14200,
  vehicle: {
    id: 'veh_01',
    captain_id: 'cpt_vikram_01',
    model: 'Mahindra Centuro PB65AA1257',
    plate_number: 'PB65AA1257',
    vehicle_type: 'bike',
    color: 'Red / Black',
    year: 2023,
    is_active: true,
  },
  created_at: new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString(),
  updated_at: new Date().toISOString(),
};

const defaultCaptain2: Captain = {
  id: 'cpt_rajesh_02',
  profile_id: 'prof_cpt_02',
  full_name: 'Rajesh Kumar',
  phone: '+91 98123 45678',
  is_online: true,
  is_approved: true,
  is_active: true,
  current_lat: 30.714649,
  current_lng: 76.727873,
  current_heading: 90,
  rating: 4.88,
  total_rides: 32,
  today_earnings: 0,
  total_earnings: 9800,
  vehicle: {
    id: 'veh_02',
    captain_id: 'cpt_rajesh_02',
    model: 'Bajaj Pulsar 150',
    plate_number: 'CH01AB4492',
    vehicle_type: 'bike',
    color: 'Silver',
    year: 2022,
    is_active: true,
  },
  created_at: new Date(Date.now() - 20 * 24 * 3600 * 1000).toISOString(),
  updated_at: new Date().toISOString(),
};

captainsStore.set(defaultCaptain1.id, defaultCaptain1);
captainsStore.set(defaultCaptain2.id, defaultCaptain2);

// 4. Passengers Catalog
export const passengersStore = new Map<string, Passenger>();

const defaultPassenger1: Passenger = {
  id: 'psg_hemant_01',
  profile_id: 'prof_psg_01',
  full_name: 'Hemant Kashyap',
  phone: '+91 97800 12345',
  total_rides: 14,
  rating: 4.95,
  created_at: new Date(Date.now() - 60 * 24 * 3600 * 1000).toISOString(),
};

const defaultPassenger2: Passenger = {
  id: 'psg_ananya_02',
  profile_id: 'prof_psg_02',
  full_name: 'Ananya Sharma',
  phone: '+91 98722 33445',
  total_rides: 8,
  rating: 4.9,
  created_at: new Date(Date.now() - 15 * 24 * 3600 * 1000).toISOString(),
};

passengersStore.set(defaultPassenger1.id, defaultPassenger1);
passengersStore.set(defaultPassenger2.id, defaultPassenger2);

// 5. Wallets & Transactions
export const walletsStore = new Map<string, { balance: number; currency: string }>();
walletsStore.set('cpt_vikram_01', { balance: 450.0, currency: '₹' });
walletsStore.set('cpt_rajesh_02', { balance: 280.0, currency: '₹' });
walletsStore.set('psg_hemant_01', { balance: 350.0, currency: '₹' });
walletsStore.set('admin_system', { balance: 18450.0, currency: '₹' });

export const walletTransactionsStore: WalletTransaction[] = [
  {
    id: 'tx_01',
    wallet_id: 'w_cpt_01',
    user_id: 'cpt_vikram_01',
    amount: 500,
    type: 'credit',
    category: 'topup',
    description: 'UPI Topup via Admin QR Code',
    created_at: new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString(),
  },
  {
    id: 'tx_02',
    wallet_id: 'w_cpt_01',
    user_id: 'cpt_vikram_01',
    amount: 50,
    type: 'debit',
    category: 'commission_fee',
    description: 'Platform commission deduction',
    created_at: new Date(Date.now() - 1 * 24 * 3600 * 1000).toISOString(),
  },
];

// 6. Motoride Rides Store
export const ridesStore = new Map<string, MotorideRide>();

// Seed a completed ride from today to verify earnings calculation immediately
const seedDate = new Date();
const seedRideId = 'ride_seed_01';
const seedRide: MotorideRide = {
  id: seedRideId,
  ride_code: 'RIDE-1092',
  passenger_id: 'psg_ananya_02',
  passenger_name: 'Ananya Sharma',
  passenger_phone: '+91 98722 33445',
  captain_id: 'cpt_vikram_01',
  captain_name: 'Vikram Singh',
  captain_phone: '+91 98765 43210',
  vehicle_model: 'Mahindra Centuro PB65AA1257',
  plate_number: 'PB65AA1257',
  pickup_address: 'Sector 70, Mohali Market',
  pickup_lat: 30.704649,
  pickup_lng: 76.717873,
  dropoff_address: 'Phase 8B, Industrial Area, Mohali',
  dropoff_lat: 30.718214,
  dropoff_lng: 76.732124,
  distance_km: 3.8,
  duration_minutes: 11,
  estimated_fare: 70,
  offered_fare: 75,
  final_fare: 75,
  ride_type: 'bike',
  status: 'trip_completed',
  payment_method: 'wallet',
  payment_status: 'paid',
  trip_started_at: new Date(Date.now() - 40 * 60 * 1000).toISOString(),
  trip_completed_at: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
  created_at: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
  updated_at: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
};
ridesStore.set(seedRideId, seedRide);

// 7. Notifications Store
export const notificationsStore: MotorideNotification[] = [
  {
    id: 'notif_01',
    role_target: 'all',
    title: 'Welcome to Motoride',
    message: 'Passenger, Captain and Admin workspaces are live and synchronized in real time.',
    type: 'success',
    is_read: false,
    created_at: new Date().toISOString(),
  },
];

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
