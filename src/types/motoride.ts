export type UserRole = 'passenger' | 'captain' | 'admin';

export type MotorideRideStatus =
  | 'requested'
  | 'captain_offered'
  | 'captain_accepted'
  | 'captain_arrived'
  | 'trip_started'
  | 'trip_completed'
  | 'completed'
  | 'cancelled_by_passenger'
  | 'cancelled_by_captain';

export type RideTypeCode = 'bike' | 'auto' | 'car' | 'courier';

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  phone?: string;
  role: UserRole;
  avatar_url?: string;
  is_active: boolean;
  wallet_balance: number;
  created_at: string;
  updated_at?: string;
}

export interface Vehicle {
  id: string;
  captain_id: string;
  model: string;
  plate_number: string;
  vehicle_type: RideTypeCode;
  color?: string;
  year?: number;
  is_active: boolean;
}

export interface Captain {
  id: string;
  profile_id: string;
  full_name: string;
  name?: string;
  email?: string;
  phone?: string;
  avatar_url?: string;
  is_online: boolean;
  is_approved: boolean;
  is_active: boolean;
  current_lat?: number | null;
  current_lng?: number | null;
  current_heading?: number | null;
  rating: number;
  total_rides: number;
  today_earnings?: number;
  today_income?: number;
  completed_rides_today?: number;
  total_earnings?: number;
  wallet_balance?: number;
  vehicle_model?: string;
  plate_number?: string;
  vehicle_type?: RideTypeCode;
  vehicle?: Vehicle;
  created_at: string;
  updated_at?: string;
}

export interface Passenger {
  id: string;
  profile_id: string;
  full_name: string;
  email?: string;
  phone?: string;
  avatar_url?: string;
  total_rides: number;
  rating: number;
  wallet_balance?: number;
  emergency_contact?: string;
  created_at: string;
}

export interface MotorideRide {
  id: string;
  ride_code: string; // e.g. RIDE-74892
  passenger_id: string;
  passenger_name: string;
  passenger_phone?: string;
  captain_id?: string | null;
  captain_name?: string | null;
  captain_avatar?: string | null;
  captain_phone?: string | null;
  vehicle_model?: string | null;
  plate_number?: string | null;
  pickup_address: string;
  pickup_lat: number;
  pickup_lng: number;
  dropoff_address: string;
  dropoff_lat: number;
  dropoff_lng: number;
  distance_km: number;
  duration_minutes: number;
  estimated_fare: number;
  offered_fare: number;
  final_fare: number;
  fare_amount?: number;
  ride_type: RideTypeCode;
  status: MotorideRideStatus;
  payment_method: 'cash' | 'wallet' | 'upi';
  payment_status: 'pending' | 'paid';
  comment?: string | null;
  notes?: string | null;
  cancellation_reason?: string | null;
  trip_started_at?: string | null;
  trip_completed_at?: string | null;
  completed_at?: string | null;
  captain_current_lat?: number | null;
  captain_current_lng?: number | null;
  captain_heading?: number | null;
  created_at: string;
  updated_at: string;
  offers?: RideOffer[];
}

export interface RideOffer {
  id: string;
  ride_id: string;
  captain_id: string;
  captain_name: string;
  captain_avatar?: string;
  avatar_url?: string;
  captain_phone?: string;
  vehicle_model?: string;
  plate_number?: string;
  rating: number;
  counter_fare: number;
  status: 'pending' | 'accepted' | 'rejected';
  created_at: string;
}

export interface FareSettings {
  id?: string;
  base_fare: number;
  per_km_rate: number;
  minimum_fare: number;
  platform_commission_pct: number;
  min_offer_pct: number; // e.g. 70% of estimated fare
  max_offer_pct: number; // e.g. 150% of estimated fare
  currency_symbol: string;
  updated_at?: string;
}

export interface RideTypeConfig {
  key: RideTypeCode;
  name: string;
  tagline: string;
  icon: string;
  base_multiplier: number;
  per_km_rate: number;
  capacity: string;
  is_active: boolean;
}

export interface QRCodeSetting {
  id?: string;
  qr_image_url: string;
  upi_id: string;
  merchant_name: string;
  note: string;
  is_active: boolean;
  updated_at: string;
}

export interface WalletTransaction {
  id: string;
  wallet_id: string;
  user_id: string;
  amount: number;
  type: 'credit' | 'debit';
  category: 'ride_earning' | 'commission_fee' | 'topup' | 'ride_payment' | 'refund';
  description: string;
  reference_ride_id?: string;
  created_at: string;
}

export interface MotorideNotification {
  id: string;
  user_id?: string;
  role_target?: UserRole | 'all';
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'alert';
  ride_id?: string;
  is_read: boolean;
  created_at: string;
}

export interface AdminDashboardStats {
  totalPassengers: number;
  totalCaptains: number;
  onlineCaptains: number;
  activeRides: number;
  completedRides: number;
  cancelledRides: number;
  todayRides: number;
  todayPlatformRevenue: number;
  totalVolume: number;
}

export interface PassengerLiveLocation {
  id?: string;
  passenger_id: string;
  ride_id?: string | null;
  latitude: number;
  longitude: number;
  accuracy?: number | null;
  heading?: number | null;
  speed?: number | null;
  updated_at: string;
}

export interface RideMessage {
  id: string;
  ride_id: string;
  sender_id: string;
  sender_role: 'passenger' | 'captain';
  sender_name: string;
  message: string;
  created_at: string;
}
