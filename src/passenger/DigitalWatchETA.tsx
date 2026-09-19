import React, { useState, useEffect, useMemo } from 'react';
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
  const [colonBlink, setColonBlink] = useState<boolean>(true);
  const [countdownSeconds, setCountdownSeconds] = useState<number>(240);

  // Colon blink every 1 second
  useEffect(() => {
    const interval = setInterval(() => {
      setColonBlink((prev) => !prev);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const isAccepted = ride.status === 'captain_accepted';
  const isArrived = ride.status === 'captain_arrived';
  const isTripStarted = ride.status === 'trip_started';

  // Calculate real-time distance from captain to Target (Location A for pickup, Location B for dropoff)
  const targetLat = isTripStarted ? ride.dropoff_lat : ride.pickup_lat;
  const targetLng = isTripStarted ? ride.dropoff_lng : ride.pickup_lng;

  const currentCapLat = captainLat ?? ride.captain_current_lat ?? (isAccepted ? ride.pickup_lat - 0.005 : ride.pickup_lat);
  const currentCapLng = captainLng ?? ride.captain_current_lng ?? (isAccepted ? ride.pickup_lng - 0.004 : ride.pickup_lng);

  const distanceKm = useMemo(() => {
    if (!currentCapLat || !currentCapLng || !targetLat || !targetLng) return 1.4;
    return calculateHaversineDistanceKm(currentCapLat, currentCapLng, targetLat, targetLng);
  }, [currentCapLat, currentCapLng, targetLat, targetLng]);

  // Synchronize countdown seconds with live distance
  useEffect(() => {
    if (isArrived) {
      setCountdownSeconds(0);
      return;
    }
    const calculatedSec = Math.max(15, Math.round((distanceKm / 24) * 3600));
    setCountdownSeconds((prev) => {
      if (Math.abs(prev - calculatedSec) > 30) {
        return calculatedSec;
      }
      return Math.max(5, prev);
    });
  }, [distanceKm, isArrived]);

  // Dynamic countdown timer
  useEffect(() => {
    if (isArrived) return;
    const timer = setInterval(() => {
      setCountdownSeconds((prev) => (prev > 1 ? prev - 1 : 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [isArrived]);

  // Format MM:SS
  const minutes = Math.floor(countdownSeconds / 60);
  const seconds = countdownSeconds % 60;
  const formattedMinutes = String(minutes).padStart(2, '0');
  const formattedSeconds = String(seconds).padStart(2, '0');

  const distanceFormatted = distanceKm < 1 
    ? `${Math.round(distanceKm * 1000)}m` 
    : `${distanceKm.toFixed(1)}km`;

  // ----------------------------------------------------
  // Variant 1: Floating Top Pill
  // ----------------------------------------------------
  if (variant === 'floating-top') {
    return (
      <div 
        onClick={onExpandCard}
        className="cursor-pointer group select-none animate-in fade-in slide-in-from-top-2 duration-200"
      >
        <div className="flex items-center gap-2 px-3.5 py-2 rounded-full bg-black text-white border border-slate-800 shadow-xl backdrop-blur-md">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
          
          <div className="flex items-center gap-1.5 font-mono text-xs sm:text-sm font-bold tracking-wide">
            <span className="text-slate-400 font-sans text-xs uppercase font-semibold">ETA</span>
            {isArrived ? (
              <span className="text-emerald-400 font-bold">ARRIVED</span>
            ) : (
              <span className="text-emerald-400 font-bold">
                {formattedMinutes}{colonBlink ? ':' : ' '}{formattedSeconds}
              </span>
            )}
            <span className="font-sans text-xs text-slate-300 font-medium">minits</span>
            <span className="text-slate-400 font-mono text-xs font-semibold">{distanceFormatted} away</span>
          </div>
        </div>
      </div>
    );
  }

  // ----------------------------------------------------
  // Variant 2: Simple Digital ETA Box on Top of Ride Details Card
  // ----------------------------------------------------
  return (
    <div className="w-full rounded-2xl bg-black text-white px-4 py-3.5 border border-black shadow-md select-none flex items-center justify-between">
      <div className="flex items-center gap-3">
        <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
        <div className="flex items-center gap-2 font-mono text-base sm:text-lg font-bold tracking-wide">
          <span className="text-slate-400 font-sans text-sm sm:text-base font-semibold">ETA</span>
          {isArrived ? (
            <span className="text-emerald-400 font-bold">ARRIVED</span>
          ) : (
            <span className="text-emerald-400 font-bold tracking-wider">
              {formattedMinutes}
              <span className={colonBlink ? 'opacity-100' : 'opacity-20'}>:</span>
              {formattedSeconds}
            </span>
          )}
          <span className="text-slate-300 font-sans font-medium text-xs sm:text-sm">
            minits
          </span>
          <span className="text-slate-400 font-mono text-xs sm:text-sm font-semibold ml-0.5">
            {distanceFormatted} away
          </span>
        </div>
      </div>

      <div className="hidden sm:flex items-center gap-1 text-[10px] font-mono text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded-md border border-emerald-800/80 font-bold">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
        <span>LIVE</span>
      </div>
    </div>
  );
};
