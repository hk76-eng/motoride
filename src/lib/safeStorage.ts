/**
 * Safe Storage utility for Mobile WebViews, APKs, and browsers
 * Prevents "SecurityError: Access is denied" or crashes when localStorage
 * is unavailable, disabled, or sandboxed in Android WebViews.
 */

const memoryStore = new Map<string, string>();

const isStorageAvailable = (): boolean => {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return false;
    }
    const testKey = '__motoride_test_storage__';
    window.localStorage.setItem(testKey, testKey);
    window.localStorage.removeItem(testKey);
    return true;
  } catch {
    return false;
  }
};

const hasLocalStorage = isStorageAvailable();

export const safeStorage = {
  getItem(key: string): string | null {
    try {
      if (hasLocalStorage && typeof window !== 'undefined' && window.localStorage) {
        const val = window.localStorage.getItem(key);
        if (val !== null) return val;
      }
    } catch {
      // Fallback to memory store
    }
    return memoryStore.get(key) ?? null;
  },

  setItem(key: string, value: string): void {
    try {
      memoryStore.set(key, value);
      if (hasLocalStorage && typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(key, value);
      }
    } catch (err) {
      console.warn(`[SafeStorage] Could not persist key "${key}" to localStorage:`, err);
    }
  },

  removeItem(key: string): void {
    try {
      memoryStore.delete(key);
      if (hasLocalStorage && typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem(key);
      }
    } catch (err) {
      console.warn(`[SafeStorage] Could not remove key "${key}":`, err);
    }
  },

  clear(): void {
    try {
      memoryStore.clear();
      if (hasLocalStorage && typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.clear();
      }
    } catch {}
  },

  getJSON<T>(key: string, fallback: T): T {
    try {
      const raw = this.getItem(key);
      if (!raw) return fallback;
      return JSON.parse(raw) as T;
    } catch {
      return fallback;
    }
  },

  setJSON(key: string, value: any): void {
    try {
      this.setItem(key, JSON.stringify(value));
    } catch (err) {
      console.warn(`[SafeStorage] Could not set JSON for key "${key}":`, err);
    }
  },
};
