import React, { useEffect, useState } from 'react';
import { Radio, XCircle, Bike, Sparkles, Star, Target } from 'lucide-react';

interface TripInDriveRadarProps {
  onCancel?: () => void;
  isCancelling?: boolean;
  offeredFare?: number;
  rideCode?: string;
  nearbyCaptainsCount?: number;
}

interface NearbyCaptainTarget {
  id: string;
  name: string;
  distance: string;
  rating: string;
  angleDeg: number;
  radiusPercent: number; // 0 to 100%
  vehicle: string;
}

const SAMPLE_CAPTAINS: NearbyCaptainTarget[] = [
  { id: '1', name: 'Vikram', distance: '320m', rating: '4.9', angleDeg: 38, radiusPercent: 54, vehicle: 'Honda Shine' },
  { id: '2', name: 'Rahul', distance: '540m', rating: '4.8', angleDeg: 125, radiusPercent: 72, vehicle: 'Splendor Plus' },
  { id: '3', name: 'Aman', distance: '780m', rating: '4.9', angleDeg: 215, radiusPercent: 84, vehicle: 'Bajaj Pulsar' },
  { id: '4', name: 'Rohit', distance: '410m', rating: '4.7', angleDeg: 305, radiusPercent: 46, vehicle: 'TVS Raider' },
];

