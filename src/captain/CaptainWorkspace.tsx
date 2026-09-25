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
import { CaptainPassengerRatingModal } from './CaptainPassengerRatingModal';
import { motorideApi } from '../services/motorideApi';
import { realtimeSync } from '../services/realtimeSync';
import { calculateBearingDegrees, calculateRoadDistanceKm } from '../utils/distanceCalculator';
import { supabaseAuth, AuthUser } from '../lib/supabaseAuth';
import { safeStorage } from '../lib/safeStorage';
import { CaptainProfileDrawer } from './CaptainProfileDrawer';
import {
  Bike,
  Power,
  Navigation,
  Navigation2,
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
  ShieldCheck,
  LocateFixed,
  Radio,
  TrendingUp,
  X,
  ArrowLeft,
  IndianRupee,
  History,
  Volume2,
} from 'lucide-react';
import defaultRituAvatar from '../assets/images/passenger_ritu_avatar_1790347071742.jpg';
import { MotorideRideHistoryModal } from '../components/MotorideRideHistoryModal';

interface CaptainWorkspaceProps {
  captainId?: string;
  captainName?: string;
  currentUser?: AuthUser | null;
  onOpenWallet?: () => void;
  onSignOut?: () => void;
  isOnline?: boolean;
  onToggleOnline?: () => void;
}

// Realistic road distance calculator for urban travel proximity
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  return calculateRoadDistanceKm(lat1, lon1, lat2, lon2);
}

// Service / Vehicle Badge Helper (Motobike, Auto, Cab, Courier)
export function getServiceBadge(rideType?: string) {
  switch (rideType?.toLowerCase()) {
    case 'auto':
      return {
        label: 'Auto Rickshaw',
        shortLabel: 'Auto',
        icon: '🛺',
        bg: 'bg-amber-50 text-amber-950 border-amber-300',
        badgeBg: 'bg-amber-100 text-amber-950 border-amber-400',
      };
    case 'car':
      return {
        label: 'Comfort AC Cab',
        shortLabel: 'Cab / Car',
        icon: '🚗',
        bg: 'bg-blue-50 text-blue-950 border-blue-300',
        badgeBg: 'bg-blue-100 text-blue-950 border-blue-400',
      };
    case 'courier':
      return {
        label: 'Courier Parcel',
        shortLabel: 'Courier',
        icon: '📦',
        bg: 'bg-emerald-50 text-emerald-950 border-emerald-300',
        badgeBg: 'bg-emerald-100 text-emerald-950 border-emerald-400',
      };
    case 'bike':
    default:
      return {
        label: 'Motobike',
        shortLabel: 'Motobike',
        icon: '🏍️',
        bg: 'bg-slate-100 text-slate-900 border-slate-300',
        badgeBg: 'bg-slate-200 text-slate-900 border-slate-400',
      };
  }
}

