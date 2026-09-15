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
} from 'lucide-react';

interface CaptainWorkspaceProps {
  captainId?: string;
  captainName?: string;
  onOpenWallet?: () => void;
  onSignOut?: () => void;
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
}) => {
  const [captain, setCaptain] = useState<Captain | null>(null);
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [availableRides, setAvailableRides] = useState<MotorideRide[]>([]);
  const [activeRide, setActiveRide] = useState<MotorideRide | null>(null);
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
      if (activeRide) {
        loadActiveRide();
      }
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
        setIsOnline(cpt.is_online);
      }
      const w = await motorideApi.getWallet(captainId);
      if (w) {
        setWalletBalance(w.wallet.balance);
        setWalletTransactions(w.transactions);
      }
    } catch {}
  };

  const loadAvailableRides = async () => {
    try {
      const list = await motorideApi.getRides({ active_for_captain: true });
      setAvailableRides(list);
    } catch {}
  };

  const loadActiveRide = async () => {
    try {
      const list = await motorideApi.getRides({ captain_id: captainId });
      const current = list.find(
        (r) =>
          r.status === 'captain_accepted' ||
          r.status === 'captain_arrived' ||
          r.status === 'trip_started'
      );
      if (current) {
        setActiveRide(current);
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
    try {
      const updated = await motorideApi.toggleCaptainOnline(captainId, !isOnline);
      setIsOnline(updated.is_online);
    } catch (err: any) {
      alert(err.message || 'Failed to toggle status');
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
  const handleSendCounterOffer = async (rideId: string) => {
    const proposedFare = counterFareInput[rideId];
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
      passengerName={activeRide?.passenger_name || 'Passenger'}
      pickupLat={activeRide ? activeRide.pickup_lat : null}
      pickupLng={activeRide ? activeRide.pickup_lng : null}
      pickupAddress={activeRide ? activeRide.pickup_address : undefined}
      dropoffLat={activeRide ? activeRide.dropoff_lat : null}
      dropoffLng={activeRide ? activeRide.dropoff_lng : null}
      dropoffAddress={activeRide ? activeRide.dropoff_address : undefined}
      className={`w-full h-full ${isFullBackground ? 'rounded-none border-0' : 'shadow-2xl border border-slate-800'}`}
      showOverlayControls={true}
      onLocateMe={startWatchingLocation}
    />
  );

  const renderCaptainControls = () => (
    <div className="flex flex-col gap-3 pb-4">
      {activeRide ? (
        /* Active Trip Execution Card */
        <div className="bg-black/45 backdrop-blur-xl border border-white/15 rounded-3xl p-5 flex flex-col gap-4 shadow-2xl">
          <div className="flex items-center justify-between pb-3 border-b border-white/15">
            <div>
              <span className="text-[10px] font-mono-num text-amber-400 font-bold">
                {activeRide.ride_code}
              </span>
              <h3 className="text-base font-extrabold text-white capitalize">
                {activeRide.status.replace(/_/g, ' ')}
              </h3>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowChatModal(true)}
                className="p-2.5 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 hover:bg-emerald-500/30 shadow-md"
                title="Chat with Passenger"
              >
                <MessageSquare className="w-4 h-4 stroke-[2.5]" />
              </button>
              <a
                href={`tel:${activeRide.passenger_phone || '+919780012345'}`}
                className="p-2.5 rounded-xl bg-emerald-500 text-slate-950 font-bold hover:bg-emerald-400 shadow-md"
                title="Call Passenger"
              >
                <Phone className="w-4 h-4 stroke-[2.5]" />
              </a>
            </div>
          </div>

          {/* Passenger Info */}
          <div className="p-3 rounded-2xl bg-black/50 border border-white/15 flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-white block">
                {activeRide.passenger_name}
              </span>
              <span className="text-[11px] text-slate-300">
                {activeRide.payment_method.toUpperCase()} Payment • Agreed Fare:
              </span>
            </div>
            <span className="text-lg font-black text-emerald-400 font-mono-num">
              ₹{activeRide.final_fare || activeRide.offered_fare}
            </span>
          </div>

          {/* Route Details with Navigator Capsule on top */}
          <div className="p-3.5 rounded-2xl bg-black/40 border border-white/10 flex flex-col gap-2.5">
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
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gradient-to-r from-emerald-400 to-teal-400 hover:from-emerald-300 hover:to-teal-300 text-slate-950 text-[11px] font-black transition-all shadow-md active:scale-95 cursor-pointer select-none ring-1 ring-white/30 animate-pulse"
                        title={isArrivedOrLater ? 'Navigate to Drop-off destination' : 'Navigate to Pickup point'}
                      >
                        <Navigation className="w-3 h-3 fill-slate-950 stroke-slate-950 shrink-0" />
                        <span>{navTitle}</span>
                      </a>
                      <span className="text-[10px] text-slate-400">
                        {activeRide.distance_km} km • ~{activeRide.duration_minutes}m
                      </span>
                    </div>

                    <a
                      href={`https://www.google.com/maps/dir/?api=1&origin=${activeRide.pickup_lat},${activeRide.pickup_lng}&destination=${activeRide.dropoff_lat},${activeRide.dropoff_lng}&travelmode=driving`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[10px] text-emerald-300 hover:underline flex items-center gap-0.5"
                      title="Full Route (Pickup to Drop-off)"
                    >
                      <span>Full Route &rarr;</span>
                    </a>
                  </div>

                  {/* Pickup Address */}
                  <div className="pl-2.5 border-l-2 border-emerald-500/60 mt-1">
                    <span className="text-[10px] uppercase font-black tracking-wider text-emerald-400 flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block shrink-0" />
                      Pickup Location {activeRide.status === 'captain_accepted' && '(Current Nav Target)'}
                    </span>
                    <p className="text-xs text-white font-medium truncate mt-0.5">
                      {activeRide.pickup_address}
                    </p>
                  </div>
                </div>
              );
            })()}

            {/* Dropoff Location */}
            <div className="flex flex-col gap-1 pt-1.5 border-t border-white/10">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] uppercase font-bold text-rose-400 flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-rose-400 inline-block shrink-0" />
                  Drop-off Location {(activeRide.status === 'captain_arrived' || activeRide.status === 'trip_started') && '(Current Nav Target)'}
                </span>
              </div>
              <p className="text-xs text-slate-300 pl-2.5 border-l-2 border-rose-500/60 truncate">
                {activeRide.dropoff_address}
              </p>
            </div>

            {activeRide.comment && (
              <p className="flex items-center gap-1.5 pt-1.5 border-t border-white/10 text-emerald-300 text-xs">
                <MessageSquare className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span className="truncate italic">Passenger note: "{activeRide.comment}"</span>
              </p>
            )}
          </div>

          {/* Chat with Passenger Button */}
          <button
            type="button"
            onClick={() => setShowChatModal(true)}
            className="w-full py-2.5 rounded-2xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-md"
          >
            <MessageSquare className="w-4 h-4 text-emerald-400" />
            <span>Chat with Passenger ({activeRide.passenger_name})</span>
          </button>

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
                className="w-full py-3 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs shadow-lg transition-all active:scale-98 cursor-pointer flex items-center justify-center gap-2"
              >
                <Navigation className="w-4 h-4 stroke-[2.5]" />
                <span>Passenger Boarded • Start Trip</span>
              </button>
            )}

            {activeRide.status === 'trip_started' && (
              <button
                type="button"
                onClick={() => handleStatusChange('trip_completed')}
                className="w-full py-3 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs shadow-lg transition-all active:scale-98 cursor-pointer flex items-center justify-center gap-2"
              >
                <CheckCircle2 className="w-4 h-4 stroke-[2.5]" />
                <span>Arrived at Destination • Complete Trip</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleCancelTrip}
              className="w-full py-2 rounded-xl text-rose-400 hover:bg-rose-500/10 text-xs font-semibold cursor-pointer transition-colors"
            >
              Cancel Ride
            </button>
          </div>
        </div>
      ) : (
        /* Incoming Live Ride Requests Only - Light Black Transparent Background */
        <div className="bg-black/45 backdrop-blur-xl border border-white/15 rounded-3xl p-4 sm:p-5 flex flex-col gap-3 shadow-2xl">
          <div className="flex items-center justify-between pb-2 border-b border-white/15">
            <h3 className="text-sm font-black text-white flex items-center gap-2">
              <Bike className="w-4 h-4 text-amber-400" />
              <span>Live Ride Requests</span>
            </h3>
            <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-mono-num border border-amber-500/30">
              {availableRides.length} Available
            </span>
          </div>

          {!isOnline || availableRides.length === 0 ? (
            <div className="text-center py-10 sm:py-14 text-slate-300 text-xs flex flex-col items-center justify-center gap-5">
              {/* Round Shaped Center Online/Offline Button with Radar Sonar Pulses */}
              <div className="relative flex items-center justify-center my-2">
                {/* Radar Sonar Pulse Rings when Online */}
                {isOnline && (
                  <>
                    <div className="absolute w-36 h-36 sm:w-40 sm:h-40 rounded-full bg-emerald-500/20 animate-ping pointer-events-none" />
                    <div className="absolute w-44 h-44 sm:w-48 sm:h-48 rounded-full border border-emerald-500/30 animate-pulse pointer-events-none" />
                  </>
                )}

                <button
                  type="button"
                  onClick={handleToggleOnline}
                  className={`relative z-10 w-28 h-28 sm:w-32 sm:h-32 rounded-full flex flex-col items-center justify-center gap-1.5 shadow-2xl transition-all duration-300 active:scale-95 cursor-pointer border-4 select-none ${
                    isOnline
                      ? 'bg-gradient-to-br from-emerald-500 to-emerald-600 text-slate-950 border-emerald-300 shadow-emerald-500/40 hover:from-emerald-400 hover:to-emerald-500 hover:scale-105'
                      : 'bg-gradient-to-br from-rose-500 to-rose-600 text-white border-rose-300 shadow-rose-500/40 hover:from-rose-400 hover:to-rose-500 hover:scale-105'
                  }`}
                  title={isOnline ? 'Currently Online. Click to go Offline' : 'Currently Offline. Click to go Online'}
                >
                  <Power className="w-7 h-7 sm:w-8 sm:h-8 stroke-[3]" />
                  <span className="text-xs sm:text-sm font-black tracking-wider uppercase">
                    {isOnline ? 'ONLINE' : 'OFFLINE'}
                  </span>
                  <span
                    className={`w-2 h-2 rounded-full ${
                      isOnline ? 'bg-slate-950 animate-pulse' : 'bg-white'
                    }`}
                  />
                </button>
              </div>

              {/* Status & Scanning Message */}
              <div className="flex flex-col items-center gap-1 text-center px-4">
                <p className="text-sm font-bold text-white flex items-center justify-center gap-2">
                  {isOnline ? (
                    <>
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping shrink-0" />
                      <span>Scanning for nearby live ride requests...</span>
                    </>
                  ) : (
                    <>
                      <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                      <span>You are currently OFFLINE</span>
                    </>
                  )}
                </p>
                <span className="text-[11px] text-slate-300 max-w-sm">
                  {isOnline
                    ? 'Passenger requests appear here instantly in real time with audio alert'
                    : 'Tap the round button above to go Online and start receiving rides'}
                </span>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-3 overflow-y-auto pr-1">
              {availableRides.map((ride) => (
                <div
                  key={ride.id}
                  className="p-4 rounded-2xl bg-black/50 backdrop-blur-md border border-white/15 flex flex-col gap-3 shadow-lg hover:border-amber-500/40 transition-all"
                >
                  {/* Top Row: Passenger Profile on Left Side & Offered Fare on Right */}
                  <div className="flex items-center justify-between gap-3">
                    {/* Passenger Profile (Left Side) */}
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="relative shrink-0">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-amber-400 via-amber-500 to-amber-600 text-slate-950 font-black text-sm flex items-center justify-center shadow-md ring-2 ring-white/10">
                          {ride.passenger_name?.charAt(0)?.toUpperCase() || 'P'}
                        </div>
                        <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-emerald-500 rounded-full border-2 border-black flex items-center justify-center" title="Active passenger">
                          <span className="w-1 h-1 bg-white rounded-full" />
                        </div>
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs sm:text-sm font-bold text-white truncate">
                            {ride.passenger_name}
                          </span>
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[10px] font-bold shrink-0">
                            <Star className="w-2.5 h-2.5 fill-amber-400 text-amber-400" />
                            4.9
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 text-[11px] text-slate-300">
                          <span className="font-mono-num font-bold text-amber-400/90 text-[10px] bg-amber-400/10 px-1 rounded">
                            {ride.ride_code}
                          </span>
                          <span>•</span>
                          <span className="capitalize">{ride.payment_method}</span>
                        </div>
                      </div>
                    </div>

                    {/* Offered Fare (Right Side) */}
                    <div className="text-right shrink-0">
                      <span className="text-base sm:text-lg font-black text-emerald-400 font-mono-num block leading-tight">
                        ₹{ride.offered_fare}
                      </span>
                      <span className="text-[10px] text-slate-400 font-medium">Offered Fare</span>
                    </div>
                  </div>

                  {/* Route Information */}
                  <div className="p-3 rounded-2xl bg-black/40 border border-white/10 flex flex-col gap-2">
                    {/* Pickup Location Header */}
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] uppercase font-black tracking-wider text-emerald-400 flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block shrink-0" />
                        Pickup Location
                      </span>
                    </div>

                    {/* Pickup Address */}
                    <div className="text-xs text-white font-medium pl-2.5 border-l-2 border-emerald-500/60">
                      <p className="truncate">{ride.pickup_address}</p>
                    </div>

                    {/* Dropoff Address */}
                    <div className="text-xs text-slate-300 pl-2.5 border-l-2 border-rose-500/60 flex items-center justify-between gap-2 pt-0.5">
                      <div className="min-w-0">
                        <span className="text-[10px] uppercase font-bold text-rose-400 block leading-tight">Drop-off</span>
                        <p className="truncate">{ride.dropoff_address}</p>
                      </div>
                      <div className="text-[11px] text-slate-300 text-right shrink-0">
                        <span className="font-bold text-slate-100">{ride.distance_km} km</span>
                        <span className="block text-[10px] text-slate-400">~{ride.duration_minutes}m • {ride.ride_type.toUpperCase()}</span>
                      </div>
                    </div>

                    {ride.comment && (
                      <p className="text-[11px] text-emerald-300 bg-emerald-950/40 px-2 py-1 rounded-lg border border-emerald-500/20 flex items-center gap-1.5 mt-0.5">
                        <MessageSquare className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        <span className="truncate italic">"{ride.comment}"</span>
                      </p>
                    )}
                  </div>

                  {/* Action Buttons: Accept / Counter Offer */}
                  <div className="flex items-center gap-2 pt-1 border-t border-white/15">
                    <button
                      type="button"
                      onClick={() => handleAcceptRide(ride)}
                      className="flex-1 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-xs shadow-md transition-all active:scale-95 cursor-pointer text-center"
                    >
                      Accept ₹{ride.offered_fare}
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setShowCounterModal(ride.id);
                        setCounterFareInput((prev) => ({
                          ...prev,
                          [ride.id]: ride.offered_fare + 15,
                        }));
                      }}
                      className="px-3.5 py-2.5 rounded-xl bg-black/60 hover:bg-black/80 border border-white/20 text-amber-400 font-bold text-xs transition-all active:scale-95 cursor-pointer"
                    >
                      Counter
                    </button>
                  </div>

                  {/* Counter Offer Inline Popover */}
                  {showCounterModal === ride.id && (
                    <div className="p-3 rounded-xl bg-black/80 backdrop-blur-md border border-amber-500/40 flex items-center justify-between gap-2 mt-1 shadow-xl">
                      <span className="text-xs text-slate-200">Your price: ₹</span>
                      <input
                        type="number"
                        value={counterFareInput[ride.id] || ride.offered_fare + 15}
                        onChange={(e) =>
                          setCounterFareInput((prev) => ({
                            ...prev,
                            [ride.id]: Number(e.target.value),
                          }))
                        }
                        className="w-20 px-2 py-1 rounded bg-black/70 border border-white/25 text-amber-300 font-mono-num font-bold text-sm text-center"
                      />
                      <button
                        type="button"
                        onClick={() => handleSendCounterOffer(ride.id)}
                        className="px-3 py-1 rounded bg-amber-500 text-slate-950 font-bold text-xs cursor-pointer hover:bg-amber-400 shadow-md"
                      >
                        Send
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );

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

      {/* Center Main Page: Captain Live Ride Requests Page (100% Full / Minimized to Bottom View) */}
      <div
        className={`fixed sm:absolute bottom-0 left-1/2 -translate-x-1/2 z-[1000] transition-all duration-300 ease-out flex flex-col ${
          is100Full
            ? 'inset-0 w-full h-full max-w-full'
            : 'h-16 sm:h-[72px] w-full sm:w-[94%] md:w-[760px] lg:w-[840px] max-w-4xl'
        }`}
      >
        <div
          className={`w-full h-full bg-black/45 sm:bg-black/50 backdrop-blur-2xl border-t border-white/15 shadow-[0_-12px_45px_rgba(0,0,0,0.65)] flex flex-col overflow-hidden ring-1 ring-white/15 ${
            is100Full ? 'rounded-none border-x-0' : 'rounded-t-3xl sm:border-x sm:border-white/15'
          }`}
        >
          {/* Top Bar with Live Requests Counter & 100% Full / Minimize Tab */}
          <div
            onClick={(e) => {
              // If minimized and user clicks on empty bar area, maximize to 100%
              if (!is100Full && (e.target as HTMLElement).tagName !== 'BUTTON' && !(e.target as HTMLElement).closest('button')) {
                setIs100Full(true);
              }
            }}
            className={`px-3.5 sm:px-5 py-2.5 sm:py-3 bg-black/40 backdrop-blur-xl flex items-center justify-between relative select-none shadow-md ${
              is100Full ? 'border-b border-white/15' : 'cursor-pointer hover:bg-black/60 transition-colors'
            }`}
          >
            {/* Left: Status & Live Requests Count */}
            <div className="flex items-center gap-2 min-w-0">
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-black/60 border border-white/15 text-xs">
                <span
                  className={`w-2 h-2 rounded-full ${
                    isOnline ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'
                  }`}
                />
                <span className="font-bold text-slate-300">
                  {isOnline ? 'Online' : 'Offline'}
                </span>
              </div>
              <div className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-bold font-mono-num">
                <Bike className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span>{availableRides.length} Requests</span>
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
                    ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-amber-500/20'
                    : 'bg-amber-500/20 text-amber-300 hover:bg-amber-500 hover:text-slate-950 border-amber-500/40'
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

          {/* Main Interior - Live Ride Requests (Shown when 100% Full) */}
          {is100Full && (
            <div className="flex-1 overflow-y-auto px-3.5 sm:px-6 py-4 scrollbar-thin">
              {renderCaptainControls()}
            </div>
          )}
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
