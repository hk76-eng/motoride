import React, { useEffect, useState } from 'react';
import { Radar, Radio, XCircle, Bike, ShieldCheck, Zap } from 'lucide-react';

interface TripSearchlightRadarProps {
  onCancel?: () => void;
  isCancelling?: boolean;
  offeredFare?: number;
  rideCode?: string;
  nearbyCaptainsCount?: number;
}

export const TripSearchlightRadar: React.FC<TripSearchlightRadarProps> = ({
  onCancel,
  isCancelling = false,
  offeredFare,
  rideCode,
  nearbyCaptainsCount = 3,
}) => {
  // Live dynamic azimuth bearing angle for real-time telemetry HUD
  const [bearing, setBearing] = useState<number>(12);

  useEffect(() => {
    const interval = setInterval(() => {
      setBearing((prev) => (prev + 9) % 360);
    }, 70);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex-1 flex flex-col items-center justify-between py-2 sm:py-3 text-center text-slate-900 w-full h-full select-none">
      {/* Top Telemetry & Status HUD Header */}
      <div className="w-full flex flex-col items-center gap-1.5 px-2">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-950 border border-emerald-500/40 shadow-md">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500 shadow-[0_0_8px_#10b981]" />
          </span>
          <span className="text-[11px] font-black tracking-wider uppercase text-emerald-400 font-mono-num">
            SEARCHLIGHT RADAR ACTIVE
          </span>
        </div>

        <div className="flex items-center gap-3 text-[11px] text-slate-600 font-bold">
          <span className="flex items-center gap-1 font-mono-num">
            <Radio className="w-3 h-3 text-emerald-600 animate-pulse" />
            <span>AZM {bearing.toString().padStart(3, '0')}°</span>
          </span>
          <span className="text-slate-300">•</span>
          <span className="text-emerald-700 font-black">
            RANGE: 3.0 KM
          </span>
          {rideCode && (
            <>
              <span className="text-slate-300">•</span>
              <span className="font-mono text-slate-500 font-bold">#{rideCode}</span>
            </>
          )}
        </div>
      </div>

      {/* Main Searchlight Radar Scope Body */}
      <div className="my-auto py-2 flex flex-col items-center justify-center">
        {/* The Circular Radar Scope with Dark Glass and HUD Reticle */}
        <div className="relative w-52 h-52 sm:w-60 sm:h-60 rounded-full bg-slate-950 border-2 border-emerald-500/40 shadow-[0_0_35px_rgba(16,185,129,0.28)] flex items-center justify-center overflow-hidden">
          {/* Subtle Ambient Radial Phosphor Glow */}
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(16,185,129,0.18)_0%,rgba(6,78,59,0.12)_45%,transparent_75%)] pointer-events-none" />

          {/* Compass Cardinal Points */}
          <span className="absolute top-1.5 left-1/2 -translate-x-1/2 text-[9px] font-black text-emerald-400/90 font-mono tracking-widest z-10">
            N
          </span>
          <span className="absolute bottom-1.5 left-1/2 -translate-x-1/2 text-[9px] font-black text-emerald-500/60 font-mono tracking-widest z-10">
            S
          </span>
          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] font-black text-emerald-500/60 font-mono tracking-widest z-10">
            E
          </span>
          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[9px] font-black text-emerald-500/60 font-mono tracking-widest z-10">
            W
          </span>

          {/* Azimuth Crosshairs */}
          <div className="absolute w-full h-[1px] bg-emerald-500/20 top-1/2 left-0 -translate-y-1/2 pointer-events-none" />
          <div className="absolute h-full w-[1px] bg-emerald-500/20 left-1/2 top-0 -translate-x-1/2 pointer-events-none" />

          {/* Diagonal Reticle Guidelines */}
          <div className="absolute w-full h-[1px] bg-emerald-500/10 top-1/2 left-0 -translate-y-1/2 rotate-45 pointer-events-none" />
          <div className="absolute w-full h-[1px] bg-emerald-500/10 top-1/2 left-0 -translate-y-1/2 -rotate-45 pointer-events-none" />

          {/* Concentric Range Rings with Range Labels */}
          {/* Outer Ring 3.0 KM (Boundary) */}
          <div className="absolute inset-2.5 rounded-full border border-emerald-500/25 pointer-events-none" />

          {/* Middle Ring 2.0 KM */}
          <div className="absolute w-[68%] h-[68%] rounded-full border border-emerald-500/30 border-dashed pointer-events-none flex items-center justify-center">
            <span className="absolute -top-2 left-1/2 -translate-x-1/2 text-[8px] font-mono font-bold text-emerald-400/50 bg-slate-950 px-1">
              2.0 km
            </span>
          </div>

          {/* Inner Ring 1.0 KM */}
          <div className="absolute w-[38%] h-[38%] rounded-full border border-emerald-500/35 pointer-events-none flex items-center justify-center">
            <span className="absolute -top-2 left-1/2 -translate-x-1/2 text-[8px] font-mono font-bold text-emerald-400/50 bg-slate-950 px-1">
              1.0 km
            </span>
          </div>

          {/* Expanding Sonar / Light Wave Pulses radiating from center */}
          <div className="absolute w-12 h-12 rounded-full border border-emerald-400/40 animate-ping pointer-events-none" style={{ animationDuration: '2.4s' }} />
          <div className="absolute w-24 h-24 rounded-full border border-emerald-400/25 animate-ping pointer-events-none" style={{ animationDuration: '3.2s', animationDelay: '0.8s' }} />

          {/* Detected Captain Target Blips (Captains in Range) */}
          {/* Target 1: Northeast (Angle ~42°, ~60% radius -> ~650m) */}
          <div className="absolute top-[28%] right-[24%] z-20 flex flex-col items-center">
            <div className="relative flex items-center justify-center">
              <span className="animate-ping absolute inline-flex h-4 w-4 rounded-full bg-emerald-400 opacity-60" style={{ animationDuration: '1.8s' }} />
              <span className="relative w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-[0_0_10px_#34d399] border border-white" />
            </div>
            <div className="mt-0.5 px-1 py-0.2 rounded bg-slate-900/90 border border-emerald-500/50 text-[7px] font-mono font-black text-emerald-300 shadow-xs flex items-center gap-0.5">
              <Bike className="w-2 h-2 text-emerald-400" />
              <span>450m</span>
            </div>
          </div>

          {/* Target 2: Southeast (Angle ~130°, ~42% radius -> ~380m) */}
          <div className="absolute bottom-[30%] right-[32%] z-20 flex flex-col items-center">
            <div className="relative flex items-center justify-center">
              <span className="animate-ping absolute inline-flex h-4 w-4 rounded-full bg-emerald-400 opacity-60" style={{ animationDuration: '2.1s', animationDelay: '0.6s' }} />
              <span className="relative w-2 h-2 rounded-full bg-emerald-300 shadow-[0_0_8px_#34d399] border border-white" />
            </div>
            <div className="mt-0.5 px-1 py-0.2 rounded bg-slate-900/90 border border-emerald-500/50 text-[7px] font-mono font-black text-emerald-300 shadow-xs flex items-center gap-0.5">
              <Bike className="w-2 h-2 text-emerald-400" />
              <span>380m</span>
            </div>
          </div>

          {/* Target 3: Northwest (Angle ~295°, ~76% radius -> ~890m) */}
          <div className="absolute top-[26%] left-[18%] z-20 flex flex-col items-center">
            <div className="relative flex items-center justify-center">
              <span className="animate-ping absolute inline-flex h-4 w-4 rounded-full bg-emerald-400 opacity-60" style={{ animationDuration: '2.4s', animationDelay: '1.2s' }} />
              <span className="relative w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-[0_0_10px_#34d399] border border-white" />
            </div>
            <div className="mt-0.5 px-1 py-0.2 rounded bg-slate-900/90 border border-emerald-500/50 text-[7px] font-mono font-black text-emerald-300 shadow-xs flex items-center gap-0.5">
              <Bike className="w-2 h-2 text-emerald-400" />
              <span>890m</span>
            </div>
          </div>

          {/* ======================================================== */}
          {/* THE SWEEPING SEARCHLIGHT CONE & HIGH-INTENSITY LIGHT BEAM */}
          {/* ======================================================== */}
          <div
            className="absolute inset-0 rounded-full pointer-events-none origin-center"
            style={{
              animation: 'searchlight-sweep 2.8s linear infinite',
            }}
          >
            {/* 1. Conical Radiant Searchlight Light Fan */}
            <div
              className="absolute inset-0 rounded-full"
              style={{
                background:
                  'conic-gradient(from 0deg, transparent 0deg, transparent 285deg, rgba(16, 185, 129, 0.04) 298deg, rgba(52, 211, 153, 0.22) 330deg, rgba(110, 231, 183, 0.55) 354deg, rgba(255, 255, 255, 0.95) 360deg)',
                filter: 'drop-shadow(0 0 10px rgba(52, 211, 153, 0.6))',
              }}
            />

            {/* 2. Leading High-Intensity Searchlight Ray (from center to perimeter at 360deg) */}
            <div
              className="absolute top-0 left-1/2 w-[2px] h-1/2 -translate-x-1/2 origin-bottom bg-gradient-to-t from-emerald-300 via-emerald-100 to-white"
              style={{
                boxShadow: '0 0 12px #34d399, 0 0 20px #10b981',
              }}
            />

            {/* 3. Outer Focal Spotlight Head (sweeps along the circumference like a searchlight lamp) */}
            <div
              className="absolute top-0.5 left-1/2 -translate-x-1/2 w-3.5 h-3.5 rounded-full bg-white border border-emerald-300"
              style={{
                boxShadow: '0 0 15px 4px #34d399, 0 0 25px 6px rgba(16,185,129,0.8)',
              }}
            />
          </div>

          {/* ======================================================== */}
          {/* CENTRAL SEARCHLIGHT PROJECTOR HOUSING / BEACON HUB */}
          {/* ======================================================== */}
          <div className="relative z-30 flex items-center justify-center">
            {/* Outer Projector Collar */}
            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-slate-900 border-2 border-emerald-400/80 shadow-[0_0_20px_rgba(16,185,129,0.6)] flex items-center justify-center ring-4 ring-emerald-500/20">
              {/* Inner Rotating Reflector Core */}
              <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-black border border-emerald-400 flex items-center justify-center shadow-inner relative overflow-hidden">
                {/* Micro rotating lens flare */}
                <div
                  className="absolute inset-0 bg-gradient-to-tr from-emerald-500/30 to-transparent animate-spin"
                  style={{ animationDuration: '4s' }}
                />
                <Radar className="w-6 h-6 text-emerald-400 animate-pulse stroke-[2.5] relative z-10" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Live Searching Transmission Feedback & Radio Bars */}
      <div className="w-full max-w-sm flex flex-col items-center gap-2 px-3 mt-1">
        {/* Animated Radio Transmission Frequency Equalizer */}
        <div className="flex items-center gap-1.5 py-1 px-3 rounded-full bg-slate-100 border border-slate-200 shadow-2xs">
          <span className="text-[10px] font-black uppercase text-slate-700 tracking-wide">
            RF Transmission:
          </span>
          <div className="flex items-end gap-1 h-3 px-1">
            <span className="w-1 bg-emerald-500 rounded-full animate-pulse" style={{ height: '70%', animationDuration: '0.6s' }} />
            <span className="w-1 bg-emerald-500 rounded-full animate-pulse" style={{ height: '100%', animationDuration: '0.4s' }} />
            <span className="w-1 bg-emerald-500 rounded-full animate-pulse" style={{ height: '50%', animationDuration: '0.8s' }} />
            <span className="w-1 bg-emerald-500 rounded-full animate-pulse" style={{ height: '90%', animationDuration: '0.5s' }} />
            <span className="w-1 bg-emerald-500 rounded-full animate-pulse" style={{ height: '60%', animationDuration: '0.7s' }} />
          </div>
          <span className="text-[10px] font-mono-num font-black text-emerald-600">
            {nearbyCaptainsCount} Captains In Range
          </span>
        </div>

        {/* Informative Subtext */}
        <p className="text-xs text-slate-600 font-medium leading-relaxed max-w-xs">
          Scanning & notifying captains near your pickup point. When a captain accepts or sends a counter-offer, their details will display with a <span className="text-slate-950 font-black">25-second timer</span>.
        </p>

        {/* Offered Fare Confirmation Badge if present */}
        {offeredFare !== undefined && (
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-950 font-black text-xs shadow-2xs">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>Offered Fare: ₹{offeredFare}</span>
          </div>
        )}

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
