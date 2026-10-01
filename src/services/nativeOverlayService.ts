import { registerPlugin } from '@capacitor/core';
import { safeStorage } from '../lib/safeStorage';

export interface FloatingOverlayPlugin {
  checkPermission(): Promise<{ granted: boolean }>;
  requestPermission(): Promise<{ granted: boolean; openedSettings?: boolean }>;
  startOverlay(): Promise<{ success: boolean }>;
  stopOverlay(): Promise<{ success: boolean }>;
  isEnabled(): Promise<{ enabled: boolean }>;
  setAppInForeground(options: { isForeground: boolean }): Promise<{ success: boolean }>;
}

// Register the Capacitor native plugin
export const NativeFloatingOverlay = registerPlugin<FloatingOverlayPlugin>('FloatingOverlay');

const STORAGE_KEY = 'motoride_floating_ride_button_enabled';

class NativeOverlayService {
  private isEnabledCache: boolean | null = null;
  private isInitialized = false;

  constructor() {
    this.init();
  }

  private init() {
    if (typeof window === 'undefined' || this.isInitialized) return;
    this.isInitialized = true;

    // Track browser/app visibility state to automatically show/hide overlay
    document.addEventListener('visibilitychange', () => {
      const isForeground = document.visibilityState === 'visible';
      this.notifyForegroundState(isForeground);
    });

    window.addEventListener('focus', () => {
      this.notifyForegroundState(true);
    });

    window.addEventListener('blur', () => {
      this.notifyForegroundState(false);
    });

    window.addEventListener('pagehide', () => {
      this.notifyForegroundState(false);
    });

    // Notify initial state
    setTimeout(() => {
      this.notifyForegroundState(document.visibilityState === 'visible');
    }, 1000);
  }

  /**
   * Check if running in a native Android environment (Capacitor or WebView with JavascriptInterface)
   */
  public isNativeAndroid(): boolean {
    if (typeof window === 'undefined') return false;
    const isCapacitorNative = (window as any)?.Capacitor?.isNativePlatform?.() ?? false;
    const hasAndroidBridge = Boolean((window as any)?.AndroidOverlay);
    return isCapacitorNative || hasAndroidBridge;
  }

  /**
   * Check if the user has enabled the Floating Ride Button in MotoRide settings
   */
  public isOverlayEnabled(): boolean {
    if (this.isEnabledCache !== null) return this.isEnabledCache;
    try {
      const stored = safeStorage.getItem(STORAGE_KEY);
      this.isEnabledCache = stored === 'true';
      return this.isEnabledCache;
    } catch {
      return false;
    }
  }

  /**
   * Check if Android SYSTEM_ALERT_WINDOW (Display over other apps) permission is granted
   */
  public async checkPermission(): Promise<boolean> {
    // 1. Android JavascriptInterface bridge
    if ((window as any)?.AndroidOverlay?.checkPermission) {
      try {
        return Boolean((window as any).AndroidOverlay.checkPermission());
      } catch (e) {
        console.warn('AndroidOverlay checkPermission error:', e);
      }
    }

    // 2. Capacitor Plugin
    try {
      if (this.isNativeAndroid() && NativeFloatingOverlay?.checkPermission) {
        const res = await NativeFloatingOverlay.checkPermission();
        return Boolean(res?.granted);
      }
    } catch (err) {
      console.warn('NativeFloatingOverlay checkPermission notice:', err);
    }

    // On standard web browsers, return true as soft-granted for web PiP fallback
    return true;
  }

  /**
   * Request the Android "Display over other apps" (SYSTEM_ALERT_WINDOW) permission
   * Opens Android Settings -> Manage Overlay Permission screen for MotoRide
   */
  public async requestPermission(): Promise<{ granted: boolean; openedSettings: boolean }> {
    // 1. Android JavascriptInterface bridge
    if ((window as any)?.AndroidOverlay?.requestPermission) {
      try {
        const opened = Boolean((window as any).AndroidOverlay.requestPermission());
        return { granted: false, openedSettings: opened };
      } catch (e) {
        console.warn('AndroidOverlay requestPermission error:', e);
      }
    }

    // 2. Capacitor Plugin
    try {
      if (this.isNativeAndroid() && NativeFloatingOverlay?.requestPermission) {
        const res = await NativeFloatingOverlay.requestPermission();
        return {
          granted: Boolean(res?.granted),
          openedSettings: Boolean(res?.openedSettings ?? true),
        };
      }
    } catch (err) {
      console.warn('NativeFloatingOverlay requestPermission error:', err);
    }

    return { granted: true, openedSettings: false };
  }

  /**
   * Enable the Floating Ride Button feature
   */
  public async enableOverlay(): Promise<{ success: boolean; requiresPermission: boolean }> {
    try {
      // If on native Android, verify permission first
      if (this.isNativeAndroid()) {
        const hasPermission = await this.checkPermission();
        if (!hasPermission) {
          const req = await this.requestPermission();
          if (!req.granted) {
            return { success: false, requiresPermission: true };
          }
        }

        // Start native service
        if ((window as any)?.AndroidOverlay?.startOverlay) {
          (window as any).AndroidOverlay.startOverlay();
        } else if (NativeFloatingOverlay?.startOverlay) {
          await NativeFloatingOverlay.startOverlay();
        }
      }

      this.isEnabledCache = true;
      safeStorage.setItem(STORAGE_KEY, 'true');
      safeStorage.setItem('motoride_run_over_apps', 'true');
      window.dispatchEvent(new CustomEvent('motoride_floating_button_changed', { detail: true }));
      window.dispatchEvent(new CustomEvent('motoride_run_over_apps_changed', { detail: true }));

      return { success: true, requiresPermission: false };
    } catch (err) {
      console.error('Failed to enable floating overlay:', err);
      return { success: false, requiresPermission: false };
    }
  }

  /**
   * Disable the Floating Ride Button feature and stop native overlay service
   */
  public async disableOverlay(): Promise<boolean> {
    try {
      this.isEnabledCache = false;
      safeStorage.setItem(STORAGE_KEY, 'false');
      safeStorage.setItem('motoride_run_over_apps', 'false');
      window.dispatchEvent(new CustomEvent('motoride_floating_button_changed', { detail: false }));
      window.dispatchEvent(new CustomEvent('motoride_run_over_apps_changed', { detail: false }));

      if (this.isNativeAndroid()) {
        if ((window as any)?.AndroidOverlay?.stopOverlay) {
          (window as any).AndroidOverlay.stopOverlay();
        } else if (NativeFloatingOverlay?.stopOverlay) {
          await NativeFloatingOverlay.stopOverlay();
        }
      }

      return true;
    } catch (err) {
      console.warn('Failed to stop floating overlay:', err);
      return false;
    }
  }

  /**
   * Notify native Android layer whether MotoRide is in foreground or background
   */
  public async notifyForegroundState(isForeground: boolean): Promise<void> {
    if (!this.isOverlayEnabled()) return;

    try {
      if ((window as any)?.AndroidOverlay?.setAppInForeground) {
        (window as any).AndroidOverlay.setAppInForeground(isForeground);
      } else if (this.isNativeAndroid() && NativeFloatingOverlay?.setAppInForeground) {
        await NativeFloatingOverlay.setAppInForeground({ isForeground });
      }
    } catch (err) {
      // Quiet fail if not in native context
    }
  }
}

export const nativeOverlayService = new NativeOverlayService();
