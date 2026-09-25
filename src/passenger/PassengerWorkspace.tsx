import React, { useState, useEffect, useRef } from 'react';
import {
  MotorideRide,
  RideOffer,
  RideTypeCode,
  FareSettings,
} from '../types/motoride';
import { MotorideMap, AvailableCaptainItem } from '../components/common/MotorideMap';
import { RideChatModal } from '../components/common/RideChatModal';
import { PassengerProfileDrawer } from './PassengerProfileDrawer';
import { DigitalWatchETA } from './DigitalWatchETA';
import { PassengerCaptainRatingModal } from './PassengerCaptainRatingModal';
import { motorideApi } from '../services/motorideApi';
import { realtimeSync } from '../services/realtimeSync';
import { calculateBearingDegrees, calculateRoadDistanceKm, fetchRouteRoadDistance } from '../utils/distanceCalculator';
import { safeStorage } from '../lib/safeStorage';
import {
  MapPin,
  Navigation,
  Bike,
  Car,
  Package,
  Clock,
  IndianRupee,
  Phone,
  ShieldCheck,
  Star,
  CheckCircle2,
  Check,
  XCircle,
  AlertTriangle,
  AlertCircle,
  LocateFixed,
  Radio,
  RotateCcw,
  Sparkles,
  Search,
  MessageSquare,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Send,
  Eye,
  EyeOff,
  Minimize2,
  Maximize2,
  LayoutGrid,
  Map as MapIcon,
  X,
  PenLine,
  List,
  Loader2,
  ArrowLeft,
  History,
  TrendingUp,
} from 'lucide-react';

import { AuthUser, supabaseAuth } from '../lib/supabaseAuth';
import { MotorideRideHistoryModal } from '../components/MotorideRideHistoryModal';
import { getApiUrl } from '../utils/apiUrl';

interface PassengerWorkspaceProps {
  currentPassengerId?: string;
  passengerName?: string;
  currentUser?: AuthUser | null;
  onOpenWallet?: () => void;
  onSignOut?: () => void;
}

const PRESET_LOCATIONS = [
  { name: 'Teleperformance, Sector 75, Mohali', lat: 30.701124, lng: 76.702514 },
  { name: 'Infosys Limited, IT Park, Chandigarh', lat: 30.728514, lng: 76.843124 },
  { name: 'Kishangarh Village, Chandigarh', lat: 30.732514, lng: 76.818514 },
  { name: 'Savitri Greens, Gazipur Road, Zirakpur', lat: 30.632514, lng: 76.834124 },
  { name: 'Maya Garden City, Gazipur Road, Zirakpur', lat: 30.635514, lng: 76.838514 },
  { name: 'Platinum Homes, Old Ambala Road, Zirakpur', lat: 30.651514, lng: 76.848514 },
  { name: 'Mani Majra & Rajiv Gandhi IT Park Whole Area', lat: 30.724514, lng: 76.841514 },
  { name: 'Sector 70, Mohali Market', lat: 30.704649, lng: 76.717873 },
  { name: 'Phase 8B, Industrial & Tech Park', lat: 30.718214, lng: 76.732124 },
  { name: 'Elante Mall, Phase 1', lat: 30.705514, lng: 76.801124 },
];

const KNOWN_LOCATIONS: { name: string; aliases: string[]; lat: number; lng: number }[] = [
  // Custom Requested Locations
  { name: 'Teleperformance, Sector 75, Mohali', aliases: ['teleperformance', 'tele performance', 'sector 75 teleperformance', 'teleperformance mohali', '75 teleperformance', 'teleperformance 75'], lat: 30.701124, lng: 76.702514 },
  { name: 'Infosys Limited, IT Park, Chandigarh', aliases: ['infosys', 'infosys it park', 'infosys chandigarh', 'infosys limited'], lat: 30.728514, lng: 76.843124 },
  { name: 'Kishangarh Village, Chandigarh', aliases: ['kishangarh', 'kishangarh village', 'kishan garh', 'kishangarh chd'], lat: 30.732514, lng: 76.818514 },
  { name: 'Savitri Greens, Gazipur Road, Zirakpur', aliases: ['savitri greens', 'savitri greens zirakpur', 'savitri greens gazipur', 'gazipur road savitri'], lat: 30.632514, lng: 76.834124 },
  { name: 'Savitri Greens 2, Gazipur Road, Zirakpur', aliases: ['savitri greens 2', 'savitri 2 zirakpur'], lat: 30.628514, lng: 76.836514 },
  { name: 'Maya Garden City, Gazipur Road, Zirakpur', aliases: ['maya garden', 'maya garden city', 'maya garden zirakpur', 'maya garden gazipur', 'gazipur road maya garden'], lat: 30.635514, lng: 76.838514 },
  { name: 'Maya Garden Magnesia, Gazipur Road, Zirakpur', aliases: ['maya garden magnesia', 'magnesia zirakpur'], lat: 30.631214, lng: 76.841514 },
  { name: 'Maya Garden Avenue, Gazipur Road, Zirakpur', aliases: ['maya garden avenue', 'maya avenue zirakpur'], lat: 30.634124, lng: 76.839124 },
  { name: 'Platinum Homes, Old Ambala Road, Zirakpur', aliases: ['platinum homes', 'platinum homes zirakpur', 'platinum homes old ambala road', 'old ambala road platinum'], lat: 30.651514, lng: 76.848514 },
  { name: 'Mani Majra & Rajiv Gandhi IT Park Whole Area', aliases: ['manimajra', 'mani majra', 'it park manimajra', 'manimajra it park', 'rajiv gandhi it park'], lat: 30.724514, lng: 76.841514 },
  { name: 'Cosmo Mall, Zirakpur', aliases: ['cosmo mall', 'cosmo zirakpur', 'mall in zirakpur', 'cosmo mall zirakpur'], lat: 30.645514, lng: 76.822124 },
  { name: 'Paras Downtown Square Mall, Zirakpur', aliases: ['paras mall', 'paras downtown', 'downtown square zirakpur'], lat: 30.648214, lng: 76.819514 },
  { name: 'Global Mall, Zirakpur', aliases: ['global mall', 'global zirakpur'], lat: 30.639514, lng: 76.824514 },

  // Mohali Sectors & Landmarks (Punjab)
  { name: 'Sector 70, Mohali Market', aliases: ['70', 'sector 70', 'mohali 70', 'mattaur', 'sec 70', 'sec 70 mohali', 'sector 70 mohali'], lat: 30.704649, lng: 76.717873 },
  { name: 'Phase 8B, Industrial & Tech Park', aliases: ['8b', 'phase 8b', 'industrial area 8b', 'cp67', 'phase 8b mohali'], lat: 30.718214, lng: 76.732124 },
  { name: 'Phase 7, Mohali Food Street', aliases: ['phase 7', '7 phase', 'mohali 7', 'phase 7 mohali', 'sec 61 mohali'], lat: 30.710412, lng: 76.721415 },
  { name: 'Phase 3B2 Market, Mohali', aliases: ['3b2', 'phase 3b2', '3b-2', '3b 2', 'phase 3b2 mohali'], lat: 30.718912, lng: 76.711245 },
  { name: 'Phase 5 Market, Mohali', aliases: ['phase 5', '5 phase', 'mohali 5', 'phase 5 mohali'], lat: 30.722415, lng: 76.718214 },
  { name: 'Phase 8, Industrial Area Mohali', aliases: ['phase 8', '8 phase', 'bestech', 'phase 8 mohali'], lat: 30.712314, lng: 76.729124 },
  { name: 'Phase 9, Mohali Hockey Stadium', aliases: ['phase 9', '9 phase', 'pca stadium', 'phase 9 mohali'], lat: 30.697514, lng: 76.738124 },
  { name: 'Phase 10, Mohali Market', aliases: ['phase 10', '10 phase', 'silvi park', 'phase 10 mohali'], lat: 30.691214, lng: 76.731124 },
  { name: 'Phase 11, Mohali Railway Crossing', aliases: ['phase 11', '11 phase', 'phase 11 mohali'], lat: 30.684514, lng: 76.724124 },
  { name: 'Sector 62, Phase 8 Mohali City Center', aliases: ['sector 62', 'phase 8 city center', 'puda bhawan', 'sec 62 mohali'], lat: 30.705892, lng: 76.726418 },
  { name: 'Sector 66, Mohali Bawa White House', aliases: ['sector 66', 'sec 66', '66 mohali', 'bestech mall sector 66'], lat: 30.690514, lng: 76.736124 },
  { name: 'Sector 67, Mohali Tech Zone', aliases: ['sector 67', 'sec 67', '67 mohali', 'cp 67 mall'], lat: 30.695214, lng: 76.718912 },
  { name: 'Sector 68, Kumbra Mohali', aliases: ['sector 68', 'sec 68', '68 mohali', 'kumbra'], lat: 30.699814, lng: 76.714512 },
  { name: 'Sector 69, Mohali', aliases: ['sector 69', 'sec 69', '69 mohali'], lat: 30.704214, lng: 76.710514 },
  { name: 'Sector 71, Mohali Residential Hub', aliases: ['sector 71', 'sec 71', '71 mohali', 'sohana', 'ivt hospital'], lat: 30.708914, lng: 76.709214 },
  { name: 'Sector 76, Mohali Administrative Hub', aliases: ['sector 76', 'sec 76', '76 mohali', 'dc office mohali'], lat: 30.687514, lng: 76.708514 },
  { name: 'Sector 77, Mohali', aliases: ['sector 77', 'sec 77', '77 mohali'], lat: 30.682514, lng: 76.714514 },
  { name: 'Sector 78, Mohali Sports Complex', aliases: ['sector 78', 'sec 78', '78 mohali'], lat: 30.678514, lng: 76.721514 },
  { name: 'Sector 79, Mohali Commercial Center', aliases: ['sector 79', 'sec 79', '79 mohali'], lat: 30.674514, lng: 76.728514 },
  { name: 'Sector 80, Mohali', aliases: ['sector 80', 'sec 80', '80 mohali'], lat: 30.670514, lng: 76.735514 },
  { name: 'Sector 82, Mohali IT City Hub', aliases: ['sector 82', 'sec 82', '82 mohali', 'it city mohali', 'jlpl'], lat: 30.665514, lng: 76.745514 },
  { name: 'Fortis Hospital, Phase 8 Mohali', aliases: ['fortis', 'fortis hospital', 'fortis mohali'], lat: 30.712514, lng: 76.734124 },
  { name: 'Max Super Speciality Hospital, Phase 6', aliases: ['max', 'max hospital', 'phase 6 mohali'], lat: 30.732145, lng: 76.708234 },
  { name: 'VR Punjab Mall, Kharar Road', aliases: ['vr punjab', 'north country mall', 'kharar road'], lat: 30.748231, lng: 76.689241 },
  { name: 'Kharar Bus Stand, NH 21', aliases: ['kharar', 'kharar bus stand'], lat: 30.745124, lng: 76.648214 },
  { name: 'Shaheed Bhagat Singh Int. Airport Mohali', aliases: ['airport', 'chandigarh airport', 'mohali airport', 'ixc', 'airport terminal'], lat: 30.673523, lng: 76.788544 },

  // Panchkula Sectors & Landmarks (Haryana)
  { name: 'Sector 7 Panchkula, Market & Housing Board', aliases: ['sector 7 panchkula', 'panchkula 7', 'sec 7 panchkula', '7 panchkula', 'sector 7 pkl', 'sec 7 pkl', 'panchkula sec 7', 'panchkula sector 7'], lat: 30.706433, lng: 76.845153 },
  { name: 'Sector 5 Panchkula, Town Park & HUDA', aliases: ['panchkula 5', 'sector 5 panchkula', 'town park', 'sec 5 panchkula', '5 panchkula', 'panchkula 5', 'huda sector 5'], lat: 30.697514, lng: 76.855124 },
  { name: 'Sector 6 Panchkula, Civil Hospital', aliases: ['sector 6 panchkula', 'panchkula 6', 'sec 6 panchkula', '6 panchkula', 'civil hospital panchkula'], lat: 30.712214, lng: 76.852514 },
  { name: 'Sector 8 Panchkula Market', aliases: ['sector 8 panchkula', 'panchkula 8', 'sec 8 panchkula', '8 panchkula'], lat: 30.699814, lng: 76.848814 },
  { name: 'Sector 9 Panchkula Market', aliases: ['sector 9 panchkula', 'panchkula 9', 'sec 9 panchkula', '9 panchkula'], lat: 30.708814, lng: 76.859814 },
  { name: 'Sector 10 Panchkula Market', aliases: ['sector 10 panchkula', 'panchkula 10', 'sec 10 panchkula', '10 panchkula'], lat: 30.693514, lng: 76.858514 },
  { name: 'Sector 11 Panchkula Market', aliases: ['panchkula 11', 'sector 11 panchkula', 'sec 11 panchkula', '11 panchkula'], lat: 30.689514, lng: 76.861124 },
  { name: 'Sector 12 Panchkula, Rally Stadium', aliases: ['sector 12 panchkula', 'panchkula 12', 'sec 12 panchkula', '12 panchkula'], lat: 30.684514, lng: 76.852514 },
  { name: 'Sector 12A Panchkula', aliases: ['sector 12a panchkula', 'panchkula 12a', 'sec 12a panchkula', '12a panchkula'], lat: 30.688514, lng: 76.846514 },
  { name: 'Sector 14 Panchkula, Govt College', aliases: ['sector 14 panchkula', 'panchkula 14', 'sec 14 panchkula', '14 panchkula'], lat: 30.694214, lng: 76.866514 },
  { name: 'Sector 15 Panchkula Market', aliases: ['sector 15 panchkula', 'panchkula 15', 'sec 15 panchkula', '15 panchkula'], lat: 30.686514, lng: 76.869514 },
  { name: 'Sector 16 Panchkula', aliases: ['sector 16 panchkula', 'panchkula 16', 'sec 16 panchkula', '16 panchkula'], lat: 30.679514, lng: 76.862514 },
  { name: 'Sector 20 Panchkula Highrise Hub', aliases: ['panchkula 20', 'sector 20 panchkula', 'sec 20 panchkula', '20 panchkula'], lat: 30.672514, lng: 76.868124 },
  { name: 'Sector 21 Panchkula', aliases: ['sector 21 panchkula', 'panchkula 21', 'sec 21 panchkula', '21 panchkula'], lat: 30.665514, lng: 76.872514 },
  { name: 'Sector 1 Panchkula (MDC)', aliases: ['sector 1 panchkula', 'panchkula 1', 'sec 1 panchkula', 'mdc panchkula'], lat: 30.718514, lng: 76.848514 },
  { name: 'Sector 2 Panchkula', aliases: ['sector 2 panchkula', 'panchkula 2', 'sec 2 panchkula', '2 panchkula'], lat: 30.701214, lng: 76.840214 },
  { name: 'Sector 4 Panchkula', aliases: ['sector 4 panchkula', 'panchkula 4', 'sec 4 panchkula', '4 panchkula'], lat: 30.704214, lng: 76.852214 },
  { name: 'Mansa Devi Complex (MDC) Panchkula', aliases: ['mansa devi', 'mdc', 'mansa devi temple', 'mdc 4', 'mdc 5', 'panchkula temple'], lat: 30.724514, lng: 76.845514 },
  { name: 'Pinjore Heritage Garden', aliases: ['pinjore', 'pinjore garden', 'yadavindra garden'], lat: 30.796514, lng: 76.915514 },

  // Mani Majra & Kharar Landmarks
  { name: 'Modern Housing Complex (MHC) Mani Majra', aliases: ['mhc', 'mhc mani majra', 'manimajra mhc', 'mhc manimajra'], lat: 30.718514, lng: 76.838514 },
  { name: 'Old Ropar Road, Mani Majra', aliases: ['mani majra', 'manimajra', 'old ropar road manimajra', 'manimajra town'], lat: 30.714514, lng: 76.843514 },
  { name: 'Motor Market, Mani Majra', aliases: ['motor market manimajra', 'manimajra motor market'], lat: 30.712514, lng: 76.839514 },
  { name: 'Kharar Bus Stand, NH 21', aliases: ['kharar', 'kharar bus stand', 'kharar chowk', 'nh 21 kharar'], lat: 30.745124, lng: 76.648214 },
  { name: 'Sunny Enclave, Kharar', aliases: ['sunny enclave', 'kharar sunny enclave', 'desu majra'], lat: 30.752514, lng: 76.662514 },
  { name: 'VR Punjab Mall, Kharar Road', aliases: ['vr punjab', 'vr mall', 'kharar road mall'], lat: 30.748231, lng: 76.689241 },

  // Zirakpur Areas & Landmarks
  { name: 'VIP Road, Zirakpur', aliases: ['vip road', 'zirakpur vip road', 'vip road zirakpur', 'metro wholesale zirakpur'], lat: 30.642514, lng: 76.818124 },
  { name: 'Patiala Chowk, Zirakpur', aliases: ['patiala chowk', 'zirakpur patiala chowk', 'patiala road zirakpur'], lat: 30.648514, lng: 76.825514 },
  { name: 'Singhpura Chowk, Zirakpur', aliases: ['singhpura chowk', 'singhpura', 'zirakpur singhpura'], lat: 30.655514, lng: 76.834514 },
  { name: 'Dhakoli, Zirakpur', aliases: ['dhakoli', 'zirakpur dhakoli', 'dhakoli zirakpur'], lat: 30.638514, lng: 76.842514 },
  { name: 'Peer Muchalla, Zirakpur', aliases: ['peer muchalla', 'peermuchalla', 'zirakpur peer muchalla'], lat: 30.631514, lng: 76.852514 },
  { name: 'Baltana, Zirakpur', aliases: ['baltana', 'zirakpur baltana', 'baltana zirakpur'], lat: 30.662514, lng: 76.845514 },
  { name: 'Zirakpur High Street', aliases: ['zirakpur high street', 'high street mall', 'zirakpur mall'], lat: 30.646514, lng: 76.815514 },
  { name: 'Ambala Highway, Zirakpur', aliases: ['ambala highway zirakpur', 'zirakpur ambala road', 'ambala road zirakpur'], lat: 30.640514, lng: 76.822514 },
  { name: 'Kishanpura, Zirakpur', aliases: ['kishanpura', 'zirakpur kishanpura'], lat: 30.627514, lng: 76.821514 },
  { name: 'Zirakpur Bus Stand', aliases: ['zirakpur bus stand', 'zirakpur chowk'], lat: 30.650214, lng: 76.828124 },
  // Dhakoli, Mullanpur, Dhanas & New Chandigarh Sub-Areas
  { name: 'Dhakoli Main Market, Zirakpur', aliases: ['dhakoli', 'dhakoli market', 'zirakpur dhakoli', 'dhakoli railway crossing'], lat: 30.638514, lng: 76.842514 },
  { name: 'Maya Garden & Apple Heights, Dhakoli', aliases: ['maya garden dhakoli', 'apple heights dhakoli', 'dhakoli flats'], lat: 30.635514, lng: 76.848514 },
  { name: 'Green Enclave, Dhakoli', aliases: ['green enclave dhakoli', 'dhakoli green enclave'], lat: 30.641514, lng: 76.839514 },
  { name: 'Mullanpur Garibdas, New Chandigarh', aliases: ['mullanpur', 'mullanpur garibdas', 'new chandigarh', 'new chd'], lat: 30.814514, lng: 76.745514 },
  { name: 'Maharaja Yadavindra Singh International Cricket Stadium, Mullanpur', aliases: ['mullanpur stadium', 'cricket stadium mullanpur', 'pca stadium mullanpur'], lat: 30.822514, lng: 76.738514 },
  { name: 'Omaxe Ecocity & Medicity, New Chandigarh', aliases: ['omaxe new chandigarh', 'ecocity mullanpur', 'medicity new chandigarh', 'dlf new chandigarh'], lat: 30.805514, lng: 76.752514 },
  { name: 'Dhanas Lake & Milk Colony, Chandigarh', aliases: ['dhanas', 'dhanas lake', 'dhanas milk colony', 'dhanas chd', 'dhanas village'], lat: 30.771214, lng: 76.758514 },
  { name: 'EWS Houses & Community Centre, Dhanas', aliases: ['dhanas ews', 'ews dhanas', 'dhanas community centre'], lat: 30.767514, lng: 76.762514 },
  { name: 'Sector 1 Chandigarh (Secretariat, High Court & Open Hand Monument)', aliases: ['sector 1 chandigarh', '1 chandigarh', 'sec 1 chandigarh', 'sector 1 chd', 'sec 1 chd', 'high court', 'secretariat', 'open hand'], lat: 30.758514, lng: 76.801514 },
  { name: 'Sector 7 Market, Chandigarh (Madhya Marg)', aliases: ['sector 7 chandigarh', '7 chandigarh', 'sec 7 chandigarh', 'sector 7 chd', 'sec 7 chd', 'sector 7'], lat: 30.732514, lng: 76.804514 },
  { name: 'Sector 17 Plaza, Chandigarh', aliases: ['sector 17', '17 plaza', '17 chandigarh', 'isbt 17', 'sec 17'], lat: 30.739834, lng: 76.782702 },
  { name: 'Aroma Chowk, Sector 22', aliases: ['aroma', 'sector 22', '22 chandigarh', 'aroma chowk', 'kisan bhawan', 'sec 22'], lat: 30.731514, lng: 76.772124 },
  { name: 'ISBT Sector 43 Bus Stand', aliases: ['isbt 43', 'sector 43', '43 bus stand', 'isbt chandigarh', 'sec 43'], lat: 30.722514, lng: 76.745124 },
  { name: 'Elante Mall, Phase 1', aliases: ['elante', 'elante mall', 'industrial area phase 1', 'chandigarh mall'], lat: 30.705514, lng: 76.801124 },
  { name: 'Chandigarh Railway Station', aliases: ['railway station', 'chandigarh junction', 'cdg station', 'daria', 'railway station chandigarh'], lat: 30.704123, lng: 76.828456 },
  { name: 'Sukhna Lake Promenade', aliases: ['sukhna lake', 'lake', 'sukhna', 'promenade'], lat: 30.742514, lng: 76.815124 },
  { name: 'Rock Garden of Chandigarh', aliases: ['rock garden', 'nek chand'], lat: 30.752514, lng: 76.807124 },
  { name: 'Rose Garden, Sector 16', aliases: ['rose garden', 'sector 16', '16 chandigarh', 'sec 16'], lat: 30.746514, lng: 76.784124 },
  { name: 'PGI Hospital & Medical College', aliases: ['pgi', 'pgimer', 'sector 12', 'pgi hospital'], lat: 30.764514, lng: 76.776124 },
  { name: 'Panjab University, Sector 14', aliases: ['panjab university', 'pu campus', 'sector 14', 'student centre', 'pu'], lat: 30.759514, lng: 76.768124 },
  { name: 'IT Park Cyber City, Kishangarh', aliases: ['it park', 'cyber city', 'infosys', 'dlf it park'], lat: 30.725514, lng: 76.840124 },
  { name: 'Sector 35 Market, Chandigarh', aliases: ['sector 35', '35 market', 'jw marriott', 'sec 35'], lat: 30.724514, lng: 76.764124 },
  { name: 'Sector 34 Sub City Centre', aliases: ['sector 34', '34 library', 'piccadily', 'sec 34'], lat: 30.721514, lng: 76.768124 },
  { name: 'Sector 20 Market, Chandigarh', aliases: ['sector 20 chandigarh', 'sec 20 chandigarh', 'gurudwara sector 20'], lat: 30.724514, lng: 76.791124 },
  { name: 'Sector 15 Market, Chandigarh', aliases: ['sector 15', '15 market', 'patel market', 'sec 15'], lat: 30.754514, lng: 76.774124 },
  { name: 'Sector 26 Grain Market & Clubs', aliases: ['sector 26', '26 clubs', 'timber market', 'sec 26'], lat: 30.728514, lng: 76.804124 },
  { name: 'Sector 8 Inner Market', aliases: ['sector 8 chandigarh', '8 market', 'madhya marg', 'sec 8 chandigarh'], lat: 30.738514, lng: 76.799124 },
  { name: 'Sector 9 Secretariat', aliases: ['sector 9 chandigarh', 'haryana secretariat', 'sec 9 chandigarh'], lat: 30.744514, lng: 76.793124 },
  { name: 'Sector 10 Museum & Leisure Valley', aliases: ['sector 10', 'art museum', 'mountview', 'sec 10'], lat: 30.751514, lng: 76.789124 },
  { name: 'Sector 18 Electronic Market', aliases: ['sector 18', 'tagore theatre', 'sec 18'], lat: 30.735514, lng: 76.789124 },
  { name: 'Sector 19 Sadar Bazar', aliases: ['sector 19', 'sadar bazar', 'palika bazar', 'sec 19'], lat: 30.731514, lng: 76.796124 },
  { name: 'Sector 21 Market', aliases: ['sector 21 chandigarh', 'sec 21 chandigarh'], lat: 30.727514, lng: 76.781124 },
  { name: 'Sector 23 Market, Chandigarh', aliases: ['sector 23', 'sec 23'], lat: 30.737514, lng: 76.766124 },
  { name: 'Sector 27 Market, Chandigarh', aliases: ['sector 27', 'sec 27'], lat: 30.722514, lng: 76.801514 },
  { name: 'Sector 28 Market, Chandigarh', aliases: ['sector 28', 'sec 28'], lat: 30.716514, lng: 76.808514 },
  { name: 'Sector 40 Market', aliases: ['sector 40', 'sec 40'], lat: 30.735514, lng: 76.745124 },
  { name: 'Sector 41 Badheri Market', aliases: ['sector 41', 'badheri', 'sec 41'], lat: 30.731514, lng: 76.738124 },
  { name: 'Sector 42 Lake & Sports Complex', aliases: ['sector 42', 'new lake 42', 'sec 42'], lat: 30.726514, lng: 76.749124 },
  { name: 'Sector 44 Residential', aliases: ['sector 44', 'sec 44'], lat: 30.718514, lng: 76.755124 },
  { name: 'Sector 45 Burail & Market', aliases: ['sector 45', 'burail', 'sec 45'], lat: 30.714514, lng: 76.762124 },
  { name: 'Sector 46 Market', aliases: ['sector 46', 'college 46', 'sec 46'], lat: 30.709514, lng: 76.769124 },
  { name: 'Sector 47 Market', aliases: ['sector 47', 'sec 47'], lat: 30.704514, lng: 76.776124 },
  { name: 'Zirakpur VIP Road & Metro Wholesale', aliases: ['zirakpur', 'vip road', 'metro zirakpur', 'zirakpur flyover'], lat: 30.642514, lng: 76.818124 },
  { name: 'GMCH Hospital Sector 32', aliases: ['gmch', 'gmch 32', 'sector 32 hospital', '32 hospital'], lat: 30.712514, lng: 76.779124 },
];

