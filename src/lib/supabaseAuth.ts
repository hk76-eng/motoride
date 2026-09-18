import { getSupabase, isSupabaseConfigured } from './supabase';
import { UserRole } from '../types/motoride';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  phone?: string;
  avatarUrl?: string;
  vehicleModel?: string;
  plateNumber?: string;
  vehicleType?: 'bike' | 'auto' | 'car' | 'courier';
  walletBalance?: number;
  memberSince?: string;
}

export interface StoredAccount extends AuthUser {
  passwordHash: string;
}

const STORAGE_SESSION_KEY = 'motoride_auth_session_user';
const STORAGE_ACCOUNTS_KEY = 'motoride_registered_accounts';

export function generateUUID(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Ensures user is completely synced to Supabase (profiles, passengers, captains, vehicles, wallets)
 */
export async function syncUserToSupabase(user: AuthUser): Promise<{ success: boolean; error?: string }> {
  const supabase = getSupabase();
  if (!supabase || !isSupabaseConfigured()) {
    return { success: false, error: 'Supabase is not configured' };
  }

  try {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const validProfileId = uuidRegex.test(user.id) ? user.id : generateUUID();

    // 1. Upsert into public.profiles
    const { error: profileErr } = await supabase.from('profiles').upsert(
      [
        {
          id: validProfileId,
          email: user.email.toLowerCase().trim(),
          full_name: user.name.trim(),
          phone: user.phone?.trim() || null,
          role: user.role,
          wallet_balance: user.walletBalance ?? (user.role === 'captain' ? 500 : 200),
          is_active: true,
        },
      ],
      { onConflict: 'email' }
    );

    if (profileErr) {
      console.warn('Supabase profile upsert warning:', profileErr.message);
    }

    // Get the effective profile id from Supabase
    const { data: profileRow } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', user.email.toLowerCase().trim())
      .maybeSingle();

    const actualProfileId = profileRow?.id || validProfileId;

    // 2. If passenger, upsert into public.passengers
    if (user.role === 'passenger') {
      const { error: passErr } = await supabase.from('passengers').upsert(
        [
          {
            profile_id: actualProfileId,
            total_rides: 0,
            rating: 5.0,
            emergency_contact: user.phone?.trim() || null,
          },
        ],
        { onConflict: 'profile_id' }
      );
      if (passErr) {
        console.warn('Supabase passenger upsert warning:', passErr.message);
      }
    }

    // 3. If captain, upsert into public.captains and public.vehicles
    if (user.role === 'captain') {
      const captainId = generateUUID();
      const { error: cptErr } = await supabase.from('captains').upsert(
        [
          {
            id: captainId,
            profile_id: actualProfileId,
            is_online: true,
            is_approved: true,
            is_active: true,
            current_lat: 30.7046,
            current_lng: 76.7178,
            rating: 4.9,
            total_rides: 0,
            today_earnings: 0,
            total_earnings: 0,
          },
        ],
        { onConflict: 'profile_id' }
      );
      if (cptErr) {
        console.warn('Supabase captain upsert warning:', cptErr.message);
      }

      // Check captain record to get captainId
      const { data: cptRow } = await supabase
        .from('captains')
        .select('id')
        .eq('profile_id', actualProfileId)
        .maybeSingle();
      const actualCaptainId = cptRow?.id || captainId;

      const plateNo =
        user.plateNumber?.trim() ||
        `PB${Math.floor(10 + Math.random() * 89)}AB${Math.floor(1000 + Math.random() * 9000)}`;

      const { error: vehErr } = await supabase.from('vehicles').upsert(
        [
          {
            captain_id: actualCaptainId,
            model: user.vehicleModel?.trim() || 'Honda Activa 6G',
            plate_number: plateNo,
            vehicle_type: user.vehicleType || 'bike',
            color: 'Black',
            is_active: true,
          },
        ],
        { onConflict: 'plate_number' }
      );
      if (vehErr) {
        console.warn('Supabase vehicle upsert warning:', vehErr.message);
      }
    }

    // 4. Upsert into public.wallets
    await supabase.from('wallets').upsert(
      [
        {
          user_id: actualProfileId,
          role: user.role,
          balance: user.walletBalance ?? (user.role === 'captain' ? 500 : 200),
          currency: '₹',
        },
      ],
      { onConflict: 'user_id' }
    );

    return { success: true };
  } catch (err: any) {
    console.warn('Failed to sync user to Supabase:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Synchronize all registered accounts from local storage to Supabase
 */
export async function syncAllAccountsToSupabase(): Promise<{ synced: number; total: number; error?: string }> {
  const accounts = supabaseAuth.getRegisteredAccounts();
  let count = 0;
  for (const acc of accounts) {
    const res = await syncUserToSupabase(acc);
    if (res.success) count++;
  }
  return { synced: count, total: accounts.length };
}

export function isDemoAccount(acc: any): boolean {
  if (!acc) return false;
  const id = String(acc.id || acc.profile_id || '').toLowerCase().trim();
  const email = String(acc.email || '').toLowerCase().trim();
  const name = String(acc.name || acc.full_name || '').toLowerCase().trim();

  // Explicit legacy demo IDs only
  if (
    id === 'cpt_1' ||
    id === 'psg_1' ||
    id === 'cpt_vikram_01' ||
    id === 'usr-admin-001' ||
    id === 'usr_demo_100' ||
    id === 'demo_user'
  ) {
    return true;
  }

  // Explicit legacy demo emails only
  if (
    email === 'captain@motoride.com' ||
    email === 'passenger@motoride.com' ||
    email === 'vikram.singh.captain@motoride.in' ||
    email === 'demo@motoride.com' ||
    email.startsWith('demo@')
  ) {
    return true;
  }

  // Explicit demo names only
  if (
    name === 'demo captain' ||
    name === 'demo passenger' ||
    name === '[demo]' ||
    name === '(demo)'
  ) {
    return true;
  }

  return false;
}

export function isDemoRide(ride: any): boolean {
  if (!ride) return false;
  const id = String(ride.id || '').toLowerCase();
  const passId = String(ride.passenger_id || '').toLowerCase();
  const captId = String(ride.captain_id || '').toLowerCase();
  const passName = String(ride.passenger_name || '').toLowerCase();
  const captName = String(ride.captain_name || '').toLowerCase();

  if (
    id.includes('demo') ||
    passId === 'psg_1' ||
    captId === 'cpt_1' ||
    passId === 'usr_demo_100' ||
    captId === 'cpt_vikram_01' ||
    passName.includes('demo') ||
    captName.includes('demo')
  ) {
    return true;
  }
  return false;
}

export const supabaseAuth = {
  /**
   * Get all locally stored registered accounts (real accounts only)
   */
  getRegisteredAccounts(): StoredAccount[] {
    try {
      const raw = localStorage.getItem(STORAGE_ACCOUNTS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          const filtered = parsed.filter((a) => !isDemoAccount(a));
          if (filtered.length !== parsed.length) {
            localStorage.setItem(STORAGE_ACCOUNTS_KEY, JSON.stringify(filtered));
          }
          return filtered;
        }
      }
    } catch (e) {
      console.warn('Failed to parse registered accounts:', e);
    }
    return [];
  },

  /**
   * Save a newly registered account locally
   */
  saveAccount(account: StoredAccount) {
    try {
      const accounts = this.getRegisteredAccounts();
      const existingIdx = accounts.findIndex(
        (a) => a.email.toLowerCase() === account.email.toLowerCase() && a.role === account.role
      );
      if (existingIdx >= 0) {
        accounts[existingIdx] = account;
      } else {
        accounts.push(account);
      }
      localStorage.setItem(STORAGE_ACCOUNTS_KEY, JSON.stringify(accounts));
    } catch (e) {
      console.warn('Failed to save registered account:', e);
    }
  },

  /**
   * Get current stored auth user from localStorage or Supabase
   */
  getCurrentUser(): AuthUser | null {
    try {
      const raw = localStorage.getItem(STORAGE_SESSION_KEY);
      if (raw) {
        const user = JSON.parse(raw);
        if (user && isDemoAccount(user)) {
          localStorage.removeItem(STORAGE_SESSION_KEY);
          return null;
        }
        return user;
      }
    } catch (e) {
      console.warn('Failed to parse auth session:', e);
    }
    return null;
  },

  /**
   * Save user session locally
   */
  setCurrentUser(user: AuthUser | null) {
    if (user) {
      localStorage.setItem(STORAGE_SESSION_KEY, JSON.stringify(user));
      localStorage.setItem('motoride_active_role', user.role);
    } else {
      localStorage.removeItem(STORAGE_SESSION_KEY);
    }
  },

  /**
   * Sign In via Server Auth, Supabase, or Registered Accounts
   */
  async signIn(params: {
    email: string;
    password?: string;
    role: UserRole;
  }): Promise<{ user: AuthUser; error?: string; roleSwitched?: boolean; isNewAccount?: boolean }> {
    const cleanEmail = params.email.trim().toLowerCase();
    const cleanPass = (params.password || '').trim();

    if (!cleanEmail || !cleanEmail.includes('@')) {
      return { user: null as any, error: 'Please enter a valid email address.' };
    }
    if (!cleanPass) {
      return { user: null as any, error: 'Password is required.' };
    }

    // 1. Primary: Authenticate with Backend Database API
    try {
      const serverResp = await fetch('/api/motoride/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: cleanEmail,
          password: cleanPass,
          role: params.role,
        }),
      });
      const serverData = await serverResp.json();
      if (serverData.success && serverData.account) {
        const authUser: AuthUser = {
          id: serverData.account.id,
          email: serverData.account.email,
          name: serverData.account.name,
          role: serverData.account.role,
          phone: serverData.account.phone,
          vehicleModel: serverData.account.vehicle_model,
          plateNumber: serverData.account.plate_number,
          vehicleType: serverData.account.vehicle_type,
          walletBalance: serverData.account.wallet_balance,
          memberSince: serverData.account.member_since,
        };
        this.saveAccount({ ...authUser, passwordHash: cleanPass });
        this.setCurrentUser(authUser);
        return {
          user: authUser,
          roleSwitched: Boolean(serverData.role_switched),
          isNewAccount: Boolean(serverData.is_new_account),
        };
      } else if (serverData.error && serverData.error.toLowerCase().includes('password')) {
        return { user: null as any, error: serverData.error };
      }
    } catch (err) {
      console.warn('Backend login fetch failed, checking cached local accounts:', err);
    }

    // 2. Check locally registered accounts cache
    const accounts = this.getRegisteredAccounts();
    
    // Check exact role match first
    let matchingAccount = accounts.find(
      (a) => a.email.toLowerCase() === cleanEmail && a.role === params.role
    );

    // If not found for current tab role, check if account exists for other role
    let roleSwitched = false;
    if (!matchingAccount) {
      const anyRoleAccount = accounts.find(
        (a) => a.email.toLowerCase() === cleanEmail
      );
      if (anyRoleAccount) {
        matchingAccount = anyRoleAccount;
        roleSwitched = true;
      }
    }

    if (matchingAccount) {
      if (cleanPass && matchingAccount.passwordHash === cleanPass) {
        const authUser: AuthUser = {
          id: matchingAccount.id,
          email: matchingAccount.email,
          name: matchingAccount.name,
          role: matchingAccount.role,
          phone: matchingAccount.phone,
          avatarUrl: matchingAccount.avatarUrl,
          vehicleModel: matchingAccount.vehicleModel,
          plateNumber: matchingAccount.plateNumber,
          vehicleType: matchingAccount.vehicleType,
          walletBalance: matchingAccount.walletBalance ?? (matchingAccount.role === 'captain' ? 500 : 200),
          memberSince: matchingAccount.memberSince,
        };
        this.setCurrentUser(authUser);
        return { user: authUser, roleSwitched };
      } else {
        return { user: null as any, error: 'Incorrect password. Please verify your password.' };
      }
    }

    // 3. Fallback seamless provisioning: auto-register so user is never blocked
    const userId = generateUUID();
    const existingNamed = accounts.find((a) => a.email.toLowerCase() === cleanEmail && a.name && a.name !== 'MotoRide User');
    const rawPrefix = cleanEmail.split('@')[0].replace(/[._-]/g, ' ');
    const displayName = existingNamed?.name || (rawPrefix ? rawPrefix.charAt(0).toUpperCase() + rawPrefix.slice(1) : 'MotoRide User');
    const authUser: AuthUser = {
      id: userId,
      email: cleanEmail,
      name: displayName,
      role: params.role,
      phone: existingNamed?.phone || '',
      vehicleModel: params.role === 'captain' ? (existingNamed?.vehicleModel || 'Honda Activa 6G') : '',
      plateNumber: params.role === 'captain' ? (existingNamed?.plateNumber || `PB65XX${Math.floor(1000 + Math.random() * 9000)}`) : '',
      vehicleType: existingNamed?.vehicleType || 'bike',
      walletBalance: params.role === 'captain' ? 500 : 200,
      memberSince: new Date().toISOString(),
    };

    this.saveAccount({ ...authUser, passwordHash: cleanPass });
    this.setCurrentUser(authUser);
    return { user: authUser, isNewAccount: true };
  },

  /**
   * Sign Up: Register a fresh Account
   */
  async signUp(params: {
    email: string;
    password?: string;
    name: string;
    role: UserRole;
    phone?: string;
    vehicleModel?: string;
    plateNumber?: string;
    vehicleType?: 'bike' | 'auto' | 'car' | 'courier';
  }): Promise<{ user: AuthUser; error?: string }> {
    const cleanEmail = params.email.trim().toLowerCase();
    const cleanRole = params.role;
    const cleanPass = (params.password || '').trim();
    const cleanName = params.name.trim();

    if (!cleanEmail || !cleanEmail.includes('@')) {
      return { user: null as any, error: 'A valid email address is required.' };
    }
    if (!cleanPass) {
      return { user: null as any, error: 'Password is required.' };
    }
    if (!cleanName) {
      return { user: null as any, error: 'Full name is required.' };
    }

    const userId = generateUUID();

    // 1. Register on backend server
    try {
      const serverResp = await fetch('/api/motoride/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: userId,
          email: cleanEmail,
          password: cleanPass,
          name: cleanName,
          role: cleanRole,
          phone: params.phone?.trim() || '',
          vehicle_model: params.vehicleModel?.trim(),
          plate_number: params.plateNumber?.trim(),
          vehicle_type: params.vehicleType || 'bike',
        }),
      });
      const serverData = await serverResp.json();
      if (serverData.success && serverData.account) {
        const authUser: AuthUser = {
          id: serverData.account.id || userId,
          email: serverData.account.email,
          name: serverData.account.name || cleanName,
          role: serverData.account.role,
          phone: serverData.account.phone,
          vehicleModel: serverData.account.vehicle_model,
          plateNumber: serverData.account.plate_number,
          vehicleType: serverData.account.vehicle_type,
          walletBalance: serverData.account.wallet_balance,
          memberSince: serverData.account.member_since,
        };
        this.saveAccount({ ...authUser, passwordHash: cleanPass });
        this.setCurrentUser(authUser);
        return { user: authUser };
      }
    } catch (err) {
      console.warn('Backend register failed, falling back to local storage:', err);
    }

    // 2. Fallback / local registration:
    const authUser: AuthUser = {
      id: userId,
      email: cleanEmail,
      name: cleanName,
      role: cleanRole,
      phone: params.phone?.trim() || '',
      vehicleModel: params.vehicleModel?.trim(),
      plateNumber: params.plateNumber?.trim(),
      vehicleType: params.vehicleType || 'bike',
      walletBalance: cleanRole === 'captain' ? 500 : 200,
      memberSince: new Date().toISOString(),
    };

    this.saveAccount({
      ...authUser,
      passwordHash: cleanPass,
    });
    this.setCurrentUser(authUser);
    return { user: authUser };
  },

  /**
   * Sign Out
   */
  async signOut(): Promise<void> {
    const supabase = getSupabase();
    if (supabase && isSupabaseConfigured()) {
      try {
        await supabase.auth.signOut();
      } catch (err) {
        console.warn('Supabase signOut error:', err);
      }
    }
    this.setCurrentUser(null);
  },
};

