import React, { useState, useEffect } from 'react';
import { UserRole } from './types/motoride';
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
import { ArrowLeftRight, User, Bike } from 'lucide-react';

export default function App() {
  // Supabase Authenticated User Session
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(() => {
    return supabaseAuth.getCurrentUser();
  });

  // Active Workspace Role: 'passenger' | 'captain' | 'admin'
  const [currentRole, setCurrentRole] = useState<UserRole>(() => {
    const savedUser = supabaseAuth.getCurrentUser();
    if (savedUser?.role) return savedUser.role;
    const saved = safeStorage.getItem('motoride_active_role');
    if (saved === 'captain' || saved === 'passenger') {
      return saved;
    }
    return 'passenger';
  });

  const [walletBalance, setWalletBalance] = useState<number>(() => {
    return currentUser?.walletBalance || 0;
  });
  const [isCaptainOnline, setIsCaptainOnline] = useState<boolean>(true);
  const [isWalletOpen, setIsWalletOpen] = useState<boolean>(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState<boolean>(false);
  const [unreadNotifications, setUnreadNotifications] = useState<number>(0);
  const [showTestingGuide, setShowTestingGuide] = useState<boolean>(true);

  // Keep active role synced in safe storage and locked to user role if authenticated
  useEffect(() => {
    if (currentUser?.role && currentUser.role !== 'admin') {
      setCurrentRole(currentUser.role);
    }
    safeStorage.setItem('motoride_active_role', currentRole);
  }, [currentRole, currentUser]);

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
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-emerald-500 selection:text-slate-950">
      {/* Workspace Top Header & Navigation with User Profile & Sign Out */}
      <WorkspaceHeader
        currentRole={currentRole}
        onRoleChange={handleRoleChange}
        currentUser={currentUser}
        onSignOut={handleSignOut}
        isCaptainOnline={isCaptainOnline}
        onToggleCaptainOnline={handleToggleCaptainOnline}
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
    </div>
  );
}
