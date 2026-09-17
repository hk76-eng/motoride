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
    const userId = `usr_${params.role}_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`;

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
          console.warn('Supabase signup error:', error.message);
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

          try {
            await supabase.from('profiles').upsert([
              {
                id: authUser.id,
                email: cleanEmail,
                full_name: params.name.trim(),
                phone: params.phone?.trim(),
                role: params.role,
                wallet_balance: authUser.walletBalance,
                is_active: true,
              },
            ]);
          } catch (e) {}

          this.saveAccount({ ...authUser, passwordHash: params.password || '' });
          this.setCurrentUser(authUser);
          return { user: authUser };
        }
      } catch (err: any) {
        console.warn('Supabase signUp error:', err);
      }
    }

    // 3. Register user locally
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

