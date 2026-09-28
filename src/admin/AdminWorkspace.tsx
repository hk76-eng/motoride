import React, { useState, useEffect } from 'react';
import {
  AdminDashboardStats,
  Captain,
  Passenger,
  MotorideRide,
  FareSettings,
  RideChargeSettings,
  CourierChargeSettings,
  QRCodeSetting,
  AppHyperlinkConfig,
  TopupDepositRequest,
} from '../types/motoride';
import { TopupChatModal } from '../components/common/TopupChatModal';
import { RideChatModal } from '../components/common/RideChatModal';
import { motorideApi } from '../services/motorideApi';
import { SUPABASE_SQL_SCHEMA } from '../lib/sqlSchema';
import { isSupabaseConfigured, getSupabase, SUPABASE_CONFIG_STATUS } from '../lib/supabase';
import { realtimeSync } from '../services/realtimeSync';
import { AuthUser, supabaseAuth, syncAllAccountsToSupabase, isDemoAccount, isDemoRide } from '../lib/supabaseAuth';
import { ensureMediaBucketExists, uploadMediaToSupabase, MOTORIDE_MEDIA_BUCKET, StorageStatus } from '../lib/supabaseStorage';
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
  UploadCloud,
  Download,
  Smartphone,
  Mail,
  Phone,
  MapPin,
  Calendar,
  CreditCard,
  Star,
  Car,
  AlertCircle,
  X,
  ExternalLink,
  ShieldCheck,
  Navigation,
  Trash2,
  AlertTriangle,
  Loader2,
  FileCheck2,
  Upload,
  Package,
  RotateCcw,
  Sparkles,
  Percent,
  Link2,
  Globe,
  MessageSquare,
} from 'lucide-react';

const DEFAULT_RIDE_CHARGES: RideChargeSettings = {
  base_fare: 25.0,
  per_km_rate: 10.0,
  minimum_fare: 30.0,
  platform_commission_pct: 10.0,
  min_offer_pct: 70.0,
  max_offer_pct: 180.0,
  night_surcharge_pct: 10.0,
  auto_multiplier: 1.25,
  car_multiplier: 1.8,
  cancellation_fee: 20.0,
  updated_at: new Date().toISOString(),
};

const DEFAULT_COURIER_CHARGES: CourierChargeSettings = {
  base_fare: 35.0,
  per_km_rate: 12.0,
  minimum_fare: 40.0,
  platform_commission_pct: 12.0,
  min_offer_pct: 70.0,
  max_offer_pct: 180.0,
  handling_fee: 10.0,
  express_surcharge: 15.0,
  max_weight_kg: 15.0,
  cancellation_fee: 25.0,
  updated_at: new Date().toISOString(),
};

const DEFAULT_ADMIN_FARE_SETTINGS: FareSettings = {
  base_fare: 25.0,
  per_km_rate: 10.0,
  minimum_fare: 30.0,
  platform_commission_pct: 10.0,
  min_offer_pct: 70.0,
  max_offer_pct: 180.0,
  currency_symbol: '₹',
  updated_at: new Date().toISOString(),
  ride_charges: { ...DEFAULT_RIDE_CHARGES },
  courier_charges: { ...DEFAULT_COURIER_CHARGES },
};

interface AdminWorkspaceProps {
  currentUser?: AuthUser | null;
  onSignOut?: () => void;
}

