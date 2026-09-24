/**
 * Safe Utility for resolving local APK relative fetches to the live absolute domain.
 * Avoids protocol errors and crashes when running under file:// or offline WebView packages.
 */

const LIVE_BACKEND_ORIGIN = 'https://ais-pre-p6me7wihmytacswsibs427-228826721152.asia-southeast1.run.app';

export function getApiUrl(path: string): string {
  if (typeof window !== 'undefined') {
    const protocol = window.location.protocol;
    const hostname = window.location.hostname;
    
    // If running inside local Android Assets (file://) or isolated Cordova/Capacitor environment
    if (protocol === 'file:' || hostname === '' || !hostname) {
      const cleanPath = path.startsWith('/') ? path : `/${path}`;
      return `${LIVE_BACKEND_ORIGIN}${cleanPath}`;
    }
  }
  return path;
}
