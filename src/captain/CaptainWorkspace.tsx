import React, { useState, useEffect, useRef } from 'react';
import {
  Captain,
  MotorideRide,
  QRCodeSetting,
  FareSettings,
  WalletTransaction,
} from '../types/motoride';
import { MotorideMap } from '../components/common/MotorideMap';
import { RideChatModal } from '../components/common/RideChatModal';
import { motorideApi } from '../services/motorideApi';
import { realtimeSync } from '../services/realtimeSync';
import { CaptainProfileDrawer } from './CaptainProfileDrawer';
import {
  Bike,
  Power,
  Navigation,
  Phone,
  QrCode,
  RotateCw,
  Send,
  AlertCircle,
  Clock,
  MapPin,
  CheckCircle2,
  XCircle,
  MessageSquare,
  Maximize2,
  Minimize2,
  ChevronUp,
  ChevronDown,
  User,
  Star,
  LocateFixed,
  Radio,
  TrendingUp,
  X,
} from 'lucide-react';

interface CaptainWorkspaceProps {
  captainId?: string;
  captainName?: string;
  onOpenWallet?: () => void;
  onSignOut?: () => void;
  isOnline?: boolean;
  onToggleOnline?: () => void;
}

// Haversine distance calculator for real-time proximity
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export const CaptainWorkspace: React.FC<CaptainWorkspaceProps> = ({
  captainId = 'cpt_vikram_01',
  captainName = 'Captain Vikram Singh',
  onOpenWallet,
  onSignOut,
  isOnline: propIsOnline,
  onToggleOnline: propToggleOnline,
}) => {
  const [captain, setCaptain] = useState<Captain | null>(null);
  const [internalOnline, setInternalOnline] = useState<boolean>(true);
  const isOnline = propIsOnline !== undefined ? propIsOnline : internalOnline;
  const [availableRides, setAvailableRides] = useState<MotorideRide[]>([]);
  const [activeRide, setActiveRide] = useState<MotorideRide | null>(null);
  const [inspectedRide, setInspectedRide] = useState<MotorideRide | null>(null);
  const [counterFareInput, setCounterFareInput] = useState<{ [rideId: string]: number }>({});
  const [showCounterModal, setShowCounterModal] = useState<string | null>(null);
  const [qrSettings, setQrSettings] = useState<QRCodeSetting | null>(null);
  const [fareSettings, setFareSettings] = useState<FareSettings | null>(null);
  const [walletTransactions, setWalletTransactions] = useState<WalletTransaction[]>([]);
  const [walletBalance, setWalletBalance] = useState<number>(450);
  const [isProfileOpen, setIsProfileOpen] = useState<boolean>(false);
  const [showChatModal, setShowChatModal] = useState<boolean>(false);

  // Default to false so the map and Captain live GPS position are immediately 100% visible
  const [is100Full, setIs100Full] = useState<boolean>(false);

  // Captain Real-Time GPS Tracking State (Immediate restore from localStorage + live watchPosition)
  const [captainGps, setCaptainGps] = useState<{
    lat: number;
    lng: number;
    accuracy: number | null;
    heading: number | null;
    speed: number | null;
    timestamp: number;
  }>(() => {
    try {
      const cached = localStorage.getItem('motoride_last_captain_gps');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed.lat && parsed.lng) {
          return {
            lat: parsed.lat,
            lng: parsed.lng,
            accuracy: parsed.accuracy ?? 15,
            heading: parsed.heading ?? 45,
            speed: parsed.speed ?? 0,
            timestamp: Date.now(),
          };
        }
      }
    } catch {}
    return {
      lat: 30.704649,
      lng: 76.717873,
      accuracy: 15,
      heading: 45,
      speed: 0,
      timestamp: Date.now(),
    };
  });

  const [gpsStatus, setGpsStatus] = useState<'idle' | 'acquiring' | 'live' | 'denied' | 'unavailable' | 'timeout'>('acquiring');
  const [gpsErrorMessage, setGpsErrorMessage] = useState<string | null>(null);
  const [lastUploadedAt, setLastUploadedAt] = useState<number>(0);
  const watchIdRef = useRef<number | null>(null);
  const lastUploadedGpsRef = useRef<{ lat: number; lng: number; time: number }>({
    lat: 30.704649,
    lng: 76.717873,
    time: 0,
  });

  // Real-Time Passenger Live GPS Tracking (from Supabase)
  const [passengerLiveGps, setPassengerLiveGps] = useState<{
    latitude: number;
    longitude: number;
    accuracy?: number | null;
    heading?: number | null;
    speed?: number | null;
    updated_at?: string;
  } | null>(null);
  const [nowTick, setNowTick] = useState<number>(Date.now());

  // 5s ticker for checking stale signal
  useEffect(() => {
    const timer = setInterval(() => setNowTick(Date.now()), 5000);
    return () => clearInterval(timer);
  }, []);

  // Captain Live GPS Geolocation Engine (navigator.geolocation.watchPosition)
  const handlePositionSuccess = (position: GeolocationPosition) => {
    const { latitude, longitude, accuracy, heading, speed } = position.coords;
    const now = position.timestamp || Date.now();

    setCaptainGps({
      lat: latitude,
      lng: longitude,
      accuracy: accuracy ?? 15,
      heading: heading ?? null,
      speed: speed ?? null,
      timestamp: now,
    });
    setGpsStatus('live');
    setGpsErrorMessage(null);

    // Save in localStorage for immediate restoration on next app opening
    try {
      localStorage.setItem(
        'motoride_last_captain_gps',
        JSON.stringify({ lat: latitude, lng: longitude, accuracy, heading, speed })
      );
    } catch {}

    // Throttle upload to Supabase & Backend:
    // Update if moved >= 3m OR >= 3s elapsed since last sync
    const prev = lastUploadedGpsRef.current;
    const distM = calculateDistance(prev.lat, prev.lng, latitude, longitude) * 1000;
    const timeDelta = now - prev.time;

    if (timeDelta >= 2000 && (distM >= 3 || timeDelta >= 3500 || prev.time === 0)) {
      lastUploadedGpsRef.current = { lat: latitude, lng: longitude, time: now };
      setLastUploadedAt(now);

      motorideApi
        .updateCaptainLiveLocation({
          captain_id: captainId,
          ride_id: activeRide?.id || null,
          latitude,
          longitude,
          accuracy: accuracy ?? null,
          heading: heading ?? null,
          speed: speed ?? null,
        })
        .catch((err) => console.warn('Supabase captain live location sync notice:', err));
    }
  };

  const handlePositionError = (err: GeolocationPositionError) => {
    console.warn('Captain Geolocation notice:', err.code, err.message);
    if (err.code === 1) {
      setGpsStatus('denied');
      setGpsErrorMessage('Please allow location access to track your live captain position.');
    } else if (err.code === 2) {
      setGpsStatus('unavailable');
      setGpsErrorMessage('Device GPS signal unavailable. Please ensure location is enabled.');
    } else if (err.code === 3) {
      setGpsStatus('timeout');
      setGpsErrorMessage('GPS request timed out. Retrying connection...');
    } else {
      setGpsStatus('denied');
      setGpsErrorMessage('Please enable location access.');
    }
  };

  const startWatchingLocation = () => {
    if (watchIdRef.current !== null && 'geolocation' in navigator) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }

    if (!('geolocation' in navigator)) {
      setGpsStatus('unavailable');
      setGpsErrorMessage('Geolocation API is not supported in this browser.');
      return;
    }

    setGpsStatus('acquiring');
    setGpsErrorMessage(null);

    // Immediate one-off get for instant position acquisition
    navigator.geolocation.getCurrentPosition(
      (pos) => handlePositionSuccess(pos),
      (err) => {
        // Fallback to low accuracy if high accuracy fails
        navigator.geolocation.getCurrentPosition(
          (pos) => handlePositionSuccess(pos),
          (finalErr) => handlePositionError(finalErr),
          { enableHighAccuracy: false, timeout: 10000, maximumAge: 30000 }
        );
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 5000 }
    );

    // Continuous watch
    try {
      const id = navigator.geolocation.watchPosition(
        (pos) => handlePositionSuccess(pos),
        (err) => {
          if (gpsStatus === 'acquiring') {
            handlePositionError(err);
          }
        },
        {
          enableHighAccuracy: true,
          maximumAge: 1500,
          timeout: 10000,
        }
      );
      watchIdRef.current = id;
    } catch (e) {
      console.warn('Captain watchPosition setup error:', e);
    }
  };

  useEffect(() => {
    startWatchingLocation();
    return () => {
      if (watchIdRef.current !== null && 'geolocation' in navigator) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [captainId, activeRide?.id]);

  // Subscribe to Passenger Live Location from Supabase when ride is active
  useEffect(() => {
    if (!activeRide) {
      setPassengerLiveGps(null);
      return;
    }

    // 1. Fetch latest persisted location from Supabase
    motorideApi
      .getPassengerLiveLocation(activeRide.id, activeRide.passenger_id)
      .then((loc) => {
        if (loc) {
          setPassengerLiveGps(loc);
        }
      })
      .catch((err) => console.warn('Captain fetch passenger location notice:', err));

    // 2. Subscribe to live changes emitted by Supabase postgres_changes
    const unsub = realtimeSync.on('PASSENGER_LOCATION_UPDATED', (loc: {
      passenger_id: string;
      ride_id: string | null;
      latitude: number;
      longitude: number;
      accuracy?: number | null;
      heading?: number | null;
      speed?: number | null;
      updated_at?: string;
    }) => {
      if (
        (loc.ride_id && loc.ride_id === activeRide.id) ||
        loc.passenger_id === activeRide.passenger_id
      ) {
        setPassengerLiveGps(loc);
      }
    });

    return () => {
      unsub();
    };
  }, [activeRide?.id, activeRide?.passenger_id]);

  useEffect(() => {
    loadCaptainData();
    loadAvailableRides();
    loadActiveRide();
    loadSettings();

    // Listen to real-time events
    const unsubRideCreated = realtimeSync.on('RIDE_CREATED', (newRide: MotorideRide) => {
      setAvailableRides((prev) => {
        if (prev.some((r) => r.id === newRide.id)) return prev;
        return [newRide, ...prev];
      });
      // Vibrate mobile device when new ride arrives
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        try {
          navigator.vibrate([100, 50, 100]);
        } catch {}
      }
    });

    const unsubRideUpdated = realtimeSync.on('RIDE_UPDATED', (updatedRide: MotorideRide) => {
      if (updatedRide.captain_id === captainId) {
        if (updatedRide.status === 'trip_completed' || updatedRide.status.includes('cancelled')) {
          setActiveRide(null);
          loadCaptainData();
        } else {
          setActiveRide(updatedRide);
        }
      }

      setAvailableRides((prev) => {
        if (updatedRide.status !== 'requested' && updatedRide.status !== 'captain_offered') {
          return prev.filter((r) => r.id !== updatedRide.id);
        }
        return prev.map((r) => (r.id === updatedRide.id ? updatedRide : r));
      });
    });

    // Continuous 2.5-second polling to ensure cross-browser/mobile sync even if SSE sleeps on mobile
    const pollInterval = setInterval(() => {
      loadAvailableRides();
      loadActiveRide();
    }, 2500);

    // Immediate re-fetch when switching back to mobile browser tab
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        loadAvailableRides();
        loadActiveRide();
      }
    };
    window.addEventListener('focus', handleVisibility);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      unsubRideCreated();
      unsubRideUpdated();
      clearInterval(pollInterval);
      window.removeEventListener('focus', handleVisibility);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [captainId, activeRide?.id]);

  // Fallback simulator for active ride ONLY when GPS is denied, unavailable, or in sandboxed demo
  useEffect(() => {
    if (!activeRide || gpsStatus === 'live') return;

    const interval = setInterval(() => {
      const targetLat =
        activeRide.status === 'captain_accepted'
          ? activeRide.pickup_lat
          : activeRide.dropoff_lat;
      const targetLng =
        activeRide.status === 'captain_accepted'
          ? activeRide.pickup_lng
          : activeRide.dropoff_lng;

      setCaptainGps((prev) => {
        const stepLat = (targetLat - prev.lat) * 0.15;
        const stepLng = (targetLng - prev.lng) * 0.15;
        const newLat = prev.lat + (Math.abs(stepLat) < 0.0001 ? 0 : stepLat);
        const newLng = prev.lng + (Math.abs(stepLng) < 0.0001 ? 0 : stepLng);
        const fixedLat = Number(newLat.toFixed(6));
        const fixedLng = Number(newLng.toFixed(6));

        motorideApi.updateCaptainLiveLocation({
          captain_id: captainId,
          ride_id: activeRide.id,
          latitude: fixedLat,
          longitude: fixedLng,
          heading: 45,
          speed: 25,
        });

        return {
          ...prev,
          lat: fixedLat,
          lng: fixedLng,
          heading: 45,
          speed: 25,
          timestamp: Date.now(),
        };
      });
    }, 3000);

    return () => clearInterval(interval);
  }, [activeRide, gpsStatus, captainId]);

  const loadCaptainData = async () => {
    try {
      const cpt = await motorideApi.getCaptainById(captainId);
      if (cpt) {
        setCaptain(cpt);
        setInternalOnline(Boolean(cpt.is_online));
      }
      const w = await motorideApi.getWallet(captainId);
      if (w && w.wallet) {
        setWalletBalance(w.wallet.balance || 0);
        setWalletTransactions(w.transactions || []);
      }
    } catch {}
  };

  const loadAvailableRides = async () => {
    try {
      const list = await motorideApi.getRides({ active_for_captain: true });
      if (Array.isArray(list) && list.length > 0) {
        setAvailableRides(list);
      } else {
        setAvailableRides((prev) => {
          if (prev.length > 0) return prev;
          const defaultRide: MotorideRide = {
            id: 'ride_live_demo_100',
            ride_code: 'MR-100',
            passenger_id: 'usr_demo_100',
            passenger_name: 'Priya Sharma',
            passenger_phone: '+91 98765 43210',
            pickup_address: 'Sector 17 Bus Stand & Market, Chandigarh',
            pickup_lat: 30.7095,
            pickup_lng: 76.7135,
            dropoff_address: 'Elante Mall, Phase 1, Industrial Area, Chandigarh',
            dropoff_lat: 30.7055,
            dropoff_lng: 76.7915,
            distance_km: 4.8,
            duration_minutes: 14,
            offered_fare: 100,
            estimated_fare: 100,
            final_fare: 100,
            payment_method: 'upi',
            payment_status: 'pending',
            ride_type: 'bike',
            status: 'requested',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };
          return [defaultRide];
        });
      }
    } catch {}
  };

  const loadActiveRide = async () => {
    try {
      const list = await motorideApi.getRides({ captain_id: captainId });
      if (Array.isArray(list)) {
        const current = list.find(
          (r) =>
            r &&
            (r.status === 'captain_accepted' ||
              r.status === 'captain_arrived' ||
              r.status === 'trip_started')
        );
        if (current) {
          setActiveRide(current);
        }
      }
    } catch {}
  };

  const loadSettings = async () => {
    try {
      const qr = await motorideApi.getQRSettings();
      if (qr) setQrSettings(qr);
      const fare = await motorideApi.getFareSettings();
      if (fare) setFareSettings(fare);
    } catch {}
  };

  const handleToggleOnline = async () => {
    if (propToggleOnline) {
      propToggleOnline();
      return;
    }
    try {
      const nextState = !isOnline;
      setInternalOnline(nextState);
      const updated = await motorideApi.toggleCaptainOnline(captainId, nextState);
      if (updated && typeof updated.is_online === 'boolean') {
        setInternalOnline(updated.is_online);
      }
    } catch (err: any) {
      console.warn('Failed to toggle status:', err);
    }
  };

  // Accept Ride Immediately
  const handleAcceptRide = async (ride: MotorideRide) => {
    try {
      const updated = await motorideApi.acceptRide(ride.id, {
        captain_id: captain?.id || captainId,
        captain_name: captain?.full_name || 'Vikram Singh',
        captain_phone: captain?.phone || '+91 98765 43210',
        vehicle_model: captain?.vehicle?.model || 'Mahindra Centuro PB65AA1257',
        plate_number: captain?.vehicle?.plate_number || 'PB65AA1257',
        accepted_fare: ride.offered_fare,
      });
      setActiveRide(updated);
      setAvailableRides((prev) => prev.filter((r) => r.id !== ride.id));
    } catch (err: any) {
      alert(err.message || 'Ride was already accepted by another captain.');
      loadAvailableRides();
    }
  };

  // Send Counter Offer
  const handleSendCounterOffer = async (rideId: string, customFare?: number) => {
    const proposedFare = customFare !== undefined ? customFare : counterFareInput[rideId];
    if (!proposedFare || proposedFare <= 0) {
      alert('Please enter a valid counter fare');
      return;
    }
    try {
      await motorideApi.sendCounterOffer(rideId, {
        captain_id: captain?.id || captainId,
        captain_name: captain?.full_name || 'Vikram Singh',
        captain_phone: captain?.phone || '+91 98765 43210',
        vehicle_model: captain?.vehicle?.model || 'Mahindra Centuro PB65AA1257',
        plate_number: captain?.vehicle?.plate_number || 'PB65AA1257',
        counter_fare: proposedFare,
      });
      setShowCounterModal(null);
      alert(`Offer of ₹${proposedFare} submitted! The passenger will review it in real-time.`);
    } catch (err: any) {
      alert(err.message || 'Failed to submit offer');
    }
  };

  // Inspect incoming ride request on map (shows Location A & B markers and route)
  const handleInspectRide = (ride: MotorideRide) => {
    setInspectedRide(ride);
    setIs100Full(false);
    if (!counterFareInput[ride.id]) {
      setCounterFareInput((prev) => ({
        ...prev,
        [ride.id]: ride.offered_fare + 20,
      }));
    }
  };

  // Advance Trip Status
  const handleStatusChange = async (nextStatus: any) => {
    if (!activeRide) return;
    try {
      const updated = await motorideApi.updateRideStatus(activeRide.id, nextStatus, {
        final_distance_km: activeRide.distance_km,
        final_fare: activeRide.final_fare || activeRide.offered_fare,
      });

      if (nextStatus === 'trip_completed') {
        setActiveRide(null);
        loadCaptainData();
      } else {
        setActiveRide(updated);
      }
    } catch (err: any) {
      alert(err.message || 'Failed to update status');
    }
  };

  const handleCancelTrip = async () => {
    if (!activeRide) return;
    const rideIdToCancel = activeRide.id;
    try {
      setActiveRide(null);
      await motorideApi.updateRideStatus(rideIdToCancel, 'cancelled_by_captain', {
        cancellation_reason: 'Captain cancelled the trip',
      });
      loadCaptainData();
    } catch (err: any) {
      console.warn('Captain cancellation notice:', err);
      loadCaptainData();
    }
  };

  const currentRideOnMap = activeRide || inspectedRide;
  const inspectedPickupDistKm = inspectedRide
    ? calculateDistance(captainGps.lat, captainGps.lng, inspectedRide.pickup_lat, inspectedRide.pickup_lng)
    : null;
  const inspectedPickupDistText = inspectedPickupDistKm !== null
    ? (inspectedPickupDistKm < 1 ? `${Math.round(inspectedPickupDistKm * 1000)}m` : `${inspectedPickupDistKm.toFixed(1)} km`)
    : undefined;

  const inspectedDropoffDistKm = inspectedRide
    ? (inspectedRide.distance_km || calculateDistance(inspectedRide.pickup_lat, inspectedRide.pickup_lng, inspectedRide.dropoff_lat, inspectedRide.dropoff_lng))
    : null;
  const inspectedDropoffDistText = inspectedDropoffDistKm !== null
    ? (inspectedDropoffDistKm < 1 ? `${Math.round(inspectedDropoffDistKm * 1000)}m` : `${Number(inspectedDropoffDistKm).toFixed(1)} km`)
    : undefined;

  const renderCaptainMap = (isFullBackground: boolean) => (
    <MotorideMap
      isCaptainMode={true}
      captainLat={captainGps.lat}
      captainLng={captainGps.lng}
      captainHeading={captainGps.heading ?? 45}
      captainAccuracy={captainGps.accuracy}
      captainName={captain?.full_name || 'You (Captain)'}
      isLiveGpsActive={gpsStatus === 'live'}
      passengerLat={passengerLiveGps ? passengerLiveGps.latitude : (activeRide ? activeRide.pickup_lat : undefined)}
      passengerLng={passengerLiveGps ? passengerLiveGps.longitude : (activeRide ? activeRide.pickup_lng : undefined)}
      passengerAccuracy={passengerLiveGps?.accuracy ?? (activeRide ? 15 : undefined)}
      passengerHeading={passengerLiveGps?.heading ?? null}
      passengerName={activeRide?.passenger_name || inspectedRide?.passenger_name || 'Passenger'}
      pickupLat={currentRideOnMap ? currentRideOnMap.pickup_lat : null}
      pickupLng={currentRideOnMap ? currentRideOnMap.pickup_lng : null}
      pickupAddress={currentRideOnMap ? currentRideOnMap.pickup_address : undefined}
      pickupDistanceText={undefined}
      dropoffLat={currentRideOnMap ? currentRideOnMap.dropoff_lat : null}
      dropoffLng={currentRideOnMap ? currentRideOnMap.dropoff_lng : null}
      dropoffAddress={currentRideOnMap ? currentRideOnMap.dropoff_address : undefined}
      dropoffDistanceText={undefined}
      rideDistanceText={undefined}
      showRideDistanceTooltip={false}
      bottomSheetPadding={inspectedRide && !activeRide ? 360 : 60}
      showLocationsABOnly={Boolean(inspectedRide && !activeRide)}
      className={`w-full h-full ${isFullBackground ? 'rounded-none border-0' : 'shadow-2xl border border-slate-800'}`}
      showOverlayControls={true}
      onLocateMe={startWatchingLocation}
    />
  );

  const renderCaptainControls = () => (
    <div className="flex flex-col gap-3 pb-4">
      {activeRide ? (
        /* Active Trip Execution Card */
        <div className="bg-white border border-slate-200 rounded-3xl p-5 flex flex-col gap-4 shadow-xl">
          <div className="flex items-center justify-between pb-3 border-b border-slate-200">
            <div>
              <span className="text-[10px] font-mono-num text-amber-600 font-bold">
                {activeRide.ride_code}
              </span>
              <h3 className="text-base font-extrabold text-slate-900 capitalize">
                {activeRide.status.replace(/_/g, ' ')}
              </h3>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowChatModal(true)}
                className="p-2.5 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 shadow-sm"
                title="Chat with Passenger"
              >
                <MessageSquare className="w-4 h-4 stroke-[2.5]" />
              </button>
              <a
                href={`tel:${activeRide.passenger_phone || '+919780012345'}`}
                className="p-2.5 rounded-xl bg-emerald-600 text-white font-bold hover:bg-emerald-500 shadow-sm"
                title="Call Passenger"
              >
                <Phone className="w-4 h-4 stroke-[2.5]" />
              </a>
            </div>
          </div>

          {/* Passenger Info */}
          <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-slate-900 block">
                {activeRide.passenger_name}
              </span>
              <span className="text-[11px] text-slate-500">
                {activeRide.payment_method.toUpperCase()} Payment • Agreed Fare:
              </span>
            </div>
            <span className="text-lg font-black text-emerald-600 font-mono-num">
              ₹{activeRide.final_fare || activeRide.offered_fare}
            </span>
          </div>

          {/* Route Details with Navigator Capsule on top */}
          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col gap-2.5">
            {/* Pickup/Dropoff Location with Smart Navigator Button */}
            {(() => {
              const isArrivedOrLater = activeRide.status === 'captain_arrived' || activeRide.status === 'trip_started';
              const navLat = isArrivedOrLater ? activeRide.dropoff_lat : activeRide.pickup_lat;
              const navLng = isArrivedOrLater ? activeRide.dropoff_lng : activeRide.pickup_lng;
              const navTitle = isArrivedOrLater ? 'Navigate to Drop-off' : 'Navigate to Pickup';
              return (
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <a
                        href={`https://www.google.com/maps/dir/?api=1&destination=${navLat},${navLng}&travelmode=driving`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white text-[11px] font-black transition-all shadow-md active:scale-95 cursor-pointer select-none ring-1 ring-white/30 animate-pulse"
                        title={isArrivedOrLater ? 'Navigate to Drop-off destination' : 'Navigate to Pickup point'}
                      >
                        <Navigation className="w-3 h-3 fill-white stroke-white shrink-0" />
                        <span>{navTitle}</span>
                      </a>
                      <span className="text-[10px] text-slate-500">
                        {activeRide.distance_km} km • ~{activeRide.duration_minutes}m
                      </span>
                    </div>

                    <a
                      href={`https://www.google.com/maps/dir/?api=1&origin=${activeRide.pickup_lat},${activeRide.pickup_lng}&destination=${activeRide.dropoff_lat},${activeRide.dropoff_lng}&travelmode=driving`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[10px] text-emerald-700 hover:underline flex items-center gap-0.5 font-bold"
                      title="Full Route (Pickup to Drop-off)"
                    >
                      <span>Full Route &rarr;</span>
                    </a>
                  </div>

                  {/* Pickup Address */}
                  <div className="pl-2.5 border-l-2 border-emerald-500 mt-1">
                    <span className="text-[10px] uppercase font-black tracking-wider text-emerald-700 flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block shrink-0" />
                      Pickup Location {activeRide.status === 'captain_accepted' && '(Current Nav Target)'}
                    </span>
                    <p className="text-xs text-slate-900 font-medium truncate mt-0.5">
                      {activeRide.pickup_address}
                    </p>
                  </div>
                </div>
              );
            })()}

            {/* Dropoff Location */}
            <div className="flex flex-col gap-1 pt-1.5 border-t border-slate-200">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] uppercase font-bold text-rose-700 flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-rose-500 inline-block shrink-0" />
                  Drop-off Location {(activeRide.status === 'captain_arrived' || activeRide.status === 'trip_started') && '(Current Nav Target)'}
                </span>
              </div>
              <p className="text-xs text-slate-800 pl-2.5 border-l-2 border-rose-500 truncate">
                {activeRide.dropoff_address}
              </p>
            </div>

            {activeRide.comment && (
              <p className="flex items-center gap-1.5 pt-1.5 border-t border-slate-200 text-emerald-800 text-xs">
                <MessageSquare className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span className="truncate italic">Passenger note: "{activeRide.comment}"</span>
              </p>
            )}
          </div>

          {/* Workflow Step Action Buttons */}
          <div className="flex flex-col gap-2 pt-2">
            {activeRide.status === 'captain_accepted' && (
              <button
                type="button"
                onClick={() => handleStatusChange('captain_arrived')}
                className="w-full py-3 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs shadow-lg transition-all active:scale-98 cursor-pointer flex items-center justify-center gap-2"
              >
                <MapPin className="w-4 h-4 stroke-[2.5]" />
                <span>I Have Arrived at Pickup</span>
              </button>
            )}

            {activeRide.status === 'captain_arrived' && (
              <button
                type="button"
                onClick={() => handleStatusChange('trip_started')}
                className="w-full py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs shadow-lg transition-all active:scale-98 cursor-pointer flex items-center justify-center gap-2"
              >
                <Navigation className="w-4 h-4 stroke-[2.5]" />
                <span>Passenger Boarded • Start Trip</span>
              </button>
            )}

            {activeRide.status === 'trip_started' && (
              <button
                type="button"
                onClick={() => handleStatusChange('trip_completed')}
                className="w-full py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs shadow-lg transition-all active:scale-98 cursor-pointer flex items-center justify-center gap-2"
              >
                <CheckCircle2 className="w-4 h-4 stroke-[2.5]" />
                <span>Arrived at Destination • Complete Trip</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleCancelTrip}
              className="w-full py-2 rounded-xl text-rose-600 hover:bg-rose-50 text-xs font-semibold cursor-pointer transition-colors"
            >
              Cancel Ride
            </button>
          </div>
        </div>
      ) : (
        /* Incoming Live Ride Requests */
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-200">
            <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
              <Bike className="w-4 h-4 text-amber-500" />
              <span>Live Ride Requests</span>
            </h3>
            <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-900 font-mono-num border border-amber-300">
              {availableRides.length} Available
            </span>
          </div>

          {!isOnline || availableRides.length === 0 ? (
            <div className="text-center py-10 sm:py-14 text-slate-600 text-xs flex flex-col items-center justify-center gap-4">
              {/* Radar Scanning Visual when Online / Offline Status */}
              {isOnline ? (
                <div className="relative flex items-center justify-center my-2">
                  <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-full bg-emerald-500/15 animate-ping pointer-events-none" />
                  <div className="absolute w-36 h-36 sm:w-40 sm:h-40 rounded-full border border-emerald-500/25 animate-pulse pointer-events-none" />
                  <div className="relative z-10 w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-emerald-50 border-2 border-emerald-500/50 flex flex-col items-center justify-center gap-1 text-emerald-700 shadow-xl shadow-emerald-500/15">
                    <Radio className="w-7 h-7 sm:w-8 sm:h-8 animate-pulse text-emerald-600" />
                    <span className="text-[10px] font-black uppercase tracking-wider">Active</span>
                  </div>
                </div>
              ) : (
                <div className="relative flex items-center justify-center my-2">
                  <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-rose-50 border-2 border-rose-300 flex flex-col items-center justify-center gap-1 text-rose-700 shadow-lg">
                    <AlertCircle className="w-7 h-7 sm:w-8 sm:h-8 text-rose-600" />
                    <span className="text-[10px] font-black uppercase tracking-wider">Offline</span>
                  </div>
                </div>
              )}

              {/* Status & Scanning Message */}
              <div className="flex flex-col items-center gap-1 text-center px-4">
                <p className="text-sm font-bold text-slate-900 flex items-center justify-center gap-2">
                  {isOnline ? (
                    <>
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping shrink-0" />
                      <span>Scanning for nearby live ride requests...</span>
                    </>
                  ) : (
                    <>
                      <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                      <span>You are currently OFFLINE</span>
                    </>
                  )}
                </p>
                <span className="text-[11px] text-slate-500 max-w-sm">
                  {isOnline
                    ? 'Passenger ride requests appear here instantly in real time with audio alert'
                    : 'Use the Online capsule button near Captain App at the top right to go Online and receive rides'}
                </span>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-3 overflow-y-auto pr-1">
              {availableRides.map((ride) => {
                const distKm = calculateDistance(captainGps.lat, captainGps.lng, ride.pickup_lat, ride.pickup_lng);
                const pickupDistText = distKm < 1 ? `${Math.round(distKm * 1000)}m` : `${distKm.toFixed(1)}km`;
                const isSelected = inspectedRide?.id === ride.id;

                return (
                  <div
                    key={ride.id}
                    onClick={() => handleInspectRide(ride)}
                    className={`p-4 rounded-2xl bg-white border transition-all cursor-pointer ${
                      isSelected
                        ? 'border-amber-500 shadow-md ring-2 ring-amber-400/30'
                        : 'border-slate-200 shadow-sm hover:border-amber-400 hover:shadow-md'
                    }`}
                  >
                    {/* (passenger profile) 1km (pickup distance)                  ₹100 */}
                    <div className="flex items-center justify-between gap-3">
                      {/* Left: Passenger Profile + Pickup Distance */}
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="relative shrink-0">
                          <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-amber-400 via-amber-500 to-amber-600 text-slate-950 font-black text-sm flex items-center justify-center shadow-xs">
                            {ride.passenger_name?.charAt(0)?.toUpperCase() || 'P'}
                          </div>
                          <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 rounded-full border-2 border-white" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs sm:text-sm font-bold text-slate-900 truncate">
                              {ride.passenger_name}
                            </span>
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 text-[10px] font-bold shrink-0 border border-amber-200">
                              <Star className="w-2.5 h-2.5 fill-amber-500 text-amber-500" />
                              4.9
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 flex items-center gap-1">
                              <Navigation className="w-2.5 h-2.5 text-emerald-600 shrink-0" />
                              <span>{pickupDistText}</span>
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Right: ₹100 */}
                      <div className="text-right shrink-0">
                        <span className="text-xl sm:text-2xl font-black text-slate-900 font-mono-num block leading-tight">
                          ₹{ride.offered_fare}
                        </span>
                        <span className="text-[10px] text-slate-500 font-semibold">Offered Fare</span>
                      </div>
                    </div>

                    {/* A pickup (Bold text) & B dropoff */}
                    <div className="mt-3 pt-2.5 border-t border-slate-100 flex flex-col gap-2">
                      {/* A pickup (Bold text) */}
                      <div className="flex items-start gap-2.5">
                        <span className="w-5 h-5 rounded-full bg-emerald-600 text-white text-[11px] font-black flex items-center justify-center shrink-0 mt-0.5 shadow-xs">
                          A
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-bold text-slate-900 leading-snug">
                            {ride.pickup_address}
                          </p>
                        </div>
                      </div>

                      {/* B dropoff */}
                      <div className="flex items-start gap-2.5">
                        <span className="w-5 h-5 rounded-full bg-rose-500 text-white text-[11px] font-black flex items-center justify-center shrink-0 mt-0.5 shadow-xs">
                          B
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium text-slate-700 leading-snug">
                            {ride.dropoff_address}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Upi */}
                    <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between">
                      <span className="px-2.5 py-1 rounded-lg bg-purple-50 text-purple-700 border border-purple-200 text-xs font-black uppercase tracking-wider">
                        {ride.payment_method?.toUpperCase() === 'CASH' ? 'Cash' : 'Upi'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );

  const renderInspectedRideDetails = (ride: MotorideRide) => {
    const distKm = calculateDistance(captainGps.lat, captainGps.lng, ride.pickup_lat, ride.pickup_lng);
    const pickupDistText = distKm < 1 ? `${Math.round(distKm * 1000)}m` : `${distKm.toFixed(1)}km`;
    const dropoffDistText = ride.distance_km ? `${ride.distance_km}km` : '4.8km';
    const counterFare = counterFareInput[ride.id] || ride.offered_fare + 20;

    return (
      <div className="flex flex-col gap-3.5">
        {/* Top: (passenger profile) 1km (pickup distance)                  ₹100 */}
        <div className="flex items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="relative shrink-0">
              <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-gradient-to-tr from-amber-400 via-amber-500 to-amber-600 text-slate-950 font-black text-sm sm:text-base flex items-center justify-center shadow-md ring-2 ring-slate-100">
                {ride.passenger_name?.charAt(0)?.toUpperCase() || 'P'}
              </div>
              <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-emerald-500 rounded-full border-2 border-white" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <span className="text-sm sm:text-base font-black text-slate-900 truncate">
                  {ride.passenger_name}
                </span>
                <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 text-[10px] sm:text-[11px] font-bold border border-amber-200">
                  <Star className="w-2.5 h-2.5 sm:w-3 sm:h-3 fill-amber-500 text-amber-500" />
                  4.9
                </span>
              </div>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="text-[11px] sm:text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-md border border-emerald-200 flex items-center gap-1">
                  <Navigation className="w-3 h-3 text-emerald-600 shrink-0" />
                  <span>{pickupDistText}</span>
                </span>
              </div>
            </div>
          </div>

          <div className="text-right shrink-0">
            <span className="text-2xl sm:text-3xl font-black text-slate-900 font-mono-num block leading-tight">
              ₹{ride.offered_fare}
            </span>
            <span className="text-[10px] text-slate-500 font-semibold">Offered Fare</span>
          </div>
        </div>

        {/* Route Details: A pickup (Bold text) & B dropoff */}
        <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col gap-2.5">
          {/* A pickup (Bold text) */}
          <div className="flex items-start gap-2.5">
            <span className="w-6 h-6 rounded-full bg-emerald-600 text-white text-xs font-black flex items-center justify-center shrink-0 mt-0.5 shadow-xs">
              A
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-slate-900 leading-snug">
                {ride.pickup_address}
              </p>
            </div>
          </div>

          {/* B dropoff */}
          <div className="flex items-start gap-2.5">
            <span className="w-6 h-6 rounded-full bg-rose-500 text-white text-xs font-black flex items-center justify-center shrink-0 mt-0.5 shadow-xs">
              B
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-slate-700 leading-snug">
                {ride.dropoff_address}
              </p>
            </div>
          </div>

          {/* Payment (Upi) & Trip Info */}
          <div className="mt-0.5 pt-2 border-t border-slate-200 flex items-center justify-between text-xs">
            <span className="px-2.5 py-1 rounded-lg bg-purple-50 text-purple-700 border border-purple-200 font-black uppercase tracking-wider">
              {ride.payment_method?.toUpperCase() === 'CASH' ? 'Cash' : 'Upi'}
            </span>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold flex items-center gap-1">
                <span>Ride Distance:</span>
                <span className="font-mono-num font-black">{ride.distance_km ? `${ride.distance_km} km` : dropoffDistText}</span>
              </span>
              <span className="text-slate-500 font-medium hidden xs:inline">
                ~{ride.duration_minutes || 14} mins
              </span>
            </div>
          </div>
        </div>

        {/* Action Buttons:
            Accept for ₹100
            Offer your Fare ₹120
            Close
        */}
        <div className="flex flex-col sm:flex-row items-center gap-2 pt-1">
          {/* Accept for ₹100 */}
          <button
            type="button"
            onClick={() => {
              handleAcceptRide(ride);
              setInspectedRide(null);
            }}
            className="w-full sm:flex-1 py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs sm:text-sm shadow-md transition-all active:scale-95 cursor-pointer text-center flex items-center justify-center gap-2"
          >
            <CheckCircle2 className="w-4 h-4 stroke-[2.5]" />
            <span>Accept for ₹{ride.offered_fare}</span>
          </button>

          {/* Offer your Fare ₹120 */}
          <div className="w-full sm:flex-1 flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => {
                handleSendCounterOffer(ride.id, counterFare);
                setInspectedRide(null);
                setIs100Full(true);
              }}
              className="flex-1 py-3 px-3.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs sm:text-sm shadow-md transition-all active:scale-95 cursor-pointer text-center flex items-center justify-center gap-1.5"
            >
              <TrendingUp className="w-4 h-4 stroke-[2.5]" />
              <span>Offer your Fare ₹{counterFare}</span>
            </button>

            {/* Quick Fare Adjust (+ / - 10) */}
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 shrink-0">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setCounterFareInput((prev) => ({
                    ...prev,
                    [ride.id]: Math.max(ride.offered_fare, counterFare - 10),
                  }));
                }}
                className="w-8 h-8 rounded-lg bg-white hover:bg-slate-200 text-slate-800 font-black text-sm flex items-center justify-center cursor-pointer shadow-xs"
                title="Decrease fare by ₹10"
              >
                -
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setCounterFareInput((prev) => ({
                    ...prev,
                    [ride.id]: counterFare + 10,
                  }));
                }}
                className="w-8 h-8 rounded-lg bg-white hover:bg-slate-200 text-slate-800 font-black text-sm flex items-center justify-center cursor-pointer shadow-xs"
                title="Increase fare by ₹10"
              >
                +
              </button>
            </div>
          </div>

          {/* Close */}
          <button
            type="button"
            onClick={() => {
              setInspectedRide(null);
              setIs100Full(true);
            }}
            className="w-full sm:w-auto py-3 px-5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs sm:text-sm border border-slate-300 transition-all active:scale-95 cursor-pointer text-center"
          >
            Close
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="relative w-full h-[calc(100dvh-64px)] sm:h-[calc(100vh-68px)] overflow-hidden bg-slate-950">
      {/* Background Street View Map filling 100% of the canvas */}
      <div className="absolute inset-0 w-full h-full z-0">
        {renderCaptainMap(true)}
      </div>

      {/* Captain Profile 2-Lines Button in Left Top Corner of Main Page */}
      <button
        type="button"
        onClick={() => setIsProfileOpen(true)}
        title="Open Captain Profile"
        aria-label="Open Captain Profile"
        className="fixed sm:absolute top-3 sm:top-4 left-3 sm:left-4 z-[1100] p-2.5 sm:p-3 rounded-2xl bg-black/85 hover:bg-black text-white border border-amber-500/40 shadow-2xl backdrop-blur-xl flex flex-col justify-center items-center gap-1.5 w-11 h-11 active:scale-95 transition-all cursor-pointer group ring-1 ring-amber-500/20"
      >
        <span className="w-5 h-0.5 bg-amber-400 rounded-full group-hover:w-5.5 transition-all" />
        <span className="w-3.5 h-0.5 bg-amber-400 rounded-full self-start ml-0.5 group-hover:w-5 transition-all" />
      </button>

      {/* Captain Profile Slide-in Drawer from Left to Right */}
      <CaptainProfileDrawer
        isOpen={isProfileOpen}
        onClose={() => setIsProfileOpen(false)}
        captain={captain}
        onUpdateCaptain={(updated) => {
          setCaptain((prev) => (prev ? { ...prev, ...updated } : null));
        }}
        onOpenWallet={onOpenWallet}
        onSignOut={onSignOut}
      />

      {/* Floating GPS Status Banner when permission is blocked */}
      {gpsStatus === 'denied' && (
        <div className="absolute top-16 sm:top-4 left-1/2 -translate-x-1/2 z-[1100] w-[92%] sm:w-auto max-w-md bg-black/90 backdrop-blur-xl border border-rose-500/50 rounded-2xl px-3.5 py-2.5 shadow-2xl flex items-center justify-between gap-3 text-xs text-white">
          <div className="flex items-center gap-2 min-w-0">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span className="truncate">{gpsErrorMessage || 'Location permission required for live tracking'}</span>
          </div>
          <button
            type="button"
            onClick={startWatchingLocation}
            className="px-3 py-1 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-[11px] shrink-0 cursor-pointer shadow-md transition-all active:scale-95"
          >
            Allow GPS
          </button>
        </div>
      )}


      {/* Center Main Page: Captain Live Ride Requests Page (100% Full / Minimized to Bottom View / Inspected Ride Route Details) */}
      <div
        className={`fixed sm:absolute bottom-0 left-1/2 -translate-x-1/2 z-[1000] transition-all duration-300 ease-out flex flex-col ${
          is100Full
            ? 'inset-0 w-full h-full max-w-full'
            : inspectedRide && !activeRide
            ? 'h-auto max-h-[58dvh] sm:max-h-[52vh] w-full sm:w-[94%] md:w-[760px] lg:w-[840px] max-w-4xl'
            : 'h-16 sm:h-[72px] w-full sm:w-[94%] md:w-[760px] lg:w-[840px] max-w-4xl'
        }`}
      >
        <div
          className={`w-full h-full bg-white border-t border-slate-200 shadow-[0_-12px_45px_rgba(0,0,0,0.18)] flex flex-col overflow-hidden ring-1 ring-slate-200 ${
            is100Full ? 'rounded-none border-x-0' : 'rounded-t-3xl sm:border-x sm:border-slate-200'
          }`}
        >
          {/* Header Bar */}
          {inspectedRide && !activeRide && !is100Full ? (
            <div className="px-4 sm:px-5 py-2.5 sm:py-3 bg-white border-b border-slate-200 flex items-center justify-between select-none shadow-xs">
              {/* Left: Location A & B Route Indicator */}
              <div className="flex items-center gap-2 min-w-0">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                <span className="text-xs sm:text-sm font-black text-slate-900 truncate">
                  Ride Details & Route Map (A & B)
                </span>
                <span className="text-[11px] font-mono-num font-bold text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 hidden xs:inline">
                  {inspectedRide.ride_code}
                </span>
              </div>

              {/* Right: Close & Maximize buttons */}
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setIs100Full(true)}
                  className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold transition-all cursor-pointer border border-slate-300"
                  title="View all requests list"
                >
                  All Requests
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setInspectedRide(null);
                    setIs100Full(true);
                  }}
                  className="p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-all cursor-pointer border border-slate-300"
                  title="Close inspected ride"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          ) : (
            <div
              onClick={(e) => {
                // If minimized and user clicks on empty bar area, maximize to 100%
                if (!is100Full && (e.target as HTMLElement).tagName !== 'BUTTON' && !(e.target as HTMLElement).closest('button')) {
                  setIs100Full(true);
                }
              }}
              className={`px-3.5 sm:px-5 py-2.5 sm:py-3 bg-white flex items-center justify-between relative select-none shadow-sm ${
                is100Full ? 'border-b border-slate-200' : 'cursor-pointer hover:bg-slate-50 transition-colors'
              }`}
            >
              {/* Left: Live Requests Count */}
              <div className="flex items-center gap-2 min-w-0">
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 text-xs font-bold font-mono-num">
                  <Bike className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                  <span>{availableRides.length} Live Requests</span>
                </div>
              </div>

              {/* Right: 100% Full / Minimize Tab Button */}
              <div className="flex items-center justify-end min-w-0">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIs100Full((prev) => !prev);
                  }}
                  className={`flex items-center gap-1.5 px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-xl text-[11px] sm:text-xs font-black transition-all cursor-pointer border shadow-sm ${
                    is100Full
                      ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-amber-500/20 hover:bg-amber-400'
                      : 'bg-amber-50 text-amber-900 hover:bg-amber-100 border-amber-300'
                  }`}
                  title={is100Full ? 'Click to Minimize to Bottom of Page' : 'Click to Maximize to 100% Full'}
                >
                  {is100Full ? (
                    <>
                      <Minimize2 className="w-3.5 h-3.5 stroke-[2.5]" />
                      <span className="hidden xs:inline font-mono-num">Minimize</span>
                    </>
                  ) : (
                    <>
                      <Maximize2 className="w-3.5 h-3.5 stroke-[2.5]" />
                      <span className="font-mono-num">100% Full</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Main Interior Content */}
          {inspectedRide && !activeRide && !is100Full ? (
            <div className="flex-1 overflow-y-auto p-4 sm:p-5 scrollbar-thin bg-white">
              {renderInspectedRideDetails(inspectedRide)}
            </div>
          ) : is100Full ? (
            <div className="flex-1 overflow-y-auto px-3.5 sm:px-6 py-4 scrollbar-thin bg-white">
              {renderCaptainControls()}
            </div>
          ) : null}
        </div>
      </div>

      {showChatModal && activeRide && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md h-[500px]">
            <RideChatModal
              ride={activeRide}
              currentUserId={captainId}
              currentUserRole="captain"
              currentUserName={captain?.full_name || 'Captain'}
              onClose={() => setShowChatModal(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
};
