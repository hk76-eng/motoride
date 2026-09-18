import { Router, Request, Response } from 'express';
import {
  ridesStore,
  captainsStore,
  passengersStore,
  walletsStore,
  walletTransactionsStore,
  fareSettings,
  updateFareSettings,
  qrSettings,
  updateQRSettings,
  notificationsStore,
  broadcastEvent,
  subscribeSSE,
  calculateCaptainTodayEarnings,
  calculateCaptainTotalEarnings,
  getAdminStats,
  upsertPassengerLocation,
  getPassengerLocation,
  addRideMessage,
  getRideMessages,
  accountsStore,
  ServerRegisteredAccount,
  persistDbToDisk,
} from './motorideDb';
import { MotorideRide, RideOffer, MotorideRideStatus, WalletTransaction, Captain, Passenger } from '../src/types/motoride';
import { backendHaversineDistanceKm } from './fareEngine';

export const motorideRouter = Router();

// 1. Real-Time Server-Sent Events (SSE) Stream for cross-device synchronization
motorideRouter.get('/realtime/stream', (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  // Send initial connected event
  res.write(`data: ${JSON.stringify({ event: 'CONNECTED', timestamp: Date.now() })}\n\n`);

  const unsubscribe = subscribeSSE((data) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  });

  // Keep-alive heartbeat ping every 25 seconds
  const pingInterval = setInterval(() => {
    res.write(`data: ${JSON.stringify({ event: 'PING', timestamp: Date.now() })}\n\n`);
  }, 25000);

  req.on('close', () => {
    clearInterval(pingInterval);
    unsubscribe();
  });
});

// 2. Rides Management
motorideRouter.get('/rides', (req: Request, res: Response) => {
  const { status, passenger_id, captain_id, active_for_captain } = req.query;
  let list = Array.from(ridesStore.values()).sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  if (active_for_captain === 'true') {
    // Return rides available for captain feed: 'requested' or 'captain_offered'
    list = list.filter((r) => r.status === 'requested' || r.status === 'captain_offered');
  } else {
    if (status && typeof status === 'string' && status !== 'all') {
      list = list.filter((r) => r.status === status);
    }
    if (passenger_id && typeof passenger_id === 'string') {
      list = list.filter((r) => r.passenger_id === passenger_id);
    }
    if (captain_id && typeof captain_id === 'string') {
      list = list.filter((r) => r.captain_id === captain_id);
    }
  }

  res.json({ success: true, rides: list });
});

motorideRouter.get('/rides/:id', (req: Request, res: Response) => {
  const ride = ridesStore.get(req.params.id);
  if (!ride) {
    return res.status(404).json({ error: 'Ride not found' });
  }
  res.json({ success: true, ride });
});

// Ride Chat Messages Endpoints
motorideRouter.get('/rides/:id/messages', (req: Request, res: Response) => {
  const messages = getRideMessages(req.params.id);
  res.json({ success: true, messages });
});

motorideRouter.post('/rides/:id/messages', (req: Request, res: Response) => {
  const { sender_id, sender_role, sender_name, message } = req.body;
  if (!message || !sender_id || !sender_role) {
    return res.status(400).json({ error: 'Missing required message parameters' });
  }
  const newMsg = addRideMessage({
    ride_id: req.params.id,
    sender_id,
    sender_role,
    sender_name: sender_name || (sender_role === 'captain' ? 'Captain' : 'Passenger'),
    message,
  });
  res.status(201).json({ success: true, message: newMsg });
});

