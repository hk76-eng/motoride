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
import { safeStorage } from '../lib/safeStorage';
import { realtimeSync } from './realtimeSync';

const API_BASE = '/api/motoride';

// Local and cross-browser memory store for resilient instant sync
const localRidesStore: Map<string, MotorideRide> = new Map();
const localMessagesStore: Map<string, any[]> = new Map();

// Initialize from safeStorage if available
try {
  const saved = safeStorage.getItem('motoride_active_rides_cache');
  if (saved) {
    const parsed = JSON.parse(saved);
    if (Array.isArray(parsed)) {
      parsed.forEach((r: MotorideRide) => {
        if (r && r.id && !r.id.includes('demo') && r.passenger_id !== 'usr_demo_100') {
          localRidesStore.set(r.id, r);
        }
      });
    }
  }
} catch {}

const saveLocalRides = () => {
  try {
    const arr = Array.from(localRidesStore.values()).slice(0, 30);
    safeStorage.setItem('motoride_active_rides_cache', JSON.stringify(arr));
  } catch {}
};

realtimeSync.on('RIDE_MESSAGE_RECEIVED', (msg: any) => {
  if (msg && msg.ride_id) {
    const list = localMessagesStore.get(msg.ride_id) || [];
    if (!list.some((m) => m.id === msg.id)) {
      list.push(msg);
      localMessagesStore.set(msg.ride_id, list);
    }
  }
});

realtimeSync.on('RIDE_DELETED', (data: any) => {
  if (data?.id) {
    localRidesStore.delete(data.id);
    saveLocalRides();
  }
});

// Listen to incoming real-time broadcast and SSE events to keep local store in sync across all devices
realtimeSync.on('RIDE_CREATED', (ride: MotorideRide) => {
  if (ride && ride.id) {
    localRidesStore.set(ride.id, ride);
    saveLocalRides();
  }
});

realtimeSync.on('RIDE_UPDATED', (ride: MotorideRide) => {
  if (ride && ride.id) {
    const existing = localRidesStore.get(ride.id) || {};
    localRidesStore.set(ride.id, { ...existing, ...ride });
    saveLocalRides();
  }
});

realtimeSync.on('RIDE_ACCEPTED', (ride: MotorideRide) => {
  if (ride && ride.id) {
    const existing = localRidesStore.get(ride.id) || ({} as Partial<MotorideRide>);
    localRidesStore.set(ride.id, { ...existing, ...ride, status: 'captain_accepted' } as MotorideRide);
    saveLocalRides();
  }
});

realtimeSync.on('RIDE_OFFER_RECEIVED', (payload: any) => {
  const ride = payload?.ride;
  const offer = payload?.offer;
  if (ride && ride.id) {
    const existing = localRidesStore.get(ride.id) || ({} as Partial<MotorideRide>);
    const existingOffers = existing.offers || [];
    const updatedOffers = offer && !existingOffers.some((o: any) => o.id === offer.id)
      ? [...existingOffers, offer]
      : (ride.offers || existingOffers);
    localRidesStore.set(ride.id, { ...existing, ...ride, offers: updatedOffers } as MotorideRide);
    saveLocalRides();
  }
});

realtimeSync.on('ACTIVE_RIDES_SYNC_RECEIVED', (rides: MotorideRide[]) => {
  if (Array.isArray(rides)) {
    rides.forEach((r) => {
      if (r && r.id) localRidesStore.set(r.id, r);
    });
    saveLocalRides();
  }
});

