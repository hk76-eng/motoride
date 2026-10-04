/**
 * Safe Utility for resolving local APK relative fetches to the live absolute domain.
 * Avoids protocol errors and crashes when running under file:// or offline WebView packages.
 */

export function getApiUrl(path: string): string {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  if (typeof window !== 'undefined') {
    const protocol = window.location.protocol;
    // Only prepend host if running as native local APK / WebView under file:// protocol
    if (protocol === 'file:') {
      return `https://motoride-roan.vercel.app${cleanPath}`;
    }
  }
  return cleanPath;
}