// Create new ride request by passenger
motorideRouter.post('/rides', (req: Request, res: Response) => {
  try {
    const {
      passenger_id = req.body.passenger_id || `psg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      passenger_name = req.body.passenger_name || 'Passenger',
      passenger_phone = req.body.passenger_phone || '',
      pickup_address = 'Sector 70, Mohali Market',
      pickup_lat = 30.704649,
      pickup_lng = 76.717873,
      dropoff_address = 'Phase 8B Industrial Area, Mohali',
      dropoff_lat = 30.718214,
      dropoff_lng = 76.732124,
      distance_km = 3.5,
      duration_minutes = 10,
      estimated_fare = 65,
      offered_fare = 70,
      ride_type = 'bike',
      payment_method = 'cash',
    } = req.body;

    const rideId = req.body.id || `ride_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const rideCode = req.body.ride_code || `RIDE-${Math.floor(1000 + Math.random() * 9000)}`;
    const now = req.body.created_at || new Date().toISOString();

    const existingRide = ridesStore.get(rideId);
    const newRide: MotorideRide = {
      id: rideId,
      ride_code: rideCode,
      passenger_id,
      passenger_name,
      passenger_phone,
      pickup_address,
      pickup_lat: Number(pickup_lat),
      pickup_lng: Number(pickup_lng),
      dropoff_address,
      dropoff_lat: Number(dropoff_lat),
      dropoff_lng: Number(dropoff_lng),
      distance_km: Number(distance_km),
      duration_minutes: Number(duration_minutes),
      estimated_fare: Number(estimated_fare),
      offered_fare: Number(offered_fare),
      final_fare: Number(req.body.final_fare || offered_fare),
      ride_type,
      status: req.body.status || existingRide?.status || 'requested',
      payment_method,
      payment_status: req.body.payment_status || 'pending',
      created_at: now,
      updated_at: new Date().toISOString(),
      offers: req.body.offers || existingRide?.offers || [],
      captain_id: req.body.captain_id || existingRide?.captain_id,
      captain_name: req.body.captain_name || existingRide?.captain_name,
      captain_phone: req.body.captain_phone || existingRide?.captain_phone,
      vehicle_model: req.body.vehicle_model || existingRide?.vehicle_model,
      plate_number: req.body.plate_number || existingRide?.plate_number,
    };

    ridesStore.set(rideId, newRide);

    // Broadcast in real time to all captains and listeners
    broadcastEvent('RIDE_CREATED', newRide);

    // Add notification
    notificationsStore.unshift({
      id: `notif_${Date.now()}`,
      role_target: 'captain',
      title: 'New Ride Request',
      message: `${passenger_name} requested a ${ride_type.toUpperCase()} ride for ₹${offered_fare} (${distance_km} km)`,
      type: 'info',
      ride_id: rideId,
      is_read: false,
      created_at: now,
    });

    // Broadcast to real-time SSE stream so real active online captains can receive the request
    broadcastEvent('RIDE_CREATED', newRide);

    res.status(201).json({ success: true, ride: newRide });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to create ride' });
  }
});

// Atomic Ride Acceptance by Captain (with race condition prevention)
motorideRouter.post('/rides/:id/accept', (req: Request, res: Response) => {
  const ride = ridesStore.get(req.params.id);
  if (!ride) {
    return res.status(404).json({ error: 'Ride not found' });
  }

  // Race condition check: Only 'requested' or 'captain_offered' rides can be accepted
  if (ride.status !== 'requested' && ride.status !== 'captain_offered') {
    return res.status(409).json({
      error: 'This ride has already been accepted or cancelled by another captain',
      current_status: ride.status,
    });
  }

  const {
    captain_id,
    captain_name,
    captain_phone,
    vehicle_model,
    plate_number,
    accepted_fare,
  } = req.body;

  if (!captain_id || !captain_name) {
    return res.status(400).json({ error: 'Registered captain identification is required to accept ride' });
  }

  const finalFare = typeof accepted_fare === 'number' ? accepted_fare : ride.offered_fare;

  // Lock and update ride status atomically
  ride.captain_id = captain_id;
  ride.captain_name = captain_name;
  ride.captain_phone = captain_phone || '';
  ride.vehicle_model = vehicle_model || 'Bike';
  ride.plate_number = plate_number || '';
  ride.final_fare = finalFare;
  ride.status = 'captain_accepted';
  ride.updated_at = new Date().toISOString();

  ridesStore.set(ride.id, ride);

  // Broadcast to all connected devices immediately
  broadcastEvent('RIDE_ACCEPTED', ride);
  broadcastEvent('RIDE_UPDATED', ride);

  // Notify passenger
  notificationsStore.unshift({
    id: `notif_${Date.now()}`,
    user_id: ride.passenger_id,
    role_target: 'passenger',
    title: 'Captain Found!',
    message: `${captain_name} accepted your ride (${vehicle_model} - ${plate_number}). Arriving soon.`,
    type: 'success',
    ride_id: ride.id,
    is_read: false,
    created_at: new Date().toISOString(),
  });

  res.json({ success: true, ride });
});

// Counter-offer by Captain (inDrive style)
motorideRouter.post('/rides/:id/offer', (req: Request, res: Response) => {
  const ride = ridesStore.get(req.params.id);
  if (!ride) {
    return res.status(404).json({ error: 'Ride not found' });
  }

  if (ride.status !== 'requested' && ride.status !== 'captain_offered') {
    return res.status(400).json({ error: 'Cannot offer on ride that is not in requested state' });
  }

  const {
    captain_id,
    captain_name,
    captain_phone,
    vehicle_model,
    plate_number,
    rating = 4.9,
    counter_fare,
  } = req.body;

  if (!captain_id || !captain_name) {
    return res.status(400).json({ error: 'Valid captain identification is required to submit offer' });
  }

  if (!counter_fare || isNaN(Number(counter_fare))) {
    return res.status(400).json({ error: 'Valid counter fare is required' });
  }

  const offer: RideOffer = {
    id: `off_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    ride_id: ride.id,
    captain_id,
    captain_name,
    captain_phone,
    vehicle_model,
    plate_number,
    rating: Number(rating),
    counter_fare: Number(counter_fare),
    status: 'pending',
    created_at: new Date().toISOString(),
  };

  ride.offers = ride.offers || [];
  // Remove prior offer from same captain if exists
  ride.offers = ride.offers.filter((o) => o.captain_id !== captain_id);
  ride.offers.push(offer);
  ride.status = 'captain_offered';
  ride.updated_at = new Date().toISOString();

  ridesStore.set(ride.id, ride);

  broadcastEvent('RIDE_OFFER_RECEIVED', { ride, offer });
  broadcastEvent('RIDE_UPDATED', ride);

  res.json({ success: true, ride, offer });
});

// Passenger accepts a specific counter-offer
motorideRouter.post('/rides/:id/accept-offer', (req: Request, res: Response) => {
  const ride = ridesStore.get(req.params.id);
  if (!ride) {
    return res.status(404).json({ error: 'Ride not found' });
  }

  const { offer_id } = req.body;
  const offer = (ride.offers || []).find((o) => o.id === offer_id);
  if (!offer) {
    return res.status(404).json({ error: 'Offer not found' });
  }

  ride.captain_id = offer.captain_id;
  ride.captain_name = offer.captain_name;
  ride.captain_phone = offer.captain_phone;
  ride.vehicle_model = offer.vehicle_model;
  ride.plate_number = offer.plate_number;
  ride.final_fare = offer.counter_fare;
  ride.status = 'captain_accepted';
  ride.updated_at = new Date().toISOString();

  // Mark this offer accepted and others rejected
  ride.offers?.forEach((o) => {
    o.status = o.id === offer_id ? 'accepted' : 'rejected';
  });

  ridesStore.set(ride.id, ride);

  broadcastEvent('RIDE_ACCEPTED', ride);
  broadcastEvent('RIDE_UPDATED', ride);

  res.json({ success: true, ride });
});

// Update Ride Status (captain_arrived, trip_started, trip_completed, cancelled)
motorideRouter.post('/rides/:id/status', (req: Request, res: Response) => {
  let ride = ridesStore.get(req.params.id);
  if (!ride) {
    const { status, cancellation_reason } = req.body as {
      status?: MotorideRideStatus;
      cancellation_reason?: string;
    };
    if (status && (status === 'cancelled_by_passenger' || status === 'cancelled_by_captain')) {
      const stubRide = {
        id: req.params.id,
        status,
        cancellation_reason: cancellation_reason || 'Cancelled by user',
        updated_at: new Date().toISOString(),
      };
      broadcastEvent('RIDE_STATUS_CHANGED', { ride: stubRide, status });
      broadcastEvent('RIDE_UPDATED', stubRide);
      return res.json({ success: true, ride: stubRide });
    }
    return res.status(404).json({ error: 'Ride not found' });
  }

  const { status, cancellation_reason, final_distance_km, final_fare } = req.body as {
    status: MotorideRideStatus;
    cancellation_reason?: string;
    final_distance_km?: number;
    final_fare?: number;
  };

  const validStatuses: MotorideRideStatus[] = [
    'requested',
    'captain_offered',
    'captain_accepted',
    'captain_arrived',
    'trip_started',
    'trip_completed',
    'cancelled_by_passenger',
    'cancelled_by_captain',
  ];

  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: `Invalid status: ${status}` });
  }

  const now = new Date().toISOString();
  ride.status = status;
  ride.updated_at = now;

  if (cancellation_reason) {
    ride.cancellation_reason = cancellation_reason;
  }

  if (status === 'trip_started') {
    ride.trip_started_at = now;
  }

  if (status === 'trip_completed') {
    ride.trip_completed_at = now;
    if (final_distance_km !== undefined) {
      ride.distance_km = Number(final_distance_km);
    }
    if (final_fare !== undefined) {
      ride.final_fare = Number(final_fare);
    }
    ride.payment_status = 'paid';

    // Credit captain earnings and deduct platform commission
    if (ride.captain_id) {
      const gross = Number(ride.final_fare);
      const commission = (gross * fareSettings.platform_commission_pct) / 100;
      const net = gross - commission;

      const currentWallet = walletsStore.get(ride.captain_id) || { balance: 100, currency: '₹' };
      currentWallet.balance = Number((currentWallet.balance + net).toFixed(2));
      walletsStore.set(ride.captain_id, currentWallet);

      walletTransactionsStore.unshift({
        id: `tx_${Date.now()}`,
        wallet_id: `w_${ride.captain_id}`,
        user_id: ride.captain_id,
        amount: net,
        type: 'credit',
        category: 'ride_earning',
        description: `Net earnings from ride ${ride.ride_code} (Gross: ₹${gross}, Commission ${fareSettings.platform_commission_pct}%: -₹${commission.toFixed(2)})`,
        reference_ride_id: ride.id,
        created_at: now,
      });

      // Update captain stats
      const cpt = captainsStore.get(ride.captain_id);
      if (cpt) {
        cpt.total_rides = (cpt.total_rides || 0) + 1;
        cpt.today_earnings = calculateCaptainTodayEarnings(cpt.id);
        cpt.total_earnings = calculateCaptainTotalEarnings(cpt.id);
      }
    }
  }

  ridesStore.set(ride.id, ride);

  broadcastEvent('RIDE_STATUS_CHANGED', { ride, status });
  broadcastEvent('RIDE_UPDATED', ride);

  // Send contextual notification
  let notifMsg = `Ride status updated to ${status.replace('_', ' ')}`;
  if (status === 'captain_arrived') notifMsg = 'Your captain has arrived at the pickup location!';
  if (status === 'trip_started') notifMsg = 'Trip started. Have a safe journey!';
  if (status === 'trip_completed') notifMsg = `Trip completed. Total Fare: ₹${ride.final_fare}. Thank you!`;
  if (status.includes('cancelled')) notifMsg = `Ride was cancelled: ${cancellation_reason || 'No reason provided'}`;

  notificationsStore.unshift({
    id: `notif_${Date.now()}`,
    role_target: 'all',
    title: 'Ride Update',
    message: notifMsg,
    type: status.includes('cancelled') ? 'warning' : 'info',
    ride_id: ride.id,
    is_read: false,
    created_at: now,
  });

  res.json({ success: true, ride });
});

// Update Captain Live GPS Coordinates during active ride
motorideRouter.post('/rides/:id/location', (req: Request, res: Response) => {
  const ride = ridesStore.get(req.params.id);
  if (!ride) {
    return res.status(404).json({ error: 'Ride not found' });
  }

  const { lat, lng } = req.body;
  if (typeof lat !== 'number' || typeof lng !== 'number') {
    return res.status(400).json({ error: 'lat and lng required' });
  }

  ride.captain_current_lat = lat;
  ride.captain_current_lng = lng;
  ride.updated_at = new Date().toISOString();
  ridesStore.set(ride.id, ride);

  // Also update captain profile's current location
  if (ride.captain_id && captainsStore.has(ride.captain_id)) {
    const cpt = captainsStore.get(ride.captain_id)!;
    cpt.current_lat = lat;
    cpt.current_lng = lng;
    cpt.updated_at = new Date().toISOString();
  }

  broadcastEvent('CAPTAIN_LOCATION_UPDATED', {
    ride_id: ride.id,
    captain_id: ride.captain_id,
    lat,
    lng,
    timestamp: Date.now(),
  });

  res.json({ success: true, lat, lng });
});

// Update Passenger Live GPS Coordinates during active booking / ride
motorideRouter.post('/passenger-location', (req: Request, res: Response) => {
  const { passenger_id, ride_id, latitude, longitude, accuracy, heading, speed } = req.body;
  if (!passenger_id || typeof latitude !== 'number' || typeof longitude !== 'number') {
    return res.status(400).json({ error: 'passenger_id, latitude, and longitude are required' });
  }

  const record = upsertPassengerLocation({
    passenger_id,
    ride_id: ride_id || null,
    latitude: Number(latitude),
    longitude: Number(longitude),
    accuracy: typeof accuracy === 'number' ? Number(accuracy) : null,
    heading: typeof heading === 'number' ? Number(heading) : null,
    speed: typeof speed === 'number' ? Number(speed) : null,
  });

  // If associated with a ride, update the ride record pickup / live coordinates
  if (ride_id && ridesStore.has(ride_id)) {
    const ride = ridesStore.get(ride_id)!;
    // Keep pickup coordinates in sync if still in requested state
    if (ride.status === 'requested') {
      ride.pickup_lat = Number(latitude);
      ride.pickup_lng = Number(longitude);
    }
  }

  // Broadcast in real-time to all connected devices / captain apps
  broadcastEvent('PASSENGER_LOCATION_UPDATED', record);

  res.json({ success: true, location: record });
});

// Proxy Geocode Search with Fallback (Prevents HTML response parse errors from Nominatim)
motorideRouter.get('/geocode/search', async (req: Request, res: Response) => {
  const query = (req.query.q as string || '').trim();
  if (!query) {
    return res.json({ success: true, results: [] });
  }

  const localPresets = [
    { name: 'Sector 70, Mohali Market', lat: 30.704649, lng: 76.717873 },
    { name: 'Phase 8B Industrial Area, Mohali', lat: 30.718214, lng: 76.732124 },
    { name: 'Sector 62 Phase 8, Mohali City Center', lat: 30.705892, lng: 76.726418 },
    { name: 'Sector 17 Plaza, Chandigarh', lat: 30.739834, lng: 76.782702 },
    { name: 'ISBT Sector 43, Chandigarh', lat: 30.722511, lng: 76.745632 },
    { name: 'Shaheed Bhagat Singh Int. Airport Mohali', lat: 30.673523, lng: 76.788544 },
    { name: 'VR Punjab Mall, Kharar Road', lat: 30.748231, lng: 76.689241 },
    { name: 'Elante Mall, Industrial Area Phase 1', lat: 30.705423, lng: 76.801235 },
    { name: 'Chandigarh Railway Station, Daria', lat: 30.704123, lng: 76.828456 },
    { name: 'Max Super Speciality Hospital, Phase 6', lat: 30.732145, lng: 76.708234 },
  ];

  const matched = localPresets.filter((item) =>
    item.name.toLowerCase().includes(query.toLowerCase())
  );

  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5&addressdetails=1`;
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'MotorideRideApp/2.0 (contact@motoride.app)',
        'Accept': 'application/json',
      },
      signal: AbortSignal.timeout(3000),
    });

    const text = await response.text();
    if (text && !text.trim().startsWith('<') && !text.trim().startsWith('The page')) {
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const results = parsed.map((item: any) => ({
          name: item.display_name.split(',').slice(0, 3).join(', ').trim(),
          lat: parseFloat(item.lat),
          lng: parseFloat(item.lon),
        }));
        return res.json({ success: true, results });
      }
    }
  } catch {}

  res.json({ success: true, results: matched });
});

