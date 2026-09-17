import React, { useState, useEffect } from 'react';
import {
  AdminDashboardStats,
  Captain,
  Passenger,
  MotorideRide,
  FareSettings,
  QRCodeSetting,
} from '../types/motoride';
import { motorideApi } from '../services/motorideApi';
import { SUPABASE_SQL_SCHEMA } from '../lib/sqlSchema';
import { isSupabaseConfigured, SUPABASE_CONFIG_STATUS } from '../lib/supabase';
import { realtimeSync } from '../services/realtimeSync';
import { AuthUser } from '../lib/supabaseAuth';
import {
  Shield,
  Users,
  Bike,
  Activity,
  CheckCircle2,
  XCircle,
  TrendingUp,
  Settings,
  QrCode,
  Database,
  Search,
  Copy,
  Check,
  Save,
  RefreshCw,
  Clock,
  Eye,
  Power,
  ChevronRight,
  LogOut,
} from 'lucide-react';

interface AdminWorkspaceProps {
  currentUser?: AuthUser | null;
  onSignOut?: () => void;
}

export const AdminWorkspace: React.FC<AdminWorkspaceProps> = ({
  currentUser,
  onSignOut,
}) => {
  const [activeTab, setActiveTab] = useState<
    'overview' | 'captains' | 'passengers' | 'rides' | 'fare' | 'qr' | 'supabase'
  >('overview');

  const [stats, setStats] = useState<AdminDashboardStats>({
    totalPassengers: 0,
    totalCaptains: 0,
    onlineCaptains: 0,
    activeRides: 0,
    completedRides: 0,
    cancelledRides: 0,
    todayRides: 0,
    todayPlatformRevenue: 0,
    totalVolume: 0,
  });

  const [captains, setCaptains] = useState<Captain[]>([]);
  const [passengers, setPassengers] = useState<Passenger[]>([]);
  const [rides, setRides] = useState<MotorideRide[]>([]);
  const [fareSettings, setFareSettings] = useState<FareSettings>(() => {
    try {
      const saved = localStorage.getItem('motoride_admin_fare_settings');
      if (saved) return JSON.parse(saved);
    } catch {}
    return {
      base_fare: 25,
      per_km_rate: 12,
      minimum_fare: 30,
      platform_commission_pct: 10,
      min_offer_pct: 70,
      max_offer_pct: 180,
      currency_symbol: '₹',
    };
  });
  const [qrSettings, setQrSettings] = useState<QRCodeSetting>({
    qr_image_url:
      'https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=upi://pay?pa=motoride.platform@upi%26pn=Motoride%20Technologies%26cu=INR',
    upi_id: 'motoride.platform@upi',
    merchant_name: 'Motoride Technologies Ltd',
    note: 'Scan using any UPI app to deposit platform driver commission or top-up driver wallet balance.',
    is_active: true,
    updated_at: new Date().toISOString(),
  });

  const [copiedSql, setCopiedSql] = useState(false);
  const [fareSaveStatus, setFareSaveStatus] = useState<string | null>(null);
  const [qrSaveStatus, setQrSaveStatus] = useState<string | null>(null);
  const [rideFilter, setRideFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  useEffect(() => {
    loadAllData();

    // Listen to real-time events to refresh admin metrics
    const unsub = realtimeSync.on('RIDE_UPDATED', () => {
      loadAllData();
    });
    const unsubCreate = realtimeSync.on('RIDE_CREATED', () => {
      loadAllData();
    });

    // 4-second poll to ensure admin view updates across devices
    const pollInterval = setInterval(() => {
      loadAllData();
    }, 4000);

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        loadAllData();
      }
    };
    window.addEventListener('focus', handleVisibility);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      unsub();
      unsubCreate();
      clearInterval(pollInterval);
      window.removeEventListener('focus', handleVisibility);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [activeTab]);

  const loadAllData = async () => {
    try {
      const [s, c, p, r, f, q] = await Promise.all([
        motorideApi.getAdminStats(),
        motorideApi.getCaptains(),
        motorideApi.getPassengers(),
        motorideApi.getRides(),
        motorideApi.getFareSettings(),
        motorideApi.getQRSettings(),
      ]);
      if (s) setStats(s);
      if (c) setCaptains(c);
      if (p) setPassengers(p);
      if (r) setRides(r);
      // Do not overwrite fareSettings if admin is actively viewing/editing the fare tab
      if (f && activeTab !== 'fare') {
        const localSaved = localStorage.getItem('motoride_admin_fare_settings');
        if (!localSaved) {
          setFareSettings(f);
        }
      }
      if (q) setQrSettings(q);
    } catch {}
  };

  const handleSaveFare = async () => {
    try {
      localStorage.setItem('motoride_admin_fare_settings', JSON.stringify(fareSettings));
      const updated = await motorideApi.updateFareSettings(fareSettings);
      if (updated) setFareSettings(updated);
      setFareSaveStatus('Global Fare & Commission Rules saved! Values are locked to admin configuration and will not auto-fill or reset.');
      setTimeout(() => setFareSaveStatus(null), 4000);
    } catch (err: any) {
      alert(err.message || 'Failed to save');
    }
  };

  const handleSaveQR = async () => {
    try {
      const updated = await motorideApi.updateQRSettings(qrSettings);
      setQrSettings(updated);
      setQrSaveStatus('QR settings saved & updated across all Captain wallets in real time!');
      setTimeout(() => setQrSaveStatus(null), 3000);
    } catch (err: any) {
      alert(err.message || 'Failed to save');
    }
  };

  const handleCopySql = () => {
    navigator.clipboard.writeText(SUPABASE_SQL_SCHEMA);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 2500);
  };

  const handleToggleCaptainStatus = async (captainId: string, currentApproved: boolean) => {
    try {
      await motorideApi.updateCaptainApproval(captainId, !currentApproved);
      loadAllData();
    } catch {}
  };

  const filteredRides = rides.filter((r) => {
    if (rideFilter !== 'all' && r.status !== rideFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        r.ride_code.toLowerCase().includes(q) ||
        r.passenger_name.toLowerCase().includes(q) ||
        (r.captain_name && r.captain_name.toLowerCase().includes(q))
      );
    }
    return true;
  });

  return (
    <div className="max-w-7xl mx-auto p-3 sm:p-6 flex flex-col gap-6">
      {/* Top Admin Sub-Navigation */}
      <div className="flex items-center justify-between flex-wrap gap-3 pb-2 border-b border-slate-800">
        <div>
          <h1 className="text-xl font-black text-white flex items-center gap-2">
            <Shield className="w-5 h-5 text-indigo-400" />
            <span>Motoride Global Admin Panel</span>
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Real-time management for Passengers, Captains, Rides, Fares, and Supabase Database
          </p>
        </div>

        <button
          type="button"
          onClick={loadAllData}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs font-semibold text-slate-300 cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5 text-indigo-400" />
          <span>Refresh Data</span>
        </button>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
        {[
          { key: 'overview', label: 'Dashboard Overview', icon: Activity },
          { key: 'rides', label: `Live Rides (${rides.length})`, icon: Bike },
          { key: 'captains', label: `Captains (${captains.length})`, icon: Users },
          { key: 'passengers', label: `Passengers (${passengers.length})`, icon: Users },
          { key: 'fare', label: 'Fare & Commission', icon: Settings },
          { key: 'qr', label: 'Official QR Code', icon: QrCode },
          { key: 'supabase', label: 'Supabase SQL Setup', icon: Database },
        ].map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              type="button"
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                activeTab === tab.key
                  ? 'bg-indigo-600 text-white shadow-lg'
                  : 'bg-slate-900/80 text-slate-400 hover:text-slate-200 border border-slate-800/80'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* VIEW 1: OVERVIEW */}
      {activeTab === 'overview' && (
        <div className="flex flex-col gap-5">
          {/* KPI Metrics Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
            <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-md">
              <span className="text-[11px] font-bold text-slate-400">ACTIVE RIDES</span>
              <div className="mt-2 flex items-baseline justify-between">
                <span className="text-2xl font-black text-amber-400 font-mono-num">
                  {stats.activeRides}
                </span>
                <span className="text-[10px] text-amber-500/80">In-flight</span>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-md">
              <span className="text-[11px] font-bold text-slate-400">TODAY&apos;S REVENUE</span>
              <div className="mt-2 flex items-baseline justify-between">
                <span className="text-2xl font-black text-emerald-400 font-mono-num">
                  ₹{stats.todayPlatformRevenue}
                </span>
                <span className="text-[10px] text-emerald-500/80">Commission</span>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-md">
              <span className="text-[11px] font-bold text-slate-400">ONLINE CAPTAINS</span>
              <div className="mt-2 flex items-baseline justify-between">
                <span className="text-2xl font-black text-sky-400 font-mono-num">
                  {stats.onlineCaptains} / {stats.totalCaptains}
                </span>
                <span className="text-[10px] text-sky-500/80">Active now</span>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-md">
              <span className="text-[11px] font-bold text-slate-400">TOTAL COMPLETED</span>
              <div className="mt-2 flex items-baseline justify-between">
                <span className="text-2xl font-black text-white font-mono-num">
                  {stats.completedRides}
                </span>
                <span className="text-[10px] text-slate-500 font-mono-num">
                  ₹{stats.totalVolume} GMV
                </span>
              </div>
            </div>
          </div>

          {/* Quick Active Rides Live List */}
          <div className="p-5 rounded-3xl bg-slate-900/90 border border-slate-800 flex flex-col gap-3 shadow-xl">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <Activity className="w-4 h-4 text-emerald-400" />
                <span>Active Rides Monitor (Real-time)</span>
              </h2>
              <span className="text-xs text-slate-400">{rides.length} Total Registered Rides</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950/70 text-slate-400 font-semibold border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-3">RIDE ID</th>
                    <th className="py-3 px-3">PASSENGER</th>
                    <th className="py-3 px-3">CAPTAIN</th>
                    <th className="py-3 px-3">PICKUP → DROPOFF</th>
                    <th className="py-3 px-3">FARE</th>
                    <th className="py-3 px-3">STATUS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {rides.slice(0, 8).map((r) => (
                    <tr key={r.id} className="hover:bg-slate-800/40">
                      <td className="py-3 px-3 font-mono-num font-bold text-indigo-400">
                        {r.ride_code}
                      </td>
                      <td className="py-3 px-3 font-medium text-white">{r.passenger_name}</td>
                      <td className="py-3 px-3 text-slate-300">
                        {r.captain_name ? (
                          <span className="font-semibold">{r.captain_name}</span>
                        ) : (
                          <span className="text-slate-500 italic">Unassigned</span>
                        )}
                      </td>
                      <td className="py-3 px-3 max-w-xs truncate text-slate-400">
                        {r.pickup_address} → {r.dropoff_address}
                      </td>
                      <td className="py-3 px-3 font-mono-num font-bold text-emerald-400">
                        ₹{r.final_fare || r.offered_fare}
                      </td>
                      <td className="py-3 px-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                            r.status === 'trip_completed'
                              ? 'bg-emerald-500/20 text-emerald-300'
                              : r.status.includes('cancelled')
                              ? 'bg-rose-500/20 text-rose-300'
                              : 'bg-amber-500/20 text-amber-300'
                          }`}
                        >
                          {r.status.replace(/_/g, ' ')}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* VIEW 2: CAPTAINS */}
      {activeTab === 'captains' && (
        <div className="p-5 rounded-3xl bg-slate-900/90 border border-slate-800 flex flex-col gap-4 shadow-xl">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-white">Registered Captains & Vehicles</h2>
            <span className="text-xs text-slate-400">{captains.length} Captains</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {captains.map((cpt) => (
              <div
                key={cpt.id}
                className="p-4 rounded-2xl bg-slate-950 border border-slate-800 flex flex-col gap-3"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold text-base">
                      🏍️
                    </div>
                    <div>
                      <h3 className="font-bold text-sm text-white">{cpt.full_name}</h3>
                      <p className="text-xs text-slate-400">{cpt.phone}</p>
                    </div>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                      cpt?.is_online
                        ? 'bg-emerald-500/20 text-emerald-400'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {cpt?.is_online ? 'ONLINE' : 'OFFLINE'}
                  </span>
                </div>

                {/* Vehicle details */}
                <div className="p-3 rounded-xl bg-slate-900/80 text-xs text-slate-300 flex items-center justify-between">
                  <div>
                    <span className="text-slate-400 block text-[10px]">VEHICLE</span>
                    <span className="font-bold">{cpt?.vehicle?.model || 'Mahindra Centuro'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">PLATE</span>
                    <span className="font-mono-num font-bold text-amber-300">
                      {cpt?.vehicle?.plate_number || 'PB65AA1257'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">RATING</span>
                    <span className="text-amber-400 font-bold">★ {cpt.rating}</span>
                  </div>
                </div>

                {/* Earnings & Toggle */}
                <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-800/80">
                  <div className="flex items-center gap-3">
                    <div>
                      <span className="text-[10px] text-slate-500 block">Today:</span>
                      <span className="font-mono-num font-bold text-amber-400">
                        ₹{cpt.today_earnings || 0}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 block">Total:</span>
                      <span className="font-mono-num font-bold text-white">
                        ₹{cpt.total_earnings || 0}
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleToggleCaptainStatus(cpt.id, cpt.is_approved)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer transition-colors ${
                      cpt.is_approved
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                    }`}
                  >
                    {cpt.is_approved ? 'Approved' : 'Suspended'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* VIEW 3: PASSENGERS */}
      {activeTab === 'passengers' && (
        <div className="p-5 rounded-3xl bg-slate-900/90 border border-slate-800 flex flex-col gap-4 shadow-xl">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-white">Registered Passengers</h2>
            <span className="text-xs text-slate-400">{passengers.length} Passengers</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {passengers.map((p) => (
              <div
                key={p.id}
                className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between"
              >
                <div>
                  <h3 className="font-bold text-sm text-white">{p.full_name}</h3>
                  <p className="text-xs text-slate-400">{p.phone}</p>
                  <span className="text-[10px] text-slate-500 mt-1 block">
                    Total rides taken: {p.total_rides} • Rating: ★{p.rating}
                  </span>
                </div>
                <span className="px-2.5 py-1 rounded-xl bg-emerald-500/20 text-emerald-400 text-xs font-bold">
                  Active
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* VIEW 4: ALL RIDES */}
      {activeTab === 'rides' && (
        <div className="p-5 rounded-3xl bg-slate-900/90 border border-slate-800 flex flex-col gap-4 shadow-xl">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h2 className="text-sm font-bold text-white">Full Ride Audits & Live Stream</h2>

            {/* Filters */}
            <div className="flex items-center gap-2">
              <select
                value={rideFilter}
                onChange={(e) => setRideFilter(e.target.value)}
                className="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200"
              >
                <option value="all">All Statuses</option>
                <option value="requested">Requested</option>
                <option value="captain_accepted">Captain Accepted</option>
                <option value="trip_started">Trip Started</option>
                <option value="trip_completed">Completed</option>
                <option value="cancelled_by_passenger">Cancelled by Passenger</option>
                <option value="cancelled_by_captain">Cancelled by Captain</option>
              </select>

              <input
                type="text"
                placeholder="Search ride code or name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 placeholder-slate-500"
              />
            </div>
          </div>

          <div className="flex flex-col gap-3">
            {filteredRides.map((r) => (
              <div
                key={r.id}
                className="p-4 rounded-2xl bg-slate-950 border border-slate-800/90 flex flex-col gap-2.5 shadow-md"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-mono-num font-bold text-xs text-indigo-400">
                      {r.ride_code}
                    </span>
                    <span className="text-xs text-slate-400">
                      Passenger: <span className="text-white font-bold">{r.passenger_name}</span>
                    </span>
                    {r.captain_name && (
                      <span className="text-xs text-slate-400">
                        • Captain:{' '}
                        <span className="text-amber-400 font-bold">{r.captain_name}</span> (
                        {r.plate_number})
                      </span>
                    )}
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                      r.status === 'trip_completed'
                        ? 'bg-emerald-500/20 text-emerald-300'
                        : r.status.includes('cancelled')
                        ? 'bg-rose-500/20 text-rose-300'
                        : 'bg-amber-500/20 text-amber-300'
                    }`}
                  >
                    {r.status.replace(/_/g, ' ')}
                  </span>
                </div>

                <div className="text-xs text-slate-300 space-y-1">
                  <p>
                    <span className="text-emerald-400 font-bold">Pickup:</span> {r.pickup_address}
                  </p>
                  <p>
                    <span className="text-rose-400 font-bold">Dropoff:</span> {r.dropoff_address}
                  </p>
                </div>

                <div className="flex items-center justify-between text-xs pt-1.5 border-t border-slate-800/80">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-200 font-bold text-[11px] flex items-center gap-1">
                      {r.ride_type === 'auto'
                        ? '🛺 Auto Rickshaw'
                        : r.ride_type === 'car'
                        ? '🚗 AC Cab'
                        : r.ride_type === 'courier'
                        ? '📦 Courier Parcel'
                        : '🏍️ Motobike'}
                    </span>
                    <span className="text-slate-400">
                      {r.distance_km} km • {r.duration_minutes} mins
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-slate-400">
                      Offered: <b className="text-slate-200">₹{r.offered_fare}</b>
                    </span>
                    <span className="text-emerald-400 font-bold font-mono-num text-sm">
                      Final: ₹{r.final_fare || r.offered_fare}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* VIEW 5: FARE SETTINGS */}
      {activeTab === 'fare' && (
        <div className="p-5 rounded-3xl bg-slate-900/90 border border-slate-800 flex flex-col gap-4 shadow-xl max-w-2xl">
          <div>
            <h2 className="text-base font-extrabold text-white">Global Fare & Commission Rules</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              These settings drive passenger fare estimates, captain commission deductions, and
              bidding constraints across the platform in real time.
            </p>
          </div>

          {fareSaveStatus && (
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold">
              {fareSaveStatus}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-400 block mb-1">
                Base Unlock Fare (₹)
              </label>
              <input
                type="number"
                value={fareSettings.base_fare}
                onChange={(e) =>
                  setFareSettings({ ...fareSettings, base_fare: Number(e.target.value) })
                }
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-sm font-mono-num text-white font-bold"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-400 block mb-1">
                Per-KM Rate (₹ / km)
              </label>
              <input
                type="number"
                value={fareSettings.per_km_rate}
                onChange={(e) =>
                  setFareSettings({ ...fareSettings, per_km_rate: Number(e.target.value) })
                }
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-sm font-mono-num text-white font-bold"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-400 block mb-1">
                Minimum Fare Floor (₹)
              </label>
              <input
                type="number"
                value={fareSettings.minimum_fare}
                onChange={(e) =>
                  setFareSettings({ ...fareSettings, minimum_fare: Number(e.target.value) })
                }
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-sm font-mono-num text-white font-bold"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-400 block mb-1">
                Platform Commission Fee (%)
              </label>
              <input
                type="number"
                value={fareSettings.platform_commission_pct}
                onChange={(e) =>
                  setFareSettings({
                    ...fareSettings,
                    platform_commission_pct: Number(e.target.value),
                  })
                }
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-sm font-mono-num text-emerald-400 font-bold"
              />
            </div>
          </div>

          <button
            type="button"
            onClick={handleSaveFare}
            className="mt-2 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-lg transition-all active:scale-98 cursor-pointer flex items-center justify-center gap-2"
          >
            <Save className="w-4 h-4" />
            <span>Save & Broadcast Fare Settings</span>
          </button>
        </div>
      )}

      {/* VIEW 6: QR CODE MANAGEMENT */}
      {activeTab === 'qr' && (
        <div className="p-5 rounded-3xl bg-slate-900/90 border border-slate-800 flex flex-col gap-4 shadow-xl max-w-3xl">
          <div>
            <h2 className="text-base font-extrabold text-white">
              Admin QR Code & UPI Payment Settings
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Captains scan this QR code directly inside their Captain Wallet to pay platform
              commissions or recharge their wallet balance.
            </p>
          </div>

          {qrSaveStatus && (
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold">
              {qrSaveStatus}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
            {/* Live Preview Box */}
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 flex flex-col items-center text-center gap-3">
              <span className="text-[11px] font-bold text-slate-400">CURRENT LIVE QR PREVIEW</span>
              <div className="w-48 h-48 p-2 bg-white rounded-2xl shadow-xl">
                <img
                  src={qrSettings.qr_image_url}
                  alt="QR Preview"
                  className="w-full h-full object-contain"
                />
              </div>
              <span className="text-xs font-bold text-white">{qrSettings.merchant_name}</span>
              <span className="text-xs font-mono-num text-amber-400 font-bold">
                {qrSettings.upi_id}
              </span>
            </div>

            {/* Edit Fields */}
            <div className="flex flex-col gap-3">
              <div>
                <label className="text-xs font-bold text-slate-400 block mb-1">
                  QR Image URL (or standard UPI generator URL)
                </label>
                <input
                  type="text"
                  value={qrSettings.qr_image_url}
                  onChange={(e) =>
                    setQrSettings({ ...qrSettings, qr_image_url: e.target.value })
                  }
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-400 block mb-1">
                  Merchant UPI ID
                </label>
                <input
                  type="text"
                  value={qrSettings.upi_id}
                  onChange={(e) => setQrSettings({ ...qrSettings, upi_id: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono-num text-white"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-400 block mb-1">
                  Merchant Display Name
                </label>
                <input
                  type="text"
                  value={qrSettings.merchant_name}
                  onChange={(e) =>
                    setQrSettings({ ...qrSettings, merchant_name: e.target.value })
                  }
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-400 block mb-1">
                  Instructions / Note for Captains
                </label>
                <textarea
                  rows={2}
                  value={qrSettings.note}
                  onChange={(e) => setQrSettings({ ...qrSettings, note: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white"
                />
              </div>

              <button
                type="button"
                onClick={handleSaveQR}
                className="mt-2 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-lg transition-all active:scale-98 cursor-pointer flex items-center justify-center gap-2"
              >
                <Save className="w-4 h-4" />
                <span>Save QR Code Setting</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* VIEW 7: SUPABASE SETUP & SQL MIGRATION */}
      {activeTab === 'supabase' && (
        <div className="p-5 rounded-3xl bg-slate-900/90 border border-slate-800 flex flex-col gap-4 shadow-xl">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <h2 className="text-base font-extrabold text-white flex items-center gap-2">
                <Database className="w-5 h-5 text-emerald-400" />
                <span>Supabase PostgreSQL Schema & Realtime Setup</span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Copy and paste this script directly into your Supabase SQL Editor to provision all
                17 tables, RLS policies, atomic functions, and Realtime publications.
              </p>
            </div>

            <button
              type="button"
              onClick={handleCopySql}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs shadow-md transition-all active:scale-95 cursor-pointer"
            >
              {copiedSql ? <Check className="w-4 h-4 stroke-[3]" /> : <Copy className="w-4 h-4" />}
              <span>{copiedSql ? 'Copied to Clipboard!' : 'Copy Supabase SQL'}</span>
            </button>
          </div>

          {/* Connection status banner */}
          <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <span
                className={`w-2.5 h-2.5 rounded-full ${
                  SUPABASE_CONFIG_STATUS.isReady ? 'bg-emerald-400' : 'bg-amber-400'
                }`}
              />
              <span className="font-semibold text-slate-200">
                Supabase Environment Variables:
              </span>
              <span className="text-slate-400">
                {SUPABASE_CONFIG_STATUS.isReady
                  ? 'Connected and operational'
                  : 'VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY can be added in AI Studio Secrets'}
              </span>
            </div>
          </div>

          {/* Code Viewer */}
          <div className="relative rounded-2xl bg-slate-950 border border-slate-800 p-4 max-h-[420px] overflow-y-auto font-mono text-[11px] text-emerald-300/90 leading-relaxed">
            <pre>{SUPABASE_SQL_SCHEMA}</pre>
          </div>
        </div>
      )}
    </div>
  );
};
