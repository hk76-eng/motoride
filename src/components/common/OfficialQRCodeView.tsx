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

export const OfficialQRCodeView: React.FC<OfficialQRCodeViewProps> = ({
  qrImageUrl = '/official_admin_qr.svg',
  upiId = 'hemant76@idbi',
  merchantName = 'Hemant',
  note = 'Platform Commission / Driver Wallet Top-Up',
  amount,
  size = 140,
  className = '',
  showDetails = true,
}) => {
  const [svgData, setSvgData] = useState<string>('');
  const [fallbackToStandee, setFallbackToStandee] = useState<boolean>(false);
  const [isZoomed, setIsZoomed] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Sanitize obsolete defaults to permanent uploaded Hemant credentials
  const cleanUpiId = (!upiId || upiId === 'motoride.platform@upi' || upiId === 'motoride.pay@upi')
    ? 'hemant76@idbi'
    : upiId;
  const cleanMerchantName = (!merchantName || merchantName === 'Motoride Technologies Ltd')
    ? 'Hemant'
    : merchantName;

  // Construct official UPI payment URI
  const numericAmount = amount ? Number(amount) : 0;
  const validAmount = !isNaN(numericAmount) && numericAmount > 0 ? numericAmount : 0;
  const upiUri = `upi://pay?pa=${encodeURIComponent(cleanUpiId)}&pn=${encodeURIComponent(
    cleanMerchantName
  )}&cu=INR${validAmount > 0 ? `&am=${validAmount.toFixed(2)}` : ''}&tn=${encodeURIComponent(note)}`;

  // Priority image source:
  // 1. qrImageUrl if provided and valid
  // 2. Default permanent uploaded standee SVG (/official_admin_qr.svg)
  let resolvedImageSrc = '/official_admin_qr.svg';
  if (!fallbackToStandee && qrImageUrl && qrImageUrl.trim().length > 0 && !qrImageUrl.includes('qrserver.com')) {
    resolvedImageSrc = qrImageUrl;
  }

  // Backup vector SVG generation only if both custom and standee fail
  useEffect(() => {
    let isMounted = true;
    QRCode.toString(upiUri, {
      type: 'svg',
      margin: 1.5,
      color: {
        dark: '#008559',
        light: '#ffffff',
      },
      errorCorrectionLevel: 'H',
    })
      .then((svg) => {
        if (isMounted && svg) {
          setSvgData(svg);
        }
      })
      .catch(() => {});

    return () => {
      isMounted = false;
    };
  }, [upiUri]);

  // Reset fallback if url prop changes
  useEffect(() => {
    setFallbackToStandee(false);
  }, [qrImageUrl]);

  const handleCopyUpi = () => {
    try {
      if (navigator?.clipboard?.writeText) {
        navigator.clipboard.writeText(cleanUpiId);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = cleanUpiId;
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
      link.download = `official-qr-${cleanMerchantName.toLowerCase().replace(/\s+/g, '_')}.svg`;
      link.href = resolvedImageSrc;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.warn('Download QR failed:', err);
    }
  };

  return (
    <div className={`flex flex-col sm:flex-row items-center gap-4 ${className}`}>
      <canvas ref={canvasRef} className="hidden" />

      {/* QR Code Container */}
      <div className="relative group shrink-0 flex flex-col items-center">
        {/* Main Permanent QR Card */}
        <div
          onClick={() => setIsZoomed(true)}
          style={{ width: `${size}px`, height: `${size * 1.24}px` }}
          className="rounded-2xl bg-white p-1.5 flex items-center justify-center shadow-xl shadow-black/40 border border-slate-700/60 cursor-pointer relative overflow-hidden transition-all hover:scale-[1.02] active:scale-95 group/qr select-none"
          title="Click to enlarge official QR Code"
        >
          <img
            src={resolvedImageSrc}
            alt={`Official QR Code for ${cleanMerchantName}`}
            onError={() => {
              if (resolvedImageSrc !== '/official_admin_qr.svg') {
                setFallbackToStandee(true);
              }
            }}
            className="w-full h-full object-contain rounded-xl pointer-events-none"
          />

          {/* Hover overlay hint */}
          <div className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover/qr:opacity-100 transition-opacity flex items-center justify-center rounded-2xl pointer-events-none">
            <span className="p-1.5 rounded-lg bg-black/85 text-white shadow flex items-center gap-1 text-[10px] font-bold">
              <Maximize2 className="w-3.5 h-3.5 text-amber-400" />
              <span>Enlarge</span>
            </span>
          </div>
        </div>

        {/* Tap to Enlarge & Download Buttons */}
        <div className="flex items-center gap-2 mt-2">
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
            title="Download Official QR to device"
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
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              Permanent Official QR
            </span>
            {validAmount > 0 && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 font-black font-mono-num">
                Amount: ₹{validAmount}
              </span>
            )}
          </div>

          {/* UPI ID box with copy button */}
          <div className="flex items-center justify-center sm:justify-start gap-2 flex-wrap">
            <div className="flex flex-col text-left">
              <span className="text-xs sm:text-sm font-mono font-black text-amber-300 truncate bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800 shadow-inner">
                {cleanUpiId}
              </span>
              <span className="text-[10px] font-bold text-slate-400 mt-0.5 ml-1">
                Account: <strong className="text-white">{cleanMerchantName}</strong>
              </span>
            </div>
            <button
              type="button"
              onClick={handleCopyUpi}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs text-white font-extrabold transition-all cursor-pointer border border-slate-700 flex items-center gap-1.5 shadow active:scale-95 shrink-0 self-start mt-0.5"
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
            <div className="w-72 h-88 rounded-2xl bg-white p-2 flex items-center justify-center shadow-xl border border-slate-700 overflow-hidden">
              <img
                src={resolvedImageSrc}
                alt={`Official QR Code for ${cleanMerchantName}`}
                className="w-full h-full object-contain"
              />
            </div>

            <div className="text-center flex flex-col items-center gap-1.5 w-full">
              <span className="text-xs font-mono font-bold text-amber-300 bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800">
                {cleanUpiId}
              </span>
              <span className="text-xs text-slate-300 font-bold">{cleanMerchantName}</span>
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
                <span>Save QR Standee Image</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
