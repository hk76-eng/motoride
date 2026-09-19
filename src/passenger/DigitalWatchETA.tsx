import React, { useState, useEffect, useMemo } from 'react';
import { Clock, Navigation, MapPin, Bike, Radio, Zap, ShieldCheck, Timer, ChevronRight } from 'lucide-react';
import { calculateHaversineDistanceKm } from '../utils/distanceCalculator';
import { MotorideRide } from '../types/motoride';

interface DigitalWatchETAProps {
  ride: MotorideRide;
  captainLat?: number | null;
  captainLng?: number | null;
  variant?: 'card-header' | 'floating-top';
  onExpandCard?: () => void;
}

export const DigitalWatchETA: React.FC<DigitalWatchETAProps> = ({
  ride,
  captainLat,
  captainLng,
  variant = 'card-header',
  onExpandCard,
}) => {
  const [currentClockTime, setCurrentClockTime] = useState<string>('');
  const [colonBlink, setColonBlink] = useState<boolean>(true);
  const [countdownSeconds, setCountdownSeconds] = useState<number>(180);

  // Maintain real-time digital clock (HH:MM:SS AM/PM) & colon pulse
  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      const timeStr = now.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
      });
      setCurrentClockTime(timeStr);
      setColonBlink((prev) => !prev);
    };

    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, []);

  const isAccepted = ride.status === 'captain_accepted';
  const isArrived = ride.status === 'captain_arrived';
  const isTripStarted = ride.status === 'trip_started';

  // Calculate real-time distance from captain to Target (Location A for pickup, Location B for dropoff)
  const targetLat = isTripStarted ? ride.dropoff_lat : ride.pickup_lat;
  const targetLng = isTripStarted ? ride.dropoff_lng : ride.pickup_lng;
  const targetLabel = isTripStarted ? 'Drop-off (Location B)' : 'Pickup (Location A)';
  const targetAddress = isTripStarted ? ride.dropoff_address : ride.pickup_address;

  const currentCapLat = captainLat ?? ride.captain_current_lat ?? (isAccepted ? ride.pickup_lat - 0.005 : ride.pickup_lat);
  const currentCapLng = captainLng ?? ride.captain_current_lng ?? (isAccepted ? ride.pickup_lng - 0.004 : ride.pickup_lng);

  const distanceKm = useMemo(() => {
    if (!currentCapLat || !currentCapLng || !targetLat || !targetLng) return 0.8;
    return calculateHaversineDistanceKm(currentCapLat, currentCapLng, targetLat, targetLng);
  }, [currentCapLat, currentCapLng, targetLat, targetLng]);

  // Synchronize countdown seconds with live distance (avg city bike speed ~26 km/h)
  useEffect(() => {
    if (isArrived) {
      setCountdownSeconds(0);
      return;
    }
    // Estimated time in seconds = (distance / 25 km/h) * 3600
    const calculatedSec = Math.max(15, Math.round((distanceKm / 25) * 3600));
    setCountdownSeconds((prev) => {
      // Smooth transition
      if (Math.abs(prev - calculatedSec) > 30) {
        return calculatedSec;
      }
      return Math.max(5, prev);
    });
  }, [distanceKm, isArrived]);

  // Dynamic seconds tick down
  useEffect(() => {
    if (isArrived) return;
    const timer = setInterval(() => {
      setCountdownSeconds((prev) => (prev > 1 ? prev - 1 : 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [isArrived]);

  // Format MM:SS for digital watch LCD
  const minutes = Math.floor(countdownSeconds / 60);
  const seconds = countdownSeconds % 60;
  const formattedMinutes = String(minutes).padStart(2, '0');
  const formattedSeconds = String(seconds).padStart(2, '0');

  // Calculate expected clock time of arrival
  const expectedArrivalTime = useMemo(() => {
    const arrivalDate = new Date(Date.now() + countdownSeconds * 1000);
    return arrivalDate.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  }, [countdownSeconds]);

  const distanceFormatted = distanceKm < 1 
    ? `${Math.round(distanceKm * 1000)} m` 
    : `${distanceKm.toFixed(1)} km`;

  // ----------------------------------------------------
  // Variant 1: Floating Top Digital Watch HUD
  // ----------------------------------------------------
  if (variant === 'floating-top') {
    return (
      <div 
        onClick={onExpandCard}
        className="cursor-pointer group select-none animate-in fade-in slide-in-from-top-3 duration-300"
        title="Click to view full ride details"
      >
        <div className="relative flex items-center gap-3 px-3.5 py-2 rounded-2xl bg-slate-950/95 border-2 border-emerald-500 shadow-[0_10px_30px_rgba(0,0,0,0.8),0_0_20px_rgba(16,185,129,0.3)] backdrop-blur-xl text-white">
          {/* Watch Lug Accent / Bezel Indicator */}
          <div className="flex items-center gap-1.5 shrink-0">
            <div className="relative flex items-center justify-center w-8 h-8 rounded-xl bg-slate-900 border border-emerald-500/50 shadow-inner">
              <Timer className="w-4 h-4 text-emerald-400 animate-pulse" />
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping opacity-75" />
            </div>
          </div>

          {/* Center Digital Time HUD */}
          <div className="flex flex-col min-w-0 pr-1">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-wider text-emerald-400 flex items-center gap-1">
                <Radio className="w-2.5 h-2.5 animate-pulse text-emerald-400" />
                {isArrived ? 'Captain At Location A' : isTripStarted ? 'Trip To Dropoff (B)' : 'Captain Coming to (A)'}
              </span>
              <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-950/80 text-emerald-300 font-mono font-bold border border-emerald-800/60">
                {distanceFormatted}
              </span>
            </div>

            {/* Digital Watch Monospace Digits */}
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-xs text-slate-400 font-bold uppercase tracking-tight">ETA:</span>
              <div className="font-mono text-base font-black tracking-widest text-white drop-shadow-[0_0_8px_rgba(52,211,153,0.8)]">
                {isArrived ? (
                  <span className="text-emerald-400 font-black">ARRIVED</span>
                ) : (
                  <>
                    <span>{formattedMinutes}</span>
                    <span className={colonBlink ? 'opacity-100 text-emerald-400' : 'opacity-20 text-emerald-400'}>:</span>
                    <span>{formattedSeconds}</span>
                    <span className="text-[10px] text-emerald-400 font-bold ml-1">MIN</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Right Clock & Expand Indicator */}
          <div className="flex items-center gap-2 border-l border-slate-800 pl-2.5 shrink-0">
            <div className="text-right hidden sm:flex flex-col">
              <span className="text-[9px] text-slate-400 font-mono font-medium">By {expectedArrivalTime}</span>
              <span className="text-[10px] text-slate-200 font-mono font-bold">{currentClockTime.split(' ')[0]}</span>
            </div>
            <div className="w-6 h-6 rounded-lg bg-emerald-500/20 text-emerald-300 flex items-center justify-center group-hover:bg-emerald-500 group-hover:text-slate-950 transition-colors">
              <ChevronRight className="w-3.5 h-3.5 stroke-[2.5]" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ----------------------------------------------------
  // Variant 2: Full Digital Watch on Top of Ride Details Card
  // ----------------------------------------------------
  return (
    <div className="w-full relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-black border-2 border-black shadow-[0_12px_36px_rgba(0,0,0,0.4)] text-white p-4 sm:p-5 select-none animate-in fade-in duration-200">
      {/* Background Watch Grid & Bezel Glow */}
      <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#10b981_1px,transparent_1px)] [background-size:12px_12px] pointer-events-none" />
      <div className="absolute -top-10 -right-10 w-40 h-40 bg-emerald-500/15 rounded-full blur-2xl pointer-events-none" />

      {/* Top Header Row of Digital Watch: Smartwatch status bar */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-800/80 relative z-10">
        <div className="flex items-center gap-2">
          <div className="relative flex items-center justify-center w-7 h-7 rounded-xl bg-slate-800 border border-slate-700">
            <Clock className="w-3.5 h-3.5 text-emerald-400" />
            <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
          </div>
          <div>
            <span className="text-[10px] font-black uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
              <Radio className="w-2.5 h-2.5 animate-pulse text-emerald-400" />
              DIGITAL LIVE ETA WATCH
            </span>
            <p className="text-[11px] text-slate-300 font-bold truncate">
              {isArrived ? 'Captain Has Reached Location A' : isTripStarted ? 'En Route To Destination (B)' : 'Captain Coming To Pickup (A)'}
            </p>
          </div>
        </div>

        {/* Live Digital Clock Time Display */}
        <div className="text-right">
          <div className="flex items-center gap-1 bg-slate-900/90 px-2.5 py-1 rounded-xl border border-slate-800 font-mono text-[11px] font-bold text-slate-200 shadow-inner">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span>{currentClockTime || '--:--:-- --'}</span>
          </div>
        </div>
      </div>

      {/* Digital Watch Face Display Main Screen */}
      <div className="my-3.5 p-4 rounded-2xl bg-black/90 border-2 border-emerald-500/50 shadow-[inset_0_4px_16px_rgba(0,0,0,0.9),0_0_24px_rgba(16,185,129,0.15)] relative z-10">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          
          {/* Main Digital Watch Digits */}
          <div className="flex flex-col">
            <span className="text-[10px] font-mono font-bold tracking-widest text-emerald-400/90 uppercase flex items-center gap-1">
              <Zap className="w-3 h-3 text-emerald-400 fill-emerald-400" />
              {isArrived ? 'STATUS' : 'ESTIMATED TIME OF ARRIVAL'}
            </span>

            <div className="flex items-baseline gap-2 mt-1">
              {isArrived ? (
                <div className="flex items-center gap-2">
                  <span className="font-mono text-2xl sm:text-3xl font-black tracking-widest text-emerald-400 drop-shadow-[0_0_12px_rgba(52,211,153,0.9)]">
                    ARRIVED AT (A)
                  </span>
                </div>
              ) : (
                <div className="flex items-baseline font-mono text-3xl sm:text-4xl font-black tracking-widest text-white drop-shadow-[0_0_12px_rgba(52,211,153,0.8)]">
                  <span className="bg-slate-900/80 px-2 py-0.5 rounded-lg border border-emerald-500/30 text-emerald-300">
                    {formattedMinutes}
                  </span>
                  <span className={`mx-1 text-emerald-400 ${colonBlink ? 'opacity-100' : 'opacity-30'}`}>:</span>
                  <span className="bg-slate-900/80 px-2 py-0.5 rounded-lg border border-emerald-500/30 text-emerald-300">
                    {formattedSeconds}
                  </span>
                  <span className="text-xs sm:text-sm font-sans font-black text-emerald-400 ml-2 tracking-normal uppercase">
                    MINS
                  </span>
                </div>
              )}
            </div>

            <div className="text-[11px] text-slate-400 font-mono mt-1 flex items-center gap-1.5">
              <span>Expected Arrival:</span>
              <span className="text-emerald-300 font-bold">{expectedArrivalTime}</span>
              <span>•</span>
              <span className="text-slate-300">{distanceFormatted} away</span>
            </div>
          </div>

          {/* Captain & Vehicle Fast Info Pill inside Watch */}
          <div className="flex sm:flex-col items-center sm:items-end justify-between border-t sm:border-t-0 sm:border-l border-slate-800 pt-2.5 sm:pt-0 sm:pl-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center justify-center font-bold text-sm">
                🏍️
              </div>
              <div className="text-left sm:text-right">
                <span className="text-xs font-black text-white block">
                  {ride.captain_name || 'Captain'}
                </span>
                <span className="text-[10px] text-emerald-400 font-mono font-bold block">
                  {ride.plate_number || 'PB65AA1257'}
                </span>
              </div>
            </div>

            <div className="mt-1 flex items-center gap-1 text-[10px] font-mono text-slate-400 bg-slate-900 px-2 py-0.5 rounded-md border border-slate-800">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              <span>Speed: ~28 km/h</span>
            </div>
          </div>

        </div>
      </div>

      {/* Target Location Footer inside Digital Watch */}
      <div className="flex items-center justify-between text-xs text-slate-300 bg-slate-900/80 px-3.5 py-2.5 rounded-2xl border border-slate-800 relative z-10">
        <div className="flex items-center gap-2 min-w-0 pr-2">
          <div className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center shrink-0 text-[10px] font-black">
            A
          </div>
          <div className="truncate">
            <span className="text-slate-400 font-bold text-[10px] block uppercase">{targetLabel}:</span>
            <span className="font-bold text-white text-xs truncate block">{targetAddress}</span>
          </div>
        </div>

        <div className="shrink-0 flex items-center gap-1.5 text-emerald-400 font-mono font-bold text-xs bg-emerald-950/60 px-2 py-1 rounded-xl border border-emerald-800/80">
          <Navigation className="w-3.5 h-3.5 animate-bounce" />
          <span>{distanceFormatted}</span>
        </div>
      </div>
    </div>
  );
};