export const AdminWorkspace: React.FC<AdminWorkspaceProps> = ({
  currentUser,
  onSignOut,
}) => {
  const [activeTab, setActiveTab] = useState<
    'overview' | 'topup_approvals' | 'rides' | 'captains' | 'passengers' | 'ride_charges' | 'courier_charges' | 'qr' | 'app_link' | 'supabase'
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
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object') {
          return {
            ...DEFAULT_ADMIN_FARE_SETTINGS,
            ...parsed,
            ride_charges: {
              ...DEFAULT_RIDE_CHARGES,
              ...(parsed.ride_charges || {}),
            },
            courier_charges: {
              ...DEFAULT_COURIER_CHARGES,
              ...(parsed.courier_charges || {}),
            },
          };
        }
      }
    } catch {}
    return DEFAULT_ADMIN_FARE_SETTINGS;
  });
  const [testRideKm, setTestRideKm] = useState<number>(5.0);
  const [testCourierKm, setTestCourierKm] = useState<number>(4.0);
  const [rideSaveStatus, setRideSaveStatus] = useState<string | null>(null);
  const [courierSaveStatus, setCourierSaveStatus] = useState<string | null>(null);
  const [qrSettings, setQrSettings] = useState<QRCodeSetting>({
    qr_image_url: '/official_admin_qr.svg',
    upi_id: 'hemant76@idbi',
    merchant_name: 'Hemant',
    note: 'Scan to Pay with any UPI App (Google Pay, PhonePe, Paytm, BHIM) to deposit platform commission or top up balance.',
    is_active: true,
    updated_at: new Date().toISOString(),
  });

  const [copiedSql, setCopiedSql] = useState(false);
  const [qrSaveStatus, setQrSaveStatus] = useState<string | null>(null);
  const [rideFilter, setRideFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isSyncingSupabase, setIsSyncingSupabase] = useState(false);
  const [supabaseSyncMessage, setSupabaseSyncMessage] = useState<string | null>(null);
  const [bucketStatus, setBucketStatus] = useState<StorageStatus | null>(null);
  const [isCheckingBucket, setIsCheckingBucket] = useState(false);
  const [testUploadUrl, setTestUploadUrl] = useState<string | null>(null);

  // Motoride App Hyperlink & Download URL Configuration
  const [appLinkConfig, setAppLinkConfig] = useState<AppHyperlinkConfig>(() => motorideApi.getAppHyperlinkConfig());
  const [appLinkSaveStatus, setAppLinkSaveStatus] = useState<string | null>(null);
  const [isSavingAppLink, setIsSavingAppLink] = useState(false);

  // Top-Up Approvals & Verification Chat State
  const [topupRequests, setTopupRequests] = useState<TopupDepositRequest[]>([]);
  const [activeTopupChatRequest, setActiveTopupChatRequest] = useState<TopupDepositRequest | null>(null);
  const [activeRideChat, setActiveRideChat] = useState<MotorideRide | null>(null);
  const [chatCenterFilter, setChatCenterFilter] = useState<'all' | 'topup' | 'rides'>('all');
  const [topupFilter, setTopupFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [rejectingRequestId, setRejectingRequestId] = useState<string | null>(null);
  const [rejectionReasonInput, setRejectionReasonInput] = useState<string>('');
  const [isApproving, setIsApproving] = useState<string | null>(null);
  const [topupActionToast, setTopupActionToast] = useState<string | null>(null);

  const handleApproveDeposit = async (reqId: string) => {
    setIsApproving(reqId);
    try {
      const res = await motorideApi.approveTopupRequest(reqId);
      if (res && res.request) {
        setTopupActionToast(`✅ Deposit of ₹${res.request.amount} verified and credited to ${res.request.captain_name}'s wallet!`);
        setTimeout(() => setTopupActionToast(null), 4000);
        await loadAllData();
      }
    } catch (err: any) {
      alert(err.message || 'Failed to approve deposit');
    } finally {
      setIsApproving(null);
    }
  };

  const handleRejectDeposit = async () => {
    if (!rejectingRequestId) return;
    try {
      await motorideApi.rejectTopupRequest(rejectingRequestId, rejectionReasonInput || 'Payment verification failed');
      setTopupActionToast(`❌ Deposit request rejected.`);
      setTimeout(() => setTopupActionToast(null), 4000);
      setRejectingRequestId(null);
      setRejectionReasonInput('');
      await loadAllData();
    } catch (err: any) {
      alert(err.message || 'Failed to reject deposit');
    }
  };

  const handleSaveAppLink = async () => {
    setIsSavingAppLink(true);
    setAppLinkSaveStatus(null);
    try {
      await motorideApi.saveAppHyperlinkConfig(appLinkConfig);
      setAppLinkSaveStatus('Motoride App hyperlink updated and broadcasted successfully!');
      showToast('Motoride App link updated across all user apps!');
      setTimeout(() => setAppLinkSaveStatus(null), 5000);
    } catch {
      setAppLinkSaveStatus('Failed to update app hyperlink.');
    } finally {
      setIsSavingAppLink(false);
    }
  };

  const handleCheckBucket = async () => {
    setIsCheckingBucket(true);
    const status = await ensureMediaBucketExists();
    setBucketStatus(status);
    setIsCheckingBucket(false);
  };
  const [selectedCaptain, setSelectedCaptain] = useState<Captain | null>(null);
  const [selectedPassenger, setSelectedPassenger] = useState<Passenger | null>(null);
  const [captainSearch, setCaptainSearch] = useState<string>('');
  const [captainFilter, setCaptainFilter] = useState<'all' | 'online' | 'approved' | 'suspended'>('all');
  const [passengerSearch, setPassengerSearch] = useState<string>('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [purgeConfirmOpen, setPurgeConfirmOpen] = useState(false);
  const [isPurging, setIsPurging] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{
    type: 'captain' | 'passenger' | 'ride' | 'all_rides';
    id: string;
    name: string;
  } | null>(null);
  const [actionToast, setActionToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setActionToast(msg);
    setTimeout(() => setActionToast(null), 4000);
  };

  const handlePurgeAll = async () => {
    setIsPurging(true);
    try {
      await motorideApi.purgeAllData();
      setSelectedCaptain(null);
      setSelectedPassenger(null);
      if (typeof window !== 'undefined') {
        try {
          localStorage.removeItem('motoride_users');
          localStorage.removeItem('motoride_registered_accounts');
          localStorage.removeItem('motoride_auth_session_user');
          localStorage.removeItem('motoride_active_rides_cache');
          localStorage.removeItem('motoride_captain_recent_trips');
          localStorage.removeItem('motoride_supa_profiles');
        } catch {}
      }
      setPurgeConfirmOpen(false);
      showToast('All registered passengers, captains, rides, wallets, and test/mock accounts successfully removed! Clean slate ready.');
      await loadAllData();
    } catch (err: any) {
      alert(err?.message || 'Purge failed');
    } finally {
      setIsPurging(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      if (deleteTarget.type === 'captain') {
        await motorideApi.deleteCaptain(deleteTarget.id);
        if (typeof window !== 'undefined') {
          try {
            const rawAcc = localStorage.getItem('motoride_registered_accounts');
            if (rawAcc) {
              const parsed = JSON.parse(rawAcc);
              const filtered = parsed.filter(
                (a: any) =>
                  a.id !== deleteTarget.id &&
                  a.email !== deleteTarget.id &&
                  a.email !== deleteTarget.name
              );
              localStorage.setItem('motoride_registered_accounts', JSON.stringify(filtered));
            }
            const rawUsers = localStorage.getItem('motoride_users');
            if (rawUsers) {
              const parsedU = JSON.parse(rawUsers);
              const filteredU = parsedU.filter(
                (u: any) =>
                  u.id !== deleteTarget.id &&
                  u.email !== deleteTarget.id &&
                  u.email !== deleteTarget.name
              );
              localStorage.setItem('motoride_users', JSON.stringify(filteredU));
            }
          } catch {}
        }
        if (selectedCaptain && (selectedCaptain.id === deleteTarget.id || selectedCaptain.email === deleteTarget.id)) {
          setSelectedCaptain(null);
        }
        showToast(`Captain "${deleteTarget.name}" permanently removed.`);
      } else if (deleteTarget.type === 'passenger') {
        await motorideApi.deletePassenger(deleteTarget.id);
        if (typeof window !== 'undefined') {
          try {
            const rawAcc = localStorage.getItem('motoride_registered_accounts');
            if (rawAcc) {
              const parsed = JSON.parse(rawAcc);
              const filtered = parsed.filter(
                (a: any) =>
                  a.id !== deleteTarget.id &&
                  a.email !== deleteTarget.id &&
                  a.email !== deleteTarget.name
              );
              localStorage.setItem('motoride_registered_accounts', JSON.stringify(filtered));
            }
            const rawUsers = localStorage.getItem('motoride_users');
            if (rawUsers) {
              const parsedU = JSON.parse(rawUsers);
              const filteredU = parsedU.filter(
                (u: any) =>
                  u.id !== deleteTarget.id &&
                  u.email !== deleteTarget.id &&
                  u.email !== deleteTarget.name
              );
              localStorage.setItem('motoride_users', JSON.stringify(filteredU));
            }
          } catch {}
        }
        if (selectedPassenger && (selectedPassenger.id === deleteTarget.id || selectedPassenger.email === deleteTarget.id)) {
          setSelectedPassenger(null);
        }
        showToast(`Passenger "${deleteTarget.name}" permanently removed.`);
      } else if (deleteTarget.type === 'ride') {
        await motorideApi.deleteRide(deleteTarget.id);
        showToast(`Ride "${deleteTarget.name}" removed from database.`);
      } else if (deleteTarget.type === 'all_rides') {
        await motorideApi.clearAllRides();
        showToast('All ride logs and audits cleared.');
      }
      setDeleteTarget(null);
      await loadAllData();
    } catch (err: any) {
      alert(err?.message || 'Delete operation failed');
    }
  };

  const handleCopyId = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    navigator.clipboard.writeText(id);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  useEffect(() => {
    // Fetch latest fare settings on mount once
    motorideApi.getFareSettings().then((f) => {
      if (f) {
        setFareSettings({
          ...DEFAULT_ADMIN_FARE_SETTINGS,
          ...f,
          ride_charges: {
            ...DEFAULT_RIDE_CHARGES,
            ...(f.ride_charges || {}),
            per_km_rate: f.ride_charges?.per_km_rate ?? f.per_km_rate ?? DEFAULT_RIDE_CHARGES.per_km_rate,
            base_fare: f.ride_charges?.base_fare ?? f.base_fare ?? DEFAULT_RIDE_CHARGES.base_fare,
            minimum_fare: f.ride_charges?.minimum_fare ?? f.minimum_fare ?? DEFAULT_RIDE_CHARGES.minimum_fare,
            platform_commission_pct: f.ride_charges?.platform_commission_pct ?? f.platform_commission_pct ?? DEFAULT_RIDE_CHARGES.platform_commission_pct,
          },
          courier_charges: {
            ...DEFAULT_COURIER_CHARGES,
            ...(f.courier_charges || {}),
          },
        });
      }
    }).catch(() => {});

    const unsubFareUpdated = realtimeSync.on('FARE_SETTINGS_UPDATED', (f: FareSettings) => {
      if (f) {
        setFareSettings({
          ...DEFAULT_ADMIN_FARE_SETTINGS,
          ...f,
          ride_charges: {
            ...DEFAULT_RIDE_CHARGES,
            ...(f.ride_charges || {}),
            per_km_rate: f.ride_charges?.per_km_rate ?? f.per_km_rate ?? DEFAULT_RIDE_CHARGES.per_km_rate,
            base_fare: f.ride_charges?.base_fare ?? f.base_fare ?? DEFAULT_RIDE_CHARGES.base_fare,
            minimum_fare: f.ride_charges?.minimum_fare ?? f.minimum_fare ?? DEFAULT_RIDE_CHARGES.minimum_fare,
            platform_commission_pct: f.ride_charges?.platform_commission_pct ?? f.platform_commission_pct ?? DEFAULT_RIDE_CHARGES.platform_commission_pct,
          },
          courier_charges: {
            ...DEFAULT_COURIER_CHARGES,
            ...(f.courier_charges || {}),
          },
        });
      }
    });

    loadAllData();

    // Listen to real-time events to refresh admin metrics
    const unsub = realtimeSync.on('RIDE_UPDATED', () => loadAllData());
    const unsubCreate = realtimeSync.on('RIDE_CREATED', () => loadAllData());
    const unsubPass = realtimeSync.on('PASSENGERS_UPDATED', () => loadAllData());
    const unsubCapt = realtimeSync.on('CAPTAINS_UPDATED', () => loadAllData());
    const unsubAcc = realtimeSync.on('ACCOUNTS_UPDATED', () => loadAllData());
    const unsubStats = realtimeSync.on('STATS_UPDATED', () => loadAllData());
    const unsubProf = realtimeSync.on('PROFILES_UPDATED', () => loadAllData());
    const unsubTopupCreated = realtimeSync.on('TOPUP_REQUEST_CREATED', (payload: any) => {
      if (payload?.request) {
        setTopupRequests((prev) => {
          if (prev.some((r) => r.id === payload.request.id)) {
            return prev.map((r) => (r.id === payload.request.id ? { ...r, ...payload.request } : r));
          }
          return [payload.request, ...prev];
        });
      }
      loadAllData();
    });
    const unsubTopupUpdated = realtimeSync.on('TOPUP_REQUEST_UPDATED', (payload: any) => {
      if (payload?.request?.id || payload?.id) {
        const id = payload.request?.id || payload.id;
        const status = payload.request?.status || payload.status;
        setTopupRequests((prev) =>
          prev.map((r) => (r.id === id ? { ...r, ...(payload.request || {}), status: status || r.status } : r))
        );
      }
      loadAllData();
    });
    const unsubTopupMsg = realtimeSync.on('TOPUP_CHAT_MESSAGE_RECEIVED', () => loadAllData());

    // 1.5-second fast poll to ensure admin view updates immediately across all screens and devices
    const pollInterval = setInterval(() => {
      loadAllData();
    }, 1500);

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        loadAllData();
      }
    };
    window.addEventListener('focus', handleVisibility);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      unsubFareUpdated();
      unsub();
      unsubCreate();
      unsubPass();
      unsubCapt();
      unsubAcc();
      unsubStats();
      unsubProf();
      unsubTopupCreated();
      unsubTopupUpdated();
      unsubTopupMsg();
      clearInterval(pollInterval);
      window.removeEventListener('focus', handleVisibility);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []);

  const loadAllData = async () => {
    try {
      const [s, c, p, r, q, serverAccounts, topupsList] = await Promise.all([
        motorideApi.getAdminStats().catch((err) => {
          console.warn('AdminStats load failed, using fallback:', err);
          return null;
        }),
        motorideApi.getCaptains().catch((err) => {
          console.warn('Captains load failed, using fallback:', err);
          return [];
        }),
        motorideApi.getPassengers().catch((err) => {
          console.warn('Passengers load failed, using fallback:', err);
          return [];
        }),
        motorideApi.getRides().catch((err) => {
          console.warn('Rides load failed, using fallback:', err);
          return [];
        }),
        motorideApi.getQRSettings().catch((err) => {
          console.warn('QRSettings load failed, using fallback:', err);
          return null;
        }),
        motorideApi.getAccounts().catch((err) => {
          console.warn('Accounts load failed, using fallback:', err);
          return [];
        }),
        motorideApi.getTopupRequests().catch((err) => {
          console.warn('TopupRequests load failed:', err);
          return [];
        }),
      ]);

      if (Array.isArray(topupsList)) {
        setTopupRequests(topupsList);
      }

      let localCaptains: Captain[] = [];
      let localPassengers: Passenger[] = [];

      // Process server accounts
      if (Array.isArray(serverAccounts)) {
        for (const a of serverAccounts) {
          if (isDemoAccount(a)) continue;
          if (a.role === 'captain') {
            localCaptains.push({
              id: a.id,
              profile_id: a.id,
              full_name: a.name,
              email: a.email,
              phone: a.phone || '',
              is_online: true,
              is_approved: true,
              is_active: true,
              current_lat: 30.7046,
              current_lng: 76.7178,
              rating: 4.9,
              total_rides: 0,
              today_earnings: 0,
              total_earnings: 0,
              wallet_balance: a.wallet_balance ?? 500,
              vehicle: {
                id: `veh_${a.id}`,
                captain_id: a.id,
                model: a.vehicle_model || '',
                plate_number: a.plate_number || '',
                vehicle_type: a.vehicle_type || 'bike',
                color: 'Black',
                is_active: true,
              },
              created_at: a.member_since || a.created_at || new Date().toISOString(),
            });
          } else if (a.role === 'passenger') {
            localPassengers.push({
              id: a.id,
              profile_id: a.id,
              full_name: a.name,
              email: a.email,
              phone: a.phone || '',
              total_rides: 0,
              rating: 5.0,
              wallet_balance: a.wallet_balance ?? 200,
              emergency_contact: a.phone || '',
              created_at: a.member_since || a.created_at || new Date().toISOString(),
            });
          }
        }
      }

      // Clean up demo accounts from localStorage so only real accounts persist
      try {
        const rawUsers = localStorage.getItem('motoride_users');
        if (rawUsers) {
          const users = JSON.parse(rawUsers);
          if (Array.isArray(users)) {
            const cleaned = users.filter((u: any) => !isDemoAccount(u));
            if (cleaned.length !== users.length) {
              localStorage.setItem('motoride_users', JSON.stringify(cleaned));
            }
          }
        }
      } catch {}

      // 3. Load profiles and passengers directly from Supabase if configured (real profiles only)
      const supabase = getSupabase();
      if (supabase && isSupabaseConfigured()) {
        try {
          const [profRes, passRes, cptRes, vehRes, walRes] = await Promise.all([
            supabase.from('profiles').select('*'),
            supabase.from('passengers').select('*'),
            supabase.from('captains').select('*'),
            supabase.from('vehicles').select('*'),
            supabase.from('wallets').select('*'),
          ]);
          const supaProfiles = profRes.data || [];
          const supaPassengers = passRes.data || [];
          const supaCaptains = cptRes.data || [];
          const supaVehicles = vehRes.data || [];
          const supaWallets = walRes.data || [];

          for (const sp of supaProfiles) {
            if (isDemoAccount(sp)) continue;
            const matchingWal = supaWallets.find((w: any) => w.user_id === sp.id || w.user_id === sp.profile_id);
            const balance = matchingWal ? matchingWal.balance : undefined;

            if (sp.role === 'captain') {
              const matchingCpt = supaCaptains.find((c: any) => c.profile_id === sp.id || c.id === sp.id);
              const matchingVeh = supaVehicles.find((v: any) => v.captain_id === sp.id || (matchingCpt && v.captain_id === matchingCpt.id));
              if (!c.some(existing => (existing.email && existing.email.toLowerCase() === sp.email?.toLowerCase()) || existing.id === sp.id) &&
                  !localCaptains.some(existing => (existing.email && existing.email.toLowerCase() === sp.email?.toLowerCase()) || existing.id === sp.id)) {
                localCaptains.push({
                  id: sp.id,
                  profile_id: sp.id,
                  full_name: sp.full_name || 'Captain',
                  email: sp.email || '',
                  phone: sp.phone || '',
                  is_online: matchingCpt?.is_online ?? true,
                  is_approved: matchingCpt?.is_approved ?? true,
                  is_active: true,
                  current_lat: matchingCpt?.current_lat ?? 30.7046,
                  current_lng: matchingCpt?.current_lng ?? 76.7178,
                  rating: matchingCpt?.rating ?? 4.9,
                  total_rides: matchingCpt?.total_rides ?? 0,
                  today_earnings: matchingCpt?.today_earnings ?? 0,
                  total_earnings: matchingCpt?.total_earnings ?? 0,
                  wallet_balance: balance ?? sp.wallet_balance ?? 500,
                  vehicle: {
                    id: matchingVeh?.id || `veh_${sp.id}`,
                    captain_id: sp.id,
                    model: matchingVeh?.model || '',
                    plate_number: matchingVeh?.plate_number || '',
                    vehicle_type: matchingVeh?.vehicle_type || 'bike',
                    color: matchingVeh?.color || 'Black',
                    is_active: true,
                  },
                  created_at: sp.created_at || new Date().toISOString(),
                });
              }
            } else if (sp.role !== 'captain' && !sp.vehicle_model && !sp.plate_number) {
              const matchingPsg = supaPassengers.find((p: any) => p.profile_id === sp.id || p.id === sp.id);
              if (!p.some(existing => (existing.email && existing.email.toLowerCase() === sp.email?.toLowerCase()) || existing.id === sp.id) &&
                  !localPassengers.some(existing => (existing.email && existing.email.toLowerCase() === sp.email?.toLowerCase()) || existing.id === sp.id)) {
                localPassengers.push({
                  id: sp.id,
                  profile_id: sp.id,
                  full_name: sp.full_name || sp.name || 'Passenger',
                  email: sp.email || '',
                  phone: sp.phone || '',
                  total_rides: matchingPsg?.total_rides ?? 0,
                  rating: matchingPsg?.rating ?? 5.0,
                  wallet_balance: balance ?? sp.wallet_balance ?? 200,
                  emergency_contact: matchingPsg?.emergency_contact || sp.phone || '',
                  created_at: sp.created_at || new Date().toISOString(),
                });
              }
            }
          }
        } catch (err) {
          console.warn('Could not fetch profiles from Supabase:', err);
        }
      }

      // Filter out any demo data and deduplicate across all sources
      const captainMap = new Map<string, Captain>();
      for (const cpt of [...(c || []), ...localCaptains]) {
        if (!cpt || isDemoAccount(cpt)) continue;
        const key = cpt.id || cpt.email?.toLowerCase() || cpt.phone;
        if (!key) continue;
        const existing = captainMap.get(key) || (cpt.email ? captainMap.get(cpt.email.toLowerCase()) : null);
        if (!existing) {
          captainMap.set(key, cpt);
          if (cpt.id) captainMap.set(cpt.id, cpt);
        } else {
          if (cpt.full_name && (!existing.full_name || existing.full_name === 'Captain')) existing.full_name = cpt.full_name;
          if (cpt.phone && !existing.phone) existing.phone = cpt.phone;
          if (cpt.vehicle?.model && !existing.vehicle?.model) existing.vehicle.model = cpt.vehicle.model;
          if (cpt.vehicle?.plate_number && !existing.vehicle?.plate_number) existing.vehicle.plate_number = cpt.vehicle.plate_number;
        }
      }
      const filteredCaptains = Array.from(new Set(captainMap.values()));

      const passengerMap = new Map<string, Passenger>();
      for (const psg of [...(p || []), ...localPassengers]) {
        if (!psg || isDemoAccount(psg)) continue;
        const key = psg.id || psg.email?.toLowerCase() || psg.phone;
        if (!key) continue;
        const existing = passengerMap.get(key) || (psg.email ? passengerMap.get(psg.email.toLowerCase()) : null);
        if (!existing) {
          passengerMap.set(key, psg);
          if (psg.id) passengerMap.set(psg.id, psg);
        } else {
          if (psg.full_name && (!existing.full_name || existing.full_name === 'Passenger')) existing.full_name = psg.full_name;
          if (psg.phone && !existing.phone) existing.phone = psg.phone;
          if (psg.email && !existing.email) existing.email = psg.email;
        }
      }
      const filteredPassengers = Array.from(new Set(passengerMap.values()));

      const filteredRides = (r || []).filter(ride => !isDemoRide(ride));

      const activeRidesCount = filteredRides.filter(ride => 
        ride.status === 'requested' ||
        ride.status === 'captain_offered' ||
        ride.status === 'captain_accepted' ||
        ride.status === 'captain_arrived' ||
        ride.status === 'trip_started'
      ).length;

      const completedRidesCount = filteredRides.filter(ride => ride.status === 'trip_completed').length;
      const cancelledRidesCount = filteredRides.filter(ride => 
        ride.status === 'cancelled_by_passenger' || ride.status === 'cancelled_by_captain'
      ).length;

      const now = new Date();
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
      let todayRidesCount = 0;
      let todayPlatformRevenue = 0;
      let totalVolume = 0;

      for (const ride of filteredRides) {
        const createdTime = new Date(ride.created_at).getTime();
        if (createdTime >= startOfDay) {
          todayRidesCount++;
        }
        if (ride.status === 'trip_completed') {
          const fare = Number(ride.final_fare || ride.offered_fare || 0);
          totalVolume += fare;
          if (ride.trip_completed_at && new Date(ride.trip_completed_at).getTime() >= startOfDay) {
            const commPct = fareSettings.platform_commission_pct ?? 10;
            todayPlatformRevenue += (fare * commPct) / 100;
          }
        }
      }

      setStats({
        totalCaptains: filteredCaptains.length,
        totalPassengers: filteredPassengers.length,
        onlineCaptains: filteredCaptains.filter(cpt => cpt.is_online).length,
        activeRides: activeRidesCount,
        completedRides: completedRidesCount,
        cancelledRides: cancelledRidesCount,
        todayRides: todayRidesCount,
        todayPlatformRevenue: Number(todayPlatformRevenue.toFixed(2)),
        totalVolume: Number(totalVolume.toFixed(2)),
      });

      setCaptains(filteredCaptains);
      setPassengers(filteredPassengers);
      setRides(filteredRides);

      if (q) setQrSettings(q);
    } catch {}
  };

  const handleSyncAllToSupabase = async () => {
    setIsSyncingSupabase(true);
    setSupabaseSyncMessage(null);
    try {
      const res = await syncAllAccountsToSupabase();
      setSupabaseSyncMessage(
        `✅ Synced ${res.synced} of ${res.total} profiles to Supabase database (profiles, passengers, captains, vehicles, wallets)!`
      );
      await loadAllData();
    } catch (e: any) {
      setSupabaseSyncMessage(`❌ Sync error: ${e?.message || 'Check database connection'}`);
    } finally {
      setIsSyncingSupabase(false);
    }
  };

  const handleSaveRideCharges = async () => {
    try {
      const currentRide: RideChargeSettings = {
        ...DEFAULT_RIDE_CHARGES,
        ...(fareSettings.ride_charges || {}),
      };
      const updatedSettings: FareSettings = {
        ...fareSettings,
        base_fare: currentRide.base_fare ?? fareSettings.base_fare,
        per_km_rate: currentRide.per_km_rate ?? fareSettings.per_km_rate,
        minimum_fare: currentRide.minimum_fare ?? fareSettings.minimum_fare,
        platform_commission_pct: currentRide.platform_commission_pct ?? fareSettings.platform_commission_pct,
        min_offer_pct: currentRide.min_offer_pct ?? fareSettings.min_offer_pct,
        max_offer_pct: currentRide.max_offer_pct ?? fareSettings.max_offer_pct,
        ride_charges: currentRide,
      };
      const res = await motorideApi.updateRideCharges(currentRide);
      if (res) {
        setFareSettings({
          ...DEFAULT_ADMIN_FARE_SETTINGS,
          ...res,
          ride_charges: { ...DEFAULT_RIDE_CHARGES, ...(res.ride_charges || {}) },
          courier_charges: { ...DEFAULT_COURIER_CHARGES, ...(res.courier_charges || {}) },
        });
      }
      setRideSaveStatus('Ride Charges & Per-KM Pricing locked & saved permanently! Applied across all apps.');
      setTimeout(() => setRideSaveStatus(null), 4000);
    } catch (err: any) {
      alert(err?.message || 'Failed to save ride charges');
    }
  };

  const handleResetRideCharges = () => {
    setFareSettings(prev => ({
      ...prev,
      ride_charges: { ...DEFAULT_RIDE_CHARGES },
    }));
    setRideSaveStatus('Reset to standard ride defaults. Click "Save Ride Charges" to lock.');
    setTimeout(() => setRideSaveStatus(null), 4000);
  };

  const handleSaveCourierCharges = async () => {
    try {
      const currentCourier: CourierChargeSettings = {
        ...DEFAULT_COURIER_CHARGES,
        ...(fareSettings.courier_charges || {}),
      };
      const res = await motorideApi.updateCourierCharges(currentCourier);
      if (res) {
        setFareSettings({
          ...DEFAULT_ADMIN_FARE_SETTINGS,
          ...res,
          ride_charges: { ...DEFAULT_RIDE_CHARGES, ...(res.ride_charges || {}) },
          courier_charges: { ...DEFAULT_COURIER_CHARGES, ...(res.courier_charges || {}) },
        });
      }
      setCourierSaveStatus('Courier & Parcel Delivery Pricing locked & saved permanently! Applied across all apps.');
      setTimeout(() => setCourierSaveStatus(null), 4000);
    } catch (err: any) {
      alert(err?.message || 'Failed to save courier charges');
    }
  };

  const handleResetCourierCharges = () => {
    setFareSettings(prev => ({
      ...prev,
      courier_charges: { ...DEFAULT_COURIER_CHARGES },
    }));
    setCourierSaveStatus('Reset to standard courier defaults. Click "Save Courier Charges" to lock.');
    setTimeout(() => setCourierSaveStatus(null), 4000);
  };

  const handleSaveQR = async () => {
    try {
      const payload: Partial<QRCodeSetting> = {
        qr_image_url: qrSettings?.qr_image_url || '',
        upi_id: qrSettings?.upi_id || 'hemant76@idbi',
        merchant_name: qrSettings?.merchant_name || 'Hemant',
        note: qrSettings?.note || 'Scan to Pay with any UPI App',
        is_active: qrSettings?.is_active ?? true,
      };
      const updated = await motorideApi.updateQRSettings(payload);
      if (updated) {
        setQrSettings(updated);
      }
      setQrSaveStatus('QR settings saved permanently!');
      setTimeout(() => setQrSaveStatus(null), 3000);
    } catch (err: any) {
      alert(err.message || 'Failed to save QR settings');
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
    if (isDemoRide(r)) return false;
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

  const filteredCaptains = captains.filter((cpt) => {
    if (isDemoAccount(cpt)) return false;
    if (captainFilter === 'online' && !cpt.is_online) return false;
    if (captainFilter === 'approved' && !cpt.is_approved) return false;
    if (captainFilter === 'suspended' && cpt.is_approved) return false;
    if (captainSearch) {
      const q = captainSearch.toLowerCase();
      return (
        (cpt.full_name && cpt.full_name.toLowerCase().includes(q)) ||
        (cpt.email && cpt.email.toLowerCase().includes(q)) ||
        (cpt.phone && cpt.phone.toLowerCase().includes(q)) ||
        (cpt.vehicle?.model && cpt.vehicle.model.toLowerCase().includes(q)) ||
        (cpt.vehicle?.plate_number && cpt.vehicle.plate_number.toLowerCase().includes(q)) ||
        (cpt.id && cpt.id.toLowerCase().includes(q)) ||
        (cpt.profile_id && cpt.profile_id.toLowerCase().includes(q))
      );
    }
    return true;
  });

  const filteredPassengers = passengers.filter((p) => {
    if (isDemoAccount(p)) return false;
    if (passengerSearch) {
      const q = passengerSearch.toLowerCase();
      return (
        (p.full_name && p.full_name.toLowerCase().includes(q)) ||
        (p.email && p.email.toLowerCase().includes(q)) ||
        (p.phone && p.phone.toLowerCase().includes(q)) ||
        (p.emergency_contact && p.emergency_contact.toLowerCase().includes(q)) ||
        (p.id && p.id.toLowerCase().includes(q)) ||
        (p.profile_id && p.profile_id.toLowerCase().includes(q))
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

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPurgeConfirmOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-950/40 hover:bg-rose-900/60 border border-rose-500/40 text-xs font-bold text-rose-300 hover:text-rose-100 transition-all cursor-pointer shadow-sm"
          >
            <Trash2 className="w-3.5 h-3.5 text-rose-400" />
            <span>Purge All Data (Clean Slate)</span>
          </button>

          <button
            type="button"
            onClick={loadAllData}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs font-semibold text-slate-300 cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5 text-indigo-400" />
            <span>Refresh Data</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
        {[
          { key: 'overview', label: 'Dashboard Overview', icon: Activity },
          { key: 'topup_approvals', label: `Top-Up Approvals (${topupRequests.filter(r => r.status === 'pending').length} Pending)`, icon: CheckCircle2 },
          { key: 'rides', label: `Live Rides (${rides.length})`, icon: Bike },
          { key: 'captains', label: `Captains (${captains.length})`, icon: Users },
          { key: 'passengers', label: `Passengers (${passengers.length})`, icon: Users },
          { key: 'ride_charges', label: 'Ride Charges / KM', icon: Bike },
          { key: 'courier_charges', label: 'Courier Charges / KM', icon: Settings },
          { key: 'qr', label: 'Official QR Code', icon: QrCode },
          { key: 'app_link', label: 'Motoride App Link', icon: Smartphone },
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

          {/* Pending Top-Up Deposit Proofs & Chat Alert */}
          {topupRequests.some((r) => r.status === 'pending') && (
            <div className="p-4 sm:p-5 rounded-3xl bg-amber-950/30 border border-amber-500/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xl animate-in fade-in">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/40 text-amber-400 font-black flex items-center justify-center shrink-0">
                  <ShieldCheck className="w-6 h-6 stroke-[2.5]" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-extrabold text-white">
                      {topupRequests.filter((r) => r.status === 'pending').length} Pending Captain Deposit Proof(s)
                    </h3>
                    <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                  </div>
                  <p className="text-xs text-amber-200/80 mt-0.5">
                    Captains have submitted payment slip screenshots & UTR numbers awaiting your verification and chat response.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 self-stretch sm:self-auto">
                <button
                  type="button"
                  onClick={() => {
                    const firstPending = topupRequests.find((r) => r.status === 'pending');
                    if (firstPending) setActiveTopupChatRequest(firstPending);
                  }}
                  className="flex-1 sm:flex-none px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs transition-all active:scale-95 cursor-pointer shadow-md flex items-center justify-center gap-1.5"
                >
                  <MessageSquare className="w-4 h-4 stroke-[2.5]" />
                  <span>Open Verification Chat</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('topup_approvals')}
                  className="px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white font-bold text-xs transition-all border border-slate-700 cursor-pointer"
                >
                  View All ({topupRequests.length})
                </button>
              </div>
            </div>
          )}

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
                    <th className="py-3 px-3 text-right">ACTION</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {rides.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-500 text-xs">
                        No live or registered rides recorded yet. Real bookings will appear here in real time.
                      </td>
                    </tr>
                  ) : (
                    rides.slice(0, 8).map((r) => (
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
                      <td className="py-3 px-3 text-right">
                        <button
                          type="button"
                          onClick={() => setActiveRideChat(r)}
                          className="px-2.5 py-1 rounded-xl bg-indigo-600/20 hover:bg-indigo-600 text-indigo-300 hover:text-white border border-indigo-500/30 text-[11px] font-bold transition-all cursor-pointer inline-flex items-center gap-1 shadow-sm"
                        >
                          <MessageSquare className="w-3 h-3 text-indigo-300" />
                          <span>Chat</span>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* VIEW 2: CAPTAINS */}
      {activeTab === 'captains' && (
        <div className="flex flex-col gap-4">
          {/* Captains KPI strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3.5 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-sm">
              <span className="text-[10px] font-bold text-slate-400">REGISTERED CAPTAINS</span>
              <div className="mt-1 text-xl font-black text-white font-mono-num">{captains.length}</div>
            </div>
            <div className="p-3.5 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-sm">
              <span className="text-[10px] font-bold text-slate-400">ONLINE ON FLEET</span>
              <div className="mt-1 text-xl font-black text-emerald-400 font-mono-num">
                {captains.filter((c) => c.is_online).length}
              </div>
            </div>
            <div className="p-3.5 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-sm">
              <span className="text-[10px] font-bold text-slate-400">APPROVED DRIVERS</span>
              <div className="mt-1 text-xl font-black text-sky-400 font-mono-num">
                {captains.filter((c) => c.is_approved).length}
              </div>
            </div>
            <div className="p-3.5 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-sm">
              <span className="text-[10px] font-bold text-slate-400">TOTAL FLEET RIDES</span>
              <div className="mt-1 text-xl font-black text-amber-400 font-mono-num">
                {captains.reduce((sum, c) => sum + (c.total_rides || 0), 0)}
              </div>
            </div>
          </div>

          <div className="p-5 rounded-3xl bg-slate-900/90 border border-slate-800 flex flex-col gap-4 shadow-xl">
            {/* Search and Filters */}
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <h2 className="text-sm font-bold text-white flex items-center gap-2">
                  <Users className="w-4 h-4 text-indigo-400" />
                  <span>Captain Profiles & Vehicle Fleet</span>
                </h2>
                <p className="text-xs text-slate-400">
                  Click on any Captain card or "View Full Profile" to inspect complete identity, vehicle, credentials, and ride history
                </p>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
                  {[
                    { key: 'all', label: 'All' },
                    { key: 'online', label: 'Online' },
                    { key: 'approved', label: 'Approved' },
                    { key: 'suspended', label: 'Suspended' },
                  ].map((f) => (
                    <button
                      key={f.key}
                      type="button"
                      onClick={() => setCaptainFilter(f.key as any)}
                      className={`px-2.5 py-1 rounded-lg font-bold text-[11px] cursor-pointer transition-all ${
                        captainFilter === f.key
                          ? 'bg-indigo-600 text-white shadow-sm'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-950 rounded-xl border border-slate-800">
                  <span className="text-[11px] font-bold text-slate-300">Require Approval:</span>
                  <button
                    type="button"
                    onClick={async () => {
                      const updatedVal = !fareSettings.require_admin_approval_for_rides;
                      const nextSettings = {
                        ...fareSettings,
                        require_admin_approval_for_rides: updatedVal,
                      };
                      setFareSettings(nextSettings);
                      try {
                        await motorideApi.updateFareSettings(nextSettings);
                        showToast(
                          updatedVal
                            ? 'Admin approval is now REQUIRED for new captains to receive ride requests.'
                            : 'Admin approval requirement turned OFF. All captains can receive ride requests immediately.'
                        );
                      } catch {}
                    }}
                    className={`w-10 h-5 flex items-center rounded-full p-0.5 transition-colors cursor-pointer ${
                      fareSettings.require_admin_approval_for_rides ? 'bg-indigo-600' : 'bg-slate-700'
                    }`}
                    title="Toggle whether captains require admin approval before receiving rides"
                  >
                    <div
                      className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                        fareSettings.require_admin_approval_for_rides ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    placeholder="Search captain, email, phone, plate, ID..."
                    value={captainSearch}
                    onChange={(e) => setCaptainSearch(e.target.value)}
                    className="pl-8 pr-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 placeholder-slate-500 w-60 sm:w-72"
                  />
                </div>
              </div>
            </div>

            {filteredCaptains.length === 0 ? (
              <div className="p-8 text-center bg-slate-950/60 rounded-2xl border border-slate-800/80 text-slate-400 text-xs">
                No captains matching current search or status filter.
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {filteredCaptains.map((cpt) => (
                  <div
                    key={cpt.id}
                    onClick={() => setSelectedCaptain(cpt)}
                    className="p-4 rounded-2xl bg-slate-950 border border-slate-800/90 hover:border-indigo-500/50 transition-all flex flex-col gap-3 shadow-md cursor-pointer group"
                  >
                    {/* Top Identity Row */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="relative">
                          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500/20 to-indigo-500/20 border border-amber-500/30 text-amber-400 flex items-center justify-center font-bold text-lg shadow-inner">
                            🏍️
                          </div>
                          <span
                            className={`absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-slate-950 ${
                              cpt.is_online ? 'bg-emerald-500 animate-pulse' : 'bg-slate-600'
                            }`}
                          />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-bold text-sm text-white group-hover:text-indigo-300 transition-colors">
                              {cpt.full_name}
                            </h3>
                            <span className="text-[10px] text-amber-400 font-bold flex items-center gap-0.5">
                              ★ {cpt.rating}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-400 flex-wrap">
                            {cpt.email && (
                              <span className="flex items-center gap-1 text-[11px] text-slate-300">
                                <Mail className="w-3 h-3 text-slate-500" />
                                {cpt.email}
                              </span>
                            )}
                            {cpt.phone && (
                              <span className="flex items-center gap-1 text-[11px] text-slate-400">
                                <Phone className="w-3 h-3 text-slate-500" />
                                {cpt.phone}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-1.5">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                            cpt?.is_online
                              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                              : 'bg-slate-800 text-slate-400'
                          }`}
                        >
                          {cpt?.is_online ? '● Online' : '○ Offline'}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                            cpt.is_approved
                              ? 'bg-sky-500/20 text-sky-400 border border-sky-500/30'
                              : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                          }`}
                        >
                          {cpt.is_approved ? 'Approved' : 'Suspended'}
                        </span>
                      </div>
                    </div>

                    {/* Meta ID Row */}
                    <div className="flex items-center justify-between text-[11px] text-slate-500 bg-slate-900/60 px-3 py-1.5 rounded-xl border border-slate-800/60">
                      <div className="flex items-center gap-1.5 font-mono">
                        <span>ID:</span>
                        <span className="text-slate-300 truncate max-w-[170px]">
                          {cpt.id || cpt.profile_id}
                        </span>
                        <button
                          type="button"
                          onClick={(e) => handleCopyId(cpt.id || cpt.profile_id, e)}
                          className="text-slate-400 hover:text-white p-0.5 transition-colors cursor-pointer"
                          title="Copy ID"
                        >
                          {copiedId === (cpt.id || cpt.profile_id) ? (
                            <Check className="w-3 h-3 text-emerald-400" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                        </button>
                      </div>
                      <span className="flex items-center gap-1 text-[10px] text-slate-400">
                        <Calendar className="w-3 h-3 text-slate-500" />
                        {cpt.created_at ? new Date(cpt.created_at).toLocaleDateString() : 'Active'}
                      </span>
                    </div>

                    {/* Vehicle Dossier Box */}
                    <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800/80 text-xs text-slate-300 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400">
                          <Bike className="w-4 h-4" />
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[10px] font-bold uppercase tracking-wider">
                            VEHICLE FLEET
                          </span>
                          <div className="font-bold text-white text-xs">
                            {cpt.vehicle?.model || cpt.vehicle_model || 'Motorcycle'}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-bold uppercase text-[10px]">
                          {cpt.vehicle?.vehicle_type || cpt.vehicle_type || 'BIKE'}
                        </span>
                        <div className="px-2.5 py-1 rounded bg-amber-400/10 border border-amber-500/40 text-amber-300 font-mono font-black text-xs tracking-wider">
                          {cpt.vehicle?.plate_number || cpt.plate_number || 'Not registered'}
                        </div>
                      </div>
                    </div>

                    {/* Financial & Activity Metrics */}
                    <div className="grid grid-cols-4 gap-2 text-center text-xs pt-1">
                      <div className="p-2 rounded-xl bg-slate-900/50 border border-slate-800/50">
                        <span className="text-[10px] text-slate-500 block">Total Rides</span>
                        <span className="font-mono-num font-bold text-white text-xs">
                          {cpt.total_rides || 0}
                        </span>
                      </div>
                      <div className="p-2 rounded-xl bg-slate-900/50 border border-slate-800/50">
                        <span className="text-[10px] text-slate-500 block">Today</span>
                        <span className="font-mono-num font-bold text-amber-400 text-xs">
                          ₹{cpt.today_earnings || 0}
                        </span>
                      </div>
                      <div className="p-2 rounded-xl bg-slate-900/50 border border-slate-800/50">
                        <span className="text-[10px] text-slate-500 block">Total GMV</span>
                        <span className="font-mono-num font-bold text-emerald-400 text-xs">
                          ₹{cpt.total_earnings || 0}
                        </span>
                      </div>
                      <div className="p-2 rounded-xl bg-slate-900/50 border border-slate-800/50">
                        <span className="text-[10px] text-slate-500 block">Wallet</span>
                        <span className="font-mono-num font-bold text-indigo-400 text-xs">
                          ₹{cpt.wallet_balance ?? 500}
                        </span>
                      </div>
                    </div>

                    {/* Card Footer Actions */}
                    <div className="flex items-center justify-between pt-2 border-t border-slate-800/80 gap-2">
                      <div className="text-[11px] text-slate-500 flex items-center gap-1 font-mono">
                        <Navigation className="w-3 h-3 text-emerald-400" />
                        <span>GPS: {cpt.current_lat ? cpt.current_lat.toFixed(3) : '30.704'}, {cpt.current_lng ? cpt.current_lng.toFixed(3) : '76.717'}</span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedCaptain(cpt);
                          }}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-indigo-600/20 hover:bg-indigo-600 text-indigo-300 hover:text-white border border-indigo-500/30 text-xs font-bold transition-all cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>View</span>
                        </button>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleCaptainStatus(cpt.id, cpt.is_approved);
                          }}
                          className={`px-2.5 py-1.5 rounded-xl text-xs font-bold cursor-pointer transition-colors ${
                            cpt.is_approved
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 hover:bg-amber-500/20 hover:text-amber-300'
                              : 'bg-rose-500/20 text-rose-300 border border-rose-500/30 hover:bg-emerald-500/20 hover:text-emerald-300'
                          }`}
                        >
                          {cpt.is_approved ? 'Approved' : 'Suspended'}
                        </button>

                        <button
                          type="button"
                          title="Delete captain from database"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteTarget({
                              type: 'captain',
                              id: cpt.id,
                              name: cpt.full_name || cpt.email || cpt.id,
                            });
                          }}
                          className="p-1.5 rounded-xl bg-rose-950/30 hover:bg-rose-900/60 border border-rose-500/30 text-rose-400 hover:text-rose-200 transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* VIEW 3: PASSENGERS */}
      {activeTab === 'passengers' && (
        <div className="flex flex-col gap-4">
          {/* Passenger KPI strip */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="p-3.5 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-sm">
              <span className="text-[10px] font-bold text-slate-400">TOTAL PASSENGERS</span>
              <div className="mt-1 text-xl font-black text-white font-mono-num">{passengers.length}</div>
            </div>
            <div className="p-3.5 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-sm">
              <span className="text-[10px] font-bold text-slate-400">COMPLETED PASSENGER RIDES</span>
              <div className="mt-1 text-xl font-black text-emerald-400 font-mono-num">
                {passengers.reduce((sum, p) => sum + (p.total_rides || 0), 0)}
              </div>
            </div>
            <div className="p-3.5 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-sm col-span-2 sm:col-span-1">
              <span className="text-[10px] font-bold text-slate-400">AVERAGE PASSENGER RATING</span>
              <div className="mt-1 text-xl font-black text-amber-400 font-mono-num">★ 5.0</div>
            </div>
          </div>

          <div className="p-5 rounded-3xl bg-slate-900/90 border border-slate-800 flex flex-col gap-4 shadow-xl">
            {/* Header & Search */}
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <h2 className="text-sm font-bold text-white flex items-center gap-2">
                  <Users className="w-4 h-4 text-emerald-400" />
                  <span>Registered Passenger Profiles</span>
                </h2>
                <p className="text-xs text-slate-400">
                  Full customer dossiers including verified phone, email, emergency SOS contacts, wallet, and ride statistics
                </p>
              </div>

              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search passenger by name, email, phone, SOS, ID..."
                  value={passengerSearch}
                  onChange={(e) => setPassengerSearch(e.target.value)}
                  className="pl-8 pr-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 placeholder-slate-500 w-64 sm:w-80"
                />
              </div>
            </div>

            {filteredPassengers.length === 0 ? (
              <div className="p-8 text-center bg-slate-950/60 rounded-2xl border border-slate-800/80 text-slate-400 text-xs">
                No passengers matching current search query.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredPassengers.map((p) => (
                  <div
                    key={p.id}
                    onClick={() => setSelectedPassenger(p)}
                    className="p-4 rounded-2xl bg-slate-950 border border-slate-800/90 hover:border-emerald-500/50 transition-all flex flex-col gap-3 shadow-md cursor-pointer group"
                  >
                    {/* Top Identity Row */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border border-emerald-500/30 text-emerald-400 flex items-center justify-center font-black text-sm shadow-inner">
                          {p.full_name
                            ? p.full_name
                                .split(' ')
                                .map((n) => n[0])
                                .slice(0, 2)
                                .join('')
                                .toUpperCase()
                            : 'PS'}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-bold text-sm text-white group-hover:text-emerald-300 transition-colors">
                              {p.full_name}
                            </h3>
                            <span className="text-[10px] text-amber-400 font-bold flex items-center gap-0.5">
                              ★ {p.rating}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-400 flex-wrap">
                            {p.email && (
                              <span className="flex items-center gap-1 text-[11px] text-slate-300">
                                <Mail className="w-3 h-3 text-slate-500" />
                                {p.email}
                              </span>
                            )}
                            {p.phone && (
                              <span className="flex items-center gap-1 text-[11px] text-slate-400">
                                <Phone className="w-3 h-3 text-slate-500" />
                                {p.phone}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <span className="px-2.5 py-1 rounded-xl bg-emerald-500/20 text-emerald-400 text-xs font-bold border border-emerald-500/30">
                        Active
                      </span>
                    </div>

                    {/* Meta ID Row */}
                    <div className="flex items-center justify-between text-[11px] text-slate-500 bg-slate-900/60 px-3 py-1.5 rounded-xl border border-slate-800/60">
                      <div className="flex items-center gap-1.5 font-mono">
                        <span>UUID:</span>
                        <span className="text-slate-300 truncate max-w-[170px]">
                          {p.id || p.profile_id}
                        </span>
                        <button
                          type="button"
                          onClick={(e) => handleCopyId(p.id || p.profile_id, e)}
                          className="text-slate-400 hover:text-white p-0.5 transition-colors cursor-pointer"
                          title="Copy Profile UUID"
                        >
                          {copiedId === (p.id || p.profile_id) ? (
                            <Check className="w-3 h-3 text-emerald-400" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                        </button>
                      </div>
                      <span className="flex items-center gap-1 text-[10px] text-slate-400">
                        <Calendar className="w-3 h-3 text-slate-500" />
                        {p.created_at ? new Date(p.created_at).toLocaleDateString() : 'Verified'}
                      </span>
                    </div>

                    {/* Details Box: Emergency & Wallet */}
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800/80 flex flex-col gap-0.5">
                        <span className="text-[10px] text-rose-400 font-bold flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" />
                          EMERGENCY SOS
                        </span>
                        <span className="font-mono text-slate-200 text-[11px] truncate font-semibold">
                          {p.emergency_contact || p.phone || 'Not configured'}
                        </span>
                      </div>

                      <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800/80 flex flex-col gap-0.5">
                        <span className="text-[10px] text-indigo-400 font-bold flex items-center gap-1">
                          <CreditCard className="w-3 h-3" />
                          WALLET BALANCE
                        </span>
                        <span className="font-mono-num font-bold text-white text-[11px]">
                          ₹{p.wallet_balance ?? 200}
                        </span>
                      </div>
                    </div>

                    {/* Card Footer Actions */}
                    <div className="flex items-center justify-between pt-2 border-t border-slate-800/80 gap-2">
                      <span className="text-[11px] text-slate-400 font-medium">
                        Total rides taken: <b className="text-white font-mono-num">{p.total_rides}</b>
                      </span>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSearchQuery(p.full_name);
                            setActiveTab('rides');
                          }}
                          className="px-2.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 text-xs font-semibold cursor-pointer transition-colors"
                        >
                          Rides
                        </button>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedPassenger(p);
                          }}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-emerald-600/20 hover:bg-emerald-600 text-emerald-300 hover:text-white border border-emerald-500/30 text-xs font-bold transition-all cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>View</span>
                        </button>

                        <button
                          type="button"
                          title="Delete passenger from database"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteTarget({
                              type: 'passenger',
                              id: p.id,
                              name: p.full_name || p.email || p.id,
                            });
                          }}
                          className="p-1.5 rounded-xl bg-rose-950/30 hover:bg-rose-900/60 border border-rose-500/30 text-rose-400 hover:text-rose-200 transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* VIEW 4: ALL RIDES */}
      {activeTab === 'rides' && (
        <div className="p-5 rounded-3xl bg-slate-900/90 border border-slate-800 flex flex-col gap-4 shadow-xl">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-3">
              <h2 className="text-sm font-bold text-white">Full Ride Audits & Live Stream</h2>
              {rides.length > 0 && (
                <button
                  type="button"
                  onClick={() =>
                    setDeleteTarget({
                      type: 'all_rides',
                      id: 'all',
                      name: 'All Rides',
                    })
                  }
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-950/40 hover:bg-rose-900/60 border border-rose-500/30 text-[11px] font-bold text-rose-300 hover:text-rose-100 transition-colors cursor-pointer"
                >
                  <Trash2 className="w-3 h-3 text-rose-400" />
                  <span>Clear All Rides</span>
                </button>
              )}
            </div>

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
            {filteredRides.length === 0 ? (
              <div className="p-10 text-center bg-slate-950/60 rounded-2xl border border-slate-800/80 text-slate-400 text-xs">
                No rides found matching current filter or search criteria.
              </div>
            ) : (
              filteredRides.map((r) => (
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
                    <div className="flex items-center gap-2">
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

                      <button
                        type="button"
                        onClick={() => setActiveRideChat(r)}
                        className="px-2.5 py-1 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-bold transition-all active:scale-95 cursor-pointer flex items-center gap-1.5 shadow-sm"
                      >
                        <MessageSquare className="w-3 h-3 text-indigo-200 stroke-[2.5]" />
                        <span>Live Chat</span>
                      </button>

                      <button
                        type="button"
                        title="Delete ride record"
                        onClick={() =>
                          setDeleteTarget({
                            type: 'ride',
                            id: r.id,
                            name: r.ride_code || r.id,
                          })
                        }
                        className="p-1 rounded-lg bg-rose-950/30 hover:bg-rose-900/60 text-rose-400 hover:text-rose-200 border border-rose-500/30 transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
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
              ))
            )}
          </div>
        </div>
      )}

      {/* VIEW: RIDE CHARGES (PER KM) */}
      {activeTab === 'ride_charges' && (
        <div className="p-5 rounded-3xl bg-slate-900/90 border border-slate-800 flex flex-col gap-4 shadow-xl max-w-2xl">
          <div>
            <h2 className="text-base font-extrabold text-white">Ride Charges & Per-KM Pricing</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Set passenger ride base unlock fare, per-KM rate, minimum fare floor, and commission specifically for taxi rides.
            </p>
          </div>

          {rideSaveStatus && (
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold">
              {rideSaveStatus}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-400 block mb-1">
                Ride Per-KM Rate (₹ / km)
              </label>
              <input
                type="number"
                placeholder="Set Ride Per-KM Rate (₹/km)"
                value={fareSettings.ride_charges?.per_km_rate ?? fareSettings.per_km_rate ?? ''}
                onChange={(e) => {
                  const val = e.target.value === '' ? (undefined as any) : Number(e.target.value);
                  setFareSettings({
                    ...fareSettings,
                    per_km_rate: val,
                    ride_charges: {
                      ...(fareSettings.ride_charges || {}),
                      per_km_rate: val,
                    },
                  });
                }}
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-sm font-mono-num text-white font-bold"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-400 block mb-1">
                Ride Platform Commission (%)
              </label>
              <input
                type="number"
                placeholder="Set Commission %"
                value={fareSettings.ride_charges?.platform_commission_pct ?? fareSettings.platform_commission_pct ?? ''}
                onChange={(e) => {
                  const val = e.target.value === '' ? (undefined as any) : Number(e.target.value);
                  setFareSettings({
                    ...fareSettings,
                    platform_commission_pct: val,
                    ride_charges: {
                      ...(fareSettings.ride_charges || {}),
                      platform_commission_pct: val,
                    },
                  });
                }}
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-sm font-mono-num text-emerald-400 font-bold"
              />
            </div>
          </div>

          <div className="flex items-center gap-3 mt-2">
            <button
              type="button"
              onClick={handleSaveRideCharges}
              className="flex-1 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-lg transition-all active:scale-98 cursor-pointer flex items-center justify-center gap-2"
            >
              <Save className="w-4 h-4" />
              <span>Save Ride Charges</span>
            </button>
            <button
              type="button"
              onClick={handleResetRideCharges}
              className="px-4 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition-all cursor-pointer"
            >
              Reset Defaults
            </button>
          </div>
        </div>
      )}

      {/* VIEW: COURIER CHARGES (PER KM) */}
      {activeTab === 'courier_charges' && (
        <div className="p-5 rounded-3xl bg-slate-900/90 border border-slate-800 flex flex-col gap-4 shadow-xl max-w-2xl">
          <div>
            <h2 className="text-base font-extrabold text-white">Courier & Parcel Delivery Per-KM Pricing</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Set parcel delivery base fare, per-KM delivery rate, minimum delivery floor, handling fee, and express surcharge.
            </p>
          </div>

          {courierSaveStatus && (
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold">
              {courierSaveStatus}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-400 block mb-1">
                Courier Per-KM Rate (₹ / km)
              </label>
              <input
                type="number"
                placeholder="Set Courier Per-KM Rate (₹/km)"
                value={fareSettings.courier_charges?.per_km_rate ?? ''}
                onChange={(e) =>
                  setFareSettings({
                    ...fareSettings,
                    courier_charges: {
                      ...(fareSettings.courier_charges || {}),
                      per_km_rate: e.target.value === '' ? (undefined as any) : Number(e.target.value),
                    },
                  })
                }
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-sm font-mono-num text-white font-bold"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-400 block mb-1">
                Courier Platform Commission (%)
              </label>
              <input
                type="number"
                placeholder="Set Commission %"
                value={fareSettings.courier_charges?.platform_commission_pct ?? ''}
                onChange={(e) =>
                  setFareSettings({
                    ...fareSettings,
                    courier_charges: {
                      ...(fareSettings.courier_charges || {}),
                      platform_commission_pct: e.target.value === '' ? (undefined as any) : Number(e.target.value),
                    },
                  })
                }
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-sm font-mono-num text-emerald-400 font-bold"
              />
            </div>
          </div>

          <div className="flex items-center gap-3 mt-2">
            <button
              type="button"
              onClick={handleSaveCourierCharges}
              className="flex-1 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-lg transition-all active:scale-98 cursor-pointer flex items-center justify-center gap-2"
            >
              <Save className="w-4 h-4" />
              <span>Save Courier Charges</span>
            </button>
            <button
              type="button"
              onClick={handleResetCourierCharges}
              className="px-4 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition-all cursor-pointer"
            >
              Reset Defaults
            </button>
          </div>
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
              <div className="w-48 h-48 p-2 bg-white rounded-2xl shadow-xl flex items-center justify-center overflow-hidden">
                {qrSettings.qr_image_url ? (
                  <img
                    src={qrSettings.qr_image_url}
                    alt="QR Preview"
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <span className="text-xs text-slate-400 font-bold">No QR Uploaded</span>
                )}
              </div>

            {/* QR Scanner / Image Upload Option */}
              <div className="w-full pt-2 border-t border-slate-800">
                <label className="w-full py-2.5 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-bold text-white cursor-pointer transition-all flex items-center justify-center gap-2 shadow-md">
                  <UploadCloud className="w-4 h-4 text-emerald-400" />
                  <span>{qrSettings?.qr_image_url ? 'Replace QR Code' : 'Upload New QR Code'}</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const reader = new FileReader();
                      reader.onload = async (uploadEvent) => {
                        const result = uploadEvent.target?.result as string;
                        if (result) {
                          setQrSettings(prev => ({ ...prev, qr_image_url: result }));
                          try {
                            const updated = await motorideApi.updateQRSettings({ qr_image_url: result });
                            if (updated) {
                              setQrSettings(updated);
                            }
                            setQrSaveStatus('Official QR code uploaded & saved successfully!');
                            setTimeout(() => setQrSaveStatus(null), 3500);
                          } catch (err: any) {
                            console.warn('Auto-save uploaded QR warning:', err);
                          }
                        }
                      };
                      reader.readAsDataURL(file);
                    }}
                  />
                </label>
                {qrSettings?.qr_image_url && (
                    <button
                        type="button"
                        onClick={async () => {
                            setQrSettings(prev => ({ ...prev, qr_image_url: '' }));
                            try {
                              const updated = await motorideApi.updateQRSettings({ qr_image_url: '' });
                              if (updated) {
                                setQrSettings(updated);
                              }
                              setQrSaveStatus('QR code removed & saved successfully.');
                              setTimeout(() => setQrSaveStatus(null), 3500);
                            } catch (err: any) {
                              console.warn('Auto-save remove QR warning:', err);
                            }
                        }}
                        className="w-full mt-2 py-2.5 px-3 rounded-xl bg-red-900/20 hover:bg-red-900/40 border border-red-900/50 text-xs font-bold text-red-400 cursor-pointer transition-all flex items-center justify-center gap-2 shadow-md"
                    >
                        Remove QR Code
                    </button>
                )}
              </div>
            </div>

            {/* Edit Fields */}
            <div className="flex flex-col gap-4">
              <div>
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
                  UPI ID (VPA)
                </label>
                <input
                  type="text"
                  value={qrSettings.upi_id || ''}
                  onChange={(e) => setQrSettings(prev => ({ ...prev, upi_id: e.target.value }))}
                  placeholder="e.g. hemant76@idbi"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white font-mono focus:outline-none focus:border-emerald-500 transition-colors"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
                  Beneficiary / Merchant Name
                </label>
                <input
                  type="text"
                  value={qrSettings.merchant_name || ''}
                  onChange={(e) => setQrSettings(prev => ({ ...prev, merchant_name: e.target.value }))}
                  placeholder="e.g. Hemant"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500 transition-colors"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
                  Payment Instruction / Note
                </label>
                <textarea
                  value={qrSettings.note || ''}
                  onChange={(e) => setQrSettings(prev => ({ ...prev, note: e.target.value }))}
                  placeholder="Scan to Pay with any UPI App"
                  rows={2}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500 transition-colors resize-none"
                />
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={async () => {
                    const officialDefaults = {
                      qr_image_url: '/official_admin_qr.svg',
                      upi_id: 'hemant76@idbi',
                      merchant_name: 'Hemant',
                      note: 'Scan to Pay with any UPI App',
                      is_active: true,
                    };
                    setQrSettings(prev => ({ ...prev, ...officialDefaults }));
                    try {
                      const updated = await motorideApi.updateQRSettings(officialDefaults);
                      if (updated) setQrSettings(updated);
                      setQrSaveStatus('Reset & locked to Official Hemant UPI QR code!');
                      setTimeout(() => setQrSaveStatus(null), 3500);
                    } catch (err: any) {
                      console.warn('Reset official QR warning:', err);
                    }
                  }}
                  className="px-3 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition-all cursor-pointer"
                >
                  Set Official QR
                </button>
                <button
                  type="button"
                  onClick={handleSaveQR}
                  className="flex-1 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-lg transition-all cursor-pointer"
                >
                  Save QR Settings Permanently
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* VIEW: TOP-UP APPROVALS & PAYMENT VERIFICATION CHAT */}
      {activeTab === 'topup_approvals' && (
        <div className="p-5 sm:p-6 rounded-3xl bg-slate-900/90 border border-slate-800 flex flex-col gap-6 shadow-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-extrabold text-white flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  <span>Captain Top-Up Approvals & Payment Proof Verification</span>
                </h2>
                <span className="px-2.5 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-bold">
                  {topupRequests.filter(r => r.status === 'pending').length} Pending
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Verify payment slip screenshots submitted by Captains. Approving a request instantly credits their wallet balance in real time.
              </p>
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-2xl border border-slate-800">
              {(['all', 'pending', 'approved', 'rejected'] as const).map((st) => (
                <button
                  type="button"
                  key={st}
                  onClick={() => setTopupFilter(st)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold capitalize transition-all cursor-pointer ${
                    topupFilter === st
                      ? 'bg-indigo-600 text-white shadow-md'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {st === 'pending' ? 'Pending Verification' : st}
                </button>
              ))}
            </div>
          </div>

          {topupActionToast && (
            <div className="p-3.5 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-bold shadow-lg animate-in fade-in">
              {topupActionToast}
            </div>
          )}

          {/* Deposit Requests Grid / List */}
          {topupRequests.filter(r => topupFilter === 'all' || r.status === topupFilter).length === 0 ? (
            <div className="p-10 rounded-3xl bg-slate-950 border border-slate-800 text-center flex flex-col items-center justify-center gap-3">
              <div className="w-14 h-14 rounded-2xl bg-slate-900 border border-slate-800 text-slate-400 flex items-center justify-center">
                <CheckCircle2 className="w-7 h-7 text-slate-500" />
              </div>
              <h3 className="text-base font-bold text-white">No {topupFilter !== 'all' ? topupFilter : ''} Top-Up Requests</h3>
              <p className="text-xs text-slate-400 max-w-md">
                When captains scan your QR code and submit their deposit amount along with payment screenshots or UTR numbers, their verification chat sessions will appear here in real time.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {topupRequests
                .filter(r => topupFilter === 'all' || r.status === topupFilter)
                .map((req, idx) => (
                  <div
                    key={`${req.id || 'req'}_${idx}_${req.created_at || ''}`}
                    className="p-5 rounded-3xl bg-slate-950 border border-slate-800 flex flex-col gap-4 hover:border-slate-700 transition-all shadow-lg"
                  >
                    {/* Top Bar: Captain Info & Status */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/40 text-amber-400 font-bold flex items-center justify-center shrink-0 shadow-md">
                          {req.captain_avatar ? (
                            <img src={req.captain_avatar} alt={req.captain_name} className="w-full h-full object-cover rounded-2xl" />
                          ) : (
                            req.captain_name[0]?.toUpperCase() || 'C'
                          )}
                        </div>
                        <div className="min-w-0">
                          <span className="text-sm font-extrabold text-white truncate block">
                            {req.captain_name}
                          </span>
                          <span className="text-xs font-mono text-slate-400 block">
                            {req.captain_phone || 'Captain Partner'}
                          </span>
                          <span className="text-[10px] text-slate-500 font-mono block">
                            Submitted {new Date(req.created_at).toLocaleString()}
                          </span>
                        </div>
                      </div>

                      <span className={`px-2.5 py-1 rounded-full text-xs font-black border shrink-0 ${
                        req.status === 'approved'
                          ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                          : req.status === 'rejected'
                          ? 'bg-rose-500/15 text-rose-400 border-rose-500/30'
                          : 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                      }`}>
                        {req.status === 'approved'
                          ? '✅ Approved'
                          : req.status === 'rejected'
                          ? '❌ Rejected'
                          : '⏳ Pending Approval'}
                      </span>
                    </div>

                    {/* Payment Details & Slip Screenshot */}
                    <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-between gap-3">
                      <div className="flex flex-col gap-1">
                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">REQUESTED DEPOSIT AMOUNT</span>
                        <span className="text-2xl font-black text-emerald-400 font-mono-num">
                          ₹{req.amount.toFixed(2)}
                        </span>
                        {req.utr_number && (
                          <span className="text-xs font-mono text-amber-300 font-bold">
                            UTR: {req.utr_number}
                          </span>
                        )}
                      </div>

                      {req.payment_slip_url && (
                        <div className="flex flex-col items-center gap-1 shrink-0">
                          <img
                            src={req.payment_slip_url}
                            alt="Payment Slip Proof"
                            onClick={() => setActiveTopupChatRequest(req)}
                            className="w-16 h-16 object-cover rounded-xl border border-amber-500/40 cursor-pointer hover:scale-105 transition-transform shadow-md"
                          />
                          <span className="text-[9px] text-amber-400 font-bold">Click to view</span>
                        </div>
                      )}
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-2 pt-1">
                      {req.status === 'pending' && (
                        <>
                          <button
                            type="button"
                            onClick={() => handleApproveDeposit(req.id)}
                            disabled={isApproving === req.id}
                            className="flex-1 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-extrabold shadow-lg transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
                          >
                            <CheckCircle2 className="w-4 h-4 stroke-[2.5]" />
                            <span>{isApproving === req.id ? 'Crediting...' : 'Approve & Credit Wallet'}</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setRejectingRequestId(req.id)}
                            className="px-3 py-2.5 rounded-xl bg-rose-950/40 hover:bg-rose-900/60 border border-rose-500/40 text-rose-300 text-xs font-bold transition-all cursor-pointer"
                          >
                            Reject
                          </button>
                        </>
                      )}

                      <button
                        type="button"
                        onClick={() => setActiveTopupChatRequest(req)}
                        className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-1.5 border border-slate-700 shadow-sm"
                      >
                        <MessageSquare className="w-4 h-4 text-amber-400 stroke-[2.5]" />
                        <span>Verification Chat</span>
                      </button>
                    </div>
                  </div>
                ))}
            </div>
          )}

          {/* Rejection Modal Dialog */}
          {rejectingRequestId && (
            <div className="fixed inset-0 z-[2100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="w-full max-w-md p-6 rounded-3xl bg-slate-900 border border-slate-800 flex flex-col gap-4 shadow-2xl">
                <h3 className="text-base font-extrabold text-white">Reject Top-Up Deposit Request</h3>
                <p className="text-xs text-slate-400">
                  Please specify the rejection reason so the Captain is notified in chat.
                </p>
                <input
                  type="text"
                  value={rejectionReasonInput}
                  onChange={(e) => setRejectionReasonInput(e.target.value)}
                  placeholder="e.g. UTR number mismatch or blurry payment receipt"
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs font-bold text-white focus:outline-none focus:border-rose-500"
                />
                <div className="flex items-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={handleRejectDeposit}
                    className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold cursor-pointer"
                  >
                    Confirm Rejection
                  </button>
                  <button
                    type="button"
                    onClick={() => setRejectingRequestId(null)}
                    className="px-4 py-2.5 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* VIEW: MOTORIDE APP HYPERLINK & DOWNLOAD MANAGER */}
      {activeTab === 'app_link' && (
        <div className="flex flex-col gap-5">
          <div className="p-5 rounded-3xl bg-slate-900/90 border border-slate-800 flex flex-col gap-4 shadow-xl">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <h2 className="text-base font-extrabold text-white flex items-center gap-2">
                  <Smartphone className="w-5 h-5 text-indigo-400" />
                  <span>Motoride App Hyperlink & Download URL Manager</span>
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Update and customize the official Motoride Android APK / Web2Apk hyperlink. Any changes immediately update the download button across the Auth screen and user portals.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <a
                  href={appLinkConfig.url || 'https://web2apkpro.com/download/E95FB02/Motoride'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-all border border-slate-700 cursor-pointer shadow-sm"
                  title="Test current hyperlink in new window"
                >
                  <ExternalLink className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Test Link</span>
                </a>
              </div>
            </div>

            {appLinkSaveStatus && (
              <div className="p-3 rounded-2xl bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 text-xs font-bold flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>{appLinkSaveStatus}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setAppLinkSaveStatus(null)}
                  className="text-emerald-400 hover:text-white text-xs font-bold cursor-pointer"
                >
                  Dismiss
                </button>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              {/* Left 2 Cols: Form Config */}
              <div className="lg:col-span-2 flex flex-col gap-4">
                {/* Hyperlink URL Input */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                      <Link2 className="w-3.5 h-3.5 text-indigo-400" />
                      <span>Motoride App Download / Web Hyperlink URL *</span>
                    </label>
                    <span className="text-[10px] text-slate-500 font-mono">Must start with https:// or http://</span>
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="url"
                      value={appLinkConfig.url}
                      onChange={(e) =>
                        setAppLinkConfig({ ...appLinkConfig, url: e.target.value })
                      }
                      placeholder="https://web2apkpro.com/download/E95FB02/Motoride"
                      className="flex-1 px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 focus:border-indigo-500 text-xs text-white font-mono placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-500 shadow-inner"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (appLinkConfig.url) {
                          window.open(appLinkConfig.url, '_blank', 'noopener,noreferrer');
                        }
                      }}
                      className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-bold text-indigo-300 hover:text-white flex items-center gap-1 cursor-pointer shrink-0"
                      title="Test URL in new window"
                    >
                      <Globe className="w-3.5 h-3.5" />
                      <span>Test</span>
                    </button>
                  </div>
                </div>

                {/* Quick Presets */}
                <div className="p-3 rounded-2xl bg-slate-950/60 border border-slate-800/80 flex flex-col gap-2">
                  <span className="text-[11px] font-black text-slate-400 uppercase tracking-wider">
                    Quick Preset Links:
                  </span>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setAppLinkConfig({
                          ...appLinkConfig,
                          url: 'https://web2apkpro.com/download/E95FB02/Motoride',
                          title: 'Motoride App',
                          version: 'v2.4.2',
                        })
                      }
                      className="px-2.5 py-1 rounded-lg bg-indigo-950/50 hover:bg-indigo-900/60 border border-indigo-500/30 text-indigo-300 text-xs font-semibold cursor-pointer transition-all"
                    >
                      Web2Apk Pro (Current)
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setAppLinkConfig({
                          ...appLinkConfig,
                          url: 'https://play.google.com/store/apps/details?id=com.motoride.app',
                          title: 'Google Play Store',
                          version: 'v2.4.2 Production',
                        })
                      }
                      className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 text-xs font-semibold cursor-pointer transition-all"
                    >
                      Google Play Store Link
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setAppLinkConfig({
                          ...appLinkConfig,
                          url: '/api/motoride/download/apk',
                          title: 'Direct APK Download',
                          version: 'v2.4.2 Internal',
                        })
                      }
                      className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 text-xs font-semibold cursor-pointer transition-all"
                    >
                      Self-Hosted Direct APK
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Button Label Text */}
                  <div>
                    <label className="text-xs font-bold text-slate-300 block mb-1.5">
                      Button / Tab Display Label
                    </label>
                    <input
                      type="text"
                      value={appLinkConfig.title}
                      onChange={(e) =>
                        setAppLinkConfig({ ...appLinkConfig, title: e.target.value })
                      }
                      placeholder="Motoride App"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 focus:border-indigo-500 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>

                  {/* Version Tag */}
                  <div>
                    <label className="text-xs font-bold text-slate-300 block mb-1.5">
                      App Version Tag
                    </label>
                    <input
                      type="text"
                      value={appLinkConfig.version || ''}
                      onChange={(e) =>
                        setAppLinkConfig({ ...appLinkConfig, version: e.target.value })
                      }
                      placeholder="v2.4.2"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 focus:border-indigo-500 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                {/* Release Notes */}
                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-1.5">
                    Release Notes / Instructions
                  </label>
                  <textarea
                    rows={3}
                    value={appLinkConfig.notes || ''}
                    onChange={(e) =>
                      setAppLinkConfig({ ...appLinkConfig, notes: e.target.value })
                    }
                    placeholder="Official Android APK release with real-time GPS tracking and instant fare matching."
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 focus:border-indigo-500 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                {/* Checkbox: Open In New Tab */}
                <label className="flex items-center gap-2 cursor-pointer select-none text-xs text-slate-300 font-medium">
                  <input
                    type="checkbox"
                    checked={appLinkConfig.openInNewTab !== false}
                    onChange={(e) =>
                      setAppLinkConfig({ ...appLinkConfig, openInNewTab: e.target.checked })
                    }
                    className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-700 bg-slate-950"
                  />
                  <span>Open link in new window / external browser tab (target=&quot;_blank&quot;)</span>
                </label>

                {/* Save Button */}
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={handleSaveAppLink}
                    disabled={isSavingAppLink || !appLinkConfig.url}
                    className="w-full py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs sm:text-sm shadow-xl shadow-indigo-600/25 transition-all active:scale-98 cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {isSavingAppLink ? (
                      <RefreshCw className="w-4 h-4 animate-spin text-white" />
                    ) : (
                      <Save className="w-4 h-4 stroke-[2.5] text-white" />
                    )}
                    <span>{isSavingAppLink ? 'Updating App Link...' : 'Save & Update Motoride App Hyperlink'}</span>
                  </button>
                </div>
              </div>

              {/* Right Col: Live Preview & Status */}
              <div className="flex flex-col gap-4">
                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 flex flex-col gap-3">
                  <span className="text-[11px] font-black text-slate-400 uppercase tracking-wider">
                    Live UI Button Preview:
                  </span>
                  <p className="text-xs text-slate-400">
                    This is how the link tab will render in the top navigation bar of the application:
                  </p>

                  <div className="p-4 rounded-2xl bg-black border border-white/20 flex items-center justify-center">
                    <a
                      href={appLinkConfig.url || '#'}
                      target={appLinkConfig.openInNewTab !== false ? '_blank' : '_self'}
                      rel="noopener noreferrer"
                      className="px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 text-white hover:text-white/80 bg-black border border-white/25 hover:border-white/50 shadow-sm"
                    >
                      <Download className="w-3.5 h-3.5 text-white" />
                      <span>{appLinkConfig.title || 'Motoride App'}</span>
                    </a>
                  </div>

                  <div className="mt-2 pt-3 border-t border-slate-800 text-[11px] text-slate-400 flex flex-col gap-1">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Destination:</span>
                      <span className="text-slate-300 font-mono truncate max-w-[160px]" title={appLinkConfig.url}>
                        {appLinkConfig.url}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Version:</span>
                      <span className="text-indigo-400 font-bold">{appLinkConfig.version || 'v2.4.2'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Status:</span>
                      <span className="text-emerald-400 font-bold flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                        Active & Connected
                      </span>
                    </div>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-indigo-950/30 border border-indigo-500/20 text-xs text-indigo-300 flex flex-col gap-2">
                  <span className="font-bold flex items-center gap-1.5 text-indigo-200">
                    <Smartphone className="w-4 h-4 text-indigo-400" />
                    <span>Cross-Platform Sync</span>
                  </span>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    When you change this link, all browser sessions and newly opened screens update in real-time through the storage broadcast pipeline without requiring a redeploy.
                  </p>
                </div>
              </div>
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

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSyncAllToSupabase}
                disabled={isSyncingSupabase}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs shadow-md transition-all active:scale-95 cursor-pointer disabled:opacity-50"
              >
                {isSyncingSupabase ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <UploadCloud className="w-4 h-4 stroke-[2.5]" />
                )}
                <span>{isSyncingSupabase ? 'Pushing to Supabase...' : 'Push & Sync Profiles to Supabase'}</span>
              </button>

              <button
                type="button"
                onClick={handleCopySql}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs shadow-md transition-all active:scale-95 cursor-pointer"
              >
                {copiedSql ? <Check className="w-4 h-4 stroke-[3]" /> : <Copy className="w-4 h-4" />}
                <span>{copiedSql ? 'Copied to Clipboard!' : 'Copy Supabase SQL'}</span>
              </button>
            </div>
          </div>

          {supabaseSyncMessage && (
            <div className="p-3 rounded-2xl bg-indigo-950/60 border border-indigo-500/40 text-indigo-300 text-xs font-bold flex items-center justify-between">
              <span>{supabaseSyncMessage}</span>
              <button
                type="button"
                onClick={() => setSupabaseSyncMessage(null)}
                className="text-indigo-400 hover:text-white ml-2 text-xs font-bold"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* Connection status banner */}
          <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <span
                className={`w-2.5 h-2.5 rounded-full ${
                  SUPABASE_CONFIG_STATUS.isReady ? 'bg-emerald-400' : 'bg-amber-400'
                }`}
              />
              <span className="font-semibold text-slate-200">
                Supabase Environment:
              </span>
              <span className="text-slate-400">
                {SUPABASE_CONFIG_STATUS.isReady
                  ? 'Connected and operational'
                  : 'VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY can be configured'}
              </span>
            </div>
          </div>

          {/* Storage Bucket Integration Card */}
          <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 flex flex-col gap-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center font-bold">
                  🗄️
                </div>
                <div>
                  <h3 className="text-xs font-black text-white flex items-center gap-2">
                    <span>Supabase Media Storage Bucket</span>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[10px] font-bold">
                      {MOTORIDE_MEDIA_BUCKET}
                    </span>
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Stores passenger/captain profile photos, QR codes, vehicle photos, and app media assets.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleCheckBucket}
                disabled={isCheckingBucket}
                className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-extrabold text-xs transition-all active:scale-95 cursor-pointer flex items-center gap-1.5 shrink-0"
              >
                {isCheckingBucket ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />}
                <span>{isCheckingBucket ? 'Verifying Bucket...' : 'Verify Storage Connection'}</span>
              </button>
            </div>

            {bucketStatus && (
              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-xs flex flex-col gap-1.5">
                <div className="flex items-center gap-2 font-bold text-emerald-400">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{bucketStatus.message}</span>
                </div>
                {bucketStatus.publicUrlSample && (
                  <div className="text-[11px] text-slate-400 flex items-center gap-1.5 overflow-x-auto">
                    <span className="font-semibold text-slate-300 shrink-0">CDN Endpoint:</span>
                    <code className="text-indigo-300 font-mono bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                      {bucketStatus.publicUrlSample}
                    </code>
                  </div>
                )}
              </div>
            )}

            {/* Test Upload Form */}
            <div className="flex items-center justify-between gap-3 pt-1 border-t border-slate-800/60">
              <div className="flex items-center gap-2">
                <label className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs cursor-pointer transition-all active:scale-95 flex items-center gap-1.5">
                  <UploadCloud className="w-3.5 h-3.5" />
                  <span>Test Upload to motoride-media</span>
                  <input
                    type="file"
                    className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const url = await uploadMediaToSupabase(file, file.name, 'general');
                      if (url) {
                        setTestUploadUrl(url);
                        showToast(`Uploaded ${file.name} to 'motoride-media' Supabase bucket!`);
                      } else {
                        showToast(`Uploaded to 'motoride-media' bucket fallback!`);
                      }
                    }}
                  />
                </label>
              </div>

              {testUploadUrl && (
                <a
                  href={testUploadUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-bold text-emerald-400 hover:underline flex items-center gap-1 truncate max-w-xs"
                >
                  <span>View Uploaded File</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 text-xs text-slate-300 flex flex-col gap-1">
            <span className="font-bold text-amber-400">💡 Why might profiles or captains not show up in your Supabase project?</span>
            <p className="text-slate-400 text-[11px] leading-relaxed">
              1. <b>Row Level Security (RLS)</b>: If you enabled RLS without the permissive policies, Supabase rejects client-side inserts. Copy the SQL below and run it in the Supabase SQL Editor to apply the latest tables and RLS permissions.
              <br />
              2. <b>Foreign Key Tables</b>: Motoride stores users in <code className="text-emerald-400">public.profiles</code>, and respective details in <code className="text-emerald-400">public.passengers</code>, <code className="text-emerald-400">public.captains</code>, and <code className="text-emerald-400">public.vehicles</code>.
              <br />
              3. <b>Instant Sync</b>: Click the <b>"Push & Sync Profiles to Supabase"</b> button above at any time to push all accounts directly into all Supabase tables.
            </p>
          </div>

          {/* Code Viewer */}
          <div className="relative rounded-2xl bg-slate-950 border border-slate-800 p-4 max-h-[420px] overflow-y-auto font-mono text-[11px] text-emerald-300/90 leading-relaxed">
            <pre>{SUPABASE_SQL_SCHEMA}</pre>
          </div>
        </div>
      )}

      {/* MODAL 1: CAPTAIN FULL PROFILE MODAL */}
      {selectedCaptain && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 overflow-y-auto"
          onClick={() => setSelectedCaptain(null)}
        >
          <div
            className="w-full max-w-2xl bg-slate-900 border border-slate-700/80 rounded-3xl shadow-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col animate-in fade-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="p-5 bg-slate-950 border-b border-slate-800 flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-500/20 to-indigo-500/20 border border-amber-500/30 text-amber-400 flex items-center justify-center font-bold text-2xl shadow-inner">
                    🏍️
                  </div>
                  <span
                    className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-slate-950 ${
                      selectedCaptain.is_online ? 'bg-emerald-500 animate-pulse' : 'bg-slate-600'
                    }`}
                  />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-black text-lg text-white">{selectedCaptain.full_name}</h3>
                    <span className="text-xs text-amber-400 font-bold flex items-center gap-0.5 bg-amber-400/10 px-2 py-0.5 rounded-full border border-amber-400/20">
                      <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                      {selectedCaptain.rating}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Captain Profile & Driver Dossier
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedCaptain(null)}
                  className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
                  title="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Quick Metrics Bar */}
            <div className="grid grid-cols-5 border-b border-slate-800/80 bg-slate-950/50 text-center text-xs divide-x divide-slate-800/80">
              <div className="p-2.5">
                <span className="text-[10px] text-slate-500 block font-bold">RATING</span>
                <span className="font-bold text-amber-400 text-sm">★ {selectedCaptain.rating}</span>
              </div>
              <div className="p-2.5">
                <span className="text-[10px] text-slate-500 block font-bold">RIDES</span>
                <span className="font-bold text-white text-sm font-mono-num">{selectedCaptain.total_rides || 0}</span>
              </div>
              <div className="p-2.5">
                <span className="text-[10px] text-slate-500 block font-bold">TODAY</span>
                <span className="font-bold text-amber-400 text-sm font-mono-num">₹{selectedCaptain.today_earnings || 0}</span>
              </div>
              <div className="p-2.5">
                <span className="text-[10px] text-slate-500 block font-bold">LIFETIME</span>
                <span className="font-bold text-emerald-400 text-sm font-mono-num">₹{selectedCaptain.total_earnings || 0}</span>
              </div>
              <div className="p-2.5">
                <span className="text-[10px] text-slate-500 block font-bold">WALLET</span>
                <span className="font-bold text-indigo-400 text-sm font-mono-num">₹{selectedCaptain.wallet_balance ?? 500}</span>
              </div>
            </div>

            {/* Scrollable Dossier Body */}
            <div className="p-5 overflow-y-auto flex flex-col gap-5 text-xs">
              {/* Section 1: Personal & Contact */}
              <div className="flex flex-col gap-2.5">
                <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Captain Identity & Contact Dossier</span>
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 bg-slate-950 p-3.5 rounded-2xl border border-slate-800">
                  <div>
                    <span className="text-[10px] text-slate-500 block">Full Legal Name</span>
                    <span className="font-bold text-white text-xs">{selectedCaptain.full_name}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 block">Registered Email</span>
                    {selectedCaptain.email ? (
                      <a
                        href={`mailto:${selectedCaptain.email}`}
                        className="font-bold text-indigo-400 hover:underline flex items-center gap-1"
                      >
                        <Mail className="w-3 h-3" />
                        {selectedCaptain.email}
                      </a>
                    ) : (
                      <span className="text-slate-500 italic">Not provided</span>
                    )}
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 block">Contact Phone</span>
                    {selectedCaptain.phone ? (
                      <a
                        href={`tel:${selectedCaptain.phone}`}
                        className="font-bold text-slate-200 hover:text-white flex items-center gap-1 font-mono"
                      >
                        <Phone className="w-3 h-3 text-slate-400" />
                        {selectedCaptain.phone}
                      </a>
                    ) : (
                      <span className="text-slate-500 italic">Not provided</span>
                    )}
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 block">Driver Profile UUID</span>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="font-mono text-[11px] text-slate-300 truncate max-w-[180px]">
                        {selectedCaptain.id || selectedCaptain.profile_id}
                      </span>
                      <button
                        type="button"
                        onClick={(e) => handleCopyId(selectedCaptain.id || selectedCaptain.profile_id, e)}
                        className="text-slate-400 hover:text-white p-0.5 cursor-pointer"
                        title="Copy UUID"
                      >
                        {copiedId === (selectedCaptain.id || selectedCaptain.profile_id) ? (
                          <Check className="w-3 h-3 text-emerald-400" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                      </button>
                    </div>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 block">Registration Date</span>
                    <span className="font-bold text-slate-300">
                      {selectedCaptain.created_at
                        ? new Date(selectedCaptain.created_at).toLocaleString()
                        : 'Active Registration'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 block">Account Status</span>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          selectedCaptain.is_online
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        {selectedCaptain.is_online ? 'Online' : 'Offline'}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          selectedCaptain.is_approved
                            ? 'bg-sky-500/20 text-sky-400 border border-sky-500/30'
                            : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                        }`}
                      >
                        {selectedCaptain.is_approved ? 'Approved' : 'Suspended'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Section 2: Vehicle & Fleet Specifications */}
              <div className="flex flex-col gap-2.5">
                <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Bike className="w-3.5 h-3.5 text-amber-400" />
                  <span>Vehicle & Fleet Registration Details</span>
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 bg-slate-950 p-3.5 rounded-2xl border border-slate-800">
                  <div>
                    <span className="text-[10px] text-slate-500 block">Vehicle Model</span>
                    <span className="font-bold text-white text-xs">
                      {selectedCaptain.vehicle?.model || selectedCaptain.vehicle_model || 'Motorcycle'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 block">License Plate Number</span>
                    <div className="inline-block mt-0.5 px-2.5 py-0.5 rounded bg-amber-400/10 border border-amber-500/40 text-amber-300 font-mono font-black text-xs tracking-wider">
                      {selectedCaptain.vehicle?.plate_number || selectedCaptain.plate_number || 'Not registered'}
                    </div>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 block">Vehicle Category</span>
                    <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-bold uppercase text-[10px] inline-block mt-0.5">
                      {selectedCaptain.vehicle?.vehicle_type || selectedCaptain.vehicle_type || 'BIKE'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 block">Color</span>
                    <span className="font-bold text-slate-300">
                      {selectedCaptain.vehicle?.color || 'Black'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Section 3: Live Telemetry */}
              <div className="flex flex-col gap-2.5">
                <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Navigation className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Live GPS Telemetry & Hub</span>
                </h4>
                <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <span className="text-[10px] text-slate-500 block">Current GPS Coordinates</span>
                    <span className="font-mono text-xs text-emerald-400 font-bold">
                      {selectedCaptain.current_lat ? selectedCaptain.current_lat.toFixed(5) : '30.70460'}° N,{' '}
                      {selectedCaptain.current_lng ? selectedCaptain.current_lng.toFixed(5) : '76.71780'}° E
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 block">Service Area</span>
                    <span className="font-bold text-slate-300">Tricity Dispatch Zone (Chandigarh)</span>
                  </div>
                </div>
              </div>

              {/* Section 4: Captain Rides History */}
              <div className="flex flex-col gap-2.5">
                <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Recent Trips for {selectedCaptain.full_name}</span>
                </h4>

                {(() => {
                  const captainRides = rides.filter(
                    (r) =>
                      r.captain_id === selectedCaptain.id ||
                      (r.captain_name &&
                        selectedCaptain.full_name &&
                        r.captain_name.toLowerCase() === selectedCaptain.full_name.toLowerCase())
                  );

                  if (captainRides.length === 0) {
                    return (
                      <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-center text-slate-500 text-xs">
                        No trips recorded for this captain yet.
                      </div>
                    );
                  }

                  return (
                    <div className="flex flex-col gap-2">
                      {captainRides.slice(0, 5).map((r) => (
                        <div
                          key={r.id}
                          className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 flex items-center justify-between text-xs"
                        >
                          <div className="flex flex-col gap-0.5">
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-bold text-indigo-400">{r.ride_code}</span>
                              <span className="font-medium text-slate-200">{r.passenger_name}</span>
                            </div>
                            <span className="text-[11px] text-slate-400 truncate max-w-xs">
                              {r.pickup_address} → {r.dropoff_address}
                            </span>
                          </div>
                          <div className="flex flex-col items-end gap-1">
                            <span className="font-mono font-bold text-emerald-400">
                              ₹{r.final_fare || r.offered_fare}
                            </span>
                            <span className="text-[10px] text-slate-400 capitalize">
                              {r.status.replace(/_/g, ' ')}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    handleToggleCaptainStatus(selectedCaptain.id, selectedCaptain.is_approved);
                    setSelectedCaptain({
                      ...selectedCaptain,
                      is_approved: !selectedCaptain.is_approved,
                    });
                  }}
                  className={`px-4 py-2 rounded-xl text-xs font-bold cursor-pointer transition-colors ${
                    selectedCaptain.is_approved
                      ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30 hover:bg-rose-500/30'
                      : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/30'
                  }`}
                >
                  {selectedCaptain.is_approved ? 'Suspend Captain Access' : 'Approve Captain Credentials'}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setDeleteTarget({
                      type: 'captain',
                      id: selectedCaptain.id,
                      name: selectedCaptain.full_name || 'Captain',
                    });
                  }}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-rose-900/30 hover:bg-rose-600 text-rose-300 hover:text-white border border-rose-500/30 text-xs font-bold transition-all cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete Captain</span>
                </button>
              </div>

              <button
                type="button"
                onClick={() => setSelectedCaptain(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-colors cursor-pointer"
              >
                Close Dossier
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: PASSENGER FULL PROFILE MODAL */}
      {selectedPassenger && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 overflow-y-auto"
          onClick={() => setSelectedPassenger(null)}
        >
          <div
            className="w-full max-w-2xl bg-slate-900 border border-slate-700/80 rounded-3xl shadow-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col animate-in fade-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="p-5 bg-slate-950 border-b border-slate-800 flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border border-emerald-500/30 text-emerald-400 flex items-center justify-center font-black text-xl shadow-inner">
                  {selectedPassenger.full_name
                    ? selectedPassenger.full_name
                        .split(' ')
                        .map((n) => n[0])
                        .slice(0, 2)
                        .join('')
                        .toUpperCase()
                    : 'PS'}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-black text-lg text-white">{selectedPassenger.full_name}</h3>
                    <span className="text-xs text-amber-400 font-bold flex items-center gap-0.5 bg-amber-400/10 px-2 py-0.5 rounded-full border border-amber-400/20">
                      <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                      {selectedPassenger.rating}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Verified Passenger Account Dossier
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedPassenger(null)}
                className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
                title="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Quick Metrics Bar */}
            <div className="grid grid-cols-3 border-b border-slate-800/80 bg-slate-950/50 text-center text-xs divide-x divide-slate-800/80">
              <div className="p-3">
                <span className="text-[10px] text-slate-500 block font-bold">RATING</span>
                <span className="font-bold text-amber-400 text-sm">★ {selectedPassenger.rating}</span>
              </div>
              <div className="p-3">
                <span className="text-[10px] text-slate-500 block font-bold">TOTAL RIDES</span>
                <span className="font-bold text-white text-sm font-mono-num">{selectedPassenger.total_rides || 0}</span>
              </div>
              <div className="p-3">
                <span className="text-[10px] text-slate-500 block font-bold">WALLET BALANCE</span>
                <span className="font-bold text-emerald-400 text-sm font-mono-num">₹{selectedPassenger.wallet_balance ?? 200}</span>
              </div>
            </div>

            {/* Scrollable Dossier Body */}
            <div className="p-5 overflow-y-auto flex flex-col gap-5 text-xs">
              {/* Section 1: Passenger Identity */}
              <div className="flex flex-col gap-2.5">
                <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Passenger Identity & Credentials</span>
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 bg-slate-950 p-3.5 rounded-2xl border border-slate-800">
                  <div>
                    <span className="text-[10px] text-slate-500 block">Full Legal Name</span>
                    <span className="font-bold text-white text-xs">{selectedPassenger.full_name}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 block">Registered Email</span>
                    {selectedPassenger.email ? (
                      <a
                        href={`mailto:${selectedPassenger.email}`}
                        className="font-bold text-emerald-400 hover:underline flex items-center gap-1"
                      >
                        <Mail className="w-3 h-3" />
                        {selectedPassenger.email}
                      </a>
                    ) : (
                      <span className="text-slate-500 italic">Not provided</span>
                    )}
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 block">Contact Phone Number</span>
                    {selectedPassenger.phone ? (
                      <a
                        href={`tel:${selectedPassenger.phone}`}
                        className="font-bold text-slate-200 hover:text-white flex items-center gap-1 font-mono"
                      >
                        <Phone className="w-3 h-3 text-slate-400" />
                        {selectedPassenger.phone}
                      </a>
                    ) : (
                      <span className="text-slate-500 italic">Not provided</span>
                    )}
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 block">Profile UUID</span>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="font-mono text-[11px] text-slate-300 truncate max-w-[180px]">
                        {selectedPassenger.id || selectedPassenger.profile_id}
                      </span>
                      <button
                        type="button"
                        onClick={(e) => handleCopyId(selectedPassenger.id || selectedPassenger.profile_id, e)}
                        className="text-slate-400 hover:text-white p-0.5 cursor-pointer"
                        title="Copy UUID"
                      >
                        {copiedId === (selectedPassenger.id || selectedPassenger.profile_id) ? (
                          <Check className="w-3 h-3 text-emerald-400" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                      </button>
                    </div>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 block">Registration Timestamp</span>
                    <span className="font-bold text-slate-300">
                      {selectedPassenger.created_at
                        ? new Date(selectedPassenger.created_at).toLocaleString()
                        : 'Verified Passenger'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 block">Account Status</span>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 inline-block mt-0.5">
                      Active Account
                    </span>
                  </div>
                </div>
              </div>

              {/* Section 2: Safety & Emergency SOS */}
              <div className="flex flex-col gap-2.5">
                <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 text-rose-400" />
                  <span>Safety Protocols & Emergency Contacts</span>
                </h4>
                <div className="p-3.5 rounded-2xl bg-rose-950/20 border border-rose-500/30 flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <span className="text-[10px] text-rose-400 font-bold block">
                      EMERGENCY SOS MOBILE
                    </span>
                    <span className="font-mono text-sm font-bold text-white">
                      {selectedPassenger.emergency_contact || selectedPassenger.phone || '911 / Police SOS'}
                    </span>
                  </div>
                  <span className="text-[11px] text-rose-300 bg-rose-500/10 px-2.5 py-1 rounded-lg border border-rose-500/20">
                    Live dispatch & SMS relay enabled
                  </span>
                </div>
              </div>

              {/* Section 3: Passenger Rides History */}
              <div className="flex flex-col gap-2.5">
                <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Ride History for {selectedPassenger.full_name}</span>
                </h4>

                {(() => {
                  const passengerRides = rides.filter(
                    (r) =>
                      r.passenger_id === selectedPassenger.id ||
                      (r.passenger_name &&
                        selectedPassenger.full_name &&
                        r.passenger_name.toLowerCase() === selectedPassenger.full_name.toLowerCase())
                  );

                  if (passengerRides.length === 0) {
                    return (
                      <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-center text-slate-500 text-xs">
                        No rides booked yet by this passenger.
                      </div>
                    );
                  }

                  return (
                    <div className="flex flex-col gap-2">
                      {passengerRides.slice(0, 5).map((r) => (
                        <div
                          key={r.id}
                          className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 flex items-center justify-between text-xs"
                        >
                          <div className="flex flex-col gap-0.5">
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-bold text-emerald-400">{r.ride_code}</span>
                              <span className="font-medium text-slate-200">
                                Captain: {r.captain_name || 'Unassigned'}
                              </span>
                            </div>
                            <span className="text-[11px] text-slate-400 truncate max-w-xs">
                              {r.pickup_address} → {r.dropoff_address}
                            </span>
                          </div>
                          <div className="flex flex-col items-end gap-1">
                            <span className="font-mono font-bold text-white">
                              ₹{r.final_fare || r.offered_fare}
                            </span>
                            <span className="text-[10px] text-slate-400 capitalize">
                              {r.status.replace(/_/g, ' ')}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery(selectedPassenger.full_name);
                    setActiveTab('rides');
                    setSelectedPassenger(null);
                  }}
                  className="px-4 py-2 rounded-xl bg-emerald-600/20 hover:bg-emerald-600 text-emerald-300 hover:text-white border border-emerald-500/30 text-xs font-bold transition-all cursor-pointer"
                >
                  Filter in Live Rides Monitor
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setDeleteTarget({
                      type: 'passenger',
                      id: selectedPassenger.id || selectedPassenger.profile_id,
                      name: selectedPassenger.full_name || 'Passenger',
                    });
                  }}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-rose-900/30 hover:bg-rose-600 text-rose-300 hover:text-white border border-rose-500/30 text-xs font-bold transition-all cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete Passenger</span>
                </button>
              </div>

              <button
                type="button"
                onClick={() => setSelectedPassenger(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-colors cursor-pointer"
              >
                Close Dossier
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: PURGE ALL DATA CONFIRMATION */}
      {purgeConfirmOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-slate-900 border border-rose-500/50 rounded-3xl max-w-md w-full p-6 shadow-2xl flex flex-col gap-4 text-left">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-rose-500/20 border border-rose-500/40 text-rose-400 flex items-center justify-center">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-white">Purge All Data (Clean Slate)</h3>
                <p className="text-xs text-rose-300">Permanent database wipe for fresh start</p>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-rose-950/30 border border-rose-500/20 text-xs text-slate-300 space-y-2">
              <p className="font-semibold text-rose-200">
                This will immediately remove:
              </p>
              <ul className="list-disc pl-5 space-y-1 text-slate-400">
                <li>All registered passenger accounts and profiles</li>
                <li>All registered captain profiles and vehicle data</li>
                <li>All ride bookings, audit trails, and live records</li>
                <li>All driver wallet balances and mock transactions</li>
                <li>All cached demo/mock test data in local storage</li>
              </ul>
              <p className="text-[11px] text-amber-300/90 font-medium pt-1">
                Your database will be left with 0 entries, allowing only new real passenger and captain registrations.
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                disabled={isPurging}
                onClick={() => setPurgeConfirmOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isPurging}
                onClick={handlePurgeAll}
                className="flex items-center gap-2 px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-extrabold transition-all shadow-lg shadow-rose-600/30 cursor-pointer disabled:opacity-50"
              >
                <Trash2 className="w-4 h-4" />
                <span>{isPurging ? 'Purging Database...' : 'Yes, Purge Everything'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: SINGLE ITEM DELETION CONFIRMATION */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-md w-full p-6 shadow-2xl flex flex-col gap-4 text-left">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-rose-500/20 border border-rose-500/40 text-rose-400 flex items-center justify-center">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-white">
                  Confirm Deletion
                </h3>
                <p className="text-xs text-slate-400 capitalize">
                  Remove {deleteTarget.type.replace('_', ' ')}
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-300">
              Are you sure you want to permanently delete{' '}
              <span className="font-bold text-white">"{deleteTarget.name}"</span> from the database? This action cannot be undone.
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-all shadow-md cursor-pointer"
              >
                Delete Record
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FLOATING ACTION SUCCESS TOAST */}
      {actionToast && (
        <div className="fixed bottom-6 right-6 z-50 animate-in slide-in-from-bottom duration-200">
          <div className="px-4 py-3 rounded-2xl bg-slate-900 border border-emerald-500/50 shadow-2xl text-xs text-emerald-300 font-semibold flex items-center gap-2.5 max-w-md">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{actionToast}</span>
          </div>
        </div>
      )}

      {/* Topup Verification Chat Modal for Admin */}
      {activeTopupChatRequest && (
        <TopupChatModal
          isOpen={!!activeTopupChatRequest}
          onClose={() => setActiveTopupChatRequest(null)}
          depositRequest={activeTopupChatRequest}
          currentUserId="admin"
          currentUserRole="admin"
          currentUserName="Motoride Admin"
          onApprove={handleApproveDeposit}
          onReject={async (id, reason) => {
            await motorideApi.rejectTopupRequest(id, reason);
            await loadAllData();
          }}
          onStatusUpdated={loadAllData}
        />
      )}

      {/* Live Ride Chat Modal for Admin */}
      {activeRideChat && (
        <div className="fixed inset-0 z-[2100] bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200">
          <div className="w-full max-w-2xl h-[85vh] rounded-3xl overflow-hidden shadow-2xl">
            <RideChatModal
              ride={activeRideChat}
              currentUserId="admin"
              currentUserRole="admin"
              currentUserName="Motoride Admin"
              onClose={() => setActiveRideChat(null)}
            />
          </div>
        </div>
      )}
    </div>
  );
};
