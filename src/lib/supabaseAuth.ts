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

const STORAGE_KEY = 'motoride_auth_session_user';

export const DEMO_USERS: Record<UserRole, AuthUser> = {
  passenger: {
    id: 'psg_hemant_01',
    name: 'Hemant Kashyap',
    email: 'hemantkashyap76@gmail.com',
    role: 'passenger',
    phone: '+91 98765 43210',
    walletBalance: 350,
    memberSince: '2024-01-15',
  },
  captain: {
    id: 'cpt_vikram_01',
    name: 'Captain Vikram Singh',
    email: 'vikram.singh.captain@motoride.in',
    role: 'captain',
    phone: '+91 98111 22334',
    vehicleModel: 'Honda Activa 6G',
    plateNumber: 'PB65AA1257',
    vehicleType: 'bike',
    walletBalance: 850,
    memberSince: '2023-11-20',
  },
  admin: {
    id: 'USR-ADMIN-001',
    name: 'Admin Manager',
    email: 'freelanceseoservices01@gmail.com',
    role: 'admin',
    phone: '+91 98765 00001',
    walletBalance: 5000,
    memberSince: '2023-01-01',
  },
};

export const supabaseAuth = {
  /**
   * Get current stored auth user from localStorage or Supabase
   */
  getCurrentUser(): AuthUser | null {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        return JSON.parse(raw);
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
      localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
      localStorage.setItem('motoride_active_role', user.role);
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  },

  /**
   * Sign In via Supabase Auth
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
          // Fall through only if network/invalid
          if (error.message.includes('Invalid login credentials')) {
            // Check if demo user matches
            const demo = DEMO_USERS[params.role];
            if (demo && demo.email.toLowerCase() === cleanEmail && params.password === 'password123') {
              this.setCurrentUser(demo);
              return { user: demo };
            }
            return { user: null as any, error: error.message };
          }
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
            walletBalance: meta.wallet_balance || (params.role === 'captain' ? 850 : 350),
            memberSince: data.user.created_at,
          };
          this.setCurrentUser(authUser);
          return { user: authUser };
        }
      } catch (err: any) {
        console.warn('Supabase auth signIn error:', err);
      }
    }

    // 2. Resilient local fallback authentication for rapid testing
    const demo = DEMO_USERS[params.role];
    if (demo && demo.email.toLowerCase() === cleanEmail) {
      this.setCurrentUser(demo);
      return { user: demo };
    }

    // Custom non-demo registered user fallback
    const fallbackUser: AuthUser = {
      id: `usr_${params.role}_${Date.now().toString(36)}`,
      email: cleanEmail,
      name: cleanEmail.split('@')[0].replace(/[._]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
      role: params.role,
      phone: '+91 98765 00000',
      walletBalance: params.role === 'captain' ? 850 : 350,
      memberSince: new Date().toISOString(),
    };
    this.setCurrentUser(fallbackUser);
    return { user: fallbackUser };
  },

  /**
   * Sign Up via Supabase Auth
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

    // 1. Try real Supabase Auth registration
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
          return { user: null as any, error: error.message };
        }

        const userId = data.user?.id || `usr_${params.role}_${Date.now().toString(36)}`;
        const authUser: AuthUser = {
          id: userId,
          email: cleanEmail,
          name: params.name.trim(),
          role: params.role,
          phone: params.phone?.trim() || '+91 98765 00000',
          vehicleModel: params.vehicleModel?.trim(),
          plateNumber: params.plateNumber?.trim(),
          vehicleType: params.vehicleType || 'bike',
          walletBalance: params.role === 'captain' ? 500 : 250,
          memberSince: new Date().toISOString(),
        };

        // Also attempt to upsert to profiles/captains/passengers tables if available
        try {
          await supabase.from('profiles').upsert([
            {
              id: userId,
              email: cleanEmail,
              full_name: params.name.trim(),
              phone: params.phone?.trim(),
              role: params.role,
              wallet_balance: authUser.walletBalance,
              is_active: true,
            },
          ]);
        } catch (e) {
          // ignore table errors if schema is still generating
        }

        this.setCurrentUser(authUser);
        return { user: authUser };
      } catch (err: any) {
        console.warn('Supabase signUp error:', err);
      }
    }

    // 2. Resilient local fallback creation
    const authUser: AuthUser = {
      id: `usr_${params.role}_${Date.now().toString(36)}`,
      email: cleanEmail,
      name: params.name.trim(),
      role: params.role,
      phone: params.phone?.trim() || '+91 98765 00000',
      vehicleModel: params.vehicleModel?.trim(),
      plateNumber: params.plateNumber?.trim(),
      vehicleType: params.vehicleType || 'bike',
      walletBalance: params.role === 'captain' ? 500 : 250,
      memberSince: new Date().toISOString(),
    };
    this.setCurrentUser(authUser);
    return { user: authUser };
  },

  /**
   * Sign Out via Supabase Auth
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
