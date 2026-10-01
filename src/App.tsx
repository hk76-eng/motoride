import React, { useState, useEffect } from 'react';
import { UserRole, MotorideRide } from './types/motoride';
import { WorkspaceHeader } from './components/common/WorkspaceHeader';
import { PassengerWorkspace } from './passenger/PassengerWorkspace';
import { CaptainWorkspace } from './captain/CaptainWorkspace';
import { AdminWorkspace } from './admin/AdminWorkspace';
import { WalletModal } from './components/common/WalletModal';
import { NotificationsModal } from './components/common/NotificationsModal';
import { AuthPage } from './components/AuthPage';
import { supabaseAuth, AuthUser } from './lib/supabaseAuth';
import { isSupabaseConfigured } from './lib/supabase';
import { safeStorage } from './lib/safeStorage';
import { motorideApi } from './services/motorideApi';
import { initAnalytics, trackPageView, enforceAdminNoIndex } from './utils/analytics';
import { ArrowLeftRight, User, Bike } from 'lucide-react';
import { realtimeSync } from './services/realtimeSync';

// Floating PiP Widget ("Run Over Other Apps") component
export const FloatingPiPWidget: React.FC = () => {
  const [enabled, setEnabled] = useState(() => safeStorage.getItem('motoride_run_over_apps') === 'true');
  const [activeRide, setActiveRide] = useState<MotorideRide | null>(null);
  const [minimized, setMinimized] = useState(false);

  useEffect(() => {
    const handleToggle = (e: any) => setEnabled(Boolean(e.detail));
    window.addEventListener('motoride_run_over_apps_changed', handleToggle as any);

    const checkRide = async () => {
      try {
        const rides = await motorideApi.getRides();
        const active = rides.find(r => r && ['requested', 'captain_offered', 'captain_accepted', 'captain_arrived', 'trip_started'].includes(r.status));
        setActiveRide(active || null);
      } catch {}
    };
    checkRide();
    const interval = setInterval(checkRide, 2500);
    const unsub = realtimeSync.on('RIDE_UPDATED', (r: any) => {
      if (r && ['requested', 'captain_offered', 'captain_accepted', 'captain_arrived', 'trip_started'].includes(r.status)) {
        setActiveRide(r);
      } else if (r && ['completed', 'cancelled_by_passenger', 'cancelled_by_captain'].includes(r.status)) {
        setActiveRide(null);
      }
    });

    return () => {
      window.removeEventListener('motoride_run_over_apps_changed', handleToggle as any);
      clearInterval(interval);
      unsub();
    };
  }, []);

  if (!enabled) return null;

  return (
    <div className="fixed bottom-20 right-4 z-[99999] bg-slate-900/98 text-white p-3.5 rounded-3xl shadow-[0_0_35px_rgba(6,182,212,0.6)] border-2 border-cyan-400 backdrop-blur-xl flex flex-col gap-2 max-w-xs animate-in slide-in-from-bottom duration-300">
      <div className="flex items-center justify-between gap-2 border-b border-white/10 pb-2">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-ping" />
          <span className="text-xs font-black tracking-wider text-cyan-300 uppercase">MotoRide PiP Overlay</span>
        </div>
        <button
          type="button"
          onClick={() => setMinimized(!minimized)}
          className="text-slate-400 hover:text-white text-xs font-bold px-1.5 py-0.5 rounded-lg bg-white/10 cursor-pointer"
        >
          {minimized ? '▲ Expand' : '▼ Minimize'}
        </button>
      </div>

      {!minimized && (
        <div className="flex flex-col gap-1.5 text-xs">
          {activeRide ? (
            <>
              <div className="flex items-center justify-between">
                <span className="text-slate-300">Status:</span>
                <span className="font-extrabold text-amber-300 uppercase tracking-wide">{activeRide.status.replace(/_/g, ' ')}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-300">Ride Code:</span>
                <span className="font-mono font-bold text-white bg-black/40 px-2 py-0.5 rounded border border-white/10">#{activeRide.ride_code || activeRide.id.slice(0, 6)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-300">Agreed Fare:</span>
                <span className="font-mono font-black text-emerald-400">₹{activeRide.final_fare || activeRide.fare_amount || 80}</span>
              </div>
              <div className="text-[10px] text-slate-400 truncate mt-0.5">
                📍 {activeRide.dropoff_address || 'Destination'}
              </div>
            </>
          ) : (
            <div className="py-2 text-center text-slate-400 text-xs font-medium">
              🚗 Ready for next ride (PiP Floating Bubble Active)
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default function App() {
  // Supabase Authenticated User Session
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(() => {
    return supabaseAuth.getCurrentUser();
  });

  // Active Workspace Role: locked to authenticated user's role
  const [currentRole, setCurrentRole] = useState<UserRole>(() => {
    const savedUser = supabaseAuth.getCurrentUser();
    return savedUser?.role || 'passenger';
  });

  const [themeMode, setThemeMode] = useState<string>(() => {
    return safeStorage.getItem('motoride_theme_mode') || 'dark';
  });

  useEffect(() => {
    const handleTheme = () => {
      const mode = safeStorage.getItem('motoride_theme_mode') || 'dark';
      setThemeMode(mode);
      document.documentElement.classList.toggle('dark', mode === 'dark');
      document.documentElement.classList.toggle('light', mode === 'light');
    };
    handleTheme();
    window.addEventListener('motoride_theme_changed', handleTheme);
    return () => window.removeEventListener('motoride_theme_changed', handleTheme);
  }, []);

  const [isCaptainOnline, setIsCaptainOnline] = useState<boolean>(true);
  const [isWalletOpen, setIsWalletOpen] = useState<boolean>(false);
  const [walletBalance, setWalletBalance] = useState<number>(() => {
    const savedUser = supabaseAuth.getCurrentUser();
    return savedUser?.walletBalance ?? 500;
  });
  const [isNotificationsOpen, setIsNotificationsOpen] = useState<boolean>(false);
  const [unreadNotifications, setUnreadNotifications] = useState<number>(0);

  // Initialize GA4 and enforce admin noindex on route/role change
  useEffect(() => {
    initAnalytics();
  }, []);

  useEffect(() => {
    const isAdmin = currentRole === 'admin';
    enforceAdminNoIndex(isAdmin);
    trackPageView(
      isAdmin ? '/admin' : currentRole === 'captain' ? '/captain' : '/passenger',
      isAdmin ? 'Motoride Admin Panel' : currentRole === 'captain' ? 'Motoride Captain Portal' : 'Motoride Passenger App'
    );
  }, [currentRole, currentUser]);

  // Check Supabase session on startup and enforce role-based workspace locking
  useEffect(() => {
    let isMounted = true;
    const verifySession = async () => {
      const sessionUser = await supabaseAuth.getSessionUser();
      if (isMounted) {
        if (sessionUser) {
          setCurrentUser(sessionUser);
          setCurrentRole(sessionUser.role);
        } else {
          setCurrentUser(null);
        }
      }
    };
    verifySession();
  }, []);

  useEffect(() => {
    if (currentUser?.role) {
      setCurrentRole(currentUser.role);
    }
  }, [currentUser]);

  // Synchronize the header's global walletBalance state in real-time when the captain's balance is updated on the server
  useEffect(() => {
    if (!currentUser?.id) return;
    
    // Initial fetch to make sure global balance is perfectly accurate on load
    motorideApi.getWallet(currentUser.id, currentUser.phone || '').then((w) => {
      if (w && w.wallet) {
        setWalletBalance(w.wallet.balance);
      }
    }).catch(() => {});

    const unsubscribe = realtimeSync.on('WALLET_UPDATED', (payload: any) => {
      if (payload && (payload.user_id === currentUser.id || !payload.user_id || currentUser.role === 'captain')) {
        if (typeof payload.balance === 'number') {
          setWalletBalance(payload.balance);
        }
        
        // Also update local storage session cache
        const curr = supabaseAuth.getCurrentUser();
        if (curr) {
          curr.walletBalance = payload.balance;
          supabaseAuth.setCurrentUser(curr);
        }
      }
    });
    
    return unsubscribe;
  }, [currentUser?.id]);

  // Handle Authentication Completion
  const handleAuthenticated = (user: AuthUser) => {
    setCurrentUser(user);
    setCurrentRole(user.role);
    if (user.walletBalance !== undefined) {
      setWalletBalance(user.walletBalance);
    }
  };

  // Handle Sign Out
  const handleSignOut = async () => {
    await supabaseAuth.signOut();
    setCurrentUser(null);
  };

  const handleRoleChange = (role: UserRole) => {
    setCurrentRole(role);
  };

  const handleToggleCaptainOnline = async () => {
    const nextState = !isCaptainOnline;
    setIsCaptainOnline(nextState);
    try {
      if (currentUser?.id) {
        await motorideApi.toggleCaptainOnline(currentUser.id, nextState);
      }
    } catch (err) {
      console.warn('Failed to toggle captain online:', err);
    }
  };

  // =========================================================================
  // GATING: If not signed in, show the Supabase Auth Portal
  // =========================================================================
  if (!currentUser) {
    return (
      <AuthPage
        onAuthenticated={handleAuthenticated}
        defaultRole={currentRole}
      />
    );
  }

  // =========================================================================
  // AUTHENTICATED: Show Full Application Features
  // =========================================================================
  return (
    <div className={`min-h-screen flex flex-col selection:bg-emerald-500 selection:text-slate-950 transition-colors duration-300 ${
      themeMode === 'light' ? 'bg-slate-50 text-slate-900 light' : 'bg-slate-950 text-slate-100 dark'
    }`}>
      {/* Workspace Top Header & Navigation with User Profile & Sign Out */}
      <WorkspaceHeader
        currentRole={currentRole}
        onRoleChange={handleRoleChange}
        currentUser={currentUser}
        onSignOut={handleSignOut}
        isCaptainOnline={isCaptainOnline}
        onToggleCaptainOnline={handleToggleCaptainOnline}
        walletBalance={walletBalance}
        onOpenWallet={() => setIsWalletOpen(true)}
      />

      {/* Main Workspace Render (Gated - Accessible only after authentication) */}
      <main className="flex-1 w-full relative">
        {currentRole === 'passenger' && (
          <PassengerWorkspace
            currentPassengerId={currentUser.id}
            passengerName={currentUser.name}
            currentUser={currentUser}
            onOpenWallet={() => setIsWalletOpen(true)}
            onSignOut={handleSignOut}
          />
        )}

        {currentRole === 'captain' && (
          <CaptainWorkspace
            captainId={currentUser.id}
            captainName={currentUser.name}
            currentUser={currentUser}
            walletBalance={walletBalance}
            onWalletBalanceUpdated={(newBal) => {
              setWalletBalance(newBal);
              const curr = supabaseAuth.getCurrentUser();
              if (curr) {
                curr.walletBalance = newBal;
                supabaseAuth.setCurrentUser(curr);
              }
            }}
            onOpenWallet={() => setIsWalletOpen(true)}
            onSignOut={handleSignOut}
            isOnline={isCaptainOnline}
            onToggleOnline={handleToggleCaptainOnline}
          />
        )}

        {currentRole === 'admin' && (
          <AdminWorkspace
            currentUser={currentUser}
            onSignOut={handleSignOut}
          />
        )}
      </main>

      {/* Floating One-Switch Button for Instant App Switch (Hidden for specific passenger/captain account sessions) */}
      {currentRole !== 'admin' && currentUser?.role !== 'passenger' && currentUser?.role !== 'captain' && (
        <aside aria-label="Quick App Switcher" className="fixed bottom-4 right-4 z-40">
          <button
            type="button"
            onClick={() => handleRoleChange(currentRole === 'passenger' ? 'captain' : 'passenger')}
            className={`flex items-center gap-2.5 px-4 py-2.5 rounded-full shadow-2xl backdrop-blur-md border transition-all duration-300 cursor-pointer active:scale-95 group ${
              currentRole === 'passenger'
                ? 'bg-slate-900/95 border-amber-500/50 text-amber-300 hover:bg-slate-800 hover:border-amber-400 shadow-amber-950/40'
                : 'bg-slate-900/95 border-emerald-500/50 text-emerald-300 hover:bg-slate-800 hover:border-emerald-400 shadow-emerald-950/40'
            }`}
            title={`Click to switch to ${currentRole === 'passenger' ? 'Captain App' : 'Passenger App'}`}
          >
            <div className="flex items-center justify-center w-6 h-6 rounded-full bg-black/50 border border-white/20">
              <ArrowLeftRight className="w-3.5 h-3.5 group-hover:rotate-180 transition-transform duration-300" />
            </div>
            <div className="text-left leading-tight">
              <div className="text-[10px] text-slate-400 font-medium">Switch to</div>
              <div className="text-xs font-bold text-white flex items-center gap-1">
                {currentRole === 'passenger' ? (
                  <>
                    <span className="text-amber-400">Captain App</span>
                    <span className="text-[10px]">🏍️</span>
                  </>
                ) : (
                  <>
                    <span className="text-emerald-400">Passenger App</span>
                    <span className="text-[10px]">👤</span>
                  </>
                )}
              </div>
            </div>
          </button>
        </aside>
      )}

      {/* Bottom Footer with Hyperlink to Admin Dashboard on 'Real Time' (Hidden for specific passenger/captain account sessions) */}
      {currentUser?.role !== 'passenger' && currentUser?.role !== 'captain' && (
        <footer className="relative z-20 w-full max-w-7xl mx-auto px-4 sm:px-6 py-4 text-center border-t border-slate-800/80 text-xs text-slate-400 bg-slate-950/90 backdrop-blur-sm">
          MotoRide Mobility Platform &copy; {new Date().getFullYear()} •{' '}
          <button
            type="button"
            onClick={() => handleRoleChange('admin')}
            className="text-white hover:text-slate-200 underline underline-offset-4 font-bold cursor-pointer transition-colors"
            title="Open Admin Dashboard"
          >
            Real Time
          </button>{' '}
          Urban Transportation Engine
        </footer>
      )}

      {/* Wallet Modal */}
      <WalletModal
        isOpen={isWalletOpen}
        onClose={() => setIsWalletOpen(false)}
        userId={currentUser.id}
        userPhone={currentUser.phone}
        userRole={currentRole}
        currentBalance={walletBalance}
        onBalanceUpdated={(newBal) => setWalletBalance(newBal)}
      />

      {/* Notifications Modal */}
      <NotificationsModal
        isOpen={isNotificationsOpen}
        onClose={() => setIsNotificationsOpen(false)}
        onReadCountChange={(count) => setUnreadNotifications(count)}
      />

      {/* Floating PiP Widget ("Run Over Other Apps") */}
      <FloatingPiPWidget />
    </div>
  );
}
