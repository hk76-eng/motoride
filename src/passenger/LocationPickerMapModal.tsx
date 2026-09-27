import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Search, MapPin, Check, X, LocateFixed, Loader2, Navigation, Plus, Minus, Pencil } from 'lucide-react';
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
  referencePickup?: { name: string; lat: number; lng: number };
  referenceDropoff?: { name: string; lat: number; lng: number };
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
  referencePickup,
  referenceDropoff,
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

  const [customPlaceName, setCustomPlaceName] = useState<string>(() => initialLocation?.name || '');
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
      setCustomPlaceName(startLoc.name || '');
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
    setCustomPlaceName(loc.name);
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
    setCustomPlaceName(instantName);
    setHasSelectedLocation(true);
    setIsResolvingName(true);

    try {
      const accurateName = await resolveLocationNameAsync(lat, lng);
      if (accurateName) {
        setSelectedLocation({ name: accurateName, lat, lng });
        setCustomPlaceName(accurateName);
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
    setCustomPlaceName(nameToUse);
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
              ? 'border-emerald-500/50 text-emerald-300 shadow-emerald-950/50'
              : 'border-rose-500/50 text-rose-300 shadow-rose-950/50'
          }`}>
            <span className={`w-2 h-2 rounded-full animate-pulse ${targetType === 'pickup' ? 'bg-emerald-400' : 'bg-rose-500'}`} />
            <span>
              {targetType === 'pickup'
                ? 'Drag green marker 🟢 to set pickup location'
                : 'Drag red marker 🔴 to set drop-off location'}
            </span>
          </div>
        </div>

        <MotorideMap
          passengerLat={undefined}
          passengerLng={undefined}
          pickupLat={targetType === 'pickup' ? (hasSelectedLocation || selectedLocation.lat > 0 ? selectedLocation.lat : undefined) : (referencePickup && referencePickup.lat > 0 ? referencePickup.lat : undefined)}
          pickupLng={targetType === 'pickup' ? (hasSelectedLocation || selectedLocation.lng > 0 ? selectedLocation.lng : undefined) : (referencePickup && referencePickup.lng > 0 ? referencePickup.lng : undefined)}
          pickupAddress={targetType === 'pickup' ? (hasSelectedLocation || selectedLocation.lat > 0 ? (customPlaceName || selectedLocation.name) : undefined) : (referencePickup && referencePickup.lat > 0 ? referencePickup.name : undefined)}
          pickupMarkerType="marker"
          onPickupDragEnd={targetType === 'pickup' ? (lat, lng) => handleMapClick(lat, lng) : undefined}
          dropoffLat={targetType === 'dropoff' ? (hasSelectedLocation || selectedLocation.lat > 0 ? selectedLocation.lat : undefined) : (referenceDropoff && referenceDropoff.lat > 0 ? referenceDropoff.lat : undefined)}
          dropoffLng={targetType === 'dropoff' ? (hasSelectedLocation || selectedLocation.lng > 0 ? selectedLocation.lng : undefined) : (referenceDropoff && referenceDropoff.lng > 0 ? referenceDropoff.lng : undefined)}
          dropoffAddress={targetType === 'dropoff' ? (hasSelectedLocation || selectedLocation.lat > 0 ? (customPlaceName || selectedLocation.name) : undefined) : (referenceDropoff && referenceDropoff.lat > 0 ? referenceDropoff.name : undefined)}
          dropoffMarkerType="marker"
          onDropoffDragEnd={targetType === 'dropoff' ? (lat, lng) => handleMapClick(lat, lng) : undefined}
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
        <div className="flex flex-col gap-2.5 bg-slate-950/85 p-3 sm:p-3.5 rounded-2xl border border-slate-800 shadow-inner">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                targetType === 'pickup' ? 'bg-emerald-500/10 border border-emerald-500/20' : 'bg-rose-500/10 border border-rose-500/20'
              }`}>
                {targetType === 'pickup' ? (
                  <img src="/marker_green.svg" alt="Pickup A" className="w-4 h-5.5 object-contain" />
                ) : (
                  <img src="/marker_red.svg" alt="Dropoff B" className="w-4 h-5.5 object-contain" />
                )}
              </div>
              <span className="text-[11px] font-black uppercase tracking-wider text-slate-300 flex items-center gap-1.5 truncate">
                <span>Selected {targetType === 'pickup' ? 'Pickup Location' : 'Destination / Drop-off'}</span>
                {isResolvingName && <Loader2 className="w-3 h-3 text-cyan-400 animate-spin" />}
              </span>
            </div>

            <span className="text-[10px] font-mono-num font-bold text-slate-400 bg-slate-900 px-2 py-1 rounded-lg border border-slate-800 shrink-0">
              {selectedLocation.lat > 0 ? `${selectedLocation.lat.toFixed(4)}, ${selectedLocation.lng.toFixed(4)}` : 'Tap map to pin'}
            </span>
          </div>

          {/* Manually Write / Edit Place Name Input */}
          <div className="relative flex items-center w-full">
            <div className="absolute left-3 text-slate-400 pointer-events-none flex items-center">
              <Pencil className="w-3.5 h-3.5 text-cyan-400" />
            </div>
            <input
              type="text"
              value={customPlaceName}
              onChange={(e) => {
                const val = e.target.value;
                setCustomPlaceName(val);
                setSelectedLocation((prev) => ({
                  ...prev,
                  name: val,
                }));
              }}
              placeholder={
                targetType === 'pickup'
                  ? 'Write place name manually (e.g. Flat 302, Gate 1 Cozy Homes...)'
                  : 'Write place name manually (e.g. Tower B, Flat 204, Infosys...)'
              }
              className="w-full bg-slate-900 border border-slate-700/80 focus:border-cyan-400 rounded-xl pl-9 pr-8 py-2.5 text-xs sm:text-sm text-white font-semibold placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/30 transition-all shadow-inner"
            />
            {customPlaceName && (
              <button
                type="button"
                onClick={() => {
                  setCustomPlaceName('');
                  setSelectedLocation((prev) => ({ ...prev, name: '' }));
                }}
                className="absolute right-2.5 text-slate-400 hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
                title="Clear text"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center justify-between text-[10px] text-slate-400 px-1">
            <span className="flex items-center gap-1 text-slate-400 truncate">
              <span className="text-cyan-400 font-bold">💡 Tip:</span>
              <span className="truncate">Drag icon or tap map to pin, then type custom place name</span>
            </span>
            {selectedLocation.lat > 0 && (
              <button
                type="button"
                onClick={async () => {
                  setIsResolvingName(true);
                  try {
                    const fast = getFastLocationName(selectedLocation.lat, selectedLocation.lng);
                    setCustomPlaceName(fast);
                    setSelectedLocation((prev) => ({ ...prev, name: fast }));
                    const accurate = await resolveLocationNameAsync(selectedLocation.lat, selectedLocation.lng);
                    if (accurate) {
                      setCustomPlaceName(accurate);
                      setSelectedLocation((prev) => ({ ...prev, name: accurate }));
                    }
                  } finally {
                    setIsResolvingName(false);
                  }
                }}
                className="text-[10px] font-bold text-cyan-400 hover:text-cyan-300 underline cursor-pointer shrink-0 ml-2"
                title="Re-fetch address from map coordinates"
              >
                Reset to Map Name
              </button>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            const finalName = customPlaceName.trim() || selectedLocation.name.trim() || (targetType === 'pickup' ? 'Selected Pickup Point' : 'Selected Destination');
            onConfirmLocation({
              ...selectedLocation,
              name: finalName,
            });
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