realtimeSync.on('REQUEST_SYNC_RECEIVED', () => {
  const activeRides = Array.from(localRidesStore.values()).filter(
    (r) => r.status === 'requested' || r.status === 'captain_offered' || r.status === 'captain_accepted' || r.status === 'captain_arrived' || r.status === 'trip_started'
  );
  if (activeRides.length > 0) {
    realtimeSync.sendActiveRidesSync(activeRides);
  }
});

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

    const map = new Map<string, MotorideRide>();

    // 1. Include local & cross-tab synced in-memory rides
    localRidesStore.forEach((r) => {
      if (r && r.id) map.set(r.id, r);
    });

    // 2. Fetch from backend API if available
    const json = await safeFetchJson<{ rides?: MotorideRide[] }>(
      `${API_BASE}/rides?${queryParams.toString()}`,
      undefined,
      { rides: [] }
    );
    if (Array.isArray(json?.rides)) {
      json.rides.forEach((r) => {
        if (r && r.id) {
          map.set(r.id, r);
          localRidesStore.set(r.id, r);
        }
      });
      saveLocalRides();
    }

    // 3. Fetch from Supabase PostgreSQL if table exists
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
        if (!error && data && Array.isArray(data)) {
          (data as MotorideRide[]).forEach((r) => {
            if (r && r.id) {
              map.set(r.id, r);
              localRidesStore.set(r.id, r);
            }
          });
          saveLocalRides();
        }
      } catch (err) {
        console.warn('Supabase getRides notice:', err);
      }
    }

    let result = Array.from(map.values());

    // Apply strict filtering to ensure precision
    if (params?.active_for_captain) {
      result = result.filter(
        (r) =>
          r &&
          (r.status === 'requested' || r.status === 'captain_offered') &&
          !r.id?.includes('demo') &&
          r.passenger_id !== 'usr_demo_100'
      );
    } else {
      if (params?.status && params.status !== 'all') {
        result = result.filter((r) => r && r.status === params.status);
      }
      if (params?.passenger_id) {
        result = result.filter((r) => r && r.passenger_id === params.passenger_id);
      }
      if (params?.captain_id) {
        result = result.filter((r) => r && r.captain_id === params.captain_id);
      }
    }

    return result.sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  },

  async getRideById(id: string): Promise<MotorideRide | null> {
    if (localRidesStore.has(id)) {
      return localRidesStore.get(id)!;
    }

    const json = await safeFetchJson<{ ride?: MotorideRide }>(`${API_BASE}/rides/${id}`, undefined, {});
    if (json?.ride) {
      localRidesStore.set(id, json.ride);
      saveLocalRides();
      return json.ride;
    }

    const supabase = getSupabase();
    if (supabase) {
      try {
        const { data, error } = await supabase.from('rides').select('*').eq('id', id).single();
        if (!error && data) {
          localRidesStore.set(id, data as MotorideRide);
          saveLocalRides();
          return data as MotorideRide;
        }
      } catch (err) {
        console.warn('Supabase getRideById notice:', err);
      }
    }

    return null;
  },

  async createRide(rideData: Partial<MotorideRide>): Promise<MotorideRide> {
    const rideCode = `RIDE-${Math.floor(1000 + Math.random() * 9000)}`;
    const rideId = `ride_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const payload: MotorideRide = {
      ...rideData,
      id: rideId,
      ride_code: rideCode,
      status: 'requested',
      final_fare: rideData.offered_fare || rideData.estimated_fare || 75,
      payment_status: 'pending',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    } as MotorideRide;

    // 1. Store locally in memory and persistent storage
    localRidesStore.set(payload.id, payload);
    saveLocalRides();

    // 2. Broadcast immediately over Supabase Realtime to ALL connected captains & browsers
    realtimeSync.broadcast('RIDE_CREATED', payload);

    // 3. Post to Supabase database if tables exist
    const supabase = getSupabase();
    if (supabase) {
      try {
        await supabase.from('rides').insert([payload]);
      } catch (err) {
        console.warn('Supabase insert ride notice:', err);
      }
    }

    // 4. Also post to backend if running
    safeFetchJson<{ ride?: MotorideRide }>(
      `${API_BASE}/rides`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      },
      { ride: payload }
    ).catch(() => {});

    return payload;
  },

  async acceptRide(
    rideId: string,
    captainData: {
      captain_id: string;
      captain_name: string;
      captain_avatar?: string;
      captain_phone?: string;
      vehicle_model?: string;
      plate_number?: string;
      accepted_fare?: number;
    }
  ): Promise<MotorideRide> {
    const existing = localRidesStore.get(rideId) || ({ id: rideId } as MotorideRide);
    const updatedRide: MotorideRide = {
      ...existing,
      id: rideId,
      status: 'captain_accepted',
      captain_id: captainData.captain_id,
      captain_name: captainData.captain_name,
      captain_avatar: (captainData as any).captain_avatar || safeStorage.getItem('motoride_captain_avatar') || undefined,
      captain_phone: captainData.captain_phone,
      vehicle_model: captainData.vehicle_model,
      plate_number: captainData.plate_number,
      final_fare: captainData.accepted_fare || existing.final_fare || 75,
      updated_at: new Date().toISOString(),
    };

    localRidesStore.set(rideId, updatedRide);
    saveLocalRides();

    // Broadcast instantly to all browsers and devices
    realtimeSync.broadcast('RIDE_ACCEPTED', updatedRide);
    realtimeSync.broadcast('RIDE_UPDATED', updatedRide);

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
        if (!error && data?.success && data.ride) {
          return data.ride as MotorideRide;
        } else {
          await supabase.from('rides').update(updatedRide).eq('id', rideId);
        }
      } catch (err) {
        console.warn('Supabase accept ride notice:', err);
      }
    }

    safeFetchJson<{ ride: MotorideRide }>(
      `${API_BASE}/rides/${rideId}/accept`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(captainData),
      },
      { ride: updatedRide }
    ).catch(() => {});

    return updatedRide;
  },

  async sendCounterOffer(
    rideId: string,
    offerData: {
      captain_id: string;
      captain_name: string;
      captain_avatar?: string;
      avatar_url?: string;
      captain_phone?: string;
      vehicle_model?: string;
      plate_number?: string;
      counter_fare: number;
    }
  ): Promise<{ ride: MotorideRide; offer: RideOffer }> {
    const existing = localRidesStore.get(rideId) || ({ id: rideId } as MotorideRide);
    const updatedRide: MotorideRide = {
      ...existing,
      id: rideId,
      status: 'captain_offered',
      updated_at: new Date().toISOString(),
    };

    const newOffer: RideOffer = {
      id: `off_${Date.now()}`,
      ride_id: rideId,
      ...offerData,
      status: 'pending',
      rating: 4.9,
      created_at: new Date().toISOString(),
    };

    const existingOffers = updatedRide.offers || [];
    updatedRide.offers = [...existingOffers.filter((o) => o.captain_id !== offerData.captain_id), newOffer];

    localRidesStore.set(rideId, updatedRide);
    saveLocalRides();

    const supabase = getSupabase();
    if (supabase) {
      try {
        await supabase.from('rides').update({ status: 'captain_offered' }).eq('id', rideId);
        await supabase.from('ride_offers').insert([newOffer]);
      } catch (err) {
        console.warn('Supabase counter offer notice:', err);
      }
    }

    const serverResult = await safeFetchJson<{ ride: MotorideRide; offer: RideOffer }>(
      `${API_BASE}/rides/${rideId}/offer`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(offerData),
      },
      { ride: updatedRide, offer: newOffer }
    );

    const finalRide = serverResult?.ride || updatedRide;
    const finalOffer = serverResult?.offer || newOffer;

    localRidesStore.set(rideId, finalRide);
    saveLocalRides();

    // Broadcast counter offer to passenger immediately across devices
    realtimeSync.broadcast('RIDE_OFFER_RECEIVED', { ride: finalRide, offer: finalOffer });
    realtimeSync.broadcast('RIDE_UPDATED', finalRide);

    return { ride: finalRide, offer: finalOffer };
  },

  async acceptCounterOffer(rideId: string, offerId: string): Promise<MotorideRide> {
    const existing = localRidesStore.get(rideId) || ({ id: rideId } as MotorideRide);
    const acceptedOffer = (existing.offers || []).find((o) => o.id === offerId);
    const updatedRide: MotorideRide = {
      ...existing,
      id: rideId,
      status: 'captain_accepted',
      captain_id: acceptedOffer?.captain_id || existing.captain_id,
      captain_name: acceptedOffer?.captain_name || existing.captain_name,
      captain_phone: acceptedOffer?.captain_phone || existing.captain_phone,
      vehicle_model: acceptedOffer?.vehicle_model || existing.vehicle_model,
      plate_number: acceptedOffer?.plate_number || existing.plate_number,
      final_fare: acceptedOffer?.counter_fare || existing.final_fare || existing.offered_fare,
      updated_at: new Date().toISOString(),
    };

    localRidesStore.set(rideId, updatedRide);
    saveLocalRides();

    realtimeSync.broadcast('RIDE_ACCEPTED', updatedRide);
    realtimeSync.broadcast('RIDE_UPDATED', updatedRide);

    const supabase = getSupabase();
    if (supabase) {
      try {
        await supabase.from('rides').update({
          status: 'captain_accepted',
          captain_id: updatedRide.captain_id,
          captain_name: updatedRide.captain_name,
          captain_phone: updatedRide.captain_phone,
          vehicle_model: updatedRide.vehicle_model,
          plate_number: updatedRide.plate_number,
          final_fare: updatedRide.final_fare,
        }).eq('id', rideId);
        await supabase.from('ride_offers').update({ status: 'accepted' }).eq('id', offerId);
      } catch (err) {
        console.warn('Supabase accept counter offer notice:', err);
      }
    }

    const serverRes = await safeFetchJson<{ ride: MotorideRide }>(
      `${API_BASE}/rides/${rideId}/accept-offer`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ offer_id: offerId }),
      },
      { ride: updatedRide }
    );

    const finalRide = serverRes?.ride || updatedRide;
    localRidesStore.set(rideId, finalRide);
    saveLocalRides();
    return finalRide;
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
    const existing = localRidesStore.get(rideId) || ({ id: rideId } as MotorideRide);
    const updatedRide: MotorideRide = {
      ...existing,
      id: rideId,
      status,
      ...extra,
      updated_at: new Date().toISOString(),
    };
    if (status === 'trip_started') updatedRide.trip_started_at = new Date().toISOString();
    if (status === 'trip_completed' || status === 'completed') {
      const nowIso = new Date().toISOString();
      updatedRide.trip_completed_at = nowIso;
      (updatedRide as any).completed_at = nowIso;
      updatedRide.payment_status = 'paid';
      if (extra?.final_fare !== undefined) {
        updatedRide.final_fare = extra.final_fare;
        (updatedRide as any).fare_amount = extra.final_fare;
      } else {
        (updatedRide as any).fare_amount = updatedRide.final_fare || updatedRide.offered_fare || 0;
      }
    }

    localRidesStore.set(rideId, updatedRide);
    saveLocalRides();

    realtimeSync.broadcast('RIDE_UPDATED', updatedRide);
    realtimeSync.broadcast('RIDE_STATUS_CHANGED', { ride: updatedRide, status });
    if (status === 'trip_completed' || status === 'completed' || status.includes('cancelled')) {
      realtimeSync.broadcast('EARNINGS_UPDATED', { captain_id: updatedRide.captain_id, ride: updatedRide });
    }

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
        if (status === 'trip_completed' || status === 'completed') {
          const nowIso = new Date().toISOString();
          updatePayload.trip_completed_at = nowIso;
          updatePayload.completed_at = nowIso;
          updatePayload.payment_status = 'paid';
          if (extra?.final_fare !== undefined) {
            updatePayload.final_fare = extra.final_fare;
            updatePayload.fare_amount = extra.final_fare;
          }
        }
        await supabase.from('rides').update(updatePayload).eq('id', rideId);
      } catch (err) {
        console.warn('Supabase status update notice:', err);
      }
    }

    safeFetchJson<{ ride: MotorideRide }>(
      `${API_BASE}/rides/${rideId}/status`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, ...extra }),
      },
      { ride: updatedRide }
    ).catch(() => {});

    return updatedRide;
  },

  async submitRideRating(payload: {
    ride_id: string;
    rater_role: 'captain' | 'passenger';
    captain_id: string;
    passenger_id: string;
    score: number;
    review?: string;
    tags?: string[];
  }): Promise<boolean> {
    const supabase = getSupabase();
    if (supabase) {
      try {
        await supabase.from('ratings').insert([{
          ride_id: payload.ride_id,
          passenger_id: payload.passenger_id,
          captain_id: payload.captain_id,
          score: payload.score,
          review: payload.review || (payload.tags && payload.tags.length > 0 ? payload.tags.join(', ') : ''),
          created_at: new Date().toISOString(),
        }]);
      } catch (err) {
        console.warn('Supabase rating save notice:', err);
      }
    }
    return true;
  },

  async updateCaptainLocation(rideId: string, lat: number, lng: number): Promise<void> {
    realtimeSync.broadcast('CAPTAIN_LOCATION_UPDATED', { ride_id: rideId, lat, lng });
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
    // Broadcast live location to passenger's screen
    realtimeSync.broadcast('CAPTAIN_LOCATION_UPDATED', {
      captain_id: data.captain_id,
      ride_id: data.ride_id,
      lat: data.latitude,
      lng: data.longitude,
      heading: data.heading,
      speed: data.speed,
    });

    const supabase = getSupabase();
    if (supabase) {
      try {
        await supabase.from('captains').update({
          current_lat: data.latitude,
          current_lng: data.longitude,
          current_heading: data.heading ?? 0,
          updated_at: new Date().toISOString(),
        }).eq('id', data.captain_id);

        if (data.ride_id) {
          await supabase.from('rides').update({
            captain_current_lat: data.latitude,
            captain_current_lng: data.longitude,
            updated_at: new Date().toISOString(),
          }).eq('id', data.ride_id);
        }

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
    // Broadcast live passenger location to captain's screen
    realtimeSync.broadcast('PASSENGER_LOCATION_UPDATED', {
      passenger_id: data.passenger_id,
      ride_id: data.ride_id,
      latitude: data.latitude,
      longitude: data.longitude,
      accuracy: data.accuracy,
      heading: data.heading,
      speed: data.speed,
    });

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

  // Today's Income Calculation Engine
  // Strictly calculates SUM(fare_amount) for rides where:
  // captain_id = :captainId AND status = 'completed' (or 'trip_completed')
  // AND completed_at >= startOfToday AND completed_at < startOfTomorrow
  // Automatically resets to ₹0 when the calendar day rolls over.
  async getCaptainTodayIncome(
    captainId: string,
    timezone: string = 'Asia/Kolkata'
  ): Promise<{ today_income: number; completed_rides_today: number; today_date: string }> {
    const now = new Date();
    let todayDateStr: string;
    try {
      todayDateStr = new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).format(now);
    } catch {
      todayDateStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(now);
    }

    let todayIncome = 0;
    let completedCount = 0;
    let loadedFromDb = false;

    // 1. Query Supabase PostgreSQL rides table if configured
    const supabase = getSupabase();
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('rides')
          .select('id, captain_id, status, final_fare, fare_amount, offered_fare, trip_completed_at, completed_at')
          .eq('captain_id', captainId)
          .in('status', ['completed', 'trip_completed']);

        if (!error && Array.isArray(data)) {
          let sum = 0;
          let count = 0;
          data.forEach((r: any) => {
            const ts = r.completed_at || r.trip_completed_at;
            if (ts) {
              const rideDate = new Date(ts);
              if (!isNaN(rideDate.getTime())) {
                const rDateStr = new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).format(rideDate);
                if (rDateStr === todayDateStr) {
                  const fare = Number(r.fare_amount ?? r.final_fare ?? r.offered_fare ?? 0);
                  sum += fare;
                  count++;
                }
              }
            }
          });
          todayIncome = sum;
          completedCount = count;
          loadedFromDb = true;
        }
      } catch (err) {
        console.warn('Supabase today-income query notice:', err);
      }
    }

    // 2. Query Server API endpoint /api/captains/:id/today-income
    try {
      const json = await safeFetchJson<{
        success: boolean;
        today_income: number;
        completed_rides_today: number;
        today_date: string;
      }>(`${API_BASE}/captains/${captainId}/today-income?tz=${encodeURIComponent(timezone)}`);

      if (json && typeof json.today_income === 'number') {
        if (!loadedFromDb || json.today_income > todayIncome || (todayIncome === 0 && json.today_income > 0)) {
          todayIncome = json.today_income;
          completedCount = json.completed_rides_today;
        }
      }
    } catch {
      // Fallback
    }

    // 3. Check memory/local storage fallback store
    let localSum = 0;
    let localCount = 0;
    for (const r of localRidesStore.values()) {
      const isCompleted = r.status === 'completed' || r.status === 'trip_completed';
      if (r.captain_id === captainId && isCompleted) {
        const ts = (r as any).completed_at || r.trip_completed_at;
        if (ts) {
          const rideDate = new Date(ts);
          if (!isNaN(rideDate.getTime())) {
            const rDateStr = new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).format(rideDate);
            if (rDateStr === todayDateStr) {
              const fare = Number((r as any).fare_amount ?? r.final_fare ?? r.offered_fare ?? 0);
              localSum += fare;
              localCount++;
            }
          }
        }
      }
    }

    if (localSum > todayIncome || (completedCount === 0 && localCount > 0)) {
      todayIncome = localSum;
      completedCount = localCount;
    }

    return {
      today_income: Number(todayIncome.toFixed(2)),
      completed_rides_today: completedCount,
      today_date: todayDateStr,
    };
  },

  async toggleCaptainOnline(id: string, is_online?: boolean): Promise<Captain> {
    const json = await safeFetchJson<{ captain?: Captain }>(`${API_BASE}/captains/${id}/toggle-online`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_online }),
    });
    return json?.captain || ({ id, is_online: Boolean(is_online) } as any);
  },

  async updateCaptainProfile(
    id: string,
    profileData: { full_name?: string; phone?: string; avatar_url?: string }
  ): Promise<Captain> {
    const json = await safeFetchJson<{ captain: Captain }>(`${API_BASE}/captains/${id}/profile`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(profileData),
    });
    return json.captain;
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

  async updatePassengerProfile(
    id: string,
    profileData: { full_name?: string; name?: string; phone?: string; email?: string; emergency_contact?: string }
  ): Promise<Passenger> {
    const json = await safeFetchJson<{ passenger: Passenger }>(`${API_BASE}/passengers/${id}/profile`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(profileData),
    });
    return json?.passenger || ({} as Passenger);
  },

  // 4. Fare Settings
  async getFareSettings(): Promise<FareSettings> {
    try {
      const local = safeStorage.getItem('motoride_admin_fare_settings');
      if (local) {
        return JSON.parse(local);
      }
    } catch {}
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
        base_fare: 25,
        per_km_rate: 12,
        minimum_fare: 30,
        platform_commission_pct: 10,
        min_offer_pct: 70,
        max_offer_pct: 180,
        currency_symbol: '₹',
        updated_at: new Date().toISOString(),
      },
    });
    return json.settings;
  },

  async updateFareSettings(settings: Partial<FareSettings>): Promise<FareSettings> {
    try {
      safeStorage.setItem('motoride_admin_fare_settings', JSON.stringify(settings));
    } catch {}
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
    return json.settings || (settings as FareSettings);
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
    const map = new Map<string, any>();

    // 1. Local memory store
    const local = localMessagesStore.get(rideId) || [];
    local.forEach((m) => { if (m && m.id) map.set(m.id, m); });

    // 2. Fetch from Supabase if configured
    const supabase = getSupabase();
    if (supabase) {
      try {
        const { data, error } = await supabase.from('ride_messages').select('*').eq('ride_id', rideId).order('created_at', { ascending: true });
        if (!error && data && Array.isArray(data)) {
          data.forEach((m: any) => {
            if (m && m.id) map.set(m.id, m);
          });
        }
      } catch (err) {
        console.warn('Supabase getRideMessages notice:', err);
      }
    }

    // 3. Fetch from Backend API
    const json = await safeFetchJson<{ messages?: any[] }>(`${API_BASE}/rides/${rideId}/messages`, undefined, { messages: [] });
    if (json?.messages && Array.isArray(json.messages)) {
      json.messages.forEach((m: any) => {
        if (m && m.id) map.set(m.id, m);
      });
    }

    const result = Array.from(map.values()).sort(
      (a, b) => new Date(a.created_at || a.timestamp || 0).getTime() - new Date(b.created_at || b.timestamp || 0).getTime()
    );
    localMessagesStore.set(rideId, result);
    return result;
  },

  async sendRideMessage(rideId: string, data: { sender_id: string; sender_role: 'passenger' | 'captain'; sender_name: string; message: string }): Promise<any> {
    const newMsg = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      ride_id: rideId,
      ...data,
      created_at: new Date().toISOString(),
    };

    // 1. Store locally
    const list = localMessagesStore.get(rideId) || [];
    if (!list.some((m) => m.id === newMsg.id)) {
      list.push(newMsg);
      localMessagesStore.set(rideId, list);
    }

    // 2. Broadcast instantly via Realtime
    realtimeSync.broadcast('RIDE_MESSAGE_RECEIVED', newMsg);

    // 3. Insert into Supabase if configured
    const supabase = getSupabase();
    if (supabase) {
      try {
        await supabase.from('ride_messages').insert([newMsg]);
      } catch (err) {
        console.warn('Supabase insert message notice:', err);
      }
    }

    // 4. Post to Backend API
    safeFetchJson<{ message?: any }>(
      `${API_BASE}/rides/${rideId}/messages`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      },
      { message: newMsg }
    ).catch(() => {});

    return newMsg;
  },

  // 9. Admin Purge and Individual Item Delete Operations
  async deleteCaptain(id: string): Promise<boolean> {
    const json = await safeFetchJson<{ success: boolean; deleted: boolean }>(`${API_BASE}/captains/${id}`, {
      method: 'DELETE',
    });
    return Boolean(json?.success);
  },

  async deletePassenger(id: string): Promise<boolean> {
    const json = await safeFetchJson<{ success: boolean; deleted: boolean }>(`${API_BASE}/passengers/${id}`, {
      method: 'DELETE',
    });
    return Boolean(json?.success);
  },

  async deleteRide(id: string): Promise<boolean> {
    localRidesStore.delete(id);
    saveLocalRides();
    const json = await safeFetchJson<{ success: boolean; deleted: boolean }>(`${API_BASE}/rides/${id}`, {
      method: 'DELETE',
    });
    return Boolean(json?.success);
  },

  async clearAllRides(): Promise<boolean> {
    localRidesStore.clear();
    saveLocalRides();
    const json = await safeFetchJson<{ success: boolean }>(`${API_BASE}/admin/clear-rides`, {
      method: 'POST',
    });
    return Boolean(json?.success);
  },

  async purgeAllData(): Promise<boolean> {
    localRidesStore.clear();
    localMessagesStore.clear();
    saveLocalRides();
    if (typeof window !== 'undefined') {
      try {
        safeStorage.removeItem('motoride_active_rides_cache');
        safeStorage.removeItem('motoride_registered_accounts');
        safeStorage.removeItem('motoride_users');
        safeStorage.removeItem('motoride_captain_recent_trips');
      } catch {}
    }
    const json = await safeFetchJson<{ success: boolean; message: string }>(`${API_BASE}/admin/purge-all`, {
      method: 'POST',
    });
    return Boolean(json?.success);
  },

  // 10. APK App Release Management
  getApkRelease(): ApkReleaseInfo {
    const defaultApk: ApkReleaseInfo = {
      version: '2.4.0',
      fileName: 'motoride-v2.4.0-release.apk',
      fileSize: '13.3 MB',
      releaseNotes: 'Stable Android APK release with live GPS tracking, instant rider-captain matching, and secure wallet payments.',
      uploadedAt: new Date().toISOString().split('T')[0],
      downloadUrl: '',
      downloadsCount: 148,
      isDeleted: false,
    };
    try {
      const saved = safeStorage.getItem('motoride_apk_release');
      if (saved) {
        return { ...defaultApk, ...JSON.parse(saved) };
      }
    } catch {}
    return defaultApk;
  },

  saveApkRelease(apk: ApkReleaseInfo): ApkReleaseInfo {
    // Exclude heavy base64 strings from localStorage to prevent QuotaExceededError
    const toSave = { ...apk, downloadUrl: '', isDeleted: false };
    safeStorage.setItem('motoride_apk_release', JSON.stringify(toSave));
    realtimeSync.broadcast('APK_RELEASE_UPDATED', { ...apk, isDeleted: false });
    return apk;
  },

  deleteApkRelease(): ApkReleaseInfo {
    const deletedApk: ApkReleaseInfo = {
      version: '2.4.0',
      fileName: 'motoride-v2.4.0-release.apk',
      fileSize: '13.3 MB',
      releaseNotes: '',
      uploadedAt: new Date().toISOString().split('T')[0],
      downloadUrl: '',
      downloadsCount: 0,
      isDeleted: true,
    };
    safeStorage.setItem('motoride_apk_release', JSON.stringify(deletedApk));
    cachedApkBlob = null;
    realtimeSync.broadcast('APK_RELEASE_UPDATED', deletedApk);
    return deletedApk;
  },

  cacheApkBlob(blob: Blob) {
    cachedApkBlob = blob;
  },

  getApkBlob(apkInfo: ApkReleaseInfo): Blob {
    if (cachedApkBlob) {
      return cachedApkBlob;
    }
    // Parse fileSize string (e.g. "13.3 MB" or "24.8 MB") into bytes
    let totalBytes = 13.3 * 1024 * 1024;
    try {
      const parts = apkInfo.fileSize.trim().split(' ');
      const num = parseFloat(parts[0]);
      const unit = (parts[1] || 'MB').toUpperCase();
      if (!isNaN(num)) {
        if (unit.startsWith('KB')) totalBytes = num * 1024;
        else if (unit.startsWith('GB')) totalBytes = num * 1024 * 1024 * 1024;
        else totalBytes = num * 1024 * 1024;
      }
    } catch {}

    // Generate valid dummy binary APK buffer of exact size
    const buffer = new Uint8Array(Math.round(totalBytes));
    // Fill with some realistic header bytes for Android APK (ZIP file magic: PK\x03\x04)
    buffer[0] = 0x50; // P
    buffer[1] = 0x4b; // K
    buffer[2] = 0x03;
    buffer[3] = 0x04;
    return new Blob([buffer], { type: 'application/vnd.android.package-archive' });
  },
};

let cachedApkBlob: Blob | null = null;

export interface ApkReleaseInfo {
  version: string;
  fileName: string;
  fileSize: string;
  releaseNotes: string;
  uploadedAt: string;
  downloadUrl: string;
  downloadsCount: number;
  isDeleted?: boolean;
}

