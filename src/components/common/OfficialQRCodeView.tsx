import React, { useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import {
  QrCode,
  Maximize2,
  X,
  ExternalLink,
  Check,
  Copy,
  Smartphone,
  Download,
  RefreshCw,
  Image as ImageIcon,
} from 'lucide-react';

interface OfficialQRCodeViewProps {
  qrImageUrl?: string | null;
  upiId?: string;
  merchantName?: string;
  note?: string;
  amount?: number | string;
  size?: number;
  className?: string;
  showDetails?: boolean;
}

// Pre-computed instant vector SVG fallback so there is never a blank or "generating" flash
const DEFAULT_OFFICIAL_QR_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 51 51" shape-rendering="crispEdges"><path fill="#ffffff" d="M0 0h51v51H0z"/><path stroke="#020617" d="M1 1.5h7m2 0h2m1 0h6m1 0h2m1 0h1m1 0h1m2 0h1m3 0h1m3 0h1m4 0h1m1 0h7M1 2.5h1m5 0h1m1 0h3m1 0h2m1 0h1m1 0h3m1 0h4m2 0h2m1 0h3m2 0h1m1 0h4m1 0h1m5 0h1M1 3.5h1m1 0h3m1 0h1m1 0h3m1 0h2m1 0h1m2 0h2m4 0h3m1 0h2m2 0h1m6 0h2m1 0h1m1 0h3m1 0h1M1 4.5h1m1 0h3m1 0h1m1 0h1m2 0h1m3 0h1m1 0h2m1 0h4m1 0h1m2 0h1m2 0h2m1 0h4m1 0h1m2 0h1m1 0h3m1 0h1M1 5.5h1m1 0h3m1 0h1m2 0h1m1 0h2m1 0h1m1 0h1m2 0h8m2 0h3m3 0h1m1 0h1m4 0h1m1 0h3m1 0h1M1 6.5h1m5 0h1m4 0h2m1 0h2m4 0h1m1 0h1m3 0h2m1 0h1m2 0h1m1 0h2m1 0h2m3 0h1m5 0h1M1 7.5h7m1 0h1m1 0h1m1 0h1m1 0h1m1 0h1m1 0h1m1 0h1m1 0h1m1 0h1m1 0h1m1 0h1m1 0h1m1 0h1m1 0h1m1 0h1m1 0h1m1 0h7M9 8.5h1m5 0h1m2 0h6m3 0h5m1 0h3m4 0h2M1 9.5h1m5 0h1m1 0h1m1 0h2m1 0h3m1 0h4m1 0h5m2 0h3m1 0h4m1 0h2m1 0h2m2 0h3M2 10.5h4m3 0h2m3 0h2m2 0h4m1 0h1m2 0h2m1 0h7m1 0h1m1 0h2m2 0h1m1 0h2M7 11.5h1m3 0h2m1 0h1m5 0h1m1 0h1m1 0h1m1 0h2m1 0h2m2 0h3m2 0h4m4 0h4M1 12.5h1m1 0h1m1 0h2m2 0h1m4 0h2m2 0h1m1 0h1m1 0h1m1 0h1m1 0h1m2 0h2m2 0h4m1 0h5m1 0h2m2 0h2M2 13.5h2m1 0h3m1 0h4m2 0h1m3 0h1m1 0h1m1 0h5m1 0h1m2 0h2m1 0h1m1 0h1m1 0h2m4 0h1M1 14.5h1m2 0h3m3 0h1m1 0h1m2 0h2m1 0h2m6 0h1m2 0h4m1 0h1m1 0h1m3 0h1m1 0h3m3 0h1M5 15.5h3m1 0h1m1 0h2m4 0h1m1 0h2m4 0h1m1 0h1m4 0h1m1 0h3m2 0h4m3 0h4M3 16.5h1m1 0h2m1 0h4m1 0h3m2 0h2m1 0h1m1 0h2m2 0h3m1 0h3m1 0h3m1 0h1m1 0h1m5 0h3M1 17.5h2m1 0h2m1 0h1m1 0h3m1 0h1m2 0h4m1 0h1m2 0h2m1 0h2m1 0h2m5 0h2m2 0h4m2 0h3M1 18.5h1m1 0h4m1 0h3m1 0h1m2 0h3m1 0h2m3 0h1m1 0h1m1 0h1m2 0h2m3 0h2m4 0h2m1 0h1m2 0h1M2 19.5h2m2 0h3m1 0h1m1 0h2m1 0h2m3 0h10m1 0h3m1 0h3m1 0h1m1 0h2m1 0h6M3 20.5h1m1 0h1m4 0h1m1 0h1m1 0h2m3 0h4m1 0h1m4 0h1m1 0h1m1 0h3m4 0h1m1 0h2m1 0h2m1 0h2M2 21.5h1m3 0h4m2 0h2m3 0h1m3 0h6m1 0h1m2 0h2m2 0h3m3 0h1m1 0h1m2 0h4M1 22.5h2m3 0h1m1 0h1m1 0h8m3 0h2m2 0h1m1 0h1m1 0h4m1 0h3m1 0h2m1 0h4m1 0h1M2 23.5h11m1 0h5m2 0h8m6 0h1m1 0h1m1 0h1m1 0h5m1 0h3M3 24.5h1m1 0h1m3 0h2m1 0h3m3 0h2m2 0h2m3 0h1m3 0h1m1 0h3m5 0h1m3 0h2m2 0h1M1 25.5h1m1 0h3m1 0h1m1 0h1m2 0h3m1 0h3m1 0h1m1 0h2m1 0h1m1 0h1m1 0h1m3 0h1m3 0h5m1 0h1m1 0h1m3 0h1M2 26.5h1m1 0h2m3 0h1m2 0h1m1 0h1m5 0h1m1 0h2m3 0h1m3 0h4m1 0h1m1 0h1m1 0h2m3 0h3m1 0h1M2 27.5h1m2 0h5m1 0h1m2 0h1m1 0h1m1 0h2m2 0h7m3 0h1m1 0h2m1 0h2m1 0h6m2 0h2M3 28.5h1m1 0h2m1 0h1m3 0h3m1 0h4m1 0h1m1 0h1m1 0h3m2 0h1m3 0h1m3 0h2m1 0h1m2 0h1m1 0h4M1 29.5h2m4 0h1m1 0h1m3 0h1m4 0h1m4 0h3m6 0h1m3 0h3m1 0h1m1 0h1m1 0h2m2 0h1M3 30.5h2m3 0h2m3 0h2m1 0h3m1 0h2m1 0h1m1 0h1m1 0h1m3 0h1m2 0h1m1 0h2m4 0h3m3 0h1M1 31.5h1m2 0h6m1 0h1m1 0h1m1 0h1m1 0h1m2 0h1m4 0h1m1 0h1m1 0h2m2 0h2m5 0h1m2 0h1m2 0h2m1 0h1M1 32.5h2m7 0h2m1 0h1m2 0h1m1 0h5m2 0h1m1 0h1m2 0h1m3 0h2m1 0h10m1 0h1M3 33.5h3m1 0h3m6 0h2m1 0h1m1 0h1m1 0h2m1 0h1m2 0h1m2 0h5m2 0h3m1 0h1m1 0h1M1 34.5h2m1 0h1m1 0h1m1 0h2m2 0h1m2 0h1m3 0h5m1 0h1m1 0h1m2 0h1m3 0h1m3 0h1m1 0h1m2 0h3M1 35.5h2m2 0h1m1 0h5m2 0h2m1 0h3m2 0h4m3 0h1m1 0h4m1 0h1m5 0h2m5 0h1M3 36.5h1m2 0h1m1 0h1m1 0h1m3 0h2m1 0h1m2 0h3m1 0h2m1 0h4m1 0h2m3 0h1m2 0h1m3 0h2m3 0h1M1 37.5h1m2 0h1m2 0h2m3 0h2m5 0h1m1 0h4m2 0h5m1 0h2m2 0h1m1 0h2m2 0h1m5 0h1M1 38.5h1m1 0h1m2 0h1m3 0h1m3 0h1m3 0h3m2 0h3m1 0h1m1 0h6m2 0h1m3 0h1m1 0h2m1 0h1m1 0h1M2 39.5h1m3 0h3m1 0h5m2 0h1m3 0h1m6 0h1m5 0h2m1 0h10m1 0h2M2 40.5h3m4 0h3m2 0h3m2 0h2m1 0h4m2 0h1m1 0h2m2 0h1m3 0h3m3 0h1m1 0h2M1 41.5h3m3 0h2m2 0h1m1 0h2m1 0h13m1 0h3m1 0h1m1 0h2m2 0h10M9 42.5h2m1 0h3m2 0h2m1 0h1m2 0h1m3 0h1m1 0h1m1 0h4m1 0h3m1 0h2m3 0h1m2 0h1M1 43.5h7m3 0h2m1 0h1m1 0h3m1 0h1m2 0h1m1 0h1m1 0h3m4 0h1m2 0h2m1 0h2m1 0h1m1 0h5M1 44.5h1m5 0h1m2 0h5m4 0h2m2 0h1m3 0h5m1 0h1m1 0h1m5 0h1m3 0h2M1 45.5h1m1 0h3m1 0h1m2 0h2m1 0h5m2 0h1m2 0h5m2 0h3m3 0h2m1 0h10M1 46.5h1m1 0h3m1 0h1m3 0h1m3 0h1m2 0h1m2 0h1m1 0h1m1 0h2m1 0h2m1 0h7m1 0h2m1 0h2m2 0h3M1 47.5h1m1 0h3m1 0h1m2 0h2m2 0h4m2 0h1m1 0h1m1 0h2m1 0h2m1 0h1m2 0h1m1 0h2m1 0h2m6 0h1m1 0h2M1 48.5h1m5 0h1m3 0h1m3 0h4m3 0h1m1 0h5m2 0h2m3 0h2m2 0h1m1 0h2m1 0h2m2 0h1M1 49.5h7m1 0h2m1 0h5m1 0h1m1 0h1m2 0h1m2 0h4m1 0h3m1 0h3m1 0h1m1 0h2m1 0h1m1 0h1m2 0h1"/></svg>`;

export const OfficialQRCodeView: React.FC<OfficialQRCodeViewProps> = ({
  qrImageUrl,
  upiId = 'motoride.platform@upi',
  merchantName = 'Motoride Technologies Ltd',
  note = 'Platform Commission / Wallet Top-Up',
  amount,
  size = 140,
  className = '',
  showDetails = true,
}) => {
  const [svgData, setSvgData] = useState<string>(DEFAULT_OFFICIAL_QR_SVG);
  const [dataUrl, setDataUrl] = useState<string>('');
  const [customImageError, setCustomImageError] = useState<boolean>(false);
  const [isZoomed, setIsZoomed] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);
  const [viewMode, setViewMode] = useState<'generated' | 'custom'>('generated');
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Filter out any stale third-party generator URLs (like api.qrserver.com)
  const isCustomUploadedImage =
    Boolean(qrImageUrl &&
    qrImageUrl.trim().length > 0 &&
    !qrImageUrl.includes('qrserver.com') &&
    (qrImageUrl.startsWith('data:image/') || qrImageUrl.startsWith('blob:') || qrImageUrl.startsWith('http')));

  // Construct official UPI payment URI
  const numericAmount = amount ? Number(amount) : 0;
  const validAmount = !isNaN(numericAmount) && numericAmount > 0 ? numericAmount : 0;
  const upiUri = `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(
    merchantName
  )}&cu=INR${validAmount > 0 ? `&am=${validAmount.toFixed(2)}` : ''}&tn=${encodeURIComponent(note)}`;

  // Generate crisp vector SVG directly on the client side
  useEffect(() => {
    let isMounted = true;

    // Generate pure vector SVG (zero network request, 100% reliable)
    QRCode.toString(upiUri, {
      type: 'svg',
      margin: 1.5,
      color: {
        dark: '#020617', // Slate 950 deep contrast
        light: '#ffffff',
      },
      errorCorrectionLevel: 'M',
    })
      .then((svg) => {
        if (isMounted && svg) {
          setSvgData(svg);
        }
      })
      .catch((err) => {
        console.warn('QR code SVG generation fallback warning:', err);
      });

    // Also generate PNG DataURL for downloading or image fallbacks
    QRCode.toDataURL(upiUri, {
      width: Math.max(size * 3, 480),
      margin: 1.5,
      color: {
        dark: '#020617',
        light: '#ffffff',
      },
      errorCorrectionLevel: 'M',
    })
      .then((url) => {
        if (isMounted && url) {
          setDataUrl(url);
        }
      })
      .catch(() => {});

    return () => {
      isMounted = false;
    };
  }, [upiUri, size]);

  // When admin uploads a new custom QR, switch to custom mode
  useEffect(() => {
    if (isCustomUploadedImage) {
      setCustomImageError(false);
      setViewMode('custom');
    } else {
      setViewMode('generated');
    }
  }, [qrImageUrl, isCustomUploadedImage]);

  const handleCopyUpi = () => {
    try {
      if (navigator?.clipboard?.writeText) {
        navigator.clipboard.writeText(upiId);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = upiId;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {}
  };

  const handleDownloadQr = () => {
    try {
      const link = document.createElement('a');
      link.download = `motoride-official-qr-${validAmount > 0 ? validAmount : 'pay'}.png`;
      link.href = dataUrl || `data:image/svg+xml;utf8,${encodeURIComponent(svgData)}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.warn('Download QR failed:', err);
    }
  };

  const showCustomNow = viewMode === 'custom' && isCustomUploadedImage && !customImageError;

  return (
    <div className={`flex flex-col sm:flex-row items-center gap-4 ${className}`}>
      {/* Hidden canvas for PNG export if needed */}
      <canvas ref={canvasRef} className="hidden" />

      {/* QR Code Container */}
      <div className="relative group shrink-0 flex flex-col items-center">
        {/* Toggle button if both uploaded standee and dynamic QR are available */}
        {isCustomUploadedImage && !customImageError && (
          <div className="mb-2 flex items-center gap-1 p-0.5 bg-slate-900 border border-slate-800 rounded-xl text-[10px]">
            <button
              type="button"
              onClick={() => setViewMode('generated')}
              className={`px-2 py-0.5 rounded-lg font-bold transition-all cursor-pointer ${
                viewMode === 'generated'
                  ? 'bg-amber-500 text-slate-950 shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Dynamic UPI
            </button>
            <button
              type="button"
              onClick={() => setViewMode('custom')}
              className={`px-2 py-0.5 rounded-lg font-bold transition-all cursor-pointer ${
                viewMode === 'custom'
                  ? 'bg-amber-500 text-slate-950 shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Custom Standee
            </button>
          </div>
        )}

        {/* Main QR Card */}
        <div
          onClick={() => setIsZoomed(true)}
          style={{ width: `${size}px`, height: `${size}px` }}
          className="rounded-2xl bg-white p-2.5 flex items-center justify-center shadow-xl shadow-black/40 border border-slate-700/60 cursor-pointer relative overflow-hidden transition-all hover:scale-[1.02] active:scale-95 group/qr select-none"
          title="Click to enlarge official QR Code"
        >
          {showCustomNow ? (
            <img
              src={qrImageUrl!}
              alt={`Official Admin Uploaded QR for ${merchantName}`}
              onError={() => setCustomImageError(true)}
              className="w-full h-full object-contain rounded-lg pointer-events-none"
            />
          ) : (
            <div
              className="w-full h-full flex items-center justify-center [&>svg]:w-full [&>svg]:h-full [&>svg]:max-w-full [&>svg]:max-h-full [&>svg]:object-contain pointer-events-none"
              dangerouslySetInnerHTML={{ __html: svgData }}
            />
          )}

          {/* Hover overlay hint */}
          <div className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover/qr:opacity-100 transition-opacity flex items-center justify-center rounded-2xl pointer-events-none">
            <span className="p-1.5 rounded-lg bg-black/85 text-white shadow flex items-center gap-1 text-[10px] font-bold">
              <Maximize2 className="w-3.5 h-3.5 text-amber-400" />
              <span>Enlarge</span>
            </span>
          </div>
        </div>

        {/* Tap to Enlarge & Download Buttons */}
        <div className="flex items-center gap-2 mt-1.5">
          <button
            type="button"
            onClick={() => setIsZoomed(true)}
            className="text-[10px] font-bold text-slate-400 hover:text-amber-300 flex items-center justify-center gap-1 transition-colors cursor-pointer"
          >
            <Maximize2 className="w-3 h-3 text-amber-400" />
            <span>Enlarge</span>
          </button>
          <span className="text-slate-600 text-[10px]">•</span>
          <button
            type="button"
            onClick={handleDownloadQr}
            className="text-[10px] font-bold text-slate-400 hover:text-emerald-300 flex items-center justify-center gap-1 transition-colors cursor-pointer"
            title="Download QR Image to device"
          >
            <Download className="w-3 h-3 text-emerald-400" />
            <span>Save</span>
          </button>
        </div>
      </div>

      {/* Details & Actions */}
      {showDetails && (
        <div className="flex flex-col gap-2.5 min-w-0 w-full text-center sm:text-left">
          <div className="flex items-center justify-center sm:justify-start gap-2 flex-wrap">
            <span className="text-[11px] font-extrabold text-amber-400 uppercase tracking-wider flex items-center gap-1">
              <QrCode className="w-3.5 h-3.5 stroke-[2.5]" />
              OFFICIAL UPI QR CODE
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 font-extrabold flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Active & Verified
            </span>
            {validAmount > 0 && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 font-black font-mono-num">
                Amount: ₹{validAmount}
              </span>
            )}
          </div>

          {/* UPI ID box with copy button */}
          <div className="flex items-center justify-center sm:justify-start gap-2 flex-wrap">
            <span className="text-xs sm:text-sm font-mono font-black text-amber-300 truncate bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800 shadow-inner">
              {upiId}
            </span>
            <button
              type="button"
              onClick={handleCopyUpi}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs text-white font-extrabold transition-all cursor-pointer border border-slate-700 flex items-center gap-1.5 shadow active:scale-95 shrink-0"
              title="Copy official UPI ID"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400 stroke-[3]" />
                  <span className="text-emerald-400">Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-slate-300" />
                  <span>Copy</span>
                </>
              )}
            </button>
          </div>

          {/* 1-Tap Mobile UPI Payment Links */}
          <div className="flex flex-col sm:flex-row gap-2">
            <a
              href={upiUri}
              className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-xs shadow-md transition-all active:scale-98 w-full sm:w-auto text-center"
            >
              <Smartphone className="w-4 h-4 text-emerald-200" />
              <span>Pay via Any UPI App (GPay / PhonePe / Paytm)</span>
              <ExternalLink className="w-3.5 h-3.5 opacity-80" />
            </a>
          </div>

          <p className="text-[11px] text-slate-400 leading-snug">
            {note || 'Scan using PhonePe, Google Pay, Paytm, or BHIM to deposit commission or top up balance.'}
          </p>
        </div>
      )}

      {/* Fullscreen Zoom Modal */}
      {isZoomed && (
        <div
          onClick={() => setIsZoomed(false)}
          className="fixed inset-0 z-[2500] bg-slate-950/95 backdrop-blur-md flex flex-col items-center justify-center p-4 animate-in fade-in duration-150"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-3xl bg-slate-900 border border-slate-800 p-6 flex flex-col items-center gap-4 shadow-2xl relative"
          >
            <button
              type="button"
              onClick={() => setIsZoomed(false)}
              className="absolute top-4 right-4 p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-all cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2">
              <QrCode className="w-5 h-5 text-amber-400" />
              <h4 className="text-base font-extrabold text-white">Official QR Code</h4>
            </div>

            {/* High-Resolution QR */}
            <div className="w-64 h-64 rounded-2xl bg-white p-3 flex items-center justify-center shadow-xl border border-slate-700 overflow-hidden">
              {showCustomNow ? (
                <img
                  src={qrImageUrl!}
                  alt={`Official QR Code for ${merchantName}`}
                  className="w-full h-full object-contain"
                />
              ) : (
                <div
                  className="w-full h-full flex items-center justify-center [&>svg]:w-full [&>svg]:h-full [&>svg]:object-contain"
                  dangerouslySetInnerHTML={{ __html: svgData }}
                />
              )}
            </div>

            <div className="text-center flex flex-col items-center gap-1.5 w-full">
              <span className="text-xs font-mono font-bold text-amber-300 bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800">
                {upiId}
              </span>
              <span className="text-xs text-slate-400">{merchantName}</span>
              {validAmount > 0 && (
                <span className="text-sm font-black text-emerald-400 font-mono-num">
                  Amount: ₹{validAmount.toFixed(2)}
                </span>
              )}
            </div>

            <div className="flex flex-col gap-2 w-full">
              <a
                href={upiUri}
                className="w-full py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs flex items-center justify-center gap-2 transition-all shadow-lg active:scale-95"
              >
                <Smartphone className="w-4 h-4" />
                <span>Open in PhonePe / GPay / Paytm</span>
              </a>

              <button
                type="button"
                onClick={handleDownloadQr}
                className="w-full py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs flex items-center justify-center gap-2 transition-all active:scale-95 cursor-pointer border border-slate-700"
              >
                <Download className="w-3.5 h-3.5 text-emerald-400" />
                <span>Download QR Image</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
