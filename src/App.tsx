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

export default function App() {
  // Supabase Authenticated User Session
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(() => {
    return supabaseAuth.getCurrentUser();
  });

  // Active Workspace Role: 'passenger' | 'captain' | 'admin'
  const [currentRole, setCurrentRole] = useState<UserRole>(() => {
    const savedUser = supabaseAuth.getCurrentUser();
    if (savedUser?.role) return savedUser.role;
    const saved = localStorage.getItem('motoride_active_role');
    if (saved === 'captain' || saved === 'admin' || saved === 'passenger') {
      return saved;
    }
    return 'passenger';
  });

  const [walletBalance, setWalletBalance] = useState<number>(() => {
    return currentUser?.walletBalance || (currentRole === 'captain' ? 850 : 350);
  });
  const [isCaptainOnline, setIsCaptainOnline] = useState<boolean>(true);
  const [isWalletOpen, setIsWalletOpen] = useState<boolean>(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState<boolean>(false);
  const [unreadNotifications, setUnreadNotifications] = useState<number>(1);
  const [showTestingGuide, setShowTestingGuide] = useState<boolean>(true);

  // Keep active role synced in local storage
  useEffect(() => {
    localStorage.setItem('motoride_active_role', currentRole);
  }, [currentRole]);

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
      />

      {/* Cross-Device Multi-User Real-Time Sync Banner */}
      {showTestingGuide && (
        <div className="bg-gradient-to-r from-emerald-950/70 via-slate-900 to-indigo-950/70 border-b border-slate-800/80 px-3 sm:px-6 py-2">
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="font-bold text-white">Cross-Device Real-Time Sync Active:</span>
              <span className="text-slate-300 hidden sm:inline">
                Signed in as <b className="text-white">{currentUser.name}</b> ({currentUser.role}). Open this app on another tab/phone as{' '}
                <b>{currentUser.role === 'passenger' ? 'Captain' : 'Passenger'}</b> to test live rides and offers!
              </span>
            </div>
            <button
              type="button"
              onClick={() => setShowTestingGuide(false)}
              className="text-slate-400 hover:text-white text-[11px] font-semibold cursor-pointer shrink-0"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Main Workspace Render (Gated - Accessible only after authentication) */}
      <main className="flex-1 w-full relative">
        {currentRole === 'passenger' && (
          <PassengerWorkspace
            currentPassengerId={currentUser.id || 'psg_hemant_01'}
            passengerName={currentUser.name || 'Hemant Kashyap'}
            onOpenWallet={() => setIsWalletOpen(true)}
            onSignOut={handleSignOut}
          />
        )}

        {currentRole === 'captain' && (
          <CaptainWorkspace
            captainId={currentUser.id || 'cpt_vikram_01'}
            captainName={currentUser.name || 'Captain Vikram Singh'}
            onOpenWallet={() => setIsWalletOpen(true)}
            onSignOut={handleSignOut}
          />
        )}

        {currentRole === 'admin' && (
          <AdminWorkspace
            currentUser={currentUser}
            onSignOut={handleSignOut}
          />
        )}
      </main>

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
