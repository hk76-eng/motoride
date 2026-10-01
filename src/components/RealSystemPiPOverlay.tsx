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
  const [activeTab, setActiveTab] = useState<'pip' | 'apk'>('pip');
  const [isPreparingLoop, setIsPreparingLoop] = useState<boolean>(false);
  const [pipError, setPipError] = useState<string | null>(null);
  const [pipSuccess, setPipSuccess] = useState<boolean>(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const intervalTimerRef = useRef<any>(null);
  const audioContextRef = useRef<any>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const blobUrlRef = useRef<string | null>(null);
  const logoImageRef = useRef<HTMLImageElement | null>(null);

  // Preload the official uploaded Motoride icon
  useEffect(() => {
    const img = new Image();
    img.src = '/motoride-logo.png';
    img.onload = () => {
      logoImageRef.current = img;
    };
  }, []);

  // Detect if running inside an Android WebView APK wrapper
  const isAndroidWebView = typeof navigator !== 'undefined' && (
    /wv|WebView/i.test(navigator.userAgent) ||
    (/Android/i.test(navigator.userAgent) && /Version\/[0-9.]+/i.test(navigator.userAgent))
  );

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

  // Compact 100x100 Circular Chat-Head: Solid Black Background with Official Uploaded Motoride Icon
  const renderBadge = (_time: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(centerX, centerY) - 2;

    ctx.clearRect(0, 0, width, height);

    // Pure Solid Black Circular Background (no white background)
    ctx.save();
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.clip();

    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, width, height);

    const logoImg = logoImageRef.current;
    if (logoImg && logoImg.complete && logoImg.naturalWidth > 0) {
      // Draw the exact uploaded official Motoride icon
      ctx.drawImage(logoImg, 2, 2, width - 4, height - 4);
    } else {
      // Fallback clean vector logo if image is loading
      ctx.save();
      ctx.translate(centerX - 18, centerY - 24);
      ctx.scale(0.65, 0.65);
      // Wheels
      ctx.beginPath();
      ctx.arc(14, 28, 8, 0, Math.PI * 2);
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#ffffff';
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(46, 28, 8, 0, Math.PI * 2);
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#ffffff';
      ctx.stroke();

      // Frame
      ctx.beginPath();
      ctx.moveTo(14, 28);
      ctx.lineTo(26, 16);
      ctx.lineTo(38, 16);
      ctx.lineTo(46, 28);
      ctx.moveTo(26, 16);
      ctx.lineTo(31, 28);
      ctx.moveTo(38, 16);
      ctx.lineTo(42, 9);
      ctx.lineTo(47, 9);
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#ffffff';
      ctx.stroke();

      // Helmet
      ctx.beginPath();
      ctx.arc(31, 6, 5, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.restore();

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 12px system-ui, -apple-system, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('Motoride', centerX, centerY + 18);
    }

    ctx.restore();

    // Subtle dark border ring
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#27272a';
    ctx.stroke();

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

    // Check if Picture-in-Picture is supported by browser or element
    const supportsPiP = Boolean(
      document.pictureInPictureEnabled ||
      (video && typeof (video as any).requestPictureInPicture === 'function')
    );

    if (!supportsPiP) {
      if (isAndroidWebView) {
        setPipError('You are using the MotoRide APK app. Android WebViews disable browser PiP. Use "Open in Chrome" below, or enable native overlay in your APK.');
      } else {
        setPipError('Picture-in-Picture is disabled in this browser.');
      }
      return;
    }

    try {
      setIsPreparingLoop(true);
      // 1. Ensure canvas has rendered at least one frame
      renderBadge(performance.now());

      // 2. Generate a 1.2-second self-contained looping WebM video
      // This is CRITICAL for Android: A looping video file never pauses when Chrome goes to the background!
      let useLoopBlob = false;
      try {
        if (typeof MediaRecorder !== 'undefined') {
          const stream = canvas.captureStream(25);
          const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp8')
            ? 'video/webm;codecs=vp8'
            : MediaRecorder.isTypeSupported('video/webm')
            ? 'video/webm'
            : '';

          if (mimeType) {
            const blob = await new Promise<Blob>((resolve) => {
              const recorder = new MediaRecorder(stream, { mimeType });
              const chunks: Blob[] = [];

              recorder.ondataavailable = (e) => {
                if (e.data && e.data.size > 0) chunks.push(e.data);
              };

              recorder.onstop = () => {
                resolve(new Blob(chunks, { type: mimeType }));
              };

              recorder.start();

              let ticks = 0;
              const loopInterval = setInterval(() => {
                renderBadge(performance.now());
                ticks++;
                if (ticks >= 25) {
                  clearInterval(loopInterval);
                  try {
                    recorder.stop();
                  } catch {}
                }
              }, 40);
            });

            if (blob && blob.size > 500) {
              if (blobUrlRef.current) {
                URL.revokeObjectURL(blobUrlRef.current);
              }
              const url = URL.createObjectURL(blob);
              blobUrlRef.current = url;
              video.srcObject = null;
              video.src = url;
              video.loop = true;
              useLoopBlob = true;
            }
          }
        }
      } catch (recErr) {
        console.warn('MediaRecorder loop note (using stream fallback):', recErr);
      }

      // Fallback: If MediaRecorder is unsupported, use live stream with silent audio track
      if (!useLoopBlob) {
        const canvasStream = canvas.captureStream(20);
        const videoTrack = canvasStream.getVideoTracks()[0];
        let tracks: MediaStreamTrack[] = [videoTrack];
        try {
          const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
          if (AudioContextClass) {
            const audioCtx = new AudioContextClass();
            audioContextRef.current = audioCtx;
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            gain.gain.value = 0.0001;
            osc.connect(gain);
            const dest = audioCtx.createMediaStreamDestination();
            gain.connect(dest);
            osc.start();
            const audioTrack = dest.stream.getAudioTracks()[0];
            if (audioTrack) tracks.push(audioTrack);
          }
        } catch {}

        const combinedStream = new MediaStream(tracks);
        streamRef.current = combinedStream;
        video.srcObject = combinedStream;
      }

      video.setAttribute('playsinline', 'true');
      video.setAttribute('webkit-playsinline', 'true');
      video.setAttribute('autopictureinpicture', 'true');
      (video as any).autoPictureInPicture = true;

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
      setIsPreparingLoop(false);

      // Auto close modal after successful PiP activation
      setTimeout(() => {
        setIsModalOpen(false);
      }, 1500);
    } catch (err: any) {
      setIsPreparingLoop(false);
      console.error('Failed to enter PiP:', err);
      if (err.name === 'NotAllowedError') {
        setPipError('Permission denied. Please tap the button again directly to allow floating.');
      } else if (err.name === 'InvalidStateError') {
        setPipError('Video stream is preparing. Please tap "Start Floating Overlay" again.');
      } else if (isAndroidWebView) {
        setPipError('You are inside the APK app wrapper. Android WebViews do not support browser PiP. Tap "Open in Google Chrome" below to float over other apps!');
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
      {/* Offscreen Canvas rendering the 100x100 compact Live Badge Stream */}
      <canvas
        ref={canvasRef}
        width={100}
        height={100}
        className="fixed -left-[9999px] -top-[9999px] pointer-events-none opacity-0"
        aria-hidden="true"
      />

      {/* Video element with 100x100 dimensions for Android PiP persistence */}
      <video
        ref={videoRef}
        playsInline
        autoPlay
        width={100}
        height={100}
        className="fixed bottom-1 right-1 w-6 h-6 pointer-events-none opacity-[0.05] z-0"
        aria-hidden="true"
      />

      {/* Floating Quick Action Button: small compact black pill with official Motoride icon */}
      {isEnabled && (
        <aside
          aria-label="Floating Overlay Controls"
          className="fixed bottom-20 right-4 z-40 animate-in fade-in slide-in-from-bottom duration-300"
        >
          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className={`flex items-center gap-2 px-2.5 py-1.5 rounded-full border shadow-lg backdrop-blur-xl font-bold text-xs transition-all cursor-pointer active:scale-95 group ${
              isInPiP
                ? 'bg-black border-zinc-700 text-white'
                : 'bg-black/95 border-zinc-700 text-white hover:bg-zinc-900'
            }`}
            title="Motoride Floating Overlay (100x100)"
          >
            <img
              src="/motoride-logo.png"
              alt="Motoride"
              className="w-4 h-4 rounded-full object-cover"
            />
            <span className="text-white font-bold text-xs tracking-wide">Motoride</span>
            <Layers className="w-3 h-3 text-zinc-400 group-hover:rotate-12 transition-transform" />
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

            {/* Tab Selector: Overlay vs APK Wrapper */}
            <div className="flex items-center gap-1 p-1 rounded-xl bg-black/40 border border-white/10 text-xs">
              <button
                type="button"
                onClick={() => setActiveTab('pip')}
                className={`flex-1 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                  activeTab === 'pip'
                    ? 'bg-cyan-500 text-slate-950 shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Floating Overlay
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('apk')}
                className={`flex-1 py-1.5 rounded-lg font-bold transition-all cursor-pointer flex items-center justify-center gap-1 ${
                  activeTab === 'apk'
                    ? 'bg-cyan-500 text-slate-950 shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <span>APK Setup</span>
                {isAndroidWebView && (
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
                )}
              </button>
            </div>

            {activeTab === 'pip' ? (
              <>
                {/* Live Chat-Head Preview: 100x100 size with uploaded icon */}
                <div className="flex flex-col items-center justify-center p-4 rounded-2xl bg-black/70 border border-white/10 relative overflow-hidden">
                  <div className="w-[100px] h-[100px] rounded-full border-2 border-zinc-700 bg-black flex items-center justify-center shadow-2xl relative overflow-hidden">
                    <img
                      src="/motoride-logo.png"
                      alt="Motoride"
                      className="w-full h-full object-cover rounded-full"
                    />
                  </div>
                  <p className="text-[11px] text-zinc-400 mt-2 text-center">
                    Reduced to <b>100x100</b> with official <b>Motoride</b> icon.
                  </p>
                </div>

                {/* WebView Alert if running in APK */}
                {isAndroidWebView && (
                  <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs">
                    <AlertCircle className="w-4 h-4 shrink-0 text-amber-400 mt-0.5" />
                    <div className="flex flex-col">
                      <span className="font-bold">Detected: Android APK Wrapper</span>
                      <span className="text-[11px] text-amber-200/90 leading-tight mt-0.5">
                        Standard Android WebViews disable browser PiP. If this button doesn&apos;t pop out, switch to the <b>APK Setup</b> tab or open in Chrome!
                      </span>
                    </div>
                  </div>
                )}

                {/* Success Message */}
                {pipSuccess && (
                  <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-semibold">
                    <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                    <span>Floating window active! Open Uber or another app now.</span>
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
                    disabled={isPreparingLoop}
                    onClick={startFloatingPiP}
                    className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-cyan-500 to-emerald-500 hover:from-cyan-400 hover:to-emerald-400 disabled:opacity-75 text-slate-950 font-black text-xs tracking-wide shadow-lg shadow-cyan-500/25 flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-98"
                  >
                    <Layers className={`w-4 h-4 ${isPreparingLoop ? 'animate-spin' : ''}`} />
                    <span>
                      {isPreparingLoop
                        ? 'Preparing Infinite Floating Loop...'
                        : 'Start Floating Over Other Apps (Uber, etc.)'}
                    </span>
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

                  {isAndroidWebView && (
                    <a
                      href="https://motoride-roan.vercel.app/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full py-2.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs shadow-lg flex items-center justify-center gap-2 transition-all cursor-pointer"
                    >
                      <ExternalLink className="w-4 h-4 text-slate-950" />
                      <span>Open in Google Chrome & Float Over Uber</span>
                    </a>
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
                    <p>• <b>Xiaomi / Redmi / Poco</b>: Settings &gt; Apps &gt; Manage Apps &gt; Chrome (or your APK) &gt; Other Permissions &gt; enable <b>&quot;Display pop-up windows while running in the background&quot;</b>.</p>
                    <p>• <b>Samsung / Pixel / Motorola</b>: Settings &gt; Apps &gt; Chrome (or your APK) &gt; <b>Picture-in-picture &gt; Allowed</b>.</p>
                    <p>• <b>Vivo / Oppo / Realme</b>: Settings &gt; App Management &gt; Chrome &gt; <b>Floating Windows &gt; Allowed</b>.</p>
                  </div>
                </div>
              </>
            ) : (
              /* APK Wrapper Guidance Tab */
              <div className="flex flex-col gap-3 text-xs">
                <div className="p-3.5 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-200">
                  <h4 className="font-extrabold text-white text-xs mb-1">Why Web PiP doesn&apos;t float in an APK wrapper:</h4>
                  <p className="text-[11px] text-slate-300 leading-relaxed">
                    You generated this APK from <b>https://motoride-roan.vercel.app/</b>. Android WebView apps block browser PiP unless the APK Activity includes native PiP or SYSTEM_ALERT_WINDOW code.
                  </p>
                </div>

                <div className="flex flex-col gap-2">
                  <span className="font-bold text-white text-[11px]">Instant Solution (Test in Chrome):</span>
                  <a
                    href="https://motoride-roan.vercel.app/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-2.5 px-3 rounded-xl bg-white/10 hover:bg-white/15 text-white font-bold text-xs flex items-center justify-center gap-2 border border-white/10 transition-colors"
                  >
                    <ExternalLink className="w-4 h-4 text-cyan-400" />
                    <span>Open in Google Chrome App</span>
                  </a>
                  <p className="text-[10px] text-slate-400">
                    In the Chrome app, Android OS fully supports PiP over Uber!
                  </p>
                </div>

                <div className="p-3 rounded-2xl bg-black/60 border border-white/10 flex flex-col gap-1.5 font-mono text-[10px]">
                  <span className="font-sans font-bold text-amber-300 text-[11px]">To make your APK float natively over Uber:</span>
                  <p className="font-sans text-[10px] text-slate-400">
                    Add this to your APK&apos;s <b>MainActivity.java</b>:
                  </p>
                  <pre className="p-2 rounded-lg bg-slate-950 text-emerald-400 text-[9px] overflow-x-auto">
{`@Override
protected void onUserLeaveHint() {
    super.onUserLeaveHint();
    if (Build.VERSION.SDK_INT >= 26) {
        enterPictureInPictureMode(
            new PictureInPictureParams.Builder()
                .setAspectRatio(new Rational(1, 1))
                .build()
        );
    }
}`}
                  </pre>
                  <p className="font-sans text-[10px] text-slate-400 mt-1">
                    And in <b>AndroidManifest.xml</b>:
                  </p>
                  <pre className="p-2 rounded-lg bg-slate-950 text-cyan-300 text-[9px]">
{`android:supportsPictureInPicture="true"`}
                  </pre>
                  <p className="font-sans text-[10px] text-slate-300 mt-1">
                    Whenever you switch from your APK to Uber, Android will automatically float MotoRide over Uber!
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};