export const TripInDriveRadar: React.FC<TripInDriveRadarProps> = ({
  onCancel,
  isCancelling = false,
  rideCode,
  nearbyCaptainsCount = 4,
}) => {
  // Real-time sweeping angle to illuminate captains inside the soft light amber focus light
  const [currentAngle, setCurrentAngle] = useState<number>(0);

  useEffect(() => {
    let animFrame: number;
    const startTime = Date.now();
    const DURATION = 3000; // 3.0s per complete 360 sweep

    const update = () => {
      const elapsed = Date.now() - startTime;
      const angle = ((elapsed % DURATION) / DURATION) * 360;
      setCurrentAngle(angle);
      animFrame = requestAnimationFrame(update);
    };

    animFrame = requestAnimationFrame(update);
    return () => cancelAnimationFrame(animFrame);
  }, []);

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
            {nearbyCaptainsCount} Captains in Radar
          </span>
          {rideCode && (
            <>
              <span className="text-slate-300">•</span>
              <span className="font-mono text-slate-500 font-bold">#{rideCode}</span>
            </>
          )}
        </div>
      </div>

      {/* Main Radar Scope Container - Pure White Canvas with Black Rings and Soft Light Amber Focus Beam */}
      <div className="my-auto py-2 flex flex-col items-center justify-center">
        {/* Radar Circular Housing - Pure White Canvas with Solid Black Outer Rim */}
        <div className="relative w-56 h-56 sm:w-64 sm:h-64 rounded-full bg-white border-2 border-black shadow-[0_8px_30px_rgba(0,0,0,0.14)] flex items-center justify-center overflow-hidden">
          {/* Subtle Ambient Radial Soft Amber Glow */}
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(251,191,36,0.08)_0%,rgba(254,243,199,0.35)_55%,transparent_80%)] pointer-events-none" />

          {/* Compass Tick Indicators in Crisp Black */}
          <span className="absolute top-1.5 left-1/2 -translate-x-1/2 text-[8px] font-black text-black font-mono tracking-widest z-10">
            N
          </span>
          <span className="absolute bottom-1.5 left-1/2 -translate-x-1/2 text-[8px] font-black text-black font-mono tracking-widest z-10">
            S
          </span>
          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[8px] font-black text-black font-mono tracking-widest z-10">
            E
          </span>
          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[8px] font-black text-black font-mono tracking-widest z-10">
            W
          </span>

          {/* Azimuth Crosshairs in Black */}
          <div className="absolute w-full h-[1px] bg-black/35 top-1/2 left-0 -translate-y-1/2 pointer-events-none" />
          <div className="absolute h-full w-[1px] bg-black/35 left-1/2 top-0 -translate-x-1/2 pointer-events-none" />

          {/* Diagonal Guideline Crosshairs in Black */}
          <div className="absolute w-full h-[1px] bg-black/20 top-1/2 left-0 -translate-y-1/2 rotate-45 pointer-events-none" />
          <div className="absolute w-full h-[1px] bg-black/20 top-1/2 left-0 -translate-y-1/2 -rotate-45 pointer-events-none" />

          {/* Range Grid Concentric Circles (Radar Rings in Solid Black) */}
          {/* Outer Boundary Ring: 1.5 km */}
          <div className="absolute inset-2.5 rounded-full border border-black/40 pointer-events-none" />

          {/* 1.0 km Ring in Black */}
          <div className="absolute w-[76%] h-[76%] rounded-full border border-black/50 border-dashed pointer-events-none flex items-center justify-center">
            <span className="absolute -top-2 left-1/2 -translate-x-1/2 text-[7px] font-mono font-black text-black bg-white px-1">
              1.0 km
            </span>
          </div>

          {/* 500m Ring in Black */}
          <div className="absolute w-[48%] h-[48%] rounded-full border border-black/60 pointer-events-none flex items-center justify-center">
            <span className="absolute -top-2 left-1/2 -translate-x-1/2 text-[7px] font-mono font-black text-black bg-white px-1">
              500 m
            </span>
          </div>

          {/* Concentric Pulse Waves Expanding from Center Round Small Point */}
          <div
            className="absolute w-12 h-12 rounded-full border border-black/35 animate-ping pointer-events-none"
            style={{ animationDuration: '2s' }}
          />
          <div
            className="absolute w-24 h-24 rounded-full border border-amber-400/35 animate-ping pointer-events-none"
            style={{ animationDuration: '2.8s', animationDelay: '0.7s' }}
          />
          <div
            className="absolute w-40 h-40 rounded-full border border-black/20 animate-ping pointer-events-none"
            style={{ animationDuration: '3.6s', animationDelay: '1.4s' }}
          />

          {/* ================================================================================= */}
          {/* SOFT LIGHT AMBER SEARCH FOCUS LIGHT BEAM (SAME HUE, LIGHT RADIANT ILLUMINATION)   */}
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
                  'conic-gradient(from 0deg, transparent 0deg, transparent 270deg, rgba(251, 191, 36, 0.03) 275deg, rgba(251, 191, 36, 0.12) 310deg, rgba(251, 191, 36, 0.28) 345deg, rgba(245, 158, 11, 0.55) 360deg)',
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
          {/* CAPTAIN TARGETS ILLUMINATING IN LIGHT AMBER FOCUS LIGHT  */}
          {/* ======================================================== */}
          {SAMPLE_CAPTAINS.map((cap) => {
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
                      : 'bg-white border border-black/40 text-slate-900 scale-95'
                  }`}
                >
                  <span className="font-sans font-bold">{cap.name}</span>
                  <span className={isLit ? 'text-amber-400' : 'text-slate-400'}>•</span>
                  <span className={isLit ? 'text-amber-300 font-black' : 'text-black font-black'}>
                    {cap.distance}
                  </span>
                  <span className="flex items-center text-amber-500">
                    <Star className="w-2 h-2 fill-amber-400 inline" />
                    {cap.rating}
                  </span>
                </div>
              </div>
            );
          })}

          {/* ======================================================== */}
          {/* CENTER ROUND SMALL POINT (PASSENGER LOCATION)            */}
          {/* ======================================================== */}
          <div className="relative z-30 flex items-center justify-center">
            {/* Outer Small Pulse Aura */}
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
            {nearbyCaptainsCount} Captains In Range
          </span>
        </div>

        {/* Informative Subtext */}
        <p className="text-xs text-slate-600 font-medium leading-relaxed max-w-xs">
          Broadcasting pickup location to nearby captains. When a captain accepts or sends an offer, their details will display with a <span className="text-slate-950 font-black">25-second countdown timer</span>.
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
