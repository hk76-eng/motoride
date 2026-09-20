import { getSupabase, isSupabaseConfigured } from '../lib/supabase';
import { MotorideRide } from '../types/motoride';

type EventCallback = (payload: any) => void;

class RealtimeSyncManager {
  private listeners: Map<string, Set<EventCallback>> = new Map();
  private sseSource: EventSource | null = null;
  private isConnected: boolean = false;
  private reconnectTimeout: any = null;
  private supabaseChannel: any = null;

  constructor() {
    this.init();
  }

  private init() {
    // 1. Initialize Supabase Realtime Broadcast & Postgres changes
    if (isSupabaseConfigured()) {
      const supabase = getSupabase();
      if (supabase) {
        try {
          this.supabaseChannel = supabase
            .channel('motoride-global-realtime', {
              config: { broadcast: { self: false } },
            })
            .on('broadcast', { event: 'MOTORIDE_EVENT' }, ({ payload }: any) => {
              if (payload?.event) {
                this.emit(payload.event, payload.data);
              }
            })
            .on('broadcast', { event: 'REQUEST_ACTIVE_SYNC' }, () => {
              this.emit('REQUEST_SYNC_RECEIVED', {});
            })
            .on('broadcast', { event: 'ACTIVE_RIDES_SYNC' }, ({ payload }: any) => {
              if (Array.isArray(payload?.rides)) {
                this.emit('ACTIVE_RIDES_SYNC_RECEIVED', payload.rides);
              }
            })
            .on(
              'postgres_changes',
              { event: '*', schema: 'public', table: 'rides' },
              (payload: any) => {
                if (payload.eventType === 'INSERT') {
                  this.emit('RIDE_CREATED', payload.new);
                } else if (payload.eventType === 'UPDATE') {
                  this.emit('RIDE_UPDATED', payload.new);
                  if (payload.new.status === 'captain_accepted') {
                    this.emit('RIDE_ACCEPTED', payload.new);
                  }
                  this.emit('RIDE_STATUS_CHANGED', { ride: payload.new, status: payload.new.status });
                }
              }
            )
            .on(
              'postgres_changes',
              { event: 'INSERT', schema: 'public', table: 'ride_offers' },
              (payload: any) => {
                this.emit('RIDE_OFFER_RECEIVED', payload.new);
              }
            )
            .on(
              'postgres_changes',
              { event: '*', schema: 'public', table: 'captain_locations' },
              (payload: any) => {
                this.emit('CAPTAIN_LOCATION_UPDATED', payload.new);
              }
            )
            .on(
              'postgres_changes',
              { event: '*', schema: 'public', table: 'passenger_locations' },
              (payload: any) => {
                this.emit('PASSENGER_LOCATION_UPDATED', payload.new);
              }
            )
            .on(
              'postgres_changes',
              { event: '*', schema: 'public', table: 'profiles' },
              (payload: any) => {
                this.emit('PROFILES_UPDATED', payload.new);
                if (payload.new?.role === 'passenger') {
                  this.emit('PASSENGERS_UPDATED', payload.new);
                } else if (payload.new?.role === 'captain') {
                  this.emit('CAPTAINS_UPDATED', payload.new);
                }
              }
            )
            .on(
              'postgres_changes',
              { event: '*', schema: 'public', table: 'passengers' },
              (payload: any) => {
                this.emit('PASSENGERS_UPDATED', payload.new);
              }
            )
            .on(
              'postgres_changes',
              { event: '*', schema: 'public', table: 'captains' },
              (payload: any) => {
                this.emit('CAPTAINS_UPDATED', payload.new);
              }
            )
            .subscribe((status: string) => {
              if (status === 'SUBSCRIBED') {
                this.isConnected = true;
                this.emit('CONNECTION_STATUS', { connected: true, type: 'supabase_realtime' });
                // Request any active ride state from connected peers
                this.requestSync();
              }
            });
        } catch (err) {
          console.warn('Supabase Realtime setup warning:', err);
        }
      }
    }

    // 2. Initialize Shared Backend SSE stream if available
    this.connectSSE();

    // 3. Initialize Local BroadcastChannel for instant same-browser multi-tab synchronization
    if (typeof window !== 'undefined' && window.BroadcastChannel) {
      try {
        const localChannel = new BroadcastChannel('motoride-local-realtime');
        localChannel.onmessage = (event) => {
          const { type, payload } = event.data || {};
          if (type && payload) {
            this.emit(type, payload, false); // Don't broadcast it back to local channel
          }
        };
      } catch (err) {
        console.warn('Local BroadcastChannel setup warning:', err);
      }
    }

    // Reconnect on tab focus / wake up from background on mobile
    if (typeof window !== 'undefined') {
      const handleWake = () => {
        if (document.visibilityState === 'visible' || navigator.onLine) {
          if (!this.isConnected || !this.sseSource || this.sseSource.readyState === EventSource.CLOSED) {
            this.connectSSE();
          }
          this.requestSync();
        }
      };
      window.addEventListener('visibilitychange', handleWake);
      window.addEventListener('focus', handleWake);
      window.addEventListener('online', handleWake);
    }
  }

