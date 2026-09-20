import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  User,
  Phone,
  Mail,
  ShieldCheck,
  Star,
  Bike,
  Award,
  TrendingUp,
  CreditCard,
  FileText,
  Clock,
  Settings,
  Bell,
  Lock,
  ChevronRight,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  LogOut,
  Edit2,
  Save,
  Share2,
  Camera,
  Upload,
  Trash2,
  Gauge,
  Compass,
  MapPin,
  Power,
  Volume2,
  Sun,
  IndianRupee,
  History,
  Download,
  Smartphone,
} from 'lucide-react';
import { Captain } from '../types/motoride';
import { safeStorage } from '../lib/safeStorage';

interface CaptainProfileDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  captain: Captain | null;
  todayIncome?: number;
  onUpdateCaptain?: (updated: Partial<Captain>) => void;
  onOpenWallet?: () => void;
  onOpenRideHistory?: () => void;
  onSignOut?: () => void;
}

export const CaptainProfileDrawer: React.FC<CaptainProfileDrawerProps> = ({
  isOpen,
  onClose,
  captain,
  todayIncome = 0,
  onUpdateCaptain,
  onOpenWallet,
  onOpenRideHistory,
  onSignOut,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(() => safeStorage.getItem('motoride_captain_name') || captain?.full_name || 'Captain');
  const [phone, setPhone] = useState(() => safeStorage.getItem('motoride_captain_phone') || captain?.phone || '');
  const [email, setEmail] = useState(() => safeStorage.getItem('motoride_captain_email') || captain?.email || '');
  const [vehicleModel, setVehicleModel] = useState(() => safeStorage.getItem('motoride_captain_vehicle_model') || captain?.vehicle?.model || 'Motorcycle');
  const [plateNumber, setPlateNumber] = useState(() => safeStorage.getItem('motoride_captain_plate') || captain?.vehicle?.plate_number || '');
  const [drivingLicense, setDrivingLicense] = useState(() => safeStorage.getItem('motoride_captain_dl') || (captain as any)?.license_number || '');
  const [emergencyContact, setEmergencyContact] = useState(() => safeStorage.getItem('motoride_captain_sos') || (captain as any)?.emergency_contact || captain?.phone || '');
  const [isSavedToast, setIsSavedToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('Captain profile saved successfully!');
  
  // Captain Preferences
  const [autoAccept, setAutoAccept] = useState(false);
  const [highAccuracyGps, setHighAccuracyGps] = useState(true);
  const [audioAlerts, setAudioAlerts] = useState(true);
  const [doNotScreenOff, setDoNotScreenOff] = useState<boolean>(() => {
    try {
      const saved = safeStorage.getItem('motoride_captain_do_not_screen_off');
      return saved !== null ? saved === 'true' : true;
    } catch {
      return true;
    }
  });

  // Screen Wake Lock Sentinel Reference
  const wakeLockRef = useRef<any>(null);

  // Maintain Screen Wake Lock when doNotScreenOff is enabled
  useEffect(() => {
    let isMounted = true;

    const requestWakeLock = async () => {
      if (!doNotScreenOff) {
        if (wakeLockRef.current) {
          try {
            await wakeLockRef.current.release();
          } catch (e) {
            // ignore
          }
          wakeLockRef.current = null;
        }
        return;
      }

      if ('wakeLock' in navigator && (navigator as any).wakeLock) {
        try {
          if (!wakeLockRef.current) {
            const lock = await (navigator as any).wakeLock.request('screen');
            if (isMounted) {
              wakeLockRef.current = lock;
              lock.addEventListener('release', () => {
                wakeLockRef.current = null;
              });
            } else {
              lock.release();
            }
          }
        } catch (err: any) {
          console.warn('Wake Lock request notice:', err?.message);
        }
      }
    };

    requestWakeLock();

    // Re-acquire wake lock on tab visibility change
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && doNotScreenOff) {
        requestWakeLock();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      isMounted = false;
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (wakeLockRef.current) {
        try {
          wakeLockRef.current.release();
        } catch (e) {
          // ignore
        }
        wakeLockRef.current = null;
      }
    };
  }, [doNotScreenOff]);

  const handleToggleDoNotScreenOff = () => {
    const nextState = !doNotScreenOff;
    setDoNotScreenOff(nextState);
    try {
      localStorage.setItem('motoride_captain_do_not_screen_off', String(nextState));
    } catch (e) {
      console.warn(e);
    }
    setToastMessage(nextState ? 'Screen will stay awake during rides' : 'Screen sleep timeout restored');
    setIsSavedToast(true);
    setTimeout(() => setIsSavedToast(false), 2500);
  };

  // Captain Avatar Photo (Stored in state & safeStorage)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(() => {
    try {
      return safeStorage.getItem('motoride_captain_avatar') || null;
    } catch {
      return null;
    }
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync prop changes without overwriting local storage edits
  useEffect(() => {
    if (captain) {
      if (captain.full_name && captain.full_name !== 'Captain' && !safeStorage.getItem('motoride_captain_name')) {
        setName(captain.full_name);
      }
      if (captain.phone && !safeStorage.getItem('motoride_captain_phone')) {
        setPhone(captain.phone);
      }
      if (captain.email && !safeStorage.getItem('motoride_captain_email')) {
        setEmail(captain.email);
      }
      if (captain.vehicle?.model && !safeStorage.getItem('motoride_captain_vehicle_model')) {
        setVehicleModel(captain.vehicle.model);
      }
      if (captain.vehicle?.plate_number && !safeStorage.getItem('motoride_captain_plate')) {
        setPlateNumber(captain.vehicle.plate_number);
      }
    }
  }, [captain]);

  // Handle Photo Upload
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Please upload a valid image file (PNG, JPG, JPEG, WEBP).');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      alert('Image size exceeds 5MB limit. Please choose a smaller photo.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      setAvatarUrl(result);
      try {
        safeStorage.setItem('motoride_captain_avatar', result);
      } catch (err) {
        console.warn('Could not persist captain avatar to safeStorage:', err);
      }
      setToastMessage('Captain profile photo updated!');
      setIsSavedToast(true);
      setTimeout(() => setIsSavedToast(false), 3000);
    };
    reader.readAsDataURL(file);
  };

  const handleRemovePhoto = (e: React.MouseEvent) => {
    e.stopPropagation();
    setAvatarUrl(null);
    try {
      safeStorage.removeItem('motoride_captain_avatar');
    } catch (err) {
      console.warn(err);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    setToastMessage('Profile photo removed.');
    setIsSavedToast(true);
    setTimeout(() => setIsSavedToast(false), 3000);
  };

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      alert('Name cannot be empty.');
      return;
    }
    try {
      safeStorage.setItem('motoride_captain_name', name);
      safeStorage.setItem('motoride_captain_phone', phone);
      safeStorage.setItem('motoride_captain_email', email);
      safeStorage.setItem('motoride_captain_vehicle_model', vehicleModel);
      safeStorage.setItem('motoride_captain_plate', plateNumber);
      safeStorage.setItem('motoride_captain_dl', drivingLicense);
      safeStorage.setItem('motoride_captain_sos', emergencyContact);
    } catch (err) {
      console.warn(err);
    }

    if (onUpdateCaptain) {
      onUpdateCaptain({
        full_name: name,
        phone,
        email,
        vehicle: {
          model: vehicleModel,
          plate_number: plateNumber,
          vehicle_type: captain?.vehicle?.vehicle_type || 'bike',
          color: captain?.vehicle?.color || 'Black',
        },
        license_number: drivingLicense,
        emergency_contact: emergencyContact,
      } as any);
    }
    setIsEditing(false);
    setToastMessage('Captain details updated successfully!');
    setIsSavedToast(true);
    setTimeout(() => setIsSavedToast(false), 3000);
  };

  // Generate Initials
  const getInitials = (str: string) => {
    const parts = str.trim().split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return str.slice(0, 2).toUpperCase() || 'CP';
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[2000] flex animate-in fade-in duration-200">
      {/* Dimmed backdrop */}
      <div
        className="fixed inset-0 bg-black/70 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Hidden File Input for Avatar Upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png, image/jpeg, image/jpg, image/webp"
        className="hidden"
        onChange={handlePhotoUpload}
      />

      {/* Slide-in Drawer from Left to Right */}
      <div className="relative w-full max-w-[380px] sm:max-w-[420px] h-full bg-slate-950 text-white shadow-2xl flex flex-col z-10 border-r border-amber-500/20 animate-in slide-in-from-left duration-300">
        
        {/* Drawer Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/15 bg-black/70 backdrop-blur-md">
          <div className="flex items-center gap-2.5">
            <div className="w-3 h-3 rounded-full bg-amber-400 animate-pulse" />
            <span className="font-black text-base tracking-tight text-white flex items-center gap-2">
              <Bike className="w-5 h-5 text-amber-400" />
              <span>Captain Profile</span>
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-all active:scale-95 cursor-pointer"
            title="Close Profile"
            aria-label="Close Profile"
          >
            <X className="w-5 h-5 stroke-[2.5]" />
          </button>
        </div>

        {/* Toast alert when profile updated */}
        {isSavedToast && (
          <div className="mx-4 mt-3 p-3 rounded-2xl bg-amber-950/90 border border-amber-500/50 text-amber-200 text-xs flex items-center gap-2 animate-in fade-in duration-200 shadow-lg">
            <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0" />
            <span className="font-semibold">{toastMessage}</span>
          </div>
        )}

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 flex flex-col gap-4 scrollbar-thin">
          
          {/* SECTION: Profile Overview & Round Photo Upload Card */}
          <div className="p-4 sm:p-5 rounded-3xl bg-gradient-to-br from-slate-900 via-slate-900 to-black border border-amber-500/30 flex flex-col gap-4 shadow-2xl relative">
            
            {/* Top Row: Round Avatar with Camera Upload Action + Details */}
            <div className="flex items-center gap-4">
              
              {/* Round Profile Picture with Upload Action */}
              <div className="relative group shrink-0">
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="w-20 h-20 rounded-full bg-gradient-to-tr from-amber-500 to-amber-600 text-slate-950 flex items-center justify-center font-black text-2xl shadow-xl overflow-hidden cursor-pointer border-2 border-amber-400/80 ring-4 ring-black/40 group-hover:scale-105 transition-transform"
                  title="Click to upload/change captain round profile picture"
                >
                  {avatarUrl ? (
                    <img
                      src={avatarUrl}
                      alt={name}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span>{getInitials(name)}</span>
                  )}
                  
                  {/* Hover Upload Overlay */}
                  <div className="absolute inset-0 bg-black/60 rounded-full flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-white text-[9px] font-bold gap-0.5">
                    <Camera className="w-5 h-5 text-amber-400" />
                    <span>Upload</span>
                  </div>
                </div>

                {/* Round Camera Upload Button Icon on Bottom-Right */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    fileInputRef.current?.click();
                  }}
                  title="Upload Captain Photo"
                  aria-label="Upload Captain Photo"
                  className="absolute -bottom-1 -right-1 p-1.5 rounded-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-black shadow-md border-2 border-slate-950 cursor-pointer active:scale-90 transition-transform flex items-center justify-center"
                >
                  <Camera className="w-3.5 h-3.5 stroke-[2.5]" />
                </button>
              </div>

              {/* Name, Verified Shield Badge & Quick Rating */}
              <div className="flex flex-col min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <h3 className="font-black text-lg text-white truncate leading-tight">
                    {name}
                  </h3>
                  <span title="Government & Police Verified Captain" className="inline-flex">
                    <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                  </span>
                </div>
                
                {/* Vehicle Badge */}
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="text-[10px] px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30">
                    {vehicleModel}
                  </span>
                  <span className="text-[10px] font-mono-num font-bold text-slate-400">
                    {plateNumber}
                  </span>
                </div>

                {/* Upload action prompt */}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="mt-2 text-[11px] text-amber-400 hover:text-amber-300 font-bold flex items-center gap-1.5 text-left cursor-pointer group/btn"
                >
                  <Upload className="w-3 h-3 group-hover/btn:-translate-y-0.5 transition-transform" />
                  <span>{avatarUrl ? 'Change Photo' : 'Upload Profile Photo'}</span>
                </button>
                {avatarUrl && (
                  <button
                    type="button"
                    onClick={handleRemovePhoto}
                    className="mt-0.5 text-[10px] text-rose-400 hover:text-rose-300 flex items-center gap-1 cursor-pointer"
                  >
                    <Trash2 className="w-2.5 h-2.5" />
                    <span>Remove Photo</span>
                  </button>
                )}
              </div>
            </div>

            {/* Middle Row inside Overview Card: Today's Income */}
            <div className="pt-3 border-t border-white/10">
              <div className="p-3 rounded-2xl bg-amber-500/15 border border-amber-500/40 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center font-black shrink-0 shadow-sm">
                    <IndianRupee className="w-4 h-4 stroke-[2.5]" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] text-amber-300 font-bold uppercase tracking-wider">
                      Today's Income
                    </span>
                    <span className="font-black text-base text-amber-400 font-mono-num">
                      ₹{todayIncome.toLocaleString('en-IN')}
                    </span>
                  </div>
                </div>
                <span className="text-[10px] text-slate-400 font-medium bg-black/30 px-2 py-1 rounded-lg border border-white/10">
                  Resets at 12 AM
                </span>
              </div>
            </div>

            {/* Bottom Row inside Overview Card: Rating & Total Rides */}
            <div className="grid grid-cols-2 gap-2 pt-3 border-t border-white/10">
              
              {/* Rating Card */}
              <div className="p-2.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center font-black shrink-0 shadow-sm">
                  <Star className="w-4 h-4 fill-slate-950 text-slate-950" />
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] text-amber-300/80 font-bold uppercase tracking-wider">Rating</span>
                  <div className="flex items-baseline gap-1">
                    <span className="font-black text-sm text-amber-400 font-mono-num">
                      {captain?.rating !== undefined && captain?.rating !== null ? captain.rating : 5.0}
                    </span>
                    <span className="text-[10px] text-slate-400">/ 5.0</span>
                  </div>
                </div>
              </div>

              {/* Rides Taken Card - Clickable to open Trip History */}
              <div
                onClick={() => {
                  if (onOpenRideHistory) {
                    onClose();
                    onOpenRideHistory();
                  }
                }}
                className="p-2.5 rounded-2xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 flex items-center gap-2.5 cursor-pointer transition-all active:scale-95 group"
                title="View Trip History"
              >
                <div className="w-8 h-8 rounded-xl bg-emerald-500 text-slate-950 flex items-center justify-center font-black shrink-0 shadow-sm group-hover:scale-105 transition-transform">
                  <TrendingUp className="w-4 h-4 stroke-[2.5]" />
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] text-emerald-300/80 font-bold uppercase tracking-wider group-hover:text-emerald-300 transition-colors flex items-center gap-0.5">
                    <span>Total Rides</span>
                    <ChevronRight className="w-3 h-3 text-emerald-400" />
                  </span>
                  <div className="flex items-baseline gap-1">
                    <span className="font-black text-sm text-emerald-400 font-mono-num">
                      {captain?.total_rides ?? 0}
                    </span>
                    <span className="text-[10px] text-slate-400">trips</span>
                  </div>
                </div>
              </div>

            </div>

            {/* Dedicated Trip & Earnings History Quick Button */}
            <div className="pt-2 border-t border-white/10">
              <button
                type="button"
                onClick={() => {
                  if (onOpenRideHistory) {
                    onClose();
                    onOpenRideHistory();
                  }
                }}
                className="w-full p-3 rounded-2xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 flex items-center justify-between text-left cursor-pointer transition-all active:scale-95 group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center font-black shrink-0 shadow-sm">
                    <History className="w-4 h-4 stroke-[2.5]" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs font-black text-white group-hover:text-amber-300 transition-colors">
                      Trip & Earnings History
                    </span>
                    <span className="text-[10px] text-slate-400">
                      {captain?.total_rides ?? 0} total trips • View route logs & fare records
                    </span>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-amber-400 group-hover:translate-x-0.5 transition-transform" />
              </button>
            </div>

          </div>

          {/* Form (1): Captain Information Form (Name, Phone, Vehicle, License, SOS) */}
          <div className="p-4 sm:p-5 rounded-3xl bg-white/5 border border-white/15 flex flex-col gap-3.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black tracking-wider text-slate-300 uppercase flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-amber-400" />
                <span>Captain Information (Form 1)</span>
              </span>
              <button
                type="button"
                onClick={() => setIsEditing(!isEditing)}
                className="text-xs font-bold text-amber-400 hover:text-amber-300 flex items-center gap-1 px-2.5 py-1 rounded-xl bg-amber-500/10 border border-amber-500/30 cursor-pointer active:scale-95 transition-all"
              >
                {isEditing ? (
                  <>
                    <X className="w-3 h-3" />
                    <span>Cancel</span>
                  </>
                ) : (
                  <>
                    <Edit2 className="w-3 h-3" />
                    <span>Edit Info</span>
                  </>
                )}
              </button>
            </div>

            {isEditing ? (
              <form onSubmit={handleSaveProfile} className="flex flex-col gap-3">
                {/* Editable Full Name */}
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] text-slate-400 font-semibold">Full Name</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    className="w-full px-3 py-2 rounded-xl bg-black/60 border border-white/20 text-white text-xs font-medium focus:outline-none focus:border-amber-400"
                    placeholder="Enter full name"
                  />
                </div>

                {/* Editable Phone */}
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] text-slate-400 font-semibold">Phone Number</label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    required
                    className="w-full px-3 py-2 rounded-xl bg-black/60 border border-white/20 text-white text-xs font-medium focus:outline-none focus:border-amber-400"
                    placeholder="Enter phone number"
                  />
                </div>

                {/* Editable Vehicle Model */}
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] text-slate-400 font-semibold">Vehicle Model</label>
                  <input
                    type="text"
                    value={vehicleModel}
                    onChange={(e) => setVehicleModel(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-black/60 border border-white/20 text-white text-xs font-medium focus:outline-none focus:border-amber-400"
                    placeholder="e.g. Mahindra Centuro"
                  />
                </div>

                {/* Editable Plate Number */}
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] text-slate-400 font-semibold">Registration Plate</label>
                  <input
                    type="text"
                    value={plateNumber}
                    onChange={(e) => setPlateNumber(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-black/60 border border-white/20 text-white text-xs font-medium font-mono-num uppercase focus:outline-none focus:border-amber-400"
                    placeholder="e.g. PB65AA1257"
                  />
                </div>

                {/* Editable Driving License */}
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] text-slate-400 font-semibold">Driving License Number</label>
                  <input
                    type="text"
                    value={drivingLicense}
                    onChange={(e) => setDrivingLicense(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-black/60 border border-white/20 text-white text-xs font-medium font-mono-num uppercase focus:outline-none focus:border-amber-400"
                    placeholder="e.g. DL-0420180098765"
                  />
                </div>

                {/* Editable Emergency SOS Contact */}
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] text-slate-400 font-semibold">Emergency SOS Contact</label>
                  <input
                    type="text"
                    value={emergencyContact}
                    onChange={(e) => setEmergencyContact(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-black/60 border border-white/20 text-white text-xs font-medium focus:outline-none focus:border-amber-400"
                    placeholder="e.g. +91 98111 22334 (Family)"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full mt-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs cursor-pointer active:scale-95 transition-all flex items-center justify-center gap-2 shadow-lg"
                >
                  <Save className="w-3.5 h-3.5 stroke-[2.5]" />
                  <span>Save Changes</span>
                </button>
              </form>
            ) : (
              <div className="flex flex-col gap-2.5">
                {/* Readonly: Name */}
                <div className="flex items-center justify-between p-2.5 rounded-2xl bg-black/40 border border-white/10">
                  <div className="flex items-center gap-2.5 text-slate-300">
                    <User className="w-4 h-4 text-amber-400 shrink-0" />
                    <span className="text-xs font-medium">Captain Name</span>
                  </div>
                  <span className="font-bold text-white text-xs">{name}</span>
                </div>

                {/* Readonly: Phone */}
                <div className="flex items-center justify-between p-2.5 rounded-2xl bg-black/40 border border-white/10">
                  <div className="flex items-center gap-2.5 text-slate-300">
                    <Phone className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span className="text-xs font-medium">Phone</span>
                  </div>
                  <span className="font-bold text-white text-xs font-mono-num">{phone}</span>
                </div>

                {/* Readonly: Vehicle */}
                <div className="flex items-center justify-between p-2.5 rounded-2xl bg-black/40 border border-white/10">
                  <div className="flex items-center gap-2.5 text-slate-300">
                    <Bike className="w-4 h-4 text-cyan-400 shrink-0" />
                    <span className="text-xs font-medium">Vehicle & Plate</span>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="font-bold text-white text-xs">{vehicleModel}</span>
                    <span className="text-[10px] font-mono-num text-amber-300 font-bold">{plateNumber}</span>
                  </div>
                </div>

                {/* Readonly: License */}
                <div className="flex items-center justify-between p-2.5 rounded-2xl bg-black/40 border border-white/10">
                  <div className="flex items-center gap-2.5 text-slate-300">
                    <FileText className="w-4 h-4 text-indigo-400 shrink-0" />
                    <span className="text-xs font-medium">License (DL)</span>
                  </div>
                  <span className="font-bold text-white text-xs font-mono-num">{drivingLicense}</span>
                </div>

                {/* Readonly: Emergency SOS */}
                <div className="flex items-center justify-between p-2.5 rounded-2xl bg-rose-950/40 border border-rose-500/30">
                  <div className="flex items-center gap-2.5 text-rose-200">
                    <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                    <div className="flex flex-col">
                      <span className="text-[10px] text-rose-300 font-semibold">Emergency SOS</span>
                      <span className="font-bold text-xs">{emergencyContact}</span>
                    </div>
                  </div>
                </div>

              </div>
            )}
          </div>

          {/* Captain Operational Settings */}
          <div className="p-4 rounded-3xl bg-white/5 border border-white/15 flex flex-col gap-2.5">
            <span className="text-xs font-black tracking-wider text-slate-300 uppercase flex items-center gap-1.5">
              <Settings className="w-3.5 h-3.5 text-amber-400" />
              <span>Operational Controls</span>
            </span>
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between p-3 rounded-2xl bg-black/40 border border-white/10">
                <div className="flex flex-col pr-2">
                  <span className="text-xs font-bold text-white">Auto-Accept Nearby Rides</span>
                  <span className="text-[10px] text-slate-400">Instantly accept rides within 2 km radius</span>
                </div>
                <button
                  type="button"
                  onClick={() => setAutoAccept(!autoAccept)}
                  className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
                    autoAccept ? 'bg-amber-500' : 'bg-slate-800'
                  }`}
                >
                  <span
                    className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform ${
                      autoAccept ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              <div className="flex items-center justify-between p-3 rounded-2xl bg-black/40 border border-white/10">
                <div className="flex flex-col pr-2">
                  <span className="text-xs font-bold text-white">High Precision GPS</span>
                  <span className="text-[10px] text-slate-400">Send real-time 1s GPS updates to passenger</span>
                </div>
                <button
                  type="button"
                  onClick={() => setHighAccuracyGps(!highAccuracyGps)}
                  className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
                    highAccuracyGps ? 'bg-emerald-500' : 'bg-slate-800'
                  }`}
                >
                  <span
                    className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform ${
                      highAccuracyGps ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              <div className="flex items-center justify-between p-3 rounded-2xl bg-black/40 border border-white/10">
                <div className="flex flex-col pr-2">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-white">Do Not Screen Off</span>
                    <span
                      className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border transition-all ${
                        doNotScreenOff
                          ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                          : 'bg-slate-800 text-slate-400 border-slate-700'
                      }`}
                    >
                      {doNotScreenOff ? 'AWAKE' : 'OFF'}
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-400">Keep screen awake while waiting or during active rides</span>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={doNotScreenOff}
                  onClick={handleToggleDoNotScreenOff}
                  className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
                    doNotScreenOff ? 'bg-amber-500' : 'bg-slate-800'
                  }`}
                  title={doNotScreenOff ? 'Screen stay awake is enabled' : 'Screen stay awake is disabled'}
                >
                  <span
                    className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform ${
                      doNotScreenOff ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              <div className="flex items-center justify-between p-3 rounded-2xl bg-black/40 border border-white/10">
                <div className="flex flex-col pr-2">
                  <span className="text-xs font-bold text-white">Ride Request Chime</span>
                  <span className="text-[10px] text-slate-400">Play audio alert on incoming passenger offers</span>
                </div>
                <button
                  type="button"
                  onClick={() => setAudioAlerts(!audioAlerts)}
                  className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
                    audioAlerts ? 'bg-amber-500' : 'bg-slate-800'
                  }`}
                >
                  <span
                    className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform ${
                      audioAlerts ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </div>
          </div>

          {/* Verification & Compliance Status */}
          <div className="p-4 rounded-3xl bg-white/5 border border-white/15 flex flex-col gap-2.5">
            <span className="text-xs font-black tracking-wider text-slate-300 uppercase flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>Documents & Compliance</span>
            </span>
            <div className="grid grid-cols-3 gap-2">
              <div className="p-2.5 rounded-2xl bg-black/40 border border-emerald-500/30 flex flex-col items-center text-center">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 mb-1" />
                <span className="text-[10px] text-slate-300 font-bold">Driving License</span>
                <span className="text-[9px] text-emerald-400 font-semibold">Active</span>
              </div>
              <div className="p-2.5 rounded-2xl bg-black/40 border border-emerald-500/30 flex flex-col items-center text-center">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 mb-1" />
                <span className="text-[10px] text-slate-300 font-bold">Vehicle RC</span>
                <span className="text-[9px] text-emerald-400 font-semibold">Verified</span>
              </div>
              <div className="p-2.5 rounded-2xl bg-black/40 border border-emerald-500/30 flex flex-col items-center text-center">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 mb-1" />
                <span className="text-[10px] text-slate-300 font-bold">Insurance</span>
                <span className="text-[9px] text-emerald-400 font-semibold">Valid 2027</span>
              </div>
            </div>
          </div>

          {/* Support Helpline */}
          <div className="p-4 rounded-3xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold">
                <HelpCircle className="w-5 h-5" />
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-bold text-white">Captain Partner Support</span>
                <span className="text-[10px] text-slate-400 font-mono-num">24x7 Priority Desk: 1800-MOTORIDE</span>
              </div>
            </div>
          </div>


        </div>

        {/* Footer */}
        <div className="p-4 border-t border-white/10 bg-black/60 backdrop-blur-md flex items-center justify-between text-xs text-slate-400">
          <div className="flex flex-col">
            <span className="font-bold text-white">Motoride Captain Partner v2.4</span>
          </div>
          <button
            type="button"
            onClick={() => {
              if (onSignOut) {
                onClose();
                onSignOut();
              } else {
                window.location.reload();
              }
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 hover:text-rose-200 border border-rose-500/30 text-xs font-bold transition-all cursor-pointer active:scale-95"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>

      </div>
    </div>
  );
};