// Proxy Reverse Geocode
motorideRouter.get('/geocode/reverse', async (req: Request, res: Response) => {
  const { lat, lng } = req.query;
  if (!lat || !lng) {
    return res.json({ success: true, address: 'Current Location' });
  }

  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`;
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'MotorideRideApp/2.0 (contact@motoride.app)',
        'Accept': 'application/json',
      },
      signal: AbortSignal.timeout(3000),
    });

    const text = await response.text();
    if (text && !text.trim().startsWith('<') && !text.trim().startsWith('The page')) {
      const parsed = JSON.parse(text);
      if (parsed && parsed.display_name) {
        const shortName = parsed.display_name.split(',').slice(0, 3).join(', ').trim();
        return res.json({ success: true, address: shortName });
      }
    }
  } catch {}

  res.json({ success: true, address: `Location (${Number(lat).toFixed(4)}, ${Number(lng).toFixed(4)})` });
});

// Get Latest Passenger Live Location
motorideRouter.get('/rides/:id/passenger-location', (req: Request, res: Response) => {
  const ride = ridesStore.get(req.params.id);
  const loc = getPassengerLocation(req.params.id, ride?.passenger_id);
  if (!loc) {
    if (ride) {
      // Return pickup coordinates as initial location
      return res.json({
        success: true,
        location: {
          passenger_id: ride.passenger_id,
          ride_id: ride.id,
          latitude: ride.pickup_lat,
          longitude: ride.pickup_lng,
          accuracy: 15,
          heading: 0,
          speed: 0,
          updated_at: ride.updated_at,
        },
      });
    }
    return res.status(404).json({ error: 'Passenger location not found' });
  }
  res.json({ success: true, location: loc });
});

// 3. Captains API
// Get all available captains with proximity calculation and nearest captain flagged
motorideRouter.get('/captains/available', (req: Request, res: Response) => {
  const { lat, lng } = req.query;
  const userLat = typeof lat === 'string' ? parseFloat(lat) : null;
  const userLng = typeof lng === 'string' ? parseFloat(lng) : null;

  let availableList = Array.from(captainsStore.values()).filter(
    (c) => c.is_online !== false && c.is_approved !== false && c.is_active !== false
  );

  // If user coordinates provided, check if captains are within reasonable distance.
  // If captains are seeded in another city/demo coordinate (> 25km away), dynamically cluster
  // available captains in the user's neighborhood so the nearest captain always shows!
  if (userLat !== null && userLng !== null && !isNaN(userLat) && !isNaN(userLng)) {
    const anyClose = availableList.some((c) => {
      if (c.current_lat == null || c.current_lng == null) return false;
      const d = backendHaversineDistanceKm(userLat, userLng, c.current_lat, c.current_lng);
      return d <= 25;
    });

    if (!anyClose) {
      const offsets = [
        { dLat: 0.0031, dLng: 0.0028, heading: 45 },   // ~400m NE (Nearest Captain)
        { dLat: -0.0045, dLng: 0.0055, heading: 120 }, // ~800m SE
        { dLat: 0.0062, dLng: -0.0042, heading: 290 }, // ~1.1km NW
      ];

      availableList.forEach((cpt, idx) => {
        const off = offsets[idx % offsets.length];
        cpt.current_lat = Number((userLat + off.dLat).toFixed(6));
        cpt.current_lng = Number((userLng + off.dLng).toFixed(6));
        cpt.current_heading = off.heading;
        cpt.updated_at = new Date().toISOString();
        captainsStore.set(cpt.id, cpt);
      });
    }

    const enriched = availableList
      .map((cpt) => {
        const cLat = cpt.current_lat ?? userLat;
        const cLng = cpt.current_lng ?? userLng;
        const distKm = Number(backendHaversineDistanceKm(userLat, userLng, cLat, cLng).toFixed(2));
        const etaMinutes = Math.max(1, Math.round(distKm * 3.2));
        return {
          ...cpt,
          distance_km: distKm,
          eta_minutes: etaMinutes,
        };
      })
      .sort((a, b) => a.distance_km - b.distance_km);

    if (enriched.length > 0) {
      (enriched[0] as any).is_nearest = true;
    }

    return res.json({
      success: true,
      captains: enriched,
      nearest_captain: enriched[0] || null,
    });
  }

  res.json({
    success: true,
    captains: availableList,
    nearest_captain: availableList[0] || null,
  });
});

// Update Captain Live GPS Coordinates (active ride or roaming)
motorideRouter.post('/captain-location', (req: Request, res: Response) => {
  const { captain_id, ride_id, latitude, longitude, heading, accuracy, speed } = req.body;
  if (!captain_id || typeof latitude !== 'number' || typeof longitude !== 'number') {
    return res.status(400).json({ error: 'captain_id, latitude, and longitude are required' });
  }

  let cpt = captainsStore.get(captain_id);
  if (!cpt) {
    cpt = {
      id: captain_id,
      profile_id: `prof_${captain_id}`,
      full_name: 'Captain Online',
      phone: '+91 98765 00000',
      is_online: true,
      is_approved: true,
      is_active: true,
      current_lat: latitude,
      current_lng: longitude,
      current_heading: typeof heading === 'number' ? heading : 45,
      rating: 4.92,
      total_rides: 38,
      today_earnings: 0,
      total_earnings: 8200,
      vehicle: {
        id: `veh_${captain_id}`,
        captain_id,
        model: 'Honda CB Shine PB65B1010',
        plate_number: 'PB65B1010',
        vehicle_type: 'bike',
        color: 'Black',
        is_active: true,
      },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    captainsStore.set(captain_id, cpt);
  } else {
    cpt.current_lat = latitude;
    cpt.current_lng = longitude;
    if (typeof heading === 'number') cpt.current_heading = heading;
    cpt.is_online = true;
    cpt.updated_at = new Date().toISOString();
    captainsStore.set(captain_id, cpt);
  }

  if (ride_id && ridesStore.has(ride_id)) {
    const ride = ridesStore.get(ride_id)!;
    ride.captain_current_lat = latitude;
    ride.captain_current_lng = longitude;
    if (typeof heading === 'number') ride.captain_heading = heading;
    ride.updated_at = new Date().toISOString();
  }

  const payload = {
    captain_id,
    ride_id: ride_id || null,
    latitude,
    longitude,
    heading: typeof heading === 'number' ? heading : 0,
    accuracy: typeof accuracy === 'number' ? accuracy : 15,
    speed: typeof speed === 'number' ? speed : 0,
    timestamp: Date.now(),
  };

  broadcastEvent('CAPTAIN_LOCATION_UPDATED', payload);
  broadcastEvent('CAPTAINS_UPDATED', Array.from(captainsStore.values()));

  res.json({ success: true, location: payload, captain: cpt });
});

motorideRouter.get('/captains', (req: Request, res: Response) => {
  const list = Array.from(captainsStore.values()).map((cpt) => ({
    ...cpt,
    today_earnings: calculateCaptainTodayEarnings(cpt.id),
    total_earnings: calculateCaptainTotalEarnings(cpt.id),
    wallet_balance: (walletsStore.get(cpt.id) || { balance: 500 }).balance,
  }));
  res.json({ success: true, captains: list });
});

motorideRouter.post('/captains', (req: Request, res: Response) => {
  const { id, full_name, email, phone, vehicle_model, plate_number, vehicle_type } = req.body;
  const cptId = id || `cpt_${Date.now()}`;
  const newCpt: Captain = {
    id: cptId,
    profile_id: `prof_${cptId}`,
    full_name: full_name || 'New Captain',
    email: email || 'captain@example.com',
    phone: phone || '',
    is_online: true,
    is_approved: true,
    is_active: true,
    current_lat: 30.7046 + (Math.random() - 0.5) * 0.05,
    current_lng: 76.7178 + (Math.random() - 0.5) * 0.05,
    rating: 4.9,
    total_rides: 0,
    vehicle: {
      id: `veh_${cptId}`,
      captain_id: cptId,
      model: vehicle_model || 'Honda Activa',
      plate_number: plate_number || `PB01XY${Math.floor(1000 + Math.random() * 9000)}`,
      vehicle_type: vehicle_type || 'bike',
      color: 'Black',
      is_active: true,
    },
    created_at: new Date().toISOString(),
  };
  captainsStore.set(cptId, newCpt);
  broadcastEvent('CAPTAINS_UPDATED', Array.from(captainsStore.values()));
  res.status(201).json({ success: true, captain: newCpt });
});

motorideRouter.get('/captains/:id', (req: Request, res: Response) => {
  const cpt = captainsStore.get(req.params.id);
  if (!cpt) {
    return res.status(404).json({ error: 'Captain not found' });
  }

  const enriched = {
    ...cpt,
    today_earnings: calculateCaptainTodayEarnings(cpt.id),
    total_earnings: calculateCaptainTotalEarnings(cpt.id),
    wallet_balance: (walletsStore.get(cpt.id) || { balance: 0 }).balance,
  };

  res.json({ success: true, captain: enriched });
});

motorideRouter.post('/captains/:id/toggle-online', (req: Request, res: Response) => {
  const cpt = captainsStore.get(req.params.id);
  if (!cpt) {
    return res.status(404).json({ error: 'Captain not found' });
  }

  cpt.is_online = req.body.is_online !== undefined ? Boolean(req.body.is_online) : !cpt.is_online;
  cpt.updated_at = new Date().toISOString();
  captainsStore.set(cpt.id, cpt);

  broadcastEvent('CAPTAIN_ONLINE_STATUS_CHANGED', {
    captain_id: cpt.id,
    is_online: cpt.is_online,
  });

  res.json({ success: true, captain: cpt });
});

motorideRouter.post('/captains/:id/vehicle', (req: Request, res: Response) => {
  const cpt = captainsStore.get(req.params.id);
  if (!cpt) {
    return res.status(404).json({ error: 'Captain not found' });
  }

  const { model, plate_number, vehicle_type, color } = req.body;
  if (!model || !plate_number) {
    return res.status(400).json({ error: 'Model and plate number are required' });
  }

  cpt.vehicle = {
    id: cpt.vehicle?.id || `veh_${Date.now()}`,
    captain_id: cpt.id,
    model,
    plate_number,
    vehicle_type: vehicle_type || 'bike',
    color: color || 'Black',
    is_active: true,
  };
  cpt.updated_at = new Date().toISOString();
  captainsStore.set(cpt.id, cpt);

  res.json({ success: true, captain: cpt });
});

motorideRouter.post('/captains/:id/status', (req: Request, res: Response) => {
  const cpt = captainsStore.get(req.params.id);
  if (!cpt) {
    return res.status(404).json({ error: 'Captain not found' });
  }

  if (req.body.is_approved !== undefined) cpt.is_approved = Boolean(req.body.is_approved);
  if (req.body.is_active !== undefined) cpt.is_active = Boolean(req.body.is_active);

  cpt.updated_at = new Date().toISOString();
  captainsStore.set(cpt.id, cpt);

  broadcastEvent('CAPTAIN_UPDATED', cpt);
  res.json({ success: true, captain: cpt });
});

// 4. Passengers API
motorideRouter.get('/passengers', (req: Request, res: Response) => {
  const list = Array.from(passengersStore.values()).map((psg) => ({
    ...psg,
    wallet_balance: (walletsStore.get(psg.id) || { balance: 200 }).balance,
  }));
  res.json({ success: true, passengers: list });
});

motorideRouter.post('/passengers', (req: Request, res: Response) => {
  const { id, full_name, email, phone } = req.body;
  const psgId = id || `psg_${Date.now()}`;
  const newPsg: Passenger = {
    id: psgId,
    profile_id: `prof_${psgId}`,
    full_name: full_name || 'New Passenger',
    email: email || 'passenger@example.com',
    phone: phone || '',
    total_rides: 0,
    rating: 5.0,
    emergency_contact: phone || '',
    created_at: new Date().toISOString(),
  };
  passengersStore.set(psgId, newPsg);
  broadcastEvent('PASSENGERS_UPDATED', Array.from(passengersStore.values()));
  res.status(201).json({ success: true, passenger: newPsg });
});

// 5. Settings API
motorideRouter.get('/fare-settings', (req: Request, res: Response) => {
  res.json({ success: true, settings: fareSettings });
});

motorideRouter.post('/fare-settings', (req: Request, res: Response) => {
  const updated = updateFareSettings(req.body);
  res.json({ success: true, settings: updated });
});

motorideRouter.get('/qr-settings', (req: Request, res: Response) => {
  res.json({ success: true, qr: qrSettings });
});

motorideRouter.post('/qr-settings', (req: Request, res: Response) => {
  const updated = updateQRSettings(req.body);
  res.json({ success: true, qr: updated });
});

// 6. Wallet API
motorideRouter.get('/wallet/:userId', (req: Request, res: Response) => {
  const wallet = walletsStore.get(req.params.userId) || { balance: 250.0, currency: '₹' };
  const transactions = walletTransactionsStore.filter((tx) => tx.user_id === req.params.userId);
  res.json({ success: true, wallet, transactions });
});

motorideRouter.post('/wallet/:userId/topup', (req: Request, res: Response) => {
  const amount = Number(req.body.amount);
  if (!amount || isNaN(amount) || amount <= 0) {
    return res.status(400).json({ error: 'Valid top-up amount required' });
  }

  const wallet = walletsStore.get(req.params.userId) || { balance: 0, currency: '₹' };
  wallet.balance = Number((wallet.balance + amount).toFixed(2));
  walletsStore.set(req.params.userId, wallet);

  const tx: WalletTransaction = {
    id: `tx_${Date.now()}`,
    wallet_id: `w_${req.params.userId}`,
    user_id: req.params.userId,
    amount,
    type: 'credit',
    category: 'topup',
    description: `Wallet top-up via UPI / QR code`,
    created_at: new Date().toISOString(),
  };

  walletTransactionsStore.unshift(tx);
  res.json({ success: true, wallet, transaction: tx });
});

// 7. Admin Dashboard & Notifications
motorideRouter.get('/stats', (req: Request, res: Response) => {
  res.json({ success: true, stats: getAdminStats() });
});

motorideRouter.get('/notifications', (req: Request, res: Response) => {
  res.json({ success: true, notifications: notificationsStore.slice(0, 30) });
});

// 8. Server-Backed Real Account Authentication & Persistence
motorideRouter.post('/auth/register', (req: Request, res: Response) => {
  try {
    const {
      id,
      email,
      password,
      name,
      role = 'passenger',
      phone,
      vehicle_model,
      plate_number,
      vehicle_type = 'bike',
    } = req.body;

    if (!email || !email.includes('@')) {
      return res.status(400).json({ success: false, error: 'A valid email address is required' });
    }
    if (!password) {
      return res.status(400).json({ success: false, error: 'Password is required' });
    }
    if (!name) {
      return res.status(400).json({ success: false, error: 'Full name is required' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanRole = (role === 'captain' || role === 'admin' ? role : 'passenger') as 'passenger' | 'captain' | 'admin';
    const storeKey = `${cleanEmail}_${cleanRole}`;
    const accountId = id || `usr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();

    const account: ServerRegisteredAccount = {
      id: accountId,
      email: cleanEmail,
      password_hash: String(password).trim(),
      name: name.trim(),
      role: cleanRole,
      phone: phone?.trim() || '',
      vehicle_model: vehicle_model?.trim() || '',
      plate_number: plate_number?.trim().toUpperCase() || '',
      vehicle_type: vehicle_type || 'bike',
      wallet_balance: cleanRole === 'captain' ? 500 : 200,
      member_since: now,
      created_at: now,
    };

    accountsStore.set(storeKey, account);

    // Keep wallets store in sync
    if (!walletsStore.has(accountId)) {
      walletsStore.set(accountId, {
        balance: account.wallet_balance || 200,
        currency: '₹',
      });
    }

    // If Captain, register into captains catalog
    if (cleanRole === 'captain') {
      const cpt: Captain = {
        id: accountId,
        profile_id: `prof_${accountId}`,
        full_name: account.name,
        email: cleanEmail,
        phone: account.phone || '',
        is_online: true,
        is_approved: true,
        is_active: true,
        current_lat: 30.7046 + (Math.random() - 0.5) * 0.05,
        current_lng: 76.7178 + (Math.random() - 0.5) * 0.05,
        rating: 4.95,
        total_rides: 0,
        vehicle: {
          id: `veh_${accountId}`,
          captain_id: accountId,
          model: account.vehicle_model || 'Standard Bike',
          plate_number: account.plate_number || `PB65XX${Math.floor(1000 + Math.random() * 9000)}`,
          vehicle_type: account.vehicle_type || 'bike',
          color: 'Black',
          is_active: true,
        },
        created_at: now,
      };
      captainsStore.set(accountId, cpt);
      broadcastEvent('CAPTAINS_UPDATED', Array.from(captainsStore.values()));
    }

    // If Passenger, register into passengers catalog
    if (cleanRole === 'passenger') {
      const psg: Passenger = {
        id: accountId,
        profile_id: `prof_${accountId}`,
        full_name: account.name,
        email: cleanEmail,
        phone: account.phone || '',
        total_rides: 0,
        rating: 5.0,
        wallet_balance: account.wallet_balance ?? 200,
        created_at: now,
      };
      passengersStore.set(accountId, psg);
      broadcastEvent('PASSENGERS_UPDATED', Array.from(passengersStore.values()));
    }

    persistDbToDisk();

    res.status(201).json({
      success: true,
      account: {
        id: account.id,
        email: account.email,
        name: account.name,
        role: account.role,
        phone: account.phone,
        vehicle_model: account.vehicle_model,
        plate_number: account.plate_number,
        vehicle_type: account.vehicle_type,
        wallet_balance: account.wallet_balance,
        member_since: account.member_since,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || 'Registration failed' });
  }
});

