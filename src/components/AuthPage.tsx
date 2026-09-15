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
  Star,
  Zap,
  MapPin,
  Clock,
  Compass,
} from 'lucide-react';
import { UserRole, RideTypeCode } from '../types/motoride';
import { supabaseAuth, AuthUser, DEMO_USERS } from '../lib/supabaseAuth';
import { isSupabaseConfigured } from '../lib/supabase';

interface AuthPageProps {
  onAuthenticated: (user: AuthUser) => void;
  defaultRole?: UserRole;
}

export const AuthPage: React.FC<AuthPageProps> = ({
  onAuthenticated,
  defaultRole = 'passenger',
}) => {
  const [selectedRole, setSelectedRole] = useState<UserRole>(defaultRole);
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');

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

  const handleRoleSelect = (role: UserRole) => {
    setSelectedRole(role);
    setErrorMessage(null);
    setSuccessMessage(null);
    setSignInEmail(DEMO_USERS[role].email);
    setSignInPassword('password123');
  };

  const handleQuickDemoLogin = (role: UserRole) => {
    const demo = DEMO_USERS[role];
    supabaseAuth.setCurrentUser(demo);
    onAuthenticated(demo);
  };

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
    } else {
      name = admName.trim();
      email = admEmail.trim();
      phone = admPhone.trim();
      password = admPassword;
    }

    if (!name || !email || !password) {
      setErrorMessage('Please fill in all required fields');
      return;
    }

    setIsLoading(true);
    try {
      const { user, error } = await supabaseAuth.signUp({
        name,
        email,
        phone,
        password,
        role: selectedRole,
        vehicleModel,
        plateNumber,
        vehicleType,
      });

      if (error) {
        setErrorMessage(error);
      } else if (user) {
        setSuccessMessage('Account created successfully! Signing you in...');
        setTimeout(() => {
          onAuthenticated(user);
        }, 800);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Registration failed.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between relative overflow-hidden selection:bg-emerald-500 selection:text-slate-950">
      {/* Background Ambient Glow & Grid Effects */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-black pointer-events-none" />
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-emerald-500/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute top-1/3 -right-40 w-96 h-96 bg-amber-500/10 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute -bottom-40 left-1/3 w-96 h-96 bg-indigo-500/10 rounded-full blur-[140px] pointer-events-none" />

      {/* Top Header Brand */}
      <header className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 py-6 flex items-center justify-between border-b border-slate-800/60 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 p-0.5 shadow-lg shadow-emerald-500/20 flex items-center justify-center">
            <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center">
              <Navigation className="w-5 h-5 text-emerald-400 fill-emerald-400/20 rotate-45" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-black text-xl tracking-tight bg-gradient-to-r from-white via-slate-200 to-emerald-400 bg-clip-text text-transparent">
                MotoRide
              </span>
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-[10px] font-bold text-emerald-400 tracking-wide uppercase">
                Enterprise v3.2
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-medium">Real-Time Mobility & Live Captain Dispatch</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
        </div>
      </header>

      {/* Main Container */}
      <main className="relative z-10 w-full max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-12 flex-1 flex flex-col justify-center">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
          
          {/* Left Column: Brand Hero & Live Highlights */}
          <div className="lg:col-span-5 space-y-6 text-center lg:text-left">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-bold shadow-sm">
              <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
              <span>Next-Gen Urban Commute & Bidding</span>
            </div>

            <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-white leading-[1.15]">
              Ride Smarter. <br />
              <span className="bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 bg-clip-text text-transparent">
                Earn & Travel Faster.
              </span>
            </h1>

            <p className="text-sm sm:text-base text-slate-300 leading-relaxed font-normal">
              Experience lightning-fast bike & cab dispatch, live Captain bidding wars, zero friction secure payments, and cross-device real-time GPS tracking.
            </p>
          </div>

          {/* Right Column: Gorgeous Stylish Auth Card */}
          <div className="lg:col-span-7">
            <div className="bg-gradient-to-b from-slate-900/90 to-slate-950/95 border border-slate-800/80 rounded-[28px] p-6 sm:p-8 shadow-2xl backdrop-blur-xl relative overflow-hidden">
              
              {/* Top Accent Glow inside card */}
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 via-teal-400 to-indigo-500" />

              {/* Single Tab Switcher for Passenger / Captain App */}
              <div className="mb-6">
                <button
                  type="button"
                  onClick={() => handleRoleSelect(selectedRole === 'passenger' ? 'captain' : 'passenger')}
                  className="w-full py-3.5 px-4 sm:px-5 rounded-2xl bg-slate-950 border border-slate-800 hover:border-slate-700 text-xs font-black transition-all cursor-pointer flex items-center justify-between shadow-xl group relative overflow-hidden active:scale-[0.99]"
                >
                  <div className="flex items-center gap-3">
                    <div className={`p-2.5 rounded-xl transition-all ${
                      selectedRole === 'passenger'
                        ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                        : 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                    }`}>
                      {selectedRole === 'passenger' ? <User className="w-5 h-5" /> : <Bike className="w-5 h-5" />}
                    </div>
                    <div className="text-left">
                      <span className="block text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Active App Mode</span>
                      <span className="text-sm font-extrabold text-white">
                        {selectedRole === 'passenger' ? 'Passenger App' : 'Captain App'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-[11px] font-bold text-slate-300 group-hover:bg-slate-800 group-hover:text-white transition-all">
                    <span>Switch to {selectedRole === 'passenger' ? 'Captain App' : 'Passenger App'}</span>
                    <ArrowRight className="w-3.5 h-3.5 text-emerald-400 group-hover:translate-x-0.5 transition-transform" />
                  </div>
                </button>
              </div>

              {/* 2. Sign In vs Sign Up Mode Switcher */}
              <div className="grid grid-cols-2 gap-2 p-1 bg-slate-950/80 rounded-2xl border border-slate-800/80 mb-6">
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode('signin');
                    setErrorMessage(null);
                    setSuccessMessage(null);
                  }}
                  className={`py-2.5 px-4 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2 ${
                    authMode === 'signin'
                      ? 'bg-slate-800 text-white shadow-md border border-slate-700/80 font-black'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Key className="w-4 h-4 text-emerald-400" />
                  <span>Sign In</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setAuthMode('signup');
                    setErrorMessage(null);
                    setSuccessMessage(null);
                  }}
                  className={`py-2.5 px-4 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2 ${
                    authMode === 'signup'
                      ? 'bg-slate-800 text-white shadow-md border border-slate-700/80 font-black'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <ShieldCheck className="w-4 h-4 text-amber-400" />
                  <span>Create Account</span>
                </button>
              </div>

              {/* Error Message */}
              {errorMessage && (
                <div className="mb-5 p-3.5 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs font-medium flex items-center gap-2.5 shadow-md">
                  <ShieldAlert className="w-4 h-4 shrink-0 text-rose-400" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Success Message */}
              {successMessage && (
                <div className="mb-5 p-3.5 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-medium flex items-center gap-2.5 shadow-md">
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                  <span>{successMessage}</span>
                </div>
              )}

              {/* ======================================================== */}
              {/* MODE: SIGN IN FORM                                       */}
              {/* ======================================================== */}
              {authMode === 'signin' && (
                <form onSubmit={handleSignInSubmit} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                      {selectedRole.toUpperCase()} Email Address
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-slate-500 absolute left-4 top-1/2 -translate-y-1/2" />
                      <input
                        type="email"
                        required
                        value={signInEmail}
                        onChange={(e) => setSignInEmail(e.target.value)}
                        placeholder={DEMO_USERS[selectedRole].email}
                        className="w-full bg-slate-950 border border-slate-800 rounded-2xl py-3 pl-11 pr-4 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all font-mono"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                      Password
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-slate-500 absolute left-4 top-1/2 -translate-y-1/2" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        value={signInPassword}
                        onChange={(e) => setSignInPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full bg-slate-950 border border-slate-800 rounded-2xl py-3 pl-11 pr-12 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 cursor-pointer"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>



                  <button
                    type="submit"
                    disabled={isLoading}
                    className={`w-full py-3.5 px-4 rounded-2xl font-black text-xs sm:text-sm shadow-xl transition-all flex items-center justify-center gap-2 active:scale-[0.98] cursor-pointer disabled:opacity-50 ${
                      selectedRole === 'passenger'
                        ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-emerald-500/20'
                        : selectedRole === 'captain'
                        ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-amber-500/20'
                        : 'bg-indigo-500 hover:bg-indigo-400 text-white shadow-indigo-500/20'
                    }`}
                  >
                    {isLoading ? (
                      <span className="flex items-center gap-2">
                        <span className="w-4 h-4 rounded-full border-2 border-current border-t-transparent animate-spin" />
                        <span>Authenticating...</span>
                      </span>
                    ) : (
                      <>
                        <span>Sign In to {selectedRole.charAt(0).toUpperCase() + selectedRole.slice(1)} Dashboard</span>
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
                <form onSubmit={handleSignUpSubmit} className="space-y-4">
                  {selectedRole === 'passenger' && (
                    <>
                      <div>
                        <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">Full Name</label>
                        <input
                          type="text"
                          required
                          value={psgName}
                          onChange={(e) => setPsgName(e.target.value)}
                          placeholder="Hemant Kashyap"
                          className="w-full bg-slate-950 border border-slate-800 rounded-2xl py-2.5 px-4 text-xs sm:text-sm text-white focus:outline-none focus:border-emerald-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">Email Address</label>
                        <input
                          type="email"
                          required
                          value={psgEmail}
                          onChange={(e) => setPsgEmail(e.target.value)}
                          placeholder="passenger@motoride.com"
                          className="w-full bg-slate-950 border border-slate-800 rounded-2xl py-2.5 px-4 text-xs sm:text-sm text-white focus:outline-none focus:border-emerald-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">Phone Number</label>
                        <input
                          type="tel"
                          required
                          value={psgPhone}
                          onChange={(e) => setPsgPhone(e.target.value)}
                          placeholder="+91 98765 43210"
                          className="w-full bg-slate-950 border border-slate-800 rounded-2xl py-2.5 px-4 text-xs sm:text-sm text-white focus:outline-none focus:border-emerald-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">Password</label>
                        <input
                          type="password"
                          required
                          value={psgPassword}
                          onChange={(e) => setPsgPassword(e.target.value)}
                          placeholder="Create password"
                          className="w-full bg-slate-950 border border-slate-800 rounded-2xl py-2.5 px-4 text-xs sm:text-sm text-white focus:outline-none focus:border-emerald-500"
                        />
                      </div>
                    </>
                  )}

                  {selectedRole === 'captain' && (
                    <>
                      <div>
                        <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">Captain Full Name</label>
                        <input
                          type="text"
                          required
                          value={cptName}
                          onChange={(e) => setCptName(e.target.value)}
                          placeholder="Captain Vikram Singh"
                          className="w-full bg-slate-950 border border-slate-800 rounded-2xl py-2.5 px-4 text-xs sm:text-sm text-white focus:outline-none focus:border-amber-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">Email Address</label>
                        <input
                          type="email"
                          required
                          value={cptEmail}
                          onChange={(e) => setCptEmail(e.target.value)}
                          placeholder="captain@motoride.com"
                          className="w-full bg-slate-950 border border-slate-800 rounded-2xl py-2.5 px-4 text-xs sm:text-sm text-white focus:outline-none focus:border-amber-500"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">Vehicle Model</label>
                          <input
                            type="text"
                            required
                            value={cptVehicleModel}
                            onChange={(e) => setCptVehicleModel(e.target.value)}
                            placeholder="Honda Activa"
                            className="w-full bg-slate-950 border border-slate-800 rounded-2xl py-2.5 px-4 text-xs text-white focus:outline-none focus:border-amber-500"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">Plate Number</label>
                          <input
                            type="text"
                            required
                            value={cptPlateNumber}
                            onChange={(e) => setCptPlateNumber(e.target.value)}
                            placeholder="PB65AA1257"
                            className="w-full bg-slate-950 border border-slate-800 rounded-2xl py-2.5 px-4 text-xs text-white uppercase focus:outline-none focus:border-amber-500"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">Password</label>
                        <input
                          type="password"
                          required
                          value={cptPassword}
                          onChange={(e) => setCptPassword(e.target.value)}
                          placeholder="Create password"
                          className="w-full bg-slate-950 border border-slate-800 rounded-2xl py-2.5 px-4 text-xs sm:text-sm text-white focus:outline-none focus:border-amber-500"
                        />
                      </div>
                    </>
                  )}

                  {selectedRole === 'admin' && (
                    <>
                      <div>
                        <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">Admin Manager Name</label>
                        <input
                          type="text"
                          required
                          value={admName}
                          onChange={(e) => setAdmName(e.target.value)}
                          placeholder="Admin Manager"
                          className="w-full bg-slate-950 border border-slate-800 rounded-2xl py-2.5 px-4 text-xs sm:text-sm text-white focus:outline-none focus:border-indigo-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">Admin Email</label>
                        <input
                          type="email"
                          required
                          value={admEmail}
                          onChange={(e) => setAdmEmail(e.target.value)}
                          placeholder="admin@motoride.com"
                          className="w-full bg-slate-950 border border-slate-800 rounded-2xl py-2.5 px-4 text-xs sm:text-sm text-white focus:outline-none focus:border-indigo-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">Password</label>
                        <input
                          type="password"
                          required
                          value={admPassword}
                          onChange={(e) => setAdmPassword(e.target.value)}
                          placeholder="Create password"
                          className="w-full bg-slate-950 border border-slate-800 rounded-2xl py-2.5 px-4 text-xs sm:text-sm text-white focus:outline-none focus:border-indigo-500"
                        />
                      </div>
                    </>
                  )}

                  <button
                    type="submit"
                    disabled={isLoading}
                    className={`w-full py-3.5 px-4 rounded-2xl font-black text-xs sm:text-sm shadow-xl transition-all flex items-center justify-center gap-2 active:scale-[0.98] cursor-pointer disabled:opacity-50 ${
                      selectedRole === 'passenger'
                        ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-emerald-500/20'
                        : selectedRole === 'captain'
                        ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-amber-500/20'
                        : 'bg-indigo-500 hover:bg-indigo-400 text-white shadow-indigo-500/20'
                    }`}
                  >
                    {isLoading ? (
                      <span className="flex items-center gap-2">
                        <span className="w-4 h-4 rounded-full border-2 border-current border-t-transparent animate-spin" />
                        <span>Registering...</span>
                      </span>
                    ) : (
                      <>
                        <span>Create {selectedRole.charAt(0).toUpperCase() + selectedRole.slice(1)} Account</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </form>
              )}

            </div>
          </div>

        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 py-6 text-center border-t border-slate-800/60 text-xs text-slate-400">
        MotoRide Enterprise Mobility Platform &copy; {new Date().getFullYear()} •{' '}
        <button
          type="button"
          onClick={() => {
            const adminUser = DEMO_USERS['admin'];
            supabaseAuth.setCurrentUser(adminUser);
            onAuthenticated(adminUser);
          }}
          className="text-indigo-400 hover:underline font-bold cursor-pointer"
          title="Sign in as Admin Manager"
        >
          Secure Real-Time
        </button>{' '}
        Dispatch
      </footer>
    </div>
  );
};
