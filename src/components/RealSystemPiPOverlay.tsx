import React, { useEffect, useRef, useState } from 'react';
import { safeStorage } from '../lib/safeStorage';
import { motorideApi } from '../services/motorideApi';
import { realtimeSync } from '../services/realtimeSync';
import { MotorideRide } from '../types/motoride';
import {
  Layers,
  CheckCircle2,
  AlertCircle,
  X,
  ExternalLink,
  Smartphone,
  Eye,
  Minimize2,
  Sparkles,
} from 'lucide-react';

/**
 * Real System-Wide Picture-in-Picture (PiP) Overlay Engine.
 * 
 * Enables a live circular MotoRide chat-head badge to float above all other apps
 * (Uber, inDrive, WhatsApp, Chrome, Home Screen) when MotoRide is in the background.
 */
export const RealSystemPiPOverlay: React.FC = () => {
  const [isEnabled, setIsEnabled] = useState<boolean>(() => {
    return safeStorage.getItem('motoride_run_over_apps') === 'true';
  });
  const [isInPiP, setIsInPiP] = useState<boolean>(false);
  const [activeRide, setActiveRide] = useState<MotorideRide | null>(null);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [pipError, setPipError] = useState<string | null>(null);
  const [pipSuccess, setPipSuccess] = useState<boolean>(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const intervalTimerRef = useRef<any>(null);
  const audioContextRef = useRef<any>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Sync state when toggled in drawer
  useEffect(() => {
    const handleToggle = (e: any) => {
      const val = Boolean(e.detail);
      setIsEnabled(val);
      if (val) {
        setIsModalOpen(true);
      } else {
        exitPiP();
      }
    };
    window.addEventListener('motoride_run_over_apps_changed', handleToggle as any);
    return () => {
      window.removeEventListener('motoride_run_over_apps_changed', handleToggle as any);
    };
  }, []);

  // Track active ride in real-time
  useEffect(() => {
    const checkRide = async () => {
      try {
        const rides = await motorideApi.getRides();
        const active = rides.find(
          r => r && ['requested', 'captain_offered', 'captain_accepted', 'captain_arrived', 'trip_started'].includes(r.status)
        );
        setActiveRide(active || null);
      } catch {}
    };

    checkRide();
    const interval = setInterval(checkRide, 2500);

    const unsub = realtimeSync.on('RIDE_UPDATED', (r: any) => {
      if (r && ['requested', 'captain_offered', 'captain_accepted', 'captain_arrived', 'trip_started'].includes(r.status)) {
        setActiveRide(r);
      } else if (r && ['completed', 'cancelled_by_passenger', 'cancelled_by_captain'].includes(r.status)) {
        setActiveRide(null);
      }
    });

    return () => {
      clearInterval(interval);
      unsub();
    };
  }, []);

  // Continuous Canvas Drawing Loop for High-DPI Circular Chat-Head
  const renderBadge = (time: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = 140;

    ctx.clearRect(0, 0, width, height);

    // Outer Animated Glow
    const pulse = (Math.sin(time / 200) + 1) / 2;
    const glowRadius = radius + 6 + pulse * 12;
    const glow = ctx.createRadialGradient(centerX, centerY, radius, centerX, centerY, glowRadius);
    glow.addColorStop(0, 'rgba(16, 185, 129, 0.5)');
    glow.addColorStop(1, 'rgba(16, 185, 129, 0)');
    ctx.beginPath();
    ctx.arc(centerX, centerY, glowRadius, 0, Math.PI * 2);
    ctx.fillStyle = glow;
    ctx.fill();

    // Dark Circular Background Body
    ctx.save();
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.clip();

    const bgGradient = ctx.createLinearGradient(0, 0, 0, height);
    bgGradient.addColorStop(0, '#0f172a');
    bgGradient.addColorStop(1, '#020617');
    ctx.fillStyle = bgGradient;
    ctx.fill();

    // Emerald Border Ring
    ctx.lineWidth = 6;
    ctx.strokeStyle = '#10b981';
    ctx.stroke();

    // Header Text
    ctx.fillStyle = '#34d399';
    ctx.font = 'bold 22px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('MOTORIDE', centerX, centerY - 64);

    // Motorcycle Logo Icon
    ctx.save();
    ctx.translate(centerX - 35, centerY - 52);
    ctx.scale(1.1, 1.1);

    // Wheels
    ctx.beginPath();
    ctx.arc(15, 30, 8, 0, Math.PI * 2);
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#10b981';
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(48, 30, 8, 0, Math.PI * 2);
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#10b981';
    ctx.stroke();

    // Frame
    ctx.beginPath();
    ctx.moveTo(15, 30);
    ctx.lineTo(28, 16);
    ctx.lineTo(40, 16);
    ctx.lineTo(48, 30);
    ctx.moveTo(28, 16);
    ctx.lineTo(33, 30);
    ctx.moveTo(40, 16);
    ctx.lineTo(44, 9);
    ctx.lineTo(49, 9);
    ctx.lineWidth = 3.5;
    ctx.strokeStyle = '#34d399';
    ctx.lineCap = 'round';
    ctx.stroke();

    // Helmet
    ctx.beginPath();
    ctx.arc(32, 6, 6, 0, Math.PI * 2);
    ctx.fillStyle = '#f59e0b';
    ctx.fill();

    ctx.restore();

    // Live Ride Status
    const statusText = activeRide
      ? activeRide.status.replace(/_/g, ' ').toUpperCase()
      : 'ACTIVE IN BACKGROUND';

    ctx.fillStyle = activeRide ? '#fbbf24' : '#38bdf8';
    ctx.font = '800 18px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(statusText, centerX, centerY + 30);

    // Agreed Fare or Floating Label
    if (activeRide) {
      const fareAmount = activeRide.final_fare || activeRide.fare_amount || 80;
      ctx.fillStyle = '#10b981';
      ctx.font = 'bold 28px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillText(`₹${fareAmount}`, centerX, centerY + 65);

      ctx.fillStyle = '#94a3b8';
      ctx.font = '600 13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      const dest = (activeRide.dropoff_address || 'Destination').slice(0, 22);
      ctx.fillText(`📍 ${dest}`, centerX, centerY + 90);
    } else {
      ctx.fillStyle = '#10b981';
      ctx.font = 'bold 20px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillText('FLOAT OVER APPS', centerX, centerY + 62);

      ctx.fillStyle = '#64748b';
      ctx.font = '500 13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillText('Floating Above Other Apps', centerX, centerY + 86);
    }

    ctx.restore();

    animationFrameRef.current = requestAnimationFrame(renderBadge);
  };

  useEffect(() => {
    // Initial draw
    renderBadge(performance.now());
    animationFrameRef.current = requestAnimationFrame(renderBadge);

    // CRITICAL for Android: requestAnimationFrame is paused when user opens Uber!
    // setInterval keeps running in the background so the canvas stream never stalls!
    intervalTimerRef.current = setInterval(() => {
      renderBadge(Date.now());
    }, 250);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (intervalTimerRef.current) {
        clearInterval(intervalTimerRef.current);
      }
    };
  }, [activeRide]);

  // Launch Picture-in-Picture directly from user click gesture
  const startFloatingPiP = async () => {
    setPipError(null);

    const canvas = canvasRef.current;
    const video = videoRef.current;

    if (!canvas || !video) {
      setPipError('Rendering engine is still initializing. Please try again.');
      return;
    }

    // Check if Picture-in-Picture is supported by browser
    if (!document.pictureInPictureEnabled) {
      setPipError('Your browser has disabled Picture-in-Picture. Please check your Android Chrome settings.');
      return;
    }

    try {
      // 1. Ensure canvas has rendered at least one frame
      renderBadge(performance.now());

      // 2. Set up video stream with silent audio track (forces Android to keep media session active in background)
      if (!streamRef.current) {
        const canvasStream = canvas.captureStream(20);
        const videoTrack = canvasStream.getVideoTracks()[0];

        // Create silent audio track using Web Audio API
        let tracks: MediaStreamTrack[] = [videoTrack];
        try {
          const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
          if (AudioContextClass) {
            const audioCtx = new AudioContextClass();
            audioContextRef.current = audioCtx;
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            // Near-silent audio so Android Chrome registers an active media session
            gain.gain.value = 0.0001;
            osc.connect(gain);
            const dest = audioCtx.createMediaStreamDestination();
            gain.connect(dest);
            osc.start();
            const audioTrack = dest.stream.getAudioTracks()[0];
            if (audioTrack) {
              tracks.push(audioTrack);
            }
          }
        } catch (audioErr) {
          console.warn('Silent audio keep-alive note:', audioErr);
        }

        const combinedStream = new MediaStream(tracks);
        streamRef.current = combinedStream;
        video.srcObject = combinedStream;
        video.setAttribute('playsinline', 'true');
        video.setAttribute('webkit-playsinline', 'true');
        video.setAttribute('autopictureinpicture', 'true');
        (video as any).autoPictureInPicture = true;
      }

      // 3. Play video stream and configure MediaSession
      if ('mediaSession' in navigator) {
        try {
          navigator.mediaSession.metadata = new MediaMetadata({
            title: activeRide ? `MotoRide: ${activeRide.status.toUpperCase()}` : 'MotoRide Floating Overlay',
            artist: activeRide ? `Fare: ₹${activeRide.final_fare || activeRide.fare_amount || 80}` : 'Active over other apps',
            album: 'MotoRide',
          });
          navigator.mediaSession.playbackState = 'playing';
        } catch {}
      }

      await video.play();

      // 4. Request Picture-in-Picture
      if (document.pictureInPictureElement !== video) {
        await video.requestPictureInPicture();
      }

      setIsInPiP(true);
      setPipSuccess(true);
      setIsEnabled(true);
      safeStorage.setItem('motoride_run_over_apps', 'true');

      // Auto close modal after successful PiP activation
      setTimeout(() => {
        setIsModalOpen(false);
      }, 1500);
    } catch (err: any) {
      console.error('Failed to enter PiP:', err);
      if (err.name === 'NotAllowedError') {
        setPipError('Permission denied. Please tap the button again directly to allow floating.');
      } else if (err.name === 'InvalidStateError') {
        setPipError('Video stream is preparing. Please tap "Start Floating Overlay" again.');
      } else {
        setPipError(err.message || 'Unable to launch PiP. Check phone Settings > Apps > Chrome > Picture-in-picture.');
      }
    }
  };

  // Exit PiP
  const exitPiP = async () => {
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      }
    } catch (e) {}
    setIsInPiP(false);
    setIsEnabled(false);
    safeStorage.setItem('motoride_run_over_apps', 'false');
    window.dispatchEvent(new CustomEvent('motoride_run_over_apps_changed', { detail: false }));
  };

  // Listen to native PiP enter/exit events
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onEnter = () => setIsInPiP(true);
    const onLeave = () => setIsInPiP(false);

    video.addEventListener('enterpictureinpicture', onEnter);
    video.addEventListener('leavepictureinpicture', onLeave);

    return () => {
      video.removeEventListener('enterpictureinpicture', onEnter);
      video.removeEventListener('leavepictureinpicture', onLeave);
    };
  }, []);

  return (
    <>
      {/* Offscreen Canvas rendering the continuous Live Badge Stream */}
      <canvas
        ref={canvasRef}
        width={320}
        height={320}
        className="fixed -left-[9999px] -top-[9999px] pointer-events-none opacity-0"
        aria-hidden="true"
      />

      {/* Hidden Video element with real layout dimensions for Chromium PiP compatibility */}
      <video
        ref={videoRef}
        muted
        playsInline
        autoPlay
        width={320}
        height={320}
        className="fixed bottom-0 right-0 w-16 h-16 pointer-events-none opacity-[0.01] -z-50"
        aria-hidden="true"
      />

      {/* Floating Quick Action Button: appears when enabled to let user re-open floating window */}
      {isEnabled && (
        <aside
          aria-label="Floating Overlay Controls"
          className="fixed bottom-20 right-4 z-40 animate-in fade-in slide-in-from-bottom duration-300"
        >
          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className={`flex items-center gap-2.5 px-4 py-2.5 rounded-full border-2 shadow-[0_0_25px_rgba(6,182,212,0.6)] backdrop-blur-xl font-bold text-xs transition-all cursor-pointer active:scale-95 group ${
              isInPiP
                ? 'bg-emerald-950/90 border-emerald-400 text-emerald-300'
                : 'bg-slate-900/95 border-cyan-400 text-cyan-300 hover:bg-slate-800'
            }`}
            title="MotoRide Floating Overlay Over Other Apps"
          >
            <span className="relative flex h-2.5 w-2.5">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                isInPiP ? 'bg-emerald-400' : 'bg-cyan-400'
              }`} />
              <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${
                isInPiP ? 'bg-emerald-500' : 'bg-cyan-500'
              }`} />
            </span>
            <span>{isInPiP ? 'Overlay Floating Above Apps' : 'Float Over Other Apps'}</span>
            <Layers className="w-3.5 h-3.5 text-cyan-400 group-hover:rotate-12 transition-transform" />
          </button>
        </aside>
      )}

      {/* Interactive PiP Launch & Configuration Modal */}
      {isModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
        >
          <div className="w-full max-w-sm rounded-3xl bg-slate-900 border border-cyan-500/40 p-5 shadow-2xl flex flex-col gap-4 text-white animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <span className="p-2 rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
                  <Smartphone className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="text-sm font-extrabold text-white">Floating Over Other Apps</h3>
                  <p className="text-[11px] text-slate-400">MotoRide Picture-in-Picture Chat-Head</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Live Chat-Head Preview */}
            <div className="flex flex-col items-center justify-center p-4 rounded-2xl bg-black/50 border border-white/10 relative overflow-hidden">
              <div className="w-32 h-32 rounded-full border-2 border-emerald-400/80 bg-slate-950 flex flex-col items-center justify-center shadow-[0_0_30px_rgba(16,185,129,0.35)] relative">
                <span className="text-[10px] font-black tracking-widest text-emerald-400 mb-0.5">MOTORIDE</span>
                <span className="text-2xl">🏍️</span>
                <span className="text-[11px] font-extrabold text-amber-400 mt-1 uppercase">
                  {activeRide ? activeRide.status.replace(/_/g, ' ') : 'ONLINE'}
                </span>
                <span className="text-xs font-black text-emerald-400 font-mono">
                  ₹{activeRide ? activeRide.final_fare || activeRide.fare_amount || 80 : 80}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-2 text-center">
                This floating badge will stay on screen above <b>Uber, inDrive, Chrome & WhatsApp</b>.
              </p>
            </div>

            {/* Success Message */}
            {pipSuccess && (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-semibold">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                <span>Floating window is active! Open Uber or other apps now to test.</span>
              </div>
            )}

            {/* Error Message with Help */}
            {pipError && (
              <div className="flex items-start gap-2 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
                <div className="flex flex-col">
                  <span className="font-bold">Notice:</span>
                  <span className="text-[11px] leading-relaxed text-rose-200">{pipError}</span>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={startFloatingPiP}
                className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-cyan-500 to-emerald-500 hover:from-cyan-400 hover:to-emerald-400 text-slate-950 font-black text-xs tracking-wide shadow-lg shadow-cyan-500/25 flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-98"
              >
                <Layers className="w-4 h-4" />
                <span>Start Floating Over Other Apps (Uber, etc.)</span>
              </button>

              {isInPiP && (
                <button
                  type="button"
                  onClick={exitPiP}
                  className="w-full py-2.5 px-4 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 font-semibold text-xs transition-colors cursor-pointer"
                >
                  Stop Floating Overlay
                </button>
              )}
            </div>

            {/* Android Troubleshooting Guidance */}
            <div className="p-3 rounded-2xl bg-white/5 border border-white/5 text-[11px] text-slate-400 flex flex-col gap-1.5">
              <div className="flex items-center gap-1.5 font-bold text-slate-300">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>How to float over other apps on your phone:</span>
              </div>
              <ol className="list-decimal list-inside space-y-1 text-[10px] text-slate-400 leading-normal pl-0.5">
                <li>Tap <b>Start Floating Over Other Apps</b> above.</li>
                <li>Swipe up to go to your home screen or open <b>Uber / inDrive</b>.</li>
                <li>The MotoRide live badge will float over Uber as a movable window.</li>
              </ol>
              <div className="p-2 rounded-xl bg-black/40 border border-white/5 mt-1 text-[10px] space-y-1">
                <p className="font-bold text-amber-300">Phone Brand Permissions Check:</p>
                <p>• <b>Xiaomi / Redmi / Poco</b>: Settings &gt; Apps &gt; Manage Apps &gt; Chrome &gt; Other Permissions &gt; enable <b>&quot;Display pop-up windows while running in the background&quot;</b>.</p>
                <p>• <b>Samsung / Pixel / Motorola</b>: Settings &gt; Apps &gt; Chrome &gt; <b>Picture-in-picture &gt; Allowed</b>.</p>
                <p>• <b>Vivo / Oppo / Realme</b>: Settings &gt; App Management &gt; Chrome &gt; <b>Floating Windows &gt; Allowed</b>.</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
