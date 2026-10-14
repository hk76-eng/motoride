/**
 * Safe Utility for resolving local APK relative fetches to the live absolute domain.
 * Connects to the backend server (defaulting to https://motoride.wasmer.app).
 * Avoids protocol errors and crashes when running under file:// or offline WebView packages.
 */

export const WASMER_BACKEND_URL = 'https://motoride.wasmer.app';

export function getApiUrl(path: string): string {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  if (typeof window !== 'undefined') {
    const protocol = window.location.protocol;
    const hostname = window.location.hostname;
    // Prepend live backend host if running in native Android APK, WebView (file://), or local wrapper
    if (protocol === 'file:' || hostname === 'localhost' || hostname === '127.0.0.1') {
      const remoteBase = (import.meta as any)?.env?.VITE_API_BASE_URL || WASMER_BACKEND_URL;
      return `${remoteBase.replace(/\/$/, '')}${cleanPath}`;
    }
  }
  return cleanPath;
}
