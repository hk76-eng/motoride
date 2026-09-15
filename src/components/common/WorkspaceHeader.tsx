import React, { useState, useEffect } from 'react';
import { UserRole } from '../../types/motoride';
import {
  Shield,
  Bike,
  User,
  LogOut,
  ChevronDown,
} from 'lucide-react';
import { realtimeSync } from '../../services/realtimeSync';
import { isSupabaseConfigured } from '../../lib/supabase';
import { AuthUser } from '../../lib/supabaseAuth';

interface WorkspaceHeaderProps {
  currentRole: UserRole;
  onRoleChange: (role: UserRole) => void;
  currentUser?: AuthUser | null;
  onSignOut?: () => void;
  walletBalance?: number;
  isCaptainOnline?: boolean;
  onToggleCaptainOnline?: () => void;
  unreadNotificationsCount?: number;
  onOpenNotifications?: () => void;
  onOpenWallet?: () => void;
}

export const WorkspaceHeader: React.FC<WorkspaceHeaderProps> = ({
  currentRole,
  onRoleChange,
  currentUser,
  onSignOut,
  isCaptainOnline = true,
}) => {
  const [isLiveConnected, setIsLiveConnected] = useState(true);
  const [supabaseActive, setSupabaseActive] = useState(isSupabaseConfigured());

  useEffect(() => {
    const unsub = realtimeSync.on('CONNECTION_STATUS', (data) => {
      setIsLiveConnected(data.connected);
    });
    setSupabaseActive(isSupabaseConfigured());
    return () => unsub();
  }, []);

  return (
    <header className="sticky top-0 z-50 bg-slate-950/90 backdrop-blur-md border-b border-slate-800/80 px-3 sm:px-6 py-2.5">
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
        {/* Brand & Active Workspace */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-black border border-white/20 flex items-center justify-center font-black text-white shadow-md shadow-black/60 shrink-0">
              <Bike className="w-5 h-5 text-white stroke-[2.5]" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold tracking-tight text-white text-base">MOTORIDE</span>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 uppercase">
                  v2.0
                </span>
              </div>
              <div className="flex items-center gap-2 text-[11px] text-slate-400">
                <span className="flex items-center gap-1">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      isLiveConnected ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'
                    }`}
                  />
                  <span className="font-medium">
                    {supabaseActive ? 'Supabase Realtime' : 'Shared Cloud Realtime'}
                  </span>
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Section: Workspace Switcher Tabs & Logged-in Supabase User Profile */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Workspace Switcher Tabs */}
          <nav aria-label="Workspaces" className="flex items-center bg-slate-900/90 p-1 rounded-xl border border-slate-800">
            <button
              type="button"
              onClick={() => onRoleChange('passenger')}
              className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                currentRole === 'passenger'
                  ? 'bg-emerald-500 text-slate-950 shadow-md font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <User className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Passenger</span>
            </button>

            <button
              type="button"
              onClick={() => onRoleChange('captain')}
              className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                currentRole === 'captain'
                  ? 'bg-amber-500 text-slate-950 shadow-md font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Bike className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Captain</span>
              {currentRole === 'captain' && (
                <span
                  className={`w-1.5 h-1.5 rounded-full ${isCaptainOnline ? 'bg-emerald-950' : 'bg-rose-900'}`}
                />
              )}
            </button>

            <button
              type="button"
              onClick={() => onRoleChange('admin')}
              className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                currentRole === 'admin'
                  ? 'bg-indigo-500 text-white shadow-md font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Shield className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Admin</span>
            </button>
          </nav>

          {/* User Account Info & Sign Out */}
          {currentUser && (
            <div className="flex items-center gap-2 pl-1 sm:pl-2 border-l border-slate-800">
              <div className="hidden md:flex flex-col text-right">
                <span className="text-xs font-bold text-white truncate max-w-[120px]">
                  {currentUser.name}
                </span>
                <span className="text-[10px] text-slate-400 truncate max-w-[120px]">
                  {currentUser.email}
                </span>
              </div>

              {onSignOut && (
                <button
                  type="button"
                  onClick={onSignOut}
                  title="Sign Out from Supabase session"
                  aria-label="Sign Out"
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 hover:text-rose-200 border border-rose-500/25 text-xs font-bold transition-all cursor-pointer active:scale-95 shrink-0"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Sign Out</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
