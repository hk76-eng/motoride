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
  onToggleCaptainOnline,
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
          <div className="flex items-center gap-2.5">
            <img
              src="/motoride-logo.png"
              alt="Motoride"
              referrerPolicy="no-referrer"
              className="w-9 h-9 rounded-xl object-cover bg-black border border-white/20 shadow-md shadow-black/80 shrink-0"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.display = 'none';
              }}
            />
            <div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="font-extrabold tracking-tight text-white text-base">
                  Motoride
                </span>
                <span className="text-[11px] text-emerald-400 font-semibold hidden xs:inline">
                  – Ride & Courier Booking
                </span>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 uppercase">
                  Live
                </span>
              </div>
              <div className="flex items-center gap-2 text-[11px] text-slate-400">
                <span className="flex items-center gap-1">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      isLiveConnected ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'
                    }`}
                  />
                  <span className="font-medium text-[10px] sm:text-[11px]">
                    {supabaseActive ? 'Supabase Realtime Cloud' : 'Realtime Sync'}
                  </span>
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Section: Workspace Switcher Single Tab & Logged-in Supabase User Profile */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Workspace Switcher Single Tab & Captain Online Capsule */}
          <nav aria-label="Workspaces" className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onRoleChange(currentRole === 'passenger' ? 'captain' : 'passenger')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                currentRole === 'passenger'
                  ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/25'
                  : 'bg-amber-500/15 border-amber-500/40 text-amber-300 hover:bg-amber-500/25'
              }`}
              title={`Switch to ${currentRole === 'passenger' ? 'Captain' : 'Passenger'} App`}
            >
              {currentRole === 'passenger' ? (
                <>
                  <User className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Passenger App</span>
                </>
              ) : (
                <>
                  <Bike className="w-3.5 h-3.5 text-amber-400" />
                  <span>Captain App</span>
                </>
              )}
            </button>

            {/* Small capsule form Online button Near Captain App Right side */}
            {currentRole === 'captain' && onToggleCaptainOnline && (
              <button
                type="button"
                onClick={onToggleCaptainOnline}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] sm:text-xs font-bold transition-all cursor-pointer border shadow-sm select-none active:scale-95 ${
                  isCaptainOnline
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/30'
                    : 'bg-rose-500/20 text-rose-300 border-rose-500/40 hover:bg-rose-500/30'
                }`}
                title={isCaptainOnline ? 'Status: Online (Click to go Offline)' : 'Status: Offline (Click to go Online)'}
              >
                <span
                  className={`w-2 h-2 rounded-full ${
                    isCaptainOnline ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'
                  }`}
                />
                <span>{isCaptainOnline ? 'Online' : 'Offline'}</span>
              </button>
            )}
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
