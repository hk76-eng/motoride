import {
  MotorideRide,
  Captain,
  Passenger,
  FareSettings,
  QRCodeSetting,
  WalletTransaction,
  MotorideNotification,
  AdminDashboardStats,
  MotorideRideStatus,
  RideOffer,
  PassengerLiveLocation,
} from '../types/motoride';
import { getSupabase } from '../lib/supabase';

const API_BASE = '/api/motoride';

async function safeFetchJson<T = any>(url: string, options?: RequestInit, fallback: T = {} as T): Promise<T> {
  try {
    const res = await fetch(url, options);
    if (!res.ok) {
      const text = await res.text();
      if (text && !text.trim().startsWith('<') && !text.trim().startsWith('The page')) {
        try {
          const errJson = JSON.parse(text);
          if (errJson.error) {
            throw new Error(errJson.error);
          }
        } catch (e: any) {
          if (e.message && e.message !== 'Unexpected token') throw e;
        }
      }
      return fallback;
    }
    const text = await res.text();
    if (!text || text.trim().startsWith('<') || text.trim().startsWith('The page')) {
      return fallback;
    }
    return JSON.parse(text) as T;
  } catch (err: any) {
    if (err.message && !err.message.includes('Unexpected token') && !err.message.includes('valid JSON')) {
      console.warn(`API call warning for ${url}:`, err.message);
    }
    return fallback;
  }
}