  private connectSSE() {
    if (typeof window === 'undefined' || !window.EventSource) return;

    if (this.sseSource) {
      this.sseSource.close();
    }

    try {
      this.sseSource = new EventSource('/api/motoride/realtime/stream');

      this.sseSource.onopen = () => {
        this.isConnected = true;
        this.emit('CONNECTION_STATUS', { connected: true, type: 'sse' });
      };

      this.sseSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.event && data.event !== 'PING') {
            this.emit(data.event, data.payload);
          }
        } catch {}
      };

      this.sseSource.onerror = () => {
        // SSE is unavailable on static hosting (like Vercel) - fallback seamlessly to Supabase Realtime
        if (!isSupabaseConfigured()) {
          this.isConnected = false;
          this.emit('CONNECTION_STATUS', { connected: false, type: 'sse' });
        }
        this.sseSource?.close();
        clearTimeout(this.reconnectTimeout);
        this.reconnectTimeout = setTimeout(() => {
          this.connectSSE();
        }, 8000);
      };
    } catch (err) {
      console.warn('SSE connection attempt error:', err);
    }
  }

  public on(event: string, callback: EventCallback): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);

    return () => {
      this.listeners.get(event)?.delete(callback);
    };
  }

  public emit(event: string, payload: any, broadcastLocally: boolean = true) {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.forEach((cb) => {
        try {
          cb(payload);
        } catch (err) {
          console.error('Error in realtime event callback:', err);
        }
      });
    }

    if (broadcastLocally && typeof window !== 'undefined' && window.BroadcastChannel && event !== 'CONNECTION_STATUS' && event !== 'PING') {
      try {
        const bc = new BroadcastChannel('motoride-local-realtime');
        bc.postMessage({ type: event, payload });
        bc.close();
      } catch {}
    }
  }

  /**
   * Broadcasts an event locally AND across all connected browsers/devices via Supabase Realtime.
   */
  public broadcast(event: string, data: any) {
    // 1. Emit locally immediately
    this.emit(event, data);

    // 2. Broadcast via Supabase channel to all other clients across devices
    if (this.supabaseChannel) {
      try {
        this.supabaseChannel
          .send({
            type: 'broadcast',
            event: 'MOTORIDE_EVENT',
            payload: { event, data },
          })
          .catch((err: any) => {
            console.warn('Supabase broadcast error:', err);
          });
      } catch (err) {
        console.warn('Supabase broadcast send failed:', err);
      }
    }
  }

  public requestSync() {
    if (this.supabaseChannel) {
      try {
        this.supabaseChannel
          .send({
            type: 'broadcast',
            event: 'REQUEST_ACTIVE_SYNC',
            payload: {},
          })
          .catch(() => {});
      } catch {}
    }
  }

  public sendActiveRidesSync(rides: MotorideRide[]) {
    if (this.supabaseChannel && Array.isArray(rides) && rides.length > 0) {
      try {
        this.supabaseChannel
          .send({
            type: 'broadcast',
            event: 'ACTIVE_RIDES_SYNC',
            payload: { rides },
          })
          .catch(() => {});
      } catch {}
    }
  }

  public getStatus() {
    return {
      isConnected: this.isConnected,
      isSupabaseActive: isSupabaseConfigured(),
    };
  }
}

export const realtimeSync = new RealtimeSyncManager();