// Helper: High-Accuracy Instant Matching Suggestions for Drop-off / Pickup
const getInstantMatchingSuggestions = (query: string): { name: string; lat: number; lng: number }[] => {
  const raw = query.trim();
  const q = raw.toLowerCase();
  if (!q) return [];

  const isPanchkula = /\b(panchkula|pkl|haryana)\b/i.test(q);
  const isMohali = /\b(mohali|sas nagar|phase|sohana|mattaur|kumbra|landran|kharar)\b/i.test(q);
  const isChandigarh = /\b(chandigarh|chd|pgi|pu|isbt)\b/i.test(q);

  // Extract sector number if user typed e.g. "43", "sec 43", "sector 7", "sec 7 panchkula"
  const secNumMatch = q.match(/(?:sec|sector)?\s*([0-9]{1,3})\b/i);
  const targetSecNum = secNumMatch ? parseInt(secNumMatch[1], 10) : null;

  // Extract phase if user typed e.g. "7", "phase 7", "3b2", "phase 8b"
  const phaseMatch = q.match(/(?:phase)\s*([0-9]{1,2}[a-z0-9]*)\b/i);
  const targetPhase = phaseMatch ? phaseMatch[1].toLowerCase() : null;

  interface ScoredCandidate {
    name: string;
    lat: number;
    lng: number;
    score: number;
  }

  const scored: ScoredCandidate[] = [];
  const seen = new Set<string>();

  for (const loc of KNOWN_LOCATIONS) {
    const nameLower = loc.name.toLowerCase();
    const locIsPanchkula = nameLower.includes('panchkula');
    const locIsMohali = nameLower.includes('mohali') || nameLower.includes('phase') || nameLower.includes('kharar');
    const locIsChandigarh = nameLower.includes('chandigarh') || (!locIsPanchkula && !locIsMohali);

    let score = 0;

    // 1. Exact full name match
    if (nameLower === q) {
      score += 300;
    }
    // 2. Name starts with exact query
    else if (nameLower.startsWith(q)) {
      score += 180;
    }
    // 3. Name contains query as a distinct word boundary
    else if (new RegExp(`\\b${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i').test(nameLower)) {
      score += 120;
    }
    // 4. Substring in name
    else if (nameLower.includes(q)) {
      score += 70;
    }

    // Alias matching
    for (const a of loc.aliases) {
      if (a === q) {
        score = Math.max(score, 260);
      } else if (a.startsWith(q)) {
        score = Math.max(score, 160);
      } else if (q.includes(a) && a.length >= 3) {
        score = Math.max(score, 110);
      } else if (a.includes(q) && q.length >= 3) {
        score = Math.max(score, 85);
      }
    }

    // Sector number match logic with strict city weighting
    if (targetSecNum !== null) {
      const locSecMatch = nameLower.match(/sector\s*([0-9]{1,3})/i);
      if (locSecMatch && parseInt(locSecMatch[1], 10) === targetSecNum) {
        if (isPanchkula && locIsPanchkula) {
          score += 250;
        } else if (isMohali && locIsMohali) {
          score += 250;
        } else if (isChandigarh && locIsChandigarh) {
          score += 250;
        } else if (!isPanchkula && !isMohali && !isChandigarh) {
          score += 150;
        } else {
          score += 20; // Minor score if city differs
        }
      }
    }

    // Phase query boost (e.g. user typed "phase 7" or "phase 3b2")
    if (targetPhase && targetPhase.length >= 1) {
      const locPhaseMatch = nameLower.match(/phase\s*([0-9]{1,2}[a-z0-9]*)/i);
      if (locPhaseMatch && locPhaseMatch[1].toLowerCase() === targetPhase) {
        score += 220;
      }
    }

    // Regional filter boost/penalty
    if (isPanchkula && locIsPanchkula) score += 60;
    if (isMohali && locIsMohali) score += 60;
    if (isChandigarh && locIsChandigarh) score += 60;

    if (score > 0 && !seen.has(loc.name)) {
      seen.add(loc.name);
      scored.push({ name: loc.name, lat: loc.lat, lng: loc.lng, score });
    }
  }

  // Sort descending by relevance score
  scored.sort((a, b) => b.score - a.score);

  const results = scored.slice(0, 7).map((s) => ({
    name: s.name,
    lat: s.lat,
    lng: s.lng,
  }));

  // If user entered a specific sector number not in KNOWN_LOCATIONS
  if (targetSecNum !== null && !results.some((r) => r.name.toLowerCase().includes(`sector ${targetSecNum}`))) {
    if (isPanchkula) {
      const latOffset = ((targetSecNum % 10) - 5) * 0.005;
      const lngOffset = (Math.floor(targetSecNum / 10) - 1) * 0.006;
      results.unshift({
        name: `Sector ${targetSecNum}, Panchkula`,
        lat: Number((30.6950 + latOffset).toFixed(6)),
        lng: Number((76.8550 + lngOffset).toFixed(6)),
      });
    } else if (isMohali) {
      const latOffset = ((targetSecNum % 10) - 5) * 0.006;
      const lngOffset = (Math.floor(targetSecNum / 10) - 7) * 0.008;
      results.unshift({
        name: `Sector ${targetSecNum}, Mohali`,
        lat: Number((30.7050 + latOffset).toFixed(6)),
        lng: Number((76.7150 + lngOffset).toFixed(6)),
      });
    } else {
      const latOffset = ((targetSecNum % 10) - 5) * 0.008;
      const lngOffset = (Math.floor(targetSecNum / 10) - 2) * 0.012;
      results.unshift({
        name: `Sector ${targetSecNum}, Chandigarh`,
        lat: Number((30.7350 + latOffset).toFixed(6)),
        lng: Number((76.7750 + lngOffset).toFixed(6)),
      });
    }
  }

  return results.slice(0, 7);
};

// Helper: Immediately resolve coordinates for any typed text
const resolveLocationFromText = (query: string, reference?: { lat: number; lng: number; name?: string } | null) => {
  const clean = query.trim();
  const q = clean.toLowerCase();
  if (!q) return { name: '', lat: 0, lng: 0 };

  const isPanchkula = /\b(panchkula|pkl|haryana)\b/i.test(q);
  const isMohali = /\b(mohali|sas nagar|phase|sohana|mattaur|kumbra|landran|kharar)\b/i.test(q);

  // 1. Try high-accuracy instant matching first
  const instantMatches = getInstantMatchingSuggestions(clean);
  if (instantMatches.length > 0) {
    const top = instantMatches[0];
    const isSameAsReference = reference?.name && top.name.toLowerCase() === reference.name.toLowerCase();
    if (!isSameAsReference) {
      return { name: top.name, lat: top.lat, lng: top.lng };
    }
    if (instantMatches.length > 1) {
      return { name: instantMatches[1].name, lat: instantMatches[1].lat, lng: instantMatches[1].lng };
    }
  }

  // 2. Sector number extraction (e.g. "sector 7 panchkula", "sector 17", "sec 22", "sector 43")
  const secMatch = q.match(/(?:sector|sec)\s*([0-9]{1,3})/i);
  if (secMatch) {
    const secNum = parseInt(secMatch[1], 10);
    const knownSec = KNOWN_LOCATIONS.find((l) => {
      const lName = l.name.toLowerCase();
      const hasSec = lName.includes(`sector ${secNum}`) || l.aliases.some((a) => a === `sector ${secNum}` || a === `${secNum}`);
      if (!hasSec) return false;
      if (isPanchkula) return lName.includes('panchkula');
      if (isMohali) return lName.includes('mohali');
      return true;
    });

    if (knownSec && (!reference?.name || knownSec.name.toLowerCase() !== reference.name.toLowerCase())) {
      return { name: knownSec.name, lat: knownSec.lat, lng: knownSec.lng };
    }

    if (isPanchkula) {
      const latOffset = ((secNum % 10) - 5) * 0.005;
      const lngOffset = (Math.floor(secNum / 10) - 1) * 0.006;
      return {
        name: `Sector ${secNum}, Panchkula`,
        lat: Number((30.6950 + latOffset).toFixed(6)),
        lng: Number((76.8550 + lngOffset).toFixed(6)),
      };
    }

    if (isMohali) {
      const latOffset = ((secNum % 10) - 5) * 0.006;
      const lngOffset = (Math.floor(secNum / 10) - 7) * 0.008;
      return {
        name: `Sector ${secNum}, Mohali`,
        lat: Number((30.7050 + latOffset).toFixed(6)),
        lng: Number((76.7150 + lngOffset).toFixed(6)),
      };
    }

    const latOffset = ((secNum % 10) - 5) * 0.008;
    const lngOffset = (Math.floor(secNum / 10) - 2) * 0.012;
    return {
      name: `Sector ${secNum}, Chandigarh`,
      lat: Number((30.7350 + latOffset).toFixed(6)),
      lng: Number((76.7750 + lngOffset).toFixed(6)),
    };
  }

  // 3. Phase extraction (e.g. "phase 8b", "phase 7", "phase 5")
  const phaseMatch = q.match(/(?:phase)\s*([0-9]{1,2}[a-z0-9]*)/i);
  if (phaseMatch) {
    const phaseStr = phaseMatch[1].toLowerCase();
    const phaseKnown = KNOWN_LOCATIONS.find((l) =>
      l.aliases.some((a) => a === `phase ${phaseStr}` || a === phaseStr) ||
      l.name.toLowerCase().includes(`phase ${phaseStr}`)
    );
    if (phaseKnown) {
      return { name: phaseKnown.name, lat: phaseKnown.lat, lng: phaseKnown.lng };
    }
    return {
      name: `Phase ${phaseMatch[1].toUpperCase()}, Mohali`,
      lat: 30.7100,
      lng: 76.7200,
    };
  }

  // 4. Custom destination entered by user: retain user's exact destination label with distinct coordinates
  const baseLat = reference?.lat && reference.lat > 0 ? reference.lat : 30.704649;
  const baseLng = reference?.lng && reference.lng > 0 ? reference.lng : 76.717873;
  return {
    name: clean,
    lat: Number((baseLat + 0.024).toFixed(6)),
    lng: Number((baseLng + 0.024).toFixed(6)),
  };
};

// Robust default fare settings guaranteeing instantaneous fare calculation
const DEFAULT_PASSENGER_FARE_SETTINGS: FareSettings = {
  currency_symbol: '₹',
  base_fare: 25.0,
  per_km_rate: 10.0,
  minimum_fare: 30.0,
  platform_commission_pct: 10.0,
  min_offer_pct: 70.0,
  max_offer_pct: 180.0,
  updated_at: new Date().toISOString(),
  ride_charges: {
    base_fare: 25.0,
    per_km_rate: 10.0,
    minimum_fare: 30.0,
    platform_commission_pct: 10.0,
    min_offer_pct: 70.0,
    max_offer_pct: 180.0,
    night_surcharge_pct: 10.0,
    auto_multiplier: 1.25,
    car_multiplier: 1.8,
    cancellation_fee: 20.0,
    updated_at: new Date().toISOString(),
  },
  courier_charges: {
    base_fare: 35.0,
    per_km_rate: 12.0,
    minimum_fare: 40.0,
    platform_commission_pct: 12.0,
    min_offer_pct: 70.0,
    max_offer_pct: 180.0,
    handling_fee: 10.0,
    express_surcharge: 15.0,
    max_weight_kg: 15.0,
    cancellation_fee: 25.0,
    updated_at: new Date().toISOString(),
  },
};

export const PassengerWorkspace: React.FC<PassengerWorkspaceProps> = ({
  currentPassengerId = '',
  passengerName = 'Passenger',
  currentUser,
  onOpenWallet,
  onSignOut,
}) => {
  const authUser = currentUser || supabaseAuth.getCurrentUser();
  const effectivePassengerName = currentUser?.name || (passengerName !== 'Passenger' ? passengerName : undefined) || authUser?.name || passengerName || 'Passenger';
  // Active Ride State
  const [activeRide, setActiveRide] = useState<MotorideRide | null>(null);
  const activeRideRef = useRef<MotorideRide | null>(null);
  activeRideRef.current = activeRide;

  const [rideHistory, setRideHistory] = useState<MotorideRide[]>([]);
  const [activeTab, setActiveTab] = useState<'book' | 'history'>('book');
  const [viewMode, setViewMode] = useState<'background' | 'split'>('background');
  const [isCardMinimized, setIsCardMinimized] = useState<boolean>(false);
  const [isProfileOpen, setIsProfileOpen] = useState<boolean>(false);
  const [isRideHistoryOpen, setIsRideHistoryOpen] = useState<boolean>(false);
  const [showChatModal, setShowChatModal] = useState<boolean>(false);
  const [hasUnreadMessages, setHasUnreadMessages] = useState<boolean>(false);
  const showChatModalRef = useRef<boolean>(false);
  showChatModalRef.current = showChatModal;

  // Booking Form State - Start empty so no markers show until passenger selects pickup & dropoff
  const [pickup, setPickup] = useState<{
    name: string;
    lat: number;
    lng: number;
  }>({ name: '', lat: 0, lng: 0 });
  const [dropoff, setDropoff] = useState<{
    name: string;
    lat: number;
    lng: number;
  }>({ name: '', lat: 0, lng: 0 });
  const [rideType, setRideType] = useState<RideTypeCode>('bike');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'wallet' | 'upi'>('upi');
  const [offeredFare, setOfferedFare] = useState<number>(75);
  const [rideComment, setRideComment] = useState<string>('');
  const [showCommentInput, setShowCommentInput] = useState<boolean>(false);
  const [isBooking, setIsBooking] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [showPickupToast, setShowPickupToast] = useState(false);
  const [pickupToastMessage, setPickupToastMessage] = useState('📍 Pickup location set to your position');

  // Available Captains & Nearest Captain State for Passenger Map
  const [nearbyCaptains, setNearbyCaptains] = useState<AvailableCaptainItem[]>([]);
  const [nearestCaptain, setNearestCaptain] = useState<AvailableCaptainItem | null>(null);
  const [captainActualTrips, setCaptainActualTrips] = useState<number>(0);

  // Animated Captain Progression for Active Ride on Passenger Map
  const [animatedCaptainPos, setAnimatedCaptainPos] = useState<{
    lat: number;
    lng: number;
    heading: number;
  } | null>(null);

  // Real-Time Passenger GPS Location State (matching user icon)
  const [passengerGps, setPassengerGps] = useState<{
    lat: number;
    lng: number;
    accuracy: number | null;
    heading: number | null;
    speed: number | null;
    timestamp: number;
  }>(() => {
    try {
      const saved = safeStorage.getItem('motoride_last_passenger_gps');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.lat && parsed.lng) {
          return {
            lat: parsed.lat,
            lng: parsed.lng,
            accuracy: parsed.accuracy ?? 14,
            heading: 0,
            speed: 0,
            timestamp: Date.now(),
          };
        }
      }
    } catch {}
    return {
      lat: 30.704649,
      lng: 76.717873,
      accuracy: 14,
      heading: 0,
      speed: 0,
      timestamp: Date.now(),
    };
  });
  const [gpsStatus, setGpsStatus] = useState<'acquiring' | 'live' | 'denied' | 'unavailable' | 'timeout'>('acquiring');
  const [gpsErrorMessage, setGpsErrorMessage] = useState<string | null>(null);
  const [lastUploadedAt, setLastUploadedAt] = useState<number | null>(null);
  const [nowTick, setNowTick] = useState<number>(Date.now());

  // Real-time Current GPS Named Location & Active Map Target
  const [currentGpsLocationName, setCurrentGpsLocationName] = useState<string>('Sector 70, Mohali Market');
  const currentGpsLocationNameRef = useRef<string>('Sector 70, Mohali Market');
  currentGpsLocationNameRef.current = currentGpsLocationName;
  const [activeMapTarget, setActiveMapTarget] = useState<'pickup' | 'dropoff'>('pickup');
  const coordsNameCacheRef = useRef<Map<string, string>>(new Map());

  // Fast synchronous location name resolver from PRESET_LOCATIONS
  const getFastLocationName = (lat: number, lng: number): string => {
    let closest: { name: string; dist: number } | null = null;
    for (const loc of PRESET_LOCATIONS) {
      const dist = calculateRoadDistanceKm(lat, lng, loc.lat, loc.lng) * 1000;
      if (!closest || dist < closest.dist) {
        closest = { name: loc.name, dist };
      }
    }
    if (closest) {
      if (closest.dist <= 400) {
        return closest.name;
      }
      if (closest.dist <= 1500) {
        return `Near ${closest.name}`;
      }
    }
    return `Location (${lat.toFixed(4)}, ${lng.toFixed(4)})`;
  };

  // Precise reverse geocoding via OpenStreetMap / backend geocode endpoint
  const resolveLocationNameAsync = async (lat: number, lng: number): Promise<string> => {
    const key = `${lat.toFixed(4)},${lng.toFixed(4)}`;
    const cached = coordsNameCacheRef.current.get(key);
    if (cached) return cached;

    let closestPreset: { name: string; dist: number } | null = null;
    for (const loc of PRESET_LOCATIONS) {
      const dist = calculateRoadDistanceKm(lat, lng, loc.lat, loc.lng) * 1000;
      if (!closestPreset || dist < closestPreset.dist) {
        closestPreset = { name: loc.name, dist };
      }
    }
    if (closestPreset && closestPreset.dist <= 300) {
      coordsNameCacheRef.current.set(key, closestPreset.name);
      return closestPreset.name;
    }

    try {
      const res = await fetch(getApiUrl(`/api/motoride/geocode/reverse?lat=${lat}&lng=${lng}`));
      if (res.ok) {
        const text = await res.text();
        if (text && !text.trim().startsWith('<') && !text.trim().startsWith('The page')) {
          const data = JSON.parse(text);
          if (data && data.address && typeof data.address === 'string' && data.address.trim()) {
            if (!data.address.startsWith('Location (')) {
              const formatted = data.address.trim();
              coordsNameCacheRef.current.set(key, formatted);
              return formatted;
            }
          }
        }
      }
    } catch {}

    const fallback = closestPreset && closestPreset.dist <= 1500
      ? `Near ${closestPreset.name}`
      : `Location (${lat.toFixed(4)}, ${lng.toFixed(4)})`;
    coordsNameCacheRef.current.set(key, fallback);
    return fallback;
  };

  // Keep currentGpsLocationName resolved whenever passenger GPS updates
  useEffect(() => {
    if (passengerGps.lat && passengerGps.lng) {
      const fast = getFastLocationName(passengerGps.lat, passengerGps.lng);
      setCurrentGpsLocationName(fast);
      resolveLocationNameAsync(passengerGps.lat, passengerGps.lng).then((name) => {
        if (name) {
          setCurrentGpsLocationName(name);
          setPickup((prev) => {
            if (prev.name === 'My Live GPS Location' || prev.name === fast) {
              return { ...prev, name };
            }
            return prev;
          });
          setPickupInputText((prev) => (prev === 'My Live GPS Location' || prev === fast ? name : prev));
        }
      });
    }
  }, [passengerGps.lat, passengerGps.lng]);

  // Manual Typing & Live Address Search State
  const [pickupMode, setPickupMode] = useState<'preset' | 'manual'>('preset');
  const [dropoffMode, setDropoffMode] = useState<'preset' | 'manual'>('manual');
  const [pickupInputText, setPickupInputText] = useState<string>('');
  const [dropoffInputText, setDropoffInputText] = useState<string>('');
  const [pickupSuggestions, setPickupSuggestions] = useState<Array<{ name: string; lat: number; lng: number }>>([]);
  const [dropoffSuggestions, setDropoffSuggestions] = useState<Array<{ name: string; lat: number; lng: number }>>([]);
  const [isSearchingPickup, setIsSearchingPickup] = useState(false);
  const [isSearchingDropoff, setIsSearchingDropoff] = useState(false);
  const [showPickupSuggestions, setShowPickupSuggestions] = useState(false);
  const [showDropoffSuggestions, setShowDropoffSuggestions] = useState(false);
  const pickupContainerRef = useRef<HTMLDivElement | null>(null);
  const dropoffContainerRef = useRef<HTMLDivElement | null>(null);
  const dropoffInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const handleDocumentClick = (e: MouseEvent) => {
      if (pickupContainerRef.current && !pickupContainerRef.current.contains(e.target as Node)) {
        setShowPickupSuggestions(false);
      }
      if (dropoffContainerRef.current && !dropoffContainerRef.current.contains(e.target as Node)) {
        setShowDropoffSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleDocumentClick);
    return () => document.removeEventListener('mousedown', handleDocumentClick);
  }, []);

  // Live Geocoding for Manual Pickup Search
  useEffect(() => {
    if (pickupMode !== 'manual' || !pickupInputText.trim() || pickupInputText.trim().length < 2) {
      return;
    }
    const timer = setTimeout(async () => {
      setIsSearchingPickup(true);
      try {
        const q = pickupInputText.trim();
        const res = await fetch(getApiUrl(`/api/motoride/geocode/search?q=${encodeURIComponent(q)}`));
        if (res.ok) {
          const text = await res.text();
          if (text && !text.trim().startsWith('<') && !text.trim().startsWith('The page')) {
            const data = JSON.parse(text);
            if (data.results && Array.isArray(data.results)) {
              const instant = getInstantMatchingSuggestions(q);
              const merged = [...instant];
              for (const r of data.results) {
                if (!merged.some((m) => m.name === r.name)) {
                  merged.push(r);
                }
              }
              setPickupSuggestions(merged.slice(0, 6));

              // Refine pickup coordinates if still matching current input
              if (data.results.length > 0) {
                const best = data.results[0];
                setPickup((prev) => {
                  if (prev.name === q || prev.name.toLowerCase().includes(q.toLowerCase())) {
                    return { ...prev, lat: best.lat, lng: best.lng };
                  }
                  return prev;
                });
              }
            }
          }
        }
      } catch (err) {
        console.warn('Pickup geocoding search failed:', err);
      } finally {
        setIsSearchingPickup(false);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [pickupInputText, pickupMode]);

  // Live Geocoding for Manual Dropoff Search
  useEffect(() => {
    if (dropoffMode !== 'manual' || !dropoffInputText.trim() || dropoffInputText.trim().length < 2) {
      return;
    }
    const timer = setTimeout(async () => {
      setIsSearchingDropoff(true);
      try {
        const q = dropoffInputText.trim();
        const res = await fetch(getApiUrl(`/api/motoride/geocode/search?q=${encodeURIComponent(q)}`));
        if (res.ok) {
          const text = await res.text();
          if (text && !text.trim().startsWith('<') && !text.trim().startsWith('The page')) {
            const data = JSON.parse(text);
            if (data.results && Array.isArray(data.results)) {
              const instant = getInstantMatchingSuggestions(q);
              const merged = [...instant];
              for (const r of data.results) {
                if (!merged.some((m) => m.name.toLowerCase() === r.name.toLowerCase())) {
                  merged.push(r);
                }
              }
              setDropoffSuggestions(merged.slice(0, 7));
              setShowDropoffSuggestions(true);

              // Refine dropoff coordinates with exact server geocoding
              if (data.results.length > 0) {
                const best = data.results[0];
                setDropoff((prev) => {
                  if (prev.lat === 0 || prev.name === q || prev.name.toLowerCase().includes(q.toLowerCase())) {
                    return { ...prev, lat: best.lat, lng: best.lng };
                  }
                  return prev;
                });
              }
            }
          }
        }
      } catch (err) {
        console.warn('Dropoff geocoding search failed:', err);
      } finally {
        setIsSearchingDropoff(false);
      }
    }, 150);
    return () => clearTimeout(timer);
  }, [dropoffInputText, dropoffMode]);

  const handleSelectPickupSuggestion = (item: { name: string; lat: number; lng: number }) => {
    setPickup({ name: item.name, lat: item.lat, lng: item.lng });
    setPickupInputText(item.name);
    setShowPickupSuggestions(false);
  };

  const handleManualPickupChange = (text: string) => {
    setPickupInputText(text);
    setShowPickupSuggestions(true);
    if (!text.trim()) {
      setPickup({ name: '', lat: 0, lng: 0 });
      setPickupSuggestions([]);
      return;
    }
    // 1. Instant local matching
    const instantMatches = getInstantMatchingSuggestions(text);
    setPickupSuggestions(instantMatches);

    // 2. Immediately resolve coordinates so map pin A and route update in 0ms!
    const resolved = instantMatches.length > 0 ? instantMatches[0] : resolveLocationFromText(text, passengerGps.lat ? passengerGps : null);
    setPickup(resolved);
  };

  const handlePickupKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (pickupSuggestions.length > 0) {
        handleSelectPickupSuggestion(pickupSuggestions[0]);
      } else if (pickupInputText.trim()) {
        const resolved = resolveLocationFromText(pickupInputText, passengerGps.lat ? passengerGps : null);
        setPickup(resolved);
        setShowPickupSuggestions(false);
      }
    }
  };

  const handleSelectDropoffSuggestion = (item: { name: string; lat: number; lng: number }) => {
    setDropoff({ name: item.name, lat: item.lat, lng: item.lng });
    setDropoffInputText(item.name);
    setShowDropoffSuggestions(false);
  };

  const handleManualDropoffChange = (text: string) => {
    setDropoffInputText(text);
    if (!text.trim()) {
      setDropoff({ name: '', lat: 0, lng: 0 });
      setDropoffSuggestions([]);
      setShowDropoffSuggestions(false);
      return;
    }
    const instant = getInstantMatchingSuggestions(text);
    setDropoffSuggestions(instant);
    setShowDropoffSuggestions(true);

    // Immediately resolve coordinates so Marker B, route, and fare update in 0ms!
    const resolved = instant.length > 0 ? instant[0] : resolveLocationFromText(text, pickup);
    setDropoff({
      name: text.trim(),
      lat: resolved.lat,
      lng: resolved.lng,
    });
  };

  const handleDropoffKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (dropoffSuggestions.length > 0) {
        handleSelectDropoffSuggestion(dropoffSuggestions[0]);
      } else if (dropoffInputText.trim()) {
        const resolved = resolveLocationFromText(dropoffInputText, pickup);
        setDropoff(resolved);
        setShowDropoffSuggestions(false);
      }
    }
  };
  const watchIdRef = useRef<number | null>(null);
  const lastUploadedGpsRef = useRef<{ lat: number; lng: number; time: number }>({
    lat: 0,
    lng: 0,
    time: 0,
  });

  // Handler: 1-click set pickup to passenger standing position & open drop location fill box
  const handleSetPickupFromPassengerPosition = async (lat?: number, lng?: number) => {
    const targetLat = lat ?? passengerGps.lat;
    const targetLng = lng ?? passengerGps.lng;

    // Fast 0ms location name from closest landmarks
    const initialName = getFastLocationName(targetLat, targetLng);
    setPickup({
      name: initialName,
      lat: targetLat,
      lng: targetLng,
    });
    setPickupInputText(initialName);
    setCurrentGpsLocationName(initialName);
    setActiveMapTarget('dropoff');

    // Automatically expand card, switch to drop location search, and focus input
    setIsCardMinimized(false);
    setDropoffMode('manual');
    setShowDropoffSuggestions(true);
    setTimeout(() => {
      dropoffInputRef.current?.focus();
      dropoffContainerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 120);

    setPickupToastMessage(`📍 Pickup set to ${initialName}`);
    setShowPickupToast(true);
    setTimeout(() => setShowPickupToast(false), 3500);

    // Refine with accurate reverse geocoding in background
    try {
      const accurateName = await resolveLocationNameAsync(targetLat, targetLng);
      if (accurateName && accurateName !== initialName) {
        setPickup((prev) => (prev.lat === targetLat && prev.lng === targetLng ? { ...prev, name: accurateName } : prev));
        setPickupInputText((prev) => (prev === initialName ? accurateName : prev));
        setCurrentGpsLocationName(accurateName);
        setPickupToastMessage(`📍 Pickup: ${accurateName}`);
      }
    } catch {}
  };
  const [fareSettings, setFareSettings] = useState<FareSettings>(() => {
    try {
      const saved = localStorage.getItem('motoride_admin_fare_settings');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.base_fare || parsed.ride_charges?.base_fare) {
          return {
            ...DEFAULT_PASSENGER_FARE_SETTINGS,
            ...parsed,
            ride_charges: { ...DEFAULT_PASSENGER_FARE_SETTINGS.ride_charges, ...(parsed.ride_charges || {}) },
            courier_charges: { ...DEFAULT_PASSENGER_FARE_SETTINGS.courier_charges, ...(parsed.courier_charges || {}) },
          };
        }
      }
    } catch {}
    return DEFAULT_PASSENGER_FARE_SETTINGS;
  });

  // Fetch latest fare settings from server and subscribe to real-time updates
  useEffect(() => {
    fetch(getApiUrl('/api/motoride/fare-settings'))
      .then((res) => res.json())
      .then((data) => {
        if (data?.settings) {
          const s = data.settings;
          const merged = {
            ...DEFAULT_PASSENGER_FARE_SETTINGS,
            ...s,
            per_km_rate: s.ride_charges?.per_km_rate ?? s.per_km_rate ?? DEFAULT_PASSENGER_FARE_SETTINGS.per_km_rate,
            base_fare: s.ride_charges?.base_fare ?? s.base_fare ?? DEFAULT_PASSENGER_FARE_SETTINGS.base_fare,
            minimum_fare: s.ride_charges?.minimum_fare ?? s.minimum_fare ?? DEFAULT_PASSENGER_FARE_SETTINGS.minimum_fare,
            platform_commission_pct: s.ride_charges?.platform_commission_pct ?? s.platform_commission_pct ?? DEFAULT_PASSENGER_FARE_SETTINGS.platform_commission_pct,
            ride_charges: {
              ...DEFAULT_PASSENGER_FARE_SETTINGS.ride_charges,
              ...(s.ride_charges || {}),
              per_km_rate: s.ride_charges?.per_km_rate ?? s.per_km_rate ?? DEFAULT_PASSENGER_FARE_SETTINGS.ride_charges.per_km_rate,
              base_fare: s.ride_charges?.base_fare ?? s.base_fare ?? DEFAULT_PASSENGER_FARE_SETTINGS.ride_charges.base_fare,
              minimum_fare: s.ride_charges?.minimum_fare ?? s.minimum_fare ?? DEFAULT_PASSENGER_FARE_SETTINGS.ride_charges.minimum_fare,
              platform_commission_pct: s.ride_charges?.platform_commission_pct ?? s.platform_commission_pct ?? DEFAULT_PASSENGER_FARE_SETTINGS.ride_charges.platform_commission_pct,
            },
            courier_charges: { ...DEFAULT_PASSENGER_FARE_SETTINGS.courier_charges, ...(s.courier_charges || {}) },
          };
          setFareSettings(merged);
          try {
            localStorage.setItem('motoride_admin_fare_settings', JSON.stringify(merged));
          } catch {}
        }
      })
      .catch(() => {});

    const unsubFare = realtimeSync.on('FARE_SETTINGS_UPDATED', (newSettings: any) => {
      if (newSettings) {
        const merged = {
          ...DEFAULT_PASSENGER_FARE_SETTINGS,
          ...newSettings,
          per_km_rate: newSettings.ride_charges?.per_km_rate ?? newSettings.per_km_rate ?? DEFAULT_PASSENGER_FARE_SETTINGS.per_km_rate,
          base_fare: newSettings.ride_charges?.base_fare ?? newSettings.base_fare ?? DEFAULT_PASSENGER_FARE_SETTINGS.base_fare,
          minimum_fare: newSettings.ride_charges?.minimum_fare ?? newSettings.minimum_fare ?? DEFAULT_PASSENGER_FARE_SETTINGS.minimum_fare,
          platform_commission_pct: newSettings.ride_charges?.platform_commission_pct ?? newSettings.platform_commission_pct ?? DEFAULT_PASSENGER_FARE_SETTINGS.platform_commission_pct,
          ride_charges: {
            ...DEFAULT_PASSENGER_FARE_SETTINGS.ride_charges,
            ...(newSettings.ride_charges || {}),
            per_km_rate: newSettings.ride_charges?.per_km_rate ?? newSettings.per_km_rate ?? DEFAULT_PASSENGER_FARE_SETTINGS.ride_charges.per_km_rate,
            base_fare: newSettings.ride_charges?.base_fare ?? newSettings.base_fare ?? DEFAULT_PASSENGER_FARE_SETTINGS.ride_charges.base_fare,
            minimum_fare: newSettings.ride_charges?.minimum_fare ?? newSettings.minimum_fare ?? DEFAULT_PASSENGER_FARE_SETTINGS.ride_charges.minimum_fare,
            platform_commission_pct: newSettings.ride_charges?.platform_commission_pct ?? newSettings.platform_commission_pct ?? DEFAULT_PASSENGER_FARE_SETTINGS.ride_charges.platform_commission_pct,
          },
          courier_charges: { ...DEFAULT_PASSENGER_FARE_SETTINGS.courier_charges, ...(newSettings.courier_charges || {}) },
        };
        setFareSettings(merged);
        try {
          localStorage.setItem('motoride_admin_fare_settings', JSON.stringify(merged));
        } catch {}
      }
    });

    return () => {
      unsubFare();
    };
  }, []);

  // Trip Completed Rating State
  const [ratingScore, setRatingScore] = useState(5);
  const [reviewText, setReviewText] = useState('');
  const [ratingSubmitted, setRatingSubmitted] = useState(false);
  const [showCaptainRatingModal, setShowCaptainRatingModal] = useState(false);
  const [completedRideForRating, setCompletedRideForRating] = useState<MotorideRide | null>(null);
  const [isSubmittingRating, setIsSubmittingRating] = useState(false);

  const getRatedRideIds = (): string[] => {
    try {
      const userSpecific = JSON.parse(localStorage.getItem(`motoride_rated_rides_${currentPassengerId}`) || '[]');
      const globalRated = JSON.parse(localStorage.getItem('motoride_rated_rides') || '[]');
      return Array.from(new Set([...userSpecific, ...globalRated]));
    } catch {
      return [];
    }
  };

  const markRideAsRated = (rideId: string) => {
    try {
      const ids = getRatedRideIds();
      if (!ids.includes(rideId)) {
        ids.push(rideId);
        localStorage.setItem(`motoride_rated_rides_${currentPassengerId}`, JSON.stringify(ids));
        localStorage.setItem('motoride_rated_rides', JSON.stringify(ids));
      }
    } catch {}
  };

  // Real Driving Road Route Distance & Duration State
  const [routeDistanceInfo, setRouteDistanceInfo] = useState<{
    distanceKm: number;
    durationMin: number;
    isRoadAccurate: boolean;
  } | null>(null);

  // General coordinate distance helper using calibrated road network geometry
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    return calculateRoadDistanceKm(lat1, lon1, lat2, lon2);
  };

  const hasPickupSelected = Boolean(
    (pickup.name === 'My Live GPS Location' && (pickup.lat > 0 || passengerGps.lat > 0)) ||
    (pickup.name && pickup.lat && pickup.lat > 0) ||
    (pickupMode === 'manual' && pickupInputText.trim() && pickup.lat > 0)
  );

  const activePickupLat = hasPickupSelected
    ? (pickup.name === 'My Live GPS Location' ? (passengerGps.lat || 30.704649) : pickup.lat)
    : null;
  const activePickupLng = hasPickupSelected
    ? (pickup.name === 'My Live GPS Location' ? (passengerGps.lng || 76.717873) : pickup.lng)
    : null;
  const activePickupName = hasPickupSelected
    ? (pickup.name?.trim() || (pickupMode === 'manual' ? pickupInputText.trim() : ''))
    : '';

  const hasDropoffSelected = Boolean(
    (dropoff.name && dropoff.lat && dropoff.lat > 0) ||
    (dropoffMode === 'manual' && dropoffInputText.trim() && dropoff.lat > 0)
  );

  const activeDropoffLat = hasDropoffSelected ? dropoff.lat : null;
  const activeDropoffLng = hasDropoffSelected ? dropoff.lng : null;
  const activeDropoffName = hasDropoffSelected
    ? (dropoff.name?.trim() || (dropoffMode === 'manual' ? dropoffInputText.trim() : ''))
    : '';

  const hasSelectedLocations = Boolean(
    hasPickupSelected &&
    hasDropoffSelected &&
    activePickupLat &&
    activeDropoffLat
  );

  // Immediate calibrated urban road distance calculation for 0ms initial render
  const instantRoadDistance = hasSelectedLocations
    ? calculateRoadDistanceKm(activePickupLat, activePickupLng, activeDropoffLat, activeDropoffLng)
    : 0;
  const instantDurationMin = hasSelectedLocations
    ? Math.max(3, Math.round(instantRoadDistance * 2.4 + 3))
    : 0;

  // Real driving road distance (refined to exact OSRM driving distance when fetched)
  const distanceKm = hasSelectedLocations
    ? (routeDistanceInfo?.distanceKm ?? instantRoadDistance)
    : 0;
  const durationMin = hasSelectedLocations
    ? (routeDistanceInfo?.durationMin ?? instantDurationMin)
    : 0;

  // Fetch real road driving route distance & duration from routing service
  useEffect(() => {
    if (!hasSelectedLocations || !activePickupLat || !activeDropoffLat) {
      setRouteDistanceInfo(null);
      return;
    }

    let isCancelled = false;
    const immediateKm = calculateRoadDistanceKm(activePickupLat, activePickupLng, activeDropoffLat, activeDropoffLng);
    const immediateMin = Math.max(3, Math.round(immediateKm * 2.4 + 3));
    setRouteDistanceInfo({ distanceKm: immediateKm, durationMin: immediateMin, isRoadAccurate: false });

    fetchRouteRoadDistance(activePickupLat, activePickupLng, activeDropoffLat, activeDropoffLng)
      .then((res) => {
        if (!isCancelled && res.distanceKm > 0) {
          setRouteDistanceInfo(res);
        }
      })
      .catch(() => {});

    return () => {
      isCancelled = true;
    };
  }, [activePickupLat, activePickupLng, activeDropoffLat, activeDropoffLng, hasSelectedLocations]);

  // Dedicated separate pricing by service type (Ride vs Courier)
  const rideConfig = fareSettings.ride_charges || DEFAULT_PASSENGER_FARE_SETTINGS.ride_charges || {};
  const courierConfig = fareSettings.courier_charges || DEFAULT_PASSENGER_FARE_SETTINGS.courier_charges || {};

  let estimatedFare = 0;
  if (hasSelectedLocations) {
    const cc = courierConfig as any;
    const rc = rideConfig as any;
    const effectiveKm = Math.max(1.0, distanceKm || 1.0);
    if (rideType === 'courier') {
      const rate = Number(cc.per_km_rate ?? 12) || 12;
      const running = effectiveKm * rate;
      estimatedFare = Math.max(40, Math.round(running));
    } else {
      const multiplier =
        rideType === 'auto'
          ? Number(rc.auto_multiplier || 1.25) || 1.25
          : rideType === 'car'
          ? Number(rc.car_multiplier || 1.8) || 1.8
          : 1.0;
      const rate = Number(rc.per_km_rate ?? 10) || 10;
      const running = effectiveKm * rate;
      estimatedFare = Math.max(30, Math.round(running * multiplier));
    }
    if (isNaN(estimatedFare) || estimatedFare <= 0) {
      estimatedFare = Math.max(30, Math.round(effectiveKm * 10));
    }
  }

  // Auto-align offered fare with estimated fare when endpoints/type change
  useEffect(() => {
    if (estimatedFare > 0) {
      setOfferedFare(estimatedFare);
    }
  }, [estimatedFare]);

  // 5-second interval ticker for stale location detection (>30s)
  useEffect(() => {
    const timer = setInterval(() => {
      setNowTick(Date.now());
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  // Real-Time Passenger GPS Location Engine using navigator.geolocation.watchPosition()
  const handlePositionSuccess = (position: GeolocationPosition) => {
    const { latitude, longitude, accuracy, heading, speed } = position.coords;
    const now = position.timestamp || Date.now();

    setPassengerGps({
      lat: latitude,
      lng: longitude,
      accuracy: accuracy ?? 15,
      heading: heading ?? null,
      speed: speed ?? null,
      timestamp: now,
    });
    setGpsStatus('live');
    setGpsErrorMessage(null);

    // Persist latest passenger location for instant display on next app opening
    try {
      safeStorage.setItem(
        'motoride_last_passenger_gps',
        JSON.stringify({ lat: latitude, lng: longitude, accuracy })
      );
    } catch {}

    // If pickup location is currently set to live GPS or default, keep it synchronized with real-time GPS
    setPickup((prev) => {
      if (
        !prev.name ||
        prev.name === 'My Live GPS Location' ||
        prev.name === 'Sector 70, Mohali Market' ||
        prev.name === currentGpsLocationNameRef.current
      ) {
        const resolved = getFastLocationName(latitude, longitude);
        setCurrentGpsLocationName(resolved);
        return {
          name: resolved,
          lat: latitude,
          lng: longitude,
        };
      }
      return prev;
    });

    // Real-Time Supabase Sync with Throttling:
    // Sync if passenger moved > 4 meters OR time delta > 4 seconds (min throttle 2.5s)
    const prev = lastUploadedGpsRef.current;
    const distMeters = calculateDistance(prev.lat, prev.lng, latitude, longitude) * 1000;
    const timeDelta = now - prev.time;

    if (timeDelta >= 2500 && (distMeters >= 4 || timeDelta >= 4500 || prev.time === 0)) {
      lastUploadedGpsRef.current = { lat: latitude, lng: longitude, time: now };
      setLastUploadedAt(now);

      const isRideActive =
        activeRide &&
        !['trip_completed', 'cancelled_by_passenger', 'cancelled_by_captain'].includes(activeRide.status);

      motorideApi
        .updatePassengerLiveLocation({
          passenger_id: currentPassengerId,
          ride_id: isRideActive ? activeRide.id : null,
          latitude,
          longitude,
          accuracy: accuracy ?? null,
          heading: heading ?? null,
          speed: speed ?? null,
        })
        .catch((err) => console.warn('Supabase passenger live location sync notice:', err));
    }
  };

  const handlePositionError = (err: GeolocationPositionError) => {
    console.warn('Passenger Geolocation error:', err.code, err.message);
    if (err.code === 1) {
      // PERMISSION_DENIED
      setGpsStatus('denied');
      setGpsErrorMessage('Please allow location access to use your current location.');
    } else if (err.code === 2) {
      // POSITION_UNAVAILABLE
      setGpsStatus('unavailable');
      setGpsErrorMessage('Please allow location access or enable device GPS to use your current location.');
    } else if (err.code === 3) {
      // TIMEOUT
      setGpsStatus('timeout');
      setGpsErrorMessage('Location request timed out. Retrying GPS connection...');
    } else {
      setGpsStatus('denied');
      setGpsErrorMessage('Please allow location access to use your current location.');
    }
  };

  const startWatchingLocation = () => {
    if (watchIdRef.current !== null && 'geolocation' in navigator) {
      try {
        navigator.geolocation.clearWatch(watchIdRef.current);
      } catch {}
      watchIdRef.current = null;
    }

    if (!('geolocation' in navigator)) {
      setGpsStatus('unavailable');
      setGpsErrorMessage('Geolocation API is not supported in this browser.');
      return;
    }

    setGpsStatus('acquiring');
    setGpsErrorMessage(null);

    // 1. Initial immediate request with high accuracy, falling back to standard WiFi/IP accuracy if GPS times out
    try {
      navigator.geolocation.getCurrentPosition(
        (pos) => handlePositionSuccess(pos),
        (err) => {
          if (err.code === 2 || err.code === 3) {
            try {
              navigator.geolocation.getCurrentPosition(
                (fallbackPos) => handlePositionSuccess(fallbackPos),
                (fallbackErr) => handlePositionError(fallbackErr),
                { enableHighAccuracy: false, timeout: 8000, maximumAge: 30000 }
              );
            } catch {}
          } else {
            handlePositionError(err);
          }
        },
        { enableHighAccuracy: true, timeout: 5000, maximumAge: 10000 }
      );
    } catch (e) {
      console.warn('Initial geolocation attempt caught:', e);
    }

    // 2. Continuous watchPosition for live-location streaming
    try {
      const id = navigator.geolocation.watchPosition(
        (pos) => handlePositionSuccess(pos),
        (err) => {
          console.warn('Geolocation watch note:', err.message);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 2000,
        }
      );
      watchIdRef.current = id;
    } catch (e) {
      console.warn('watchPosition catch:', e);
    }
  };

  const requestLiveLocation = () => {
    startWatchingLocation();
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      startWatchingLocation();
    }, 1200);

    return () => {
      clearTimeout(timer);
      if (watchIdRef.current !== null && 'geolocation' in navigator) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [activeRide?.id, activeRide?.status]);

  // Play triumphant sound alert when ride is accepted by captain
  const playRideAcceptedTune = () => {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;
      const ctx = new AudioContextClass();
      if (ctx.state === 'suspended') {
        ctx.resume();
      }
      
      const notes = [659.25, 783.99, 1046.50, 1318.51]; // E5, G5, C6, E6
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.1);
        
        gain.gain.setValueAtTime(0, ctx.currentTime + idx * 0.1);
        gain.gain.linearRampToValueAtTime(0.2, ctx.currentTime + idx * 0.1 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + idx * 0.1 + 0.3);
        
        osc.connect(gain);
        gain.connect(ctx.destination);
        
        osc.start(ctx.currentTime + idx * 0.1);
        osc.stop(ctx.currentTime + idx * 0.1 + 0.35);
      });

      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate([150, 75, 150]);
      }
    } catch (e) {
      console.warn('Audio playback notice:', e);
    }
  };

  // Play exciting sound alert when trip starts
  const playTripStartedTune = () => {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;
      const ctx = new AudioContextClass();
      if (ctx.state === 'suspended') {
        ctx.resume();
      }
      
      const notes = [523.25, 659.25, 783.99, 1046.50, 1318.51, 1567.98]; // C5, E5, G5, C6, E6, G6
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.08);
        
        gain.gain.setValueAtTime(0, ctx.currentTime + idx * 0.08);
        gain.gain.linearRampToValueAtTime(0.2, ctx.currentTime + idx * 0.08 + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + idx * 0.08 + 0.25);
        
        osc.connect(gain);
        gain.connect(ctx.destination);
        
        osc.start(ctx.currentTime + idx * 0.08);
        osc.stop(ctx.currentTime + idx * 0.08 + 0.3);
      });

      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate([100, 50, 100, 50, 200]);
      }
    } catch (e) {
      console.warn('Audio playback notice:', e);
    }
  };

  // Play subtle sound alert when captain sends a chat message
  const playMessageNotificationChime = () => {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;
      const ctx = new AudioContextClass();
      if (ctx.state === 'suspended') ctx.resume();

      const now = ctx.currentTime;
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(659.25, now);
      gain1.gain.setValueAtTime(0, now);
      gain1.gain.linearRampToValueAtTime(0.18, now + 0.02);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.22);

      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(880, now + 0.1);
      gain2.gain.setValueAtTime(0, now + 0.1);
      gain2.gain.linearRampToValueAtTime(0.22, now + 0.12);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.1);
      osc2.stop(now + 0.37);

      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate([100, 50, 100]);
      }
    } catch (e) {
      console.warn('Audio playback notice:', e);
    }
  };

  // Track unread captain chat messages after ride is accepted
  useEffect(() => {
    const isAcceptedRide = activeRide && ['captain_accepted', 'captain_arrived', 'trip_started'].includes(activeRide.status);
    if (!isAcceptedRide || !activeRide.id) {
      setHasUnreadMessages(false);
      return;
    }

    const rideId = activeRide.id;

    // Check existing unread messages on mount / ride status change
    const checkUnread = async () => {
      try {
        const msgs = await motorideApi.getRideMessages(rideId);
        const lastRead = Number(safeStorage.getItem(`motoride_last_read_chat_${rideId}`) || '0');
        const hasUnread = msgs.some(
          (m) => m.sender_role === 'captain' && new Date(m.created_at).getTime() > lastRead
        );
        if (hasUnread && !showChatModalRef.current) {
          setHasUnreadMessages(true);
        }
      } catch {}
    };
    checkUnread();

    // Periodic check interval (every 3s)
    const interval = setInterval(async () => {
      if (showChatModalRef.current) return;
      try {
        const msgs = await motorideApi.getRideMessages(rideId);
        const lastRead = Number(safeStorage.getItem(`motoride_last_read_chat_${rideId}`) || '0');
        const hasUnread = msgs.some(
          (m) => m.sender_role === 'captain' && new Date(m.created_at).getTime() > lastRead
        );
        if (hasUnread) {
          setHasUnreadMessages((prev) => {
            if (!prev) playMessageNotificationChime();
            return true;
          });
        }
      } catch {}
    }, 3000);

    // Instant real-time listener for captain message
    const unsub = realtimeSync.on('RIDE_MESSAGE_RECEIVED', (payload: any) => {
      if (payload && payload.ride_id === rideId && payload.sender_role === 'captain') {
        if (!showChatModalRef.current) {
          setHasUnreadMessages(true);
          playMessageNotificationChime();
        } else {
          safeStorage.setItem(`motoride_last_read_chat_${rideId}`, Date.now().toString());
        }
      }
    });

    return () => {
      clearInterval(interval);
      unsub();
    };
  }, [activeRide?.id, activeRide?.status]);

  // Load initial settings and active ride if any
  useEffect(() => {
    loadFareSettings();
    loadActiveRide();
    loadRideHistory();

    // Listen to real-time events
    const handleRideUpdate = (ride: MotorideRide) => {
      if (!ride || !ride.id) return;
      const currentActive = activeRideRef.current;
      const storedActiveId = safeStorage.getItem('motoride_active_passenger_ride_id');
      const isPassengerMatch =
        Boolean(!ride.passenger_id ||
          ride.passenger_id === currentPassengerId ||
          (currentUser?.id && ride.passenger_id === currentUser.id) ||
          (authUser?.id && ride.passenger_id === authUser.id)
        );
      const isRideMatch = Boolean(
        (currentActive && currentActive.id === ride.id) ||
        (storedActiveId && storedActiveId === ride.id)
      );

      if (isRideMatch || (isPassengerMatch && (currentActive || storedActiveId || ride.status === 'captain_accepted' || ride.status === 'captain_offered' || ride.status === 'requested'))) {
        if (ride.status === 'captain_accepted') {
          if (!currentActive || currentActive.status !== 'captain_accepted') {
            playRideAcceptedTune();
          }
        }
        if (ride.status === 'trip_started') {
          if (!currentActive || currentActive.status !== 'trip_started') {
            playTripStartedTune();
          }
        }
        if (ride.status.includes('cancelled')) {
          safeStorage.removeItem('motoride_active_passenger_ride_id');
          setActiveRide(null);
          setShowCaptainRatingModal(false);
          setCompletedRideForRating(null);
        } else if (ride.status === 'trip_completed' || ride.status === 'completed') {
          safeStorage.removeItem('motoride_active_passenger_ride_id');
          const ratedIds = getRatedRideIds();
          if (!ride.passenger_rated && !ratedIds.includes(ride.id)) {
            setActiveRide(ride);
            setCompletedRideForRating(ride);
            setShowCaptainRatingModal(true);
          } else {
            setActiveRide(null);
            setShowCaptainRatingModal(false);
            setCompletedRideForRating(null);
          }
        } else {
          safeStorage.setItem('motoride_active_passenger_ride_id', ride.id);
          setActiveRide((prev) => {
            if (!prev || prev.id !== ride.id) return ride;
            return {
              ...prev,
              ...ride,
              status: ride.status,
              captain_name: ride.captain_name || prev.captain_name,
              captain_phone: ride.captain_phone || prev.captain_phone,
              vehicle_model: ride.vehicle_model || prev.vehicle_model,
              plate_number: ride.plate_number || prev.plate_number,
              captain_avatar: (ride as any).captain_avatar || (ride as any).avatar_url || (prev as any).captain_avatar || (prev as any).avatar_url,
            };
          });
        }
        loadRideHistory();
      }
    };

    const unsubUpdate = realtimeSync.on('RIDE_UPDATED', handleRideUpdate);
    const unsubStatusChanged = realtimeSync.on('RIDE_STATUS_CHANGED', (payload: any) => {
      const ride = payload?.ride || payload;
      if (ride) handleRideUpdate(ride);
    });
    const unsubAccepted = realtimeSync.on('RIDE_ACCEPTED', handleRideUpdate);

    const handleStorageChange = (e: StorageEvent) => {
      if (
        e.key === 'motoride_rides_store' ||
        e.key === 'motoride_active_rides_cache' ||
        e.key === 'motoride_realtime_ping' ||
        e.key?.startsWith('motoride_rated_rides')
      ) {
        loadActiveRide();
      }
    };
    window.addEventListener('storage', handleStorageChange);

    const unsubLocation = realtimeSync.on('CAPTAIN_LOCATION_UPDATED', (payload) => {
      setActiveRide((prev) => {
        if (prev && (prev.id === payload.ride_id || prev.captain_id === payload.captain_id)) {
          return {
            ...prev,
            captain_current_lat: payload.lat,
            captain_current_lng: payload.lng,
            captain_heading: payload.heading ?? prev.captain_heading,
          };
        }
        return prev;
      });

      if (payload.lat && payload.lng) {
        setAnimatedCaptainPos((prev) => ({
          lat: payload.lat,
          lng: payload.lng,
          heading: payload.heading ?? prev?.heading ?? 45,
        }));
      }

      // Also update coordinates in nearby captains list
      if (payload.captain_id && payload.lat && payload.lng) {
        setNearbyCaptains((prev) =>
          prev.map((c) =>
            c.id === payload.captain_id
              ? { ...c, lat: payload.lat, lng: payload.lng, heading: payload.heading ?? c.heading }
              : c
          )
        );
        setNearestCaptain((prev) => {
          if (prev && prev.id === payload.captain_id) {
            return { ...prev, lat: payload.lat, lng: payload.lng, heading: payload.heading ?? prev.heading };
          }
          return prev;
        });
      }
    });

    const unsubOffer = realtimeSync.on('RIDE_OFFER_RECEIVED', (payload: { ride: MotorideRide }) => {
      if (payload.ride.passenger_id === currentPassengerId) {
        if (payload.ride.status.includes('cancelled')) {
          setActiveRide(null);
        } else {
          setActiveRide(payload.ride);
        }
      }
    });

    // Continuous 2.5s polling to guarantee cross-browser / mobile sync even if SSE disconnects
    const pollTimer = setInterval(() => {
      loadActiveRide();
    }, 2500);

    const handleFocus = () => {
      if (document.visibilityState === 'visible') {
        loadActiveRide();
        loadRideHistory();
      }
    };
    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleFocus);

    return () => {
      unsubUpdate();
      unsubStatusChanged();
      unsubAccepted();
      unsubLocation();
      unsubOffer();
      clearInterval(pollTimer);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('storage', handleStorageChange);
      document.removeEventListener('visibilitychange', handleFocus);
    };
  }, [currentPassengerId, currentUser?.id, authUser?.id]);

  // Active ride live polling backup (ensures 0% missed status change even in background tabs or slow network)
  useEffect(() => {
    if (!activeRide?.id) return;
    const rideId = activeRide.id;
    let isCancelled = false;

    const poll = async () => {
      try {
        const latest = await motorideApi.getRideById(rideId);
        if (!isCancelled && latest) {
          const ratedIds = getRatedRideIds();
          if (latest.status.includes('cancelled')) {
            setActiveRide(null);
            setShowCaptainRatingModal(false);
            setCompletedRideForRating(null);
          } else if (latest.status === 'trip_completed' || latest.status === 'completed') {
            if (!latest.passenger_rated && !ratedIds.includes(latest.id)) {
              setActiveRide(latest);
              setCompletedRideForRating(latest);
              setShowCaptainRatingModal(true);
            } else {
              setActiveRide(null);
              setShowCaptainRatingModal(false);
              setCompletedRideForRating(null);
            }
          } else {
            setActiveRide((prev) => {
              if (!prev || prev.id !== latest.id) return latest;
              if (prev.status !== latest.status) {
                return { ...prev, ...latest };
              }
              return prev;
            });
          }
        }
      } catch {}
    };

    poll();
    const interval = setInterval(poll, 1500);
    return () => {
      isCancelled = true;
      clearInterval(interval);
    };
  }, [activeRide?.id]);

  // Animated Captain Progression for Active Ride on Passenger Map:
  // When 'captain_accepted': smoothly animate captain arriving to Pickup Location A
  // When 'captain_arrived': captain arrives and stays at Pickup Location A
  // When 'trip_started': smoothly animate captain traveling to Drop-off Location B
  useEffect(() => {
    if (!activeRide || !activeRide.captain_id) {
      setAnimatedCaptainPos(null);
      return;
    }

    const { status, pickup_lat, pickup_lng, dropoff_lat, dropoff_lng, captain_current_lat, captain_current_lng, captain_heading } = activeRide;

    // Initialize or re-anchor starting coordinates
    setAnimatedCaptainPos((prev) => {
      if (prev) return prev;
      if (captain_current_lat && captain_current_lng) {
        return {
          lat: captain_current_lat,
          lng: captain_current_lng,
          heading: captain_heading || 45,
        };
      }
      if (status === 'captain_accepted') {
        const initLat = Number((pickup_lat - 0.0055).toFixed(6));
        const initLng = Number((pickup_lng - 0.0045).toFixed(6));
        return {
          lat: initLat,
          lng: initLng,
          heading: calculateBearingDegrees(initLat, initLng, pickup_lat, pickup_lng),
        };
      }
      if (status === 'trip_started') {
        return {
          lat: pickup_lat,
          lng: pickup_lng,
          heading: calculateBearingDegrees(pickup_lat, pickup_lng, dropoff_lat, dropoff_lng),
        };
      }
      return {
        lat: pickup_lat,
        lng: pickup_lng,
        heading: 45,
      };
    });

    if (status === 'captain_arrived') {
      setAnimatedCaptainPos({
        lat: pickup_lat,
        lng: pickup_lng,
        heading: calculateBearingDegrees(pickup_lat, pickup_lng, dropoff_lat, dropoff_lng),
      });
      return;
    }

    if (status === 'trip_completed') {
      setAnimatedCaptainPos({
        lat: dropoff_lat,
        lng: dropoff_lng,
        heading: 0,
      });
      return;
    }

    const isAccepted = status === 'captain_accepted';
    const isTripStarted = status === 'trip_started';

    if (!isAccepted && !isTripStarted) return;

    const targetLat = isAccepted ? pickup_lat : dropoff_lat;
    const targetLng = isAccepted ? pickup_lng : dropoff_lng;

    const interval = setInterval(() => {
      setAnimatedCaptainPos((prev) => {
        if (!prev) {
          const startLat = isAccepted ? pickup_lat - 0.0055 : pickup_lat;
          const startLng = isAccepted ? pickup_lng - 0.0045 : pickup_lng;
          return {
            lat: startLat,
            lng: startLng,
            heading: calculateBearingDegrees(startLat, startLng, targetLat, targetLng),
          };
        }

        const dLat = targetLat - prev.lat;
        const dLng = targetLng - prev.lng;
        const dist = Math.hypot(dLat, dLng);

        if (dist < 0.0001) {
          return {
            ...prev,
            lat: targetLat,
            lng: targetLng,
          };
        }

        // Smooth incremental advance towards destination
        const step = Math.min(0.00035, dist * 0.16);
        const ratio = dist > 0 ? step / dist : 0;
        const newLat = prev.lat + dLat * ratio;
        const newLng = prev.lng + dLng * ratio;
        const bearing = calculateBearingDegrees(prev.lat, prev.lng, targetLat, targetLng);

        return {
          lat: Number(newLat.toFixed(6)),
          lng: Number(newLng.toFixed(6)),
          heading: bearing,
        };
      });
    }, 1400);

    return () => clearInterval(interval);
  }, [activeRide?.id, activeRide?.status, activeRide?.pickup_lat, activeRide?.pickup_lng, activeRide?.dropoff_lat, activeRide?.dropoff_lng]);

  // Continuously fetch and update available captains & nearest captain on passenger map
  useEffect(() => {
    let isMounted = true;

    const fetchCaptains = async () => {
      try {
        const refLat = pickup.name ? pickup.lat : passengerGps.lat;
        const refLng = pickup.name ? pickup.lng : passengerGps.lng;
        const res = await motorideApi.getAvailableCaptains(refLat, refLng);
        if (!isMounted) return;

        const mapped: AvailableCaptainItem[] = (res.captains || [])
          .filter((c) => c.current_lat != null && c.current_lng != null)
          .map((c) => ({
            id: c.id,
            name: c.name,
            lat: c.current_lat!,
            lng: c.current_lng!,
            heading: c.current_heading || 45,
            rating: c.rating,
            vehicleModel: c.vehicle_model,
            vehiclePlate: c.plate_number,
            vehicleType: c.vehicle_type,
            distanceKm: (c as any).distance_km,
            etaMinutes: (c as any).eta_minutes,
            isNearest: Boolean((c as any).is_nearest),
          }));

        setNearbyCaptains(mapped);

        if (res.nearestCaptain && res.nearestCaptain.current_lat != null && res.nearestCaptain.current_lng != null) {
          setNearestCaptain({
            id: res.nearestCaptain.id,
            name: res.nearestCaptain.name,
            lat: res.nearestCaptain.current_lat,
            lng: res.nearestCaptain.current_lng,
            heading: res.nearestCaptain.current_heading || 45,
            rating: res.nearestCaptain.rating,
            vehicleModel: res.nearestCaptain.vehicle_model,
            vehiclePlate: res.nearestCaptain.plate_number,
            vehicleType: res.nearestCaptain.vehicle_type,
            distanceKm: (res.nearestCaptain as any).distance_km,
            etaMinutes: (res.nearestCaptain as any).eta_minutes,
            isNearest: true,
          });
        } else if (mapped.length > 0) {
          setNearestCaptain(mapped[0]);
        } else {
          setNearestCaptain(null);
        }
      } catch (err) {
        console.warn('Failed to load available captains for passenger map:', err);
      }
    };

    fetchCaptains();
    const interval = setInterval(fetchCaptains, 4000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [passengerGps.lat, passengerGps.lng, pickup.lat, pickup.lng, pickup.name]);

  const loadFareSettings = async () => {
    try {
      const s = await motorideApi.getFareSettings();
      if (s) setFareSettings(s);
    } catch {}
  };

  // Sync and calculate true completed trips done by the assigned captain
  useEffect(() => {
    if (!activeRide || (!activeRide.captain_id && !activeRide.captain_name)) {
      setCaptainActualTrips(0);
      return;
    }

    if (activeRide.captain_total_rides !== undefined && activeRide.captain_total_rides > 0) {
      setCaptainActualTrips(activeRide.captain_total_rides);
      return;
    }

    let isMounted = true;
    const fetchCaptainCompletedTrips = async () => {
      try {
        const allRides = await motorideApi.getRides();
        if (!isMounted) return;
        const cptId = activeRide.captain_id;
        const cptName = activeRide.captain_name;
        const trips = allRides.filter((r) => {
          const isCaptain = (cptId && r.captain_id === cptId) ||
            (cptName && r.captain_name && r.captain_name.toLowerCase() === cptName.toLowerCase());
          const isCompleted = r.status === 'completed' || r.status === 'trip_completed';
          return isCaptain && isCompleted;
        });
        setCaptainActualTrips(trips.length);
      } catch {
        if (isMounted) {
          setCaptainActualTrips(activeRide.captain_total_rides ?? 0);
        }
      }
    };

    fetchCaptainCompletedTrips();
    return () => {
      isMounted = false;
    };
  }, [activeRide?.id, activeRide?.captain_id, activeRide?.captain_name, activeRide?.captain_total_rides]);

  const loadActiveRide = async () => {
    try {
      const pid = currentPassengerId || currentUser?.id || authUser?.id || '';
      let rides = await motorideApi.getRides(pid ? { passenger_id: pid } : undefined);
      
      // If we have an active ride ID in memory or ref, also fetch it directly
      if (activeRideRef.current?.id) {
        const specific = await motorideApi.getRideById(activeRideRef.current.id);
        if (specific && !rides.some((r) => r.id === specific.id)) {
          rides = [specific, ...rides];
        }
      }

      const ratedIds = getRatedRideIds();
      const active = rides.find(
        (r) =>
          r && (
            r.status === 'requested' ||
            r.status === 'captain_offered' ||
            r.status === 'captain_accepted' ||
            r.status === 'captain_arrived' ||
            r.status === 'trip_started' ||
            ((r.status === 'trip_completed' || r.status === 'completed') && !r.passenger_rated && !ratedIds.includes(r.id))
          )
      );

      if (active) {
        setActiveRide((prev) => {
          if (!prev || prev.id !== active.id) return active;
          return {
            ...prev,
            ...active,
            status: active.status,
            final_fare: active.final_fare || prev.final_fare,
            captain_name: active.captain_name || prev.captain_name,
            captain_phone: active.captain_phone || prev.captain_phone,
            vehicle_model: active.vehicle_model || prev.vehicle_model,
            plate_number: active.plate_number || prev.plate_number,
            captain_avatar: (active as any).captain_avatar || (active as any).avatar_url || (prev as any).captain_avatar || (prev as any).avatar_url,
          };
        });

        if ((active.status === 'trip_completed' || active.status === 'completed') && !active.passenger_rated && !ratedIds.includes(active.id)) {
          setCompletedRideForRating(active);
          setShowCaptainRatingModal(true);
        } else {
          setCompletedRideForRating(null);
          setShowCaptainRatingModal(false);
        }
      } else {
        if (activeRideRef.current) {
          setActiveRide(null);
          setCompletedRideForRating(null);
          setShowCaptainRatingModal(false);
        }
      }
    } catch {}
  };

  const loadRideHistory = async () => {
    try {
      const allRides = await motorideApi.getRides();
      const psgId = currentPassengerId || authUser?.id;
      const psgName = effectivePassengerName;
      const rides = allRides.filter((r) => 
        (psgId && r.passenger_id === psgId) ||
        (psgName && r.passenger_name && r.passenger_name.toLowerCase() === psgName.toLowerCase())
      );
      setRideHistory(rides);
    } catch {}
  };

  // Handle Book Ride
  const handleBookRide = async () => {
    if (!hasSelectedLocations || offeredFare <= 0) {
      return;
    }
    const activePickup = pickup.name?.trim() ? pickup : PRESET_LOCATIONS[0];
    const activeDropoff = dropoff.name?.trim() ? dropoff : PRESET_LOCATIONS[1];

    setIsBooking(true);
    try {
      const calcDistance = distanceKm > 0 ? distanceKm : 3.5;
      const calcDuration = durationMin > 0 ? durationMin : 10;
      const calcFare = offeredFare > 0 ? offeredFare : (estimatedFare > 0 ? estimatedFare : 75);
      const actualCompletedCount = rideHistory.filter((r) => r.status === 'trip_completed' || r.status === 'completed').length;

      const newRide = await motorideApi.createRide({
        passenger_id: currentPassengerId || authUser?.id || '',
        passenger_name: effectivePassengerName,
        passenger_phone: authUser?.phone || '+91 97800 12345',
        passenger_avatar: authUser?.avatarUrl || safeStorage.getItem('motoride_passenger_avatar') || '/passenger_avatar_default.jpg',
        passenger_rating: 5.0,
        passenger_total_rides: actualCompletedCount,
        pickup_address: activePickup.name,
        pickup_lat: activePickup.lat,
        pickup_lng: activePickup.lng,
        dropoff_address: activeDropoff.name,
        dropoff_lat: activeDropoff.lat,
        dropoff_lng: activeDropoff.lng,
        distance_km: calcDistance,
        duration_minutes: calcDuration,
        estimated_fare: estimatedFare > 0 ? estimatedFare : calcFare,
        offered_fare: calcFare,
        ride_type: rideType,
        payment_method: paymentMethod,
        comment: rideComment.trim() || undefined,
        notes: rideComment.trim() || undefined,
      });
      setActiveRide(newRide);
      safeStorage.setItem('motoride_active_passenger_ride_id', newRide.id);
      loadRideHistory();

      // Immediately link current live GPS coordinates to the new ride in Supabase
      motorideApi
        .updatePassengerLiveLocation({
          passenger_id: currentPassengerId,
          ride_id: newRide.id,
          latitude: passengerGps.lat,
          longitude: passengerGps.lng,
          accuracy: passengerGps.accuracy,
          heading: passengerGps.heading,
          speed: passengerGps.speed,
        })
        .catch(() => {});
    } catch (err: any) {
      alert(err.message || 'Failed to request ride');
    } finally {
      setIsBooking(false);
    }
  };

  // Instant Captain Acceptance for testing
  const handleSimulateInstantAccept = async () => {
    if (!activeRide) return;
    try {
      const realName = safeStorage.getItem('motoride_captain_name') || 'Captain Nearby';
      const realPhone = safeStorage.getItem('motoride_captain_phone') || '';
      const realModel = safeStorage.getItem('motoride_captain_vehicle_model') || 'Motorcycle';
      const realPlate = safeStorage.getItem('motoride_captain_plate') || '';
      const realAvatar = safeStorage.getItem('motoride_captain_avatar') || undefined;

      const updated = await motorideApi.acceptRide(activeRide.id, {
        captain_id: 'cpt_instant_01',
        captain_name: realName,
        captain_phone: realPhone,
        captain_avatar: realAvatar,
        vehicle_model: realModel,
        plate_number: realPlate,
        accepted_fare: activeRide.offered_fare || 75,
      });
      setActiveRide(updated);
    } catch (err: any) {
      console.warn('Instant match notice:', err);
    }
  };

  // Passenger Accepts a Captain's Counter Offer
  const handleAcceptOffer = async (offerId: string) => {
    if (!activeRide) return;
    try {
      const updated = await motorideApi.acceptCounterOffer(activeRide.id, offerId);
      setActiveRide(updated);

      // Re-affirm live location on counter-offer acceptance
      motorideApi
        .updatePassengerLiveLocation({
          passenger_id: currentPassengerId,
          ride_id: updated.id,
          latitude: passengerGps.lat,
          longitude: passengerGps.lng,
          accuracy: passengerGps.accuracy,
          heading: passengerGps.heading,
          speed: passengerGps.speed,
        })
        .catch(() => {});
    } catch (err: any) {
      alert(err.message || 'Failed to accept offer');
    }
  };

  // Cancel Current Ride (Optimistic state update without blocking modals for iframe sandbox)
  const handleCancelRide = async () => {
    if (!activeRide || isCancelling) return;
    setIsCancelling(true);
    const rideIdToCancel = activeRide.id;
    const isAlreadyCompleted = activeRide.status === 'trip_completed' || activeRide.status === 'completed';
    try {
      safeStorage.removeItem('motoride_active_passenger_ride_id');
      markRideAsRated(rideIdToCancel);
      setActiveRide(null);
      setCompletedRideForRating(null);
      setShowCaptainRatingModal(false);
      setDropoff({ name: '', lat: 0, lng: 0 });
      setDropoffInputText('');

      if (!isAlreadyCompleted) {
        await motorideApi.updateRideStatus(rideIdToCancel, 'cancelled_by_passenger', {
          cancellation_reason: 'Passenger cancelled/closed the active ride',
        });
      }
      loadRideHistory();
    } catch (err: any) {
      console.warn('Cancel ride notice:', err);
      loadRideHistory();
    } finally {
      setIsCancelling(false);
    }
  };

  // Passenger explicitly triggers completion/rating flow if captain already dropped off or ride finished
  const handleTriggerRatingFlow = () => {
    if (!activeRide) return;
    const completedRide: MotorideRide = {
      ...activeRide,
      status: 'trip_completed',
      final_fare: activeRide.final_fare || activeRide.offered_fare || 75,
    };
    setActiveRide(completedRide);
    setCompletedRideForRating(completedRide);
    setShowCaptainRatingModal(true);
  };

  // Rating Submit Handlers
  const handleFinishPassengerRating = async (
    score: number,
    review: string = '',
    tags: string[] = [],
    skipRating: boolean = false
  ) => {
    const rideToFinish = completedRideForRating || activeRide;
    if (!rideToFinish) {
      setShowCaptainRatingModal(false);
      return;
    }

    setIsSubmittingRating(true);
    try {
      markRideAsRated(rideToFinish.id);

      // Finalize status to completed in database / state
      try {
        await motorideApi.updateRideStatus(rideToFinish.id, 'completed', {
          final_fare: rideToFinish.final_fare || rideToFinish.offered_fare || 75,
          final_distance_km: rideToFinish.distance_km,
        });
      } catch (err) {
        console.warn('Status update notice:', err);
      }

      if (!skipRating && rideToFinish.captain_id) {
        try {
          await motorideApi.submitRideRating({
            ride_id: rideToFinish.id,
            rater_role: 'passenger',
            passenger_id: currentPassengerId,
            captain_id: rideToFinish.captain_id,
            score: score || 5,
            review: review,
            tags: tags,
          });
        } catch (e) {
          console.warn('Passenger rating submit notice:', e);
        }
      }
      setActiveRide(null);
      setCompletedRideForRating(null);
      setShowCaptainRatingModal(false);
      setDropoff({ name: '', lat: 0, lng: 0 });
      setDropoffInputText('');
      loadRideHistory();
    } catch (err) {
      console.error('Rating completion error:', err);
      setActiveRide(null);
      setCompletedRideForRating(null);
      setShowCaptainRatingModal(false);
      setDropoff({ name: '', lat: 0, lng: 0 });
      setDropoffInputText('');
    } finally {
      setIsSubmittingRating(false);
    }
  };

  const handleRateRide = async () => {
    const rideToFinish = completedRideForRating || activeRide;
    if (rideToFinish) {
      setRatingSubmitted(true);
      await handleFinishPassengerRating(ratingScore, reviewText, [], false);
      setRatingSubmitted(false);
    }
  };

  const renderMap = (isFullBackground: boolean) => {
    // When active ride is present, ensure Location A and Location B are taken from active ride
    const currentPickupLat = activeRide
      ? activeRide.pickup_lat
      : (pickup.name === 'My Live GPS Location' ? (passengerGps.lat || 30.704649) : (pickup.lat && pickup.lat > 0 ? pickup.lat : null));
    const currentPickupLng = activeRide
      ? activeRide.pickup_lng
      : (pickup.name === 'My Live GPS Location' ? (passengerGps.lng || 76.717873) : (pickup.lng && pickup.lng > 0 ? pickup.lng : null));
    const currentPickupAddress = activeRide
      ? activeRide.pickup_address
      : (pickup.lat && pickup.lat > 0 ? pickup.name : (pickup.name === 'My Live GPS Location' ? 'My Live GPS Location' : undefined));

    const currentDropoffLat = activeRide
      ? activeRide.dropoff_lat
      : (dropoff.lat && dropoff.lat > 0 ? dropoff.lat : null);
    const currentDropoffLng = activeRide
      ? activeRide.dropoff_lng
      : (dropoff.lng && dropoff.lng > 0 ? dropoff.lng : null);
    const currentDropoffAddress = activeRide
      ? activeRide.dropoff_address
      : (dropoff.lat && dropoff.lat > 0 ? (dropoff.name || dropoffInputText.trim()) : undefined);

    const currentCaptainLat = activeRide?.captain_id
      ? (animatedCaptainPos?.lat ?? activeRide.captain_current_lat ?? null)
      : null;
    const currentCaptainLng = activeRide?.captain_id
      ? (animatedCaptainPos?.lng ?? activeRide.captain_current_lng ?? null)
      : null;
    const currentCaptainHeading = animatedCaptainPos?.heading ?? activeRide?.captain_heading ?? 45;

    const effectiveKm = Number(activeRide?.distance_km || 0) > 0
      ? Number(activeRide!.distance_km)
      : distanceKm;
    const effectiveDuration = Number(activeRide?.duration_minutes || 0) > 0
      ? Number(activeRide!.duration_minutes)
      : durationMin;
    const effectiveRideType = activeRide?.ride_type || rideType;

    return (
      <MotorideMap
        passengerLat={passengerGps.lat}
        passengerLng={passengerGps.lng}
        passengerAccuracy={passengerGps.accuracy}
        passengerHeading={passengerGps.heading}
        passengerName={currentGpsLocationName || 'Standing Here'}
        showPassengerOnly={false}
        nearbyCaptains={activeRide ? [] : nearbyCaptains}
        nearestCaptain={activeRide ? null : nearestCaptain}
        showLocationsABOnly={Boolean(activeRide)}
        isLiveGpsActive={gpsStatus === 'live'}
        onLocateMe={requestLiveLocation}
        pickupLat={currentPickupLat}
        pickupLng={currentPickupLng}
        pickupAddress={currentPickupAddress}
        dropoffLat={currentDropoffLat}
        dropoffLng={currentDropoffLng}
        dropoffAddress={currentDropoffAddress}
        pickupDistanceText={undefined}
        dropoffDistanceText={effectiveKm > 0 ? `${effectiveKm}km` : undefined}
        rideDistanceText={effectiveKm > 0 ? `${effectiveKm} km (~${effectiveDuration} min)` : undefined}
        totalDistanceKm={effectiveKm > 0 ? effectiveKm : null}
        rideType={effectiveRideType}
        captainLat={currentCaptainLat}
        captainLng={currentCaptainLng}
        captainHeading={currentCaptainHeading}
        captainName={activeRide?.captain_name || 'Captain'}
        activeRideStatus={activeRide?.status}
        bottomSheetPadding={activeRide ? (isCardMinimized ? 90 : 380) : 180}
        interactive={!activeRide}
        onSetPickupToPassengerLocation={(lat, lng) => handleSetPickupFromPassengerPosition(lat, lng)}
        onMapClick={async (lat, lng) => {
          if (activeRide) return;

          const isTargetingPickup = activeMapTarget === 'pickup' || !pickup.name || !pickup.lat;

          if (isTargetingPickup) {
            const initialName = getFastLocationName(lat, lng);
            setPickup({
              name: initialName,
              lat,
              lng,
            });
            setPickupInputText(initialName);
            setActiveMapTarget('dropoff');

            setPickupToastMessage(`📍 From: ${initialName}`);
            setShowPickupToast(true);
            setTimeout(() => setShowPickupToast(false), 3500);

            try {
              const accurateName = await resolveLocationNameAsync(lat, lng);
              if (accurateName) {
                setPickup((prev) => (prev.lat === lat && prev.lng === lng ? { ...prev, name: accurateName } : prev));
                setPickupInputText((prev) => (prev === initialName ? accurateName : prev));
                setPickupToastMessage(`📍 From: ${accurateName}`);
              }
            } catch {}
          } else {
            const initialName = getFastLocationName(lat, lng);
            setDropoff({
              name: initialName,
              lat,
              lng,
            });
            setDropoffInputText(initialName);

            setPickupToastMessage(`🎯 Destination: ${initialName}`);
            setShowPickupToast(true);
            setTimeout(() => setShowPickupToast(false), 3500);

            try {
              const accurateName = await resolveLocationNameAsync(lat, lng);
              if (accurateName) {
                setDropoff((prev) => (prev.lat === lat && prev.lng === lng ? { ...prev, name: accurateName } : prev));
                setDropoffInputText((prev) => (prev === initialName ? accurateName : prev));
                setPickupToastMessage(`🎯 Destination: ${accurateName}`);
              }
            } catch {}
          }
        }}
        className={`w-full h-full ${isFullBackground ? 'rounded-none border-0' : 'shadow-2xl border border-slate-800'}`}
      />
    );
  };

  // Helper to get reliable captain avatar picture
  const getCaptainAvatarUrl = (name?: string, avatar?: string) => {
    if (avatar && avatar.trim()) return avatar;
    const localCaptainAvatar = safeStorage.getItem('motoride_captain_avatar');
    if (localCaptainAvatar && localCaptainAvatar.trim()) return localCaptainAvatar;
    const cleanName = (name && name !== 'Captain' && name.trim()) ? name : 'Captain';
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(cleanName)}&background=0284c7&color=fff&bold=true`;
  };

  const renderControlPanel = () => (
    <div className="flex flex-col gap-4">
      {activeRide ? (
          /* Active Ride Cards - White Background with Black Text, Icons and Dark Black Outlines */
          <div className="bg-white border-2 border-black rounded-3xl p-5 flex flex-col gap-4 shadow-2xl text-black">
            {/* Top Pull Down / Drop Down Handle Bar */}
            <div
              onClick={() => setIsCardMinimized(true)}
              className="w-full -mt-2 -mb-1 py-1 flex flex-col items-center justify-center cursor-pointer group select-none"
              title="Drop down active ride to see full map"
            >
              <div className="w-12 h-1.5 rounded-full bg-slate-300 group-hover:bg-black transition-colors" />
            </div>

            {/* Status Header */}
            <div className="flex items-center justify-between pb-3 border-b border-black/20">
              <div>
                <span className="text-[11px] font-mono-num font-black text-black block">
                  {activeRide.ride_code}
                </span>
                <h2 className="text-base font-black text-black capitalize">
                  {activeRide.status.replace(/_/g, ' ')}
                </h2>
              </div>

              <div className="flex items-center gap-2">
                {/* Minimize Button in Active Ride */}
                <button
                  type="button"
                  onClick={() => setIsCardMinimized(true)}
                  className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-black border border-black text-xs font-black transition-all active:scale-95 cursor-pointer group shadow-xs flex items-center justify-center"
                  title="Minimize ride details to view full map"
                  aria-label="Minimize ride details"
                >
                  <ChevronDown className="w-4 h-4 text-black group-hover:translate-y-0.5 transition-transform stroke-[2.5]" />
                </button>

                <div className="w-9 h-9 rounded-2xl bg-slate-100 border border-black flex items-center justify-center shrink-0">
                  <Bike className="w-5 h-5 text-black stroke-[2.5]" />
                </div>
              </div>
            </div>

            {/* Passenger Live GPS Sharing Status in Active Ride - Hidden once captain accepts ride */}
            {(activeRide.status === 'requested' || activeRide.status === 'captain_offered') && (
              gpsErrorMessage ? (
                <div className="p-3 rounded-2xl bg-rose-50 border border-black text-rose-900 text-xs flex items-center justify-between gap-3 font-semibold">
                  <div className="flex items-center gap-2 min-w-0">
                    <AlertCircle className="w-4 h-4 text-rose-700 shrink-0" />
                    <span className="font-bold">{gpsErrorMessage}</span>
                  </div>
                  <button
                    type="button"
                    onClick={startWatchingLocation}
                    className="px-2.5 py-1 rounded-xl bg-black hover:bg-slate-800 text-white font-bold text-xs shrink-0 active:scale-95 cursor-pointer shadow border border-black"
                  >
                    Enable GPS
                  </button>
                </div>
              ) : (
                <div className="px-3 py-2 rounded-2xl bg-slate-50 border border-black flex items-center justify-between text-xs text-black">
                  <div className="flex items-center gap-2">
                    <div className="relative flex items-center justify-center w-2.5 h-2.5">
                      <span className="absolute w-full h-full rounded-full bg-black/40 animate-ping opacity-75" />
                      <span className="relative w-2 h-2 rounded-full bg-black" />
                    </div>
                    <span className="text-slate-800 font-bold">Live GPS Sharing:</span>
                    <span className="text-black font-black">Active</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-slate-700 font-mono-num font-bold">
                      {passengerGps.accuracy ? `±${Math.round(passengerGps.accuracy)}m` : 'High Precision'}
                    </span>
                    {nowTick - passengerGps.timestamp > 30000 && (
                      <span className="text-[10px] text-black bg-slate-200 px-1.5 py-0.5 rounded border border-black/30 font-black">
                        Stale (&gt;30s)
                      </span>
                    )}
                  </div>
                </div>
              )
            )}

            {/* Case 1: Searching Nearby Captains Radar - White Background with Black Text and Icons */}
            {(activeRide.status === 'requested' || activeRide.status === 'captain_offered') && (
              <div className="flex flex-col items-center justify-center py-6 text-center text-black">
                <div className="relative flex items-center justify-center w-28 h-28 my-2">
                  <div className="absolute inset-0 rounded-full bg-slate-200/80 animate-ping border border-black/10" />
                  <div className="absolute w-20 h-20 rounded-full bg-slate-200 animate-pulse border border-black/20" />
                  <div className="w-14 h-14 rounded-full bg-black flex items-center justify-center text-white font-black shadow-lg border border-black">
                    <Bike className="w-7 h-7 text-white stroke-[2.5]" />
                  </div>
                </div>
                <h3 className="text-base font-black text-black mt-2">
                  Radar Active • Contacting Captains
                </h3>
                <p className="text-xs text-slate-700 font-medium max-w-xs mt-1">
                  Broadcasting your offer of{' '}
                  <span className="text-black font-black font-mono-num">
                    ₹{activeRide.offered_fare}
                  </span>{' '}
                  to all nearby active captains in real time.
                </p>

                {/* Incoming Counter Offers from Captains */}
                {activeRide.offers && activeRide.offers.length > 0 && (
                  <div className="w-full mt-5 flex flex-col gap-2.5 text-left">
                    <h4 className="text-xs font-black text-black flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-black" />
                      <span>Incoming Captain Offers ({activeRide.offers.length})</span>
                    </h4>
                    {activeRide.offers.map((offer) => (
                      <div
                        key={offer.id}
                        className="p-3 rounded-2xl bg-slate-50 border-2 border-black flex items-center justify-between gap-3 shadow-xs text-black"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          {/* Captain Profile Pick */}
                          <div className="relative shrink-0">
                            <img
                              src={getCaptainAvatarUrl(offer.captain_name, offer.captain_avatar || offer.avatar_url)}
                              alt={offer.captain_name || 'Captain'}
                              referrerPolicy="no-referrer"
                              className="w-11 h-11 rounded-full object-cover border-2 border-black bg-slate-200 shadow-xs"
                              onError={(e) => {
                                (e.currentTarget as HTMLImageElement).src =
                                  `https://ui-avatars.com/api/?name=${encodeURIComponent(offer.captain_name || 'Captain')}&background=0284c7&color=fff&bold=true`;
                              }}
                            />
                            <span
                              className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-black text-white flex items-center justify-center text-[9px] font-black border border-white"
                              title="Verified Captain"
                            >
                              ✓
                            </span>
                          </div>

                          {/* Captain Info */}
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-black text-sm text-black truncate">
                                {offer.captain_name}
                              </span>
                              <div className="flex flex-col items-center leading-none shrink-0">
                                <span className="flex items-center text-[10px] text-black bg-slate-200 px-1.5 py-0.5 rounded border border-black/30 font-bold leading-none">
                                  <Star className="w-3 h-3 fill-black text-black mr-0.5" />
                                  {offer.rating}
                                </span>
                                {(offer.captain_total_rides !== undefined || offer.total_rides !== undefined) && (
                                  <span className="text-[10px] text-slate-700 font-bold font-mono-num leading-none mt-0.5">
                                    ({offer.captain_total_rides ?? offer.total_rides ?? 0})
                                  </span>
                                )}
                              </div>
                            </div>
                            <p className="text-[11px] text-slate-700 mt-0.5 font-medium truncate">
                              {offer.vehicle_model} • {offer.plate_number}
                            </p>
                          </div>
                        </div>

                        {/* Counter Fare & Accept Button */}
                        <div className="flex flex-col items-end gap-1 shrink-0">
                          <span className="text-sm font-black text-black font-mono-num">
                            ₹{offer.counter_fare}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleAcceptOffer(offer.id)}
                            className="px-3.5 py-1.5 rounded-xl bg-black hover:bg-slate-800 text-white font-black text-xs shadow-md border border-black transition-all active:scale-95 cursor-pointer"
                          >
                            Accept
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Cancel Button */}
                <div className="w-full mt-5">
                  <button
                    type="button"
                    onClick={handleCancelRide}
                    disabled={isCancelling}
                    className="w-full py-2.5 px-4 rounded-2xl bg-slate-100 hover:bg-slate-200 border border-black text-black font-black text-xs flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-[0.98] shadow-xs disabled:opacity-50"
                    aria-label="Cancel Ride Request"
                  >
                    <XCircle className="w-4 h-4 text-black shrink-0" />
                    <span>{isCancelling ? 'Cancelling Request...' : 'Cancel Ride Request'}</span>
                  </button>
                </div>
              </div>
            )}

            {/* Case 2: Captain Accepted / Arrived / Trip Started */}
            {(activeRide.status === 'captain_accepted' ||
              activeRide.status === 'captain_arrived' ||
              activeRide.status === 'trip_started') && (
              <div className="flex flex-col gap-4 text-black">
                {/* Digital Watch on Top of Ride Details (Shown ONLY when captain is on the way to pickup) */}
                {activeRide.status === 'captain_accepted' && (
                  <DigitalWatchETA
                    ride={activeRide}
                    captainLat={animatedCaptainPos?.lat ?? activeRide.captain_current_lat}
                    captainLng={animatedCaptainPos?.lng ?? activeRide.captain_current_lng}
                    variant="card-header"
                  />
                )}

                {/* When Captain has arrived, show arrival banner */}
                {activeRide.status === 'captain_arrived' && (
                  <div className="w-full rounded-2xl bg-emerald-500 text-slate-950 px-4 py-3 border-2 border-black font-black flex items-center justify-between shadow-md select-none animate-in fade-in duration-200">
                    <div className="flex items-center gap-2.5">
                      <span className="w-3 h-3 rounded-full bg-slate-950 animate-ping shrink-0" />
                      <span className="text-xs sm:text-sm font-black uppercase tracking-wide">
                        Captain has arrived at pickup location!
                      </span>
                    </div>
                    <span className="text-[11px] bg-slate-950 text-white px-2.5 py-1 rounded-xl font-bold shrink-0">
                      Waiting for you
                    </span>
                  </div>
                )}

                {/* When Trip has started, show on-trip banner */}
                {activeRide.status === 'trip_started' && (
                  <div className="w-full rounded-2xl bg-slate-950 text-white px-4 py-3 border-2 border-black font-black flex items-center justify-between shadow-md select-none animate-in fade-in duration-200">
                    <div className="flex items-center gap-2.5">
                      <span className="w-3 h-3 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                      <div>
                        <span className="text-xs sm:text-sm font-black uppercase tracking-wide text-white block">
                          Trip in Progress
                        </span>
                        <span className="text-[11px] text-slate-300 font-normal block truncate max-w-[220px] sm:max-w-xs">
                          En route to: {activeRide.dropoff_address || 'Destination (Location B)'}
                        </span>
                      </div>
                    </div>
                    <span className="text-[11px] bg-emerald-500 text-slate-950 px-2.5 py-1 rounded-xl font-bold shrink-0">
                      On Trip
                    </span>
                  </div>
                )}

                {/* Captain Details Box */}
                <div className="p-4 sm:p-4.5 rounded-3xl bg-white border border-slate-200/90 shadow-sm flex items-center justify-between">
                  <div className="flex items-center gap-3.5">
                    {/* Photo with Rating & Trips below */}
                    <div className="flex flex-col items-center shrink-0">
                      <div className="relative">
                        <img
                          src={getCaptainAvatarUrl(activeRide.captain_name || undefined, (activeRide as any).captain_avatar || (activeRide as any).avatar_url)}
                          alt={activeRide.captain_name || 'Captain'}
                          referrerPolicy="no-referrer"
                          className="w-13 h-13 rounded-full object-cover border-2 border-white ring-2 ring-slate-200 shadow-sm bg-slate-100"
                          onError={(e) => {
                            (e.currentTarget as HTMLImageElement).src =
                              `https://ui-avatars.com/api/?name=${encodeURIComponent(activeRide.captain_name || 'Captain')}&background=0284c7&color=fff&bold=true`;
                          }}
                        />
                        <span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-black text-white flex items-center justify-center text-[9px] font-black border border-white">
                          ✓
                        </span>
                      </div>
                      {/* Rating Tab & (Trips) just below photo */}
                      <div className="flex flex-col items-center mt-1.5 leading-none">
                        <span className="flex items-center gap-0.5 text-[11px] text-amber-950 bg-amber-100/90 border border-amber-300/80 px-2 py-0.5 rounded-md font-black leading-none shadow-2xs">
                          <Star className="w-2.5 h-2.5 fill-amber-400 text-amber-500 mr-0.5 shrink-0" />
                          {activeRide.captain_rating !== undefined ? Number(activeRide.captain_rating).toFixed(1) : '5.0'}
                        </span>
                        <span className="text-[11px] text-slate-700 font-bold font-mono-num leading-none mt-1">
                          ({captainActualTrips})
                        </span>
                      </div>
                    </div>

                    <div>
                      <span className="font-black text-slate-900 text-sm sm:text-base block">
                        {activeRide.captain_name && activeRide.captain_name !== 'Captain'
                          ? activeRide.captain_name
                          : (safeStorage.getItem('motoride_captain_name') || 'Assigned Captain')}
                      </span>
                      <p className="text-xs sm:text-sm text-slate-600 font-mono-num mt-1 font-medium">
                        {(activeRide.vehicle_model || safeStorage.getItem('motoride_captain_vehicle_model') || 'Motorcycle')}{' '}
                        •{' '}
                        <span className="text-black font-black">
                          {(activeRide.plate_number || safeStorage.getItem('motoride_captain_plate') || 'Verified')}
                        </span>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setShowChatModal(true);
                        setHasUnreadMessages(false);
                        if (activeRide?.id) {
                          safeStorage.setItem(`motoride_last_read_chat_${activeRide.id}`, Date.now().toString());
                        }
                      }}
                      className="p-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white border border-emerald-500 shadow-sm shadow-emerald-600/25 transition-all active:scale-95 cursor-pointer flex items-center justify-center relative"
                      title="Chat with Captain"
                    >
                      <MessageSquare className="w-4 h-4 stroke-[2.5] text-white" />
                      {hasUnreadMessages && (
                        <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5 z-10" title="New message received">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-500 opacity-80"></span>
                          <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-rose-600 border-2 border-white shadow-md"></span>
                        </span>
                      )}
                    </button>
                    {(activeRide.captain_phone || safeStorage.getItem('motoride_captain_phone')) && (
                      <a
                        href={`tel:${activeRide.captain_phone || safeStorage.getItem('motoride_captain_phone')}`}
                        className="p-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold shadow-sm shadow-emerald-600/25 transition-all active:scale-95 border border-emerald-500 flex items-center justify-center"
                        title="Call Captain"
                      >
                        <Phone className="w-4 h-4 stroke-[2.5] text-white" />
                      </a>
                    )}
                  </div>
                </div>

                {/* Progress Indicators */}
                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <div
                    className={`p-2 rounded-xl border ${
                      activeRide.status === 'captain_accepted'
                        ? 'bg-black text-white border-black font-black'
                        : 'bg-slate-100 border-black/30 text-slate-600 font-semibold'
                    }`}
                  >
                    1. En Route
                  </div>
                  <div
                    style={activeRide.status === 'captain_arrived' ? { backgroundColor: '#174309', borderColor: '#174309' } : undefined}
                    className={`p-2 rounded-xl border ${
                      activeRide.status === 'captain_arrived'
                        ? 'text-white font-black shadow-xs'
                        : 'bg-slate-100 border-black/30 text-slate-600 font-semibold'
                    }`}
                  >
                    2. Arrived
                  </div>
                  <div
                    style={activeRide.status === 'trip_started' ? { backgroundColor: '#DAA520', borderColor: '#DAA520', color: '#020617' } : undefined}
                    className={`p-2 rounded-xl border ${
                      activeRide.status === 'trip_started'
                        ? 'text-slate-950 font-black shadow-xs'
                        : 'bg-slate-100 border-black/30 text-slate-600 font-semibold'
                    }`}
                  >
                    3. Riding
                  </div>
                </div>

                {/* Fare and payment summary */}
                <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-100 border border-black">
                  <span className="text-xs text-black font-bold">Agreed Fare:</span>
                  <span className="font-mono-num font-black text-base text-black">
                    ₹{activeRide.final_fare || activeRide.offered_fare}
                  </span>
                </div>

                {activeRide.status === 'trip_started' ? (
                  <div className="flex flex-col gap-2 mt-1">
                    <button
                      type="button"
                      onClick={handleTriggerRatingFlow}
                      className="w-full py-2.5 rounded-xl bg-black hover:bg-slate-900 text-white font-black text-xs flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-[0.98] shadow-md border border-black"
                    >
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      <span>Arrived at Destination • Rate Captain</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleCancelRide}
                      disabled={isCancelling}
                      className="w-full py-2 rounded-xl border border-rose-300 text-rose-700 bg-rose-50 hover:bg-rose-100 text-xs font-black flex items-center justify-center gap-1.5 cursor-pointer transition-colors active:scale-[0.98] disabled:opacity-50"
                      aria-label="Cancel Trip"
                    >
                      <XCircle className="w-4 h-4 shrink-0 text-rose-600" />
                      <span>{isCancelling ? 'Cancelling...' : 'Cancel'}</span>
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={handleCancelRide}
                    disabled={isCancelling}
                    className="w-full py-2.5 rounded-xl border border-black text-black bg-slate-100 hover:bg-slate-200 text-xs font-black flex items-center justify-center gap-2 cursor-pointer transition-colors active:scale-[0.98] disabled:opacity-50"
                    aria-label="Cancel Ride"
                  >
                    <XCircle className="w-4 h-4 shrink-0 text-black" />
                    <span>{isCancelling ? 'Cancelling...' : 'Cancel Ride'}</span>
                  </button>
                )}
              </div>
            )}

            {/* Case 3: Trip Completed & Rating Form */}
            {(activeRide.status === 'trip_completed' || activeRide.status === 'completed') && (
              <div className="flex flex-col items-center text-center py-4 gap-3 text-black">
                <div className="w-14 h-14 rounded-full bg-emerald-50 text-emerald-600 border-2 border-emerald-500 flex items-center justify-center shadow-xs">
                  <CheckCircle2 className="w-8 h-8 stroke-[2.5]" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900">Trip Completed! 🎉</h3>
                  <p className="text-xs text-slate-600 font-medium">
                    Total distance: {activeRide.distance_km} km • Final Fare:{' '}
                    <span className="font-mono-num font-black text-emerald-600">
                      ₹{activeRide.final_fare || activeRide.offered_fare}
                    </span>
                  </p>
                </div>

                {/* 1-5 Star Rating */}
                <div className="w-full mt-2 p-4 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col items-center gap-3">
                  <span className="text-xs font-black text-slate-900">
                    Rate {activeRide.captain_name && activeRide.captain_name !== 'Captain' ? activeRide.captain_name : 'Captain'}
                  </span>
                  <div className="flex items-center gap-2">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        type="button"
                        key={star}
                        onClick={() => setRatingScore(star)}
                        className="p-1 cursor-pointer transition-transform hover:scale-110 active:scale-95"
                      >
                        <Star
                          className={`w-8 h-8 transition-colors ${
                            star <= ratingScore
                              ? 'fill-amber-400 text-amber-400 drop-shadow-[0_0_4px_rgba(251,191,36,0.4)]'
                              : 'text-slate-300 hover:text-slate-400'
                          }`}
                        />
                      </button>
                    ))}
                  </div>

                  <input
                    type="text"
                    value={reviewText}
                    onChange={(e) => setReviewText(e.target.value)}
                    placeholder="Leave feedback for captain (e.g. smooth ride, on time)"
                    className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-white border border-slate-200 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-black font-medium"
                  />

                  <div className="w-full flex flex-col gap-2 mt-1">
                    <button
                      type="button"
                      onClick={handleRateRide}
                      disabled={ratingSubmitted || isSubmittingRating}
                      className="w-full py-3 rounded-xl bg-black hover:bg-slate-900 text-white font-black text-xs shadow-md transition-all active:scale-95 cursor-pointer disabled:opacity-50 border border-black flex items-center justify-center gap-2"
                    >
                      <Star className="w-4 h-4 fill-white text-white" />
                      <span>{ratingSubmitted || isSubmittingRating ? 'Submitting...' : 'Submit Rating & Done'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleFinishPassengerRating(5, '', [], true)}
                      disabled={ratingSubmitted || isSubmittingRating}
                      className="w-full py-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 text-xs font-semibold cursor-pointer transition-colors"
                    >
                      Skip & Done
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Standard Ride Booking Form - Clean Borderless Modern Compact Layout */
          <div className="bg-white rounded-3xl p-3.5 sm:p-4 flex flex-col gap-2.5 shadow-2xl text-black">
            {/* Top Pull Down / Minimize Handle Bar */}
            <div
              onClick={() => setIsCardMinimized(true)}
              className="w-full -mt-1 py-0.5 flex items-center justify-center cursor-pointer group select-none"
              title="Minimize booking form to see full map"
            >
              <div className="w-10 h-1.5 rounded-full bg-slate-200 group-hover:bg-slate-400 transition-colors" />
            </div>

            {/* Service / Ride Type Selector - Show on Top of Booking Page */}
            <div className="grid grid-cols-2 gap-1.5 bg-slate-100 p-1.5 rounded-xl">
              {[
                { type: 'bike' as RideTypeCode, label: 'Bike', icon: Bike },
                { type: 'courier' as RideTypeCode, label: 'Courier', icon: Package },
              ].map((s) => {
                const Icon = s.icon;
                const isSelected = rideType === s.type;
                return (
                  <button
                    key={s.type}
                    type="button"
                    onClick={() => setRideType(s.type)}
                    className={`flex flex-col items-center justify-center py-2 px-2 rounded-lg transition-all cursor-pointer active:scale-95 ${
                      isSelected
                        ? 'bg-black text-white ring-2 ring-emerald-400 shadow-md scale-[1.02]'
                        : 'bg-black/90 text-white hover:bg-black'
                    }`}
                    title={s.label}
                  >
                    <Icon className="w-5 h-5 text-white stroke-[2.5]" />
                    <span className="text-[11px] font-bold text-white mt-0.5">{s.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Location Permission Denied / Error Banner */}
            {gpsErrorMessage && (
              <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center justify-between gap-2 shadow-sm">
                <div className="flex items-center gap-2 min-w-0">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span className="font-semibold text-xs leading-snug">{gpsErrorMessage}</span>
                </div>
                <button
                  type="button"
                  onClick={startWatchingLocation}
                  className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shrink-0 active:scale-95 transition-all cursor-pointer shadow"
                >
                  Allow Access
                </button>
              </div>
            )}

            {/* From Field (Pickup Location) */}
            <div className="flex flex-col gap-1 relative">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-black text-black tracking-wider flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span className="font-black">From</span>
                </label>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveMapTarget('pickup');
                      setPickupToastMessage('📍 Tap anywhere on map to set pickup location');
                      setShowPickupToast(true);
                      setTimeout(() => setShowPickupToast(false), 3000);
                    }}
                    className={`flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md border transition-colors cursor-pointer ${
                      activeMapTarget === 'pickup'
                        ? 'bg-emerald-100 text-emerald-800 border-emerald-400'
                        : 'bg-slate-100 hover:bg-slate-200 text-black border-transparent'
                    }`}
                    title="Tap on map to select pickup location"
                  >
                    <MapPin className="w-2.5 h-2.5 text-emerald-600" />
                    <span>Map</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (pickupMode === 'preset') {
                        setPickupMode('manual');
                        setPickupInputText(pickup.name || '');
                        setShowPickupSuggestions(true);
                      } else {
                        setPickupMode('preset');
                        setShowPickupSuggestions(false);
                      }
                    }}
                    className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 hover:bg-slate-200 text-black transition-colors cursor-pointer"
                  >
                    {pickupMode === 'preset' ? (
                      <>
                        <PenLine className="w-2.5 h-2.5 text-black" />
                        <span className="text-black">Write Manually</span>
                      </>
                    ) : (
                      <>
                        <List className="w-2.5 h-2.5 text-black" />
                        <span className="text-black">Select Preset</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {pickupMode === 'preset' ? (
                <div className="relative flex items-center">
                  <select
                    value={pickup.name}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === '__MANUAL_WRITE__') {
                        setPickupMode('manual');
                        setPickupInputText(pickup.name || '');
                        setShowPickupSuggestions(true);
                        return;
                      }
                      if (val === 'My Live GPS Location' || val === currentGpsLocationName) {
                        handleSetPickupFromPassengerPosition();
                        requestLiveLocation();
                        return;
                      }
                      const found = PRESET_LOCATIONS.find((l) => l.name === val);
                      if (found) {
                        setPickup(found);
                      }
                    }}
                    className="w-full pl-8 pr-14 py-2 rounded-xl bg-slate-100 hover:bg-slate-200/80 text-xs text-black font-semibold focus:outline-none focus:ring-2 focus:ring-black appearance-none cursor-pointer transition-colors shadow-xs"
                  >
                    <option value="" disabled className="bg-white text-slate-500">
                      Select Pickup Location
                    </option>
                    <option value={currentGpsLocationName} className="bg-white text-emerald-700 font-bold">
                      📍 {currentGpsLocationName} (Current Location)
                    </option>
                    {pickup.name && pickup.name !== currentGpsLocationName && !PRESET_LOCATIONS.some((loc) => loc.name === pickup.name) && (
                      <option value={pickup.name} className="bg-white text-emerald-700 font-bold">
                        📍 {pickup.name}
                      </option>
                    )}
                    {PRESET_LOCATIONS.map((loc) => (
                      <option key={loc.name} value={loc.name} className="bg-white text-black">
                        {loc.name}
                      </option>
                    ))}
                    <option value="__MANUAL_WRITE__" className="bg-white text-blue-700 font-bold">
                      ✍️ Type Custom Address Manually...
                    </option>
                  </select>
                  <MapPin className="w-3.5 h-3.5 text-emerald-600 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none stroke-[2.5]" />
                  
                  {/* Right Corner: Clear Cross Sign & Dropdown Indicator */}
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 z-10">
                    {pickup.name ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSetPickupFromPassengerPosition();
                        }}
                        title="Reset to current location"
                        aria-label="Reset to current location"
                        className="p-1 rounded-md bg-slate-200 hover:bg-slate-300 text-black transition-all cursor-pointer flex items-center justify-center active:scale-95 shadow-xs"
                      >
                        <X className="w-3 h-3 stroke-[2.5]" />
                      </button>
                    ) : null}
                    <ChevronDown className="w-3.5 h-3.5 text-black pointer-events-none stroke-[2.5]" />
                  </div>
                </div>
              ) : (
                <div ref={pickupContainerRef} className="relative flex flex-col">
                  <div className="relative flex items-center">
                    <input
                      type="text"
                      value={pickupInputText}
                      onChange={(e) => handleManualPickupChange(e.target.value)}
                      onKeyDown={handlePickupKeyDown}
                      onFocus={() => {
                        setShowPickupSuggestions(true);
                        setActiveMapTarget('pickup');
                      }}
                      placeholder="Type custom pickup location..."
                      className="w-full pl-8 pr-20 py-2 rounded-xl bg-slate-100 text-xs text-black placeholder-slate-500 font-semibold focus:outline-none focus:ring-2 focus:ring-black shadow-xs"
                    />
                    <MapPin className="w-3.5 h-3.5 text-emerald-600 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none stroke-[2.5]" />

                    <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 z-10">
                      {isSearchingPickup && (
                        <Loader2 className="w-3 h-3 text-black animate-spin" />
                      )}
                      {pickup.name && pickup.lat > 0 && (
                        <span className="text-[9px] font-bold text-emerald-700 bg-emerald-100 px-1 py-0.5 rounded flex items-center gap-0.5 shrink-0">
                          <Check className="w-2.5 h-2.5 stroke-[3]" />
                          {pickup.name === pickupInputText ? 'Selected' : 'On Map'}
                        </span>
                      )}
                      {pickupInputText ? (
                        <button
                          type="button"
                          onClick={() => {
                            setPickupInputText('');
                            setPickup({ name: '', lat: 0, lng: 0 });
                            setPickupSuggestions([]);
                          }}
                          title="Clear pickup text"
                          className="p-1 rounded-md bg-slate-200 hover:bg-slate-300 text-black transition-all cursor-pointer flex items-center justify-center active:scale-95"
                        >
                          <X className="w-3 h-3 stroke-[2.5]" />
                        </button>
                      ) : null}
                    </div>
                  </div>

                  {/* Suggestions Popover */}
                  {showPickupSuggestions && pickupSuggestions.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-1 z-50 bg-white rounded-xl shadow-2xl overflow-hidden max-h-52 overflow-y-auto border border-slate-100">
                      <div className="px-2.5 py-1 text-[9px] uppercase font-bold text-slate-700 bg-slate-100 flex items-center justify-between">
                        <span>Matching Places</span>
                        <span className="text-emerald-700 font-bold">Tap to select</span>
                      </div>
                      {pickupSuggestions.map((item, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            handleSelectPickupSuggestion(item);
                          }}
                          onClick={() => handleSelectPickupSuggestion(item)}
                          className="w-full px-3 py-1.5 text-left text-xs text-slate-800 hover:bg-emerald-50 hover:text-black flex items-center justify-between gap-2 border-b border-slate-100 last:border-0 transition-colors cursor-pointer group"
                        >
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            <MapPin className="w-3 h-3 text-black shrink-0 group-hover:text-emerald-700 transition-colors" />
                            <span className="truncate font-semibold text-slate-900">{item.name}</span>
                          </div>
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-100 group-hover:bg-emerald-600 group-hover:text-white text-slate-600 shrink-0 transition-colors">
                            Select
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* To Field (Destination Drop-off) */}
            <div className="flex flex-col gap-1 relative">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-black text-black tracking-wider flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-rose-500" />
                  <span className="font-black">To</span>
                </label>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveMapTarget('dropoff');
                      setPickupToastMessage('🎯 Tap anywhere on map to set destination');
                      setShowPickupToast(true);
                      setTimeout(() => setShowPickupToast(false), 3000);
                    }}
                    className={`flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md border transition-colors cursor-pointer ${
                      activeMapTarget === 'dropoff'
                        ? 'bg-blue-100 text-blue-800 border-blue-400'
                        : 'bg-slate-100 hover:bg-slate-200 text-black border-transparent'
                    }`}
                    title="Tap on map to select destination"
                  >
                    <Navigation className="w-2.5 h-2.5 text-blue-600" />
                    <span>Map</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (dropoffMode === 'preset') {
                        setDropoffMode('manual');
                        setDropoffInputText(dropoff.name || '');
                        setShowDropoffSuggestions(true);
                      } else {
                        setDropoffMode('preset');
                        setShowDropoffSuggestions(false);
                      }
                    }}
                    className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 hover:bg-slate-200 text-black transition-colors cursor-pointer"
                  >
                    {dropoffMode === 'preset' ? (
                      <>
                        <PenLine className="w-2.5 h-2.5 text-black" />
                        <span className="text-black">Write Manually</span>
                      </>
                    ) : (
                      <>
                        <List className="w-2.5 h-2.5 text-black" />
                        <span className="text-black">Select Preset</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {dropoffMode === 'preset' ? (
                <div className="relative flex items-center">
                  <select
                    value={dropoff.name}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === '__MANUAL_WRITE__') {
                        setDropoffMode('manual');
                        setDropoffInputText(dropoff.name || '');
                        setShowDropoffSuggestions(true);
                        return;
                      }
                      const found = PRESET_LOCATIONS.find((l) => l.name === val);
                      if (found) setDropoff(found);
                    }}
                    className="w-full pl-8 pr-14 py-2 rounded-xl bg-slate-100 hover:bg-slate-200/80 text-xs text-black font-semibold focus:outline-none focus:ring-2 focus:ring-black appearance-none cursor-pointer transition-colors shadow-xs"
                  >
                    <option value="" disabled className="bg-white text-slate-500">
                      Select Dropoff Location
                    </option>
                    {dropoff.name && !PRESET_LOCATIONS.some((loc) => loc.name === dropoff.name) && (
                      <option value={dropoff.name} className="bg-white text-blue-700 font-bold">
                        🎯 {dropoff.name}
                      </option>
                    )}
                    {PRESET_LOCATIONS.map((loc) => (
                      <option key={loc.name} value={loc.name} className="bg-white text-black">
                        {loc.name}
                      </option>
                    ))}
                    <option value="__MANUAL_WRITE__" className="bg-white text-blue-700 font-bold">
                      ✍️ Type Custom Address Manually...
                    </option>
                  </select>
                  <Navigation className="w-3.5 h-3.5 text-black absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none stroke-[2.5]" />

                  {/* Right Corner: Clear Cross Sign & Dropdown Indicator */}
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 z-10">
                    {dropoff.name ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDropoff({ name: '', lat: 0, lng: 0 });
                          setDropoffInputText('');
                        }}
                        title="Cancel / Clear dropoff location"
                        aria-label="Cancel dropoff location"
                        className="p-1 rounded-md bg-slate-200 hover:bg-slate-300 text-black transition-all cursor-pointer flex items-center justify-center active:scale-95 shadow-xs"
                      >
                        <X className="w-3 h-3 stroke-[2.5]" />
                      </button>
                    ) : null}
                    <ChevronDown className="w-3.5 h-3.5 text-black pointer-events-none stroke-[2.5]" />
                  </div>
                </div>
              ) : (
                <div ref={dropoffContainerRef} className="relative flex flex-col">
                  <div className="relative flex items-center">
                    <input
                      ref={dropoffInputRef}
                      type="text"
                      value={dropoffInputText}
                      onChange={(e) => handleManualDropoffChange(e.target.value)}
                      onFocus={() => {
                        const q = dropoffInputText.trim();
                        const matches = q ? getInstantMatchingSuggestions(q) : KNOWN_LOCATIONS.slice(0, 7);
                        setDropoffSuggestions(matches);
                        setShowDropoffSuggestions(true);
                      }}
                      onKeyDown={handleDropoffKeyDown}
                      placeholder="Search drop location (e.g. Sector 7)..."
                      className="w-full pl-8 pr-20 py-2 rounded-xl bg-slate-100 text-xs text-black placeholder-slate-500 font-semibold focus:outline-none focus:ring-2 focus:ring-black shadow-xs"
                    />
                    <Navigation className="w-3.5 h-3.5 text-black absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none stroke-[2.5]" />

                    <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 z-10">
                      {isSearchingDropoff && (
                        <Loader2 className="w-3 h-3 text-black animate-spin" />
                      )}
                      {dropoff.name && dropoff.lat > 0 && (
                        <span className="text-[9px] font-bold text-emerald-700 bg-emerald-100 px-1 py-0.5 rounded flex items-center gap-0.5 shrink-0">
                          <Check className="w-2.5 h-2.5 stroke-[3]" />
                          {dropoff.name === dropoffInputText ? 'Selected' : 'On Map'}
                        </span>
                      )}
                      {dropoffInputText ? (
                        <button
                          type="button"
                          onClick={() => {
                            setDropoffInputText('');
                            setDropoff({ name: '', lat: 0, lng: 0 });
                            setDropoffSuggestions([]);
                            setShowDropoffSuggestions(false);
                          }}
                          title="Clear dropoff text"
                          className="p-1 rounded-md bg-slate-200 hover:bg-slate-300 text-black transition-all cursor-pointer flex items-center justify-center active:scale-95"
                        >
                          <X className="w-3 h-3 stroke-[2.5]" />
                        </button>
                      ) : null}
                    </div>
                  </div>

                  {/* High-Accuracy Drop-off Search Results Popover */}
                  {showDropoffSuggestions && dropoffSuggestions.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-1 z-50 bg-white rounded-xl shadow-2xl overflow-hidden max-h-56 overflow-y-auto divide-y divide-slate-100 border border-slate-100 animate-in fade-in slide-in-from-top-1 duration-150">
                      {dropoffSuggestions.map((item, idx) => {
                        const itemDist = activePickupLat && item.lat
                          ? calculateDistance(activePickupLat, activePickupLng, item.lat, item.lng)
                          : null;
                        return (
                          <button
                            key={`${item.name}-${idx}`}
                            type="button"
                            onMouseDown={(e) => {
                              e.preventDefault();
                              handleSelectDropoffSuggestion(item);
                            }}
                            onClick={() => handleSelectDropoffSuggestion(item)}
                            className="w-full px-3 py-2 text-left text-xs hover:bg-rose-50 flex items-center justify-between gap-2 transition-colors cursor-pointer group"
                          >
                            <div className="flex items-center gap-2 min-w-0 flex-1">
                              <div className="w-5 h-5 rounded-md bg-rose-100 group-hover:bg-rose-600 group-hover:text-white text-rose-600 flex items-center justify-center shrink-0 transition-colors">
                                <MapPin className="w-3 h-3 stroke-[2.5]" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="truncate font-black text-slate-900 group-hover:text-black text-xs">
                                  {item.name}
                                </div>
                                {itemDist !== null && (
                                  <div className="text-[9px] font-bold text-slate-500 group-hover:text-rose-700">
                                    ~{itemDist} km from pickup
                                  </div>
                                )}
                              </div>
                            </div>
                            <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-slate-100 group-hover:bg-rose-600 group-hover:text-white text-slate-700 shrink-0 transition-colors">
                              Select
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Fare & Payment Control Card */}
            <div className="p-2.5 sm:p-3 rounded-2xl bg-slate-100/90 flex flex-col gap-2.5 shadow-xs">
              {/* Fare Stepper: (-) Fare ₹ 0 (+) comment box icon */}
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setOfferedFare((prev) => Math.max(estimatedFare, prev - 5))}
                  disabled={!hasSelectedLocations || offeredFare <= estimatedFare}
                  className={`w-8 h-8 sm:w-9 sm:h-9 shrink-0 rounded-lg font-black text-lg flex items-center justify-center transition-all shadow-xs ${
                    !hasSelectedLocations || offeredFare <= estimatedFare
                      ? 'bg-slate-200/60 text-slate-400 cursor-not-allowed'
                      : 'bg-white text-black hover:bg-slate-200 cursor-pointer active:scale-95'
                  }`}
                  title={
                    !hasSelectedLocations
                      ? 'Select pickup & dropoff to set fare'
                      : offeredFare <= estimatedFare
                      ? `Cannot reduce below standard admin fare rate (₹${estimatedFare})`
                      : 'Decrease Fare'
                  }
                  aria-label="Decrease Fare"
                >
                  -
                </button>

                {/* Center: Fare ₹ 0 */}
                <div className="flex-1 min-w-0 flex items-center justify-center gap-1 bg-white rounded-lg hover:bg-slate-50 px-2.5 py-1.5 transition-all shadow-xs">
                  <span className="text-black text-xs font-bold whitespace-nowrap select-none">
                    Fare
                  </span>
                  <span className="text-black font-mono-num font-black text-sm sm:text-base">₹</span>
                  <input
                    type="number"
                    min={estimatedFare}
                    disabled={!hasSelectedLocations}
                    value={offeredFare}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setOfferedFare(Math.max(estimatedFare, isNaN(val) ? estimatedFare : val));
                    }}
                    className="w-12 sm:w-16 text-left font-mono-num font-black text-sm sm:text-base text-black bg-transparent focus:outline-none disabled:opacity-75"
                  />
                </div>

                <button
                  type="button"
                  onClick={() => setOfferedFare((prev) => prev + 5)}
                  disabled={!hasSelectedLocations}
                  className={`w-8 h-8 sm:w-9 sm:h-9 shrink-0 rounded-lg font-black text-lg flex items-center justify-center active:scale-95 transition-all shadow-xs ${
                    !hasSelectedLocations
                      ? 'bg-slate-200/60 text-slate-400 cursor-not-allowed'
                      : 'bg-white text-black hover:bg-slate-200 cursor-pointer'
                  }`}
                  title={!hasSelectedLocations ? 'Select pickup & dropoff to set fare' : 'Increase Fare'}
                  aria-label="Increase Fare"
                >
                  +
                </button>

                {/* Comment Box Icon */}
                <button
                  type="button"
                  onClick={() => setShowCommentInput((prev) => !prev)}
                  className={`w-8 h-8 sm:w-9 sm:h-9 shrink-0 rounded-lg cursor-pointer flex items-center justify-center active:scale-95 transition-all relative ${
                    rideComment.trim() || showCommentInput
                      ? 'bg-black text-white shadow-xs'
                      : 'bg-white text-black hover:bg-slate-200'
                  }`}
                  title="Add comment / instruction for captain"
                  aria-label="Add comment for captain"
                >
                  <MessageSquare className="w-3.5 h-3.5 stroke-[2.5]" />
                  {rideComment.trim() && (
                    <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-emerald-500 ring-2 ring-white" />
                  )}
                </button>
              </div>

              {/* Expandable Comment Box Input */}
              {showCommentInput && (
                <div className="relative animate-in fade-in slide-in-from-top-1 duration-150">
                  <input
                    type="text"
                    value={rideComment}
                    onChange={(e) => setRideComment(e.target.value)}
                    placeholder="Note for captain (e.g. Near gate 2, 2 bags, etc.)"
                    className="w-full pl-3 pr-8 py-1.5 rounded-lg bg-white text-xs text-black placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-black shadow-xs font-medium"
                    autoFocus
                  />
                  {rideComment && (
                    <button
                      type="button"
                      onClick={() => setRideComment('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-black text-xs cursor-pointer font-bold"
                    >
                      ✕
                    </button>
                  )}
                </div>
              )}

              {/* Pay Via: upi | cash */}
              <div className="flex items-center justify-between pt-1.5 border-t border-slate-200/80 text-xs">
                <span className="text-black font-black tracking-wide text-xs">Pay Via:</span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('upi')}
                    className={`px-3 py-1 rounded-lg font-black uppercase tracking-wider text-[11px] cursor-pointer transition-all ${
                      paymentMethod === 'upi'
                        ? 'bg-black text-white shadow-sm'
                        : 'bg-white text-black hover:bg-slate-200 font-bold'
                    }`}
                  >
                    upi
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('cash')}
                    className={`px-3 py-1 rounded-lg font-black lowercase tracking-wider text-[11px] cursor-pointer transition-all ${
                      paymentMethod === 'cash'
                        ? 'bg-black text-white shadow-sm'
                        : 'bg-white text-black hover:bg-slate-200 font-bold'
                    }`}
                  >
                    cash
                  </button>
                </div>
              </div>
            </div>

            {/* Book Button */}
            <button
              type="button"
              onClick={handleBookRide}
              disabled={isBooking || offeredFare <= 0 || !hasSelectedLocations}
              className={`w-full py-2.5 sm:py-3 rounded-xl font-black text-xs sm:text-sm transition-all active:scale-[0.98] flex items-center justify-center gap-2 ${
                isBooking || offeredFare <= 0 || !hasSelectedLocations
                  ? 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
                  : 'bg-black hover:bg-slate-900 text-white cursor-pointer shadow-lg'
              }`}
              title={
                offeredFare <= 0 || !hasSelectedLocations
                  ? 'Please select valid pickup and drop-off locations to calculate fare'
                  : 'Find Captain'
              }
            >
              <Send
                className={`w-3.5 h-3.5 stroke-[2.5] ${
                  isBooking || offeredFare <= 0 || !hasSelectedLocations ? 'text-slate-400' : 'text-white'
                }`}
              />
              <span>
                {isBooking
                  ? 'Broadcasting Offer...'
                  : !hasSelectedLocations
                  ? (!dropoff.name || !dropoff.lat ? 'Select Drop-off Destination' : 'Select Pickup Location')
                  : `Find Captain for ₹${offeredFare !== undefined ? offeredFare : 0}`}
              </span>
            </button>
          </div>
        )}
    </div>
  );

  return (
    <div className="relative w-full h-[calc(100dvh-64px)] sm:h-[calc(100vh-68px)] overflow-hidden bg-slate-100">
      {/* Background Map in Street View filling 100% of the canvas */}
      <div className="absolute inset-0 w-full h-full z-0">
        {renderMap(true)}
      </div>

      {/* Floating Instant Toast for Pickup Set via Passenger Icon Click */}
      {showPickupToast && (
        <div className="fixed sm:absolute top-16 sm:top-20 left-1/2 -translate-x-1/2 z-[1100] max-w-sm px-4 py-2.5 rounded-2xl bg-slate-950/95 border border-emerald-500/80 shadow-2xl backdrop-blur-xl text-white text-xs font-bold flex items-center gap-2.5 animate-in fade-in slide-in-from-top-3 duration-200">
          <div className="w-5 h-5 rounded-full bg-emerald-500 text-slate-950 flex items-center justify-center font-black text-xs shrink-0 shadow-sm">
            ✓
          </div>
          <span className="text-emerald-300 font-bold">{pickupToastMessage}</span>
        </div>
      )}

      {/* Passenger Profile 2-Lines Button in Left Top Corner */}
      <button
        type="button"
        onClick={() => setIsProfileOpen(true)}
        title="Open Passenger Profile"
        aria-label="Open Passenger Profile"
        className="fixed sm:absolute top-3 sm:top-4 left-3 sm:left-4 z-[900] p-2.5 sm:p-3 rounded-2xl bg-black/85 hover:bg-black text-white border border-white/20 shadow-2xl backdrop-blur-xl flex flex-col justify-center items-center gap-1.5 w-11 h-11 active:scale-95 transition-all cursor-pointer group"
      >
        <span className="w-5 h-0.5 bg-white rounded-full group-hover:w-5.5 transition-all" />
        <span className="w-3.5 h-0.5 bg-white rounded-full self-start ml-0.5 group-hover:w-5 transition-all" />
      </button>

      {/* Passenger Profile Slide-in Drawer from Left to Right */}
      <PassengerProfileDrawer
        isOpen={isProfileOpen}
        onClose={() => setIsProfileOpen(false)}
        currentUser={currentUser || authUser}
        passengerName={effectivePassengerName}
        passengerEmail={currentUser?.email || authUser?.email}
        passengerPhone={currentUser?.phone || authUser?.phone}
        totalRides={rideHistory.filter((r) => r.status === 'trip_completed' || r.status === 'completed').length}
        onOpenWallet={onOpenWallet}
        onOpenRideHistory={() => setIsRideHistoryOpen(true)}
        onSignOut={onSignOut}
        onSelectSavedLocation={(loc) => {
          setDropoff(loc);
        }}
      />

      {/* Ride History Modal for Passenger */}
      <MotorideRideHistoryModal
        isOpen={isRideHistoryOpen}
        onClose={() => setIsRideHistoryOpen(false)}
        role="passenger"
        userId={currentPassengerId || currentUser?.id || authUser?.id || ''}
        userName={effectivePassengerName}
        onBookNewRide={() => {
          setIsRideHistoryOpen(false);
          setIsCardMinimized(false);
        }}
      />

      {/* Bottom / Sidebar Booking Form & Active Trip Card Controls */}
      {isCardMinimized ? (
        /* Minimized Floating Bar (Drop Down Condition) */
        <div className="fixed sm:absolute bottom-3 sm:bottom-4 md:bottom-6 left-1/2 -translate-x-1/2 z-[1000] w-[calc(100%-1.25rem)] sm:w-[460px] md:w-[420px] animate-in fade-in slide-in-from-bottom-3 duration-200">
          <div
            onClick={() => setIsCardMinimized(false)}
            className="p-3 sm:p-3.5 rounded-3xl bg-slate-950 border border-slate-800 shadow-2xl flex items-center justify-between gap-3 hover:border-slate-700 transition-all cursor-pointer"
          >
            <div className="flex items-center gap-3 min-w-0 pr-2 flex-1">
              {activeRide?.captain_name ? (
                <div className="relative shrink-0">
                  <img
                    src={getCaptainAvatarUrl(activeRide.captain_name || undefined, (activeRide as any).captain_avatar || (activeRide as any).avatar_url)}
                    alt={activeRide.captain_name}
                    className="w-10 h-10 rounded-2xl object-cover border-2 border-emerald-400 bg-slate-200 shadow-md"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).src =
                        `https://ui-avatars.com/api/?name=${encodeURIComponent(activeRide.captain_name || 'Captain')}&background=0284c7&color=fff&bold=true`;
                    }}
                  />
                  <span className="absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full bg-emerald-500 border border-slate-950 flex items-center justify-center text-[8px] text-black font-black">
                    ✓
                  </span>
                </div>
              ) : (
                <div className="w-10 h-10 rounded-2xl bg-emerald-500 text-slate-950 flex items-center justify-center font-black text-lg shadow-md shrink-0">
                  🏍️
                </div>
              )}
              <div className="min-w-0 flex flex-col">
                <span className="text-xs font-bold text-white truncate">
                  {activeRide
                    ? `${activeRide.ride_code} • ${activeRide.status.replace(/_/g, ' ')}`
                    : `${pickup.name && pickup.lat ? pickup.name.split(',')[0] : 'Choose Pickup'} → ${dropoff.name && dropoff.lat ? dropoff.name.split(',')[0] : 'Choose Drop-off'}`}
                </span>
                <span className="text-[11px] text-emerald-400 font-mono-num font-semibold truncate">
                  {activeRide
                    ? activeRide.captain_name
                      ? `${activeRide.captain_name} (${activeRide.vehicle_model || 'Bike'}) • ₹${activeRide.final_fare || activeRide.offered_fare}`
                      : `Fare: ₹${activeRide.final_fare || activeRide.offered_fare} • Searching Captains...`
                    : hasSelectedLocations
                    ? `₹${offeredFare} • ${rideType.toUpperCase()} (Tap to expand booking)`
                    : `Select destinations to calculate fare`}
                </span>
              </div>
            </div>

            {/* Quick Chat with Captain in Minimized bar */}
            {activeRide && ['captain_accepted', 'captain_arrived', 'trip_started'].includes(activeRide.status) && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowChatModal(true);
                  setHasUnreadMessages(false);
                  safeStorage.setItem(`motoride_last_read_chat_${activeRide.id}`, Date.now().toString());
                }}
                className="p-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white border border-emerald-500 active:scale-95 cursor-pointer flex items-center justify-center relative shrink-0 shadow-sm"
                title="Chat with Captain"
              >
                <MessageSquare className="w-4 h-4 stroke-[2.5] text-white" />
                {hasUnreadMessages && (
                  <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5 z-10" title="New message received">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-500 opacity-80"></span>
                    <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-rose-600 border-2 border-white shadow-md"></span>
                  </span>
                )}
              </button>
            )}

            {/* Dropdown / Pull-up Expand Button */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsCardMinimized(false);
              }}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs shadow-lg shadow-emerald-500/20 active:scale-95 cursor-pointer transition-all shrink-0"
              title={activeRide ? 'Expand Active Ride Details' : 'Open booking form'}
            >
              <span>{activeRide ? 'Expand Ride' : 'Book Ride'}</span>
              <ChevronUp className="w-4 h-4 stroke-[3]" />
            </button>
          </div>
        </div>
      ) : (
        /* Expanded Booking Form */
        <div className="fixed sm:absolute bottom-3 sm:bottom-4 md:bottom-6 left-1/2 -translate-x-1/2 z-[1000] w-[calc(100%-1.25rem)] sm:w-[400px] md:w-[380px] max-h-[82dvh] sm:max-h-[calc(100vh-90px)] overflow-y-auto flex flex-col gap-2 pb-1 scrollbar-thin animate-in fade-in slide-in-from-bottom-4 duration-200">
          {renderControlPanel()}
        </div>
      )}

      {showChatModal && activeRide && (
        <div className="fixed inset-0 z-[2000] bg-slate-900/80 backdrop-blur-md flex flex-col p-3 sm:p-6 md:p-8 animate-in fade-in duration-150">
          <div className="w-full max-w-4xl mx-auto mb-3 sm:mb-4 flex items-center justify-between">
            <button
              onClick={() => {
                setShowChatModal(false);
                setHasUnreadMessages(false);
                if (activeRide?.id) {
                  safeStorage.setItem(`motoride_last_read_chat_${activeRide.id}`, Date.now().toString());
                }
              }}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-white hover:bg-slate-100 text-slate-900 font-extrabold text-xs sm:text-sm border border-slate-200 transition-all cursor-pointer shadow-lg active:scale-95"
            >
              <ArrowLeft className="w-4 h-4 stroke-[2.5] text-slate-900" />
              <span>Back to Ride Details</span>
            </button>
            <span className="text-xs text-white font-mono font-bold bg-black/50 px-3 py-1.5 rounded-xl border border-white/20 shadow-xs">Ride #{activeRide.ride_code}</span>
          </div>
          <div className="flex-1 w-full max-w-4xl mx-auto flex flex-col overflow-hidden">
            <RideChatModal
              ride={activeRide}
              currentUserId={currentPassengerId}
              currentUserRole="passenger"
              currentUserName={passengerName}
              onClose={() => {
                setShowChatModal(false);
                setHasUnreadMessages(false);
                if (activeRide?.id) {
                  safeStorage.setItem(`motoride_last_read_chat_${activeRide.id}`, Date.now().toString());
                }
              }}
            />
          </div>
        </div>
      )}

      {/* Passenger Captain Rating Modal */}
      {showCaptainRatingModal && (completedRideForRating || activeRide) && (
        <PassengerCaptainRatingModal
          ride={completedRideForRating || activeRide!}
          isSubmitting={isSubmittingRating}
          onSubmit={(score, review, tags) => handleFinishPassengerRating(score, review, tags, false)}
          onSkip={() => handleFinishPassengerRating(5, '', [], true)}
        />
      )}
    </div>
  );
};
