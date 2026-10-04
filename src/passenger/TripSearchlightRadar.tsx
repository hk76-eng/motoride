import React, { useEffect, useState } from 'react';
import { Radar, Radio, XCircle, Bike, Zap } from 'lucide-react';

interface TripSearchlightRadarProps {
  onCancel?: () => void;
  isCancelling?: boolean;
  offeredFare?: number;
  rideCode?: string;
  nearbyCaptainsCount?: number;
  nearbyCaptains?: Array<{
    id: string;
    name: string;
    distanceText?: string;
    distKm?: number;
    rPercent?: number;
    xPercent?: number;
    yPercent?: number;
  }>;
}

export const TripSearchlightRadar: React.FC<TripSearchlightRadarProps> = ({
  onCancel,
  isCancelling = false,
  offeredFare,
  rideCode,
  nearbyCaptainsCount = 3,
  nearbyCaptains = [],
}) => {
  // Live dynamic azimuth bearing angle for real-time telemetry HUD
  const [bearing, setBearing] = useState<number>(12);

  useEffect(() => {
    const interval = setInterval(() => {
      setBearing((prev) => (prev + 9) % 360);
    }, 120);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex-1 flex flex-col items-center justify-between py-2 sm:py-3 text-center text-slate-900 w-full h-full select-none bg-white">
      {/* Top Telemetry & Status HUD Header */}
      <div className="w-full flex flex-col items-center gap-1.5 px-2">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-100 border border-black/20 shadow-xs">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-600 shadow-[0_0_8px_#10b981]" />
          </span>
          <span className="text-[11px] font-black tracking-wider uppercase text-black font-mono-num">
            BIKE RADAR PULSE ACTIVE
          </span>
        </div>

        <div className="flex items-center gap-3 text-[11px] text-slate-600 font-bold">
          <span className="flex items-center gap-1 font-mono-num text-black">
            <Radio className="w-3.5 h-3.5 text-emerald-600 animate-pulse" />
            <span>AZM {bearing.toString().padStart(3, '0')}°</span>
          </span>
          <span className="text-slate-300">•</span>
          <span className="text-black font-black">
            RANGE: 2.0 KM
          </span>
          {rideCode && (
            <>
              <span className="text-slate-300">•</span>
              <span className="font-mono text-slate-600 font-bold">#{rideCode}</span>
            </>
          )}
        </div>
      </div>

      {/* Main Concentric Sonar Radar Scope Body with Black Rings (No searchlight, No black background) */}
      <div className="my-auto py-2 flex flex-col items-center justify-center">
        {/* The Circular Radar Scope with Pure White Canvas & Black Rings */}
        <div className="relative w-56 h-56 sm:w-64 sm:h-64 rounded-full bg-white border-2 border-black shadow-[0_4px_30px_rgba(0,0,0,0.12)] flex items-center justify-center overflow-hidden">
          {/* Subtle Ambient Radial Soft Glow */}
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(0,0,0,0.03)_0%,rgba(0,0,0,0.01)_50%,transparent_80%)] pointer-events-none" />

          {/* Compass Cardinal Points in Black */}
          <span className="absolute top-2 left-1/2 -translate-x-1/2 text-[9px] font-black text-black font-mono tracking-widest z-10 pointer-events-none">
            N
          </span>
          <span className="absolute bottom-2 left-1/2 -translate-x-1/2 text-[9px] font-black text-black/70 font-mono tracking-widest z-10 pointer-events-none">
            S
          </span>
          <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[9px] font-black text-black/70 font-mono tracking-widest z-10 pointer-events-none">
            E
          </span>
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[9px] font-black text-black/70 font-mono tracking-widest z-10 pointer-events-none">
            W
          </span>

          {/* Azimuth Crosshairs in Black */}
          <div className="absolute w-full h-[1px] bg-black/20 top-1/2 left-0 -translate-y-1/2 pointer-events-none" />
          <div className="absolute h-full w-[1px] bg-black/20 left-1/2 top-0 -translate-x-1/2 pointer-events-none" />

          {/* Concentric Range Rings in Solid Black */}
          <div className="absolute inset-3 rounded-full border border-black/35 pointer-events-none" />
          <div className="absolute w-[66%] h-[66%] rounded-full border border-black/40 border-dashed pointer-events-none flex items-center justify-center">
            <span className="absolute -top-2 left-1/2 -translate-x-1/2 text-[8px] font-mono font-bold text-black bg-white px-1 shadow-2xs rounded border border-black/30">
              1.0 km
            </span>
          </div>

          {/* ======================================================== */}
          {/* CONCENTRIC EXPANDING PULSE WAVES IN BLACK                */}
          {/* ======================================================== */}
          <div className="absolute w-14 h-14 rounded-full border-2 border-black/50 animate-ping pointer-events-none" style={{ animationDuration: '2s' }} />
          <div className="absolute w-28 h-28 rounded-full border-2 border-black/35 animate-ping pointer-events-none" style={{ animationDuration: '2.8s', animationDelay: '0.7s' }} />
          <div className="absolute w-44 h-44 rounded-full border-2 border-black/25 animate-ping pointer-events-none" style={{ animationDuration: '3.6s', animationDelay: '1.4s' }} />
          <div className="absolute w-60 h-60 rounded-full border border-black/15 animate-ping pointer-events-none" style={{ animationDuration: '4.4s', animationDelay: '2.1s' }} />

          {/* Detected Captain Target Blips */}
          {nearbyCaptains && nearbyCaptains.length > 0 ? (
            nearbyCaptains.map((cap, idx) => {
              const angle = (idx * 137.5) % 360;
              const rad = (angle * Math.PI) / 180;
              const radiusPct = Math.min(38, Math.max(12, (cap.distKm || 0.5) * 28));
              const leftPos = 50 + radiusPct * Math.cos(rad);
              const topPos = 50 + radiusPct * Math.sin(rad);

              return (
                <div
                  key={cap.id || idx}
                  className="absolute z-20 flex flex-col items-center -translate-x-1/2 -translate-y-1/2 transition-all duration-700"
                  style={{ left: `${leftPos}%`, top: `${topPos}%` }}
                >
                  <div className="relative flex items-center justify-center">
                    <span className="animate-ping absolute inline-flex h-5 w-5 rounded-full bg-emerald-500 opacity-60" style={{ animationDuration: '1.8s' }} />
                    <span className="relative w-4 h-4 rounded-full bg-emerald-600 shadow-[0_0_10px_#10b981] border-2 border-black flex items-center justify-center">
                      <Bike className="w-2.5 h-2.5 text-white stroke-[2.5]" />
                    </span>
                  </div>
                  <div className="mt-0.5 px-1.5 py-0.5 rounded-md bg-white border border-black text-[8px] font-mono font-black text-black shadow-md flex items-center gap-1 whitespace-nowrap">
                    <Bike className="w-2.5 h-2.5 text-emerald-600 stroke-[2.5]" />
                    <span>{cap.distanceText || (cap.distKm ? `${cap.distKm.toFixed(1)}km` : '20m')}</span>
                  </div>
                </div>
              );
            })
          ) : (
            <>
              <div className="absolute top-[28%] right-[28%] z-20 flex flex-col items-center">
                <div className="relative flex items-center justify-center">
                  <span className="animate-ping absolute inline-flex h-4 w-4 rounded-full bg-emerald-500 opacity-60" />
                  <span className="relative w-3.5 h-3.5 rounded-full bg-emerald-600 shadow-[0_0_8px_#10b981] border-2 border-black flex items-center justify-center">
                    <Bike className="w-2 h-2 text-white stroke-[2.5]" />
                  </span>
                </div>
                <div className="mt-0.5 px-1.5 py-0.5 rounded bg-white border border-black text-[8px] font-mono font-black text-black shadow-sm flex items-center gap-0.5">
                  <Bike className="w-2 h-2 text-emerald-600" />
                  <span>20m</span>
                </div>
              </div>
              <div className="absolute bottom-[32%] left-[30%] z-20 flex flex-col items-center">
                <div className="relative flex items-center justify-center">
                  <span className="animate-ping absolute inline-flex h-4 w-4 rounded-full bg-emerald-500 opacity-60" style={{ animationDelay: '0.8s' }} />
                  <span className="relative w-3.5 h-3.5 rounded-full bg-emerald-600 shadow-[0_0_8px_#10b981] border-2 border-black flex items-center justify-center">
                    <Bike className="w-2 h-2 text-white stroke-[2.5]" />
                  </span>
                </div>
                <div className="mt-0.5 px-1.5 py-0.5 rounded bg-white border border-black text-[8px] font-mono font-black text-black shadow-sm flex items-center gap-0.5">
                  <Bike className="w-2 h-2 text-emerald-600" />
                  <span>450m</span>
                </div>
              </div>
            </>
          )}

          {/* ======================================================== */}
          {/* CENTRAL BIKE ICON ANCHOR HUB (BLACK BACKGROUND)          */}
          {/* ======================================================== */}
          <div className="relative z-30 flex items-center justify-center">
            <div className="w-13 h-13 sm:w-15 sm:h-15 rounded-full bg-black border-2 border-black shadow-[0_4px_16px_rgba(0,0,0,0.35)] flex items-center justify-center animate-pulse">
              <Bike className="w-6 h-6 sm:w-7 sm:h-7 text-white stroke-[2.5]" />
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Live Searching Transmission Feedback & Radio Bars */}
      <div className="w-full max-w-sm flex flex-col items-center gap-2 px-3 mt-1">
        <div className="flex items-center gap-1.5 py-1 px-3 rounded-full bg-slate-100 border border-slate-200 shadow-2xs">
          <span className="text-[10px] font-black uppercase text-slate-700 tracking-wide">
            Bike Radar Pulse:
          </span>
          <div className="flex items-end gap-1 h-3 px-1">
            <span className="w-1 bg-emerald-500 rounded-full animate-pulse" style={{ height: '70%', animationDuration: '0.6s' }} />
            <span className="w-1 bg-emerald-500 rounded-full animate-pulse" style={{ height: '100%', animationDuration: '0.4s' }} />
            <span className="w-1 bg-emerald-500 rounded-full animate-pulse" style={{ height: '50%', animationDuration: '0.8s' }} />
            <span className="w-1 bg-emerald-500 rounded-full animate-pulse" style={{ height: '90%', animationDuration: '0.5s' }} />
          </div>
          <span className="text-[10px] font-mono-num font-black text-black">
            {nearbyCaptainsCount} Captains In Range
          </span>
        </div>

        <p className="text-xs text-slate-600 font-medium leading-relaxed max-w-xs">
          Searching for nearby captains with bike radar pulse. Captains can accept or send a counter-offer with a <span className="text-slate-950 font-black">25-second timer</span>.
        </p>
      </div>
    </div>
  );
};
