import React, { useEffect, useState, useMemo } from 'react';
import { Radio, XCircle, Bike, Sparkles, Star, Target } from 'lucide-react';
import { AvailableCaptainItem } from '../components/common/MotorideMap';

interface TripInDriveRadarProps {
  onCancel?: () => void;
  isCancelling?: boolean;
  offeredFare?: number;
  rideCode?: string;
  nearbyCaptains?: AvailableCaptainItem[];
  pickupLat?: number;
  pickupLng?: number;
}

// Convert latitude and longitude to bearing degrees (0° = North, 90° = East, 180° = South, 270° = West)
function calculateBearing(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const y = Math.sin((lon2 - lon1) * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180));
  const x =
    Math.cos(lat1 * (Math.PI / 180)) * Math.sin(lat2 * (Math.PI / 180)) -
    Math.sin(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * Math.cos((lon2 - lon1) * (Math.PI / 180));
  const deg = (Math.atan2(y, x) * 180) / Math.PI;
  return (deg + 360) % 360;
}

// Great-circle distance between two coords in km
function calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export const TripInDriveRadar: React.FC<TripInDriveRadarProps> = ({
  onCancel,
  isCancelling = false,
  rideCode = '',
  nearbyCaptains = [],
  pickupLat = 30.7333,
  pickupLng = 76.7794,
}) => {
  // Real-time sweeping angle state to trigger captain illumination
  const [currentAngle, setCurrentAngle] = useState(0);

  useEffect(() => {
    let animationFrameId: number;
    let startTimestamp: number | null = null;
    const duration = 3000; // 3.0s per 360-degree rotation

    const step = (timestamp: number) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = (timestamp - startTimestamp) % duration;
      const angle = (progress / duration) * 360;
      setCurrentAngle(angle);
      animationFrameId = requestAnimationFrame(step);
    };

    animationFrameId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(animationFrameId);
  }, []);

  // Compute real-time captain targets mapped into the radar coordinate frame (angle & distance radius)
  const realTimeTargets = useMemo(() => {
    if (!nearbyCaptains || nearbyCaptains.length === 0) {
      return [];
    }

    return nearbyCaptains.map((cap, idx) => {
      const cLat = cap.lat ?? pickupLat + 0.003;
      const cLng = cap.lng ?? pickupLng + 0.003;
      const distKm = calculateDistanceKm(pickupLat, pickupLng, cLat, cLng);
      const angleDeg = calculateBearing(pickupLat, pickupLng, cLat, cLng);

      // Radar radius scaling: max range is ~2.0km
      // radiusPercent between 20% and 90%
      const maxRadarKm = 2.0;
      const normalizedRadius = Math.min(distKm / maxRadarKm, 1.0);
      const radiusPercent = Math.max(22, Math.min(88, normalizedRadius * 85));

      const distanceText = distKm < 1 ? `${Math.round(distKm * 1000)}m` : `${distKm.toFixed(1)}km`;

      return {
        id: cap.id || `cap-${idx}`,
        name: cap.name || 'Captain',
        distance: distanceText,
        rating: cap.rating ? cap.rating.toFixed(1) : '4.9',
        angleDeg,
        radiusPercent,
        vehicle: cap.vehicleModel || 'Bike',
      };
    });
  }, [nearbyCaptains, pickupLat, pickupLng]);

  return (
    <div className="flex-1 flex flex-col items-center justify-between py-2 sm:py-3 text-center text-slate-900 w-full h-full select-none bg-white">
      {/* Clean Light-Theme Focus Radar Header */}
      <div className="w-full flex flex-col items-center gap-1.5 px-2">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-50 border-2 border-amber-500 shadow-xs">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500 shadow-[0_0_8px_#f59e0b]" />
          </span>
          <span className="text-[11px] font-black tracking-wider uppercase text-amber-950 font-mono-num flex items-center gap-1.5">
            <Target className="w-3.5 h-3.5 text-amber-500 animate-pulse" />
            <span>FINDING NEARBY CAPTAINS</span>
          </span>
        </div>

        <div className="flex items-center gap-2.5 text-[11px] text-slate-600 font-bold">
          <span className="flex items-center gap-1 font-mono-num text-amber-600">
            <Radio className="w-3 h-3 text-amber-500 animate-pulse" />
            <span>CAPTAIN PARTNER FOCUS LIGHT</span>
          </span>
          <span className="text-slate-300">•</span>
          <span className="text-slate-900 font-black">
            {realTimeTargets.length} {realTimeTargets.length === 1 ? 'Captain' : 'Captains'} in Radar
          </span>
          {rideCode && (
            <>
              <span className="text-slate-300">•</span>
              <span className="font-mono text-slate-500 font-bold">#{rideCode}</span>
            </>
          )}
        </div>
      </div>

      {/* Main Radar Scope Container - Pure White Canvas with Small Black Rings and Soft Light Amber Search Focus Light */}
      <div className="my-auto py-2 flex flex-col items-center justify-center">
        {/* Radar Circular Housing - Solid Black Outer Border */}
        <div className="relative w-56 h-56 sm:w-64 sm:h-64 rounded-full bg-white border-2 border-black shadow-[0_8px_30px_rgba(0,0,0,0.12)] flex items-center justify-center overflow-hidden">
          {/* Subtle Ambient Radial Soft Amber Warmth */}
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(251,191,36,0.08)_0%,rgba(254,243,199,0.35)_55%,transparent_80%)] pointer-events-none" />

          {/* ================================================================================= */}
          {/* SMALL BLACK RINGS & CONCENTRIC RANGE MARKS                                         */}
          {/* ================================================================================= */}
          {/* Outer Black Ring (1.5km range) */}
          <div className="absolute w-[75%] h-[75%] rounded-full border border-black/40 pointer-events-none" />

          {/* Middle Black Ring (1.0km range) */}
          <div className="absolute w-[50%] h-[50%] rounded-full border border-black/45 pointer-events-none" />

          {/* Small Inner Black Ring (500m range) */}
          <div className="absolute w-[25%] h-[25%] rounded-full border border-black/55 pointer-events-none" />

          {/* Center Mini Black Ring */}
          <div className="absolute w-[12%] h-[12%] rounded-full border border-black/60 pointer-events-none" />

          {/* Subtle Black Crosshair Lines */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-full h-[1px] bg-black/20" />
            <div className="h-full w-[1px] bg-black/20 absolute" />
          </div>

          {/* Radar Range Labels in Black font */}
          <span className="absolute top-2 left-1/2 -translate-x-1/2 text-[8px] font-mono-num font-black text-black/70 pointer-events-none">
            1.5km
          </span>
          <span className="absolute top-[23%] left-1/2 -translate-x-1/2 text-[7.5px] font-mono-num font-black text-black/65 pointer-events-none">
            1.0km
          </span>
          <span className="absolute top-[36%] left-1/2 -translate-x-1/2 text-[7px] font-mono-num font-black text-black/60 pointer-events-none">
            500m
          </span>

          {/* ================================================================================= */}
          {/* SOFT LIGHT AMBER SEARCH FOCUS LIGHT BEAM (CLEAN FOCUS LIGHT)                      */}
          {/* ================================================================================= */}
          <div
            className="absolute inset-0 rounded-full pointer-events-none origin-center"
            style={{
              animation: 'searchlight-sweep 3s linear infinite',
            }}
          >
            {/* Soft Light Amber Focus Fan (~85° aperture) */}
            <div
              className="absolute inset-0 rounded-full"
              style={{
                background:
                  'conic-gradient(from 0deg, transparent 0deg, transparent 270deg, rgba(251, 191, 36, 0.04) 275deg, rgba(251, 191, 36, 0.15) 310deg, rgba(251, 191, 36, 0.30) 345deg, rgba(245, 158, 11, 0.60) 360deg)',
                filter: 'drop-shadow(0 0 12px rgba(251, 191, 36, 0.45))',
              }}
            />

            {/* Leading Soft Golden Ray */}
            <div
              className="absolute top-0 left-1/2 w-[2px] h-1/2 -translate-x-1/2 origin-bottom bg-gradient-to-t from-amber-500/80 via-amber-300 to-amber-100"
              style={{
                boxShadow: '0 0 8px #fde047, 0 0 14px #f59e0b',
              }}
            />

            {/* Outer Soft Light Lens Bead */}
            <div
              className="absolute top-0.5 left-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-amber-300 border-2 border-black"
              style={{
                boxShadow: '0 0 10px 2px #fde047',
              }}
            />
          </div>

          {/* ======================================================== */}
          {/* REAL-TIME CAPTAIN TARGETS (SHOWN ONLY WHEN CAPTAINS LIVE)*/}
          {/* ======================================================== */}
          {realTimeTargets.map((cap) => {
            const rad = ((cap.angleDeg - 90) * Math.PI) / 180;
            const rPercent = (cap.radiusPercent / 100) * 44;
            const xPercent = 50 + rPercent * Math.cos(rad);
            const yPercent = 50 + rPercent * Math.sin(rad);

            // Check if captain is inside the light amber search focus cone (~85 deg)
            const diff = (currentAngle - cap.angleDeg + 360) % 360;
            const isLit = diff <= 85 || diff >= 355;

            return (
              <div
                key={cap.id}
                className="absolute z-20 flex flex-col items-center pointer-events-none transition-all duration-300"
                style={{
                  left: `${xPercent}%`,
                  top: `${yPercent}%`,
                  transform: 'translate(-50%, -50%)',
                }}
              >
                {/* Captain Node with Soft Amber Glow */}
                <div className="relative flex items-center justify-center">
                  {isLit && (
                    <span
                      className="animate-ping absolute inline-flex h-7 w-7 rounded-full bg-amber-400 opacity-75"
                      style={{ animationDuration: '1.6s' }}
                    />
                  )}
                  <div
                    className={`relative rounded-full transition-all duration-300 flex items-center justify-center ${
                      isLit
                        ? 'w-7 h-7 bg-amber-500 text-slate-950 shadow-[0_0_16px_#f59e0b] scale-110 ring-2 ring-black'
                        : 'w-6 h-6 bg-slate-900 text-amber-400 shadow-md border-2 border-black scale-100 opacity-85'
                    }`}
                  >
                    <Bike className={`stroke-[2.5] ${isLit ? 'w-4 h-4 text-slate-950' : 'w-3.5 h-3.5 text-amber-400'}`} />
                  </div>
                </div>

                {/* Proximity Tag */}
                <div
                  className={`mt-1 px-1.5 py-0.5 rounded-md text-[7.5px] font-mono font-black shadow-sm flex items-center gap-1 whitespace-nowrap transition-all duration-300 ${
                    isLit
                      ? 'bg-slate-950 text-amber-300 border border-amber-400 shadow-[0_0_10px_rgba(245,158,11,0.5)] scale-105'
                      : 'bg-white border border-black/60 text-slate-900 scale-95'
                  }`}
                >
                  <span className="font-sans font-bold">{cap.name}</span>
                  <span className={isLit ? 'text-amber-400' : 'text-slate-400'}>•</span>
                  <span className={isLit ? 'text-amber-300 font-black' : 'text-black font-black'}>
                    {cap.distance}
                  </span>
                  {cap.rating && (
                    <span className="flex items-center text-amber-500">
                      <Star className="w-2 h-2 fill-amber-400 inline" />
                      {cap.rating}
                    </span>
                  )}
                </div>
              </div>
            );
          })}

          {/* ======================================================== */}
          {/* CENTER ROUND SMALL POINT (PASSENGER LOCATION)            */}
          {/* ======================================================== */}
          <div className="relative z-30 flex items-center justify-center">
            {/* Outer Soft Pulse Aura */}
            <div className="absolute w-7 h-7 rounded-full bg-amber-500/25 animate-ping pointer-events-none" />

            {/* Small Center Dot Bezel with Black Border */}
            <div className="relative w-4 h-4 rounded-full bg-amber-500 border-2 border-black shadow-[0_0_10px_rgba(245,158,11,0.7)] flex items-center justify-center">
              {/* Inner Core Point */}
              <div className="w-1.5 h-1.5 rounded-full bg-slate-950" />
            </div>

            {/* Small subtle label tag */}
            <div className="absolute -bottom-4 px-1.5 py-0.2 rounded-full bg-black text-amber-400 text-[7px] font-black tracking-wider uppercase font-mono shadow-xs border border-amber-400/60">
              YOU
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Focus Status & Transmission Feedback */}
      <div className="w-full max-w-sm flex flex-col items-center gap-2 px-3 mt-1">
        {/* Equalizer Transmission Pulse in Amber / Gold */}
        <div className="flex items-center gap-1.5 py-1 px-3 rounded-full bg-amber-50 border border-amber-300 shadow-2xs">
          <span className="text-[10px] font-black uppercase text-amber-950 tracking-wide flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-amber-600" />
            Radar Broadcast:
          </span>
          <div className="flex items-end gap-1 h-3 px-1">
            <span className="w-1 bg-amber-500 rounded-full animate-pulse" style={{ height: '75%', animationDuration: '0.5s' }} />
            <span className="w-1 bg-amber-600 rounded-full animate-pulse" style={{ height: '100%', animationDuration: '0.35s' }} />
            <span className="w-1 bg-yellow-500 rounded-full animate-pulse" style={{ height: '60%', animationDuration: '0.6s' }} />
            <span className="w-1 bg-amber-500 rounded-full animate-pulse" style={{ height: '90%', animationDuration: '0.45s' }} />
            <span className="w-1 bg-amber-600 rounded-full animate-pulse" style={{ height: '70%', animationDuration: '0.5s' }} />
          </div>
          <span className="text-[10px] font-mono-num font-black text-amber-700">
            {realTimeTargets.length} {realTimeTargets.length === 1 ? 'Captain' : 'Captains'} In Range
          </span>
        </div>

        {/* Informative Subtext */}
        <p className="text-xs text-slate-600 font-medium leading-relaxed max-w-xs">
          Broadcasting pickup location to nearby verified captains. When a captain accepts or sends an offer, their details will display with a <span className="text-slate-950 font-black">25-second countdown timer</span>.
        </p>

        {/* Cancel Button */}
        {onCancel && (
          <div className="w-full mt-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onCancel}
              disabled={isCancelling}
              className="w-full py-2.5 px-4 rounded-2xl bg-slate-100 hover:bg-slate-200 border border-black text-black font-black text-xs flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-[0.98] shadow-xs disabled:opacity-50"
              aria-label="Cancel Ride Request"
            >
              <XCircle className="w-4 h-4 text-black shrink-0" />
              <span>{isCancelling ? 'Cancelling Request...' : 'Cancel Ride Request'}</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
