import { getSupabase, isSupabaseConfigured } from '../lib/supabase';
import { MotorideRide } from '../types/motoride';

type EventCallback = (payload: any) => void;

class RealtimeSyncManager {
  private listeners: Map<string, Set<EventCallback>> = new Map();
  private sseSource: EventSource | null = null;
  private isConnected: boolean = false;
  private reconnectTimeout: any = null;

  constructor() {
    this.init();
  }

  private init() {
    // 1. Initialize Supabase Realtime if configured
    if (isSupabaseConfigured()) {
      const supabase = getSupabase();
      if (supabase) {
        try {
          const channel = supabase
            .channel('motoride-realtime-channel')
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
            .subscribe((status: string) => {
              console.log('Supabase Realtime subscription status:', status);
            });
        } catch (err) {
          console.warn('Supabase Realtime setup warning:', err);
        }
      }
    }

    // 2. Initialize Shared Backend SSE stream for instant cross-device sync
    this.connectSSE();
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
        this.isConnected = false;
        this.emit('CONNECTION_STATUS', { connected: false, type: 'sse' });
        this.sseSource?.close();
        clearTimeout(this.reconnectTimeout);
        this.reconnectTimeout = setTimeout(() => {
          this.connectSSE();
        }, 3000);
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

  public emit(event: string, payload: any) {
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
  }

  public getStatus() {
    return {
      isConnected: this.isConnected,
      isSupabaseActive: isSupabaseConfigured(),
    };
  }
}

export const realtimeSync = new RealtimeSyncManager();
