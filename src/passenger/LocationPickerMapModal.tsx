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
  const [mapFocusCoords, setMapFocusCoords] = useState<{ lat: number; lng: number; zoom?: number; timestamp: number } | null>(null);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const wasOpenRef = useRef<boolean>(false);

  // Sync modal state ONLY when modal opens (prevent clearing text while typing!)
  useEffect(() => {
    if (isOpen && !wasOpenRef.current) {
      wasOpenRef.current = true;
      const startLoc = (initialLocation && initialLocation.lat > 0 && initialLocation.lng > 0)
        ? initialLocation
        : { name: 'My Live GPS Location', lat: effectivePassengerLat, lng: effectivePassengerLng };

      setSelectedLocation(startLoc);
      setSearchQuery('');
      setSearchResults([]);
      setShowSearchResults(false);
      setCurrentZoom(15);
      setMapFocusCoords({ lat: startLoc.lat, lng: startLoc.lng, zoom: 15, timestamp: Date.now() });
    } else if (!isOpen) {
      wasOpenRef.current = false;
    }
  }, [isOpen]);

  // Live Geocoding Search (Combining local 120+ landmark pool + OpenStreetMap API)
  useEffect(() => {
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
    setSelectedLocation(loc);
    setSearchQuery(loc.name);
    setShowSearchResults(false);
    const isAreaSearch = /\b(dhakoli|zirakpur|sector|mohali|panchkula|mullanpur|kharar|baltana|peer muchalla)\b/i.test(loc.name);
    const zoomLevel = isAreaSearch ? 15 : 16;
    setCurrentZoom(zoomLevel);
    setMapFocusCoords({ lat: loc.lat, lng: loc.lng, zoom: zoomLevel, timestamp: Date.now() });
  };

  const handleMapClick = async (lat: number, lng: number) => {
    const instantName = getFastLocationName(lat, lng);
    setSelectedLocation({ name: instantName, lat, lng });
    const targetZoom = Math.max(currentZoom, 15);
    setCurrentZoom(targetZoom);
    setMapFocusCoords({ lat, lng, zoom: targetZoom, timestamp: Date.now() });
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
              <span className={`w-2.5 h-2.5 rounded-full ${targetType === 'pickup' ? 'bg-emerald-400' : 'bg-rose-500'}`} />
              <span>{targetType === 'pickup' ? 'Select Pickup Location' : 'Select Destination Location'}</span>
            </h2>
            <p className="text-[11px] text-slate-400 font-medium truncate">
              Search place name or tap anywhere on map
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

      {/* Floating Search Bar Overlay & Live GPS Pill on top of Map */}
      <div className="relative z-30 px-3 sm:px-6 pt-3 pb-2 max-w-2xl w-full mx-auto flex flex-col gap-2">
        <div className="relative flex items-center shadow-2xl">
          <Search className="w-4 h-4 text-emerald-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none stroke-[2.5]" />
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => {
              if (searchQuery.trim()) setShowSearchResults(true);
            }}
            placeholder={
              targetType === 'pickup'
                ? 'Search place (e.g. Dhakoli, JW Marriott, Sector 17, VIP Road)...'
                : 'Search place (e.g. Dhakoli, Elante Mall, PGI, Homeland Heights)...'
            }
            className="w-full pl-10 pr-20 py-3 rounded-2xl bg-slate-900/95 border-2 border-slate-700 focus:border-emerald-500 text-white placeholder-slate-400 text-xs sm:text-sm font-bold shadow-2xl backdrop-blur-xl focus:outline-none transition-all"
          />
          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
            {isSearchingServer && <Loader2 className="w-3.5 h-3.5 text-emerald-400 animate-spin" />}
            {searchQuery ? (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setSearchResults([]);
                  setShowSearchResults(false);
                }}
                className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-all cursor-pointer"
              >
                <X className="w-3.5 h-3.5 stroke-[2.5]" />
              </button>
            ) : (
              <span className="text-[10px] font-black uppercase tracking-wider text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-lg border border-emerald-500/30">
                Search
              </span>
            )}
          </div>
        </div>

        {/* Real-time Search Autocomplete Dropdown */}
        {showSearchResults && searchResults.length > 0 && (
          <div className="absolute top-14 left-3 sm:left-6 right-3 sm:right-6 mt-1 bg-slate-900/95 border-2 border-emerald-500/80 rounded-2xl shadow-2xl backdrop-blur-2xl max-h-72 overflow-y-auto divide-y divide-slate-800 z-50 animate-in fade-in duration-150">
            {searchResults.map((item, idx) => (
              <button
                key={`${item.name}-${idx}`}
                type="button"
                onClick={() => handleSelectSearchResult(item)}
                className="w-full px-4 py-3 text-left flex items-center justify-between gap-3 hover:bg-slate-800/90 transition-all cursor-pointer group"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shrink-0 group-hover:bg-emerald-500 group-hover:text-slate-950 transition-colors">
                    <MapPin className="w-4 h-4 stroke-[2.5]" />
                  </div>
                  <div className="min-w-0">
                    <span className="text-xs sm:text-sm font-bold text-white group-hover:text-emerald-300 block truncate">
                      {item.name}
                    </span>
                    <span className="text-[10px] text-slate-400 font-medium block truncate">
                      Tap to view {item.name} area map with hotels, societies & landmarks
                    </span>
                  </div>
                </div>
                <span className="text-[10px] font-black text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded-lg border border-emerald-500/20 group-hover:bg-emerald-500 group-hover:text-slate-950 transition-colors shrink-0">
                  Select Area
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Main Map View Area */}
      <div className="relative flex-1 w-full h-full overflow-hidden">
        <MotorideMap
          passengerLat={undefined}
          passengerLng={undefined}
          pickupLat={targetType === 'pickup' ? selectedLocation.lat : undefined}
          pickupLng={targetType === 'pickup' ? selectedLocation.lng : undefined}
          pickupAddress={targetType === 'pickup' ? selectedLocation.name : undefined}
          dropoffLat={targetType === 'dropoff' ? selectedLocation.lat : undefined}
          dropoffLng={targetType === 'dropoff' ? selectedLocation.lng : undefined}
          dropoffAddress={targetType === 'dropoff' ? selectedLocation.name : undefined}
          focusCoords={mapFocusCoords}
          bottomSheetPadding={0}
          showOverlayControls={false}
          interactive={true}
          onMapClick={(lat, lng) => handleMapClick(lat, lng)}
          className="w-full h-full"
        />

        {/* Floating Vertical Map Zoom In (+) & Zoom Out (-) Control Bar */}
        <div className="absolute right-4 bottom-24 z-[450] flex flex-col gap-2">
          <button
            type="button"
            onClick={handleZoomIn}
            title="Zoom In (+)"
            className="w-11 h-11 rounded-2xl bg-slate-900/95 hover:bg-slate-800 text-white border border-slate-700/80 shadow-2xl backdrop-blur-xl flex items-center justify-center active:scale-95 transition-all cursor-pointer hover:border-emerald-500 hover:text-emerald-400"
          >
            <Plus className="w-6 h-6 stroke-[3]" />
          </button>
          <button
            type="button"
            onClick={handleZoomOut}
            title="Zoom Out (-)"
            className="w-11 h-11 rounded-2xl bg-slate-900/95 hover:bg-slate-800 text-white border border-slate-700/80 shadow-2xl backdrop-blur-xl flex items-center justify-center active:scale-95 transition-all cursor-pointer hover:border-emerald-500 hover:text-emerald-400"
          >
            <Minus className="w-6 h-6 stroke-[3]" />
          </button>
        </div>
      </div>

      {/* Bottom Confirmation Bar */}
      <div className="bg-slate-900 border-t border-slate-800 p-3 sm:p-4 flex flex-col gap-3 shadow-2xl shrink-0 z-20">
        <div className="flex items-center justify-between gap-3 bg-slate-950/80 p-3 rounded-2xl border border-slate-800">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
              targetType === 'pickup' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
            }`}>
              <MapPin className="w-4 h-4 stroke-[2.5]" />
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
