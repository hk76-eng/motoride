import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import { QrCode, Maximize2, X, ExternalLink, Check, Copy, Smartphone } from 'lucide-react';

interface OfficialQRCodeViewProps {
  qrImageUrl?: string | null;
  upiId?: string;
  merchantName?: string;
  note?: string;
  amount?: number | string;
  size?: number;
  className?: string;
}

export const OfficialQRCodeView: React.FC<OfficialQRCodeViewProps> = ({
  qrImageUrl,
  upiId = 'motoride.platform@upi',
  merchantName = 'Motoride Technologies Ltd',
  note = 'Platform Commission / Wallet Top-Up',
  amount,
  size = 140,
  className = '',
}) => {
  const [generatedQrDataUrl, setGeneratedQrDataUrl] = useState<string>('');
  const [imageError, setImageError] = useState<boolean>(false);
  const [isZoomed, setIsZoomed] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);

  // Construct official UPI payment URI
  const numericAmount = amount ? Number(amount) : 0;
  const upiUri = `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(
    merchantName
  )}&cu=INR${numericAmount > 0 ? `&am=${numericAmount.toFixed(2)}` : ''}&tn=${encodeURIComponent(note)}`;

  // Generate crisp local vector-clear QR code via qrcode library
  useEffect(() => {
    let isMounted = true;
    QRCode.toDataURL(upiUri, {
      width: Math.max(size * 2.5, 360),
      margin: 1.5,
      color: {
        dark: '#020617', // Slate 950 deep contrast
        light: '#ffffff',
      },
      errorCorrectionLevel: 'M',
    })
      .then((url) => {
        if (isMounted) {
          setGeneratedQrDataUrl(url);
        }
      })
      .catch((err) => {
        console.warn('QR code client generation error:', err);
      });

    return () => {
      isMounted = false;
    };
  }, [upiUri, size]);

  // Reset image error state whenever URL changes
  useEffect(() => {
    setImageError(false);
  }, [qrImageUrl]);

  const handleCopyUpi = () => {
    try {
      navigator.clipboard.writeText(upiId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {}
  };

  // Determine what image source to display:
  // 1. Admin uploaded image if available and hasn't errored
  // 2. Otherwise, dynamically generated UPI QR data URL
  const activeImageSrc = !imageError && qrImageUrl && qrImageUrl.trim().length > 0
    ? qrImageUrl
    : generatedQrDataUrl;

  return (
    <div className={`flex flex-col sm:flex-row items-center gap-4 ${className}`}>
      {/* QR Code Container */}
      <div className="relative group shrink-0">
        <div
          onClick={() => setIsZoomed(true)}
          style={{ width: `${size}px`, height: `${size}px` }}
          className="rounded-2xl bg-white p-2.5 flex items-center justify-center shadow-xl shadow-black/40 border border-slate-700/60 cursor-pointer relative overflow-hidden transition-all hover:scale-[1.02] active:scale-95"
          title="Click to enlarge QR Code"
        >
          {activeImageSrc ? (
            <img
              src={activeImageSrc}
              alt={`Official UPI QR for ${merchantName}`}
              onError={() => setImageError(true)}
              className="w-full h-full object-contain rounded-lg pointer-events-none"
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center text-slate-500 gap-1.5 animate-pulse">
              <QrCode className="w-8 h-8 text-slate-400 stroke-[1.5]" />
              <span className="text-[10px] font-bold text-slate-600">Generating QR...</span>
            </div>
          )}

          {/* Hover overlay hint */}
          <div className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-2xl">
            <span className="p-1.5 rounded-lg bg-black/80 text-white shadow">
              <Maximize2 className="w-4 h-4" />
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setIsZoomed(true)}
          className="mt-1 text-[10px] font-bold text-slate-400 hover:text-white flex items-center justify-center gap-1 w-full text-center transition-colors"
        >
          <Maximize2 className="w-3 h-3 text-amber-400" />
          <span>Tap to Enlarge</span>
        </button>
      </div>

      {/* Details & Actions */}
      <div className="flex flex-col gap-2.5 min-w-0 w-full text-center sm:text-left">
        <div className="flex items-center justify-center sm:justify-start gap-2">
          <span className="text-[11px] font-extrabold text-amber-400 uppercase tracking-wider flex items-center gap-1">
            <QrCode className="w-3.5 h-3.5" />
            OFFICIAL UPI ID
          </span>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 font-extrabold">
            Active & Verified
          </span>
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

        {/* 1-Tap Mobile UPI Payment Link */}
        <a
          href={upiUri}
          className="inline-flex items-center justify-center sm:justify-start gap-2 px-3 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-xs shadow-md transition-all active:scale-98 w-full sm:w-auto"
        >
          <Smartphone className="w-4 h-4 text-emerald-200" />
          <span>Pay via Installed UPI App (GPay / PhonePe / Paytm)</span>
          <ExternalLink className="w-3.5 h-3.5 opacity-80" />
        </a>

        <p className="text-[11px] text-slate-400 leading-snug">
          {note || 'Scan using PhonePe, Google Pay, Paytm, or BHIM to deposit commission or top up balance.'}
        </p>
      </div>

      {/* Fullscreen Zoom Modal */}
      {isZoomed && (
        <div
          onClick={() => setIsZoomed(false)}
          className="fixed inset-0 z-[2500] bg-slate-950/90 backdrop-blur-md flex flex-col items-center justify-center p-4 animate-in fade-in duration-150"
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
              {activeImageSrc && (
                <img
                  src={activeImageSrc}
                  alt={`Official QR Code for ${merchantName}`}
                  className="w-full h-full object-contain"
                />
              )}
            </div>

            <div className="text-center flex flex-col items-center gap-1.5 w-full">
              <span className="text-xs font-mono font-bold text-amber-300 bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800">
                {upiId}
              </span>
              <span className="text-xs text-slate-400">{merchantName}</span>
              {numericAmount > 0 && (
                <span className="text-sm font-black text-emerald-400 font-mono-num">
                  Amount: ₹{numericAmount}
                </span>
              )}
            </div>

            <a
              href={upiUri}
              className="w-full py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs flex items-center justify-center gap-2 transition-all shadow-lg active:scale-95"
            >
              <Smartphone className="w-4 h-4" />
              <span>Open in PhonePe / GPay / Paytm</span>
            </a>
          </div>
        </div>
      )}
    </div>
  );
};
