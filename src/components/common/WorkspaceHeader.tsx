import React, { useState, useEffect } from 'react';
import { UserRole } from '../../types/motoride';
import {
  User,
  LogOut,
  ArrowLeftRight,
  Shield,
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

  const handleToggleApp = () => {
    if (currentRole === 'passenger') {
      onRoleChange('captain');
    } else {
      onRoleChange('passenger');
    }
  };

  return (
    <header className="sticky top-0 z-50 bg-slate-950/95 backdrop-blur-md border-b border-slate-800/80 px-3 sm:px-6 py-2.5 shadow-lg shadow-black/40">
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
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 uppercase tracking-wide">
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

        {/* Center/Right Section: Role-based App Indicator & Controls */}
        <div className="flex items-center gap-2 sm:gap-4 flex-wrap">
          {/* Master One-Switch Button (Hidden when signed into a specific passenger or captain account) */}
          <div className="flex items-center gap-2">
            {currentUser?.role === 'passenger' ? (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-500/15 border border-emerald-500/40 text-emerald-300">
                <User className="w-3.5 h-3.5 text-emerald-400" />
                <span>Passenger App Account</span>
              </div>
            ) : currentUser?.role === 'captain' ? (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold bg-amber-500/15 border border-amber-500/40 text-amber-300">
                <div className="w-4 h-4 rounded bg-black/40 border border-white/20 flex items-center justify-center p-0.5 shrink-0">
                  <img
                    src="/captain-bike-icon.svg"
                    alt="Captain"
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-contain"
                  />
                </div>
                <span>Captain App Account</span>
              </div>
            ) : currentUser?.role === 'admin' ? (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold bg-purple-500/15 border border-purple-500/40 text-purple-300">
                <Shield className="w-3.5 h-3.5 text-purple-400" />
                <span>Admin Dashboard Account</span>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleToggleApp}
                id="app-one-switch-btn"
                className={`group relative flex items-center p-1 rounded-2xl border transition-all duration-300 shadow-md cursor-pointer select-none active:scale-[0.98] ${
                  currentRole === 'passenger'
                    ? 'bg-slate-900/90 border-emerald-500/40 shadow-emerald-950/30 hover:border-emerald-500/70'
                    : 'bg-slate-900/90 border-amber-500/40 shadow-amber-950/30 hover:border-amber-500/70'
                }`}
                title={`Currently viewing ${currentRole === 'passenger' ? 'Passenger App' : 'Captain App'}. Click switch to open ${currentRole === 'passenger' ? 'Captain App' : 'Passenger App'}.`}
              >
                {/* Passenger Option */}
                <div
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all duration-200 ${
                    currentRole === 'passenger'
                      ? 'bg-emerald-500 text-slate-950 shadow-sm shadow-emerald-500/50'
                      : 'text-slate-400 group-hover:text-slate-200'
                  }`}
                >
                  <User className={`w-3.5 h-3.5 ${currentRole === 'passenger' ? 'text-slate-950 font-bold' : 'text-slate-400'}`} />
                  <span>Passenger App</span>
                </div>

                {/* Central Switch Icon Indicator */}
                <div className="px-1.5 text-slate-500 group-hover:text-white transition-colors">
                  <ArrowLeftRight className="w-3.5 h-3.5 transition-transform duration-300 group-hover:scale-110" />
                </div>

                {/* Captain Option */}
                <div
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all duration-200 ${
                    currentRole === 'captain'
                      ? 'bg-amber-500 text-slate-950 shadow-sm shadow-amber-500/50'
                      : 'text-slate-400 group-hover:text-slate-200'
                  }`}
                >
                  <div className="w-4 h-4 rounded bg-black/40 border border-white/20 flex items-center justify-center p-0.5 shrink-0">
                    <img
                      src="/captain-bike-icon.svg"
                      alt="Captain"
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-contain"
                    />
                  </div>
                  <span>Captain App</span>
                </div>
              </button>
            )}

            {/* Captain Online/Offline Pill (Visible when Captain App is Active) */}
            {currentRole === 'captain' && onToggleCaptainOnline && (
              <button
                type="button"
                onClick={onToggleCaptainOnline}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border shadow-sm select-none active:scale-95 ${
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
          </div>

          {/* User Account Info & Sign Out */}
          {currentUser && (
            <div className="flex items-center gap-2 pl-2 border-l border-slate-800">
              <div className="hidden lg:flex flex-col text-right">
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
