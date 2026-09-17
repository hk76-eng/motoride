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

export const supabaseAuth = {
  /**
   * Get all locally stored registered accounts
   */
  getRegisteredAccounts(): StoredAccount[] {
    try {
      const raw = localStorage.getItem(STORAGE_ACCOUNTS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
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
        // Clean out legacy demo sessions to ensure fresh account usage
        if (
          user &&
          (user.id === 'psg_hemant_01' ||
            user.id === 'cpt_vikram_01' ||
            user.id === 'USR-ADMIN-001' ||
            user.email === 'vikram.singh.captain@motoride.in')
        ) {
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
   * Sign In via Supabase Auth or Registered Accounts
   */
  async signIn(params: {
    email: string;
    password?: string;
    role: UserRole;
  }): Promise<{ user: AuthUser; error?: string }> {
    const supabase = getSupabase();
    const cleanEmail = params.email.trim().toLowerCase();

    // 1. Try real Supabase Auth if configured
    if (supabase && isSupabaseConfigured() && params.password) {
      try {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password: params.password,
        });

        if (error) {
          console.warn('Supabase signin warning:', error.message);
        } else if (data.user) {
          const meta = data.user.user_metadata || {};
          const authUser: AuthUser = {
            id: data.user.id,
            email: data.user.email || cleanEmail,
            name: meta.full_name || meta.name || cleanEmail.split('@')[0],
            role: (meta.role as UserRole) || params.role,
            phone: meta.phone,
            vehicleModel: meta.vehicle_model,
            plateNumber: meta.plate_number,
            vehicleType: meta.vehicle_type || 'bike',
            walletBalance: meta.wallet_balance || (params.role === 'captain' ? 500 : 200),
            memberSince: data.user.created_at,
          };
          this.setCurrentUser(authUser);
          return { user: authUser };
        }
      } catch (err: any) {
        console.warn('Supabase auth signIn error:', err);
      }
    }

    // 2. Check locally registered accounts
    const accounts = this.getRegisteredAccounts();
    const matchingAccount = accounts.find(
      (a) => a.email.toLowerCase() === cleanEmail && a.role === params.role
    );

    if (matchingAccount) {
      if (params.password && matchingAccount.passwordHash === params.password) {
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
        return { user: authUser };
      } else {
        return { user: null as any, error: 'Incorrect password. Please try again.' };
      }
    }

    return {
      user: null as any,
      error: `No ${params.role} account found with email "${cleanEmail}". Please switch to "Create Account" tab to register.`,
    };
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
    const supabase = getSupabase();
    const cleanEmail = params.email.trim().toLowerCase();
    const userId = generateUUID();

    // 1. Check if account already exists locally
    const existingAccounts = this.getRegisteredAccounts();
    const alreadyExists = existingAccounts.some(
      (a) => a.email.toLowerCase() === cleanEmail && a.role === params.role
    );
    if (alreadyExists) {
      return {
        user: null as any,
        error: `An account with this email already exists for ${params.role}. Please sign in.`,
      };
    }

    // 2. Try Supabase Auth registration
    if (supabase && isSupabaseConfigured() && params.password) {
      try {
        const { data, error } = await supabase.auth.signUp({
          email: cleanEmail,
          password: params.password,
          options: {
            data: {
              full_name: params.name.trim(),
              phone: params.phone?.trim(),
              role: params.role,
              vehicle_model: params.vehicleModel?.trim(),
              plate_number: params.plateNumber?.trim(),
              vehicle_type: params.vehicleType || 'bike',
            },
          },
        });

        if (error) {
          console.warn('Supabase signup notice:', error.message);
        } else if (data.user) {
          const authUser: AuthUser = {
            id: data.user.id || userId,
            email: cleanEmail,
            name: params.name.trim(),
            role: params.role,
            phone: params.phone?.trim() || '+91 98765 00000',
            vehicleModel: params.vehicleModel?.trim(),
            plateNumber: params.plateNumber?.trim(),
            vehicleType: params.vehicleType || 'bike',
            walletBalance: params.role === 'captain' ? 500 : 200,
            memberSince: new Date().toISOString(),
          };

          // Full sync to profiles, passengers/captains, vehicles, wallets
          await syncUserToSupabase(authUser);

          this.saveAccount({ ...authUser, passwordHash: params.password || '' });
          this.setCurrentUser(authUser);
          return { user: authUser };
        }
      } catch (err: any) {
        console.warn('Supabase signUp error:', err);
      }
    }

    // 3. Register user locally and sync to Supabase database
    const authUser: AuthUser = {
      id: userId,
      email: cleanEmail,
      name: params.name.trim(),
      role: params.role,
      phone: params.phone?.trim() || '+91 98765 00000',
      vehicleModel: params.vehicleModel?.trim(),
      plateNumber: params.plateNumber?.trim(),
      vehicleType: params.vehicleType || 'bike',
      walletBalance: params.role === 'captain' ? 500 : 200,
      memberSince: new Date().toISOString(),
    };

    // Ensure it's pushed to Supabase tables (profiles, passengers/captains, vehicles, wallets)
    if (supabase && isSupabaseConfigured()) {
      await syncUserToSupabase(authUser);
    }

    this.saveAccount({
      ...authUser,
      passwordHash: params.password || '',
    });

    // Notify backend if available
    try {
      if (params.role === 'captain') {
        fetch('/api/motoride/captains', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: userId,
            full_name: params.name.trim(),
            phone: params.phone?.trim(),
            vehicle_model: params.vehicleModel?.trim(),
            plate_number: params.plateNumber?.trim(),
            vehicle_type: params.vehicleType || 'bike',
          }),
        }).catch(() => {});
      } else if (params.role === 'passenger') {
        fetch('/api/motoride/passengers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: userId,
            full_name: params.name.trim(),
            phone: params.phone?.trim(),
            email: cleanEmail,
          }),
        }).catch(() => {});
      }
    } catch {}

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

