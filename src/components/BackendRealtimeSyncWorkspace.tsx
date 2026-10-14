import React, { useState, useEffect, useRef } from 'react';
import { realtimeSync } from '../services/realtimeSync';
import { motorideApi, toCanonicalStatus } from '../services/motorideApi';
import { MotorideRide } from '../types/motoride';
import {
  Activity,
  Radio,
  Server,
  Zap,
  RefreshCw,
  Send,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ShieldCheck,
  ChevronRight,
  Code,
  MapPin,
  Bike,
  User,
  ExternalLink,
  Laptop,
  Flame,
  ArrowRightLeft,
} from 'lucide-react';

interface EventLogItem {
  id: string;
  event: string;
  timestamp: number;
  timeStr: string;
  source: 'sse' | 'supabase' | 'local';
  summary: string;
  payload: any;
}

interface BackendRealtimeSyncWorkspaceProps {
  onSwitchToApp?: () => void;
  showSwitchAppButton?: boolean;
}

export function BackendRealtimeSyncWorkspace({
  onSwitchToApp,
  showSwitchAppButton = true,
}: BackendRealtimeSyncWorkspaceProps) {
  const [events, setEvents] = useState<EventLogItem[]>([]);
  const [filterType, setFilterType] = useState<string>('all');
  const [activeRides, setActiveRides] = useState<MotorideRide[]>([]);
  const [serverStats, setServerStats] = useState<{
    connectedClients: number;
    totalEventsBroadcast: number;
    uptimeSeconds: number;
    status: string;
  }>({
    connectedClients: 1,
    totalEventsBroadcast: 0,
    uptimeSeconds: 0,
    status: 'online',
  });
  const [serverLatency, setServerLatency] = useState<number | null>(null);
  const [isPinging, setIsPinging] = useState<boolean>(false);
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null);
  const [lastHeartbeat, setLastHeartbeat] = useState<number>(Date.now());
  const [isBroadcastingTest, setIsBroadcastingTest] = useState<boolean>(false);
  const [testEventMessage, setTestEventMessage] = useState<string>('Live synchronization test ping');

  const sseConnectedRef = useRef<boolean>(false);
  const [sseConnected, setSseConnected] = useState<boolean>(false);
  const [supabaseConnected, setSupabaseConnected] = useState<boolean>(true);

  // Measure backend ping latency
  const runPing = async () => {
    setIsPinging(true);
    try {
      const res = await realtimeSync.pingServer();
      setServerLatency(res.latencyMs >= 0 ? res.latencyMs : null);
    } catch {
      setServerLatency(null);
    } finally {
      setIsPinging(false);
    }
  };

  // Load backend server sync data
  const refreshSyncData = async () => {
    try {
      const data = await realtimeSync.fetchServerSyncData();
      if (data) {
        if (data.stats) {
          setServerStats({
            connectedClients: data.stats.connectedClients || 1,
            totalEventsBroadcast: data.stats.totalEventsBroadcast || 0,
            uptimeSeconds: data.stats.uptimeSeconds || 0,
            status: data.stats.status || 'online',
          });
        }
        if (Array.isArray(data.activeRides)) {
          setActiveRides(data.activeRides);
        }
      }
    } catch (e) {
      console.warn('Sync data fetch failed:', e);
    }
  };

  // Setup live event capture across all three synchronization streams:
  // 1. Server SSE Stream (/api/motoride/realtime/stream)
  // 2. Supabase Realtime channel (motoride-global-realtime)
  // 3. Local BroadcastChannel (motoride-local-realtime)
  useEffect(() => {
    runPing();
    refreshSyncData();

    const pingTimer = setInterval(runPing, 10000);
    const syncTimer = setInterval(refreshSyncData, 6000);

    const logEvent = (event: string, payload: any, source: 'sse' | 'supabase' | 'local' = 'sse') => {
      const now = Date.now();
      let summary = '';
      try {
        if (payload?.ride_code) summary = `Ride #${payload.ride_code} (${payload.status || 'updated'})`;
        else if (payload?.ride?.ride_code) summary = `Ride #${payload.ride.ride_code} (${payload.status || payload.ride.status || 'status changed'})`;
        else if (payload?.lat && payload?.lng) summary = `Coordinates: ${Number(payload.lat).toFixed(4)}, ${Number(payload.lng).toFixed(4)}`;
        else if (payload?.balance !== undefined) summary = `Wallet Balance ₹${payload.balance}`;
        else if (payload?.message) summary = String(payload.message).slice(0, 60);
        else if (typeof payload === 'object') summary = Object.keys(payload).slice(0, 4).join(', ');
        else summary = String(payload);
      } catch {
        summary = event;
      }

      const item: EventLogItem = {
        id: `evt_${now}_${Math.random().toString(36).substring(2, 6)}`,
        event,
        timestamp: now,
        timeStr: new Date(now).toLocaleTimeString(),
        source,
        summary: summary || event,
        payload,
      };

      setEvents((prev) => [item, ...prev.slice(0, 199)]);
      setLastHeartbeat(now);

      // Auto update active rides list if this event affects rides
      if (
        event === 'RIDE_CREATED' ||
        event === 'RIDE_UPDATED' ||
        event === 'RIDE_ACCEPTED' ||
        event === 'RIDE_STATUS_CHANGED' ||
        event === 'ACTIVE_RIDES_SYNC_RECEIVED'
      ) {
        refreshSyncData();
      }
    };

    // Listen to all real-time events through manager
    const unsubs = [
      realtimeSync.on('CONNECTION_STATUS', (payload: any) => {
        if (payload?.type === 'sse') {
          sseConnectedRef.current = payload.connected;
          setSseConnected(payload.connected);
        } else if (payload?.type === 'supabase_realtime') {
          setSupabaseConnected(payload.connected);
        }
      }),
      realtimeSync.on('RIDE_CREATED', (data) => logEvent('RIDE_CREATED', data)),
      realtimeSync.on('RIDE_ACCEPTED', (data) => logEvent('RIDE_ACCEPTED', data)),
      realtimeSync.on('RIDE_STATUS_CHANGED', (data) => logEvent('RIDE_STATUS_CHANGED', data)),
      realtimeSync.on('RIDE_UPDATED', (data) => logEvent('RIDE_UPDATED', data)),
      realtimeSync.on('RIDE_CANCELLED', (data) => logEvent('RIDE_CANCELLED', data)),
      realtimeSync.on('CAPTAIN_LOCATION_UPDATED', (data) => logEvent('CAPTAIN_LOCATION_UPDATED', data)),
      realtimeSync.on('PASSENGER_LOCATION_UPDATED', (data) => logEvent('PASSENGER_LOCATION_UPDATED', data)),
      realtimeSync.on('WALLET_UPDATED', (data) => logEvent('WALLET_UPDATED', data)),
      realtimeSync.on('TOPUP_REQUEST_CREATED', (data) => logEvent('TOPUP_REQUEST_CREATED', data)),
      realtimeSync.on('TOPUP_REQUEST_UPDATED', (data) => logEvent('TOPUP_REQUEST_UPDATED', data)),
      realtimeSync.on('TOPUP_CHAT_MESSAGE_RECEIVED', (data) => logEvent('TOPUP_CHAT_MESSAGE_RECEIVED', data)),
      realtimeSync.on('RIDE_MESSAGE_RECEIVED', (data) => logEvent('RIDE_MESSAGE_RECEIVED', data)),
      realtimeSync.on('ACTIVE_RIDES_SYNC_RECEIVED', (data) => logEvent('ACTIVE_RIDES_SYNC_RECEIVED', data)),
      realtimeSync.on('TEST_SYNC_PING', (data) => logEvent('TEST_SYNC_PING', data)),
    ];

    return () => {
      clearInterval(pingTimer);
      clearInterval(syncTimer);
      unsubs.forEach((unsub) => unsub());
    };
  }, []);

  // Broadcast test event
  const handleSendTestBroadcast = () => {
    setIsBroadcastingTest(true);
    const msg = testEventMessage.trim() || 'Backend Server Real-Time Synchronization Ping';
    realtimeSync.broadcast('TEST_SYNC_PING', {
      message: msg,
      timestamp: Date.now(),
      sender: 'wasmer-realtime-console',
    });
    setTimeout(() => {
      setIsBroadcastingTest(false);
      refreshSyncData();
    }, 400);
  };

  const filteredEvents = events.filter((evt) => {
    if (filterType === 'all') return true;
    if (filterType === 'rides') return evt.event.startsWith('RIDE_') || evt.event.includes('RIDE');
    if (filterType === 'locations') return evt.event.includes('LOCATION');
    if (filterType === 'wallets') return evt.event.includes('WALLET') || evt.event.includes('TOPUP');
    if (filterType === 'system') return evt.event === 'TEST_SYNC_PING' || evt.event === 'CONNECTION_STATUS';
    return true;
  });

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-emerald-500 selection:text-slate-950">
      {/* Top Banner / Header */}
      <header className="border-b border-slate-800 bg-slate-900/90 backdrop-blur-md sticky top-0 z-30 px-4 sm:px-6 py-3.5">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center text-slate-950 shadow-lg shadow-emerald-500/20 font-black">
              <Activity className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-black tracking-tight text-white flex items-center gap-2">
                  MotoRide Backend Server Real-Time Sync
                </h1>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                  LIVE
                </span>
              </div>
              <p className="text-xs text-slate-400 flex items-center gap-2">
                <span className="font-mono text-emerald-300">https://motoride.wasmer.app</span>
                <span>•</span>
                <span>Server-Sent Events &amp; Database State Mirror</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {/* Quick Ping Latency Badge */}
            <button
              type="button"
              onClick={runPing}
              disabled={isPinging}
              className="px-3 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700 text-xs font-mono flex items-center gap-2 transition-colors cursor-pointer"
              title="Click to re-ping server"
            >
              <Radio className={`w-3.5 h-3.5 ${serverLatency !== null ? 'text-emerald-400' : 'text-amber-400'}`} />
              <span>
                {isPinging ? 'Pinging...' : serverLatency !== null ? `${serverLatency}ms latency` : 'Pinging...'}
              </span>
            </button>

            {/* Refresh Data */}
            <button
              type="button"
              onClick={() => {
                refreshSyncData();
                runPing();
              }}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors cursor-pointer"
              title="Refresh server state"
            >
              <RefreshCw className="w-4 h-4" />
            </button>

            {/* Switch to Full App View */}
            {showSwitchAppButton && onSwitchToApp && (
              <button
                type="button"
                onClick={onSwitchToApp}
                className="px-3.5 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs flex items-center gap-1.5 shadow-md shadow-emerald-500/20 active:scale-95 transition-all cursor-pointer"
              >
                <ArrowRightLeft className="w-3.5 h-3.5" />
                <span>Open Full App</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 space-y-6">
        {/* Real-Time Connectivity Diagnostic Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Server-Sent Events Stream */}
          <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 shadow-sm relative overflow-hidden">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-slate-400">Backend SSE Stream</span>
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
            </div>
            <div className="text-lg font-black text-white flex items-center gap-2">
              <Zap className="w-4 h-4 text-emerald-400" />
              <span>Connected / Active</span>
            </div>
            <div className="text-[11px] font-mono text-slate-400 mt-1 truncate">
              /api/motoride/realtime/stream
            </div>
          </div>

          {/* Card 2: Supabase Realtime Channel */}
          <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-slate-400">Database Realtime</span>
              <span className="flex h-2 w-2 relative">
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
            </div>
            <div className="text-lg font-black text-white flex items-center gap-2">
              <Server className="w-4 h-4 text-emerald-400" />
              <span>Subscribed</span>
            </div>
            <div className="text-[11px] font-mono text-slate-400 mt-1 truncate">
              motoride-global-realtime
            </div>
          </div>

          {/* Card 3: Connected Clients */}
          <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-slate-400">Live SSE Clients</span>
              <User className="w-3.5 h-3.5 text-teal-400" />
            </div>
            <div className="text-2xl font-black text-emerald-400">
              {Math.max(1, serverStats.connectedClients)}
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              Multi-tab &amp; cross-device peers
            </div>
          </div>

          {/* Card 4: Total Events Broadcasted */}
          <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-slate-400">Total Sync Events</span>
              <Activity className="w-3.5 h-3.5 text-amber-400" />
            </div>
            <div className="text-2xl font-black text-white font-mono">
              {serverStats.totalEventsBroadcast + events.length}
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              Live broadcasted transitions
            </div>
          </div>
        </div>

        {/* Live Broadcast Trigger & Diagnostics Tool */}
        <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Flame className="w-4 h-4 text-emerald-400" />
              <h2 className="text-sm font-black text-white">Broadcast Real-Time Event Across Server</h2>
            </div>
            <span className="text-xs text-slate-400 font-mono">
              Endpoint: POST /api/motoride/realtime/broadcast
            </span>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-2.5">
            <input
              type="text"
              value={testEventMessage}
              onChange={(e) => setTestEventMessage(e.target.value)}
              placeholder="Enter message or event payload..."
              className="flex-1 w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-emerald-500"
            />
            <button
              type="button"
              disabled={isBroadcastingTest}
              onClick={handleSendTestBroadcast}
              className="w-full sm:w-auto px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs flex items-center justify-center gap-2 active:scale-95 transition-all cursor-pointer shadow-md shadow-emerald-500/20"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{isBroadcastingTest ? 'Broadcasting...' : 'Broadcast Ping to All Devices'}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                realtimeSync.requestSync();
                refreshSyncData();
              }}
              className="w-full sm:w-auto px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Sync Active Rides</span>
            </button>
          </div>
        </div>

        {/* Two-Column Layout: Active Synchronized Rides + Real-Time Live Feed */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Active Rides Synchronizing (5 cols) */}
          <div className="lg:col-span-5 flex flex-col space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bike className="w-4 h-4 text-emerald-400" />
                <h2 className="text-sm font-black text-white">Active Synchronized Rides</h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-slate-800 text-emerald-300">
                  {activeRides.length}
                </span>
              </div>
              <span className="text-[11px] text-slate-400">Live Server Memory</span>
            </div>

            {activeRides.length === 0 ? (
              <div className="p-8 rounded-2xl bg-slate-900 border border-slate-800 text-center space-y-2">
                <Bike className="w-8 h-8 text-slate-600 mx-auto" />
                <div className="text-sm font-bold text-slate-300">No Active Rides Pending</div>
                <p className="text-xs text-slate-500 max-w-xs mx-auto">
                  When a passenger requests a ride or a captain accepts, it will appear here in real time.
                </p>
                {onSwitchToApp && (
                  <button
                    type="button"
                    onClick={onSwitchToApp}
                    className="mt-3 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-emerald-400 border border-slate-700 inline-flex items-center gap-1 cursor-pointer"
                  >
                    <span>Request a Ride in App</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-2.5 max-h-[600px] overflow-y-auto pr-1">
                {activeRides.map((ride) => {
                  const canonical = toCanonicalStatus(ride.status);
                  return (
                    <div
                      key={ride.id}
                      className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition-all space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-mono font-black text-emerald-400">
                          {ride.ride_code || ride.id}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                            canonical === 'in_progress'
                              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                              : canonical === 'captain_arrived'
                              ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                              : canonical === 'accepted'
                              ? 'bg-blue-500/20 text-blue-400 border border-blue-500/40'
                              : 'bg-slate-800 text-slate-300'
                          }`}
                        >
                          {canonical}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="truncate">
                          <span className="text-slate-500 block text-[10px]">Passenger</span>
                          <span className="font-bold text-white truncate block">
                            {ride.passenger_name || 'Passenger'}
                          </span>
                        </div>
                        <div className="truncate">
                          <span className="text-slate-500 block text-[10px]">Captain</span>
                          <span className="font-bold text-white truncate block">
                            {ride.captain_name || (ride.captain_id ? 'Assigned' : 'Searching...')}
                          </span>
                        </div>
                      </div>

                      <div className="text-[11px] text-slate-400 bg-slate-950/60 p-2 rounded-xl flex items-center justify-between">
                        <span className="truncate pr-2">
                          📍 {ride.pickup_address || 'Pickup'} &rarr; {ride.dropoff_address || 'Dropoff'}
                        </span>
                        <span className="font-mono font-bold text-emerald-300 shrink-0">
                          ₹{ride.agreed_fare || ride.final_fare || ride.initial_fare || 0}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right Column: Live Real-Time Event Stream (7 cols) */}
          <div className="lg:col-span-7 flex flex-col space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Radio className="w-4 h-4 text-emerald-400 animate-pulse" />
                <h2 className="text-sm font-black text-white">Live Event Stream</h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-slate-800 text-slate-300">
                  {filteredEvents.length} events
                </span>
              </div>

              {/* Filter Pills */}
              <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800">
                {(['all', 'rides', 'locations', 'wallets', 'system'] as const).map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setFilterType(tab)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold capitalize transition-colors cursor-pointer ${
                      filterType === tab
                        ? 'bg-emerald-500 text-slate-950 font-black'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {tab}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setEvents([])}
                  className="p-1 rounded-lg text-slate-400 hover:text-rose-400 transition-colors ml-1 cursor-pointer"
                  title="Clear event history"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Event List Feed */}
            <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
              {filteredEvents.length === 0 ? (
                <div className="p-8 rounded-2xl bg-slate-900 border border-slate-800 text-center space-y-2">
                  <Activity className="w-8 h-8 text-slate-600 mx-auto" />
                  <div className="text-sm font-bold text-slate-300">Waiting for live events...</div>
                  <p className="text-xs text-slate-500">
                    Use the broadcast tool above or perform actions in another tab to observe real-time events.
                  </p>
                </div>
              ) : (
                filteredEvents.map((evt) => {
                  const isExpanded = expandedEventId === evt.id;
                  const isRideEvent = evt.event.includes('RIDE');
                  const isLocation = evt.event.includes('LOCATION');
                  const isWallet = evt.event.includes('WALLET') || evt.event.includes('TOPUP');

                  return (
                    <div
                      key={evt.id}
                      className="p-3 rounded-2xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition-colors space-y-1.5"
                    >
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-2 py-0.5 rounded-lg text-[10px] font-black uppercase font-mono ${
                              isRideEvent
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                                : isLocation
                                ? 'bg-blue-500/10 text-blue-400 border border-blue-500/30'
                                : isWallet
                                ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                                : 'bg-slate-800 text-slate-300'
                            }`}
                          >
                            {evt.event}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">{evt.timeStr}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setExpandedEventId(isExpanded ? null : evt.id)}
                          className="text-[10px] text-slate-400 hover:text-emerald-400 font-mono flex items-center gap-1 cursor-pointer"
                        >
                          <Code className="w-3 h-3" />
                          <span>{isExpanded ? 'Hide Payload' : 'Payload'}</span>
                        </button>
                      </div>

                      <div className="text-xs text-slate-200 font-medium break-all">
                        {evt.summary}
                      </div>

                      {/* Expandable JSON Payload */}
                      {isExpanded && (
                        <pre className="text-[10px] font-mono bg-slate-950 p-2.5 rounded-xl border border-slate-800 text-emerald-300 overflow-x-auto max-h-48 scrollbar-thin">
                          {JSON.stringify(evt.payload, null, 2)}
                        </pre>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Bottom Status Bar */}
      <footer className="border-t border-slate-800 bg-slate-900/60 px-4 py-3 text-xs text-slate-400">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3 font-mono text-[11px]">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span>MotoRide Real-Time Sync Authority</span>
            <span>•</span>
            <span>Target: https://motoride.wasmer.app</span>
          </div>
          <div>
            Last Heartbeat: {new Date(lastHeartbeat).toLocaleTimeString()}
          </div>
        </div>
      </footer>
    </div>
  );
}
