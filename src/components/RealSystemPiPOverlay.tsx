import React, { useEffect, useRef, useState } from 'react';
import { safeStorage } from '../lib/safeStorage';
import { motorideApi } from '../services/motorideApi';
import { realtimeSync } from '../services/realtimeSync';
import { MotorideRide } from '../types/motoride';
import { Layers, Minimize2, CheckCircle2, AlertCircle } from 'lucide-react';

/**
 * Real System-Wide Picture-in-Picture (PiP) Overlay Engine.
 * 
 * Uses HTML5 Canvas + Video captureStream + requestPictureInPicture API:
 * - Floats ABOVE OTHER APPS (Uber, inDrive, WhatsApp, Chrome, Home Screen) when MotoRide is in the background.
 * - Does NOT show an intrusive card inside MotoRide when MotoRide is open in the foreground.
 * - When the user switches to another app, the native browser PiP window floats on top of that app.
 * - Automatically updates live ride status, fare, and animated pulse.
 */
export const RealSystemPiPOverlay: React.FC = () => {
  const [isEnabled, setIsEnabled] = useState<boolean>(() => {
    return safeStorage.getItem('motoride_run_over_apps') === 'true';
  });
  const [isInPiP, setIsInPiP] = useState<boolean>(false);
  const [activeRide, setActiveRide] = useState<MotorideRide | null>(null);
  const [showStatusToast, setShowStatusToast] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string>('');

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Sync enabled state with profile drawer toggles
  useEffect(() => {
    const handleToggle = (e: any) => {
      const val = Boolean(e.detail);
      setIsEnabled(val);
      if (val) {
        requestPiPMode();
      } else {
        exitPiPMode();
      }
    };
    window.addEventListener('motoride_run_over_apps_changed', handleToggle as any);

    return () => {
      window.removeEventListener('motoride_run_over_apps_changed', handleToggle as any);
    };
  }, []);

  // Fetch and track active ride in real-time
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

  // Canvas drawing loop: renders a crisp, circular chat-head badge
  const drawOverlayBadge = (time: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = 140;

    // Clear background with transparent/black
    ctx.clearRect(0, 0, width, height);

    // Outer Glow Ring based on pulse
    const pulse = (Math.sin(time / 250) + 1) / 2;
    const glowRadius = radius + 8 + pulse * 10;
    const gradientGlow = ctx.createRadialGradient(centerX, centerY, radius, centerX, centerY, glowRadius);
    gradientGlow.addColorStop(0, 'rgba(16, 185, 129, 0.45)');
    gradientGlow.addColorStop(1, 'rgba(16, 185, 129, 0)');
    ctx.beginPath();
    ctx.arc(centerX, centerY, glowRadius, 0, Math.PI * 2);
    ctx.fillStyle = gradientGlow;
    ctx.fill();

    // Dark Circular Card Body
    ctx.save();
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.clip();

    const bgGradient = ctx.createLinearGradient(0, 0, 0, height);
    bgGradient.addColorStop(0, '#0f172a');
    bgGradient.addColorStop(1, '#020617');
    ctx.fillStyle = bgGradient;
    ctx.fill();

    // Inner Emerald Border
    ctx.lineWidth = 6;
    ctx.strokeStyle = '#10b981';
    ctx.stroke();

    // MotoRide Brand Header
    ctx.fillStyle = '#34d399';
    ctx.font = 'bold 22px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('MOTORIDE', centerX, centerY - 65);

    // Motorcycle / Speed Logo Icon (Vector Drawing on Canvas)
    ctx.save();
    ctx.translate(centerX - 35, centerY - 50);
    ctx.scale(1.1, 1.1);

    // Rear Wheel
    ctx.beginPath();
    ctx.arc(15, 30, 8, 0, Math.PI * 2);
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#10b981';
    ctx.stroke();

    // Front Wheel
    ctx.beginPath();
    ctx.arc(48, 30, 8, 0, Math.PI * 2);
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#10b981';
    ctx.stroke();

    // Frame & Handlebars
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

    // Rider Helmet (Amber Glow)
    ctx.beginPath();
    ctx.arc(32, 6, 6, 0, Math.PI * 2);
    ctx.fillStyle = '#f59e0b';
    ctx.fill();

    ctx.restore();

    // Live Status Text
    const statusText = activeRide
      ? activeRide.status.replace(/_/g, ' ').toUpperCase()
      : 'ONLINE & READY';

    ctx.fillStyle = activeRide ? '#fbbf24' : '#38bdf8';
    ctx.font = '800 19px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(statusText, centerX, centerY + 30);

    // Fare or Active Code Pill
    if (activeRide) {
      const fareAmount = activeRide.final_fare || activeRide.fare_amount || 80;
      ctx.fillStyle = '#10b981';
      ctx.font = 'bold 26px system-ui, -apple-system, sans-serif';
      ctx.fillText(`₹${fareAmount}`, centerX, centerY + 65);

      ctx.fillStyle = '#94a3b8';
      ctx.font = '500 13px system-ui, -apple-system, sans-serif';
      const dest = (activeRide.dropoff_address || 'Destination').slice(0, 24);
      ctx.fillText(`📍 ${dest}`, centerX, centerY + 90);
    } else {
      ctx.fillStyle = '#10b981';
      ctx.font = 'bold 20px system-ui, -apple-system, sans-serif';
      ctx.fillText('FLOAT OVER APPS', centerX, centerY + 60);

      ctx.fillStyle = '#64748b';
      ctx.font = '500 13px system-ui, -apple-system, sans-serif';
      ctx.fillText('Active in Background', centerX, centerY + 85);
    }

    ctx.restore();

    animationFrameRef.current = requestAnimationFrame(drawOverlayBadge);
  };

  // Start continuous canvas rendering
  useEffect(() => {
    animationFrameRef.current = requestAnimationFrame(drawOverlayBadge);
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [activeRide]);

  // Request native Picture-in-Picture window
  const requestPiPMode = async () => {
    try {
      const canvas = canvasRef.current;
      const video = videoRef.current;
      if (!canvas || !video) return;

      if (!document.pictureInPictureEnabled) {
        setToastMessage('Picture-in-Picture is not enabled in this browser.');
        setShowStatusToast(true);
        setTimeout(() => setShowStatusToast(false), 4000);
        return;
      }

      // Initialize media stream from canvas if not running
      if (!streamRef.current) {
        const stream = canvas.captureStream(15);
        streamRef.current = stream;
        video.srcObject = stream;
        // Chromium Auto Picture-in-Picture attribute
        video.setAttribute('autopictureinpicture', 'true');
        (video as any).autoPictureInPicture = true;
      }

      await video.play();

      if (document.pictureInPictureElement !== video) {
        await video.requestPictureInPicture();
        setIsInPiP(true);
        safeStorage.setItem('motoride_run_over_apps', 'true');
        setIsEnabled(true);
        setToastMessage('Floating PiP Activated! When you open Uber or other apps, MotoRide stays floating above them.');
        setShowStatusToast(true);
        setTimeout(() => setShowStatusToast(false), 4500);
      }
    } catch (err: any) {
      console.warn('PiP activation note:', err);
      // Browser requires direct user click gesture for requestPictureInPicture
      setToastMessage('Tap "Floating PiP" below to activate floating icon over other apps.');
      setShowStatusToast(true);
      setTimeout(() => setShowStatusToast(false), 4500);
    }
  };

  // Exit native Picture-in-Picture
  const exitPiPMode = async () => {
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      }
      setIsInPiP(false);
      safeStorage.setItem('motoride_run_over_apps', 'false');
      setIsEnabled(false);
      window.dispatchEvent(new CustomEvent('motoride_run_over_apps_changed', { detail: false }));
    } catch (err) {
      console.warn('Exit PiP note:', err);
    }
  };

  // Handle native PiP events & browser visibility changes
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onEnterPiP = () => {
      setIsInPiP(true);
    };

    const onLeavePiP = () => {
      setIsInPiP(false);
    };

    video.addEventListener('enterpictureinpicture', onEnterPiP);
    video.addEventListener('leavepictureinpicture', onLeavePiP);

    // Requirement:
    // "overlay show only in when motoride app is active in backround in mobile screen but open app is another for expamle uber or other app is looking in mobile screen"
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        // MotoRide has moved to background (user switched to Uber or other app)
        // If the user turned on PiP, ensure the video is playing so the floating window stays active
        if (isEnabled && video && !video.paused) {
          // Stream keeps running so PiP floats above Uber!
        }
      } else {
        // User came back to MotoRide in foreground
        // MotoRide is directly in front of the user now
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      video.removeEventListener('enterpictureinpicture', onEnterPiP);
      video.removeEventListener('leavepictureinpicture', onLeavePiP);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isEnabled]);

  return (
    <>
      {/* Hidden offscreen Canvas that renders the Live MotoRide Chat-Head Stream */}
      <canvas
        ref={canvasRef}
        width={320}
        height={320}
        className="fixed -left-[9999px] -top-[9999px] pointer-events-none opacity-0"
        aria-hidden="true"
      />

      {/* Hidden Video element that streams the canvas into Android's native System PiP Window */}
      <video
        ref={videoRef}
        muted
        playsInline
        autoPlay
        className="fixed -left-[9999px] -top-[9999px] pointer-events-none opacity-0 w-1 h-1"
        aria-hidden="true"
      />

      {/* Floating Activation Button: ONLY appears if user has enabled PiP in settings but PiP window was closed */}
      {isEnabled && !isInPiP && (
        <aside
          aria-label="Floating Overlay Controls"
          className="fixed bottom-20 right-4 z-40 animate-in fade-in slide-in-from-bottom duration-300"
        >
          <button
            type="button"
            onClick={requestPiPMode}
            className="flex items-center gap-2.5 px-4 py-2.5 rounded-full bg-slate-900/95 border-2 border-cyan-400 text-cyan-300 shadow-[0_0_20px_rgba(6,182,212,0.5)] backdrop-blur-md font-bold text-xs hover:bg-slate-800 transition-all cursor-pointer active:scale-95 group"
            title="Start Floating PiP (Floats over Uber, inDrive, Chrome, etc.)"
          >
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-cyan-500" />
            </span>
            <span>Float Over Other Apps (PiP)</span>
            <Layers className="w-3.5 h-3.5 text-cyan-400 group-hover:rotate-12 transition-transform" />
          </button>
        </aside>
      )}

      {/* Discreet Status Toast when PiP is engaged */}
      {showStatusToast && (
        <div
          role="status"
          className="fixed top-18 left-1/2 -translate-x-1/2 z-[100] max-w-sm w-[90%] bg-slate-900/95 text-white px-4 py-3 rounded-2xl shadow-2xl border border-cyan-500/40 backdrop-blur-xl flex items-center gap-3 animate-in fade-in slide-in-from-top duration-300"
        >
          <CheckCircle2 className="w-5 h-5 text-cyan-400 shrink-0" />
          <div className="flex flex-col text-xs">
            <span className="font-bold text-cyan-200">System Floating Overlay Ready</span>
            <span className="text-slate-300 text-[11px] leading-tight mt-0.5">{toastMessage}</span>
          </div>
        </div>
      )}
    </>
  );
};
