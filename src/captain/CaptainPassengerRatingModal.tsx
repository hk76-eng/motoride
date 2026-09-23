import React, { useState } from 'react';
import { Star, CheckCircle2, ThumbsUp, Sparkles, MapPin, IndianRupee, ShieldCheck, Heart, User } from 'lucide-react';
import { MotorideRide } from '../types/motoride';

interface CaptainPassengerRatingModalProps {
  ride: MotorideRide;
  captainName?: string;
  isSubmitting?: boolean;
  onSubmit: (score: number, review: string, tags: string[]) => void;
  onSkip: () => void;
}

const PASSENGER_COMPLIMENT_TAGS = [
  'Polite & respectful 👍',
  'Ready on time at pickup ⏱️',
  'Easy to find 📍',
  'Great communication 💬',
  'Clean & cooperative ✨',
  'Prompt payment 💵',
];

export const CaptainPassengerRatingModal: React.FC<CaptainPassengerRatingModalProps> = ({
  ride,
  captainName,
  isSubmitting = false,
  onSubmit,
  onSkip,
}) => {
  const [score, setScore] = useState<number>(5);
  const [hoverScore, setHoverScore] = useState<number | null>(null);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [reviewText, setReviewText] = useState<string>('');

  const passengerName = ride.passenger_name || 'Passenger';
  const fareEarned = ride.final_fare || ride.estimated_fare || 0;
  const distanceKm = ride.distance_km || 1.4;

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const getRatingLabel = (stars: number) => {
    switch (stars) {
      case 5:
        return 'Excellent Passenger ⭐⭐⭐⭐⭐';
      case 4:
        return 'Great Experience ⭐⭐⭐⭐';
      case 3:
        return 'Good / Average ⭐⭐⭐';
      case 2:
        return 'Below Average ⭐⭐';
      case 1:
        return 'Needs Improvement ⭐';
      default:
        return 'Rate Passenger';
    }
  };

  const currentDisplayScore = hoverScore ?? score;

  return (
    <div className="fixed inset-0 z-[1000] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-md select-none animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-slate-950 border-2 border-emerald-500/50 rounded-t-3xl sm:rounded-3xl p-5 sm:p-6 text-white shadow-[0_20px_60px_rgba(0,0,0,0.9),0_0_30px_rgba(16,185,129,0.2)] flex flex-col gap-4 max-h-[92vh] overflow-y-auto scrollbar-thin animate-in slide-in-from-bottom-4 duration-200">
        
        {/* Header Celebration Banner */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center shadow-inner">
              <CheckCircle2 className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <h3 className="text-base font-black text-white tracking-tight">
                Trip Completed! 🎉
              </h3>
              <p className="text-[11px] text-emerald-400 font-bold uppercase tracking-wider">
                Rate Passenger & Finish Ride
              </p>
            </div>
          </div>

          <span className="text-xs font-mono font-bold text-slate-400 bg-slate-900 px-2.5 py-1 rounded-xl border border-slate-800">
            #{ride.ride_code}
          </span>
        </div>

        {/* Trip Summary Card */}
        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-full bg-slate-800 border-2 border-emerald-500/60 flex items-center justify-center text-slate-200 font-bold text-base shadow-sm">
                <User className="w-6 h-6 text-slate-300" />
              </div>
              <div>
                <h4 className="text-sm font-black text-white">{passengerName}</h4>
                <p className="text-[11px] text-slate-400 font-medium">Passenger</p>
              </div>
            </div>

            {/* Earnings Badge */}
            <div className="text-right">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
                Fare Collected
              </span>
              <span className="text-lg font-black font-mono text-emerald-400">
                ₹{fareEarned}
              </span>
            </div>
          </div>

          {/* Route Summary */}
          <div className="text-[11px] text-slate-300 bg-slate-950/70 p-2.5 rounded-xl border border-slate-800/80 flex items-center justify-between">
            <div className="flex items-center gap-1.5 truncate pr-2">
              <MapPin className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span className="truncate">{ride.dropoff_address || 'Destination Reached'}</span>
            </div>
            <span className="font-mono font-bold text-slate-400 shrink-0">
              {distanceKm.toFixed(1)} km
            </span>
          </div>
        </div>

        {/* Star Rating Section */}
        <div className="flex flex-col items-center gap-2 py-2">
          <span className="text-xs font-bold text-slate-300">
            How was your trip with {passengerName}?
          </span>

          <div className="flex items-center gap-2.5 my-1">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                type="button"
                key={star}
                onClick={() => setScore(star)}
                onMouseEnter={() => setHoverScore(star)}
                onMouseLeave={() => setHoverScore(null)}
                className="p-1.5 cursor-pointer transition-transform hover:scale-125 active:scale-95 focus:outline-none"
                title={`${star} Star Rating`}
              >
                <Star
                  className={`w-9 h-9 transition-colors ${
                    star <= currentDisplayScore
                      ? 'fill-amber-400 text-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.6)]'
                      : 'text-slate-700 hover:text-slate-500'
                  }`}
                />
              </button>
            ))}
          </div>

          <span className="text-xs font-mono font-bold text-amber-400 bg-amber-950/40 px-3 py-1 rounded-full border border-amber-500/30">
            {getRatingLabel(currentDisplayScore)}
          </span>
        </div>

        {/* Compliment Tag Chips */}
        <div className="flex flex-col gap-2">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-emerald-400" />
            Passenger Compliments:
          </span>
          <div className="flex flex-wrap gap-1.5">
            {PASSENGER_COMPLIMENT_TAGS.map((tag) => {
              const isSelected = selectedTags.includes(tag);
              return (
                <button
                  type="button"
                  key={tag}
                  onClick={() => toggleTag(tag)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-all cursor-pointer select-none active:scale-95 ${
                    isSelected
                      ? 'bg-emerald-500 text-slate-950 border-emerald-400 font-bold shadow-md shadow-emerald-500/20'
                      : 'bg-slate-900 text-slate-300 border-slate-800 hover:border-slate-700 hover:bg-slate-850'
                  }`}
                >
                  {tag}
                </button>
              );
            })}
          </div>
        </div>

        {/* Optional Review Text */}
        <div className="flex flex-col gap-1.5">
          <input
            type="text"
            value={reviewText}
            onChange={(e) => setReviewText(e.target.value)}
            placeholder="Write a note about passenger (e.g. Great rider, on time)..."
            className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 focus:border-emerald-400 text-xs text-white placeholder-slate-500 focus:outline-none transition-all shadow-inner"
          />
        </div>

        {/* Finish Ride Action Buttons */}
        <div className="flex flex-col gap-2 pt-2 border-t border-slate-800/80">
          <button
            type="button"
            disabled={isSubmitting}
            onClick={() => onSubmit(score, reviewText, selectedTags)}
            style={{ backgroundColor: '#ba1e23' }}
            className="w-full py-3.5 rounded-2xl hover:opacity-90 active:scale-98 disabled:opacity-50 text-white font-black text-xs uppercase tracking-wider shadow-lg shadow-rose-950/40 transition-all cursor-pointer flex items-center justify-center gap-2"
          >
            {isSubmitting ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                Completing Ride...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 stroke-[2.5]" />
                Submit Rating & Finish Ride
              </span>
            )}
          </button>

          <button
            type="button"
            disabled={isSubmitting}
            onClick={onSkip}
            className="w-full py-2.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-900 text-xs font-semibold cursor-pointer transition-colors text-center disabled:opacity-50"
          >
            Skip Rating & Finish Ride
          </button>
        </div>

      </div>
    </div>
  );
};
