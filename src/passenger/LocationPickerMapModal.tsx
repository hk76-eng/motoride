import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Search, MapPin, Check, X, LocateFixed, Loader2, Navigation, Plus, Minus } from 'lucide-react';
import { MotorideMap } from '../components/common/MotorideMap';
import { getApiUrl } from '../utils/apiUrl';

interface LocationPickerMapModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetType: 'pickup' | 'dropoff';
  initialLocation: { name: string; lat: number; lng: number };
  passengerGps: { lat: number; lng: number; accuracy?: number | null };
  onConfirmLocation: (location: { name: string; lat: number; lng: number }) => void;
  getFastLocationName: (lat: number, lng: number) => string;
  resolveLocationNameAsync: (lat: number, lng: number) => Promise<string>;
  getInstantMatchingSuggestions: (query: string) => { name: string; lat: number; lng: number }[];
}

export const LocationPickerMapModal: React.FC<LocationPickerMapModalProps> = ({
  isOpen,
  onClose,
  targetType,
  initialLocation,
  passengerGps,
  onConfirmLocation,
  getFastLocationName,
  resolveLocationNameAsync,
  getInstantMatchingSuggestions,
}) => {
  // Reliable passenger position fallbacks
  const effectivePassengerLat = (passengerGps && passengerGps.lat > 0)
    ? passengerGps.lat
    : (initialLocation?.lat > 0 ? initialLocation.lat : 30.704649);

  const effectivePassengerLng = (passengerGps && passengerGps.lng > 0)
    ? passengerGps.lng
    : (initialLocation?.lng > 0 ? initialLocation.lng : 76.717873);

  const [selectedLocation, setSelectedLocation] = useState<{ name: string; lat: number; lng: number }>(() => {
    if (initialLocation && initialLocation.lat > 0 && initialLocation.lng > 0) {
      return initialLocation;
    }
    return {
      name: 'My Live GPS Location',
      lat: effectivePassengerLat,
      lng: effectivePassengerLng,
    };
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<{ name: string; lat: number; lng: number }[]>([]);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [isSearchingServer, setIsSearchingServer] = useState(false);
  const [isResolvingName, setIsResolvingName] = useState(false);
  const [currentZoom, setCurrentZoom] = useState<number>(15);
  const [hasSelectedLocation, setHasSelectedLocation] = useState(false);
  const [mapFocusCoords, setMapFocusCoords] = useState<{ lat: number; lng: number; zoom?: number; timestamp: number } | null>(null);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const wasOpenRef = useRef<boolean>(false);
  const isSelectingRef = useRef<boolean>(false);

  // Sync modal state ONLY when modal opens
  useEffect(() => {
    if (isOpen && !wasOpenRef.current) {
      wasOpenRef.current = true;
      let startLoc = (initialLocation && initialLocation.lat > 0 && initialLocation.lng > 0)
        ? initialLocation
        : null;

      if (!startLoc) {
        if (targetType === 'pickup' && effectivePassengerLat > 0) {
          startLoc = {
            name: getFastLocationName(effectivePassengerLat, effectivePassengerLng) || 'My Live GPS Location',
            lat: effectivePassengerLat,
            lng: effectivePassengerLng,
          };
        } else if (targetType === 'dropoff' && effectivePassengerLat > 0) {
          const dLat = effectivePassengerLat + 0.012;
          const dLng = effectivePassengerLng + 0.012;
          startLoc = {
            name: getFastLocationName(dLat, dLng) || 'Drop-off Destination',
            lat: dLat,
            lng: dLng,
          };
        } else {
          startLoc = { name: '', lat: 0, lng: 0 };
        }
      }

      setSelectedLocation(startLoc);
      setSearchQuery(startLoc.name || '');
      setSearchResults([]);
      setShowSearchResults(false);
      setCurrentZoom(15);
      setHasSelectedLocation(startLoc.lat > 0);

      const focusLat = startLoc.lat > 0 ? startLoc.lat : (effectivePassengerLat || 30.7333);
      const focusLng = startLoc.lng > 0 ? startLoc.lng : (effectivePassengerLng || 76.7794);
      setMapFocusCoords({ lat: focusLat, lng: focusLng, zoom: 15, timestamp: Date.now() });
    } else if (!isOpen) {
      wasOpenRef.current = false;
    }
  }, [isOpen]);

  // Live Geocoding Search (Combining local 120+ landmark pool + OpenStreetMap API)
  useEffect(() => {
    if (isSelectingRef.current) {
      isSelectingRef.current = false;
      return;
    }

    const q = searchQuery.trim();
    if (!q) {
      setSearchResults([]);
      setShowSearchResults(false);
      return;
    }

    // 1. Instant local matching
    const instant = getInstantMatchingSuggestions(q);
    setSearchResults(instant);
    setShowSearchResults(true);

    // 2. Debounced online geocode search for high-accuracy remote results
    const timer = setTimeout(async () => {
      if (q.length < 2) return;
      setIsSearchingServer(true);
      try {
        const res = await fetch(getApiUrl(`/api/motoride/geocode/search?q=${encodeURIComponent(q)}`));
        if (res.ok) {
          const text = await res.text();
          if (text && !text.trim().startsWith('<') && !text.trim().startsWith('The page')) {
            const data = JSON.parse(text);
            if (data.results && Array.isArray(data.results)) {
              const merged = [...instant];
              for (const r of data.results) {
                if (!merged.some((m) => m.name.toLowerCase() === r.name.toLowerCase())) {
                  merged.push({
                    name: r.name,
                    lat: r.lat,
                    lng: r.lng,
                  });
                }
              }
              setSearchResults(merged.slice(0, 10));
            }
          }
        }
      } catch (err) {
        console.warn('Location picker server geocode search warning:', err);
      } finally {
        setIsSearchingServer(false);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleSelectSearchResult = (loc: { name: string; lat: number; lng: number }) => {
    isSelectingRef.current = true;
    setSelectedLocation(loc);
    setSearchQuery(loc.name);
    setShowSearchResults(false);
    setHasSelectedLocation(true);
    const isAreaSearch = /\b(chandigarh|dhakoli|zirakpur|sector|mohali|panchkula|mullanpur|kharar|khara|sas nagar|baltana|peer muchalla)\b/i.test(loc.name);
    const zoomLevel = isAreaSearch ? 14 : 16;
    setCurrentZoom(zoomLevel);
    setMapFocusCoords({ lat: loc.lat, lng: loc.lng, zoom: zoomLevel, timestamp: Date.now() });
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchResults.length > 0) {
      handleSelectSearchResult(searchResults[0]);
    } else if (searchQuery.trim()) {
      const matches = getInstantMatchingSuggestions(searchQuery.trim());
      if (matches.length > 0) {
        handleSelectSearchResult(matches[0]);
      }
    }
  };

  const handleMapClick = async (lat: number, lng: number) => {
    const instantName = getFastLocationName(lat, lng);
    setSelectedLocation({ name: instantName, lat, lng });
    setHasSelectedLocation(true);
    setIsResolvingName(true);

    try {
      const accurateName = await resolveLocationNameAsync(lat, lng);
      if (accurateName) {
        setSelectedLocation({ name: accurateName, lat, lng });
      }
    } catch {} finally {
      setIsResolvingName(false);
    }
  };

  const handleUseLiveGpsLocation = () => {
    const fastName = getFastLocationName(effectivePassengerLat, effectivePassengerLng);
    const nameToUse = fastName.includes('Location (') ? 'My Live Location' : fastName;
    const loc = { name: nameToUse, lat: effectivePassengerLat, lng: effectivePassengerLng };
    setSelectedLocation(loc);
    setSearchQuery(nameToUse);
    setShowSearchResults(false);
    setCurrentZoom(16);
    setMapFocusCoords({ lat: effectivePassengerLat, lng: effectivePassengerLng, zoom: 16, timestamp: Date.now() });
  };

  const handleZoomIn = () => {
    setCurrentZoom((prevZoom) => {
      const nextZoom = Math.min(prevZoom + 1, 19);
      const targetLat = selectedLocation.lat || effectivePassengerLat;
      const targetLng = selectedLocation.lng || effectivePassengerLng;
      setMapFocusCoords({ lat: targetLat, lng: targetLng, zoom: nextZoom, timestamp: Date.now() });
      return nextZoom;
    });
  };

  const handleZoomOut = () => {
    setCurrentZoom((prevZoom) => {
      const nextZoom = Math.max(prevZoom - 1, 11);
      const targetLat = selectedLocation.lat || effectivePassengerLat;
      const targetLng = selectedLocation.lng || effectivePassengerLng;
      setMapFocusCoords({ lat: targetLat, lng: targetLng, zoom: nextZoom, timestamp: Date.now() });
      return nextZoom;
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[3000] bg-slate-950/90 backdrop-blur-md flex flex-col animate-in fade-in duration-200">
      {/* Top Header Bar */}
      <div className="bg-slate-900 border-b border-slate-800 px-4 py-3 flex items-center justify-between gap-3 shrink-0 shadow-lg z-20">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-2xl bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 transition-all cursor-pointer active:scale-95 shrink-0"
            title="Go Back to Booking Form"
          >
            <ArrowLeft className="w-5 h-5 stroke-[2.5]" />
          </button>

          <div className="min-w-0 flex flex-col">
            <h2 className="text-sm sm:text-base font-black text-white truncate flex items-center gap-2">
              <span className={`w-2.5 h-2.5 rounded-full ${targetType === 'pickup' ? 'bg-cyan-400' : 'bg-rose-500'}`} />
              <span>{targetType === 'pickup' ? 'Set Pickup Location' : 'Set Drop-off Location'}</span>
            </h2>
            <p className="text-[11px] text-slate-400 font-medium truncate">
              {targetType === 'pickup' ? 'Drag passenger icon 👤 or tap map to set pickup' : 'Drag red flag icon 🚩 or tap map to set drop-off'}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="p-2 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-all cursor-pointer shrink-0"
          title="Close"
        >
          <X className="w-5 h-5 stroke-[2.5]" />
        </button>
      </div>

      {/* Main Map View Area */}
      <div className="relative flex-1 w-full h-full overflow-hidden">
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[1000] pointer-events-none animate-in fade-in slide-in-from-top-2 duration-300">
          <div className={`px-3.5 py-1.5 rounded-full bg-slate-900/90 backdrop-blur-md border text-xs font-bold shadow-xl flex items-center gap-2 ${
            targetType === 'pickup'
              ? 'border-cyan-500/50 text-cyan-300 shadow-cyan-950/50'
              : 'border-rose-500/50 text-rose-300 shadow-rose-950/50'
          }`}>
            <span className={`w-2 h-2 rounded-full animate-pulse ${targetType === 'pickup' ? 'bg-cyan-400' : 'bg-rose-500'}`} />
            <span>
              {targetType === 'pickup'
                ? 'Drag passenger icon 👤 to set pickup location'
                : 'Drag red flag icon 🚩 to set drop-off location'}
            </span>
          </div>
        </div>

        <MotorideMap
          passengerLat={undefined}
          passengerLng={undefined}
          pickupLat={targetType === 'pickup' && (hasSelectedLocation || selectedLocation.lat > 0) ? selectedLocation.lat : undefined}
          pickupLng={targetType === 'pickup' && (hasSelectedLocation || selectedLocation.lng > 0) ? selectedLocation.lng : undefined}
          pickupAddress={targetType === 'pickup' && (hasSelectedLocation || selectedLocation.lat > 0) ? selectedLocation.name : undefined}
          pickupMarkerType={targetType === 'pickup' ? 'passenger' : 'marker'}
          onPickupDragEnd={(lat, lng) => handleMapClick(lat, lng)}
          dropoffLat={targetType === 'dropoff' && (hasSelectedLocation || selectedLocation.lat > 0) ? selectedLocation.lat : undefined}
          dropoffLng={targetType === 'dropoff' && (hasSelectedLocation || selectedLocation.lng > 0) ? selectedLocation.lng : undefined}
          dropoffAddress={targetType === 'dropoff' && (hasSelectedLocation || selectedLocation.lat > 0) ? selectedLocation.name : undefined}
          dropoffMarkerType={targetType === 'dropoff' ? 'destination' : 'marker'}
          onDropoffDragEnd={(lat, lng) => handleMapClick(lat, lng)}
          focusCoords={mapFocusCoords}
          bottomSheetPadding={0}
          showOverlayControls={false}
          interactive={true}
          onMapClick={(lat, lng) => handleMapClick(lat, lng)}
          className="w-full h-full"
        />
      </div>

      {/* Bottom Confirmation Bar */}
      <div className="bg-slate-900 border-t border-slate-800 p-3 sm:p-4 flex flex-col gap-3 shadow-2xl shrink-0 z-20">
        <div className="flex items-center justify-between gap-3 bg-slate-950/80 p-3 rounded-2xl border border-slate-800">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
              targetType === 'pickup' ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30' : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
            }`}>
              {targetType === 'pickup' ? (
                <img src="/passenger_icon.svg" alt="Passenger" className="w-5 h-5 rounded-full object-cover" />
              ) : (
                <span className="text-base select-none leading-none">🚩</span>
              )}
            </div>
            <div className="min-w-0 flex flex-col">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1">
                <span>Selected {targetType === 'pickup' ? 'Pickup' : 'Destination'}</span>
                {isResolvingName && <Loader2 className="w-3 h-3 text-emerald-400 animate-spin ml-1" />}
              </span>
              <span className="text-xs sm:text-sm font-black text-white truncate">
                {selectedLocation.name || 'Tap on map to select location'}
              </span>
            </div>
          </div>

          <span className="text-[10px] font-mono-num font-bold text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded-lg border border-emerald-500/20 shrink-0">
            {selectedLocation.lat > 0 ? `${selectedLocation.lat.toFixed(4)}, ${selectedLocation.lng.toFixed(4)}` : 'Ready'}
          </span>
        </div>

        <button
          type="button"
          onClick={() => {
            onConfirmLocation(selectedLocation);
            onClose();
          }}
          className="w-full py-3.5 sm:py-4 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-sm sm:text-base shadow-xl shadow-emerald-500/20 flex items-center justify-center gap-2 active:scale-[0.98] transition-all cursor-pointer"
        >
          <Check className="w-5 h-5 stroke-[3]" />
          <span>Confirm {targetType === 'pickup' ? 'Pickup Location' : 'Destination'} & Return</span>
        </button>
      </div>
    </div>
  );
};
