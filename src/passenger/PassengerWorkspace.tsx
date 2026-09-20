import React, { useState, useEffect, useRef } from 'react';
import {
  MotorideRide,
  RideOffer,
  RideTypeCode,
  FareSettings,
} from '../types/motoride';
import { MotorideMap, AvailableCaptainItem } from '../components/common/MotorideMap';
import { RideChatModal } from '../components/common/RideChatModal';
import { PassengerProfileDrawer } from './PassengerProfileDrawer';
import { DigitalWatchETA } from './DigitalWatchETA';
import { motorideApi } from '../services/motorideApi';
import { realtimeSync } from '../services/realtimeSync';
import { calculateBearingDegrees } from '../utils/distanceCalculator';
import { safeStorage } from '../lib/safeStorage';
import {
  MapPin,
  Navigation,
  Bike,
  Car,
  Package,
  Clock,
  IndianRupee,
  Phone,
  ShieldCheck,
  Star,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  AlertCircle,
  LocateFixed,
  Radio,
  RotateCcw,
  Sparkles,
  Search,
  MessageSquare,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Send,
  Eye,
  EyeOff,
  Minimize2,
  Maximize2,
  LayoutGrid,
  Map as MapIcon,
  X,
  PenLine,
  List,
  Loader2,
  ArrowLeft,
  History,
} from 'lucide-react';

import { AuthUser, supabaseAuth } from '../lib/supabaseAuth';
import { MotorideRideHistoryModal } from '../components/MotorideRideHistoryModal';

interface PassengerWorkspaceProps {
  currentPassengerId?: string;
  passengerName?: string;
  currentUser?: AuthUser | null;
  onOpenWallet?: () => void;
  onSignOut?: () => void;
}

const PRESET_LOCATIONS = [
  { name: 'Sector 70, Mohali Market', lat: 30.704649, lng: 76.717873 },
  { name: 'Phase 8B, Industrial & Tech Park', lat: 30.718214, lng: 76.732124 },
  { name: 'Chandigarh Railway Station', lat: 30.702214, lng: 76.788124 },
  { name: 'ISBT Sector 43 Bus Stand', lat: 30.722514, lng: 76.745124 },
  { name: 'Elante Mall, Phase 1', lat: 30.705514, lng: 76.801124 },
  { name: 'Aroma Chowk, Sector 22', lat: 30.731514, lng: 76.772124 },
  { name: 'Sukhna Lake Promenade', lat: 30.742514, lng: 76.815124 },
  { name: 'IT Park Cyber City', lat: 30.725514, lng: 76.840124 },
];

