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
    <div className="min-h-screen bg-black text-white flex flex-col justify-between relative overflow-hidden selection:bg-neutral-800 selection:text-white">
      {/* Background Subtle Noir Texture */}
      <div className="absolute inset-0 bg-black pointer-events-none" />

      {/* Top Header Brand */}
      <header className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 py-6 flex items-center justify-between border-b border-white/20 bg-black">
        <div className="flex items-center gap-3">
          <img
            src="/motoride-logo.png"
            alt="Motoride"
            referrerPolicy="no-referrer"
            className="w-12 h-12 rounded-2xl object-cover bg-black border border-white/30 shadow-lg shadow-black/90 shrink-0"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = 'none';
            }}
          />
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-black text-xl tracking-tight text-white">
                Motoride
              </span>
              <span className="text-xs text-white/80 font-semibold hidden sm:inline">
                – Ride & Courier Booking
              </span>
            </div>
            <p className="text-[11px] text-white/80 font-medium">Real-Time Mobility, Parcel Delivery & Live Captain Bidding</p>
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
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-black border border-white/30 text-white text-xs font-bold shadow-sm">
              <Sparkles className="w-3.5 h-3.5 text-white stroke-[2.5]" />
              <span>Next-Gen Urban Commute & Bidding</span>
            </div>

            <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-white leading-[1.15]">
              Ride Smarter. <br />
              <span className="text-white">
                Earn & Travel Faster.
              </span>
            </h1>

            <p className="text-sm sm:text-base text-white/90 leading-relaxed font-normal">
              Experience lightning-fast bike & cab dispatch, live Captain bidding wars, zero friction secure payments, and cross-device real-time GPS tracking.
            </p>
          </div>

          {/* Right Column: Noir Black & White Auth Card */}
          <div className="lg:col-span-7">
            <div className="bg-black border border-white/20 rounded-[28px] p-6 sm:p-8 shadow-2xl shadow-black relative overflow-hidden">
              
              {/* Top Border Accent */}
              <div className="absolute top-0 left-0 right-0 h-1 bg-white/40" />

              {/* Single Tab Switcher for Passenger / Captain App */}
              <div className="mb-6">
                <button
                  type="button"
                  onClick={() => handleRoleSelect(selectedRole === 'passenger' ? 'captain' : 'passenger')}
                  className="w-full py-3.5 px-4 sm:px-5 rounded-2xl bg-black border border-white/25 hover:border-white/50 text-xs font-black transition-all cursor-pointer flex items-center justify-between shadow-xl group relative overflow-hidden active:scale-[0.99]"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl transition-all flex items-center justify-center shrink-0 bg-black text-white border border-white/30 shadow-md p-1.5">
                      {selectedRole === 'passenger' ? (
                        <div className="w-full h-full rounded-lg bg-black flex items-center justify-center">
                          <User className="w-5 h-5 text-white stroke-[2.5]" />
                        </div>
                      ) : (
                        <img
                          src="/captain-bike-icon.svg"
                          alt="Captain Bike"
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-contain rounded-lg"
                        />
                      )}
                    </div>
                    <div className="text-left">
                      <span className="block text-[10px] text-white/70 uppercase tracking-wider font-semibold">
                        Active App Mode
                      </span>
                      <span className="text-sm font-extrabold text-white flex items-center gap-1.5">
                        {selectedRole === 'passenger' ? 'Passenger App' : 'Captain App'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-black border border-white/25 text-[11px] font-bold text-white group-hover:bg-neutral-900 transition-all">
                    {selectedRole === 'passenger' ? (
                      <div className="w-4 h-4 rounded-xs bg-black flex items-center justify-center shrink-0">
                        <img
                          src="/captain-bike-icon.svg"
                          alt="Captain"
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-contain"
                        />
                      </div>
                    ) : (
                      <div className="w-4 h-4 rounded-xs bg-black flex items-center justify-center">
                        <User className="w-3.5 h-3.5 text-white stroke-[2.5]" />
                      </div>
                    )}
                    <span className="text-white">Switch to {selectedRole === 'passenger' ? 'Captain App' : 'Passenger App'}</span>
                    <ArrowRight className="w-3.5 h-3.5 text-white group-hover:translate-x-0.5 transition-transform" />
                  </div>
                </button>
              </div>

              {/* 2. Sign In vs Sign Up Mode Switcher */}
              <div className="grid grid-cols-2 gap-2 p-1 bg-black rounded-2xl border border-white/25 mb-6">
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode('signin');
                    setErrorMessage(null);
                    setSuccessMessage(null);
                  }}
                  className={`py-2.5 px-4 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2 ${
                    authMode === 'signin'
                      ? 'bg-black text-white shadow-md border border-white font-black'
                      : 'text-white/60 hover:text-white bg-black hover:bg-neutral-950'
                  }`}
                >
                  <Key className="w-4 h-4 text-white stroke-[2.5]" />
                  <span className="text-white">Sign In</span>
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
                      ? 'bg-black text-white shadow-md border border-white font-black'
                      : 'text-white/60 hover:text-white bg-black hover:bg-neutral-950'
                  }`}
                >
                  <ShieldCheck className="w-4 h-4 text-white stroke-[2.5]" />
                  <span className="text-white">Create Account</span>
                </button>
              </div>

              {/* Error Message */}
              {errorMessage && (
                <div className="mb-5 p-3.5 rounded-2xl bg-black border border-white/40 text-white text-xs font-medium flex items-center gap-2.5 shadow-md">
                  <ShieldAlert className="w-4 h-4 shrink-0 text-white stroke-[2.5]" />
                  <span className="text-white">{errorMessage}</span>
                </div>
              )}

              {/* Success Message */}
              {successMessage && (
                <div className="mb-5 p-3.5 rounded-2xl bg-black border border-white/40 text-white text-xs font-medium flex items-center gap-2.5 shadow-md">
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-white stroke-[2.5]" />
                  <span className="text-white">{successMessage}</span>
                </div>
              )}

              {/* ======================================================== */}
              {/* MODE: SIGN IN FORM                                       */}
              {/* ======================================================== */}
              {authMode === 'signin' && (
                <form onSubmit={handleSignInSubmit} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-white uppercase tracking-wider mb-2">
                      {selectedRole.toUpperCase()} Email Address
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-white absolute left-4 top-1/2 -translate-y-1/2" />
                      <input
                        type="email"
                        required
                        value={signInEmail}
                        onChange={(e) => setSignInEmail(e.target.value)}
                        placeholder={DEMO_USERS[selectedRole].email}
                        className="w-full bg-black border border-white/30 rounded-2xl py-3 pl-11 pr-4 text-xs sm:text-sm text-white placeholder-white/40 focus:outline-none focus:border-white focus:ring-1 focus:ring-white transition-all font-mono"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-white uppercase tracking-wider mb-2">
                      Password
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-white absolute left-4 top-1/2 -translate-y-1/2" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        value={signInPassword}
                        onChange={(e) => setSignInPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full bg-black border border-white/30 rounded-2xl py-3 pl-11 pr-12 text-xs sm:text-sm text-white placeholder-white/40 focus:outline-none focus:border-white focus:ring-1 focus:ring-white transition-all"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-white/70 hover:text-white cursor-pointer"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4 text-white" /> : <Eye className="w-4 h-4 text-white" />}
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full py-3.5 px-4 rounded-2xl font-black text-xs sm:text-sm shadow-xl transition-all flex items-center justify-center gap-2 active:scale-[0.98] cursor-pointer disabled:opacity-50 bg-black hover:bg-neutral-900 text-white border-2 border-white shadow-black/80 ring-1 ring-white/20"
                  >
                    {isLoading ? (
                      <span className="flex items-center gap-2 text-white">
                        <span className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                        <span className="text-white">Authenticating...</span>
                      </span>
                    ) : (
                      <>
                        <span className="text-white">Sign In to {selectedRole.charAt(0).toUpperCase() + selectedRole.slice(1)} Dashboard</span>
                        <ArrowRight className="w-4 h-4 text-white stroke-[2.5]" />
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
                        <label className="block text-xs font-bold text-white uppercase tracking-wider mb-1.5">Full Name</label>
                        <input
                          type="text"
                          required
                          value={psgName}
                          onChange={(e) => setPsgName(e.target.value)}
                          placeholder="Hemant Kashyap"
                          className="w-full bg-black border border-white/30 rounded-2xl py-2.5 px-4 text-xs sm:text-sm text-white placeholder-white/40 focus:outline-none focus:border-white focus:ring-1 focus:ring-white"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-white uppercase tracking-wider mb-1.5">Email Address</label>
                        <input
                          type="email"
                          required
                          value={psgEmail}
                          onChange={(e) => setPsgEmail(e.target.value)}
                          placeholder="passenger@motoride.com"
                          className="w-full bg-black border border-white/30 rounded-2xl py-2.5 px-4 text-xs sm:text-sm text-white placeholder-white/40 focus:outline-none focus:border-white focus:ring-1 focus:ring-white"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-white uppercase tracking-wider mb-1.5">Phone Number</label>
                        <input
                          type="tel"
                          required
                          value={psgPhone}
                          onChange={(e) => setPsgPhone(e.target.value)}
                          placeholder="+91 98765 43210"
                          className="w-full bg-black border border-white/30 rounded-2xl py-2.5 px-4 text-xs sm:text-sm text-white placeholder-white/40 focus:outline-none focus:border-white focus:ring-1 focus:ring-white"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-white uppercase tracking-wider mb-1.5">Password</label>
                        <input
                          type="password"
                          required
                          value={psgPassword}
                          onChange={(e) => setPsgPassword(e.target.value)}
                          placeholder="Create password"
                          className="w-full bg-black border border-white/30 rounded-2xl py-2.5 px-4 text-xs sm:text-sm text-white placeholder-white/40 focus:outline-none focus:border-white focus:ring-1 focus:ring-white"
                        />
                      </div>
                    </>
                  )}

                  {selectedRole === 'captain' && (
                    <>
                      <div>
                        <label className="block text-xs font-bold text-white uppercase tracking-wider mb-1.5">Captain Full Name</label>
                        <input
                          type="text"
                          required
                          value={cptName}
                          onChange={(e) => setCptName(e.target.value)}
                          placeholder="Captain Vikram Singh"
                          className="w-full bg-black border border-white/30 rounded-2xl py-2.5 px-4 text-xs sm:text-sm text-white placeholder-white/40 focus:outline-none focus:border-white focus:ring-1 focus:ring-white"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-white uppercase tracking-wider mb-1.5">Email Address</label>
                        <input
                          type="email"
                          required
                          value={cptEmail}
                          onChange={(e) => setCptEmail(e.target.value)}
                          placeholder="captain@motoride.com"
                          className="w-full bg-black border border-white/30 rounded-2xl py-2.5 px-4 text-xs sm:text-sm text-white placeholder-white/40 focus:outline-none focus:border-white focus:ring-1 focus:ring-white"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-xs font-bold text-white uppercase tracking-wider mb-1.5">Vehicle Model</label>
                          <input
                            type="text"
                            required
                            value={cptVehicleModel}
                            onChange={(e) => setCptVehicleModel(e.target.value)}
                            placeholder="Honda Activa"
                            className="w-full bg-black border border-white/30 rounded-2xl py-2.5 px-4 text-xs text-white placeholder-white/40 focus:outline-none focus:border-white focus:ring-1 focus:ring-white"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-white uppercase tracking-wider mb-1.5">Plate Number</label>
                          <input
                            type="text"
                            required
                            value={cptPlateNumber}
                            onChange={(e) => setCptPlateNumber(e.target.value)}
                            placeholder="PB65AA1257"
                            className="w-full bg-black border border-white/30 rounded-2xl py-2.5 px-4 text-xs text-white placeholder-white/40 uppercase focus:outline-none focus:border-white focus:ring-1 focus:ring-white"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-white uppercase tracking-wider mb-1.5">Password</label>
                        <input
                          type="password"
                          required
                          value={cptPassword}
                          onChange={(e) => setCptPassword(e.target.value)}
                          placeholder="Create password"
                          className="w-full bg-black border border-white/30 rounded-2xl py-2.5 px-4 text-xs sm:text-sm text-white placeholder-white/40 focus:outline-none focus:border-white focus:ring-1 focus:ring-white"
                        />
                      </div>
                    </>
                  )}

                  {selectedRole === 'admin' && (
                    <>
                      <div>
                        <label className="block text-xs font-bold text-white uppercase tracking-wider mb-1.5">Admin Manager Name</label>
                        <input
                          type="text"
                          required
                          value={admName}
                          onChange={(e) => setAdmName(e.target.value)}
                          placeholder="Admin Manager"
                          className="w-full bg-black border border-white/30 rounded-2xl py-2.5 px-4 text-xs sm:text-sm text-white placeholder-white/40 focus:outline-none focus:border-white focus:ring-1 focus:ring-white"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-white uppercase tracking-wider mb-1.5">Admin Email</label>
                        <input
                          type="email"
                          required
                          value={admEmail}
                          onChange={(e) => setAdmEmail(e.target.value)}
                          placeholder="admin@motoride.com"
                          className="w-full bg-black border border-white/30 rounded-2xl py-2.5 px-4 text-xs sm:text-sm text-white placeholder-white/40 focus:outline-none focus:border-white focus:ring-1 focus:ring-white"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-white uppercase tracking-wider mb-1.5">Password</label>
                        <input
                          type="password"
                          required
                          value={admPassword}
                          onChange={(e) => setAdmPassword(e.target.value)}
                          placeholder="Create password"
                          className="w-full bg-black border border-white/30 rounded-2xl py-2.5 px-4 text-xs sm:text-sm text-white placeholder-white/40 focus:outline-none focus:border-white focus:ring-1 focus:ring-white"
                        />
                      </div>
                    </>
                  )}

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full py-3.5 px-4 rounded-2xl font-black text-xs sm:text-sm shadow-xl transition-all flex items-center justify-center gap-2 active:scale-[0.98] cursor-pointer disabled:opacity-50 bg-black hover:bg-neutral-900 text-white border-2 border-white shadow-black/80 ring-1 ring-white/20"
                  >
                    {isLoading ? (
                      <span className="flex items-center gap-2 text-white">
                        <span className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                        <span className="text-white">Registering...</span>
                      </span>
                    ) : (
                      <>
                        <span className="text-white">Create {selectedRole.charAt(0).toUpperCase() + selectedRole.slice(1)} Account</span>
                        <ArrowRight className="w-4 h-4 text-white stroke-[2.5]" />
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
      <footer className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 py-6 text-center border-t border-white/20 text-xs text-white bg-black">
        MotoRide Mobility Platform &copy; {new Date().getFullYear()} •{' '}
        <button
          type="button"
          onClick={() => {
            const adminUser = DEMO_USERS['admin'];
            supabaseAuth.setCurrentUser(adminUser);
            onAuthenticated(adminUser);
          }}
          className="text-white hover:underline font-bold cursor-pointer"
          title="Sign in as Admin Manager"
        >
          Secure Real-Time
        </button>{' '}
        Dispatch
      </footer>
    </div>
  );
};
