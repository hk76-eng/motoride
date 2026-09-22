import React, { useState, useEffect } from 'react';
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
  variant = 'card-header',
  onExpandCard,
}) => {
  const [colonBlink, setColonBlink] = useState<boolean>(true);
  const [countdownSeconds, setCountdownSeconds] = useState<number>(210); // Starts around 3:30

  // Colon blink every 1 second
  useEffect(() => {
    const interval = setInterval(() => {
      setColonBlink((prev) => !prev);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Strictly ONLY show when captain is on the way to pickup ('captain_accepted')
  if (ride.status !== 'captain_accepted') {
    return null;
  }

  // Dynamic countdown timer
  useEffect(() => {
    const timer = setInterval(() => {
      setCountdownSeconds((prev) => (prev > 1 ? prev - 1 : 1));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Format MM:SS
  const minutes = Math.floor(countdownSeconds / 60);
  const seconds = countdownSeconds % 60;
  const formattedMinutes = String(minutes).padStart(2, '0');
  const formattedSeconds = String(seconds).padStart(2, '0');

  // ----------------------------------------------------
  // Variant 1: Floating Top Pill
  // ----------------------------------------------------
  if (variant === 'floating-top') {
    return (
      <div 
        onClick={onExpandCard}
        className="cursor-pointer group select-none animate-in fade-in slide-in-from-top-2 duration-200"
      >
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-black text-white border-2 border-emerald-500 shadow-2xl backdrop-blur-md">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
          <div className="font-mono text-xl sm:text-2xl font-black tracking-widest text-emerald-400">
            {formattedMinutes}
            <span className={colonBlink ? 'opacity-100' : 'opacity-20'}>:</span>
            {formattedSeconds}
          </div>
        </div>
      </div>
    );
  }

  // ----------------------------------------------------
  // Variant 2: Big Bold Digital Timer Box on Ride Details Card
  // ----------------------------------------------------
  return (
    <div className="w-full rounded-2xl bg-black text-white px-5 py-4 border-2 border-emerald-500/80 shadow-xl select-none flex items-center justify-between">
      <div className="flex items-center gap-3">
        <span className="w-3 h-3 rounded-full bg-emerald-400 animate-pulse shrink-0" />
        <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">Captain Arriving In</span>
      </div>

      <div className="font-mono text-2xl sm:text-3xl font-black tracking-widest text-emerald-400">
        {formattedMinutes}
        <span className={colonBlink ? 'opacity-100' : 'opacity-20'}>:</span>
        {formattedSeconds}
      </div>
    </div>
  );
};