export const CaptainWorkspace: React.FC<CaptainWorkspaceProps> = ({
  captainId = '',
  captainName = 'Captain',
  currentUser,
  onOpenWallet,
  onSignOut,
  isOnline: propIsOnline,
  onToggleOnline: propToggleOnline,
}) => {
  const authUser = currentUser || supabaseAuth.getCurrentUser();
  const resolvedInitialName = currentUser?.name || (captainName && captainName !== 'Captain' ? captainName : undefined) || authUser?.name || 'Captain';

  const [captain, setCaptain] = useState<Captain | null>(() => {
    if (authUser) {
      return {
        id: authUser.id || captainId,
        profile_id: `prof_${authUser.id || captainId}`,
        full_name: resolvedInitialName,
        email: authUser.email || '',
        phone: authUser.phone || '',
        is_online: true,
        is_approved: true,
        is_active: true,
        current_lat: 30.704649,
        current_lng: 76.717873,
        rating: 5.0,
        total_rides: 0,
        vehicle: {
          id: `veh_${authUser.id || captainId}`,
          captain_id: authUser.id || captainId,
          model: authUser.vehicleModel || 'Motorcycle',
          plate_number: authUser.plateNumber || '',
          vehicle_type: (authUser.vehicleType as any) || 'bike',
          color: 'Black',
          is_active: true,
        },
        created_at: authUser.memberSince || new Date().toISOString(),
      };
    }
    return null;
  });
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
  const [walletBalance, setWalletBalance] = useState<number>(0);
  const [todayIncome, setTodayIncome] = useState<number>(0);
  const [todayCompletedRidesCount, setTodayCompletedRidesCount] = useState<number>(0);
  const [isProfileOpen, setIsProfileOpen] = useState<boolean>(false);
  const [isRideHistoryOpen, setIsRideHistoryOpen] = useState<boolean>(false);
  const [showChatModal, setShowChatModal] = useState<boolean>(false);
  const [hasUnreadMessages, setHasUnreadMessages] = useState<boolean>(false);
  const showChatModalRef = useRef<boolean>(false);
  showChatModalRef.current = showChatModal;
  const [showPassengerRatingModal, setShowPassengerRatingModal] = useState<boolean>(false);
  const [completedRideForRating, setCompletedRideForRating] = useState<MotorideRide | null>(null);
  const [isFinishingRide, setIsFinishingRide] = useState<boolean>(false);
  const [mapFocusTarget, setMapFocusTarget] = useState<{ lat: number; lng: number; zoom?: number; timestamp: number } | null>(null);

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

  const getCaptainRatedRideIds = (cid: string): string[] => {
    try {
      const userSpecific = JSON.parse(safeStorage.getItem(`motoride_captain_rated_rides_${cid}`) || '[]');
      const globalRated = JSON.parse(safeStorage.getItem('motoride_captain_rated_rides') || '[]');
      return Array.from(new Set([...userSpecific, ...globalRated]));
    } catch {
      return [];
    }
  };

  const markCaptainRideAsRated = (cid: string, rideId: string) => {
    try {
      const ids = getCaptainRatedRideIds(cid);
      if (!ids.includes(rideId)) {
        ids.push(rideId);
        safeStorage.setItem(`motoride_captain_rated_rides_${cid}`, JSON.stringify(ids));
        safeStorage.setItem('motoride_captain_rated_rides', JSON.stringify(ids));
      }
    } catch {}
  };

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
    try {
      navigator.geolocation.getCurrentPosition(
        (pos) => handlePositionSuccess(pos),
        (err) => {
          // Fallback to low accuracy if high accuracy fails
          try {
            navigator.geolocation.getCurrentPosition(
              (pos) => handlePositionSuccess(pos),
              (finalErr) => handlePositionError(finalErr),
              { enableHighAccuracy: false, timeout: 10000, maximumAge: 30000 }
            );
          } catch {}
        },
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 5000 }
      );
    } catch (e) {
      console.warn('Initial captain geolocation attempt caught:', e);
    }

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
    const timer = setTimeout(() => {
      startWatchingLocation();
    }, 1200);
    return () => {
      clearTimeout(timer);
      if (watchIdRef.current !== null && 'geolocation' in navigator) {
        try {
          navigator.geolocation.clearWatch(watchIdRef.current);
        } catch {}
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
      if (!newRide || !newRide.id || newRide.id.includes('demo') || newRide.passenger_id === 'usr_demo_100') {
        return;
      }
      if (newRide.status !== 'requested' && newRide.status !== 'captain_offered') {
        return;
      }
      setAvailableRides((prev) => {
        const exists = prev.some((r) => r.id === newRide.id);
        if (exists) {
          return prev.map((r) => (r.id === newRide.id ? { ...r, ...newRide } : r));
        }
        return [newRide, ...prev.filter((r) => !r.id.includes('demo') && r.passenger_id !== 'usr_demo_100')];
      });
      setIs100Full(true);
      // Vibrate mobile device when new ride arrives
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        try {
          navigator.vibrate([100, 50, 100]);
        } catch {}
      }
    });

    const unsubRideUpdated = realtimeSync.on('RIDE_UPDATED', (updatedRide: MotorideRide) => {
      if (!updatedRide || !updatedRide.id) return;
      if (updatedRide.captain_id === captainId) {
        const ratedIds = getCaptainRatedRideIds(captainId);
        if (updatedRide.status.includes('cancelled') || updatedRide.captain_rated || ratedIds.includes(updatedRide.id)) {
          setActiveRide(null);
          setShowPassengerRatingModal(false);
          setCompletedRideForRating(null);
          loadCaptainData();
        } else {
          setActiveRide(updatedRide);
          if ((updatedRide.status === 'trip_completed' || updatedRide.status === 'completed') && !updatedRide.captain_rated && !ratedIds.includes(updatedRide.id)) {
            setCompletedRideForRating(updatedRide);
            setShowPassengerRatingModal(true);
          } else {
            setShowPassengerRatingModal(false);
            setCompletedRideForRating(null);
          }
        }
      }

      setAvailableRides((prev) => {
        if (updatedRide.status !== 'requested' && updatedRide.status !== 'captain_offered') {
          return prev.filter((r) => r.id !== updatedRide.id);
        }
        const exists = prev.some((r) => r.id === updatedRide.id);
        if (exists) {
          return prev.map((r) => (r.id === updatedRide.id ? { ...r, ...updatedRide } : r));
        }
        return [updatedRide, ...prev];
      });
    });

    const unsubRideAccepted = realtimeSync.on('RIDE_ACCEPTED', (acceptedRide: MotorideRide) => {
      if (!acceptedRide || !acceptedRide.id) return;
      if (acceptedRide.captain_id === captainId) {
        setActiveRide(acceptedRide);
        playRideAcceptedTune();
      }
      setAvailableRides((prev) => prev.filter((r) => r.id !== acceptedRide.id));
    });

    const unsubRideOffer = realtimeSync.on('RIDE_OFFER_RECEIVED', (payload: any) => {
      const ride = payload?.ride;
      if (ride && ride.id) {
        setAvailableRides((prev) => prev.map((r) => (r.id === ride.id ? { ...r, ...ride } : r)));
      }
    });

    const unsubRideDeleted = realtimeSync.on('RIDE_DELETED', (payload: any) => {
      const id = payload?.id || payload?.ride_id;
      if (id) {
        setAvailableRides((prev) => prev.filter((r) => r.id !== id));
      }
    });

    const unsubActiveSync = realtimeSync.on('ACTIVE_RIDES_SYNC_RECEIVED', (rides: MotorideRide[]) => {
      if (Array.isArray(rides) && rides.length > 0) {
        const valid = rides.filter(
          (r) => r && (r.status === 'requested' || r.status === 'captain_offered') && !r.id.includes('demo') && r.passenger_id !== 'usr_demo_100'
        );
        if (valid.length > 0) {
          setAvailableRides((prev) => {
            const map = new Map<string, MotorideRide>();
            prev.forEach((r) => map.set(r.id, r));
            valid.forEach((r) => map.set(r.id, { ...(map.get(r.id) || {}), ...r }));
            return Array.from(map.values()).sort(
              (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
            );
          });
        }
      }
    });

    // Real-time synchronization when rides are completed and earnings update
    const unsubEarningsUpdated = realtimeSync.on('EARNINGS_UPDATED', () => {
      loadCaptainData();
    });

    const unsubFareUpdated = realtimeSync.on('FARE_SETTINGS_UPDATED', (fare: FareSettings) => {
      if (fare) setFareSettings(fare);
    });

    const unsubQrUpdated = realtimeSync.on('QR_SETTINGS_UPDATED', (qr: QRCodeSetting) => {
      if (qr) setQrSettings(qr);
    });

    // Automatic daily reset: check if the calendar date changed in the local business timezone (Asia/Kolkata)
    // When midnight passes, Today's Income automatically resets to ₹0 without requiring manual actions.
    let lastCheckedDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
    const rolloverInterval = setInterval(() => {
      const currentDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
      if (currentDate !== lastCheckedDate) {
        lastCheckedDate = currentDate;
        loadCaptainData();
      }
    }, 10000);

    // Continuous 2.5-second polling to ensure cross-browser/mobile sync even if SSE sleeps on mobile
    const pollInterval = setInterval(() => {
      loadAvailableRides();
      loadActiveRide();
    }, 2500);

    // Immediate re-fetch when switching back to mobile browser tab or storage changes
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        loadAvailableRides();
        loadActiveRide();
        loadCaptainData();
        loadSettings();
      }
    };

    const handleStorageChange = (e: StorageEvent) => {
      if (
        e.key === 'motoride_active_rides_cache' ||
        e.key === 'motoride_rides_store' ||
        e.key === 'motoride_realtime_ping'
      ) {
        loadAvailableRides();
        loadActiveRide();
      }
    };

    window.addEventListener('focus', handleVisibility);
    window.addEventListener('storage', handleStorageChange);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      unsubRideCreated();
      unsubRideUpdated();
      unsubRideAccepted();
      unsubRideOffer();
      unsubRideDeleted();
      unsubActiveSync();
      unsubEarningsUpdated();
      unsubFareUpdated();
      unsubQrUpdated();
      clearInterval(rolloverInterval);
      clearInterval(pollInterval);
      window.removeEventListener('focus', handleVisibility);
      window.removeEventListener('storage', handleStorageChange);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [captainId, activeRide?.id]);

  useEffect(() => {
    if (inspectedRide && (inspectedRide.id.includes('demo') || inspectedRide.passenger_id === 'usr_demo_100')) {
      setInspectedRide(null);
    }
  }, [inspectedRide]);

  // Active ride live movement simulator: moves captain to Location A during 'captain_accepted', and to Location B during 'trip_started'
  useEffect(() => {
    if (!activeRide) return;

    const isAccepted = activeRide.status === 'captain_accepted';
    const isTripStarted = activeRide.status === 'trip_started';

    if (!isAccepted && !isTripStarted) return;

    const interval = setInterval(() => {
      const targetLat = isAccepted ? activeRide.pickup_lat : activeRide.dropoff_lat;
      const targetLng = isAccepted ? activeRide.pickup_lng : activeRide.dropoff_lng;

      setCaptainGps((prev) => {
        const dLat = targetLat - prev.lat;
        const dLng = targetLng - prev.lng;
        const dist = Math.hypot(dLat, dLng);

        if (dist < 0.0001) {
          return prev;
        }

        // Advance smoothly towards target
        const fraction = Math.max(0.12, Math.min(0.25, 0.0004 / (dist || 1)));
        const newLat = prev.lat + dLat * fraction;
        const newLng = prev.lng + dLng * fraction;
        const fixedLat = Number(newLat.toFixed(6));
        const fixedLng = Number(newLng.toFixed(6));

        const heading = calculateBearingDegrees(prev.lat, prev.lng, targetLat, targetLng);
        const speed = isTripStarted ? 35 : 25;

        motorideApi.updateCaptainLiveLocation({
          captain_id: captainId,
          ride_id: activeRide.id,
          latitude: fixedLat,
          longitude: fixedLng,
          heading,
          speed,
        });

        return {
          ...prev,
          lat: fixedLat,
          lng: fixedLng,
          heading,
          speed,
          timestamp: Date.now(),
        };
      });
    }, 1800);

    return () => clearInterval(interval);
  }, [activeRide?.id, activeRide?.status, captainId]);

  const loadCaptainData = async () => {
    try {
      const cpt = await motorideApi.getCaptainById(captainId);
      if (cpt) {
        setCaptain((prev) => ({
          ...(prev || ({} as Captain)),
          ...cpt,
          full_name: cpt.full_name || safeStorage.getItem('motoride_captain_name') || currentUser?.name || resolvedInitialName || 'Captain',
          phone: cpt.phone || safeStorage.getItem('motoride_captain_phone') || '',
          vehicle: {
            id: cpt.vehicle?.id || (prev?.vehicle?.id ?? 'veh_1'),
            captain_id: captainId,
            is_active: true,
            model: cpt.vehicle?.model || safeStorage.getItem('motoride_captain_vehicle_model') || 'Motorcycle',
            plate_number: cpt.vehicle?.plate_number || safeStorage.getItem('motoride_captain_plate') || '',
            vehicle_type: cpt.vehicle?.vehicle_type || 'bike',
            color: cpt.vehicle?.color || 'Black',
          },
          license_number: (cpt as any).license_number || safeStorage.getItem('motoride_captain_dl') || '',
          emergency_contact: (cpt as any).emergency_contact || safeStorage.getItem('motoride_captain_sos') || '',
        }));
        setInternalOnline(Boolean(cpt.is_online));
      }
      const w = await motorideApi.getWallet(captainId);
      if (w && w.wallet) {
        setWalletBalance(w.wallet.balance || 0);
        setWalletTransactions(w.transactions || []);
      }

      // Fetch Today's Income calculated dynamically from the database
      // Only includes rides completed today with status = 'completed' or 'trip_completed'
      try {
        const incomeRes = await motorideApi.getCaptainTodayIncome(captainId);
        if (incomeRes) {
          setTodayIncome(incomeRes.today_income);
          setTodayCompletedRidesCount(incomeRes.completed_rides_today);
        }
      } catch (incomeErr) {
        console.warn('Today income fetch notice:', incomeErr);
      }
    } catch {}
  };

  // Soft nice caller tune alert for incoming ride requests
  const playIncomingCallTune = () => {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;
      const ctx = new AudioContextClass();
      if (ctx.state === 'suspended') {
        ctx.resume();
      }
      
      const notes = [523.25, 659.25, 783.99, 987.77, 1046.50]; // C5, E5, G5, B5, C6 soft marimba chime
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.12);
        
        gain.gain.setValueAtTime(0, ctx.currentTime + idx * 0.12);
        gain.gain.linearRampToValueAtTime(0.15, ctx.currentTime + idx * 0.12 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + idx * 0.12 + 0.35);
        
        osc.connect(gain);
        gain.connect(ctx.destination);
        
        osc.start(ctx.currentTime + idx * 0.12);
        osc.stop(ctx.currentTime + idx * 0.12 + 0.4);
      });
    } catch (e) {
      console.warn('Audio playback notice:', e);
    }
  };

  // Play triumphant sound alert when ride is accepted
  const playRideAcceptedTune = () => {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;
      const ctx = new AudioContextClass();
      if (ctx.state === 'suspended') {
        ctx.resume();
      }
      
      const notes = [659.25, 783.99, 1046.50, 1318.51]; // E5, G5, C6, E6
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.1);
        
        gain.gain.setValueAtTime(0, ctx.currentTime + idx * 0.1);
        gain.gain.linearRampToValueAtTime(0.2, ctx.currentTime + idx * 0.1 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + idx * 0.1 + 0.3);
        
        osc.connect(gain);
        gain.connect(ctx.destination);
        
        osc.start(ctx.currentTime + idx * 0.1);
        osc.stop(ctx.currentTime + idx * 0.1 + 0.35);
      });

      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate([150, 75, 150]);
      }
    } catch (e) {
      console.warn('Audio playback notice:', e);
    }
  };

  // Play exciting sound alert when trip starts
  const playTripStartedTune = () => {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;
      const ctx = new AudioContextClass();
      if (ctx.state === 'suspended') {
        ctx.resume();
      }
      
      const notes = [523.25, 659.25, 783.99, 1046.50, 1318.51, 1567.98]; // C5, E5, G5, C6, E6, G6
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.08);
        
        gain.gain.setValueAtTime(0, ctx.currentTime + idx * 0.08);
        gain.gain.linearRampToValueAtTime(0.2, ctx.currentTime + idx * 0.08 + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + idx * 0.08 + 0.25);
        
        osc.connect(gain);
        gain.connect(ctx.destination);
        
        osc.start(ctx.currentTime + idx * 0.08);
        osc.stop(ctx.currentTime + idx * 0.08 + 0.3);
      });

      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate([100, 50, 100, 50, 200]);
      }
    } catch (e) {
      console.warn('Audio playback notice:', e);
    }
  };

  // Play subtle sound alert when passenger sends a chat message
  const playMessageNotificationChime = () => {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;
      const ctx = new AudioContextClass();
      if (ctx.state === 'suspended') ctx.resume();

      const now = ctx.currentTime;
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(659.25, now);
      gain1.gain.setValueAtTime(0, now);
      gain1.gain.linearRampToValueAtTime(0.18, now + 0.02);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.22);

      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(880, now + 0.1);
      gain2.gain.setValueAtTime(0, now + 0.1);
      gain2.gain.linearRampToValueAtTime(0.22, now + 0.12);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.1);
      osc2.stop(now + 0.37);

      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate([100, 50, 100]);
      }
    } catch (e) {
      console.warn('Audio playback notice:', e);
    }
  };

  // Track unread passenger chat messages after ride is accepted
  useEffect(() => {
    const isAcceptedRide = activeRide && ['captain_accepted', 'captain_arrived', 'trip_started'].includes(activeRide.status);
    if (!isAcceptedRide || !activeRide.id) {
      setHasUnreadMessages(false);
      return;
    }

    const rideId = activeRide.id;

    // Check existing unread messages on mount / ride status change
    const checkUnread = async () => {
      try {
        const msgs = await motorideApi.getRideMessages(rideId);
        const lastRead = Number(safeStorage.getItem(`motoride_last_read_chat_${rideId}`) || '0');
        const hasUnread = msgs.some(
          (m) => m.sender_role === 'passenger' && new Date(m.created_at).getTime() > lastRead
        );
        if (hasUnread && !showChatModalRef.current) {
          setHasUnreadMessages(true);
        }
      } catch {}
    };
    checkUnread();

    // Periodic check interval (every 3s)
    const interval = setInterval(async () => {
      if (showChatModalRef.current) return;
      try {
        const msgs = await motorideApi.getRideMessages(rideId);
        const lastRead = Number(safeStorage.getItem(`motoride_last_read_chat_${rideId}`) || '0');
        const hasUnread = msgs.some(
          (m) => m.sender_role === 'passenger' && new Date(m.created_at).getTime() > lastRead
        );
        if (hasUnread) {
          setHasUnreadMessages((prev) => {
            if (!prev) playMessageNotificationChime();
            return true;
          });
        }
      } catch {}
    }, 3000);

    // Instant real-time listener for passenger message
    const unsub = realtimeSync.on('RIDE_MESSAGE_RECEIVED', (payload: any) => {
      if (payload && payload.ride_id === rideId && payload.sender_role === 'passenger') {
        if (!showChatModalRef.current) {
          setHasUnreadMessages(true);
          playMessageNotificationChime();
        } else {
          safeStorage.setItem(`motoride_last_read_chat_${rideId}`, Date.now().toString());
        }
      }
    });

    return () => {
      clearInterval(interval);
      unsub();
    };
  }, [activeRide?.id, activeRide?.status]);

  const prevRideIdsRef = useRef<Set<string>>(new Set());
  const isInitializedRef = useRef<boolean>(false);

  useEffect(() => {
    if (!isOnline) {
      isInitializedRef.current = false;
      prevRideIdsRef.current = new Set();
      return;
    }
    const currentIds = new Set(availableRides.map(r => r.id));
    if (!isInitializedRef.current) {
      prevRideIdsRef.current = currentIds;
      isInitializedRef.current = true;
      return;
    }

    let hasNew = false;
    for (const id of currentIds) {
      if (!prevRideIdsRef.current.has(id)) {
        hasNew = true;
        break;
      }
    }
    if (hasNew) {
      playIncomingCallTune();
      setIs100Full(true);
    }
    prevRideIdsRef.current = currentIds;
  }, [availableRides, isOnline]);

  const loadAvailableRides = async () => {
    try {
      if (fareSettings?.require_admin_approval_for_rides && captain && !captain.is_approved) {
        setAvailableRides([]);
        return;
      }
      const list = await motorideApi.getRides({ active_for_captain: true });
      if (Array.isArray(list)) {
        const realRides = list.filter(
          (r) => r && r.id && !r.id.includes('demo') && r.passenger_id !== 'usr_demo_100'
        );

        setAvailableRides((prev) => {
          const map = new Map<string, MotorideRide>();

          // 1. Retain existing live rides in state so they never flash or vanish during polling
          prev.forEach((r) => {
            if (r && (r.status === 'requested' || r.status === 'captain_offered')) {
              map.set(r.id, r);
            }
          });

          // 2. Incorporate latest rides from server
          realRides.forEach((r) => {
            if (r && (r.status === 'requested' || r.status === 'captain_offered')) {
              map.set(r.id, { ...(map.get(r.id) || {}), ...r });
            } else if (r) {
              map.delete(r.id);
            }
          });

          // 3. Remove rides that server omitted ONLY if older than 45 seconds
          // (prevents race conditions where a freshly created ride hasn't propagated to query yet)
          const now = Date.now();
          for (const [id, r] of map.entries()) {
            const isFromServer = realRides.some((sr) => sr.id === id);
            if (!isFromServer) {
              const createdAt = new Date(r.created_at).getTime();
              if (now - createdAt > 45000) {
                map.delete(id);
              }
            }
          }

          return Array.from(map.values()).sort(
            (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          );
        });
      }
    } catch (err) {
      console.warn('Captain loadAvailableRides notice:', err);
      // DO NOT clear availableRides on temporary network hiccup or query timeout!
    }
  };

  const loadActiveRide = async () => {
    try {
      const list = await motorideApi.getRides({ captain_id: captainId });
      if (Array.isArray(list)) {
        const ratedIds = getCaptainRatedRideIds(captainId);
        const current = list.find(
          (r) =>
            r &&
            (r.status === 'captain_accepted' ||
              r.status === 'captain_arrived' ||
              r.status === 'trip_started' ||
              ((r.status === 'trip_completed' || r.status === 'completed') && !r.captain_rated && !ratedIds.includes(r.id)))
        );
        if (current) {
          setActiveRide(current);
          if ((current.status === 'trip_completed' || current.status === 'completed') && !current.captain_rated && !ratedIds.includes(current.id)) {
            setCompletedRideForRating(current);
            setShowPassengerRatingModal(true);
          } else {
            setCompletedRideForRating(null);
            setShowPassengerRatingModal(false);
          }
        } else {
          setActiveRide(null);
          setCompletedRideForRating(null);
          setShowPassengerRatingModal(false);
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
      const savedName = safeStorage.getItem('motoride_captain_name');
      const savedPhone = safeStorage.getItem('motoride_captain_phone');
      const savedModel = safeStorage.getItem('motoride_captain_vehicle_model');
      const savedPlate = safeStorage.getItem('motoride_captain_plate');
      const savedAvatar = safeStorage.getItem('motoride_captain_avatar');

      const resolvedName = (savedName && savedName.trim() && savedName !== 'Captain')
        ? savedName
        : (captain?.full_name && captain.full_name !== 'Captain')
        ? captain.full_name
        : (authUser?.name && authUser.name !== 'Captain' ? authUser.name : (resolvedInitialName !== 'Captain' ? resolvedInitialName : 'Captain'));

      const resolvedPhone = savedPhone || captain?.phone || authUser?.phone || '';
      const resolvedModel = savedModel || captain?.vehicle?.model || authUser?.vehicleModel || 'Motorcycle';
      const resolvedPlate = savedPlate || captain?.vehicle?.plate_number || authUser?.plateNumber || '';
      const captainSavedAvatar = savedAvatar || captain?.avatar_url || authUser?.avatarUrl || undefined;

      const resolvedRating = captain?.rating !== undefined ? captain.rating : ((authUser as any)?.rating || 5.0);
      const resolvedTotalRides = captain?.total_rides ?? 0;

      const updated = await motorideApi.acceptRide(ride.id, {
        captain_id: captain?.id || captainId,
        captain_name: resolvedName,
        captain_avatar: captainSavedAvatar,
        captain_phone: resolvedPhone,
        captain_rating: resolvedRating,
        captain_total_rides: resolvedTotalRides,
        vehicle_model: resolvedModel,
        plate_number: resolvedPlate,
        accepted_fare: ride.offered_fare,
      });
      setActiveRide(updated);
      playRideAcceptedTune();
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
      const savedName = safeStorage.getItem('motoride_captain_name');
      const savedPhone = safeStorage.getItem('motoride_captain_phone');
      const savedModel = safeStorage.getItem('motoride_captain_vehicle_model');
      const savedPlate = safeStorage.getItem('motoride_captain_plate');
      const savedAvatar = safeStorage.getItem('motoride_captain_avatar');

      const resolvedName = (savedName && savedName.trim() && savedName !== 'Captain')
        ? savedName
        : (captain?.full_name && captain.full_name !== 'Captain')
        ? captain.full_name
        : (authUser?.name && authUser.name !== 'Captain' ? authUser.name : (resolvedInitialName !== 'Captain' ? resolvedInitialName : 'Captain'));

      const resolvedPhone = savedPhone || captain?.phone || authUser?.phone || '';
      const resolvedModel = savedModel || captain?.vehicle?.model || authUser?.vehicleModel || 'Motorcycle';
      const resolvedPlate = savedPlate || captain?.vehicle?.plate_number || authUser?.plateNumber || '';
      const captainSavedAvatar = savedAvatar || captain?.avatar_url || authUser?.avatarUrl || undefined;

      const resolvedRating = captain?.rating !== undefined ? captain.rating : ((authUser as any)?.rating || 5.0);
      const resolvedTotalRides = captain?.total_rides ?? 0;

      await motorideApi.sendCounterOffer(rideId, {
        captain_id: captain?.id || captainId,
        captain_name: resolvedName,
        captain_avatar: captainSavedAvatar,
        captain_phone: resolvedPhone,
        rating: resolvedRating,
        captain_total_rides: resolvedTotalRides,
        total_rides: resolvedTotalRides,
        vehicle_model: resolvedModel,
        plate_number: resolvedPlate,
        counter_fare: proposedFare,
      });
      setShowCounterModal(null);
      alert(`Offer of ₹${proposedFare} submitted! The passenger will review it in real-time.`);
    } catch (err: any) {
      alert(err.message || 'Failed to submit offer');
    }
  };

  const handleUpdateCaptainProfile = async (updated: Partial<Captain>) => {
    setCaptain((prev) => (prev ? { ...prev, ...updated } : null));

    try {
      const user = supabaseAuth.getCurrentUser();
      if (user) {
        if (updated.full_name) user.name = updated.full_name;
        if (updated.phone) user.phone = updated.phone;
        if (updated.vehicle?.model) user.vehicleModel = updated.vehicle.model;
        if (updated.vehicle?.plate_number) user.plateNumber = updated.vehicle.plate_number;
        safeStorage.setItem('motoride_auth_user', JSON.stringify(user));
      }
      if (updated.full_name) safeStorage.setItem('motoride_captain_name', updated.full_name);
      if (updated.phone) safeStorage.setItem('motoride_captain_phone', updated.phone);
      if (updated.vehicle?.model) safeStorage.setItem('motoride_captain_vehicle_model', updated.vehicle.model);
      if (updated.vehicle?.plate_number) safeStorage.setItem('motoride_captain_plate', updated.vehicle.plate_number);
      if ((updated as any).license_number) safeStorage.setItem('motoride_captain_dl', (updated as any).license_number);
      if ((updated as any).emergency_contact) safeStorage.setItem('motoride_captain_sos', (updated as any).emergency_contact);
    } catch {}

    try {
      const idToUpdate = captain?.id || captainId;
      if (idToUpdate) {
        await motorideApi.updateCaptainProfile(idToUpdate, {
          full_name: updated.full_name,
          phone: updated.phone,
          ...((updated as any).license_number ? { license_number: (updated as any).license_number } : {}),
          ...((updated as any).emergency_contact ? { emergency_contact: (updated as any).emergency_contact } : {}),
        } as any);
        if (updated.vehicle) {
          await motorideApi.updateCaptainVehicle(idToUpdate, {
            model: updated.vehicle.model,
            plate_number: updated.vehicle.plate_number,
            vehicle_type: updated.vehicle.vehicle_type,
            color: updated.vehicle.color,
          });
        }
      }
    } catch (e) {
      console.warn('Failed to sync captain profile to server:', e);
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

  // Advance Trip Status with immediate optimistic local update & resilient sync
  const handleStatusChange = async (nextStatus: any) => {
    if (!activeRide) return;

    // 1. Instant optimistic state update - 0ms UI delay!
    const nowIso = new Date().toISOString();
    const optimisticRide: MotorideRide = {
      ...activeRide,
      status: nextStatus,
      updated_at: nowIso,
      ...(nextStatus === 'trip_started' ? { trip_started_at: nowIso } : {}),
      ...(nextStatus === 'trip_completed' ? {
        trip_completed_at: nowIso,
        payment_status: 'paid',
        final_fare: activeRide.final_fare || activeRide.offered_fare,
      } : {}),
    };

    setActiveRide(optimisticRide);

    if (nextStatus === 'captain_arrived') {
      setCaptainGps((prev) => ({
        ...prev,
        lat: activeRide.pickup_lat,
        lng: activeRide.pickup_lng,
        timestamp: Date.now(),
      }));
      motorideApi.updateCaptainLiveLocation({
        captain_id: captainId,
        ride_id: activeRide.id,
        latitude: activeRide.pickup_lat,
        longitude: activeRide.pickup_lng,
        heading: calculateBearingDegrees(activeRide.pickup_lat, activeRide.pickup_lng, activeRide.dropoff_lat, activeRide.dropoff_lng),
        speed: 0,
      }).catch(() => {});
    } else if (nextStatus === 'trip_started') {
      playTripStartedTune();
      const bearing = calculateBearingDegrees(activeRide.pickup_lat, activeRide.pickup_lng, activeRide.dropoff_lat, activeRide.dropoff_lng);
      setCaptainGps((prev) => ({
        ...prev,
        lat: activeRide.pickup_lat,
        lng: activeRide.pickup_lng,
        heading: bearing,
        speed: 28,
        timestamp: Date.now(),
      }));
      motorideApi.updateCaptainLiveLocation({
        captain_id: captainId,
        ride_id: activeRide.id,
        latitude: activeRide.pickup_lat,
        longitude: activeRide.pickup_lng,
        heading: bearing,
        speed: 28,
      }).catch(() => {});
    }

    if (nextStatus === 'trip_completed') {
      setCompletedRideForRating(optimisticRide);
      setShowPassengerRatingModal(true);
    }

    try {
      const updated = await motorideApi.updateRideStatus(activeRide.id, nextStatus, {
        final_distance_km: activeRide.distance_km,
        final_fare: activeRide.final_fare || activeRide.offered_fare,
        ride: optimisticRide,
      });

      if (updated) {
        setActiveRide(updated);
        if (nextStatus === 'trip_completed') {
          setCompletedRideForRating(updated);
        }
      }
    } catch (err: any) {
      console.warn('Status update warning:', err);
      // Retain optimistic status so user is not blocked by transient network hiccups
    }
  };

  const handleFinishRideWithRating = async (
    score: number,
    review: string,
    tags: string[],
    skipRating: boolean = false
  ) => {
    const rideToFinish = completedRideForRating || activeRide;
    if (!rideToFinish) {
      setShowPassengerRatingModal(false);
      return;
    }

    setIsFinishingRide(true);
    try {
      markCaptainRideAsRated(captainId, rideToFinish.id);
      const finalFare = rideToFinish.final_fare || rideToFinish.estimated_fare;
      const finalDist = rideToFinish.distance_km;

      // 1. Mark ride as fully finalized and completed in Supabase / Local storage
      await motorideApi.updateRideStatus(rideToFinish.id, 'completed', {
        final_fare: finalFare,
        final_distance_km: finalDist,
      });

      // 2. Submit Captain's rating for passenger
      if (!skipRating && rideToFinish.passenger_id) {
        try {
          await motorideApi.submitRideRating({
            ride_id: rideToFinish.id,
            rater_role: 'captain',
            captain_id: captainId,
            passenger_id: rideToFinish.passenger_id,
            score: score || 5,
            review: review,
            tags: tags,
          });
        } catch (ratingErr) {
          console.warn('Rating save error ignored:', ratingErr);
        }
      }

      // 3. Instantly clear active ride and close rating modal
      setActiveRide(null);
      setCompletedRideForRating(null);
      setShowPassengerRatingModal(false);
      await loadCaptainData();
    } catch (err: any) {
      console.warn('Finish ride notice:', err);
      setActiveRide(null);
      setCompletedRideForRating(null);
      setShowPassengerRatingModal(false);
      loadCaptainData();
    } finally {
      setIsFinishingRide(false);
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

  const currentRideOnMap = activeRide || inspectedRide || (availableRides.length > 0 ? availableRides[0] : null);

  // Marker visibility logic:
  // 1. Before ride request accept (inspecting / incoming ride request): show BOTH Marker A and Marker B details on map
  // 2. After captain accepts ride (captain_accepted): show pickup Marker A ONLY on map
  // 3. When captain arrives at pickup (captain_arrived) & starts trip (trip_started): immediately show drop location Marker B ONLY on map
  const isAcceptedPhase = activeRide && activeRide.status === 'captain_accepted';
  const isArrivedOrTripPhase = activeRide && (activeRide.status === 'captain_arrived' || activeRide.status === 'trip_started');

  const showPickupOnMap = isAcceptedPhase || (!activeRide && Boolean(currentRideOnMap));
  const showDropoffOnMap = isArrivedOrTripPhase || (!activeRide && Boolean(currentRideOnMap));

  const currentPickupLat = showPickupOnMap && currentRideOnMap ? currentRideOnMap.pickup_lat : null;
  const currentPickupLng = showPickupOnMap && currentRideOnMap ? currentRideOnMap.pickup_lng : null;
  const currentPickupAddress = showPickupOnMap && currentRideOnMap ? currentRideOnMap.pickup_address : undefined;

  const currentDropoffLat = showDropoffOnMap && currentRideOnMap ? currentRideOnMap.dropoff_lat : null;
  const currentDropoffLng = showDropoffOnMap && currentRideOnMap ? currentRideOnMap.dropoff_lng : null;
  const currentDropoffAddress = showDropoffOnMap && currentRideOnMap ? currentRideOnMap.dropoff_address : undefined;

  const currentPickupDistKm = currentPickupLat && currentPickupLng && captainGps.lat && captainGps.lng
    ? calculateDistance(captainGps.lat, captainGps.lng, currentPickupLat, currentPickupLng)
    : null;
  const currentPickupDistText = currentPickupDistKm !== null
    ? (currentPickupDistKm < 1 ? `${Math.round(currentPickupDistKm * 1000)}m` : `${currentPickupDistKm.toFixed(1)} km`)
    : undefined;

  const currentDropoffDistKm = currentRideOnMap
    ? (currentRideOnMap.distance_km || calculateDistance(currentRideOnMap.pickup_lat, currentRideOnMap.pickup_lng, currentRideOnMap.dropoff_lat, currentRideOnMap.dropoff_lng))
    : null;
  const currentDropoffDistText = currentDropoffDistKm !== null
    ? (currentDropoffDistKm < 1 ? `${Math.round(currentDropoffDistKm * 1000)}m` : `${Number(currentDropoffDistKm).toFixed(1)} km`)
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
      activeRideStatus={activeRide?.status}
      passengerLat={undefined}
      passengerLng={undefined}
      passengerAccuracy={undefined}
      passengerHeading={null}
      passengerName={activeRide?.passenger_name || inspectedRide?.passenger_name || availableRides[0]?.passenger_name || 'Passenger'}
      pickupLat={currentPickupLat}
      pickupLng={currentPickupLng}
      pickupAddress={currentPickupAddress}
      pickupDistanceText={currentPickupDistText}
      dropoffLat={currentDropoffLat}
      dropoffLng={currentDropoffLng}
      dropoffAddress={currentDropoffAddress}
      dropoffDistanceText={currentDropoffDistText}
      rideDistanceText={currentDropoffDistText}
      bottomSheetPadding={currentRideOnMap && !activeRide ? 360 : 60}
      showLocationsABOnly={false}
      className={`w-full h-full ${isFullBackground ? 'rounded-none border-0' : 'shadow-2xl border border-slate-800'}`}
      showOverlayControls={true}
      onLocateMe={startWatchingLocation}
      focusCoords={mapFocusTarget}
    />
  );

  const renderCaptainControls = () => (
    <div className="flex flex-col gap-3 pb-4">
      {activeRide ? (
        /* Active Trip Execution Card */
        <div className="bg-white border border-slate-200 rounded-3xl p-5 flex flex-col gap-4 shadow-xl">

          <div className="flex items-center justify-between pb-3 border-b border-slate-200">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-mono-num text-amber-600 font-bold">
                  {activeRide.ride_code}
                </span>
                {(() => {
                  const svc = getServiceBadge(activeRide.ride_type);
                  return (
                    <span className={`px-2 py-0.5 rounded-md border text-[10px] font-black flex items-center gap-1 ${svc.badgeBg}`}>
                      <span>{svc.icon}</span>
                      <span>{svc.label}</span>
                    </span>
                  );
                })()}
              </div>
              <div className="flex items-center gap-1.5 mt-0.5">
                <h3 className="text-base font-black text-slate-950 capitalize">
                  {activeRide.status.replace(/_/g, ' ')}
                </h3>
              </div>
            </div>

            {/* Smart Navigator Button */}
            {(() => {
              const isArrivedOrLater = activeRide.status === 'captain_arrived' || activeRide.status === 'trip_started';
              const navLat = isArrivedOrLater ? activeRide.dropoff_lat : activeRide.pickup_lat;
              const navLng = isArrivedOrLater ? activeRide.dropoff_lng : activeRide.pickup_lng;
              const navAddress = isArrivedOrLater ? activeRide.dropoff_address : activeRide.pickup_address;
              const navTitle = 'Navigate';

              const hasCoords = navLat != null && navLng != null && !isNaN(Number(navLat)) && !isNaN(Number(navLng)) && Number(navLat) !== 0;
              const destParam = hasCoords ? `${navLat},${navLng}` : encodeURIComponent(navAddress || (isArrivedOrLater ? 'Drop-off' : 'Pickup'));
              const originParam = (captainGps.lat && captainGps.lng) ? `&origin=${captainGps.lat},${captainGps.lng}` : '';
              const gMapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${destParam}${originParam}&travelmode=driving&dir_action=navigate`;

              const handleNavigateClick = (e: React.MouseEvent) => {
                e.preventDefault();
                e.stopPropagation();

                if (hasCoords) {
                  setMapFocusTarget({
                    lat: Number(navLat),
                    lng: Number(navLng),
                    zoom: 17,
                    timestamp: Date.now(),
                  });
                }

                const isAndroid = typeof navigator !== 'undefined' && /android/i.test(navigator.userAgent);
                const isIOS = typeof navigator !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
                const isAndroidApk = typeof window !== 'undefined' && (window.location.protocol === 'file:' || !window.location.hostname);

                if (isAndroid) {
                  // Direct Intent Link: forces immediate opening of com.google.android.apps.maps
                  // bypasses Chrome/browser and app chooser completely. Start navigation immediately!
                  const intentUrl = `intent://www.google.com/maps/dir/?api=1&destination=${destParam}${originParam}&travelmode=driving&dir_action=navigate#Intent;scheme=https;package=com.google.android.apps.maps;end`;
                  try {
                    window.location.href = intentUrl;
                  } catch {
                    window.location.href = gMapsUrl;
                  }
                } else if (isIOS) {
                  // iOS Direct Scheme for native Google Maps turn-by-turn directions
                  const iosUrl = `comgooglemaps://?daddr=${destParam}&directionsmode=driving&views=traffic`;
                  const iframe = document.createElement('iframe');
                  iframe.style.display = 'none';
                  iframe.src = iosUrl;
                  document.body.appendChild(iframe);
                  
                  setTimeout(() => {
                    document.body.removeChild(iframe);
                    // Fallback to web link if maps scheme didn't launch
                    if (isAndroidApk) {
                      window.location.href = gMapsUrl;
                    } else {
                      window.open(gMapsUrl, '_blank', 'noopener,noreferrer');
                    }
                  }, 1500);
                } else {
                  // Desktop Web / General Fallback
                  if (isAndroidApk) {
                    window.location.href = gMapsUrl;
                  } else {
                    try {
                      const win = window.open(gMapsUrl, '_blank', 'noopener,noreferrer');
                      if (!win || win.closed || typeof win.closed === 'undefined') {
                        const tempLink = document.createElement('a');
                        tempLink.href = gMapsUrl;
                        tempLink.target = '_blank';
                        tempLink.rel = 'noopener noreferrer';
                        document.body.appendChild(tempLink);
                        tempLink.click();
                        document.body.removeChild(tempLink);
                      }
                    } catch {
                      window.location.href = gMapsUrl;
                    }
                  }
                }
              };

              return (
                <button
                  type="button"
                  onClick={handleNavigateClick}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-black hover:bg-slate-900 text-white text-xs font-black transition-all shadow-md active:scale-95 cursor-pointer select-none border border-slate-800 shrink-0"
                  title={isArrivedOrLater ? 'Navigate to Drop-off destination' : 'Navigate to Pickup point'}
                >
                  <Navigation2 className="w-3.5 h-3.5 fill-white stroke-white text-white shrink-0" />
                  <span className="text-white">{navTitle}</span>
                </button>
              );
            })()}
          </div>

          {/* Passenger Profile: Photo, Full Name, Rating, Rides Only */}
          {(() => {
            const passengerDisplayName = activeRide.passenger_name || 'Ritu Sharma';
            const passengerRating = activeRide.passenger_rating || 4.9;
            const passengerTotalRides = activeRide.passenger_total_rides ?? 0;

            let passengerAvatar = activeRide.passenger_avatar;
            if (!passengerAvatar) {
              try {
                const local = safeStorage.getItem('motoride_passenger_avatar');
                if (local) passengerAvatar = local;
              } catch {}
            }
            if (!passengerAvatar) {
              passengerAvatar = defaultRituAvatar;
            }

            return (
              <div className="p-3 sm:p-3.5 rounded-2xl bg-slate-50 border border-slate-200 shadow-2xs">
                <div className="flex items-center gap-3">
                  {/* Passenger Photo */}
                  <img
                    src={passengerAvatar}
                    alt={passengerDisplayName}
                    className="w-12 h-12 sm:w-13 sm:h-13 rounded-full object-cover border border-slate-200 shadow-xs shrink-0"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).src = defaultRituAvatar;
                    }}
                  />

                  {/* Passenger Details: Full Name, Rating, Rides */}
                  <div className="min-w-0 flex-1">
                    {/* Full Name */}
                    <h4 className="text-sm sm:text-base font-black text-slate-900 truncate">
                      {passengerDisplayName}
                    </h4>

                    {/* Rating & Rides */}
                    <div className="flex items-center gap-2 mt-1 text-xs">
                      {/* Rating */}
                      <span className="inline-flex items-center gap-1 font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200 text-xs">
                        <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-500" />
                        <span>{passengerRating.toFixed(1)}</span>
                      </span>

                      <span className="text-slate-300">•</span>

                      {/* Rides */}
                      <span className="font-semibold text-slate-600 text-xs">
                        {passengerTotalRides} rides
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Passenger Ride Details Box: A + Call Icon, B + Message Icon, Agreed Fare */}
          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col gap-3">
            {/* A: Pickup Address + Call Icon */}
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-start gap-2.5 min-w-0 flex-1">
                <span className="w-6 h-6 rounded-full bg-emerald-600 text-white font-black text-xs flex items-center justify-center shrink-0 shadow-xs mt-0.5">
                  A
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs sm:text-sm text-slate-900 font-bold leading-snug break-words">
                    {activeRide.pickup_address || 'My Live GPS Location'}
                  </p>
                </div>
              </div>

              {/* Call Icon on right of A */}
              <a
                href={`tel:${activeRide.passenger_phone || '+919780012345'}`}
                className="w-10 h-10 rounded-xl bg-emerald-600 text-white hover:bg-emerald-500 shadow-sm shadow-emerald-600/25 transition-all active:scale-95 cursor-pointer flex items-center justify-center shrink-0 border border-emerald-500"
                title="Call Passenger"
                aria-label="Call Passenger"
              >
                <Phone className="w-4 h-4 stroke-[2.5] text-white" />
              </a>
            </div>

            {/* B: Dropoff Address + Message Icon */}
            <div className="flex items-center justify-between gap-3 pt-2.5 border-t border-slate-200">
              <div className="flex items-start gap-2.5 min-w-0 flex-1">
                <span className="w-6 h-6 rounded-full bg-rose-500 text-white font-black text-xs flex items-center justify-center shrink-0 shadow-xs mt-0.5">
                  B
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs sm:text-sm text-slate-800 font-medium leading-snug break-words">
                    {activeRide.dropoff_address || 'Phase 5 Market, Mohali'}
                  </p>
                </div>
              </div>

              {/* Message Icon on right of B */}
              <button
                type="button"
                onClick={() => {
                  setShowChatModal(true);
                  setHasUnreadMessages(false);
                  if (activeRide?.id) {
                    safeStorage.setItem(`motoride_last_read_chat_${activeRide.id}`, Date.now().toString());
                  }
                }}
                className="w-10 h-10 rounded-xl bg-emerald-600 text-white hover:bg-emerald-500 shadow-sm shadow-emerald-600/25 transition-all active:scale-95 cursor-pointer flex items-center justify-center shrink-0 border border-emerald-500 relative"
                title="Chat with Passenger"
                aria-label="Chat with Passenger"
              >
                <MessageSquare className="w-4 h-4 stroke-[2.5] text-white" />
                {hasUnreadMessages && (
                  <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5 z-10" title="New message received">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-500 opacity-80"></span>
                    <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-rose-600 border-2 border-white shadow-md"></span>
                  </span>
                )}
              </button>
            </div>

            {/* Agreed Fare */}
            <div className="flex items-center justify-between pt-2.5 border-t border-slate-200">
              <div className="flex items-center gap-1.5">
                <span className="text-xs sm:text-sm font-bold text-slate-700">
                  Agreed Fare:
                </span>
                <span className="text-base sm:text-lg font-black text-slate-950 font-mono-num">
                  ₹{activeRide.final_fare || activeRide.offered_fare}
                </span>
              </div>
              <span className="text-xs sm:text-sm font-black uppercase tracking-wider text-black px-2.5 py-0.5 rounded-md bg-slate-100 border border-slate-300 shadow-2xs">
                {activeRide.payment_method?.toUpperCase() === 'CASH' ? 'CASH' : 'UPI'}
              </span>
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
                className="w-full py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs sm:text-sm shadow-xl shadow-emerald-600/25 transition-all active:scale-98 cursor-pointer flex items-center justify-center gap-2 border border-emerald-500"
              >
                <MapPin className="w-4 h-4 stroke-[2.5] text-white" />
                <span className="text-white">I Have Arrived at Pickup</span>
              </button>
            )}

            {activeRide.status === 'captain_arrived' && (
              <button
                type="button"
                onClick={() => handleStatusChange('trip_started')}
                style={{ backgroundColor: '#DAA520', borderColor: '#DAA520' }}
                className="w-full py-3.5 rounded-2xl hover:opacity-90 text-slate-950 font-black text-xs shadow-xl transition-all active:scale-98 cursor-pointer flex items-center justify-center gap-2 border shadow-amber-500/20"
              >
                <Navigation2 className="w-4 h-4 stroke-[2.5] text-slate-950 fill-slate-950" />
                <span className="text-slate-950">Passenger Boarded • Start Trip</span>
              </button>
            )}

            {activeRide.status === 'trip_started' && (
              <button
                type="button"
                onClick={() => handleStatusChange('trip_completed')}
                style={{ backgroundColor: '#ba1e23', borderColor: '#ba1e23' }}
                className="w-full py-3.5 rounded-2xl hover:opacity-90 text-white font-black text-xs shadow-xl transition-all active:scale-98 cursor-pointer flex items-center justify-center gap-2 border shadow-rose-900/25"
              >
                <CheckCircle2 className="w-4 h-4 stroke-[2.5] text-white" />
                <span className="text-white">Arrived at Destination • Complete Trip</span>
              </button>
            )}

            {activeRide.status === 'trip_completed' && (
              <div className="flex flex-col gap-3 p-4 rounded-2xl bg-white border border-slate-200 shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center">
                      <CheckCircle2 className="w-4 h-4 stroke-[2.5]" />
                    </div>
                    <div>
                      <h4 className="text-xs font-black text-slate-900">Trip Completed! 🎉</h4>
                      <p className="text-[11px] text-slate-500 font-medium">Collect payment & rate passenger</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">
                      Agreed Fare
                    </span>
                    <span className="text-base font-black text-emerald-600 font-mono-num">
                      ₹{activeRide.final_fare || activeRide.offered_fare}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setCompletedRideForRating(activeRide);
                    setShowPassengerRatingModal(true);
                  }}
                  style={{ backgroundColor: '#ba1e23', borderColor: '#ba1e23' }}
                  className="w-full py-3.5 rounded-2xl hover:opacity-90 text-white font-black text-xs shadow-xl transition-all active:scale-98 cursor-pointer flex items-center justify-center gap-2 border shadow-rose-900/25"
                >
                  <Star className="w-4 h-4 fill-white text-white" />
                  <span>Rate Passenger & Finish Ride</span>
                </button>
              </div>
            )}

            {activeRide.status !== 'trip_completed' && (
              <button
                type="button"
                onClick={handleCancelTrip}
                className="w-full py-2 rounded-xl text-rose-600 hover:bg-rose-50 text-xs font-semibold cursor-pointer transition-colors"
              >
                Cancel Ride
              </button>
            )}
          </div>
        </div>
      ) : (
        /* Incoming Live Ride Requests */
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-200">
            <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
              <Bike className="w-4 h-4 text-amber-500 animate-bounce" />
              <span>Live Ride Requests</span>
            </h3>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-900 font-mono-num border border-amber-300">
                {availableRides.length} Available
              </span>
            </div>
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
              <div className="flex flex-col items-center gap-1 text-center px-4 w-full">
                {fareSettings?.require_admin_approval_for_rides && captain && !captain.is_approved ? (
                  <div className="p-4 bg-amber-50 border border-amber-300 rounded-2xl text-center text-xs text-amber-900 font-medium mb-3 w-full shadow-sm">
                    <strong>Pending Admin Approval:</strong> Your new captain account requires admin approval before passenger ride requests can be displayed in your dashboard.
                  </div>
                ) : (
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
                )}
                <span className="text-[11px] text-slate-500 max-w-sm">
                  {fareSettings?.require_admin_approval_for_rides && captain && !captain.is_approved
                    ? 'Please contact admin or wait for account approval.'
                    : isOnline
                    ? 'Passenger ride requests appear here instantly in real time with audio alert'
                    : 'Use the Online capsule button near Captain App at the top right to go Online and receive rides'}
                </span>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-3 overflow-y-auto pr-1">
              {availableRides.map((ride) => {
                const distKm = calculateDistance(captainGps.lat, captainGps.lng, ride.pickup_lat, ride.pickup_lng);
                const pickupDistText = distKm < 1 ? `${Math.round(distKm * 1000)}m` : `${distKm.toFixed(1)} km`;
                const rideDistKm = ride.distance_km || calculateDistance(ride.pickup_lat, ride.pickup_lng, ride.dropoff_lat, ride.dropoff_lng) || 3.5;
                const rideDistText = rideDistKm < 1 ? `${Math.round(rideDistKm * 1000)}m` : `${Number(rideDistKm).toFixed(1)} km`;
                const isSelected = inspectedRide?.id === ride.id;
                const service = getServiceBadge(ride.ride_type);

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
                    <div className="flex items-start justify-between gap-3">
                      {/* Left: Passenger Profile + Pickup Distance + Route Details */}
                      <div className="flex-1 min-w-0 flex flex-col gap-2.5">
                        {/* Passenger Profile + Service Badge + Pickup Distance */}
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="relative shrink-0">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-amber-400 via-amber-500 to-amber-600 text-slate-950 font-black text-sm flex items-center justify-center shadow-xs">
                              {ride.passenger_name?.charAt(0)?.toUpperCase() || 'P'}
                            </div>
                            <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 rounded-full border-2 border-white" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-xs sm:text-sm font-bold text-slate-900 truncate">
                                {ride.passenger_name}
                              </span>
                              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 text-[10px] font-bold shrink-0 border border-amber-200">
                                <Star className="w-2.5 h-2.5 fill-amber-500 text-amber-500" />
                                4.9
                              </span>
                              <span className={`px-2 py-0.5 rounded-md border text-[10px] font-black flex items-center gap-1 shadow-2xs shrink-0 ${service.bg}`}>
                                <span className="text-xs leading-none">{service.icon}</span>
                                <span>{service.label}</span>
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

                        {/* Route Details: A pickup (Bold text) & B dropoff */}
                        <div className="pt-2 border-t border-slate-100 flex flex-col gap-2">
                          {/* A pickup (Bold text) */}
                          <div className="flex items-start gap-2">
                            <span className="w-5 h-5 rounded-full bg-emerald-600 text-white text-[11px] font-black flex items-center justify-center shrink-0 mt-0.5 shadow-xs">
                              A
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="text-xs sm:text-sm font-bold text-slate-900 leading-snug">
                                {ride.pickup_address}
                              </p>
                            </div>
                          </div>

                          {/* B dropoff */}
                          <div className="flex items-start gap-2">
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
                      </div>

                      {/* Right: Cash ₹234 (BOLD TEXT) -> Offered Fare -> Ride Distance 23.4 km */}
                      <div className="flex flex-col items-end justify-between shrink-0 pl-3 border-l border-slate-100 min-w-[110px] text-right self-stretch">
                        {/* 1. Cash ₹234 (BOLD TEXT) */}
                        <div className="flex items-center gap-1.5 justify-end">
                          <span className="px-2 py-0.5 rounded-md bg-purple-100 text-purple-900 border border-purple-300 text-xs font-black uppercase tracking-wider shadow-2xs">
                            {ride.payment_method?.toUpperCase() === 'CASH' ? 'Cash' : 'UPI'}
                          </span>
                          <span className="text-xl sm:text-2xl font-black text-slate-950 font-mono-num leading-none">
                            ₹{ride.offered_fare}
                          </span>
                        </div>

                        {/* 2. Offered Fare */}
                        <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wide mt-0.5">
                          Offered Fare
                        </span>

                        {/* 3. Drop-off Distance in RED (e.g. 23.4 km) */}
                        <div className="mt-2 pt-1 border-t border-slate-100 w-full flex items-center justify-end gap-1">
                          <span className="text-xs sm:text-sm font-black text-rose-600 font-mono-num bg-rose-50 px-2 py-0.5 rounded-md border border-rose-200 shadow-2xs">
                            {rideDistText}
                          </span>
                        </div>
                      </div>
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
    const pickupDistText = distKm < 1 ? `${Math.round(distKm * 1000)}m` : `${distKm.toFixed(1)} km`;
    const rideDistKm = ride.distance_km || calculateDistance(ride.pickup_lat, ride.pickup_lng, ride.dropoff_lat, ride.dropoff_lng) || 3.5;
    const rideDistText = rideDistKm < 1 ? `${Math.round(rideDistKm * 1000)}m` : `${Number(rideDistKm).toFixed(1)} km`;
    const counterFare = counterFareInput[ride.id] || ride.offered_fare + 20;
    const service = getServiceBadge(ride.ride_type);

    return (
      <div className="flex flex-col gap-3.5">
        {/* Top: (passenger profile) + Service Badge + 1km (pickup distance) */}
        <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
            <div className="relative shrink-0">
              <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-gradient-to-tr from-amber-400 via-amber-500 to-amber-600 text-slate-950 font-black text-sm sm:text-base flex items-center justify-center shadow-md ring-2 ring-slate-100">
                {ride.passenger_name?.charAt(0)?.toUpperCase() || 'P'}
              </div>
              <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-emerald-500 rounded-full border-2 border-white" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                <span className="text-sm sm:text-base font-black text-slate-900 truncate">
                  {ride.passenger_name}
                </span>
                <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 text-[10px] sm:text-[11px] font-bold border border-amber-200 shrink-0">
                  <Star className="w-2.5 h-2.5 sm:w-3 sm:h-3 fill-amber-500 text-amber-500" />
                  4.9
                </span>
                <span className={`px-2 py-0.5 rounded-md border text-[11px] font-black flex items-center gap-1 shadow-2xs shrink-0 ${service.badgeBg}`}>
                  <span className="text-xs leading-none">{service.icon}</span>
                  <span>{service.label}</span>
                </span>
              </div>
              <div className="flex items-center gap-1.5 mt-1">
                <span className="text-[11px] sm:text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-md border border-emerald-200 flex items-center gap-1">
                  <Navigation className="w-3 h-3 text-emerald-600 shrink-0" />
                  <span>{pickupDistText}</span>
                </span>
              </div>
            </div>
          </div>

          {/* Right Stack: Cash ₹234 (BOLD TEXT) -> Offered Fare -> Ride Distance 23.4 km */}
          <div className="flex flex-col items-end justify-between shrink-0 pl-3 border-l border-slate-100 min-w-[120px] text-right">
            {/* 1. Cash ₹234 (BOLD TEXT) */}
            <div className="flex items-center gap-1.5 justify-end">
              <span className="px-2.5 py-1 rounded-lg bg-purple-100 text-purple-900 border border-purple-300 text-xs font-black uppercase tracking-wider shadow-2xs">
                {ride.payment_method?.toUpperCase() === 'CASH' ? 'Cash' : 'UPI'}
              </span>
              <span className="text-2xl sm:text-3xl font-black text-slate-950 font-mono-num leading-none">
                ₹{ride.offered_fare}
              </span>
            </div>

            {/* 2. Offered Fare */}
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wide mt-1">
              Offered Fare
            </span>

            {/* 3. Drop-off Distance in RED (e.g. 23.4 km) */}
            <div className="mt-2 pt-1 border-t border-slate-100 w-full flex items-center justify-end gap-1">
              <span className="text-xs sm:text-sm font-black text-rose-600 font-mono-num bg-rose-50 px-2.5 py-0.5 rounded-md border border-rose-200 shadow-2xs">
                {rideDistText}
              </span>
            </div>
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

          {/* Duration info */}
          <div className="mt-0.5 pt-2 border-t border-slate-200 flex items-center justify-end text-xs">
            <span className="text-slate-500 font-medium">
              Estimated Duration: ~{ride.duration_minutes || 14} mins
            </span>
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
      {activeRide ? (
        /* Active Ride Split View: Top Map (30%), Bottom Ride Details (70%) with 70% / 100% Toggle Switch */
        <div className="absolute inset-0 w-full h-full flex flex-col z-0">
          {/* Top Map: 30% height in 70% mode, hidden/0% in 100% details mode */}
          <div
            className={`w-full transition-all duration-300 ease-in-out relative z-0 shrink-0 ${
              is100Full ? 'h-0 overflow-hidden opacity-0 pointer-events-none' : 'h-[30dvh] sm:h-[30%] opacity-100'
            }`}
          >
            {renderCaptainMap(true)}
          </div>

          {/* Bottom Active Ride Details: 70% in split mode, 100% in full mode */}
          <div
            className={`w-full flex-1 bg-white shadow-[0_-12px_45px_rgba(0,0,0,0.18)] flex flex-col overflow-hidden relative z-10 transition-all duration-300 ease-in-out ${
              is100Full ? 'h-full' : 'h-[70dvh] sm:h-[70%]'
            }`}
          >
            {/* Top Center Handle Bar (Line - style to drop up and down like passenger booking form) */}
            <div
              onClick={() => setIs100Full((prev) => !prev)}
              className="w-full pt-2.5 pb-1 bg-white flex items-center justify-center cursor-pointer group select-none hover:bg-slate-50 transition-colors"
              title={is100Full ? "Drop down to 70% split map view" : "Drop up to 100% full view"}
              role="button"
              tabIndex={0}
              aria-label="Toggle active trip screen height"
            >
              <div className="w-12 h-1.5 rounded-full bg-slate-300 group-hover:bg-slate-500 transition-colors" />
            </div>

            {/* Header with Title and Drop Up/Down Toggle Button */}
            <div className="px-3.5 sm:px-5 py-2 bg-white border-b border-slate-100 flex items-center justify-between select-none shrink-0 shadow-xs">
              <div className="flex items-center gap-2 min-w-0 pr-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                <span className="text-xs sm:text-sm font-black text-slate-900 truncate">
                  Active Trip • #{activeRide.ride_code} ({activeRide.status.replace(/_/g, ' ')})
                </span>
              </div>

              {/* Right Toggle Button: Same icon-style button as passenger header (ChevronDown / ChevronUp) */}
              <button
                type="button"
                onClick={() => setIs100Full((prev) => !prev)}
                className="p-1.5 sm:p-2 rounded-xl bg-white hover:bg-slate-200 text-slate-900 border border-slate-300 text-xs font-black transition-all active:scale-95 cursor-pointer shadow-xs flex items-center justify-center"
                title={is100Full ? "Drop down to 70% split map view" : "Drop up to 100% full view"}
                aria-label="Toggle drop up and down"
              >
                {is100Full ? (
                  <ChevronDown className="w-4 h-4 text-slate-900 stroke-[2.5]" />
                ) : (
                  <ChevronUp className="w-4 h-4 text-slate-900 stroke-[2.5]" />
                )}
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 sm:p-5 scrollbar-thin bg-white">
              {renderCaptainControls()}
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* Background Street View Map filling 100% of the canvas */}
          <div className="absolute inset-0 w-full h-full z-0">
            {renderCaptainMap(true)}
          </div>

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
              {/* Top Center Pull Handle Bar */}
              <div
                onClick={() => setIs100Full((prev) => !prev)}
                className="w-full pt-2 pb-0.5 bg-white flex items-center justify-center cursor-pointer group select-none hover:bg-slate-50 transition-colors shrink-0"
                title={is100Full ? "Drop down to view map" : "Drop up full requests view"}
                role="button"
                tabIndex={0}
                aria-label="Toggle live requests screen height"
              >
                <div className="w-12 h-1.5 rounded-full bg-slate-300 group-hover:bg-slate-600 transition-colors" />
              </div>

              {/* Header Bar */}
              {inspectedRide && !activeRide && !is100Full ? (
                <div className="px-4 sm:px-5 py-2 sm:py-2.5 bg-white border-b border-slate-200 flex items-center justify-between select-none shadow-xs">
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
                    // If minimized and user clicks on empty bar area, maximize to full
                    if (!is100Full && (e.target as HTMLElement).tagName !== 'BUTTON' && !(e.target as HTMLElement).closest('button')) {
                      setIs100Full(true);
                    }
                  }}
                  className={`px-3.5 sm:px-5 py-2 bg-white flex items-center justify-between relative select-none shadow-sm ${
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

                  {/* Center/Right: Toggle - Type Drop Up Full and Down Button (Passenger Booking Form Style) */}
                  <div className="flex items-center justify-end min-w-0">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setIs100Full((prev) => !prev);
                      }}
                      className="p-2 sm:px-3 sm:py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-black border border-black text-xs font-black transition-all active:scale-95 cursor-pointer group shadow-xs flex items-center gap-1.5"
                      title={is100Full ? "Drop down to view full map" : "Drop up full requests view"}
                      aria-label={is100Full ? "Drop down" : "Drop up full"}
                    >
                      {is100Full ? (
                        <ChevronDown className="w-4 h-4 text-black group-hover:translate-y-0.5 transition-transform stroke-[2.5]" />
                      ) : (
                        <ChevronUp className="w-4 h-4 text-black group-hover:-translate-y-0.5 transition-transform stroke-[2.5]" />
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
        </>
      )}

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
        todayIncome={todayIncome}
        onUpdateCaptain={handleUpdateCaptainProfile}
        onOpenWallet={onOpenWallet}
        onOpenRideHistory={() => setIsRideHistoryOpen(true)}
        onSignOut={onSignOut}
      />

      {/* Trip History Modal for Captain */}
      <MotorideRideHistoryModal
        isOpen={isRideHistoryOpen}
        onClose={() => setIsRideHistoryOpen(false)}
        role="captain"
        userId={captainId || captain?.id || captain?.profile_id || ''}
        userName={captain?.full_name || captainName || 'Captain'}
        todayIncome={todayIncome}
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

      {showChatModal && activeRide && (
        <div className="fixed inset-0 z-[2000] bg-slate-900/80 backdrop-blur-md flex flex-col p-3 sm:p-6 md:p-8 animate-in fade-in duration-150">
          <div className="w-full max-w-4xl mx-auto mb-3 sm:mb-4 flex items-center justify-between">
            <button
              onClick={() => {
                setShowChatModal(false);
                setHasUnreadMessages(false);
                if (activeRide?.id) {
                  safeStorage.setItem(`motoride_last_read_chat_${activeRide.id}`, Date.now().toString());
                }
              }}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-white hover:bg-slate-100 text-slate-900 font-extrabold text-xs sm:text-sm border border-slate-200 transition-all cursor-pointer shadow-lg active:scale-95"
            >
              <ArrowLeft className="w-4 h-4 stroke-[2.5] text-slate-900" />
              <span>Back to Ride Details</span>
            </button>
            <span className="text-xs text-white font-mono font-bold bg-black/50 px-3 py-1.5 rounded-xl border border-white/20 shadow-xs">Ride #{activeRide.ride_code}</span>
          </div>
          <div className="flex-1 w-full max-w-4xl mx-auto flex flex-col overflow-hidden">
            <RideChatModal
              ride={activeRide}
              currentUserId={captainId}
              currentUserRole="captain"
              currentUserName={captain?.full_name || 'Captain'}
              onClose={() => {
                setShowChatModal(false);
                setHasUnreadMessages(false);
                if (activeRide?.id) {
                  safeStorage.setItem(`motoride_last_read_chat_${activeRide.id}`, Date.now().toString());
                }
              }}
            />
          </div>
        </div>
      )}

      {/* Captain Rates Passenger Modal at the End of Trip */}
      {showPassengerRatingModal && completedRideForRating && (
        <CaptainPassengerRatingModal
          ride={completedRideForRating}
          captainName={captain?.full_name || 'Captain'}
          isSubmitting={isFinishingRide}
          onSubmit={(score, review, tags) => handleFinishRideWithRating(score, review, tags, false)}
          onSkip={() => handleFinishRideWithRating(5, '', [], true)}
        />
      )}
    </div>
  );
};
