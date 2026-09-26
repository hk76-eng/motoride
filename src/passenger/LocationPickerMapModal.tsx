import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Search, MapPin, Check, X, LocateFixed, Loader2, Sparkles, Navigation } from 'lucide-react';
import { MotorideMap } from '../components/common/MotorideMap';

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
  const [selectedLocation, setSelectedLocation] = useState<{ name: string; lat: number; lng: number }>(() => {
    if (initialLocation && initialLocation.lat > 0 && initialLocation.lng > 0) {
      return initialLocation;
    }
    if (passengerGps && passengerGps.lat > 0) {
      return {
        name: 'My Live Location',
        lat: passengerGps.lat,
        lng: passengerGps.lng,
      };
    }
    return { name: 'Sector 17 Plaza, Chandigarh', lat: 30.739834, lng: 76.782702 };
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<{ name: string; lat: number; lng: number }[]>([]);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [isResolvingName, setIsResolvingName] = useState(false);
  const [mapFocusCoords, setMapFocusCoords] = useState<{ lat: number; lng: number; zoom?: number; timestamp: number } | null>(null);

  const searchInputRef = useRef<HTMLInputElement>(null);

  // Sync state on open
  useEffect(() => {
    if (isOpen) {
      const startLoc = (initialLocation && initialLocation.lat > 0 && initialLocation.lng > 0)
        ? initialLocation
        : (passengerGps && passengerGps.lat > 0
            ? { name: 'My Live GPS Location', lat: passengerGps.lat, lng: passengerGps.lng }
            : { name: 'Sector 17 Plaza, Chandigarh', lat: 30.739834, lng: 76.782702 });

      setSelectedLocation(startLoc);
      setSearchQuery('');
      setSearchResults([]);
      setShowSearchResults(false);
      setMapFocusCoords({ lat: startLoc.lat, lng: startLoc.lng, zoom: 16, timestamp: Date.now() });
    }
  }, [isOpen, initialLocation, passengerGps]);

  // Real-time search handler
  const handleSearchChange = (query: string) => {
    setSearchQuery(query);
    if (query.trim().length > 0) {
      const matches = getInstantMatchingSuggestions(query);
      setSearchResults(matches);
      setShowSearchResults(true);
    } else {
      setSearchResults([]);
      setShowSearchResults(false);
    }
  };

  const handleSelectSearchResult = (loc: { name: string; lat: number; lng: number }) => {
    setSelectedLocation(loc);
    setSearchQuery(loc.name);
    setShowSearchResults(false);
    setMapFocusCoords({ lat: loc.lat, lng: loc.lng, zoom: 17, timestamp: Date.now() });
  };

  const handleMapClick = async (lat: number, lng: number) => {
    const instantName = getFastLocationName(lat, lng);
    setSelectedLocation({ name: instantName, lat, lng });
    setMapFocusCoords({ lat, lng, zoom: 16, timestamp: Date.now() });
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

  const handleRecenterPassengerGps = () => {
    if (passengerGps && passengerGps.lat > 0) {
      const fastName = getFastLocationName(passengerGps.lat, passengerGps.lng);
      const nameToUse = fastName.includes('Location (') ? 'My Live Location' : fastName;
      const loc = { name: nameToUse, lat: passengerGps.lat, lng: passengerGps.lng };
      setSelectedLocation(loc);
      setMapFocusCoords({ lat: passengerGps.lat, lng: passengerGps.lng, zoom: 17, timestamp: Date.now() });
    }
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
              Search hotel, petrol pump, society, or tap on map
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

      {/* Floating Search Bar Overlay on top of Map */}
      <div className="relative z-30 px-3 sm:px-6 pt-3 pb-2 max-w-2xl w-full mx-auto">
        <div className="relative flex items-center shadow-2xl">
          <Search className="w-4 h-4 text-emerald-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none stroke-[2.5]" />
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            onFocus={() => {
              if (searchQuery.trim()) setShowSearchResults(true);
            }}
            placeholder={
              targetType === 'pickup'
                ? 'Search pickup place (e.g. JW Marriott, HP Petrol Pump, Sector 17)...'
                : 'Search destination place (e.g. Elante Mall, PGI, Homeland Heights)...'
            }
            className="w-full pl-10 pr-20 py-3 rounded-2xl bg-slate-900/95 border-2 border-slate-700 focus:border-emerald-500 text-white placeholder-slate-400 text-xs sm:text-sm font-bold shadow-2xl backdrop-blur-xl focus:outline-none transition-all"
          />
          {searchQuery ? (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setSearchResults([]);
                setShowSearchResults(false);
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-all cursor-pointer"
            >
              <X className="w-3.5 h-3.5 stroke-[2.5]" />
            </button>
          ) : (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-black uppercase tracking-wider text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-lg border border-emerald-500/30">
              Live Search
            </span>
          )}
        </div>

        {/* Real-time Search Autocomplete Dropdown */}
        {showSearchResults && searchResults.length > 0 && (
          <div className="absolute top-full left-3 sm:left-6 right-3 sm:right-6 mt-1 bg-slate-900/95 border-2 border-emerald-500/80 rounded-2xl shadow-2xl backdrop-blur-2xl max-h-64 overflow-y-auto divide-y divide-slate-800 z-50 animate-in fade-in duration-150">
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
                    <span className="text-[10px] text-slate-400 font-medium">Tap to pinpoint on map</span>
                  </div>
                </div>
                <span className="text-[10px] font-black text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded-lg border border-emerald-500/20 group-hover:bg-emerald-500 group-hover:text-slate-950 transition-colors shrink-0">
                  Select
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Main Map View Area */}
      <div className="relative flex-1 w-full h-full overflow-hidden">
        <MotorideMap
          passengerLat={passengerGps.lat}
          passengerLng={passengerGps.lng}
          passengerAccuracy={passengerGps.accuracy}
          pickupLat={targetType === 'pickup' ? selectedLocation.lat : undefined}
          pickupLng={targetType === 'pickup' ? selectedLocation.lng : undefined}
          pickupAddress={targetType === 'pickup' ? selectedLocation.name : undefined}
          dropoffLat={targetType === 'dropoff' ? selectedLocation.lat : undefined}
          dropoffLng={targetType === 'dropoff' ? selectedLocation.lng : undefined}
          dropoffAddress={targetType === 'dropoff' ? selectedLocation.name : undefined}
          focusCoords={mapFocusCoords}
          bottomSheetPadding={160}
          showOverlayControls={false}
          interactive={true}
          onMapClick={(lat, lng) => handleMapClick(lat, lng)}
          className="w-full h-full"
        />

        {/* Floating Recenter GPS Button inside Map Modal */}
        <button
          type="button"
          onClick={handleRecenterPassengerGps}
          title="Center on My Live Location"
          className="absolute right-4 bottom-24 z-[400] p-3 rounded-full bg-slate-900/95 hover:bg-slate-800 text-white border border-slate-700 shadow-2xl backdrop-blur-xl flex items-center justify-center gap-2 active:scale-95 transition-all cursor-pointer group"
        >
          <LocateFixed className="w-5 h-5 text-emerald-400 stroke-[2.5] group-hover:rotate-12 transition-transform" />
          <span className="text-xs font-bold hidden sm:inline text-white">My Position</span>
        </button>
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
                {selectedLocation.name || 'Tap on map to pick location'}
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
