import React, { useState } from 'react';
import {
  Bike,
  Shield,
  User,
  ShieldCheck,
  Navigation,
  Sparkles,
  Lock,
  Mail,
  Phone,
  Eye,
  EyeOff,
  ArrowRight,
  ShieldAlert,
  Car,
  Package,
  CheckCircle2,
  Database,
  Radio,
  Key,
} from 'lucide-react';
import { UserRole, RideTypeCode } from '../types/motoride';
import { supabaseAuth, AuthUser, DEMO_USERS } from '../lib/supabaseAuth';
import { isSupabaseConfigured, SUPABASE_CONFIG_STATUS } from '../lib/supabase';

interface AuthPageProps {
  onAuthenticated: (user: AuthUser) => void;
  defaultRole?: UserRole;
}

export const AuthPage: React.FC<AuthPageProps> = ({
  onAuthenticated,
  defaultRole = 'passenger',
}) => {
  // Main Role Selector: 'passenger' | 'captain' | 'admin'
  const [selectedRole, setSelectedRole] = useState<UserRole>(defaultRole);

  // Auth Mode: 'signin' | 'signup'
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');

  // Common State
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Sign In Form State
  const [signInEmail, setSignInEmail] = useState(() => DEMO_USERS[defaultRole].email);
  const [signInPassword, setSignInPassword] = useState('password123');

  // Passenger Sign Up State
  const [psgName, setPsgName] = useState('Hemant Kashyap');
  const [psgEmail, setPsgEmail] = useState('');
  const [psgPhone, setPsgPhone] = useState('+91 98765 43210');
  const [psgPassword, setPsgPassword] = useState('');

  // Captain Sign Up State
  const [cptName, setCptName] = useState('Captain Vikram Singh');
  const [cptEmail, setCptEmail] = useState('');
  const [cptPhone, setCptPhone] = useState('+91 98111 22334');
  const [cptVehicleModel, setCptVehicleModel] = useState('Honda Activa 6G');
  const [cptPlateNumber, setCptPlateNumber] = useState('PB65AA1257');
  const [cptVehicleType, setCptVehicleType] = useState<RideTypeCode>('bike');
  const [cptPassword, setCptPassword] = useState('');

  // Admin Sign Up State
  const [admName, setAdmName] = useState('Admin Manager');
  const [admEmail, setAdmEmail] = useState('freelanceseoservices01@gmail.com');
  const [admPhone, setAdmPhone] = useState('+91 98765 00001');
  const [admPassword, setAdmPassword] = useState('');

  // Handle Role Switch
  const handleRoleSelect = (role: UserRole) => {
    setSelectedRole(role);
    setErrorMessage(null);
    setSuccessMessage(null);
    setSignInEmail(DEMO_USERS[role].email);
    setSignInPassword('password123');
  };

  // Quick 1-Click Demo Login
  const handleQuickDemoLogin = (role: UserRole) => {
    const demo = DEMO_USERS[role];
    supabaseAuth.setCurrentUser(demo);
    onAuthenticated(demo);
  };

  // Submit Sign In
  const handleSignInSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!signInEmail.trim() || !signInEmail.includes('@')) {
      setErrorMessage('Please enter a valid email address');
      return;
    }
    if (!signInPassword) {
      setErrorMessage('Password is required');
      return;
    }

    setIsLoading(true);
    try {
      const { user, error } = await supabaseAuth.signIn({
        email: signInEmail.trim(),
        password: signInPassword,
        role: selectedRole,
      });

      if (error) {
        setErrorMessage(error);
      } else if (user) {
        onAuthenticated(user);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to sign in. Please check credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  // Submit Sign Up
  const handleSignUpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    let name = '';
    let email = '';
    let phone = '';
    let password = '';
    let vehicleModel: string | undefined;
    let plateNumber: string | undefined;
    let vehicleType: RideTypeCode | undefined;

    if (selectedRole === 'passenger') {
      name = psgName.trim();
      email = psgEmail.trim();
      phone = psgPhone.trim();
      password = psgPassword;
    } else if (selectedRole === 'captain') {
      name = cptName.trim();
      email = cptEmail.trim();
      phone = cptPhone.trim();
      password = cptPassword;
      vehicleModel = cptVehicleModel.trim();
      plateNumber = cptPlateNumber.trim().toUpperCase();
      vehicleType = cptVehicleType;

      if (!vehicleModel || !plateNumber) {
        setErrorMessage('Vehicle model and plate registration number are required');
        return;
      }
    } else {
      name = admName.trim();
      email = admEmail.trim();
      phone = admPhone.trim();
      password = admPassword;
    }

    if (!name) {
      setErrorMessage('Full name is required');
      return;
    }
    if (!email || !email.includes('@')) {
      setErrorMessage('Please enter a valid email address');
      return;
    }
    if (!password || password.length < 6) {
      setErrorMessage('Password must be at least 6 characters');
      return;
    }

    setIsLoading(true);
    try {
      const { user, error } = await supabaseAuth.signUp({
        email,
        password,
        name,
        phone,
        role: selectedRole,
        vehicleModel,
        plateNumber,
        vehicleType,
      });

      if (error) {
        setErrorMessage(error);
      } else if (user) {
        setSuccessMessage('Account registered successfully! Unlocking your dashboard...');
        setTimeout(() => {
          onAuthenticated(user);
        }, 600);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to sign up. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center py-6 px-3 sm:px-6 lg:px-8 relative overflow-hidden selection:bg-emerald-500 selection:text-slate-950">
      {/* Background Ambience */}
      <div className="absolute top-10 left-1/2 -translate-x-1/2 w-[32rem] h-[32rem] bg-emerald-500/10 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-80 h-80 bg-amber-500/10 rounded-full blur-[90px] pointer-events-none" />
      <div className="absolute top-1/3 left-10 w-72 h-72 bg-indigo-500/10 rounded-full blur-[80px] pointer-events-none" />

      <div className="max-w-4xl w-full mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8 items-center relative z-10">
        
        {/* Left Col: Brand Presentation & Live Badges */}
        <div className="lg:col-span-5 space-y-5">
          <div className="inline-flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-black border border-white/20 flex items-center justify-center shadow-2xl shadow-black/80">
              <Bike className="w-7 h-7 text-white stroke-[2.5]" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h1 className="font-extrabold text-2xl tracking-tight text-white">
                  MOTORIDE
                </h1>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 uppercase">
                  Supabase Auth
                </span>
              </div>
              <p className="text-xs text-slate-400 font-medium">
                Unified Ride-Hailing & Captain Dispatch Engine
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight leading-tight">
              Sign in to unlock all app features
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
              Authenticate via Supabase to access passenger ride booking, real-time captain bidding, live GPS tracking, in-app chat, and the admin control suite.
            </p>
          </div>

          {/* Quick 1-Click Instant Test Access Buttons */}
          <div className="p-3.5 rounded-2xl bg-slate-900/90 border border-slate-800/80 space-y-2.5 shadow-xl">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-slate-200 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>Instant 1-Click Demo Logins:</span>
              </span>
              <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Testing Mode</span>
            </div>

            <div className="grid grid-cols-1 gap-1.5">
              <button
                type="button"
                onClick={() => handleQuickDemoLogin('passenger')}
                className="w-full px-3 py-2 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 hover:text-emerald-200 text-xs font-bold transition-all flex items-center justify-between cursor-pointer group"
              >
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-emerald-400" />
                  <span>Passenger (Hemant Kashyap)</span>
                </div>
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
              </button>

              <button
                type="button"
                onClick={() => handleQuickDemoLogin('captain')}
                className="w-full px-3 py-2 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 hover:text-amber-200 text-xs font-bold transition-all flex items-center justify-between cursor-pointer group"
              >
                <div className="flex items-center gap-2">
                  <Bike className="w-4 h-4 text-amber-400" />
                  <span>Captain (Vikram Singh)</span>
                </div>
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
              </button>

              <button
                type="button"
                onClick={() => handleQuickDemoLogin('admin')}
                className="w-full px-3 py-2 rounded-xl bg-indigo-500/15 hover:bg-indigo-500/25 border border-indigo-500/30 text-indigo-300 hover:text-indigo-200 text-xs font-bold transition-all flex items-center justify-between cursor-pointer group"
              >
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4 text-indigo-400" />
                  <span>Admin Manager</span>
                </div>
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
              </button>
            </div>
          </div>

          {/* Supabase Status Pill */}
          <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-900/60 border border-slate-800 text-[11px]">
            <div className="flex items-center gap-2">
              <Database className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-slate-400">Database & Realtime:</span>
            </div>
            <span className="font-bold text-emerald-400 flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>{isSupabaseConfigured() ? 'Supabase Connected' : 'Cloud Sync Active'}</span>
            </span>
          </div>
        </div>

        {/* Right Col: Interactive Supabase Sign In / Sign Up Form */}
        <div className="lg:col-span-7 bg-slate-900/95 border border-slate-800 rounded-3xl p-5 sm:p-7 shadow-2xl backdrop-blur-xl">
          
          {/* 1. Dashboard Role Selector Tabs (Passenger / Captain / Admin) */}
          <div className="mb-4">
            <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
              Select Dashboard to Sign In / Sign Up
            </label>
            <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-950 rounded-2xl border border-slate-800">
              <button
                type="button"
                onClick={() => handleRoleSelect('passenger')}
                className={`py-2 px-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  selectedRole === 'passenger'
                    ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20 font-black'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <User className="w-3.5 h-3.5" />
                <span>Passenger</span>
              </button>

              <button
                type="button"
                onClick={() => handleRoleSelect('captain')}
                className={`py-2 px-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  selectedRole === 'captain'
                    ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20 font-black'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Bike className="w-3.5 h-3.5" />
                <span>Captain</span>
              </button>

              <button
                type="button"
                onClick={() => handleRoleSelect('admin')}
                className={`py-2 px-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  selectedRole === 'admin'
                    ? 'bg-indigo-500 text-white shadow-md shadow-indigo-500/20 font-black'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Shield className="w-3.5 h-3.5" />
                <span>Admin</span>
              </button>
            </div>
          </div>

          {/* 2. Sign In vs Sign Up Mode Switcher */}
          <div className="grid grid-cols-2 gap-2 p-1 bg-slate-950/70 rounded-xl border border-slate-800/80 mb-5">
            <button
              type="button"
              onClick={() => {
                setAuthMode('signin');
                setErrorMessage(null);
                setSuccessMessage(null);
              }}
              className={`py-1.5 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                authMode === 'signin'
                  ? 'bg-slate-800 text-white shadow-sm border border-slate-700'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Key className="w-3.5 h-3.5" />
              <span>Sign In with Supabase</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setAuthMode('signup');
                setErrorMessage(null);
                setSuccessMessage(null);
              }}
              className={`py-1.5 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                authMode === 'signup'
                  ? 'bg-slate-800 text-white shadow-sm border border-slate-700'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Create New Account</span>
            </button>
          </div>

          {/* Error Message */}
          {errorMessage && (
            <div className="mb-4 p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Success Message */}
          {successMessage && (
            <div className="mb-4 p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* ======================================================== */}
          {/* MODE: SIGN IN FORM                                       */}
          {/* ======================================================== */}
          {authMode === 'signin' && (
            <form onSubmit={handleSignInSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  {selectedRole.toUpperCase()} Email Address
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    required
                    value={signInEmail}
                    onChange={(e) => setSignInEmail(e.target.value)}
                    placeholder={DEMO_USERS[selectedRole].email}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 pl-10 pr-4 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={signInPassword}
                    onChange={(e) => setSignInPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 pl-10 pr-11 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs text-slate-400">
                <button
                  type="button"
                  onClick={() => {
                    setSignInEmail(DEMO_USERS[selectedRole].email);
                    setSignInPassword('password123');
                  }}
                  className="text-emerald-400 hover:underline cursor-pointer"
                >
                  Fill default credentials
                </button>
                <span className="text-[11px] text-slate-500">Supabase Auth Session</span>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className={`w-full py-3 px-4 rounded-xl font-bold text-xs sm:text-sm shadow-xl transition-all flex items-center justify-center gap-2 active:scale-[0.98] cursor-pointer disabled:opacity-50 ${
                  selectedRole === 'passenger'
                    ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-emerald-500/20'
                    : selectedRole === 'captain'
                    ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-amber-500/20'
                    : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-500/20'
                }`}
              >
                {isLoading ? (
                  <span>Signing In with Supabase...</span>
                ) : (
                  <>
                    <span>Sign In to {selectedRole.toUpperCase()} Dashboard</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          )}

          {/* ======================================================== */}
          {/* MODE: SIGN UP FORM                                       */}
          {/* ======================================================== */}
          {authMode === 'signup' && (
            <form onSubmit={handleSignUpSubmit} className="space-y-3.5">
              {/* Role: Passenger Sign Up */}
              {selectedRole === 'passenger' && (
                <>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 uppercase tracking-wider mb-1">
                      Passenger Full Name
                    </label>
                    <div className="relative">
                      <User className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        required
                        value={psgName}
                        onChange={(e) => setPsgName(e.target.value)}
                        placeholder="Hemant Kashyap"
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 pl-10 pr-3 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-300 uppercase tracking-wider mb-1">
                        Email Address
                      </label>
                      <div className="relative">
                        <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                        <input
                          type="email"
                          required
                          value={psgEmail}
                          onChange={(e) => setPsgEmail(e.target.value)}
                          placeholder="passenger@gmail.com"
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 pl-10 pr-3 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 font-mono"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-300 uppercase tracking-wider mb-1">
                        Mobile Number
                      </label>
                      <div className="relative">
                        <Phone className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                        <input
                          type="tel"
                          value={psgPhone}
                          onChange={(e) => setPsgPhone(e.target.value)}
                          placeholder="+91 98765 43210"
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 pl-10 pr-3 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 uppercase tracking-wider mb-1">
                      Create Password (min. 6 chars)
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        value={psgPassword}
                        onChange={(e) => setPsgPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 pl-10 pr-10 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 cursor-pointer"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </>
              )}

              {/* Role: Captain Sign Up */}
              {selectedRole === 'captain' && (
                <>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 uppercase tracking-wider mb-1">
                      Captain Full Name
                    </label>
                    <div className="relative">
                      <User className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        required
                        value={cptName}
                        onChange={(e) => setCptName(e.target.value)}
                        placeholder="Captain Vikram Singh"
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 pl-10 pr-3 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-300 uppercase tracking-wider mb-1">
                        Captain Email
                      </label>
                      <div className="relative">
                        <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                        <input
                          type="email"
                          required
                          value={cptEmail}
                          onChange={(e) => setCptEmail(e.target.value)}
                          placeholder="captain@motoride.in"
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 pl-10 pr-3 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 font-mono"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-300 uppercase tracking-wider mb-1">
                        Mobile Number
                      </label>
                      <div className="relative">
                        <Phone className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                        <input
                          type="tel"
                          value={cptPhone}
                          onChange={(e) => setCptPhone(e.target.value)}
                          placeholder="+91 98111 22334"
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 pl-10 pr-3 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Vehicle Details */}
                  <div className="p-2.5 rounded-xl bg-slate-950/90 border border-slate-800 space-y-2.5">
                    <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider">
                      Vehicle & Registration Details
                    </span>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      <div>
                        <label className="block text-[10px] text-slate-400 mb-0.5">Vehicle Type</label>
                        <select
                          value={cptVehicleType}
                          onChange={(e) => setCptVehicleType(e.target.value as RideTypeCode)}
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg py-1.5 px-2 text-xs text-white focus:outline-none focus:border-amber-500 cursor-pointer"
                        >
                          <option value="bike">🏍️ Bike Taxi</option>
                          <option value="auto">🛺 Auto</option>
                          <option value="car">🚗 Cab / Car</option>
                          <option value="courier">📦 Parcel Delivery</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[10px] text-slate-400 mb-0.5">Vehicle Model</label>
                        <input
                          type="text"
                          required
                          value={cptVehicleModel}
                          onChange={(e) => setCptVehicleModel(e.target.value)}
                          placeholder="Honda Activa 6G"
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg py-1.5 px-2.5 text-xs text-white focus:outline-none focus:border-amber-500"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] text-slate-400 mb-0.5">Plate Number</label>
                        <input
                          type="text"
                          required
                          value={cptPlateNumber}
                          onChange={(e) => setCptPlateNumber(e.target.value)}
                          placeholder="PB65AA1257"
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg py-1.5 px-2.5 text-xs text-white uppercase font-mono focus:outline-none focus:border-amber-500"
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 uppercase tracking-wider mb-1">
                      Captain Password (min. 6 chars)
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        value={cptPassword}
                        onChange={(e) => setCptPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 pl-10 pr-10 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 cursor-pointer"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </>
              )}

              {/* Role: Admin Sign Up */}
              {selectedRole === 'admin' && (
                <>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 uppercase tracking-wider mb-1">
                      Admin Full Name
                    </label>
                    <div className="relative">
                      <User className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        required
                        value={admName}
                        onChange={(e) => setAdmName(e.target.value)}
                        placeholder="Admin Manager"
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 pl-10 pr-3 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-300 uppercase tracking-wider mb-1">
                        Admin Email
                      </label>
                      <div className="relative">
                        <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                        <input
                          type="email"
                          required
                          value={admEmail}
                          onChange={(e) => setAdmEmail(e.target.value)}
                          placeholder="admin@motoride.in"
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 pl-10 pr-3 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 font-mono"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-300 uppercase tracking-wider mb-1">
                        Admin Phone
                      </label>
                      <div className="relative">
                        <Phone className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                        <input
                          type="tel"
                          value={admPhone}
                          onChange={(e) => setAdmPhone(e.target.value)}
                          placeholder="+91 98765 00001"
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 pl-10 pr-3 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 uppercase tracking-wider mb-1">
                      Admin Password (min. 6 chars)
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        value={admPassword}
                        onChange={(e) => setAdmPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 pl-10 pr-10 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 cursor-pointer"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className={`w-full py-3 px-4 rounded-xl font-bold text-xs sm:text-sm shadow-xl transition-all flex items-center justify-center gap-2 active:scale-[0.98] cursor-pointer disabled:opacity-50 ${
                  selectedRole === 'passenger'
                    ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-emerald-500/20'
                    : selectedRole === 'captain'
                    ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-amber-500/20'
                    : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-500/20'
                }`}
              >
                {isLoading ? (
                  <span>Registering with Supabase...</span>
                ) : (
                  <>
                    <span>Create {selectedRole.toUpperCase()} Account & Launch App</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          )}

        </div>
      </div>
    </div>
  );
};
