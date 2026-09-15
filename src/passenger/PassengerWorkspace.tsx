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
import { motorideApi } from '../services/motorideApi';
import { realtimeSync } from '../services/realtimeSync';
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
} from 'lucide-react';

interface PassengerWorkspaceProps {
  currentPassengerId?: string;
  passengerName?: string;
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
  currentPassengerId = 'psg_hemant_01',
  passengerName = 'Hemant Kashyap',
  onOpenWallet,
  onSignOut,
}) => {
  // Active Ride State
  const [activeRide, setActiveRide] = useState<MotorideRide | null>(null);
  const [rideHistory, setRideHistory] = useState<MotorideRide[]>([]);
  const [activeTab, setActiveTab] = useState<'book' | 'history'>('book');
  const [viewMode, setViewMode] = useState<'background' | 'split'>('background');
  const [isCardMinimized, setIsCardMinimized] = useState<boolean>(false);
  const [isProfileOpen, setIsProfileOpen] = useState<boolean>(false);
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
      const saved = localStorage.getItem('motoride_last_passenger_gps');
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
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=5&addressdetails=1`
        );
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data) && data.length > 0) {
            setPickupSuggestions(
              data.map((item: any) => ({
                name: item.display_name.split(',').slice(0, 3).join(', ').trim(),
                lat: parseFloat(item.lat),
                lng: parseFloat(item.lon),
              }))
            );
          } else {
            setPickupSuggestions([]);
          }
        }
      } catch (err) {
        console.warn('Pickup geocoding search failed:', err);
      } finally {
        setIsSearchingPickup(false);
      }
    }, 350);
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
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=5&addressdetails=1`
        );
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data) && data.length > 0) {
            setDropoffSuggestions(
              data.map((item: any) => ({
                name: item.display_name.split(',').slice(0, 3).join(', ').trim(),
                lat: parseFloat(item.lat),
                lng: parseFloat(item.lon),
              }))
            );
          } else {
            setDropoffSuggestions([]);
          }
        }
      } catch (err) {
        console.warn('Dropoff geocoding search failed:', err);
      } finally {
        setIsSearchingDropoff(false);
      }
    }, 350);
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
  const [fareSettings, setFareSettings] = useState<FareSettings>({
    base_fare: 25,
    per_km_rate: 12,
    minimum_fare: 30,
    platform_commission_pct: 10,
    min_offer_pct: 70,
    max_offer_pct: 180,
    currency_symbol: '₹',
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

  // Multiplier by ride type
  const typeMultiplier = {
    bike: 1.0,
    auto: 1.25,
    car: 1.8,
    courier: 1.15,
  }[rideType];

  const estimatedFare = hasSelectedLocations
    ? Math.max(
        fareSettings.minimum_fare,
        Math.round((fareSettings.base_fare + distanceKm * fareSettings.per_km_rate) * typeMultiplier)
      )
    : 0;

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
      localStorage.setItem(
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

    // 1. Initial immediate request with high accuracy, falling back to standard WiFi/IP accuracy if GPS times out
    navigator.geolocation.getCurrentPosition(
      (pos) => handlePositionSuccess(pos),
      (err) => {
        if (err.code === 2 || err.code === 3) {
          navigator.geolocation.getCurrentPosition(
            (fallbackPos) => handlePositionSuccess(fallbackPos),
            (fallbackErr) => handlePositionError(fallbackErr),
            { enableHighAccuracy: false, timeout: 8000, maximumAge: 30000 }
          );
        } else {
          handlePositionError(err);
        }
      },
      { enableHighAccuracy: true, timeout: 5000, maximumAge: 10000 }
    );

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
          setActiveRide(ride);
        }
        loadRideHistory();
      }
    });

    const unsubAccepted = realtimeSync.on('RIDE_ACCEPTED', (ride: MotorideRide) => {
      if (ride.passenger_id === currentPassengerId) {
        if (ride.status.includes('cancelled')) {
          setActiveRide(null);
        } else {
          setActiveRide(ride);
        }
      }
    });

    const unsubLocation = realtimeSync.on('CAPTAIN_LOCATION_UPDATED', (payload) => {
      setActiveRide((prev) => {
        if (prev && prev.id === payload.ride_id) {
          return {
            ...prev,
            captain_current_lat: payload.lat,
            captain_current_lng: payload.lng,
          };
        }
        return prev;
      });

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

    return () => {
      unsubUpdate();
      unsubAccepted();
      unsubLocation();
      unsubOffer();
    };
  }, [currentPassengerId]);

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
        setActiveRide(active);
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
    const activePickup = pickup.name?.trim() ? pickup : PRESET_LOCATIONS[0];
    const activeDropoff = dropoff.name?.trim() ? dropoff : PRESET_LOCATIONS[1];

    setIsBooking(true);
    try {
      const calcDistance = distanceKm > 0 ? distanceKm : 3.5;
      const calcDuration = durationMin > 0 ? durationMin : 10;
      const calcFare = offeredFare > 0 ? offeredFare : (estimatedFare > 0 ? estimatedFare : 75);

      const newRide = await motorideApi.createRide({
        passenger_id: currentPassengerId,
        passenger_name: passengerName,
        passenger_phone: '+91 97800 12345',
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
      const updated = await motorideApi.acceptRide(activeRide.id, {
        captain_id: 'cpt_vikram_01',
        captain_name: 'Captain Vikram Singh',
        captain_phone: '+91 98765 43210',
        vehicle_model: 'Honda Activa 6G',
        plate_number: 'PB65AA1257',
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

  const renderMap = (isFullBackground: boolean) => (
    <MotorideMap
      passengerLat={passengerGps.lat}
      passengerLng={passengerGps.lng}
      passengerAccuracy={passengerGps.accuracy}
      passengerHeading={passengerGps.heading}
      passengerName="Standing Here"
      showPassengerOnly={false}
      nearbyCaptains={nearbyCaptains}
      nearestCaptain={nearestCaptain}
      showLocationsABOnly={false}
      isLiveGpsActive={gpsStatus === 'live'}
      onLocateMe={requestLiveLocation}
      pickupLat={pickup.name ? pickup.lat : null}
      pickupLng={pickup.name ? pickup.lng : null}
      pickupAddress={pickup.name}
      dropoffLat={dropoff.name ? dropoff.lat : null}
      dropoffLng={dropoff.name ? dropoff.lng : null}
      dropoffAddress={dropoff.name}
      captainLat={activeRide?.captain_id ? activeRide.captain_current_lat : null}
      captainLng={activeRide?.captain_id ? activeRide.captain_current_lng : null}
      captainHeading={activeRide?.captain_heading || 45}
      interactive={!activeRide}
      onSetPickupToPassengerLocation={(lat, lng) => handleSetPickupFromPassengerPosition(lat, lng)}
      onMapClick={(lat, lng) => {
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

  const renderControlPanel = () => (
    <div className="flex flex-col gap-4">
      {activeRide ? (
          /* Active Ride Cards */
          <div className="bg-slate-900/95 border border-slate-800 rounded-3xl p-5 flex flex-col gap-4 shadow-xl">
            {/* Status Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div>
                <span className="text-[11px] font-mono-num font-bold text-emerald-400 block">
                  {activeRide.ride_code}
                </span>
                <h2 className="text-base font-extrabold text-white capitalize">
                  {activeRide.status.replace(/_/g, ' ')}
                </h2>
              </div>
              <div className="w-9 h-9 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
                <Bike className="w-5 h-5 text-emerald-400" />
              </div>
            </div>

            {/* Passenger Live GPS Sharing Status in Active Ride */}
            {gpsErrorMessage ? (
              <div className="p-3 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span className="font-semibold">{gpsErrorMessage}</span>
                </div>
                <button
                  type="button"
                  onClick={startWatchingLocation}
                  className="px-2.5 py-1 rounded-xl bg-rose-500 hover:bg-rose-400 text-white font-bold text-xs shrink-0 active:scale-95 cursor-pointer shadow"
                >
                  Enable GPS
                </button>
              </div>
            ) : (
              <div className="px-3 py-2 rounded-2xl bg-slate-950 border border-slate-800/90 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <div className="relative flex items-center justify-center w-2.5 h-2.5">
                    <span className="absolute w-full h-full rounded-full bg-emerald-400 animate-ping opacity-75" />
                    <span className="relative w-2 h-2 rounded-full bg-emerald-500" />
                  </div>
                  <span className="text-slate-300 font-semibold">Live GPS Sharing:</span>
                  <span className="text-emerald-400 font-bold">Active</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-slate-400 font-mono-num">
                    {passengerGps.accuracy ? `±${Math.round(passengerGps.accuracy)}m` : 'High Precision'}
                  </span>
                  {nowTick - passengerGps.timestamp > 30000 && (
                    <span className="text-[10px] text-amber-400 bg-amber-400/10 px-1.5 py-0.5 rounded border border-amber-500/30 font-bold">
                      Stale (&gt;30s)
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Case 1: Searching Nearby Captains Radar */}
            {(activeRide.status === 'requested' || activeRide.status === 'captain_offered') && (
              <div className="flex flex-col items-center justify-center py-6 text-center">
                <div className="relative flex items-center justify-center w-28 h-28 my-2">
                  <div className="absolute inset-0 rounded-full bg-emerald-500/15 animate-ping" />
                  <div className="absolute w-20 h-20 rounded-full bg-emerald-500/20 animate-pulse" />
                  <div className="w-14 h-14 rounded-full bg-emerald-500 flex items-center justify-center text-slate-950 font-black shadow-lg">
                    <Bike className="w-7 h-7 stroke-[2.5]" />
                  </div>
                </div>
                <h3 className="text-sm font-bold text-slate-100 mt-2">
                  Radar Active • Contacting Captains
                </h3>
                <p className="text-xs text-slate-400 max-w-xs mt-1">
                  Broadcasting your offer of{' '}
                  <span className="text-emerald-400 font-bold font-mono-num">
                    ₹{activeRide.offered_fare}
                  </span>{' '}
                  to all nearby active captains in real time.
                </p>

                {/* Incoming Counter Offers from Captains */}
                {activeRide.offers && activeRide.offers.length > 0 && (
                  <div className="w-full mt-5 flex flex-col gap-2.5 text-left">
                    <h4 className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Incoming Captain Offers ({activeRide.offers.length})</span>
                    </h4>
                    {activeRide.offers.map((offer) => (
                      <div
                        key={offer.id}
                        className="p-3 rounded-2xl bg-slate-950 border border-amber-500/30 flex items-center justify-between gap-3 shadow-md"
                      >
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-sm text-white">{offer.captain_name}</span>
                            <span className="flex items-center text-[10px] text-amber-400 bg-amber-400/10 px-1.5 py-0.5 rounded">
                              <Star className="w-3 h-3 fill-amber-400 mr-0.5" />
                              {offer.rating}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            {offer.vehicle_model} • {offer.plate_number}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-extrabold text-emerald-400 font-mono-num">
                            ₹{offer.counter_fare}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleAcceptOffer(offer.id)}
                            className="px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs shadow-md transition-all active:scale-95 cursor-pointer"
                          >
                            Accept
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Instant Demo Match and Cancel Buttons */}
                <div className="w-full mt-5 flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={handleSimulateInstantAccept}
                    className="w-full py-2.5 px-4 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-[0.98] shadow-md"
                  >
                    <Sparkles className="w-4 h-4 text-slate-950 stroke-[2.5]" />
                    <span>Instant Match Captain (Demo)</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleCancelRide}
                    disabled={isCancelling}
                    className="w-full py-2.5 px-4 rounded-2xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/40 text-rose-300 hover:text-rose-200 font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-[0.98] shadow-sm disabled:opacity-50"
                    aria-label="Cancel Ride Request"
                  >
                    <XCircle className="w-4 h-4 text-rose-400 shrink-0" />
                    <span>{isCancelling ? 'Cancelling Request...' : 'Cancel Ride Request'}</span>
                  </button>
                </div>
              </div>
            )}

            {/* Case 2: Captain Accepted / Arrived / Trip Started */}
            {(activeRide.status === 'captain_accepted' ||
              activeRide.status === 'captain_arrived' ||
              activeRide.status === 'trip_started') && (
              <div className="flex flex-col gap-4">
                {/* Captain Details Box */}
                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center font-bold text-amber-400 text-lg">
                      🏍️
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-extrabold text-white text-sm">
                          {activeRide.captain_name || 'Vikram Singh'}
                        </span>
                        <span className="flex items-center text-[10px] text-amber-400 bg-amber-400/10 px-1.5 py-0.5 rounded font-bold">
                          <Star className="w-3 h-3 fill-amber-400 mr-0.5" /> 4.92
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 font-mono-num mt-0.5">
                        {activeRide.vehicle_model || 'Mahindra Centuro'} •{' '}
                        <span className="text-slate-200 font-bold">
                          {activeRide.plate_number || 'PB65AA1257'}
                        </span>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setShowChatModal(true)}
                      className="p-3 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 hover:bg-emerald-500/30 shadow-md transition-all active:scale-95"
                      title="Chat with Captain"
                    >
                      <MessageSquare className="w-4 h-4 stroke-[2.5]" />
                    </button>
                    <a
                      href={`tel:${activeRide.captain_phone || '+919876543210'}`}
                      className="p-3 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold shadow-md transition-all active:scale-95"
                      title="Call Captain"
                    >
                      <Phone className="w-4 h-4 stroke-[2.5]" />
                    </a>
                  </div>
                </div>

                {/* Progress Indicators */}
                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <div
                    className={`p-2 rounded-xl border ${
                      activeRide.status === 'captain_accepted'
                        ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300 font-bold'
                        : 'bg-slate-950 border-slate-800 text-slate-400'
                    }`}
                  >
                    1. En Route
                  </div>
                  <div
                    className={`p-2 rounded-xl border ${
                      activeRide.status === 'captain_arrived'
                        ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300 font-bold'
                        : 'bg-slate-950 border-slate-800 text-slate-400'
                    }`}
                  >
                    2. Arrived
                  </div>
                  <div
                    className={`p-2 rounded-xl border ${
                      activeRide.status === 'trip_started'
                        ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300 font-bold'
                        : 'bg-slate-950 border-slate-800 text-slate-400'
                    }`}
                  >
                    3. Riding
                  </div>
                </div>

                {/* Route Summary */}
                <div className="text-xs text-slate-300 space-y-1.5 p-3 rounded-2xl bg-slate-950/60 border border-slate-800/80">
                  <p className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-400" />
                    <span className="text-slate-400">From:</span>
                    <span className="truncate font-semibold">{activeRide.pickup_address}</span>
                  </p>
                  <p className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-rose-400" />
                    <span className="text-slate-400">To:</span>
                    <span className="truncate font-semibold">{activeRide.dropoff_address}</span>
                  </p>
                </div>

                {/* Fare and payment summary */}
                <div className="flex items-center justify-between p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20">
                  <span className="text-xs text-emerald-300 font-medium">Agreed Fare:</span>
                  <span className="font-mono-num font-extrabold text-base text-emerald-400">
                    ₹{activeRide.final_fare || activeRide.offered_fare}
                  </span>
                </div>

                {/* Chat with Captain Button */}
                <button
                  type="button"
                  onClick={() => setShowChatModal(true)}
                  className="w-full py-2.5 rounded-2xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-md"
                >
                  <MessageSquare className="w-4 h-4 text-emerald-400" />
                  <span>Chat with Captain ({activeRide.captain_name || 'Captain'})</span>
                </button>

                {activeRide.status !== 'trip_started' && (
                  <button
                    type="button"
                    onClick={handleCancelRide}
                    disabled={isCancelling}
                    className="w-full py-2.5 rounded-xl border border-rose-500/40 text-rose-400 hover:bg-rose-500/15 text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition-colors active:scale-[0.98] disabled:opacity-50"
                    aria-label="Cancel Ride"
                  >
                    <XCircle className="w-4 h-4 shrink-0" />
                    <span>{isCancelling ? 'Cancelling...' : 'Cancel Ride'}</span>
                  </button>
                )}
              </div>
            )}

            {/* Case 3: Trip Completed & Rating Form */}
            {activeRide.status === 'trip_completed' && (
              <div className="flex flex-col items-center text-center py-4 gap-3">
                <div className="w-14 h-14 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                  <CheckCircle2 className="w-8 h-8 stroke-[2.5]" />
                </div>
                <h3 className="text-lg font-black text-white">Trip Completed!</h3>
                <p className="text-xs text-slate-400">
                  Total distance: {activeRide.distance_km} km • Final Fare:{' '}
                  <span className="font-mono-num font-bold text-white">
                    ₹{activeRide.final_fare}
                  </span>
                </p>

                {/* 1-5 Star Rating */}
                <div className="w-full mt-2 p-4 rounded-2xl bg-slate-950 border border-slate-800 flex flex-col items-center gap-3">
                  <span className="text-xs font-bold text-slate-200">Rate Captain Vikram</span>
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
                              ? 'fill-amber-400 text-amber-400'
                              : 'text-slate-600'
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
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-900 border border-slate-800 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                  />

                  <button
                    type="button"
                    onClick={handleRateRide}
                    disabled={ratingSubmitted}
                    className="w-full py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs shadow-md transition-all active:scale-95 cursor-pointer disabled:opacity-50"
                  >
                    {ratingSubmitted ? 'Submitted!' : 'Submit Rating & Done'}
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Standard Ride Booking Form - Black Transparent Theme with Pure White Text and Icons */
          <div className="bg-black/85 backdrop-blur-xl border border-white/20 rounded-3xl p-4 sm:p-5 flex flex-col gap-3.5 shadow-2xl text-white">
            {/* Header with Motoride Booking Title and Dropdown Collapse Button */}
            <div className="flex items-center justify-between pb-2 border-b border-white/15">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-white animate-pulse" />
                <h2 className="text-sm sm:text-base font-black text-white tracking-tight">
                  Motoride Booking
                </h2>
              </div>

              {/* Dropdown Button */}
              <button
                type="button"
                onClick={() => setIsCardMinimized(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white border border-white/30 text-xs font-bold transition-all active:scale-95 cursor-pointer group shadow-xs"
                title="Drop down booking form to see full map"
              >
                <span>Drop Down</span>
                <ChevronDown className="w-4 h-4 text-white group-hover:translate-y-0.5 transition-transform stroke-[2.5]" />
              </button>
            </div>

            {/* Service / Ride Type Selector - Show on Top of Booking Page */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-black text-white tracking-wider">Choose Service</label>
              <div className="flex items-center justify-around py-2 px-2 bg-white/10 rounded-2xl border border-white/20">
                <button
                  type="button"
                  onClick={() => setRideType('bike')}
                  className={`p-2.5 rounded-full transition-all cursor-pointer flex items-center justify-center active:scale-95 ${
                    rideType === 'bike'
                      ? 'text-white scale-125 drop-shadow-[0_2px_10px_rgba(255,255,255,0.4)] bg-white/25 ring-2 ring-white'
                      : 'text-white/60 hover:text-white'
                  }`}
                  title="Bike"
                  aria-label="Bike"
                >
                  <Bike className="w-6 h-6 text-white stroke-[2.5]" />
                </button>

                <button
                  type="button"
                  onClick={() => setRideType('auto')}
                  className={`p-2.5 rounded-full transition-all cursor-pointer flex items-center justify-center active:scale-95 ${
                    rideType === 'auto'
                      ? 'scale-125 drop-shadow-[0_2px_10px_rgba(255,255,255,0.4)] bg-white/25 ring-2 ring-white'
                      : 'opacity-60 hover:opacity-100'
                  }`}
                  title="Auto"
                  aria-label="Auto"
                >
                  <span className="text-2xl leading-none">🛺</span>
                </button>

                <button
                  type="button"
                  onClick={() => setRideType('car')}
                  className={`p-2.5 rounded-full transition-all cursor-pointer flex items-center justify-center active:scale-95 ${
                    rideType === 'car'
                      ? 'text-white scale-125 drop-shadow-[0_2px_10px_rgba(255,255,255,0.4)] bg-white/25 ring-2 ring-white'
                      : 'text-white/60 hover:text-white'
                  }`}
                  title="Comfort AC Cab"
                  aria-label="Comfort AC Cab"
                >
                  <Car className="w-6 h-6 text-white stroke-[2.5]" />
                </button>

                <button
                  type="button"
                  onClick={() => setRideType('courier')}
                  className={`p-2.5 rounded-full transition-all cursor-pointer flex items-center justify-center active:scale-95 ${
                    rideType === 'courier'
                      ? 'text-white scale-125 drop-shadow-[0_2px_10px_rgba(255,255,255,0.4)] bg-white/25 ring-2 ring-white'
                      : 'text-white/60 hover:text-white'
                  }`}
                  title="Courier Parcel"
                  aria-label="Courier Parcel"
                >
                  <Package className="w-6 h-6 text-white stroke-[2.5]" />
                </button>
              </div>
            </div>

            {/* Location Permission Denied / Error Banner */}
            {gpsErrorMessage && (
              <div className="p-3.5 rounded-2xl bg-rose-950/80 border border-rose-500/50 text-rose-200 text-xs flex items-center justify-between gap-3 shadow-sm">
                <div className="flex items-center gap-2.5 min-w-0">
                  <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
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
                <label className="text-[11px] font-black text-white/90 tracking-wider">
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
                  className="flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-lg bg-white/10 hover:bg-white/20 text-emerald-400 hover:text-emerald-300 border border-white/10 transition-colors cursor-pointer"
                >
                  {pickupMode === 'preset' ? (
                    <>
                      <PenLine className="w-3 h-3" />
                      <span>Write Manually</span>
                    </>
                  ) : (
                    <>
                      <List className="w-3 h-3" />
                      <span>Select Preset</span>
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
                    className={`w-full pl-9 ${pickup.name ? 'pr-16' : 'pr-9'} py-2.5 rounded-xl bg-black/70 border ${pickup.name ? 'border-white/25' : 'border-emerald-500/60 ring-1 ring-emerald-500/30'} text-xs text-white font-semibold focus:outline-none focus:border-white appearance-none cursor-pointer hover:border-white/40 transition-colors shadow-xs`}
                  >
                    <option value="" disabled className="bg-slate-900 text-slate-400">
                      📍 Select Pickup Location
                    </option>
                    <option value="My Live GPS Location" className="bg-slate-900 text-emerald-400 font-bold">
                      🎯 My Live GPS Location (Current Position)
                    </option>
                    {PRESET_LOCATIONS.map((loc) => (
                      <option key={loc.name} value={loc.name} className="bg-slate-900 text-white">
                        {loc.name}
                      </option>
                    ))}
                    <option value="__MANUAL_WRITE__" className="bg-slate-900 text-amber-300 font-bold">
                      ✍️ Type Custom Address Manually...
                    </option>
                  </select>
                  <MapPin className="w-4 h-4 text-emerald-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none stroke-[2.5]" />
                  
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
                        className="p-1 rounded-md bg-white/15 hover:bg-white/30 text-white transition-all cursor-pointer flex items-center justify-center active:scale-95 shadow-xs"
                      >
                        <X className="w-3.5 h-3.5 stroke-[2.5]" />
                      </button>
                    ) : null}
                    <ChevronDown className="w-4 h-4 text-white pointer-events-none stroke-[2.5]" />
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
                      className="w-full pl-9 pr-16 py-2.5 rounded-xl bg-black/80 border border-emerald-500/60 ring-1 ring-emerald-500/30 text-xs text-white placeholder-white/40 font-semibold focus:outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/40 shadow-xs"
                    />
                    <MapPin className="w-4 h-4 text-emerald-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none stroke-[2.5]" />

                    <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1.5 z-10">
                      {isSearchingPickup && (
                        <Loader2 className="w-3.5 h-3.5 text-emerald-400 animate-spin" />
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
                          className="p-1 rounded-md bg-white/15 hover:bg-white/30 text-white transition-all cursor-pointer flex items-center justify-center active:scale-95"
                        >
                          <X className="w-3.5 h-3.5 stroke-[2.5]" />
                        </button>
                      ) : null}
                    </div>
                  </div>

                  {/* Suggestions Popover */}
                  {showPickupSuggestions && pickupSuggestions.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-1 z-50 bg-slate-900/98 backdrop-blur-md border border-slate-700 rounded-xl shadow-2xl overflow-hidden max-h-48 overflow-y-auto">
                      <div className="px-2.5 py-1 text-[10px] uppercase font-bold text-slate-400 bg-slate-950/60 border-b border-slate-800 flex items-center justify-between">
                        <span>Matching Places</span>
                        <span className="text-emerald-400">Click to select</span>
                      </div>
                      {pickupSuggestions.map((item, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => handleSelectPickupSuggestion(item)}
                          className="w-full px-3 py-2 text-left text-xs text-slate-200 hover:bg-emerald-500/20 hover:text-white flex items-center gap-2 border-b border-slate-800/60 last:border-0 transition-colors cursor-pointer"
                        >
                          <MapPin className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
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
                <label className="text-[11px] font-black text-white/90 tracking-wider">
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
                  className="flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-lg bg-white/10 hover:bg-white/20 text-blue-400 hover:text-blue-300 border border-white/10 transition-colors cursor-pointer"
                >
                  {dropoffMode === 'preset' ? (
                    <>
                      <PenLine className="w-3 h-3" />
                      <span>Write Manually</span>
                    </>
                  ) : (
                    <>
                      <List className="w-3 h-3" />
                      <span>Select Preset</span>
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
                    className={`w-full pl-9 ${dropoff.name ? 'pr-16' : 'pr-9'} py-2.5 rounded-xl bg-black/70 border border-white/25 text-xs text-white font-semibold focus:outline-none focus:border-white appearance-none cursor-pointer hover:border-white/40 transition-colors shadow-xs`}
                  >
                    <option value="" disabled className="bg-slate-900 text-slate-400">
                      Select Dropoff Location
                    </option>
                    {PRESET_LOCATIONS.map((loc) => (
                      <option key={loc.name} value={loc.name} className="bg-slate-900 text-white">
                        {loc.name}
                      </option>
                    ))}
                    <option value="__MANUAL_WRITE__" className="bg-slate-900 text-amber-300 font-bold">
                      ✍️ Type Custom Address Manually...
                    </option>
                  </select>
                  <Navigation className="w-4 h-4 text-blue-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none stroke-[2.5]" />

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
                        className="p-1 rounded-md bg-white/15 hover:bg-white/30 text-white transition-all cursor-pointer flex items-center justify-center active:scale-95 shadow-xs"
                      >
                        <X className="w-3.5 h-3.5 stroke-[2.5]" />
                      </button>
                    ) : null}
                    <ChevronDown className="w-4 h-4 text-white pointer-events-none stroke-[2.5]" />
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
                      className="w-full pl-9 pr-16 py-2.5 rounded-xl bg-black/80 border border-blue-500/60 ring-1 ring-blue-500/30 text-xs text-white placeholder-white/40 font-semibold focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-400/40 shadow-xs"
                    />
                    <Navigation className="w-4 h-4 text-blue-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none stroke-[2.5]" />

                    <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1.5 z-10">
                      {isSearchingDropoff && (
                        <Loader2 className="w-3.5 h-3.5 text-blue-400 animate-spin" />
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
                          className="p-1 rounded-md bg-white/15 hover:bg-white/30 text-white transition-all cursor-pointer flex items-center justify-center active:scale-95"
                        >
                          <X className="w-3.5 h-3.5 stroke-[2.5]" />
                        </button>
                      ) : null}
                    </div>
                  </div>

                  {/* Suggestions Popover */}
                  {showDropoffSuggestions && dropoffSuggestions.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-1 z-50 bg-slate-900/98 backdrop-blur-md border border-slate-700 rounded-xl shadow-2xl overflow-hidden max-h-48 overflow-y-auto">
                      <div className="px-2.5 py-1 text-[10px] uppercase font-bold text-slate-400 bg-slate-950/60 border-b border-slate-800 flex items-center justify-between">
                        <span>Matching Places</span>
                        <span className="text-blue-400">Click to select</span>
                      </div>
                      {dropoffSuggestions.map((item, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => handleSelectDropoffSuggestion(item)}
                          className="w-full px-3 py-2 text-left text-xs text-slate-200 hover:bg-blue-500/20 hover:text-white flex items-center gap-2 border-b border-slate-800/60 last:border-0 transition-colors cursor-pointer"
                        >
                          <Navigation className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                          <span className="truncate font-medium">{item.name}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Fare & Payment Control Card */}
            <div className="p-3.5 sm:p-4 rounded-2xl bg-white/10 border border-white/20 flex flex-col gap-3 shadow-xs">
              {/* Fare Stepper: (-) Fare ₹ 0 (+) comment box icon */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setOfferedFare((prev) => Math.max(estimatedFare, prev - 5))}
                  disabled={!hasSelectedLocations || offeredFare <= estimatedFare}
                  className={`w-10 h-10 shrink-0 rounded-xl border font-black text-xl flex items-center justify-center transition-all shadow-xs ${
                    !hasSelectedLocations || offeredFare <= estimatedFare
                      ? 'bg-white/5 border-white/10 text-white/30 cursor-not-allowed'
                      : 'bg-white/10 border-white/30 text-white hover:bg-white/20 cursor-pointer active:scale-95'
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
                <div className="flex-1 min-w-0 flex items-center justify-center gap-1.5 bg-white/10 rounded-xl border border-white/25 hover:border-white/40 px-3 py-2 transition-all shadow-xs">
                  <span className="text-white text-xs sm:text-sm font-bold whitespace-nowrap select-none">
                    Fare
                  </span>
                  <span className="text-white font-mono-num font-black text-base">₹</span>
                  <input
                    type="number"
                    min={estimatedFare}
                    disabled={!hasSelectedLocations}
                    value={offeredFare}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setOfferedFare(Math.max(estimatedFare, isNaN(val) ? estimatedFare : val));
                    }}
                    className="w-14 sm:w-18 text-left font-mono-num font-black text-base sm:text-lg text-white bg-transparent focus:outline-none disabled:opacity-75"
                  />
                </div>

                <button
                  type="button"
                  onClick={() => setOfferedFare((prev) => prev + 5)}
                  disabled={!hasSelectedLocations}
                  className={`w-10 h-10 shrink-0 rounded-xl border font-black text-xl flex items-center justify-center active:scale-95 transition-all shadow-xs ${
                    !hasSelectedLocations
                      ? 'bg-white/5 border-white/10 text-white/30 cursor-not-allowed'
                      : 'bg-white/10 border-white/30 text-white hover:bg-white/20 cursor-pointer'
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
                  className={`w-10 h-10 shrink-0 rounded-xl border cursor-pointer flex items-center justify-center active:scale-95 transition-all relative ${
                    rideComment.trim() || showCommentInput
                      ? 'bg-white border-white text-black shadow-xs'
                      : 'bg-white/10 border-white/30 text-white hover:bg-white/20'
                  }`}
                  title="Add comment / instruction for captain"
                  aria-label="Add comment for captain"
                >
                  <MessageSquare className="w-4 h-4 stroke-[2.5]" />
                  {rideComment.trim() && (
                    <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-emerald-400 ring-2 ring-black" />
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
                    className="w-full pl-3 pr-8 py-2 rounded-xl bg-black/70 border border-white/30 text-xs text-white placeholder-white/50 focus:outline-none focus:border-white shadow-xs font-medium"
                    autoFocus
                  />
                  {rideComment && (
                    <button
                      type="button"
                      onClick={() => setRideComment('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/80 hover:text-white text-xs cursor-pointer font-bold"
                    >
                      ✕
                    </button>
                  )}
                </div>
              )}

              {/* Pay Via: upi | cash */}
              <div className="flex items-center justify-between pt-2 border-t border-white/15 text-xs">
                <span className="text-white font-black tracking-wide">Pay Via:</span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('upi')}
                    className={`px-4 py-1.5 rounded-xl font-black uppercase tracking-wider text-xs cursor-pointer transition-all ${
                      paymentMethod === 'upi'
                        ? 'bg-white text-black shadow-md font-black ring-1 ring-white'
                        : 'bg-white/10 text-white hover:bg-white/20 border border-white/30 font-bold'
                    }`}
                  >
                    upi
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('cash')}
                    className={`px-4 py-1.5 rounded-xl font-black lowercase tracking-wider text-xs cursor-pointer transition-all ${
                      paymentMethod === 'cash'
                        ? 'bg-white text-black shadow-md font-black ring-1 ring-white'
                        : 'bg-white/10 text-white hover:bg-white/20 border border-white/30 font-bold'
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
              disabled={isBooking}
              className="w-full py-3.5 rounded-2xl bg-white hover:bg-slate-200 text-black font-black text-sm shadow-2xl transition-all active:scale-[0.98] cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Send className="w-4 h-4 text-black stroke-[2.5]" />
              <span>
                {isBooking
                  ? 'Broadcasting Offer...'
                  : `Find Captain for ₹${offeredFare || estimatedFare || 75}`}
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
        passengerName={passengerName}
        onOpenWallet={onOpenWallet}
        onSignOut={onSignOut}
        onSelectSavedLocation={(loc) => {
          setDropoff(loc);
        }}
      />

      {/* Bottom / Sidebar Booking Form & Active Trip Card Controls */}
      {isCardMinimized ? (
        /* Minimized Floating Bar (Drop Down Condition) */
        <div className="fixed sm:absolute bottom-3 sm:bottom-4 md:bottom-6 left-1/2 -translate-x-1/2 md:left-6 md:translate-x-0 z-[1000] w-[calc(100%-1.25rem)] sm:w-[460px] md:w-[420px] animate-in fade-in slide-in-from-bottom-3 duration-200">
          <div
            onClick={() => setIsCardMinimized(false)}
            className="p-3 sm:p-3.5 rounded-3xl bg-slate-950/95 backdrop-blur-xl border border-slate-700/90 shadow-2xl flex items-center justify-between gap-3 hover:border-emerald-500/50 transition-all cursor-pointer ring-1 ring-white/10"
          >
            <div className="flex items-center gap-3 min-w-0 pr-2 flex-1">
              <div className="w-10 h-10 rounded-2xl bg-emerald-500 text-slate-950 flex items-center justify-center font-black text-lg shadow-md shrink-0">
                🏍️
              </div>
              <div className="min-w-0 flex flex-col">
                <span className="text-xs font-bold text-white truncate">
                  {activeRide
                    ? `${activeRide.ride_code} • ${activeRide.status.replace(/_/g, ' ')}`
                    : `${pickup.name ? pickup.name.split(',')[0] : 'Choose Pickup'} → ${dropoff.name.split(',')[0]}`}
                </span>
                <span className="text-[11px] text-emerald-400 font-mono-num font-semibold truncate">
                  {activeRide
                    ? `Fare: ₹${activeRide.final_fare || activeRide.offered_fare} • Active Trip`
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
              title="Open booking form"
            >
              <span>{activeRide ? 'View Ride' : 'Book Ride'}</span>
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
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md h-[500px]">
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
