import { Ride, BikeInfo, PricingSettings, RideLocationHistoryItem } from '../src/types';
import { backendCalculateFare, backendHaversineDistanceKm } from './fareEngine';

// Default global pricing settings (Configurable via Admin API)
export let pricingSettings: PricingSettings = {
  rate_per_km: 10.0, // Default ₹10 per km
  base_unlock_fee: 0.0,
  minimum_fare: 0.0, // 0.0 allows pure proportional distance billing (e.g. ₹1 for 0.1km, ₹5 for 0.5km)
  currency_symbol: '₹',
  max_gps_accuracy_threshold_m: 150,
  max_speed_kmh: 80,
  min_movement_threshold_m: 0.5,
  auto_sync_interval_ms: 2000,
  keep_screen_on: true, // Default: Keep screen awake (do not screen off)
};

export function updatePricingSettings(newSettings: Partial<PricingSettings>): PricingSettings {
  pricingSettings = {
    ...pricingSettings,
    ...newSettings,
    rate_per_km: Number(newSettings.rate_per_km ?? pricingSettings.rate_per_km),
    base_unlock_fee: Number(newSettings.base_unlock_fee ?? pricingSettings.base_unlock_fee),
    minimum_fare: Number(newSettings.minimum_fare ?? pricingSettings.minimum_fare),
    keep_screen_on:
      newSettings.keep_screen_on !== undefined
        ? Boolean(newSettings.keep_screen_on)
        : pricingSettings.keep_screen_on,
  };
  return pricingSettings;
}

// Available bikes fleet
export const bikesCatalog: BikeInfo[] = [
  {
    id: 'PB65AA1257',
    name: 'Mahindra Centuro PB65AA1257',
    type: 'Motorcycle',
    battery_level: 100,
    location_name: 'Origin Base Station',
    latitude: 12.971598,
    longitude: 77.594562,
    is_available: true,
    qr_code: 'PB65AA1257',
  },
];

// Pre-seeded completed rides history for rich demonstration
export const ridesStore: Map<string, Ride> = new Map();

// Seed initial sample completed ride
const sampleRideId = 'RIDE-DEMO-870';
const sampleRide: Ride = {
  ride_id: sampleRideId,
  passenger_id: 'USR-8821',
  passenger_name: 'Hemant Kashyap',
  bike_id: 'PB65AA1257',
  bike_name: 'Mahindra Centuro PB65AA1257',
  bike_type: 'Motorcycle',
  status: 'COMPLETED',
  start_time: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
  end_time: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
  start_latitude: 12.971598,
  start_longitude: 77.594562,
  start_address: 'Metro Hub Station A, Central Blvd',
  end_latitude: 12.983214,
  end_longitude: 77.625124,
  end_address: 'Tech Park Gate 5, Innovation Ave',
  total_distance_km: 8.7,
  rate_per_km: 10.0,
  base_unlock_fee: 0.0,
  minimum_fare: 10.0,
  final_fare: 87.0, // 8.70 km * ₹10/km = ₹87.00
  locations: [
    {
      latitude: 12.971598,
      longitude: 77.594562,
      accuracy: 6,
      timestamp: Date.now() - 45 * 60 * 1000,
      speed: 0,
      accumulatedDistanceKm: 0,
      deltaDistanceKm: 0,
    },
    {
      latitude: 12.976598,
      longitude: 77.604562,
      accuracy: 8,
      timestamp: Date.now() - 35 * 60 * 1000,
      speed: 4.8,
      accumulatedDistanceKm: 3.2,
      deltaDistanceKm: 3.2,
    },
    {
      latitude: 12.980214,
      longitude: 77.615124,
      accuracy: 7,
      timestamp: Date.now() - 25 * 60 * 1000,
      speed: 5.2,
      accumulatedDistanceKm: 6.1,
      deltaDistanceKm: 2.9,
    },
    {
      latitude: 12.983214,
      longitude: 77.625124,
      accuracy: 5,
      timestamp: Date.now() - 15 * 60 * 1000,
      speed: 0,
      accumulatedDistanceKm: 8.7,
      deltaDistanceKm: 2.6,
    },
  ],
  duration_seconds: 1800,
  pause_duration_seconds: 0,
  max_speed_kmh: 24.5,
  avg_speed_kmh: 17.4,
  created_at: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
  updated_at: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
  payment_status: 'PAID',
};

ridesStore.set(sampleRideId, sampleRide);

export function getAllRides(): Ride[] {
  return Array.from(ridesStore.values()).sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
}

export function getRideById(id: string): Ride | undefined {
  return ridesStore.get(id);
}

export function saveRide(ride: Ride): Ride {
  ride.updated_at = new Date().toISOString();
  ridesStore.set(ride.ride_id, ride);
  return ride;
}

export function updateBikeAvailability(bikeId: string, isAvailable: boolean) {
  const bike = bikesCatalog.find((b) => b.id === bikeId);
  if (bike) {
    bike.is_available = isAvailable;
  }
}

// User accounts store
export interface UserAccount {
  id: string;
  name: string;
  email: string;
  password?: string;
  phone?: string;
  role?: 'admin' | 'rider';
  memberSince: string;
  totalRides: number;
  walletBalance: number;
  preferredVehicle?: string;
}

const usersStore = new Map<string, UserAccount>();

// Default Admin user
usersStore.set('freelanceseoservices01@gmail.com', {
  id: 'USR-ADMIN-001',
  name: 'Super Admin',
  email: 'freelanceseoservices01@gmail.com',
  password: 'password123',
  phone: '+91 98765 00001',
  role: 'admin',
  memberSince: new Date(Date.now() - 60 * 24 * 3600 * 1000).toISOString(),
  totalRides: 12,
  walletBalance: 1000,
  preferredVehicle: 'PB65AA1257',
});

// Default demo rider
usersStore.set('rider@travelmeter.app', {
  id: 'USR-DEMO-001',
  name: 'Hemant Kashyap',
  email: 'rider@travelmeter.app',
  password: 'password123',
  phone: '+91 98765 43210',
  role: 'rider',
  memberSince: new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString(),
  totalRides: 4,
  walletBalance: 250,
  preferredVehicle: 'PB65AA1257',
});

export function findUserByEmail(email: string): UserAccount | undefined {
  return usersStore.get(email.toLowerCase().trim());
}

export function createUser(user: UserAccount): UserAccount {
  usersStore.set(user.email.toLowerCase().trim(), user);
  return user;
}

