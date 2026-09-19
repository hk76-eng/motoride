import React, { useState, useEffect, useMemo } from 'react';
import { Clock, Navigation, MapPin, Bike, Radio } from 'lucide-react';
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
  const targetAddress = isTripStarted ? ride.dropoff_address : ride.pickup_address;

  const currentCapLat = captainLat ?? ride.captain_current_lat ?? (isAccepted ? ride.pickup_lat - 0.005 : ride.pickup_lat);
  const currentCapLng = captainLng ?? ride.captain_current_lng ?? (isAccepted ? ride.pickup_lng - 0.004 : ride.pickup_lng);

  const distanceKm = useMemo(() => {
    if (!currentCapLat || !currentCapLng || !targetLat || !targetLng) return 0.8;
    return calculateHaversineDistanceKm(currentCapLat, currentCapLng, targetLat, targetLng);
  }, [currentCapLat, currentCapLng, targetLat, targetLng]);

  // Synchronize countdown seconds with live distance (avg city bike speed ~24 km/h)
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

  // Dynamic countdown
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
    ? `${Math.round(distanceKm * 1000)} m` 
    : `${distanceKm.toFixed(1)} km`;

  // ----------------------------------------------------
  // Variant 1: Simple Floating Top Pill
  // ----------------------------------------------------
  if (variant === 'floating-top') {
    return (
      <div 
        onClick={onExpandCard}
        className="cursor-pointer group select-none animate-in fade-in slide-in-from-top-2 duration-200"
      >
        <div className="flex items-center gap-2.5 px-3.5 py-1.5 rounded-full bg-black text-white border border-slate-800 shadow-lg">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
          
          <div className="flex items-center gap-1.5 font-mono text-xs sm:text-sm font-bold tracking-wide">
            <span className="text-slate-400 font-sans text-xs uppercase font-semibold">ETA</span>
            {isArrived ? (
              <span className="text-emerald-400 font-bold">ARRIVED</span>
            ) : (
              <span className="text-emerald-400 font-bold">
                {formattedMinutes}{colonBlink ? ':' : ' '}{formattedSeconds} <span className="font-sans text-[11px] text-slate-300 font-normal">mints</span>
              </span>
            )}
          </div>

          <span className="text-slate-500">•</span>
          <span className="text-xs text-slate-300 font-medium">Pickup (A)</span>
        </div>
      </div>
    );
  }

  // ----------------------------------------------------
  // Variant 2: Simple Digital ETA Box on Top of Ride Details
  // ----------------------------------------------------
  return (
    <div className="w-full rounded-2xl bg-black text-white p-4 border border-black shadow-md select-none">
      {/* Top Header: Simple status & distance */}
      <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-slate-800 text-xs">
        <div className="flex items-center gap-1.5 font-medium text-slate-300">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>
            {isArrived
              ? 'Captain Arrived at Location A'
              : isTripStarted
              ? 'Captain Going to Drop-off Location B'
              : 'Captain Coming to Pickup Location A'}
          </span>
        </div>
        
        <span className="text-emerald-400 font-mono text-xs font-semibold">
          {distanceFormatted} away
        </span>
      </div>

      {/* Main Simple Digital Display */}
      <div className="pt-3 pb-1 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <span className="text-[11px] text-slate-400 font-medium uppercase tracking-wider block mb-0.5">
            Estimated Arrival Time
          </span>
          <div className="flex items-baseline gap-2 font-mono">
            {isArrived ? (
              <span className="text-2xl sm:text-3xl font-bold text-emerald-400 tracking-tight">
                ARRIVED AT (A)
              </span>
            ) : (
              <div className="flex items-baseline gap-1.5">
                <span className="text-slate-400 font-sans font-semibold text-lg sm:text-xl">ETA</span>
                <span className="text-2xl sm:text-3xl font-bold text-emerald-400 tracking-wider">
                  {formattedMinutes}
                  <span className={colonBlink ? 'opacity-100' : 'opacity-20'}>:</span>
                  {formattedSeconds}
                </span>
                <span className="text-sm font-sans font-medium text-slate-300 ml-1">
                  mints
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Simple Location A Pill */}
        <div className="flex items-center gap-2 bg-slate-900 px-3 py-2 rounded-xl border border-slate-800 text-xs">
          <div className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-[10px] shrink-0">
            {isTripStarted ? 'B' : 'A'}
          </div>
          <div className="truncate max-w-[220px]">
            <span className="text-[10px] text-slate-400 uppercase font-semibold block">
              {isTripStarted ? 'Drop-off (B)' : 'Pickup (A)'}
            </span>
            <span className="text-white font-medium truncate block text-[11px]">
              {targetAddress || (isTripStarted ? 'Destination' : 'Pickup Location')}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