export const motorideApi = {
  // 1. Rides
  async getRides(params?: {
    status?: string;
    passenger_id?: string;
    captain_id?: string;
    active_for_captain?: boolean;
  }): Promise<MotorideRide[]> {
    const queryParams = new URLSearchParams();
    if (params?.status) queryParams.set('status', params.status);
    if (params?.passenger_id) queryParams.set('passenger_id', params.passenger_id);
    if (params?.captain_id) queryParams.set('captain_id', params.captain_id);
    if (params?.active_for_captain) queryParams.set('active_for_captain', 'true');

    let backendRides: MotorideRide[] = [];
    try {
      const res = await fetch(`${API_BASE}/rides?${queryParams.toString()}`);
      if (res.ok) {
        const json = await res.json();
        backendRides = json.rides || [];
      }
    } catch (err) {
      console.warn('Backend getRides error:', err);
    }

    const supabase = getSupabase();
    if (supabase) {
      try {
        let query = supabase.from('rides').select('*').order('created_at', { ascending: false });
        if (params?.active_for_captain) {
          query = query.in('status', ['requested', 'captain_offered']);
        } else {
          if (params?.status && params.status !== 'all') query = query.eq('status', params.status);
          if (params?.passenger_id) query = query.eq('passenger_id', params.passenger_id);
          if (params?.captain_id) query = query.eq('captain_id', params.captain_id);
        }
        const { data, error } = await query;
        if (!error && data && data.length > 0) {
          const map = new Map<string, MotorideRide>();
          backendRides.forEach((r) => map.set(r.id, r));
          (data as MotorideRide[]).forEach((r) => {
            if (!map.has(r.id)) {
              map.set(r.id, r);
            }
          });
          return Array.from(map.values()).sort(
            (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          );
        }
      } catch (err) {
        console.warn('Supabase getRides error:', err);
      }
    }

    return backendRides;
  },

  async getRideById(id: string): Promise<MotorideRide | null> {
    try {
      const res = await fetch(`${API_BASE}/rides/${id}`);
      if (res.ok) {
        const json = await res.json();
        if (json.ride) return json.ride;
      }
    } catch {}

    const supabase = getSupabase();
    if (supabase) {
      try {
        const { data, error } = await supabase.from('rides').select('*').eq('id', id).single();
        if (!error && data) return data as MotorideRide;
      } catch (err) {
        console.warn('Supabase getRideById error:', err);
      }
    }

    return null;
  },

  async createRide(rideData: Partial<MotorideRide>): Promise<MotorideRide> {
    const rideCode = `RIDE-${Math.floor(1000 + Math.random() * 9000)}`;
    const rideId = `ride_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const payload = {
      ...rideData,
      id: rideId,
      ride_code: rideCode,
      status: 'requested',
      final_fare: rideData.offered_fare || rideData.estimated_fare || 75,
      payment_status: 'pending',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // 1. Post to shared backend first to guarantee instant cross-browser and cross-device SSE sync
    let createdRide: MotorideRide = payload as MotorideRide;
    try {
      const res = await fetch(`${API_BASE}/rides`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const json = await res.json();
        if (json.ride) {
          createdRide = json.ride;
        }
      }
    } catch (err) {
      console.warn('Backend createRide warning:', err);
    }

    // 2. Also persist to Supabase if configured
    const supabase = getSupabase();
    if (supabase) {
      try {
        await supabase.from('rides').insert([createdRide]);
      } catch (err) {
        console.warn('Supabase insert ride warning:', err);
      }
    }

    return createdRide;
  },

  async acceptRide(
    rideId: string,
    captainData: {
      captain_id: string;
      captain_name: string;
      captain_phone?: string;
      vehicle_model?: string;
      plate_number?: string;
      accepted_fare?: number;
    }
  ): Promise<MotorideRide> {
    const supabase = getSupabase();
    if (supabase) {
      try {
        const { data, error } = await supabase.rpc('accept_ride_atomic', {
          p_ride_id: rideId,
          p_captain_id: captainData.captain_id,
          p_captain_name: captainData.captain_name,
          p_captain_phone: captainData.captain_phone || '',
          p_vehicle_model: captainData.vehicle_model || '',
          p_plate_number: captainData.plate_number || '',
          p_accepted_fare: captainData.accepted_fare || 0,
        });
        if (!error && data && data.success) {
          // Sync with backend API
          fetch(`${API_BASE}/rides/${rideId}/accept`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(captainData),
          }).catch(() => {});
          return data.ride as MotorideRide;
        } else if (data && !data.success) {
          throw new Error(data.error || 'Ride acceptance failed');
        }
      } catch (err) {
        console.warn('Supabase RPC fallback to backend:', err);
      }
    }

    const res = await fetch(`${API_BASE}/rides/${rideId}/accept`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(captainData),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to accept ride');
    }
    const json = await res.json();
    return json.ride;
  },

  async sendCounterOffer(
    rideId: string,
    offerData: {
      captain_id: string;
      captain_name: string;
      captain_phone?: string;
      vehicle_model?: string;
      plate_number?: string;
      counter_fare: number;
    }
  ): Promise<{ ride: MotorideRide; offer: RideOffer }> {
    const res = await fetch(`${API_BASE}/rides/${rideId}/offer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(offerData),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to send offer');
    }
    return res.json();
  },

  async acceptCounterOffer(rideId: string, offerId: string): Promise<MotorideRide> {
    const res = await fetch(`${API_BASE}/rides/${rideId}/accept-offer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ offer_id: offerId }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to accept offer');
    }
    const json = await res.json();
    return json.ride;
  },

  async updateRideStatus(
    rideId: string,
    status: MotorideRideStatus,
    extra?: {
      cancellation_reason?: string;
      final_distance_km?: number;
      final_fare?: number;
    }
  ): Promise<MotorideRide> {
    const supabase = getSupabase();
    if (supabase) {
      try {
        const updatePayload: any = {
          status,
          updated_at: new Date().toISOString(),
        };
        if (extra?.cancellation_reason) updatePayload.cancellation_reason = extra.cancellation_reason;
        if (extra?.final_distance_km) updatePayload.distance_km = extra.final_distance_km;
        if (extra?.final_fare) updatePayload.final_fare = extra.final_fare;
        if (status === 'trip_started') updatePayload.trip_started_at = new Date().toISOString();
        if (status === 'trip_completed') {
          updatePayload.trip_completed_at = new Date().toISOString();
          updatePayload.payment_status = 'paid';
        }
        await supabase.from('rides').update(updatePayload).eq('id', rideId);
      } catch (err) {
        console.warn('Supabase status update error:', err);
      }
    }

    const res = await fetch(`${API_BASE}/rides/${rideId}/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, ...extra }),
    });
    if (!res.ok) {
      if (status.includes('cancelled')) {
        return { id: rideId, status, ...extra } as any;
      }
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to update ride status');
    }
    const json = await res.json();
    return json.ride;
  },

  async updateCaptainLocation(rideId: string, lat: number, lng: number): Promise<void> {
    fetch(`${API_BASE}/rides/${rideId}/location`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lat, lng }),
    }).catch(() => {});
  },

  // Real-Time Captain Live Location (Continuous GPS tracking & Supabase sync)
  async updateCaptainLiveLocation(data: {
    captain_id: string;
    ride_id?: string | null;
    latitude: number;
    longitude: number;
    accuracy?: number | null;
    heading?: number | null;
    speed?: number | null;
  }): Promise<void> {
    const supabase = getSupabase();
    if (supabase) {
      try {
        // 1. Update captains record current coordinates
        await supabase.from('captains').update({
          current_lat: data.latitude,
          current_lng: data.longitude,
          current_heading: data.heading ?? 0,
          updated_at: new Date().toISOString(),
        }).eq('id', data.captain_id);

        // 2. If ride is active, also update rides table coordinates
        if (data.ride_id) {
          await supabase.from('rides').update({
            captain_current_lat: data.latitude,
            captain_current_lng: data.longitude,
            updated_at: new Date().toISOString(),
          }).eq('id', data.ride_id);
        }

        // 3. Upsert to captain_locations if table exists
        await supabase.from('captain_locations').upsert(
          {
            captain_id: data.captain_id,
            ride_id: data.ride_id || null,
            latitude: data.latitude,
            longitude: data.longitude,
            accuracy: data.accuracy ?? null,
            heading: data.heading ?? null,
            speed: data.speed ?? null,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'captain_id,ride_id' }
        );
      } catch (err) {
        console.warn('Supabase captain location update notice:', err);
      }
    }

    if (data.ride_id) {
      fetch(`${API_BASE}/rides/${data.ride_id}/location`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lat: data.latitude, lng: data.longitude }),
      }).catch(() => {});
    }

    // Always sync with backend captain-location endpoint for SSE and cross-device sync
    fetch(`${API_BASE}/captain-location`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).catch(() => {});
  },

  // Real-Time Passenger Live Location
  async updatePassengerLiveLocation(data: {
    passenger_id: string;
    ride_id?: string | null;
    latitude: number;
    longitude: number;
    accuracy?: number | null;
    heading?: number | null;
    speed?: number | null;
  }): Promise<void> {
    const supabase = getSupabase();
    if (supabase) {
      try {
        await supabase.from('passenger_locations').upsert(
          {
            passenger_id: data.passenger_id,
            ride_id: data.ride_id || null,
            latitude: data.latitude,
            longitude: data.longitude,
            accuracy: data.accuracy ?? null,
            heading: data.heading ?? null,
            speed: data.speed ?? null,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'passenger_id,ride_id' }
        );
      } catch (err) {
        console.warn('Supabase passenger location upsert notice:', err);
      }
    }

    // Always sync with backend API endpoint for SSE and cross-device sync
    fetch(`${API_BASE}/passenger-location`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).catch(() => {});
  },

  async getPassengerLiveLocation(
    rideId?: string,
    passengerId?: string
  ): Promise<PassengerLiveLocation | null> {
    const supabase = getSupabase();
    if (supabase) {
      try {
        let query = supabase.from('passenger_locations').select('*');
        if (rideId) {
          query = query.eq('ride_id', rideId);
        } else if (passengerId) {
          query = query.eq('passenger_id', passengerId);
        }
        const { data, error } = await query.order('updated_at', { ascending: false }).limit(1).maybeSingle();
        if (!error && data) {
          return data as PassengerLiveLocation;
        }
      } catch (err) {
        console.warn('Supabase getPassengerLiveLocation notice:', err);
      }
    }

    if (rideId) {
      try {
        const res = await fetch(`${API_BASE}/rides/${rideId}/passenger-location`);
        if (res.ok) {
          const json = await res.json();
          return json.location || null;
        }
      } catch {}
    }

    return null;
  },

  // 2. Captains
  async getAvailableCaptains(
    userLat?: number,
    userLng?: number
  ): Promise<{ captains: (Captain & { distance_km?: number; eta_minutes?: number; is_nearest?: boolean })[]; nearestCaptain: (Captain & { distance_km?: number; eta_minutes?: number; is_nearest?: boolean }) | null }> {
    try {
      const queryParams = new URLSearchParams();
      if (typeof userLat === 'number') queryParams.set('lat', userLat.toString());
      if (typeof userLng === 'number') queryParams.set('lng', userLng.toString());

      const res = await fetch(`${API_BASE}/captains/available?${queryParams.toString()}`);
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.captains)) {
          return {
            captains: json.captains,
            nearestCaptain: json.nearest_captain || json.captains[0] || null,
          };
        }
      }
    } catch (err) {
      console.warn('getAvailableCaptains API fallback:', err);
    }

    // Supabase or Fallback
    const fallbackCaptains = await this.getCaptains();
    const online = Array.isArray(fallbackCaptains)
      ? fallbackCaptains.filter((c) => c && c.is_online !== false && c.is_approved !== false && c.is_active !== false)
      : [];
    return {
      captains: online,
      nearestCaptain: online[0] || null,
    };
  },

  async getCaptains(): Promise<Captain[]> {
    const json = await safeFetchJson<{ captains?: Captain[] }>(`${API_BASE}/captains`, undefined, { captains: [] });
    return Array.isArray(json?.captains) ? json.captains : [];
  },

  async getCaptainById(id: string): Promise<Captain | null> {
    const json = await safeFetchJson<{ captain?: Captain }>(`${API_BASE}/captains/${id}`, undefined, {});
    return json?.captain || null;
  },

  async toggleCaptainOnline(id: string, is_online?: boolean): Promise<Captain> {
    const json = await safeFetchJson<{ captain?: Captain }>(`${API_BASE}/captains/${id}/toggle-online`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_online }),
    });
    return json?.captain || ({ id, is_online: Boolean(is_online) } as any);
  },

  async updateCaptainVehicle(
    id: string,
    vehicleData: { model: string; plate_number: string; vehicle_type?: string; color?: string }
  ): Promise<Captain> {
    const json = await safeFetchJson<{ captain: Captain }>(`${API_BASE}/captains/${id}/vehicle`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(vehicleData),
    });
    return json.captain;
  },

  async updateCaptainApproval(id: string, is_approved: boolean, is_active?: boolean): Promise<Captain> {
    const json = await safeFetchJson<{ captain: Captain }>(`${API_BASE}/captains/${id}/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_approved, is_active }),
    });
    return json.captain;
  },

  // 3. Passengers
  async getPassengers(): Promise<Passenger[]> {
    const json = await safeFetchJson<{ passengers?: Passenger[] }>(`${API_BASE}/passengers`, undefined, { passengers: [] });
    return json.passengers || [];
  },

  // 4. Fare Settings
  async getFareSettings(): Promise<FareSettings> {
    const supabase = getSupabase();
    if (supabase) {
      try {
        const { data } = await supabase.from('fare_settings').select('*').limit(1).maybeSingle();
        if (data) return data as FareSettings;
      } catch {}
    }
    const json = await safeFetchJson<{ settings: FareSettings }>(`${API_BASE}/fare-settings`, undefined, {
      settings: {
        id: 'default',
        base_fare: 40,
        per_km_rate: 12,
        minimum_fare: 50,
        platform_commission_pct: 15,
        min_offer_pct: 70,
        max_offer_pct: 150,
        currency_symbol: '₹',
        updated_at: new Date().toISOString(),
      },
    });
    return json.settings;
  },

  async updateFareSettings(settings: Partial<FareSettings>): Promise<FareSettings> {
    const supabase = getSupabase();
    if (supabase) {
      try {
        await supabase.from('fare_settings').upsert([settings]);
      } catch {}
    }
    const json = await safeFetchJson<{ settings: FareSettings }>(`${API_BASE}/fare-settings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings),
    });
    return json.settings;
  },

  // 5. QR Code Settings
  async getQRSettings(): Promise<QRCodeSetting> {
    const json = await safeFetchJson<{ qr: QRCodeSetting }>(`${API_BASE}/qr-settings`, undefined, {
      qr: {
        id: 'default',
        upi_id: 'motoride.pay@upi',
        merchant_name: 'Motoride Payments',
        note: 'Motoride Ride Fare',
        is_active: true,
        qr_image_url: 'https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=upi://pay?pa=motoride.pay@upi',
        updated_at: new Date().toISOString(),
      },
    });
    return json.qr;
  },

  async updateQRSettings(qr: Partial<QRCodeSetting>): Promise<QRCodeSetting> {
    const json = await safeFetchJson<{ qr: QRCodeSetting }>(`${API_BASE}/qr-settings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(qr),
    });
    return json.qr;
  },

  // 6. Wallet
  async getWallet(userId: string): Promise<{ wallet: { balance: number; currency: string }; transactions: WalletTransaction[] }> {
    const json = await safeFetchJson<{ wallet?: { balance: number; currency: string }; transactions?: WalletTransaction[] }>(
      `${API_BASE}/wallet/${userId}`,
      undefined,
      { wallet: { balance: 0, currency: '₹' }, transactions: [] }
    );
    return {
      wallet: json.wallet || { balance: 0, currency: '₹' },
      transactions: json.transactions || [],
    };
  },

  async topupWallet(userId: string, amount: number): Promise<{ balance: number }> {
    const json = await safeFetchJson<{ wallet: { balance: number } }>(`${API_BASE}/wallet/${userId}/topup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount }),
    }, { wallet: { balance: amount } });
    return json.wallet;
  },

  // 7. Admin Stats & Notifications
  async getAdminStats(): Promise<AdminDashboardStats> {
    const json = await safeFetchJson<{ stats: AdminDashboardStats }>(`${API_BASE}/stats`, undefined, {
      stats: {
        totalPassengers: 0,
        totalCaptains: 0,
        onlineCaptains: 0,
        activeRides: 0,
        completedRides: 0,
        cancelledRides: 0,
        todayRides: 0,
        todayPlatformRevenue: 0,
        totalVolume: 0,
      },
    });
    return json.stats;
  },

  async getNotifications(): Promise<MotorideNotification[]> {
    const json = await safeFetchJson<{ notifications?: MotorideNotification[] }>(`${API_BASE}/notifications`, undefined, {
      notifications: [],
    });
    return json.notifications || [];
  },

  // 8. Ride Chat Messages
  async getRideMessages(rideId: string): Promise<any[]> {
    const json = await safeFetchJson<{ messages?: any[] }>(`${API_BASE}/rides/${rideId}/messages`, undefined, { messages: [] });
    return json.messages || [];
  },

  async sendRideMessage(rideId: string, data: { sender_id: string; sender_role: 'passenger' | 'captain'; sender_name: string; message: string }): Promise<any> {
    const json = await safeFetchJson<{ message?: any }>(`${API_BASE}/rides/${rideId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }, { message: { id: `msg_${Date.now()}`, ride_id: rideId, ...data, timestamp: new Date().toISOString() } });
    return json.message;
  },
};
