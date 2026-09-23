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
  ArrowLeft,
  IndianRupee,
  History,
  Volume2,
} from 'lucide-react';
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
  const [showPassengerRatingModal, setShowPassengerRatingModal] = useState<boolean>(false);
  const [completedRideForRating, setCompletedRideForRating] = useState<MotorideRide | null>(null);
  const [isFinishingRide, setIsFinishingRide] = useState<boolean>(false);

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
    startWatchingLocation();
    return () => {
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
      setAvailableRides((prev) => {
        if (prev.some((r) => r.id === newRide.id)) return prev;
        return [newRide, ...prev.filter((r) => !r.id.includes('demo') && r.passenger_id !== 'usr_demo_100')];
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
        if (updatedRide.status === 'trip_completed' || updatedRide.status === 'completed' || updatedRide.status.includes('cancelled')) {
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

    // Immediate re-fetch when switching back to mobile browser tab
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        loadAvailableRides();
        loadActiveRide();
        loadCaptainData();
        loadSettings();
      }
    };
    window.addEventListener('focus', handleVisibility);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      unsubRideCreated();
      unsubRideUpdated();
      unsubEarningsUpdated();
      unsubFareUpdated();
      unsubQrUpdated();
      clearInterval(rolloverInterval);
      clearInterval(pollInterval);
      window.removeEventListener('focus', handleVisibility);
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
        setAvailableRides(realRides);
      } else {
        setAvailableRides([]);
      }
    } catch {
      setAvailableRides([]);
    }
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

      const updated = await motorideApi.acceptRide(ride.id, {
        captain_id: captain?.id || captainId,
        captain_name: resolvedName,
        captain_avatar: captainSavedAvatar,
        captain_phone: resolvedPhone,
        vehicle_model: resolvedModel,
        plate_number: resolvedPlate,
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

      await motorideApi.sendCounterOffer(rideId, {
        captain_id: captain?.id || captainId,
        captain_name: resolvedName,
        captain_avatar: captainSavedAvatar,
        captain_phone: resolvedPhone,
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

  // Advance Trip Status
  const handleStatusChange = async (nextStatus: any) => {
    if (!activeRide) return;
    try {
      const updated = await motorideApi.updateRideStatus(activeRide.id, nextStatus, {
        final_distance_km: activeRide.distance_km,
        final_fare: activeRide.final_fare || activeRide.offered_fare,
      });

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
        });
      } else if (nextStatus === 'trip_started') {
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
        });
      }

      if (nextStatus === 'trip_completed') {
        // Prompt Captain to rate passenger before finishing the ride
        setCompletedRideForRating(activeRide);
        setShowPassengerRatingModal(true);
        return;
      } else {
        setActiveRide(updated);
      }
    } catch (err: any) {
      alert(err.message || 'Failed to update status');
    }
  };

  const handleFinishRideWithRating = async (
    score: number,
    review: string,
    tags: string[],
    skipRating: boolean = false
  ) => {
    const rideToFinish = completedRideForRating || activeRide;
    if (!rideToFinish) return;

    setIsFinishingRide(true);
    try {
      const finalFare = rideToFinish.final_fare || rideToFinish.estimated_fare;
      const finalDist = rideToFinish.distance_km;

      // 1. Mark ride completed in Supabase / Local storage
      await motorideApi.updateRideStatus(rideToFinish.id, 'trip_completed', {
        final_fare: finalFare,
        final_distance_km: finalDist,
      });

      // 2. Submit Captain's rating for passenger
      if (!skipRating && rideToFinish.passenger_id) {
        await motorideApi.submitRideRating({
          ride_id: rideToFinish.id,
          rater_role: 'captain',
          captain_id: captainId,
          passenger_id: rideToFinish.passenger_id,
          score: score || 5,
          review: review,
          tags: tags,
        });
      }

      // 3. Clear active ride and refresh earnings/history
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
      activeRideStatus={activeRide?.status}
      passengerLat={activeRide ? undefined : (passengerLiveGps ? passengerLiveGps.latitude : (inspectedRide ? inspectedRide.pickup_lat : undefined))}
      passengerLng={activeRide ? undefined : (passengerLiveGps ? passengerLiveGps.longitude : (inspectedRide ? inspectedRide.pickup_lng : undefined))}
      passengerAccuracy={activeRide ? undefined : (passengerLiveGps?.accuracy ?? (inspectedRide ? 15 : undefined))}
      passengerHeading={activeRide ? null : (passengerLiveGps?.heading ?? null)}
      passengerName={activeRide?.passenger_name || inspectedRide?.passenger_name || 'Passenger'}
      pickupLat={activeRide ? null : (inspectedRide ? inspectedRide.pickup_lat : null)}
      pickupLng={activeRide ? null : (inspectedRide ? inspectedRide.pickup_lng : null)}
      pickupAddress={activeRide ? undefined : (inspectedRide ? inspectedRide.pickup_address : undefined)}
      pickupDistanceText={activeRide ? undefined : inspectedPickupDistText}
      dropoffLat={currentRideOnMap ? currentRideOnMap.dropoff_lat : null}
      dropoffLng={currentRideOnMap ? currentRideOnMap.dropoff_lng : null}
      dropoffAddress={currentRideOnMap ? currentRideOnMap.dropoff_address : undefined}
      dropoffDistanceText={inspectedDropoffDistText}
      rideDistanceText={inspectedDropoffDistText}
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
              <h3 className="text-base font-extrabold text-slate-900 capitalize">
                {activeRide.status.replace(/_/g, ' ')}
              </h3>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowChatModal(true)}
                className="p-2.5 rounded-xl bg-black text-white border border-slate-800 hover:bg-slate-900 shadow-sm transition-all active:scale-95 cursor-pointer"
                title="Chat with Passenger"
              >
                <MessageSquare className="w-4 h-4 stroke-[2.5] text-white" />
              </button>
              <a
                href={`tel:${activeRide.passenger_phone || '+919780012345'}`}
                className="p-2.5 rounded-xl bg-black text-white border border-slate-800 hover:bg-slate-900 shadow-sm transition-all active:scale-95 cursor-pointer flex items-center justify-center"
                title="Call Passenger"
              >
                <Phone className="w-4 h-4 stroke-[2.5] text-white" />
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
            <span className="text-lg font-black text-black font-mono-num">
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
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-black hover:bg-slate-900 text-white text-[11px] font-black transition-all shadow-md active:scale-95 cursor-pointer select-none border border-slate-800"
                        title={isArrivedOrLater ? 'Navigate to Drop-off destination' : 'Navigate to Pickup point'}
                      >
                        <Navigation className="w-3.5 h-3.5 fill-white stroke-white text-white shrink-0" />
                        <span className="text-white">{navTitle}</span>
                      </a>
                    </div>
                  </div>

                  {/* Pickup Address: Only green dot with A */}
                  <div className="flex items-center gap-2 mt-1">
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block shrink-0 shadow-xs" />
                      <span className="w-5 h-5 rounded-full bg-emerald-600 text-white font-black text-[10px] flex items-center justify-center shadow-xs">
                        A
                      </span>
                    </div>
                    <p className="text-xs text-slate-900 font-bold truncate flex-1">
                      {activeRide.pickup_address}
                    </p>
                  </div>
                </div>
              );
            })()}

            {/* Dropoff Location: Only red dot with B */}
            <div className="flex items-center gap-2 pt-2 border-t border-slate-200">
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="w-2 h-2 rounded-full bg-rose-500 inline-block shrink-0 shadow-xs" />
                <span className="w-5 h-5 rounded-full bg-rose-500 text-white font-black text-[10px] flex items-center justify-center shadow-xs">
                  B
                </span>
              </div>
              <p className="text-xs text-slate-800 font-medium truncate flex-1">
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
                style={{ backgroundColor: '#174309', borderColor: '#174309' }}
                className="w-full py-3.5 rounded-2xl hover:opacity-90 text-white font-black text-xs shadow-xl transition-all active:scale-98 cursor-pointer flex items-center justify-center gap-2 border"
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
                <Navigation className="w-4 h-4 stroke-[2.5] text-slate-950 fill-slate-950" />
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
                const pickupDistText = distKm < 1 ? `${Math.round(distKm * 1000)}m` : `${distKm.toFixed(1)}km`;
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
                    {/* Top: Passenger Profile + Service Tag + Pickup Distance & Offered Fare */}
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
                          <div className="flex items-center gap-1.5 flex-wrap">
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

                    {/* Footer: Service Selected by Passenger + Payment (UPI / Cash) */}
                    <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                      {/* Selected Service Badge */}
                      <span className={`px-2.5 py-1 rounded-lg border text-xs font-black flex items-center gap-1.5 shadow-2xs ${service.bg}`}>
                        <span className="text-sm leading-none">{service.icon}</span>
                        <span>{service.label}</span>
                      </span>

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
    const service = getServiceBadge(ride.ride_type);

    return (
      <div className="flex flex-col gap-3.5">
        {/* Top: (passenger profile) + Service Badge + 1km (pickup distance)                  ₹100 */}
        <div className="flex items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="relative shrink-0">
              <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-gradient-to-tr from-amber-400 via-amber-500 to-amber-600 text-slate-950 font-black text-sm sm:text-base flex items-center justify-center shadow-md ring-2 ring-slate-100">
                {ride.passenger_name?.charAt(0)?.toUpperCase() || 'P'}
              </div>
              <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-emerald-500 rounded-full border-2 border-white" />
            </div>
            <div className="min-w-0">
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
          <div className="mt-0.5 pt-2 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs">
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
      {activeRide ? (
        /* Active Ride Split View: Top Half Map (50%), Bottom Half Ride Details (50%) with 50% / 100% Toggle Switch */
        <div className="absolute inset-0 w-full h-full flex flex-col z-0">
          {/* Top Map: 50% height in 50% mode, hidden/0% in 100% details mode */}
          <div
            className={`w-full transition-all duration-300 ease-in-out relative z-0 border-b-2 border-black shrink-0 ${
              is100Full ? 'h-0 overflow-hidden border-b-0 opacity-0 pointer-events-none' : 'h-[50dvh] sm:h-1/2 opacity-100'
            }`}
          >
            {renderCaptainMap(true)}
          </div>

          {/* Bottom Active Ride Details: 50% in split mode, 100% in full mode */}
          <div
            className={`w-full flex-1 bg-white border-t-2 border-black shadow-[0_-12px_45px_rgba(0,0,0,0.25)] flex flex-col overflow-hidden relative z-10 transition-all duration-300 ease-in-out ${
              is100Full ? 'h-full' : 'h-[50dvh] sm:h-1/2'
            }`}
          >
            {/* Header with 50% / 100% Toggle Switch */}
            <div className="px-3.5 sm:px-5 py-2.5 bg-slate-100 border-b border-slate-200 flex items-center justify-between select-none shrink-0 shadow-xs">
              <div className="flex items-center gap-2 min-w-0 pr-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                <span className="text-xs sm:text-sm font-black text-slate-900 truncate">
                  Active Trip • #{activeRide.ride_code} ({activeRide.status.replace(/_/g, ' ')})
                </span>
              </div>

              {/* 50% & 100% Toggle Switch Control */}
              <div className="flex items-center bg-slate-200/90 p-1 rounded-xl border border-slate-300 shrink-0">
                <button
                  type="button"
                  onClick={() => setIs100Full(false)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 ${
                    !is100Full
                      ? 'bg-black text-white shadow-sm'
                      : 'text-slate-700 hover:text-slate-950 hover:bg-slate-300/70'
                  }`}
                  title="50% Half Screen View (Split Map & Details)"
                >
                  <Minimize2 className="w-3.5 h-3.5" />
                  <span>50%</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIs100Full(true)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 ${
                    is100Full
                      ? 'bg-black text-white shadow-sm'
                      : 'text-slate-700 hover:text-slate-950 hover:bg-slate-300/70'
                  }`}
                  title="100% Full Screen (Expand Trip Details)"
                >
                  <Maximize2 className="w-3.5 h-3.5" />
                  <span>100%</span>
                </button>
              </div>
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
                  <div className="flex items-center gap-2 min-w-0 flex-wrap">
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
        <div className="fixed inset-0 z-[2000] bg-slate-950 flex flex-col p-4 sm:p-6 md:p-8 animate-in fade-in duration-150">
          <div className="w-full max-w-4xl mx-auto mb-4 flex items-center justify-between">
            <button
              onClick={() => setShowChatModal(false)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-white/10 hover:bg-white/20 text-white font-bold text-sm border border-white/20 transition-all cursor-pointer shadow-lg active:scale-95"
            >
              <ArrowLeft className="w-4 h-4 stroke-[2.5]" />
              <span>Back to Ride Details</span>
            </button>
            <span className="text-xs text-white/70 font-mono font-semibold">Ride #{activeRide.ride_code}</span>
          </div>
          <div className="flex-1 w-full max-w-4xl mx-auto flex flex-col overflow-hidden">
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