export const PassengerWorkspace: React.FC<PassengerWorkspaceProps> = ({
  currentPassengerId = '',
  passengerName = 'Passenger',
  currentUser,
  onOpenWallet,
  onSignOut,
}) => {
  const authUser = currentUser || supabaseAuth.getCurrentUser();
  const effectivePassengerName = currentUser?.name || (passengerName !== 'Passenger' ? passengerName : undefined) || authUser?.name || passengerName || 'Passenger';
  // Active Ride State
  const [activeRide, setActiveRide] = useState<MotorideRide | null>(null);
  const [rideHistory, setRideHistory] = useState<MotorideRide[]>([]);
  const [activeTab, setActiveTab] = useState<'book' | 'history'>('book');
  const [viewMode, setViewMode] = useState<'background' | 'split'>('background');
  const [isCardMinimized, setIsCardMinimized] = useState<boolean>(false);
  const [isProfileOpen, setIsProfileOpen] = useState<boolean>(false);
  const [isRideHistoryOpen, setIsRideHistoryOpen] = useState<boolean>(false);
  const [showChatModal, setShowChatModal] = useState<boolean>(false);

  // Booking Form State - Initialized with default preset location
  const [pickup, setPickup] = useState<{
    name: string;
    lat: number;
    lng: number;
  }>(PRESET_LOCATIONS[0]);
  const [dropoff, setDropoff] = useState(PRESET_LOCATIONS[1]);
  const [rideType, setRideType] = useState<RideTypeCode>('bike');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'wallet' | 'upi'>('upi');
  const [offeredFare, setOfferedFare] = useState<number>(75);
  const [rideComment, setRideComment] = useState<string>('');
  const [showCommentInput, setShowCommentInput] = useState<boolean>(false);
  const [isBooking, setIsBooking] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [showPickupToast, setShowPickupToast] = useState(false);
  const [pickupToastMessage, setPickupToastMessage] = useState('📍 Pickup location set to your position');

  // Available Captains & Nearest Captain State for Passenger Map
  const [nearbyCaptains, setNearbyCaptains] = useState<AvailableCaptainItem[]>([]);
  const [nearestCaptain, setNearestCaptain] = useState<AvailableCaptainItem | null>(null);

  // Animated Captain Progression for Active Ride on Passenger Map
  const [animatedCaptainPos, setAnimatedCaptainPos] = useState<{
    lat: number;
    lng: number;
    heading: number;
  } | null>(null);

  // Real-Time Passenger GPS Location State (matching user icon)
  const [passengerGps, setPassengerGps] = useState<{
    lat: number;
    lng: number;
    accuracy: number | null;
    heading: number | null;
    speed: number | null;
    timestamp: number;
  }>(() => {
    try {
      const saved = safeStorage.getItem('motoride_last_passenger_gps');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.lat && parsed.lng) {
          return {
            lat: parsed.lat,
            lng: parsed.lng,
            accuracy: parsed.accuracy ?? 14,
            heading: 0,
            speed: 0,
            timestamp: Date.now(),
          };
        }
      }
    } catch {}
    return {
      lat: 30.704649,
      lng: 76.717873,
      accuracy: 14,
      heading: 0,
      speed: 0,
      timestamp: Date.now(),
    };
  });
  const [gpsStatus, setGpsStatus] = useState<'acquiring' | 'live' | 'denied' | 'unavailable' | 'timeout'>('acquiring');
  const [gpsErrorMessage, setGpsErrorMessage] = useState<string | null>(null);
  const [lastUploadedAt, setLastUploadedAt] = useState<number | null>(null);
  const [nowTick, setNowTick] = useState<number>(Date.now());

  // Manual Typing & Live Address Search State
  const [pickupMode, setPickupMode] = useState<'preset' | 'manual'>('preset');
  const [dropoffMode, setDropoffMode] = useState<'preset' | 'manual'>('preset');
  const [pickupInputText, setPickupInputText] = useState<string>('');
  const [dropoffInputText, setDropoffInputText] = useState<string>('');
  const [pickupSuggestions, setPickupSuggestions] = useState<Array<{ name: string; lat: number; lng: number }>>([]);
  const [dropoffSuggestions, setDropoffSuggestions] = useState<Array<{ name: string; lat: number; lng: number }>>([]);
  const [isSearchingPickup, setIsSearchingPickup] = useState(false);
  const [isSearchingDropoff, setIsSearchingDropoff] = useState(false);
  const [showPickupSuggestions, setShowPickupSuggestions] = useState(false);
  const [showDropoffSuggestions, setShowDropoffSuggestions] = useState(false);

  // Live Geocoding for Manual Pickup Search
  useEffect(() => {
    if (pickupMode !== 'manual' || !pickupInputText.trim() || pickupInputText.trim().length < 2) {
      setPickupSuggestions([]);
      return;
    }
    const timer = setTimeout(async () => {
      setIsSearchingPickup(true);
      try {
        const q = pickupInputText.trim();
        const res = await fetch(`/api/motoride/geocode/search?q=${encodeURIComponent(q)}`);
        if (res.ok) {
          const text = await res.text();
          if (text && !text.trim().startsWith('<') && !text.trim().startsWith('The page')) {
            const data = JSON.parse(text);
            if (data.results && Array.isArray(data.results)) {
              setPickupSuggestions(data.results);
            } else {
              setPickupSuggestions([]);
            }
          }
        }
      } catch (err) {
        console.warn('Pickup geocoding search failed:', err);
      } finally {
        setIsSearchingPickup(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [pickupInputText, pickupMode]);

  // Live Geocoding for Manual Dropoff Search
  useEffect(() => {
    if (dropoffMode !== 'manual' || !dropoffInputText.trim() || dropoffInputText.trim().length < 2) {
      setDropoffSuggestions([]);
      return;
    }
    const timer = setTimeout(async () => {
      setIsSearchingDropoff(true);
      try {
        const q = dropoffInputText.trim();
        const res = await fetch(`/api/motoride/geocode/search?q=${encodeURIComponent(q)}`);
        if (res.ok) {
          const text = await res.text();
          if (text && !text.trim().startsWith('<') && !text.trim().startsWith('The page')) {
            const data = JSON.parse(text);
            if (data.results && Array.isArray(data.results)) {
              setDropoffSuggestions(data.results);
            } else {
              setDropoffSuggestions([]);
            }
          }
        }
      } catch (err) {
        console.warn('Dropoff geocoding search failed:', err);
      } finally {
        setIsSearchingDropoff(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [dropoffInputText, dropoffMode]);

  const handleSelectPickupSuggestion = (item: { name: string; lat: number; lng: number }) => {
    setPickup({ name: item.name, lat: item.lat, lng: item.lng });
    setPickupInputText(item.name);
    setShowPickupSuggestions(false);
  };

  const handleManualPickupChange = (text: string) => {
    setPickupInputText(text);
    setShowPickupSuggestions(true);
    setPickup((prev) => ({
      name: text,
      lat: prev.lat || passengerGps.lat,
      lng: prev.lng || passengerGps.lng,
    }));
  };

  const handleSelectDropoffSuggestion = (item: { name: string; lat: number; lng: number }) => {
    setDropoff({ name: item.name, lat: item.lat, lng: item.lng });
    setDropoffInputText(item.name);
    setShowDropoffSuggestions(false);
  };

  const handleManualDropoffChange = (text: string) => {
    setDropoffInputText(text);
    setShowDropoffSuggestions(true);
    setDropoff((prev) => ({
      name: text,
      lat: prev.lat || (pickup.lat ? pickup.lat + 0.02 : 30.718214),
      lng: prev.lng || (pickup.lng ? pickup.lng + 0.02 : 76.732124),
    }));
  };
  const watchIdRef = useRef<number | null>(null);
  const lastUploadedGpsRef = useRef<{ lat: number; lng: number; time: number }>({
    lat: 0,
    lng: 0,
    time: 0,
  });

  // Handler: 1-click set pickup to passenger standing position
  const handleSetPickupFromPassengerPosition = (lat?: number, lng?: number) => {
    const targetLat = lat ?? passengerGps.lat;
    const targetLng = lng ?? passengerGps.lng;
    setPickup({
      name: 'My Live GPS Location',
      lat: targetLat,
      lng: targetLng,
    });
    setPickupToastMessage('Pickup Location (A) set to your position!');
    setShowPickupToast(true);
    setTimeout(() => setShowPickupToast(false), 3500);
  };
  const [fareSettings, setFareSettings] = useState<FareSettings>(() => {
    try {
      const saved = localStorage.getItem('motoride_admin_fare_settings');
      if (saved) return JSON.parse(saved);
    } catch {}
    return {
      currency_symbol: '₹',
      ride_charges: {},
      courier_charges: {},
    } as any;
  });

  // Trip Completed Rating State
  const [ratingScore, setRatingScore] = useState(5);
  const [reviewText, setReviewText] = useState('');
  const [ratingSubmitted, setRatingSubmitted] = useState(false);

  // Calculate distance in KM using Haversine formula
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371; // km
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Number((R * c).toFixed(1));
  };

  const hasSelectedLocations = Boolean(pickup.name?.trim() && dropoff.name?.trim());

  const distanceKm = hasSelectedLocations
    ? Math.max(1.0, calculateDistance(pickup.lat, pickup.lng, dropoff.lat, dropoff.lng))
    : 0;
  const durationMin = hasSelectedLocations ? Math.round(distanceKm * 2.8 + 4) : 0;

  // Dedicated separate pricing by service type (Ride vs Courier)
  const rideConfig = fareSettings.ride_charges || {};
  const courierConfig = fareSettings.courier_charges || {};

  let estimatedFare = 0;
  if (hasSelectedLocations) {
    if (rideType === 'courier') {
      const base = (courierConfig.base_fare ?? fareSettings.base_fare ?? 0) + (courierConfig.handling_fee ?? 0);
      const rate = courierConfig.per_km_rate ?? fareSettings.per_km_rate ?? 0;
      const minFare = courierConfig.minimum_fare ?? fareSettings.minimum_fare ?? 0;
      const running = distanceKm * rate;
      estimatedFare = Math.max(minFare, Math.round(base + running));
    } else {
      const multiplier =
        rideType === 'auto'
          ? (rideConfig.auto_multiplier || 1.25)
          : rideType === 'car'
          ? (rideConfig.car_multiplier || 1.8)
          : 1.0;
      const base = rideConfig.base_fare ?? fareSettings.base_fare ?? 0;
      const rate = rideConfig.per_km_rate ?? fareSettings.per_km_rate ?? 0;
      const minFare = rideConfig.minimum_fare ?? fareSettings.minimum_fare ?? 0;
      const running = distanceKm * rate;
      estimatedFare = Math.max(minFare, Math.round((base + running) * multiplier));
    }
  }

  // Auto-align offered fare with estimated fare when endpoints/type change
  useEffect(() => {
    setOfferedFare(estimatedFare);
  }, [estimatedFare]);

  // 5-second interval ticker for stale location detection (>30s)
  useEffect(() => {
    const timer = setInterval(() => {
      setNowTick(Date.now());
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  // Real-Time Passenger GPS Location Engine using navigator.geolocation.watchPosition()
  const handlePositionSuccess = (position: GeolocationPosition) => {
    const { latitude, longitude, accuracy, heading, speed } = position.coords;
    const now = position.timestamp || Date.now();

    setPassengerGps({
      lat: latitude,
      lng: longitude,
      accuracy: accuracy ?? 15,
      heading: heading ?? null,
      speed: speed ?? null,
      timestamp: now,
    });
    setGpsStatus('live');
    setGpsErrorMessage(null);

    // Persist latest passenger location for instant display on next app opening
    try {
      safeStorage.setItem(
        'motoride_last_passenger_gps',
        JSON.stringify({ lat: latitude, lng: longitude, accuracy })
      );
    } catch {}

    // If pickup location is currently set to live GPS, keep it synchronized
    setPickup((prev) => {
      if (prev.name === 'My Live GPS Location') {
        return {
          ...prev,
          lat: latitude,
          lng: longitude,
        };
      }
      return prev;
    });

    // Real-Time Supabase Sync with Throttling:
    // Sync if passenger moved > 4 meters OR time delta > 4 seconds (min throttle 2.5s)
    const prev = lastUploadedGpsRef.current;
    const distMeters = calculateDistance(prev.lat, prev.lng, latitude, longitude) * 1000;
    const timeDelta = now - prev.time;

    if (timeDelta >= 2500 && (distMeters >= 4 || timeDelta >= 4500 || prev.time === 0)) {
      lastUploadedGpsRef.current = { lat: latitude, lng: longitude, time: now };
      setLastUploadedAt(now);

      const isRideActive =
        activeRide &&
        !['trip_completed', 'cancelled_by_passenger', 'cancelled_by_captain'].includes(activeRide.status);

      motorideApi
        .updatePassengerLiveLocation({
          passenger_id: currentPassengerId,
          ride_id: isRideActive ? activeRide.id : null,
          latitude,
          longitude,
          accuracy: accuracy ?? null,
          heading: heading ?? null,
          speed: speed ?? null,
        })
        .catch((err) => console.warn('Supabase passenger live location sync notice:', err));
    }
  };

  const handlePositionError = (err: GeolocationPositionError) => {
    console.warn('Passenger Geolocation error:', err.code, err.message);
    if (err.code === 1) {
      // PERMISSION_DENIED
      setGpsStatus('denied');
      setGpsErrorMessage('Please allow location access to use your current location.');
    } else if (err.code === 2) {
      // POSITION_UNAVAILABLE
      setGpsStatus('unavailable');
      setGpsErrorMessage('Please allow location access or enable device GPS to use your current location.');
    } else if (err.code === 3) {
      // TIMEOUT
      setGpsStatus('timeout');
      setGpsErrorMessage('Location request timed out. Retrying GPS connection...');
    } else {
      setGpsStatus('denied');
      setGpsErrorMessage('Please allow location access to use your current location.');
    }
  };

  const startWatchingLocation = () => {
    if (watchIdRef.current !== null && 'geolocation' in navigator) {
      try {
        navigator.geolocation.clearWatch(watchIdRef.current);
      } catch {}
      watchIdRef.current = null;
    }

    if (!('geolocation' in navigator)) {
      setGpsStatus('unavailable');
      setGpsErrorMessage('Geolocation API is not supported in this browser.');
      return;
    }

    setGpsStatus('acquiring');
    setGpsErrorMessage(null);

    // 1. Initial immediate request with high accuracy, falling back to standard WiFi/IP accuracy if GPS times out
    try {
      navigator.geolocation.getCurrentPosition(
        (pos) => handlePositionSuccess(pos),
        (err) => {
          if (err.code === 2 || err.code === 3) {
            try {
              navigator.geolocation.getCurrentPosition(
                (fallbackPos) => handlePositionSuccess(fallbackPos),
                (fallbackErr) => handlePositionError(fallbackErr),
                { enableHighAccuracy: false, timeout: 8000, maximumAge: 30000 }
              );
            } catch {}
          } else {
            handlePositionError(err);
          }
        },
        { enableHighAccuracy: true, timeout: 5000, maximumAge: 10000 }
      );
    } catch (e) {
      console.warn('Initial geolocation attempt caught:', e);
    }

    // 2. Continuous watchPosition for live-location streaming
    try {
      const id = navigator.geolocation.watchPosition(
        (pos) => handlePositionSuccess(pos),
        (err) => {
          console.warn('Geolocation watch note:', err.message);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 2000,
        }
      );
      watchIdRef.current = id;
    } catch (e) {
      console.warn('watchPosition catch:', e);
    }
  };

  const requestLiveLocation = () => {
    startWatchingLocation();
  };

  useEffect(() => {
    startWatchingLocation();

    return () => {
      if (watchIdRef.current !== null && 'geolocation' in navigator) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [activeRide?.id, activeRide?.status]);

  // Load initial settings and active ride if any
  useEffect(() => {
    loadFareSettings();
    loadActiveRide();
    loadRideHistory();

    // Listen to real-time events
    const unsubUpdate = realtimeSync.on('RIDE_UPDATED', (ride: MotorideRide) => {
      if (ride.passenger_id === currentPassengerId) {
        if (ride.status.includes('cancelled')) {
          setActiveRide(null);
        } else {
          setActiveRide((prev) => {
            if (!prev || prev.id !== ride.id) return ride;
            return {
              ...prev,
              ...ride,
              captain_name: ride.captain_name || prev.captain_name,
              captain_phone: ride.captain_phone || prev.captain_phone,
              vehicle_model: ride.vehicle_model || prev.vehicle_model,
              plate_number: ride.plate_number || prev.plate_number,
              captain_avatar: (ride as any).captain_avatar || (ride as any).avatar_url || (prev as any).captain_avatar || (prev as any).avatar_url,
            };
          });
        }
        loadRideHistory();
      }
    });

    const unsubAccepted = realtimeSync.on('RIDE_ACCEPTED', (ride: MotorideRide) => {
      if (ride.passenger_id === currentPassengerId) {
        if (ride.status.includes('cancelled')) {
          setActiveRide(null);
        } else {
          setActiveRide((prev) => {
            if (!prev || prev.id !== ride.id) return ride;
            return {
              ...prev,
              ...ride,
              captain_name: ride.captain_name || prev.captain_name,
              captain_phone: ride.captain_phone || prev.captain_phone,
              vehicle_model: ride.vehicle_model || prev.vehicle_model,
              plate_number: ride.plate_number || prev.plate_number,
              captain_avatar: (ride as any).captain_avatar || (ride as any).avatar_url || (prev as any).captain_avatar || (prev as any).avatar_url,
            };
          });
        }
      }
    });

    const unsubLocation = realtimeSync.on('CAPTAIN_LOCATION_UPDATED', (payload) => {
      setActiveRide((prev) => {
        if (prev && (prev.id === payload.ride_id || prev.captain_id === payload.captain_id)) {
          return {
            ...prev,
            captain_current_lat: payload.lat,
            captain_current_lng: payload.lng,
            captain_heading: payload.heading ?? prev.captain_heading,
          };
        }
        return prev;
      });

      if (payload.lat && payload.lng) {
        setAnimatedCaptainPos((prev) => ({
          lat: payload.lat,
          lng: payload.lng,
          heading: payload.heading ?? prev?.heading ?? 45,
        }));
      }

      // Also update coordinates in nearby captains list
      if (payload.captain_id && payload.lat && payload.lng) {
        setNearbyCaptains((prev) =>
          prev.map((c) =>
            c.id === payload.captain_id
              ? { ...c, lat: payload.lat, lng: payload.lng, heading: payload.heading ?? c.heading }
              : c
          )
        );
        setNearestCaptain((prev) => {
          if (prev && prev.id === payload.captain_id) {
            return { ...prev, lat: payload.lat, lng: payload.lng, heading: payload.heading ?? prev.heading };
          }
          return prev;
        });
      }
    });

    const unsubOffer = realtimeSync.on('RIDE_OFFER_RECEIVED', (payload: { ride: MotorideRide }) => {
      if (payload.ride.passenger_id === currentPassengerId) {
        if (payload.ride.status.includes('cancelled')) {
          setActiveRide(null);
        } else {
          setActiveRide(payload.ride);
        }
      }
    });

    // Continuous 2.5s polling to guarantee cross-browser / mobile sync even if SSE disconnects
    const pollTimer = setInterval(() => {
      loadActiveRide();
    }, 2500);

    const handleFocus = () => {
      if (document.visibilityState === 'visible') {
        loadActiveRide();
        loadRideHistory();
      }
    };
    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleFocus);

    return () => {
      unsubUpdate();
      unsubAccepted();
      unsubLocation();
      unsubOffer();
      clearInterval(pollTimer);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleFocus);
    };
  }, [currentPassengerId]);

  // Animated Captain Progression for Active Ride on Passenger Map:
  // When 'captain_accepted': smoothly animate captain arriving to Pickup Location A
  // When 'captain_arrived': captain arrives and stays at Pickup Location A
  // When 'trip_started': smoothly animate captain traveling to Drop-off Location B
  useEffect(() => {
    if (!activeRide || !activeRide.captain_id) {
      setAnimatedCaptainPos(null);
      return;
    }

    const { status, pickup_lat, pickup_lng, dropoff_lat, dropoff_lng, captain_current_lat, captain_current_lng, captain_heading } = activeRide;

    // Initialize or re-anchor starting coordinates
    setAnimatedCaptainPos((prev) => {
      if (prev) return prev;
      if (captain_current_lat && captain_current_lng) {
        return {
          lat: captain_current_lat,
          lng: captain_current_lng,
          heading: captain_heading || 45,
        };
      }
      if (status === 'captain_accepted') {
        const initLat = Number((pickup_lat - 0.0055).toFixed(6));
        const initLng = Number((pickup_lng - 0.0045).toFixed(6));
        return {
          lat: initLat,
          lng: initLng,
          heading: calculateBearingDegrees(initLat, initLng, pickup_lat, pickup_lng),
        };
      }
      if (status === 'trip_started') {
        return {
          lat: pickup_lat,
          lng: pickup_lng,
          heading: calculateBearingDegrees(pickup_lat, pickup_lng, dropoff_lat, dropoff_lng),
        };
      }
      return {
        lat: pickup_lat,
        lng: pickup_lng,
        heading: 45,
      };
    });

    if (status === 'captain_arrived') {
      setAnimatedCaptainPos({
        lat: pickup_lat,
        lng: pickup_lng,
        heading: calculateBearingDegrees(pickup_lat, pickup_lng, dropoff_lat, dropoff_lng),
      });
      return;
    }

    if (status === 'trip_completed') {
      setAnimatedCaptainPos({
        lat: dropoff_lat,
        lng: dropoff_lng,
        heading: 0,
      });
      return;
    }

    const isAccepted = status === 'captain_accepted';
    const isTripStarted = status === 'trip_started';

    if (!isAccepted && !isTripStarted) return;

    const targetLat = isAccepted ? pickup_lat : dropoff_lat;
    const targetLng = isAccepted ? pickup_lng : dropoff_lng;

    const interval = setInterval(() => {
      setAnimatedCaptainPos((prev) => {
        if (!prev) {
          const startLat = isAccepted ? pickup_lat - 0.0055 : pickup_lat;
          const startLng = isAccepted ? pickup_lng - 0.0045 : pickup_lng;
          return {
            lat: startLat,
            lng: startLng,
            heading: calculateBearingDegrees(startLat, startLng, targetLat, targetLng),
          };
        }

        const dLat = targetLat - prev.lat;
        const dLng = targetLng - prev.lng;
        const dist = Math.hypot(dLat, dLng);

        if (dist < 0.0001) {
          return {
            ...prev,
            lat: targetLat,
            lng: targetLng,
          };
        }

        // Smooth incremental advance towards destination
        const step = Math.min(0.00035, dist * 0.16);
        const ratio = dist > 0 ? step / dist : 0;
        const newLat = prev.lat + dLat * ratio;
        const newLng = prev.lng + dLng * ratio;
        const bearing = calculateBearingDegrees(prev.lat, prev.lng, targetLat, targetLng);

        return {
          lat: Number(newLat.toFixed(6)),
          lng: Number(newLng.toFixed(6)),
          heading: bearing,
        };
      });
    }, 1400);

    return () => clearInterval(interval);
  }, [activeRide?.id, activeRide?.status, activeRide?.pickup_lat, activeRide?.pickup_lng, activeRide?.dropoff_lat, activeRide?.dropoff_lng]);

  // Continuously fetch and update available captains & nearest captain on passenger map
  useEffect(() => {
    let isMounted = true;

    const fetchCaptains = async () => {
      try {
        const refLat = pickup.name ? pickup.lat : passengerGps.lat;
        const refLng = pickup.name ? pickup.lng : passengerGps.lng;
        const res = await motorideApi.getAvailableCaptains(refLat, refLng);
        if (!isMounted) return;

        const mapped: AvailableCaptainItem[] = (res.captains || [])
          .filter((c) => c.current_lat != null && c.current_lng != null)
          .map((c) => ({
            id: c.id,
            name: c.name,
            lat: c.current_lat!,
            lng: c.current_lng!,
            heading: c.current_heading || 45,
            rating: c.rating,
            vehicleModel: c.vehicle_model,
            vehiclePlate: c.plate_number,
            vehicleType: c.vehicle_type,
            distanceKm: (c as any).distance_km,
            etaMinutes: (c as any).eta_minutes,
            isNearest: Boolean((c as any).is_nearest),
          }));

        setNearbyCaptains(mapped);

        if (res.nearestCaptain && res.nearestCaptain.current_lat != null && res.nearestCaptain.current_lng != null) {
          setNearestCaptain({
            id: res.nearestCaptain.id,
            name: res.nearestCaptain.name,
            lat: res.nearestCaptain.current_lat,
            lng: res.nearestCaptain.current_lng,
            heading: res.nearestCaptain.current_heading || 45,
            rating: res.nearestCaptain.rating,
            vehicleModel: res.nearestCaptain.vehicle_model,
            vehiclePlate: res.nearestCaptain.plate_number,
            vehicleType: res.nearestCaptain.vehicle_type,
            distanceKm: (res.nearestCaptain as any).distance_km,
            etaMinutes: (res.nearestCaptain as any).eta_minutes,
            isNearest: true,
          });
        } else if (mapped.length > 0) {
          setNearestCaptain(mapped[0]);
        } else {
          setNearestCaptain(null);
        }
      } catch (err) {
        console.warn('Failed to load available captains for passenger map:', err);
      }
    };

    fetchCaptains();
    const interval = setInterval(fetchCaptains, 4000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [passengerGps.lat, passengerGps.lng, pickup.lat, pickup.lng, pickup.name]);

  const loadFareSettings = async () => {
    try {
      const s = await motorideApi.getFareSettings();
      if (s) setFareSettings(s);
    } catch {}
  };

  const loadActiveRide = async () => {
    try {
      const rides = await motorideApi.getRides({ passenger_id: currentPassengerId });
      const active = rides.find(
        (r) =>
          r.status === 'requested' ||
          r.status === 'captain_offered' ||
          r.status === 'captain_accepted' ||
          r.status === 'captain_arrived' ||
          r.status === 'trip_started'
      );
      if (active) {
        setActiveRide((prev) => {
          if (!prev || prev.id !== active.id) return active;
          return {
            ...prev,
            ...active,
            captain_name: active.captain_name || prev.captain_name,
            captain_phone: active.captain_phone || prev.captain_phone,
            vehicle_model: active.vehicle_model || prev.vehicle_model,
            plate_number: active.plate_number || prev.plate_number,
            captain_avatar: (active as any).captain_avatar || (active as any).avatar_url || (prev as any).captain_avatar || (prev as any).avatar_url,
          };
        });
      }
    } catch {}
  };

  const loadRideHistory = async () => {
    try {
      const rides = await motorideApi.getRides({ passenger_id: currentPassengerId });
      setRideHistory(rides);
    } catch {}
  };

  // Handle Book Ride
  const handleBookRide = async () => {
    if (!hasSelectedLocations || offeredFare <= 0) {
      return;
    }
    const activePickup = pickup.name?.trim() ? pickup : PRESET_LOCATIONS[0];
    const activeDropoff = dropoff.name?.trim() ? dropoff : PRESET_LOCATIONS[1];

    setIsBooking(true);
    try {
      const calcDistance = distanceKm > 0 ? distanceKm : 3.5;
      const calcDuration = durationMin > 0 ? durationMin : 10;
      const calcFare = offeredFare > 0 ? offeredFare : (estimatedFare > 0 ? estimatedFare : 75);

      const newRide = await motorideApi.createRide({
        passenger_id: currentPassengerId || authUser?.id || '',
        passenger_name: effectivePassengerName,
        passenger_phone: authUser?.phone || '+91 97800 12345',
        pickup_address: activePickup.name,
        pickup_lat: activePickup.lat,
        pickup_lng: activePickup.lng,
        dropoff_address: activeDropoff.name,
        dropoff_lat: activeDropoff.lat,
        dropoff_lng: activeDropoff.lng,
        distance_km: calcDistance,
        duration_minutes: calcDuration,
        estimated_fare: estimatedFare > 0 ? estimatedFare : calcFare,
        offered_fare: calcFare,
        ride_type: rideType,
        payment_method: paymentMethod,
        comment: rideComment.trim() || undefined,
        notes: rideComment.trim() || undefined,
      });
      setActiveRide(newRide);
      loadRideHistory();

      // Immediately link current live GPS coordinates to the new ride in Supabase
      motorideApi
        .updatePassengerLiveLocation({
          passenger_id: currentPassengerId,
          ride_id: newRide.id,
          latitude: passengerGps.lat,
          longitude: passengerGps.lng,
          accuracy: passengerGps.accuracy,
          heading: passengerGps.heading,
          speed: passengerGps.speed,
        })
        .catch(() => {});
    } catch (err: any) {
      alert(err.message || 'Failed to request ride');
    } finally {
      setIsBooking(false);
    }
  };

  // Instant Captain Acceptance for testing
  const handleSimulateInstantAccept = async () => {
    if (!activeRide) return;
    try {
      const realName = safeStorage.getItem('motoride_captain_name') || 'Captain Nearby';
      const realPhone = safeStorage.getItem('motoride_captain_phone') || '';
      const realModel = safeStorage.getItem('motoride_captain_vehicle_model') || 'Motorcycle';
      const realPlate = safeStorage.getItem('motoride_captain_plate') || '';
      const realAvatar = safeStorage.getItem('motoride_captain_avatar') || undefined;

      const updated = await motorideApi.acceptRide(activeRide.id, {
        captain_id: 'cpt_instant_01',
        captain_name: realName,
        captain_phone: realPhone,
        captain_avatar: realAvatar,
        vehicle_model: realModel,
        plate_number: realPlate,
        accepted_fare: activeRide.offered_fare || 75,
      });
      setActiveRide(updated);
    } catch (err: any) {
      console.warn('Instant match notice:', err);
    }
  };

  // Passenger Accepts a Captain's Counter Offer
  const handleAcceptOffer = async (offerId: string) => {
    if (!activeRide) return;
    try {
      const updated = await motorideApi.acceptCounterOffer(activeRide.id, offerId);
      setActiveRide(updated);

      // Re-affirm live location on counter-offer acceptance
      motorideApi
        .updatePassengerLiveLocation({
          passenger_id: currentPassengerId,
          ride_id: updated.id,
          latitude: passengerGps.lat,
          longitude: passengerGps.lng,
          accuracy: passengerGps.accuracy,
          heading: passengerGps.heading,
          speed: passengerGps.speed,
        })
        .catch(() => {});
    } catch (err: any) {
      alert(err.message || 'Failed to accept offer');
    }
  };

  // Cancel Current Ride (Optimistic state update without blocking modals for iframe sandbox)
  const handleCancelRide = async () => {
    if (!activeRide || isCancelling) return;
    setIsCancelling(true);
    const rideIdToCancel = activeRide.id;
    try {
      setActiveRide(null);
      await motorideApi.updateRideStatus(rideIdToCancel, 'cancelled_by_passenger', {
        cancellation_reason: 'Passenger cancelled the request',
      });
      loadRideHistory();
    } catch (err: any) {
      console.warn('Cancel ride notice:', err);
      loadRideHistory();
    } finally {
      setIsCancelling(false);
    }
  };

  // Rating Submit
  const handleRateRide = async () => {
    setRatingSubmitted(true);
    setTimeout(() => {
      setActiveRide(null);
      setRatingSubmitted(false);
      loadRideHistory();
    }, 1500);
  };

  const renderMap = (isFullBackground: boolean) => {
    // When active ride is present, ensure Location A and Location B are taken from active ride
    const currentPickupLat = activeRide ? activeRide.pickup_lat : (pickup.name ? pickup.lat : null);
    const currentPickupLng = activeRide ? activeRide.pickup_lng : (pickup.name ? pickup.lng : null);
    const currentPickupAddress = activeRide ? activeRide.pickup_address : pickup.name;

    const currentDropoffLat = activeRide ? activeRide.dropoff_lat : (dropoff.name ? dropoff.lat : null);
    const currentDropoffLng = activeRide ? activeRide.dropoff_lng : (dropoff.name ? dropoff.lng : null);
    const currentDropoffAddress = activeRide ? activeRide.dropoff_address : dropoff.name;

    const currentCaptainLat = activeRide?.captain_id
      ? (animatedCaptainPos?.lat ?? activeRide.captain_current_lat ?? null)
      : null;
    const currentCaptainLng = activeRide?.captain_id
      ? (animatedCaptainPos?.lng ?? activeRide.captain_current_lng ?? null)
      : null;
    const currentCaptainHeading = animatedCaptainPos?.heading ?? activeRide?.captain_heading ?? 45;

    return (
      <MotorideMap
        passengerLat={passengerGps.lat}
        passengerLng={passengerGps.lng}
        passengerAccuracy={passengerGps.accuracy}
        passengerHeading={passengerGps.heading}
        passengerName="Standing Here"
        showPassengerOnly={false}
        nearbyCaptains={activeRide ? [] : nearbyCaptains}
        nearestCaptain={activeRide ? null : nearestCaptain}
        showLocationsABOnly={Boolean(activeRide)}
        isLiveGpsActive={gpsStatus === 'live'}
        onLocateMe={requestLiveLocation}
        pickupLat={currentPickupLat}
        pickupLng={currentPickupLng}
        pickupAddress={currentPickupAddress}
        dropoffLat={currentDropoffLat}
        dropoffLng={currentDropoffLng}
        dropoffAddress={currentDropoffAddress}
        captainLat={currentCaptainLat}
        captainLng={currentCaptainLng}
        captainHeading={currentCaptainHeading}
        captainName={activeRide?.captain_name || 'Captain'}
        activeRideStatus={activeRide?.status}
        bottomSheetPadding={activeRide ? (isCardMinimized ? 90 : 380) : 180}
        interactive={!activeRide}
        onSetPickupToPassengerLocation={(lat, lng) => handleSetPickupFromPassengerPosition(lat, lng)}
        onMapClick={(lat, lng) => {
          if (activeRide) return;
          // If clicking map during booking, update pickup if empty, otherwise dropoff
          if (!pickup.name) {
            setPickup({
              name: `Pinned Pickup (${lat.toFixed(3)}, ${lng.toFixed(3)})`,
              lat,
              lng,
            });
          } else {
            setDropoff({
              name: `Pinned Destination (${lat.toFixed(3)}, ${lng.toFixed(3)})`,
              lat,
              lng,
            });
          }
        }}
        className={`w-full h-full ${isFullBackground ? 'rounded-none border-0' : 'shadow-2xl border border-slate-800'}`}
      />
    );
  };

  // Helper to get reliable captain avatar picture
  const getCaptainAvatarUrl = (name?: string, avatar?: string) => {
    if (avatar && avatar.trim()) return avatar;
    const localCaptainAvatar = safeStorage.getItem('motoride_captain_avatar');
    if (localCaptainAvatar && localCaptainAvatar.trim()) return localCaptainAvatar;
    const cleanName = (name && name !== 'Captain' && name.trim()) ? name : 'Captain';
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(cleanName)}&background=0284c7&color=fff&bold=true`;
  };

  const renderControlPanel = () => (
    <div className="flex flex-col gap-4">
      {activeRide ? (
          /* Active Ride Cards - White Background with Black Text, Icons and Dark Black Outlines */
          <div className="bg-white border-2 border-black rounded-3xl p-5 flex flex-col gap-4 shadow-2xl text-black">
            {/* Top Pull Down / Drop Down Handle Bar */}
            <div
              onClick={() => setIsCardMinimized(true)}
              className="w-full -mt-2 -mb-1 py-1 flex flex-col items-center justify-center cursor-pointer group select-none"
              title="Drop down active ride to see full map"
            >
              <div className="w-12 h-1.5 rounded-full bg-slate-300 group-hover:bg-black transition-colors" />
            </div>

            {/* Status Header */}
            <div className="flex items-center justify-between pb-3 border-b border-black/20">
              <div>
                <span className="text-[11px] font-mono-num font-black text-black block">
                  {activeRide.ride_code}
                </span>
                <h2 className="text-base font-black text-black capitalize">
                  {activeRide.status.replace(/_/g, ' ')}
                </h2>
              </div>

              <div className="flex items-center gap-2">
                {/* Drop Down Button in Active Ride */}
                <button
                  type="button"
                  onClick={() => setIsCardMinimized(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-black border border-black text-xs font-black transition-all active:scale-95 cursor-pointer group shadow-xs"
                  title="Drop down active ride details to view full map"
                  aria-label="Drop down active ride details"
                >
                  <span>Drop Down</span>
                  <ChevronDown className="w-4 h-4 text-black group-hover:translate-y-0.5 transition-transform stroke-[2.5]" />
                </button>

                <div className="w-9 h-9 rounded-2xl bg-slate-100 border border-black flex items-center justify-center shrink-0">
                  <Bike className="w-5 h-5 text-black stroke-[2.5]" />
                </div>
              </div>
            </div>

            {/* Passenger Live GPS Sharing Status in Active Ride */}
            {gpsErrorMessage ? (
              <div className="p-3 rounded-2xl bg-rose-50 border border-black text-rose-900 text-xs flex items-center justify-between gap-3 font-semibold">
                <div className="flex items-center gap-2 min-w-0">
                  <AlertCircle className="w-4 h-4 text-rose-700 shrink-0" />
                  <span className="font-bold">{gpsErrorMessage}</span>
                </div>
                <button
                  type="button"
                  onClick={startWatchingLocation}
                  className="px-2.5 py-1 rounded-xl bg-black hover:bg-slate-800 text-white font-bold text-xs shrink-0 active:scale-95 cursor-pointer shadow border border-black"
                >
                  Enable GPS
                </button>
              </div>
            ) : (
              <div className="px-3 py-2 rounded-2xl bg-slate-50 border border-black flex items-center justify-between text-xs text-black">
                <div className="flex items-center gap-2">
                  <div className="relative flex items-center justify-center w-2.5 h-2.5">
                    <span className="absolute w-full h-full rounded-full bg-black/40 animate-ping opacity-75" />
                    <span className="relative w-2 h-2 rounded-full bg-black" />
                  </div>
                  <span className="text-slate-800 font-bold">Live GPS Sharing:</span>
                  <span className="text-black font-black">Active</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-slate-700 font-mono-num font-bold">
                    {passengerGps.accuracy ? `±${Math.round(passengerGps.accuracy)}m` : 'High Precision'}
                  </span>
                  {nowTick - passengerGps.timestamp > 30000 && (
                    <span className="text-[10px] text-black bg-slate-200 px-1.5 py-0.5 rounded border border-black/30 font-black">
                      Stale (&gt;30s)
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Case 1: Searching Nearby Captains Radar - White Background with Black Text and Icons */}
            {(activeRide.status === 'requested' || activeRide.status === 'captain_offered') && (
              <div className="flex flex-col items-center justify-center py-6 text-center text-black">
                <div className="relative flex items-center justify-center w-28 h-28 my-2">
                  <div className="absolute inset-0 rounded-full bg-slate-200/80 animate-ping border border-black/10" />
                  <div className="absolute w-20 h-20 rounded-full bg-slate-200 animate-pulse border border-black/20" />
                  <div className="w-14 h-14 rounded-full bg-black flex items-center justify-center text-white font-black shadow-lg border border-black">
                    <Bike className="w-7 h-7 text-white stroke-[2.5]" />
                  </div>
                </div>
                <h3 className="text-base font-black text-black mt-2">
                  Radar Active • Contacting Captains
                </h3>
                <p className="text-xs text-slate-700 font-medium max-w-xs mt-1">
                  Broadcasting your offer of{' '}
                  <span className="text-black font-black font-mono-num">
                    ₹{activeRide.offered_fare}
                  </span>{' '}
                  to all nearby active captains in real time.
                </p>

                {/* Incoming Counter Offers from Captains */}
                {activeRide.offers && activeRide.offers.length > 0 && (
                  <div className="w-full mt-5 flex flex-col gap-2.5 text-left">
                    <h4 className="text-xs font-black text-black flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-black" />
                      <span>Incoming Captain Offers ({activeRide.offers.length})</span>
                    </h4>
                    {activeRide.offers.map((offer) => (
                      <div
                        key={offer.id}
                        className="p-3 rounded-2xl bg-slate-50 border-2 border-black flex items-center justify-between gap-3 shadow-xs text-black"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          {/* Captain Profile Pick */}
                          <div className="relative shrink-0">
                            <img
                              src={getCaptainAvatarUrl(offer.captain_name, offer.captain_avatar || offer.avatar_url)}
                              alt={offer.captain_name || 'Captain'}
                              referrerPolicy="no-referrer"
                              className="w-11 h-11 rounded-full object-cover border-2 border-black bg-slate-200 shadow-xs"
                              onError={(e) => {
                                (e.currentTarget as HTMLImageElement).src =
                                  `https://ui-avatars.com/api/?name=${encodeURIComponent(offer.captain_name || 'Captain')}&background=0284c7&color=fff&bold=true`;
                              }}
                            />
                            <span
                              className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-black text-white flex items-center justify-center text-[9px] font-black border border-white"
                              title="Verified Captain"
                            >
                              ✓
                            </span>
                          </div>

                          {/* Captain Info */}
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-black text-sm text-black truncate">
                                {offer.captain_name}
                              </span>
                              <span className="flex items-center text-[10px] text-black bg-slate-200 px-1.5 py-0.5 rounded border border-black/30 font-bold shrink-0">
                                <Star className="w-3 h-3 fill-black text-black mr-0.5" />
                                {offer.rating}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-700 mt-0.5 font-medium truncate">
                              {offer.vehicle_model} • {offer.plate_number}
                            </p>
                          </div>
                        </div>

                        {/* Counter Fare & Accept Button */}
                        <div className="flex flex-col items-end gap-1 shrink-0">
                          <span className="text-sm font-black text-black font-mono-num">
                            ₹{offer.counter_fare}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleAcceptOffer(offer.id)}
                            className="px-3.5 py-1.5 rounded-xl bg-black hover:bg-slate-800 text-white font-black text-xs shadow-md border border-black transition-all active:scale-95 cursor-pointer"
                          >
                            Accept
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Cancel Button */}
                <div className="w-full mt-5">
                  <button
                    type="button"
                    onClick={handleCancelRide}
                    disabled={isCancelling}
                    className="w-full py-2.5 px-4 rounded-2xl bg-slate-100 hover:bg-slate-200 border border-black text-black font-black text-xs flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-[0.98] shadow-xs disabled:opacity-50"
                    aria-label="Cancel Ride Request"
                  >
                    <XCircle className="w-4 h-4 text-black shrink-0" />
                    <span>{isCancelling ? 'Cancelling Request...' : 'Cancel Ride Request'}</span>
                  </button>
                </div>
              </div>
            )}

            {/* Case 2: Captain Accepted / Arrived / Trip Started */}
            {(activeRide.status === 'captain_accepted' ||
              activeRide.status === 'captain_arrived' ||
              activeRide.status === 'trip_started') && (
              <div className="flex flex-col gap-4 text-black">
                {/* Digital Watch on Top of Ride Details (Shown ONLY when captain is on the way to pickup) */}
                {activeRide.status === 'captain_accepted' && (
                  <DigitalWatchETA
                    ride={activeRide}
                    captainLat={animatedCaptainPos?.lat ?? activeRide.captain_current_lat}
                    captainLng={animatedCaptainPos?.lng ?? activeRide.captain_current_lng}
                    variant="card-header"
                  />
                )}

                {/* When Captain has arrived, show arrival banner */}
                {activeRide.status === 'captain_arrived' && (
                  <div className="w-full rounded-2xl bg-emerald-500 text-slate-950 px-4 py-3 border-2 border-black font-black flex items-center justify-between shadow-md select-none animate-in fade-in duration-200">
                    <div className="flex items-center gap-2.5">
                      <span className="w-3 h-3 rounded-full bg-slate-950 animate-ping shrink-0" />
                      <span className="text-xs sm:text-sm font-black uppercase tracking-wide">
                        Captain has arrived at pickup location!
                      </span>
                    </div>
                    <span className="text-[11px] bg-slate-950 text-white px-2.5 py-1 rounded-xl font-bold shrink-0">
                      Waiting for you
                    </span>
                  </div>
                )}

                {/* When Trip has started, show on-trip banner */}
                {activeRide.status === 'trip_started' && (
                  <div className="w-full rounded-2xl bg-slate-950 text-white px-4 py-3 border-2 border-black font-black flex items-center justify-between shadow-md select-none animate-in fade-in duration-200">
                    <div className="flex items-center gap-2.5">
                      <span className="w-3 h-3 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                      <div>
                        <span className="text-xs sm:text-sm font-black uppercase tracking-wide text-white block">
                          Trip in Progress
                        </span>
                        <span className="text-[11px] text-slate-300 font-normal block truncate max-w-[220px] sm:max-w-xs">
                          En route to: {activeRide.dropoff_address || 'Destination (Location B)'}
                        </span>
                      </div>
                    </div>
                    <span className="text-[11px] bg-emerald-500 text-slate-950 px-2.5 py-1 rounded-xl font-bold shrink-0">
                      On Trip
                    </span>
                  </div>
                )}

                {/* Captain Details Box */}
                <div className="p-4 rounded-2xl bg-slate-50 border border-black flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="relative shrink-0">
                      <img
                        src={getCaptainAvatarUrl(activeRide.captain_name || undefined, (activeRide as any).captain_avatar || (activeRide as any).avatar_url)}
                        alt={activeRide.captain_name || 'Captain'}
                        referrerPolicy="no-referrer"
                        className="w-12 h-12 rounded-full object-cover border-2 border-black bg-slate-200 shadow-xs"
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).src =
                            `https://ui-avatars.com/api/?name=${encodeURIComponent(activeRide.captain_name || 'Captain')}&background=0284c7&color=fff&bold=true`;
                        }}
                      />
                      <span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-black text-white flex items-center justify-center text-[9px] font-black border border-white">
                        ✓
                      </span>
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-black text-black text-sm">
                          {activeRide.captain_name && activeRide.captain_name !== 'Captain'
                            ? activeRide.captain_name
                            : (safeStorage.getItem('motoride_captain_name') || 'Assigned Captain')}
                        </span>
                        <span className="flex items-center text-[10px] text-black bg-slate-200 border border-black/30 px-1.5 py-0.5 rounded font-bold">
                          <Star className="w-3 h-3 fill-black text-black mr-0.5" /> 4.92
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 font-mono-num mt-0.5 font-medium">
                        {(activeRide.vehicle_model || safeStorage.getItem('motoride_captain_vehicle_model') || 'Motorcycle')}{' '}
                        •{' '}
                        <span className="text-black font-black">
                          {(activeRide.plate_number || safeStorage.getItem('motoride_captain_plate') || 'Verified')}
                        </span>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setShowChatModal(true)}
                      className="p-3 rounded-2xl bg-slate-100 text-black border border-black hover:bg-slate-200 shadow-sm transition-all active:scale-95 cursor-pointer"
                      title="Chat with Captain"
                    >
                      <MessageSquare className="w-4 h-4 stroke-[2.5]" />
                    </button>
                    {(activeRide.captain_phone || safeStorage.getItem('motoride_captain_phone')) && (
                      <a
                        href={`tel:${activeRide.captain_phone || safeStorage.getItem('motoride_captain_phone')}`}
                        className="p-3 rounded-2xl bg-black hover:bg-slate-800 text-white font-bold shadow-sm transition-all active:scale-95 border border-black"
                        title="Call Captain"
                      >
                        <Phone className="w-4 h-4 stroke-[2.5]" />
                      </a>
                    )}
                  </div>
                </div>

                {/* Progress Indicators */}
                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <div
                    className={`p-2 rounded-xl border ${
                      activeRide.status === 'captain_accepted'
                        ? 'bg-black text-white border-black font-black'
                        : 'bg-slate-100 border-black/30 text-slate-600 font-semibold'
                    }`}
                  >
                    1. En Route
                  </div>
                  <div
                    className={`p-2 rounded-xl border ${
                      activeRide.status === 'captain_arrived'
                        ? 'bg-black text-white border-black font-black'
                        : 'bg-slate-100 border-black/30 text-slate-600 font-semibold'
                    }`}
                  >
                    2. Arrived
                  </div>
                  <div
                    className={`p-2 rounded-xl border ${
                      activeRide.status === 'trip_started'
                        ? 'bg-black text-white border-black font-black'
                        : 'bg-slate-100 border-black/30 text-slate-600 font-semibold'
                    }`}
                  >
                    3. Riding
                  </div>
                </div>

                {/* Route Summary */}
                <div className="text-xs text-black space-y-1.5 p-3 rounded-2xl bg-slate-50 border border-black">
                  <p className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-black" />
                    <span className="text-slate-600 font-bold">From:</span>
                    <span className="truncate font-black">{activeRide.pickup_address}</span>
                  </p>
                  <p className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-slate-400 border border-black" />
                    <span className="text-slate-600 font-bold">To:</span>
                    <span className="truncate font-black">{activeRide.dropoff_address}</span>
                  </p>
                </div>

                {/* Fare and payment summary */}
                <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-100 border border-black">
                  <span className="text-xs text-black font-bold">Agreed Fare:</span>
                  <span className="font-mono-num font-black text-base text-black">
                    ₹{activeRide.final_fare || activeRide.offered_fare}
                  </span>
                </div>

                {activeRide.status !== 'trip_started' && (
                  <button
                    type="button"
                    onClick={handleCancelRide}
                    disabled={isCancelling}
                    className="w-full py-2.5 rounded-xl border border-black text-black bg-slate-100 hover:bg-slate-200 text-xs font-black flex items-center justify-center gap-2 cursor-pointer transition-colors active:scale-[0.98] disabled:opacity-50"
                    aria-label="Cancel Ride"
                  >
                    <XCircle className="w-4 h-4 shrink-0 text-black" />
                    <span>{isCancelling ? 'Cancelling...' : 'Cancel Ride'}</span>
                  </button>
                )}
              </div>
            )}

            {/* Case 3: Trip Completed & Rating Form */}
            {activeRide.status === 'trip_completed' && (
              <div className="flex flex-col items-center text-center py-4 gap-3 text-black">
                <div className="w-14 h-14 rounded-full bg-slate-100 text-black border-2 border-black flex items-center justify-center">
                  <CheckCircle2 className="w-8 h-8 stroke-[2.5]" />
                </div>
                <h3 className="text-lg font-black text-black">Trip Completed!</h3>
                <p className="text-xs text-slate-700 font-medium">
                  Total distance: {activeRide.distance_km} km • Final Fare:{' '}
                  <span className="font-mono-num font-black text-black">
                    ₹{activeRide.final_fare}
                  </span>
                </p>

                {/* 1-5 Star Rating */}
                <div className="w-full mt-2 p-4 rounded-2xl bg-slate-50 border border-black flex flex-col items-center gap-3">
                  <span className="text-xs font-black text-black">
                    Rate {activeRide.captain_name && activeRide.captain_name !== 'Captain' ? activeRide.captain_name : 'Captain'}
                  </span>
                  <div className="flex items-center gap-2">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        type="button"
                        key={star}
                        onClick={() => setRatingScore(star)}
                        className="p-1 cursor-pointer transition-transform hover:scale-110"
                      >
                        <Star
                          className={`w-7 h-7 ${
                            star <= ratingScore
                              ? 'fill-black text-black'
                              : 'text-slate-300'
                          }`}
                        />
                      </button>
                    ))}
                  </div>

                  <input
                    type="text"
                    value={reviewText}
                    onChange={(e) => setReviewText(e.target.value)}
                    placeholder="Leave a quick note (e.g. smooth ride, on time)"
                    className="w-full px-3 py-2 text-xs rounded-xl bg-white border border-black text-black placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-black font-medium"
                  />

                  <button
                    type="button"
                    onClick={handleRateRide}
                    disabled={ratingSubmitted}
                    className="w-full py-2.5 rounded-xl bg-black hover:bg-slate-800 text-white font-black text-xs shadow-md transition-all active:scale-95 cursor-pointer disabled:opacity-50 border border-black"
                  >
                    {ratingSubmitted ? 'Submitted!' : 'Submit Rating & Done'}
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Standard Ride Booking Form - White Theme with Black Text, Icons and Dark Black Outlines */
          <div className="bg-white border-2 border-black rounded-3xl p-4 sm:p-5 flex flex-col gap-3.5 shadow-2xl text-black">
            {/* Header with Motoride Booking Title and Dropdown Collapse Button */}
            <div className="flex items-center justify-between pb-2 border-b border-black/20">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-black animate-pulse" />
                <h2 className="text-sm sm:text-base font-black text-black tracking-tight">
                  Motoride Booking
                </h2>
              </div>

              {/* Dropdown Button */}
              <button
                type="button"
                onClick={() => setIsCardMinimized(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-black border border-black text-xs font-bold transition-all active:scale-95 cursor-pointer group shadow-xs"
                title="Drop down booking form to see full map"
              >
                <span>Drop Down</span>
                <ChevronDown className="w-4 h-4 text-black group-hover:translate-y-0.5 transition-transform stroke-[2.5]" />
              </button>
            </div>

            {/* Service / Ride Type Selector - Show on Top of Booking Page */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-black text-black tracking-wider">Choose Service</label>
              <div className="grid grid-cols-2 gap-2 bg-slate-100 p-2 rounded-2xl border border-black">
                {[
                  { type: 'bike' as RideTypeCode, label: 'Bike', icon: Bike },
                  { type: 'courier' as RideTypeCode, label: 'Courier', icon: Package },
                ].map((s) => {
                  const Icon = s.icon;
                  const isSelected = rideType === s.type;
                  return (
                    <button
                      key={s.type}
                      type="button"
                      onClick={() => setRideType(s.type)}
                      className={`flex flex-col items-center justify-center py-3 px-2 rounded-xl transition-all cursor-pointer active:scale-95 ${
                        isSelected
                          ? 'bg-black text-white ring-2 ring-emerald-400 shadow-lg scale-105'
                          : 'bg-black/90 text-white hover:bg-black'
                      }`}
                      title={s.label}
                    >
                      <Icon className="w-6 h-6 text-white stroke-[2.5]" />
                      <span className="text-[11px] font-bold text-white mt-1">{s.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Location Permission Denied / Error Banner */}
            {gpsErrorMessage && (
              <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-300 text-rose-800 text-xs flex items-center justify-between gap-3 shadow-sm">
                <div className="flex items-center gap-2.5 min-w-0">
                  <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
                  <span className="font-semibold text-xs leading-snug">{gpsErrorMessage}</span>
                </div>
                <button
                  type="button"
                  onClick={startWatchingLocation}
                  className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shrink-0 active:scale-95 transition-all cursor-pointer shadow"
                >
                  Allow Access
                </button>
              </div>
            )}

            {/* Pickup Location Field (Preset Dropdown or Manual Text Typing) */}
            <div className="flex flex-col gap-1.5 relative">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-black text-black tracking-wider">
                  Pickup Location (A)
                </label>
                <button
                  type="button"
                  onClick={() => {
                    if (pickupMode === 'preset') {
                      setPickupMode('manual');
                      setPickupInputText(pickup.name || '');
                      setShowPickupSuggestions(true);
                    } else {
                      setPickupMode('preset');
                      setShowPickupSuggestions(false);
                    }
                  }}
                  className="flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-black border border-black transition-colors cursor-pointer"
                >
                  {pickupMode === 'preset' ? (
                    <>
                      <PenLine className="w-3 h-3 text-black" />
                      <span className="text-black">Write Manually</span>
                    </>
                  ) : (
                    <>
                      <List className="w-3 h-3 text-black" />
                      <span className="text-black">Select Preset</span>
                    </>
                  )}
                </button>
              </div>

              {pickupMode === 'preset' ? (
                <div className="relative flex items-center">
                  <select
                    value={pickup.name}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === '__MANUAL_WRITE__') {
                        setPickupMode('manual');
                        setPickupInputText(pickup.name || '');
                        setShowPickupSuggestions(true);
                        return;
                      }
                      if (val === 'My Live GPS Location') {
                        handleSetPickupFromPassengerPosition();
                        requestLiveLocation();
                        return;
                      }
                      const found = PRESET_LOCATIONS.find((l) => l.name === val);
                      if (found) {
                        setPickup(found);
                      }
                    }}
                    className="w-full pl-9 pr-16 py-2.5 rounded-xl bg-slate-50 border border-black text-xs text-black font-semibold focus:outline-none focus:ring-2 focus:ring-black appearance-none cursor-pointer hover:bg-slate-100 transition-colors shadow-xs"
                  >
                    <option value="" disabled className="bg-white text-slate-500">
                      📍 Select Pickup Location
                    </option>
                    <option value="My Live GPS Location" className="bg-white text-emerald-700 font-bold">
                      🎯 My Live GPS Location (Current Position)
                    </option>
                    {PRESET_LOCATIONS.map((loc) => (
                      <option key={loc.name} value={loc.name} className="bg-white text-black">
                        {loc.name}
                      </option>
                    ))}
                    <option value="__MANUAL_WRITE__" className="bg-white text-blue-700 font-bold">
                      ✍️ Type Custom Address Manually...
                    </option>
                  </select>
                  <MapPin className="w-4 h-4 text-black absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none stroke-[2.5]" />
                  
                  {/* Right Corner: Clear Cross Sign & Dropdown Indicator */}
                  <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1.5 z-10">
                    {pickup.name ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setPickup({ name: '', lat: 30.704649, lng: 76.717873 });
                          setPickupInputText('');
                        }}
                        title="Cancel / Clear pickup location"
                        aria-label="Cancel pickup location"
                        className="p-1 rounded-md bg-slate-200 hover:bg-slate-300 text-black border border-black transition-all cursor-pointer flex items-center justify-center active:scale-95 shadow-xs"
                      >
                        <X className="w-3.5 h-3.5 stroke-[2.5]" />
                      </button>
                    ) : null}
                    <ChevronDown className="w-4 h-4 text-black pointer-events-none stroke-[2.5]" />
                  </div>
                </div>
              ) : (
                <div className="relative flex flex-col">
                  <div className="relative flex items-center">
                    <input
                      type="text"
                      value={pickupInputText}
                      onChange={(e) => handleManualPickupChange(e.target.value)}
                      onFocus={() => setShowPickupSuggestions(true)}
                      placeholder="Type custom pickup location or landmark..."
                      className="w-full pl-9 pr-16 py-2.5 rounded-xl bg-slate-50 border border-black text-xs text-black placeholder-slate-500 font-semibold focus:outline-none focus:ring-2 focus:ring-black shadow-xs"
                    />
                    <MapPin className="w-4 h-4 text-black absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none stroke-[2.5]" />

                    <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1.5 z-10">
                      {isSearchingPickup && (
                        <Loader2 className="w-3.5 h-3.5 text-black animate-spin" />
                      )}
                      {pickupInputText ? (
                        <button
                          type="button"
                          onClick={() => {
                            setPickupInputText('');
                            setPickup({ name: '', lat: 30.704649, lng: 76.717873 });
                            setPickupSuggestions([]);
                          }}
                          title="Clear pickup text"
                          className="p-1 rounded-md bg-slate-200 hover:bg-slate-300 text-black border border-black transition-all cursor-pointer flex items-center justify-center active:scale-95"
                        >
                          <X className="w-3.5 h-3.5 stroke-[2.5]" />
                        </button>
                      ) : null}
                    </div>
                  </div>

                  {/* Suggestions Popover */}
                  {showPickupSuggestions && pickupSuggestions.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-1 z-50 bg-white border border-black rounded-xl shadow-2xl overflow-hidden max-h-48 overflow-y-auto">
                      <div className="px-2.5 py-1 text-[10px] uppercase font-bold text-slate-700 bg-slate-100 border-b border-black flex items-center justify-between">
                        <span>Matching Places</span>
                        <span className="text-black font-bold">Click to select</span>
                      </div>
                      {pickupSuggestions.map((item, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => handleSelectPickupSuggestion(item)}
                          className="w-full px-3 py-2 text-left text-xs text-slate-800 hover:bg-slate-100 hover:text-black flex items-center gap-2 border-b border-slate-200 last:border-0 transition-colors cursor-pointer"
                        >
                          <MapPin className="w-3.5 h-3.5 text-black shrink-0" />
                          <span className="truncate font-medium">{item.name}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Dropoff Location Field (Preset Dropdown or Manual Text Typing) */}
            <div className="flex flex-col gap-1.5 relative">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-black text-black tracking-wider">
                  Drop-off Location (B)
                </label>
                <button
                  type="button"
                  onClick={() => {
                    if (dropoffMode === 'preset') {
                      setDropoffMode('manual');
                      setDropoffInputText(dropoff.name || '');
                      setShowDropoffSuggestions(true);
                    } else {
                      setDropoffMode('preset');
                      setShowDropoffSuggestions(false);
                    }
                  }}
                  className="flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-black border border-black transition-colors cursor-pointer"
                >
                  {dropoffMode === 'preset' ? (
                    <>
                      <PenLine className="w-3 h-3 text-black" />
                      <span className="text-black">Write Manually</span>
                    </>
                  ) : (
                    <>
                      <List className="w-3 h-3 text-black" />
                      <span className="text-black">Select Preset</span>
                    </>
                  )}
                </button>
              </div>

              {dropoffMode === 'preset' ? (
                <div className="relative flex items-center">
                  <select
                    value={dropoff.name}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === '__MANUAL_WRITE__') {
                        setDropoffMode('manual');
                        setDropoffInputText(dropoff.name || '');
                        setShowDropoffSuggestions(true);
                        return;
                      }
                      const found = PRESET_LOCATIONS.find((l) => l.name === val);
                      if (found) setDropoff(found);
                    }}
                    className="w-full pl-9 pr-16 py-2.5 rounded-xl bg-slate-50 border border-black text-xs text-black font-semibold focus:outline-none focus:ring-2 focus:ring-black appearance-none cursor-pointer hover:bg-slate-100 transition-colors shadow-xs"
                  >
                    <option value="" disabled className="bg-white text-slate-500">
                      Select Dropoff Location
                    </option>
                    {PRESET_LOCATIONS.map((loc) => (
                      <option key={loc.name} value={loc.name} className="bg-white text-black">
                        {loc.name}
                      </option>
                    ))}
                    <option value="__MANUAL_WRITE__" className="bg-white text-blue-700 font-bold">
                      ✍️ Type Custom Address Manually...
                    </option>
                  </select>
                  <Navigation className="w-4 h-4 text-black absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none stroke-[2.5]" />

                  {/* Right Corner: Clear Cross Sign & Dropdown Indicator */}
                  <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1.5 z-10">
                    {dropoff.name ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDropoff({ name: '', lat: 30.718214, lng: 76.732124 });
                          setDropoffInputText('');
                        }}
                        title="Cancel / Clear dropoff location"
                        aria-label="Cancel dropoff location"
                        className="p-1 rounded-md bg-slate-200 hover:bg-slate-300 text-black border border-black transition-all cursor-pointer flex items-center justify-center active:scale-95 shadow-xs"
                      >
                        <X className="w-3.5 h-3.5 stroke-[2.5]" />
                      </button>
                    ) : null}
                    <ChevronDown className="w-4 h-4 text-black pointer-events-none stroke-[2.5]" />
                  </div>
                </div>
              ) : (
                <div className="relative flex flex-col">
                  <div className="relative flex items-center">
                    <input
                      type="text"
                      value={dropoffInputText}
                      onChange={(e) => handleManualDropoffChange(e.target.value)}
                      onFocus={() => setShowDropoffSuggestions(true)}
                      placeholder="Type custom drop-off destination or landmark..."
                      className="w-full pl-9 pr-16 py-2.5 rounded-xl bg-slate-50 border border-black text-xs text-black placeholder-slate-500 font-semibold focus:outline-none focus:ring-2 focus:ring-black shadow-xs"
                    />
                    <Navigation className="w-4 h-4 text-black absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none stroke-[2.5]" />

                    <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1.5 z-10">
                      {isSearchingDropoff && (
                        <Loader2 className="w-3.5 h-3.5 text-black animate-spin" />
                      )}
                      {dropoffInputText ? (
                        <button
                          type="button"
                          onClick={() => {
                            setDropoffInputText('');
                            setDropoff({ name: '', lat: 30.718214, lng: 76.732124 });
                            setDropoffSuggestions([]);
                          }}
                          title="Clear dropoff text"
                          className="p-1 rounded-md bg-slate-200 hover:bg-slate-300 text-black border border-black transition-all cursor-pointer flex items-center justify-center active:scale-95"
                        >
                          <X className="w-3.5 h-3.5 stroke-[2.5]" />
                        </button>
                      ) : null}
                    </div>
                  </div>

                  {/* Suggestions Popover */}
                  {showDropoffSuggestions && dropoffSuggestions.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-1 z-50 bg-white border border-black rounded-xl shadow-2xl overflow-hidden max-h-48 overflow-y-auto">
                      <div className="px-2.5 py-1 text-[10px] uppercase font-bold text-slate-700 bg-slate-100 border-b border-black flex items-center justify-between">
                        <span>Matching Places</span>
                        <span className="text-black font-bold">Click to select</span>
                      </div>
                      {dropoffSuggestions.map((item, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => handleSelectDropoffSuggestion(item)}
                          className="w-full px-3 py-2 text-left text-xs text-slate-800 hover:bg-slate-100 hover:text-black flex items-center gap-2 border-b border-slate-200 last:border-0 transition-colors cursor-pointer"
                        >
                          <Navigation className="w-3.5 h-3.5 text-black shrink-0" />
                          <span className="truncate font-medium">{item.name}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Fare & Payment Control Card */}
            <div className="p-3.5 sm:p-4 rounded-2xl bg-slate-50 border border-black flex flex-col gap-3 shadow-xs">
              {/* Fare Stepper: (-) Fare ₹ 0 (+) comment box icon */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setOfferedFare((prev) => Math.max(estimatedFare, prev - 5))}
                  disabled={!hasSelectedLocations || offeredFare <= estimatedFare}
                  className={`w-10 h-10 shrink-0 rounded-xl border border-black font-black text-xl flex items-center justify-center transition-all shadow-xs ${
                    !hasSelectedLocations || offeredFare <= estimatedFare
                      ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                      : 'bg-white text-black hover:bg-slate-100 cursor-pointer active:scale-95'
                  }`}
                  title={
                    !hasSelectedLocations
                      ? 'Select pickup & dropoff to set fare'
                      : offeredFare <= estimatedFare
                      ? `Cannot reduce below standard admin fare rate (₹${estimatedFare})`
                      : 'Decrease Fare'
                  }
                  aria-label="Decrease Fare"
                >
                  -
                </button>

                {/* Center: Fare ₹ 0 */}
                <div className="flex-1 min-w-0 flex items-center justify-center gap-1.5 bg-white rounded-xl border border-black hover:bg-slate-50 px-3 py-2 transition-all shadow-xs">
                  <span className="text-black text-xs sm:text-sm font-bold whitespace-nowrap select-none">
                    Fare
                  </span>
                  <span className="text-black font-mono-num font-black text-base">₹</span>
                  <input
                    type="number"
                    min={estimatedFare}
                    disabled={!hasSelectedLocations}
                    value={offeredFare}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setOfferedFare(Math.max(estimatedFare, isNaN(val) ? estimatedFare : val));
                    }}
                    className="w-14 sm:w-18 text-left font-mono-num font-black text-base sm:text-lg text-black bg-transparent focus:outline-none disabled:opacity-75"
                  />
                </div>

                <button
                  type="button"
                  onClick={() => setOfferedFare((prev) => prev + 5)}
                  disabled={!hasSelectedLocations}
                  className={`w-10 h-10 shrink-0 rounded-xl border border-black font-black text-xl flex items-center justify-center active:scale-95 transition-all shadow-xs ${
                    !hasSelectedLocations
                      ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                      : 'bg-white text-black hover:bg-slate-100 cursor-pointer'
                  }`}
                  title={!hasSelectedLocations ? 'Select pickup & dropoff to set fare' : 'Increase Fare'}
                  aria-label="Increase Fare"
                >
                  +
                </button>

                {/* Comment Box Icon */}
                <button
                  type="button"
                  onClick={() => setShowCommentInput((prev) => !prev)}
                  className={`w-10 h-10 shrink-0 rounded-xl border border-black cursor-pointer flex items-center justify-center active:scale-95 transition-all relative ${
                    rideComment.trim() || showCommentInput
                      ? 'bg-black text-white shadow-xs'
                      : 'bg-white text-black hover:bg-slate-100'
                  }`}
                  title="Add comment / instruction for captain"
                  aria-label="Add comment for captain"
                >
                  <MessageSquare className="w-4 h-4 stroke-[2.5]" />
                  {rideComment.trim() && (
                    <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-emerald-500 ring-2 ring-white" />
                  )}
                </button>
              </div>

              {/* Expandable Comment Box Input */}
              {showCommentInput && (
                <div className="relative animate-in fade-in slide-in-from-top-1 duration-150">
                  <input
                    type="text"
                    value={rideComment}
                    onChange={(e) => setRideComment(e.target.value)}
                    placeholder="Note for captain (e.g. Near gate 2, 2 bags, etc.)"
                    className="w-full pl-3 pr-8 py-2 rounded-xl bg-white border border-black text-xs text-black placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-black shadow-xs font-medium"
                    autoFocus
                  />
                  {rideComment && (
                    <button
                      type="button"
                      onClick={() => setRideComment('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-black text-xs cursor-pointer font-bold"
                    >
                      ✕
                    </button>
                  )}
                </div>
              )}

              {/* Pay Via: upi | cash */}
              <div className="flex items-center justify-between pt-2 border-t border-black/20 text-xs">
                <span className="text-black font-black tracking-wide">Pay Via:</span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('upi')}
                    className={`px-4 py-1.5 rounded-xl font-black uppercase tracking-wider text-xs cursor-pointer transition-all border border-black ${
                      paymentMethod === 'upi'
                        ? 'bg-black text-white shadow-md font-black ring-1 ring-black'
                        : 'bg-white text-black hover:bg-slate-100 font-bold'
                    }`}
                  >
                    upi
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('cash')}
                    className={`px-4 py-1.5 rounded-xl font-black lowercase tracking-wider text-xs cursor-pointer transition-all border border-black ${
                      paymentMethod === 'cash'
                        ? 'bg-black text-white shadow-md font-black ring-1 ring-black'
                        : 'bg-white text-black hover:bg-slate-100 font-bold'
                    }`}
                  >
                    cash
                  </button>
                </div>
              </div>
            </div>

            {/* Book Button */}
            <button
              type="button"
              onClick={handleBookRide}
              disabled={isBooking || offeredFare <= 0 || !hasSelectedLocations}
              className={`w-full py-3.5 rounded-2xl font-black text-sm transition-all active:scale-[0.98] flex items-center justify-center gap-2 border-2 ${
                isBooking || offeredFare <= 0 || !hasSelectedLocations
                  ? 'bg-slate-200 text-slate-400 border-slate-300 cursor-not-allowed shadow-none'
                  : 'bg-black hover:bg-slate-900 text-white border-black cursor-pointer shadow-xl'
              }`}
              title={
                offeredFare <= 0 || !hasSelectedLocations
                  ? 'Please select valid pickup and drop-off locations to calculate fare'
                  : 'Find Captain'
              }
            >
              <Send
                className={`w-4 h-4 stroke-[2.5] ${
                  isBooking || offeredFare <= 0 || !hasSelectedLocations ? 'text-slate-400' : 'text-white'
                }`}
              />
              <span>
                {isBooking
                  ? 'Broadcasting Offer...'
                  : `Find Captain for ₹${offeredFare !== undefined ? offeredFare : 0}`}
              </span>
            </button>
          </div>
        )}
    </div>
  );

  return (
    <div className="relative w-full h-[calc(100dvh-64px)] sm:h-[calc(100vh-68px)] overflow-hidden bg-slate-100">
      {/* Background Map in Street View filling 100% of the canvas */}
      <div className="absolute inset-0 w-full h-full z-0">
        {renderMap(true)}
      </div>

      {/* Floating Instant Toast for Pickup Set via Passenger Icon Click */}
      {showPickupToast && (
        <div className="fixed sm:absolute top-16 sm:top-20 left-1/2 -translate-x-1/2 z-[1100] max-w-sm px-4 py-2.5 rounded-2xl bg-slate-950/95 border border-emerald-500/80 shadow-2xl backdrop-blur-xl text-white text-xs font-bold flex items-center gap-2.5 animate-in fade-in slide-in-from-top-3 duration-200">
          <div className="w-5 h-5 rounded-full bg-emerald-500 text-slate-950 flex items-center justify-center font-black text-xs shrink-0 shadow-sm">
            ✓
          </div>
          <span className="text-emerald-300 font-bold">{pickupToastMessage}</span>
        </div>
      )}

      {/* Passenger Profile 2-Lines Button in Left Top Corner */}
      <button
        type="button"
        onClick={() => setIsProfileOpen(true)}
        title="Open Passenger Profile"
        aria-label="Open Passenger Profile"
        className="fixed sm:absolute top-3 sm:top-4 left-3 sm:left-4 z-[900] p-2.5 sm:p-3 rounded-2xl bg-black/85 hover:bg-black text-white border border-white/20 shadow-2xl backdrop-blur-xl flex flex-col justify-center items-center gap-1.5 w-11 h-11 active:scale-95 transition-all cursor-pointer group"
      >
        <span className="w-5 h-0.5 bg-white rounded-full group-hover:w-5.5 transition-all" />
        <span className="w-3.5 h-0.5 bg-white rounded-full self-start ml-0.5 group-hover:w-5 transition-all" />
      </button>

      {/* Passenger Profile Slide-in Drawer from Left to Right */}
      <PassengerProfileDrawer
        isOpen={isProfileOpen}
        onClose={() => setIsProfileOpen(false)}
        currentUser={currentUser || authUser}
        passengerName={effectivePassengerName}
        passengerEmail={currentUser?.email || authUser?.email}
        passengerPhone={currentUser?.phone || authUser?.phone}
        totalRides={rideHistory.filter((r) => r.status === 'trip_completed' || r.status === 'completed').length}
        onOpenWallet={onOpenWallet}
        onOpenRideHistory={() => setIsRideHistoryOpen(true)}
        onSignOut={onSignOut}
        onSelectSavedLocation={(loc) => {
          setDropoff(loc);
        }}
      />

      {/* Ride History Modal for Passenger */}
      <MotorideRideHistoryModal
        isOpen={isRideHistoryOpen}
        onClose={() => setIsRideHistoryOpen(false)}
        role="passenger"
        userId={currentPassengerId || currentUser?.id || authUser?.id || ''}
        userName={effectivePassengerName}
        onBookNewRide={() => {
          setIsRideHistoryOpen(false);
          setIsCardMinimized(false);
        }}
      />

      {/* Bottom / Sidebar Booking Form & Active Trip Card Controls */}
      {isCardMinimized ? (
        /* Minimized Floating Bar (Drop Down Condition) */
        <div className="fixed sm:absolute bottom-3 sm:bottom-4 md:bottom-6 left-1/2 -translate-x-1/2 md:left-6 md:translate-x-0 z-[1000] w-[calc(100%-1.25rem)] sm:w-[460px] md:w-[420px] animate-in fade-in slide-in-from-bottom-3 duration-200">
          <div
            onClick={() => setIsCardMinimized(false)}
            className="p-3 sm:p-3.5 rounded-3xl bg-slate-950 border border-slate-800 shadow-2xl flex items-center justify-between gap-3 hover:border-slate-700 transition-all cursor-pointer"
          >
            <div className="flex items-center gap-3 min-w-0 pr-2 flex-1">
              {activeRide?.captain_name ? (
                <div className="relative shrink-0">
                  <img
                    src={getCaptainAvatarUrl(activeRide.captain_name || undefined, (activeRide as any).captain_avatar || (activeRide as any).avatar_url)}
                    alt={activeRide.captain_name}
                    className="w-10 h-10 rounded-2xl object-cover border-2 border-emerald-400 bg-slate-200 shadow-md"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).src =
                        `https://ui-avatars.com/api/?name=${encodeURIComponent(activeRide.captain_name || 'Captain')}&background=0284c7&color=fff&bold=true`;
                    }}
                  />
                  <span className="absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full bg-emerald-500 border border-slate-950 flex items-center justify-center text-[8px] text-black font-black">
                    ✓
                  </span>
                </div>
              ) : (
                <div className="w-10 h-10 rounded-2xl bg-emerald-500 text-slate-950 flex items-center justify-center font-black text-lg shadow-md shrink-0">
                  🏍️
                </div>
              )}
              <div className="min-w-0 flex flex-col">
                <span className="text-xs font-bold text-white truncate">
                  {activeRide
                    ? `${activeRide.ride_code} • ${activeRide.status.replace(/_/g, ' ')}`
                    : `${pickup.name ? pickup.name.split(',')[0] : 'Choose Pickup'} → ${dropoff.name.split(',')[0]}`}
                </span>
                <span className="text-[11px] text-emerald-400 font-mono-num font-semibold truncate">
                  {activeRide
                    ? activeRide.captain_name
                      ? `${activeRide.captain_name} (${activeRide.vehicle_model || 'Bike'}) • ₹${activeRide.final_fare || activeRide.offered_fare}`
                      : `Fare: ₹${activeRide.final_fare || activeRide.offered_fare} • Searching Captains...`
                    : `₹${offeredFare} • ${rideType.toUpperCase()} (Tap to expand booking)`}
                </span>
              </div>
            </div>

            {/* Dropdown / Pull-up Expand Button */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsCardMinimized(false);
              }}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs shadow-lg shadow-emerald-500/20 active:scale-95 cursor-pointer transition-all shrink-0"
              title={activeRide ? 'Expand Active Ride Details' : 'Open booking form'}
            >
              <span>{activeRide ? 'Expand Ride' : 'Book Ride'}</span>
              <ChevronUp className="w-4 h-4 stroke-[3]" />
            </button>
          </div>
        </div>
      ) : (
        /* Expanded Booking Form */
        <div className="fixed sm:absolute bottom-3 sm:bottom-4 md:bottom-6 left-1/2 -translate-x-1/2 md:left-6 md:translate-x-0 z-[1000] w-[calc(100%-1.25rem)] sm:w-[480px] md:w-[440px] max-h-[82dvh] sm:max-h-[calc(100vh-90px)] overflow-y-auto flex flex-col gap-2 pb-1 scrollbar-thin animate-in fade-in slide-in-from-bottom-4 duration-200">
          {renderControlPanel()}
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
              currentUserId={currentPassengerId}
              currentUserRole="passenger"
              currentUserName={passengerName}
              onClose={() => setShowChatModal(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
};