motorideRouter.post('/auth/login', (req: Request, res: Response) => {
  try {
    const { email, password, role = 'passenger' } = req.body;

    if (!email || !email.includes('@')) {
      return res.status(400).json({ success: false, error: 'A valid email address is required' });
    }
    if (!password) {
      return res.status(400).json({ success: false, error: 'Password is required' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanRole = (role === 'captain' || role === 'admin' ? role : 'passenger') as 'passenger' | 'captain' | 'admin';
    const exactKey = `${cleanEmail}_${cleanRole}`;

    // 1. Check exact match for role
    let account = accountsStore.get(exactKey);

    // 2. If not found for this role, search all accounts for this email across other roles
    if (!account) {
      let otherRoleAccount: ServerRegisteredAccount | undefined;
      for (const acc of accountsStore.values()) {
        if (acc.email.toLowerCase() === cleanEmail) {
          otherRoleAccount = acc;
          break;
        }
      }

      if (otherRoleAccount) {
        // Found account with same email under another role
        const passwordMatches = otherRoleAccount.password_hash === String(password).trim();
        if (passwordMatches) {
          // Auto-adapt to the user's registered role!
          return res.json({
            success: true,
            role_switched: true,
            original_role: otherRoleAccount.role,
            message: `Found your registered ${otherRoleAccount.role} account!`,
            account: {
              id: otherRoleAccount.id,
              email: otherRoleAccount.email,
              name: otherRoleAccount.name,
              role: otherRoleAccount.role,
              phone: otherRoleAccount.phone,
              vehicle_model: otherRoleAccount.vehicle_model,
              plate_number: otherRoleAccount.plate_number,
              vehicle_type: otherRoleAccount.vehicle_type,
              wallet_balance: otherRoleAccount.wallet_balance,
              member_since: otherRoleAccount.member_since,
            },
          });
        } else {
          return res.status(401).json({
            success: false,
            error: 'Incorrect password. Please verify your credentials.',
          });
        }
      }

      // 3. Seamless Auto-Registration on first sign in!
      // Eliminates the "No account found... switch to Create Account tab" blocker
      const accountId = `usr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const now = new Date().toISOString();
      const rawPrefix = cleanEmail.split('@')[0].replace(/[._-]/g, ' ');
      const displayName = rawPrefix ? rawPrefix.charAt(0).toUpperCase() + rawPrefix.slice(1) : 'MotoRide User';

      const newAccount: ServerRegisteredAccount = {
        id: accountId,
        email: cleanEmail,
        password_hash: String(password).trim(),
        name: displayName,
        role: cleanRole,
        phone: '',
        vehicle_model: cleanRole === 'captain' ? 'Honda Activa 6G' : '',
        plate_number: cleanRole === 'captain' ? `PB65XX${Math.floor(1000 + Math.random() * 9000)}` : '',
        vehicle_type: 'bike',
        wallet_balance: cleanRole === 'captain' ? 500 : 200,
        member_since: now,
        created_at: now,
      };

      accountsStore.set(exactKey, newAccount);
      walletsStore.set(accountId, {
        balance: newAccount.wallet_balance || 200,
        currency: '₹',
      });

      if (cleanRole === 'captain') {
        const cpt: Captain = {
          id: accountId,
          profile_id: `prof_${accountId}`,
          full_name: newAccount.name,
          email: cleanEmail,
          phone: '',
          is_online: true,
          is_approved: true,
          is_active: true,
          current_lat: 30.7046 + (Math.random() - 0.5) * 0.05,
          current_lng: 76.7178 + (Math.random() - 0.5) * 0.05,
          rating: 4.95,
          total_rides: 0,
          vehicle: {
            id: `veh_${accountId}`,
            captain_id: accountId,
            model: 'Honda Activa 6G',
            plate_number: newAccount.plate_number || 'PB65XX1000',
            vehicle_type: 'bike',
            color: 'Black',
            is_active: true,
          },
          created_at: now,
        };
        captainsStore.set(accountId, cpt);
        broadcastEvent('CAPTAINS_UPDATED', Array.from(captainsStore.values()));
      } else if (cleanRole === 'passenger') {
        const psg: Passenger = {
          id: accountId,
          profile_id: `prof_${accountId}`,
          full_name: newAccount.name,
          email: cleanEmail,
          phone: '',
          total_rides: 0,
          rating: 5.0,
          wallet_balance: 200,
          created_at: now,
        };
        passengersStore.set(accountId, psg);
        broadcastEvent('PASSENGERS_UPDATED', Array.from(passengersStore.values()));
      }

      persistDbToDisk();

      return res.json({
        success: true,
        is_new_account: true,
        message: `Welcome! Your ${cleanRole} account has been created and signed in.`,
        account: {
          id: newAccount.id,
          email: newAccount.email,
          name: newAccount.name,
          role: newAccount.role,
          phone: newAccount.phone,
          vehicle_model: newAccount.vehicle_model,
          plate_number: newAccount.plate_number,
          vehicle_type: newAccount.vehicle_type,
          wallet_balance: newAccount.wallet_balance,
          member_since: newAccount.member_since,
        },
      });
    }

    // 3. Exact role match verification
    if (account.password_hash !== String(password).trim()) {
      return res.status(401).json({
        success: false,
        error: 'Incorrect password. Please verify your credentials.',
      });
    }

    return res.json({
      success: true,
      account: {
        id: account.id,
        email: account.email,
        name: account.name,
        role: account.role,
        phone: account.phone,
        vehicle_model: account.vehicle_model,
        plate_number: account.plate_number,
        vehicle_type: account.vehicle_type,
        wallet_balance: account.wallet_balance,
        member_since: account.member_since,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || 'Login failed' });
  }
});

motorideRouter.get('/auth/accounts', (req: Request, res: Response) => {
  const list = Array.from(accountsStore.values()).map((acc) => ({
    id: acc.id,
    email: acc.email,
    name: acc.name,
    role: acc.role,
    phone: acc.phone,
    vehicle_model: acc.vehicle_model,
    plate_number: acc.plate_number,
    vehicle_type: acc.vehicle_type,
    wallet_balance: acc.wallet_balance,
    member_since: acc.member_since,
  }));
  res.json({ success: true, accounts: list });
});
