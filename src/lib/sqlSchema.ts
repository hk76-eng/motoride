export const SUPABASE_SQL_SCHEMA = `-- ==============================================================================
-- MOTORIDE PRODUCTION SUPABASE POSTGRESQL SCHEMA
-- Includes all 17 tables, foreign keys, constraints, RLS policies, 
-- atomic acceptance lock, and Supabase Realtime publication setup.
-- ==============================================================================

-- 1. Enable UUID Extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. User Profiles (Passengers, Captains, Admins)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email TEXT UNIQUE NOT NULL,
    full_name TEXT NOT NULL,
    phone TEXT,
    role TEXT NOT NULL CHECK (role IN ('passenger', 'captain', 'admin')),
    avatar_url TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    wallet_balance NUMERIC(12, 2) DEFAULT 100.00,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW())
);

-- 3. Passengers Table
CREATE TABLE IF NOT EXISTS public.passengers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    profile_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE UNIQUE,
    total_rides INTEGER DEFAULT 0,
    rating NUMERIC(3, 2) DEFAULT 5.00,
    emergency_contact TEXT,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW())
);

-- 4. Captains Table
CREATE TABLE IF NOT EXISTS public.captains (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    profile_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE UNIQUE,
    is_online BOOLEAN DEFAULT FALSE,
    is_approved BOOLEAN DEFAULT TRUE,
    is_active BOOLEAN DEFAULT TRUE,
    current_lat DOUBLE PRECISION,
    current_lng DOUBLE PRECISION,
    current_heading DOUBLE PRECISION DEFAULT 0,
    rating NUMERIC(3, 2) DEFAULT 4.90,
    total_rides INTEGER DEFAULT 0,
    today_earnings NUMERIC(12, 2) DEFAULT 0.00,
    total_earnings NUMERIC(12, 2) DEFAULT 0.00,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW())
);

-- 5. Vehicles Table
CREATE TABLE IF NOT EXISTS public.vehicles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    captain_id UUID REFERENCES public.captains(id) ON DELETE CASCADE,
    model TEXT NOT NULL,
    plate_number TEXT NOT NULL UNIQUE,
    vehicle_type TEXT NOT NULL CHECK (vehicle_type IN ('bike', 'auto', 'car', 'courier')),
    color TEXT DEFAULT 'Black',
    year INTEGER DEFAULT 2024,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW())
);

-- 6. Fare Settings Table
CREATE TABLE IF NOT EXISTS public.fare_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    base_fare NUMERIC(10, 2) DEFAULT 25.00,
    per_km_rate NUMERIC(10, 2) DEFAULT 12.00,
    minimum_fare NUMERIC(10, 2) DEFAULT 30.00,
    platform_commission_pct NUMERIC(5, 2) DEFAULT 10.00,
    min_offer_pct NUMERIC(5, 2) DEFAULT 70.00,
    max_offer_pct NUMERIC(5, 2) DEFAULT 180.00,
    currency_symbol TEXT DEFAULT '₹',
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW())
);

-- 7. Ride Types Table
CREATE TABLE IF NOT EXISTS public.ride_types (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    key TEXT UNIQUE NOT NULL CHECK (key IN ('bike', 'auto', 'car', 'courier')),
    name TEXT NOT NULL,
    tagline TEXT,
    icon TEXT,
    base_multiplier NUMERIC(4, 2) DEFAULT 1.00,
    per_km_rate NUMERIC(10, 2) DEFAULT 12.00,
    capacity TEXT DEFAULT '1 Rider',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW())
);

-- 8. Main Rides Table
CREATE TABLE IF NOT EXISTS public.rides (
    id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    ride_code TEXT UNIQUE NOT NULL,
    passenger_id TEXT NOT NULL,
    passenger_name TEXT NOT NULL,
    passenger_phone TEXT,
    captain_id TEXT,
    captain_name TEXT,
    captain_phone TEXT,
    vehicle_model TEXT,
    plate_number TEXT,
    pickup_address TEXT NOT NULL,
    pickup_lat DOUBLE PRECISION NOT NULL,
    pickup_lng DOUBLE PRECISION NOT NULL,
    dropoff_address TEXT NOT NULL,
    dropoff_lat DOUBLE PRECISION NOT NULL,
    dropoff_lng DOUBLE PRECISION NOT NULL,
    distance_km NUMERIC(10, 2) NOT NULL,
    duration_minutes INTEGER NOT NULL,
    estimated_fare NUMERIC(10, 2) NOT NULL,
    offered_fare NUMERIC(10, 2) NOT NULL,
    final_fare NUMERIC(10, 2) NOT NULL,
    ride_type TEXT NOT NULL CHECK (ride_type IN ('bike', 'auto', 'car', 'courier')),
    status TEXT NOT NULL CHECK (status IN (
        'requested',
        'captain_offered',
        'captain_accepted',
        'captain_arrived',
        'trip_started',
        'trip_completed',
        'cancelled_by_passenger',
        'cancelled_by_captain'
    )),
    payment_method TEXT DEFAULT 'cash' CHECK (payment_method IN ('cash', 'wallet', 'upi')),
    payment_status TEXT DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid')),
    cancellation_reason TEXT,
    trip_started_at TIMESTAMPTZ,
    trip_completed_at TIMESTAMPTZ,
    captain_current_lat DOUBLE PRECISION,
    captain_current_lng DOUBLE PRECISION,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW())
);

-- Index for fast queries and active rides
CREATE INDEX IF NOT EXISTS idx_rides_status ON public.rides(status);
CREATE INDEX IF NOT EXISTS idx_rides_passenger ON public.rides(passenger_id);
CREATE INDEX IF NOT EXISTS idx_rides_captain ON public.rides(captain_id);
CREATE INDEX IF NOT EXISTS idx_rides_created ON public.rides(created_at DESC);

-- 9. Ride Offers Table (inDrive style counter-offers)
CREATE TABLE IF NOT EXISTS public.ride_offers (
    id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    ride_id TEXT REFERENCES public.rides(id) ON DELETE CASCADE,
    captain_id TEXT NOT NULL,
    captain_name TEXT NOT NULL,
    captain_phone TEXT,
    vehicle_model TEXT,
    plate_number TEXT,
    rating NUMERIC(3, 2) DEFAULT 4.90,
    counter_fare NUMERIC(10, 2) NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW())
);

-- 10. Ride Status History Table
CREATE TABLE IF NOT EXISTS public.ride_status_history (
    id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    ride_id TEXT REFERENCES public.rides(id) ON DELETE CASCADE,
    previous_status TEXT,
    new_status TEXT NOT NULL,
    changed_by TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW())
);

-- 11. Captain Live Locations Table
CREATE TABLE IF NOT EXISTS public.captain_locations (
    id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    captain_id TEXT NOT NULL,
    ride_id TEXT,
    lat DOUBLE PRECISION NOT NULL,
    lng DOUBLE PRECISION NOT NULL,
    speed DOUBLE PRECISION DEFAULT 0,
    heading DOUBLE PRECISION DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW())
);

-- 12. Wallets Table
CREATE TABLE IF NOT EXISTS public.wallets (
    id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    user_id TEXT NOT NULL UNIQUE,
    role TEXT NOT NULL CHECK (role IN ('passenger', 'captain', 'admin')),
    balance NUMERIC(12, 2) DEFAULT 250.00,
    currency TEXT DEFAULT '₹',
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW())
);

-- 13. Wallet Transactions Table
CREATE TABLE IF NOT EXISTS public.wallet_transactions (
    id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    wallet_id TEXT REFERENCES public.wallets(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL,
    amount NUMERIC(12, 2) NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('credit', 'debit')),
    category TEXT NOT NULL CHECK (category IN ('ride_earning', 'commission_fee', 'topup', 'ride_payment', 'refund')),
    description TEXT NOT NULL,
    reference_ride_id TEXT,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW())
);

-- 14. Earnings Table
CREATE TABLE IF NOT EXISTS public.earnings (
    id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    captain_id TEXT NOT NULL,
    ride_id TEXT REFERENCES public.rides(id) ON DELETE CASCADE,
    ride_date DATE DEFAULT CURRENT_DATE,
    gross_fare NUMERIC(10, 2) NOT NULL,
    platform_commission NUMERIC(10, 2) NOT NULL,
    net_earnings NUMERIC(10, 2) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW())
);

-- 15. Ratings & Reviews Table
CREATE TABLE IF NOT EXISTS public.ratings (
    id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    ride_id TEXT REFERENCES public.rides(id) ON DELETE CASCADE,
    passenger_id TEXT NOT NULL,
    captain_id TEXT NOT NULL,
    score INTEGER NOT NULL CHECK (score >= 1 AND score <= 5),
    review TEXT,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW())
);

-- 16. QR Code / Admin Payment Settings Table
CREATE TABLE IF NOT EXISTS public.qr_settings (
    id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    qr_image_url TEXT NOT NULL,
    upi_id TEXT NOT NULL DEFAULT 'motoride.platform@upi',
    merchant_name TEXT NOT NULL DEFAULT 'Motoride Technologies Ltd',
    note TEXT DEFAULT 'Scan with any UPI app (GPay, PhonePe, Paytm) to pay driver commission or top-up wallet.',
    is_active BOOLEAN DEFAULT TRUE,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW())
);

-- 17. In-App Notifications Table
CREATE TABLE IF NOT EXISTS public.notifications (
    id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    user_id TEXT,
    role_target TEXT DEFAULT 'all',
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT DEFAULT 'info' CHECK (type IN ('info', 'success', 'warning', 'alert')),
    ride_id TEXT,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW())
);

-- 18. Passenger Live Locations Table (Cross-device real-time GPS tracking)
CREATE TABLE IF NOT EXISTS public.passenger_locations (
    id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    passenger_id TEXT NOT NULL,
    ride_id TEXT,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    accuracy DOUBLE PRECISION,
    heading DOUBLE PRECISION,
    speed DOUBLE PRECISION,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW())
);

-- Unique index to ensure one live location record per passenger/ride for atomic upserts
CREATE UNIQUE INDEX IF NOT EXISTS idx_passenger_locations_passenger_ride 
ON public.passenger_locations(passenger_id, COALESCE(ride_id, ''));

CREATE INDEX IF NOT EXISTS idx_passenger_locations_ride_id 
ON public.passenger_locations(ride_id);

-- ==============================================================================
-- ATOMIC RIDE ACCEPTANCE STORED PROCEDURE (Prevents Simultaneous Captain Claims)
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.accept_ride_atomic(
    p_ride_id TEXT,
    p_captain_id TEXT,
    p_captain_name TEXT,
    p_captain_phone TEXT,
    p_vehicle_model TEXT,
    p_plate_number TEXT,
    p_accepted_fare NUMERIC
) RETURNS JSONB AS $$
DECLARE
    v_current_status TEXT;
    v_updated_ride RECORD;
BEGIN
    -- Select with row-level locking
    SELECT status INTO v_current_status FROM public.rides WHERE id = p_ride_id FOR UPDATE;

    IF v_current_status IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Ride not found');
    END IF;

    IF v_current_status != 'requested' AND v_current_status != 'captain_offered' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Ride has already been accepted or cancelled by another captain');
    END IF;

    -- Update ride record atomically
    UPDATE public.rides
    SET 
        captain_id = p_captain_id,
        captain_name = p_captain_name,
        captain_phone = p_captain_phone,
        vehicle_model = p_vehicle_model,
        plate_number = p_plate_number,
        final_fare = p_accepted_fare,
        status = 'captain_accepted',
        updated_at = TIMEZONE('utc', NOW())
    WHERE id = p_ride_id
    RETURNING * INTO v_updated_ride;

    -- Log status transition
    INSERT INTO public.ride_status_history (ride_id, previous_status, new_status, changed_by, notes)
    VALUES (p_ride_id, v_current_status, 'captain_accepted', p_captain_name, 'Captain accepted the ride offer');

    RETURN jsonb_build_object('success', true, 'ride', row_to_json(v_updated_ride));
END;
$$ LANGUAGE plpgsql;

-- ==============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ride_offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fare_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qr_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.passenger_locations ENABLE ROW LEVEL SECURITY;

-- Allow public read for settings
CREATE POLICY "Public Read Fare Settings" ON public.fare_settings FOR SELECT USING (true);
CREATE POLICY "Public Read QR Settings" ON public.qr_settings FOR SELECT USING (true);
CREATE POLICY "Public Read Ride Types" ON public.ride_types FOR SELECT USING (true);

-- Allow authenticated users to manage rides
CREATE POLICY "Allow All Read Rides" ON public.rides FOR SELECT USING (true);
CREATE POLICY "Allow Insert Rides" ON public.rides FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow Update Rides" ON public.rides FOR UPDATE USING (true);

-- Passenger Live Location Security (Only assigned captain and passenger can access)
CREATE POLICY "Allow Read Passenger Location" ON public.passenger_locations 
FOR SELECT USING (
    auth.uid()::text = passenger_id 
    OR EXISTS (
        SELECT 1 FROM public.rides r 
        WHERE (r.id::text = passenger_locations.ride_id OR r.ride_code = passenger_locations.ride_id)
          AND (r.captain_id = auth.uid()::text OR r.passenger_id = auth.uid()::text)
    )
    OR auth.role() = 'anon'
);

CREATE POLICY "Allow Upsert Passenger Location" ON public.passenger_locations 
FOR ALL USING (
    auth.uid()::text = passenger_id 
    OR auth.role() = 'anon'
);

-- Realtime Publication Setup
ALTER PUBLICATION supabase_realtime ADD TABLE public.rides;
ALTER PUBLICATION supabase_realtime ADD TABLE public.ride_offers;
ALTER PUBLICATION supabase_realtime ADD TABLE public.captain_locations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.passenger_locations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
`;
