import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { Navigation, Crosshair, Compass, Mountain, Moon, LocateFixed } from 'lucide-react';
import { calculateHaversineDistanceKm } from '../../utils/distanceCalculator';

export type MapLayerType = 'google-street' | 'google-terrain' | 'voyager-dark';

interface MapLayerConfig {
  id: MapLayerType;
  label: string;
  shortLabel: string;
  tooltip: string;
  url: string;
  subdomains: string[];
  maxZoom: number;
}

const GOOGLE_MAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';

const MAP_LAYERS: Record<MapLayerType, MapLayerConfig> = {
  'google-street': {
    id: 'google-street',
    label: 'Google Street',
    shortLabel: 'Street',
    tooltip: 'Google Maps Roadmaps & Street View (Default)',
    url: `https://mt{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}${GOOGLE_MAPS_KEY ? `&key=${GOOGLE_MAPS_KEY}` : ''}`,
    subdomains: ['0', '1', '2', '3'],
    maxZoom: 20,
  },
  'google-terrain': {
    id: 'google-terrain',
    label: 'Google Terrain',
    shortLabel: 'Terrain',
    tooltip: 'Google Maps Topographic Terrain & Relief',
    url: `https://mt{s}.google.com/vt/lyrs=p&x={x}&y={y}&z={z}${GOOGLE_MAPS_KEY ? `&key=${GOOGLE_MAPS_KEY}` : ''}`,
    subdomains: ['0', '1', '2', '3'],
    maxZoom: 20,
  },
  'voyager-dark': {
    id: 'voyager-dark',
    label: 'Voyager Dark',
    shortLabel: 'Voyager Dark',
    tooltip: 'Voyager Dark Night Carto Style',
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    subdomains: ['a', 'b', 'c', 'd'],
    maxZoom: 19,
  },
};

export interface AvailableCaptainItem {
  id: string;
  name: string;
  lat: number;
  lng: number;
  heading?: number;
  rating?: number;
  vehicleModel?: string;
  vehiclePlate?: string;
  vehicleType?: string;
  distanceKm?: number;
  etaMinutes?: number;
  isNearest?: boolean;
}

interface MotorideMapProps {
  pickupLat?: number | null;
  pickupLng?: number | null;
  pickupAddress?: string;
  dropoffLat?: number | null;
  dropoffLng?: number | null;
  dropoffAddress?: string;
  pickupDistanceText?: string;
  dropoffDistanceText?: string;
  captainLat?: number | null;
  captainLng?: number | null;
  captainHeading?: number;
  captainAccuracy?: number | null;
  captainName?: string;
  isCaptainMode?: boolean;
  passengerLat?: number | null;
  passengerLng?: number | null;
  passengerHeading?: number | null;
  passengerAccuracy?: number | null;
  passengerName?: string;
  showPassengerOnly?: boolean;
  showLocationsABOnly?: boolean;
  bottomSheetPadding?: number;
  rideDistanceText?: string;
  totalDistanceKm?: number | null;
  rideType?: string | null;
  isLiveGpsActive?: boolean;
  onLocateMe?: () => void;
  onSetPickupToPassengerLocation?: (lat: number, lng: number) => void;
  interactive?: boolean;
  onMapClick?: (lat: number, lng: number) => void;
  className?: string;
  initialLayer?: MapLayerType;
  onLayerChange?: (layer: MapLayerType) => void;
  showOverlayControls?: boolean;
  nearbyCaptains?: AvailableCaptainItem[];
  nearestCaptain?: AvailableCaptainItem | null;
  onSelectCaptain?: (captain: AvailableCaptainItem) => void;
  onFocusNearestCaptain?: () => void;
  activeRideStatus?: string | null;
  focusCoords?: { lat: number; lng: number; zoom?: number; timestamp: number } | null;
}

export const MotorideMap: React.FC<MotorideMapProps> = ({
  pickupLat,
  pickupLng,
  pickupAddress,
  dropoffLat,
  dropoffLng,
  dropoffAddress,
  pickupDistanceText,
  dropoffDistanceText,
  captainLat,
  captainLng,
  captainHeading = 0,
  captainAccuracy,
  captainName = 'Captain (You)',
  isCaptainMode = false,
  passengerLat,
  passengerLng,
  passengerHeading = 0,
  passengerAccuracy,
  passengerName = 'You',
  showPassengerOnly = false,
  showLocationsABOnly = false,
  bottomSheetPadding,
  rideDistanceText,
  totalDistanceKm,
  rideType,
  isLiveGpsActive = false,
  onLocateMe,
  onSetPickupToPassengerLocation,
  interactive = true,
  onMapClick,
  className = 'w-full h-full',
  initialLayer = 'google-street',
  onLayerChange,
  showOverlayControls = false,
  nearbyCaptains = [],
  nearestCaptain = null,
  onSelectCaptain,
  onFocusNearestCaptain,
  activeRideStatus = null,
  focusCoords = null,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const pickupMarkerRef = useRef<L.Marker | null>(null);
  const dropoffMarkerRef = useRef<L.Marker | null>(null);
  const captainMarkerRef = useRef<L.Marker | null>(null);
  const captainAccuracyCircleRef = useRef<L.Circle | null>(null);
  const captainToTargetLineRef = useRef<L.Polyline | null>(null);
  const passengerMarkerRef = useRef<L.Marker | null>(null);
  const passengerAccuracyCircleRef = useRef<L.Circle | null>(null);
  const passengerToPickupLineRef = useRef<L.Polyline | null>(null);
  const polylineRef = useRef<L.Polyline | null>(null);
  const polylineGlowRef = useRef<L.Polyline | null>(null);
  const routeDistanceMarkerRef = useRef<L.Marker | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const nearbyCaptainMarkersRef = useRef<Map<string, L.Marker>>(new Map());
  const hasInitiallyCenteredPassengerRef = useRef<boolean>(false);
  const hasInitiallyCenteredCaptainRef = useRef<boolean>(false);
  const lastFittedRouteKeyRef = useRef<string>('');
  const [mapReady, setMapReady] = useState<boolean>(false);
  const [activeLayer, setActiveLayer] = useState<MapLayerType>(initialLayer);
  const [isFollowingPassenger, setIsFollowingPassenger] = useState<boolean>(true);
  const [isFollowingCaptain, setIsFollowingCaptain] = useState<boolean>(true);

  const handleSelectLayer = (layer: MapLayerType) => {
    setActiveLayer(layer);
    if (onLayerChange) {
      onLayerChange(layer);
    }
  };

  // Custom DivIcon for Passenger GPS Live Location using the uploaded passenger_icon.png
  const createPassengerIcon = (label: string = 'Where To ?', isPickupHere: boolean = false) =>
    L.divIcon({
      className: 'passenger-gps-live-marker',
      html: `
        <div style="position: relative; width: 72px; height: 72px; display: flex; flex-direction: column; align-items: center; justify-content: center; user-select: none; pointer-events: auto; cursor: pointer;" title="Click 'Where To ?' to set Passenger Pickup Location A">
          <!-- Top Floating Capsule Badge: Where To ? -->
          <div class="passenger-where-to-pill" style="position: absolute; top: -16px; left: 50%; transform: translateX(-50%); background: #020617; color: #ffffff; font-family: system-ui, -apple-system, sans-serif; font-size: 11px; font-weight: 900; padding: 3px 10px; border-radius: 9999px; border: 1.5px solid #3b82f6; white-space: nowrap; box-shadow: 0 4px 14px rgba(0,0,0,0.7), 0 0 10px rgba(59,130,246,0.35); pointer-events: auto; cursor: pointer; letter-spacing: 0.3px; z-index: 40; display: flex; align-items: center; gap: 5px;">
            <span style="width: 6px; height: 6px; border-radius: 50%; background: #3b82f6; display: inline-block; box-shadow: 0 0 6px #60a5fa;"></span>
            <span style="color: #ffffff; font-weight: 800;">${label || 'Where To ?'}</span>
          </div>

          <!-- Circular Badge with Uploaded Passenger Icon -->
          <div style="position: relative; width: 44px; height: 44px; border-radius: 50%; overflow: hidden; box-shadow: 0 4px 16px rgba(0,0,0,0.5), 0 0 0 2.5px #ffffff; z-index: 20; display: flex; align-items: center; justify-content: center; background: #1d3f84;">
            <img src="/passenger_icon.svg" alt="Passenger GPS" style="width: 100%; height: 100%; object-fit: cover; display: block; pointer-events: none;" />
          </div>

          <!-- Ground Contact Needle Tip / Pointer Arrow -->
          <div style="position: absolute; bottom: 8px; left: 50%; transform: translateX(-50%) rotate(45deg); width: 9px; height: 9px; background: #1d3f84; border-right: 1.5px solid #ffffff; border-bottom: 1.5px solid #ffffff; z-index: 15;"></div>
        </div>
      `,
      iconSize: [72, 72],
      iconAnchor: [36, 64],
      popupAnchor: [0, -64],
    });


  // Custom DivIcons for Location A and Location B
  const createPickupIcon = (pickupLocationName?: string, distanceText?: string, hideLabel: boolean = false) => {
    // Format clean distance badge e.g. "0m" or "2.1 km"
    let formattedDist = distanceText ? distanceText.trim() : '';
    if (formattedDist && !formattedDist.toLowerCase().endsWith('m') && !formattedDist.toLowerCase().endsWith('km')) {
      formattedDist = `${formattedDist} km`;
    }

    if (isCaptainMode) {
      const displayDist = formattedDist || '0m';
      return L.divIcon({
        className: 'custom-pin-icon marker-pin-a',
        html: `
          <div style="position: relative; width: 32px; height: 72px; display: flex; flex-direction: column; align-items: center; justify-content: flex-end; cursor: pointer; user-select: none; pointer-events: auto;">
            <div style="position: absolute; bottom: 74px; left: 50%; transform: translateX(-50%); padding: 3px 8px; border-radius: 9999px; background: #020617; color: #ffffff; font-weight: 900; font-size: 11px; border: 1.5px solid #10b981; box-shadow: 0 4px 16px rgba(0,0,0,0.75); white-space: nowrap; letter-spacing: 0.3px; font-family: system-ui, -apple-system, sans-serif; display: flex; align-items: center; gap: 5px; z-index: 50; pointer-events: none;">
              <span style="background: #10b981; color: #020617; width: 16px; height: 16px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; font-size: 10px; font-weight: 900;">A</span>
              <span style="color: #ffffff; font-weight: 900;">${displayDist}</span>
            </div>
            <div style="width: 28px; height: 70px; display: flex; align-items: center; justify-content: center; filter: drop-shadow(0 4px 8px rgba(0,0,0,0.45)); pointer-events: none;">
              <img src="/marker_green.svg" alt="Pickup A" style="width: 28px; height: 70px; object-fit: contain; pointer-events: none; display: block;" />
            </div>
          </div>
        `,
        iconSize: [32, 72],
        iconAnchor: [16, 70],
        popupAnchor: [0, -70],
      });
    }

    const rawName = pickupLocationName && pickupLocationName.trim() ? pickupLocationName.trim() : '';
    const isGenericPickup =
      !rawName ||
      rawName.toLowerCase().includes('my live gps') ||
      rawName.toLowerCase().includes('my pickup') ||
      rawName.toLowerCase().includes('standing here') ||
      rawName.toLowerCase().includes('current position') ||
      rawName.toLowerCase().includes('location a');

    const shouldShowLabel = !hideLabel || Boolean(distanceText);
    const shortName = isGenericPickup ? '' : (rawName.includes(',') ? rawName.split(',')[0].trim() : rawName);
    const displayName = shortName.length > 20 ? `${shortName.slice(0, 18)}…` : shortName;

    return L.divIcon({
      className: 'custom-pin-icon marker-pin-a',
      html: `
        <div style="position: relative; width: 32px; height: 72px; display: flex; flex-direction: column; align-items: center; justify-content: flex-end; cursor: pointer; user-select: none; pointer-events: auto;">
          ${shouldShowLabel ? `
            <div style="position: absolute; bottom: 74px; left: 50%; transform: translateX(-50%); padding: 3px 9px; border-radius: 9999px; background: #020617; color: #34d399; font-weight: 900; font-size: 11px; border: 1.5px solid #10b981; box-shadow: 0 4px 16px rgba(0,0,0,0.75); white-space: nowrap; letter-spacing: 0.3px; font-family: system-ui, -apple-system, sans-serif; display: flex; align-items: center; gap: 5px; z-index: 50; pointer-events: none;">
              <span style="display: flex; align-items: center; gap: 4px;">
                <span style="background: #10b981; color: #020617; width: 16px; height: 16px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; font-size: 10px; font-weight: 900;">A</span>
                ${displayName ? `<span style="max-width: 140px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: #ffffff;">${displayName}</span>` : ''}
              </span>
              ${formattedDist ? `<span style="background: #10b981; color: #020617; padding: 1px 6px; border-radius: 9999px; font-size: 10px; font-weight: 900; letter-spacing: 0.3px; box-shadow: 0 1px 4px rgba(16,185,129,0.4);">${formattedDist}</span>` : ''}
            </div>
          ` : ''}
          <div style="width: 28px; height: 70px; display: flex; align-items: center; justify-content: center; filter: drop-shadow(0 4px 8px rgba(0,0,0,0.45)); pointer-events: none;">
            <img src="/marker_green.svg" alt="Pickup A" style="width: 28px; height: 70px; object-fit: contain; pointer-events: none; display: block;" />
          </div>
        </div>
      `,
      iconSize: [32, 72],
      iconAnchor: [16, 70],
      popupAnchor: [0, -70],
    });
  };

  const createDropoffIcon = (destinationName?: string, distanceText?: string) => {
    let formattedDist = distanceText ? distanceText.trim() : '';
    if (formattedDist && !formattedDist.toLowerCase().endsWith('m') && !formattedDist.toLowerCase().endsWith('km')) {
      formattedDist = `${formattedDist} km`;
    }

    if (isCaptainMode) {
      const displayDist = formattedDist || '23.4 km';
      return L.divIcon({
        className: 'custom-pin-icon marker-pin-b',
        html: `
          <div style="position: relative; width: 32px; height: 72px; display: flex; flex-direction: column; align-items: center; justify-content: flex-end; cursor: pointer; user-select: none; pointer-events: auto;">
            <div style="position: absolute; bottom: 74px; left: 50%; transform: translateX(-50%); padding: 3px 8px; border-radius: 9999px; background: #020617; color: #ffffff; font-weight: 900; font-size: 11px; border: 1.5px solid #f43f5e; box-shadow: 0 4px 16px rgba(0,0,0,0.75); white-space: nowrap; letter-spacing: 0.3px; font-family: system-ui, -apple-system, sans-serif; display: flex; align-items: center; gap: 5px; z-index: 50; pointer-events: none;">
              <span style="background: #f43f5e; color: #ffffff; width: 16px; height: 16px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; font-size: 10px; font-weight: 900;">B</span>
              <span style="color: #ffffff; font-weight: 900;">${displayDist}</span>
            </div>
            <div style="width: 28px; height: 70px; display: flex; align-items: center; justify-content: center; filter: drop-shadow(0 4px 8px rgba(0,0,0,0.45)); pointer-events: none;">
              <img src="/marker_red.svg" alt="Destination B" style="width: 28px; height: 70px; object-fit: contain; pointer-events: none; display: block;" />
            </div>
          </div>
        `,
        iconSize: [32, 72],
        iconAnchor: [16, 70],
        popupAnchor: [0, -70],
      });
    }

    const rawName = destinationName && destinationName.trim() ? destinationName.trim() : 'Drop-off (B)';
    const shortName = rawName.includes(',') ? rawName.split(',')[0].trim() : rawName;
    const displayName = shortName.length > 20 ? `${shortName.slice(0, 18)}…` : shortName;

    return L.divIcon({
      className: 'custom-pin-icon marker-pin-b',
      html: `
        <div style="position: relative; width: 32px; height: 72px; display: flex; flex-direction: column; align-items: center; justify-content: flex-end; cursor: pointer; user-select: none; pointer-events: auto;">
          <div style="position: absolute; bottom: 74px; left: 50%; transform: translateX(-50%); padding: 3px 9px; border-radius: 9999px; background: #020617; color: #fb7185; font-weight: 900; font-size: 11px; border: 1.5px solid #f43f5e; box-shadow: 0 4px 16px rgba(0,0,0,0.75); white-space: nowrap; letter-spacing: 0.3px; font-family: system-ui, -apple-system, sans-serif; display: flex; align-items: center; gap: 5px; z-index: 50; pointer-events: none;">
            <span style="display: flex; align-items: center; gap: 4px;">
              <span style="background: #f43f5e; color: #ffffff; width: 16px; height: 16px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; font-size: 10px; font-weight: 900;">B</span>
              <span style="max-width: 140px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: #ffffff;">${displayName}</span>
            </span>
            ${formattedDist ? `<span style="background: #f43f5e; color: #ffffff; padding: 1px 6px; border-radius: 9999px; font-size: 10px; font-weight: 900; letter-spacing: 0.3px; box-shadow: 0 1px 4px rgba(244,63,94,0.4);">${formattedDist}</span>` : ''}
          </div>
          <div style="width: 28px; height: 70px; display: flex; align-items: center; justify-content: center; filter: drop-shadow(0 4px 8px rgba(0,0,0,0.45)); pointer-events: none;">
            <img src="/marker_red.svg" alt="Destination B" style="width: 28px; height: 70px; object-fit: contain; pointer-events: none; display: block;" />
          </div>
        </div>
      `,
      iconSize: [32, 72],
      iconAnchor: [16, 70],
      popupAnchor: [0, -70],
    });
  };

  const createCaptainIcon = (
    heading: number = 0,
    name: string = 'You • Captain',
    accuracy?: number | null,
    isSelf: boolean = true,
    isNearest: boolean = false,
    etaMinutes?: number,
    distanceKm?: number,
    activeStatus?: string | null
  ) => {
    const isArrivingPickup = activeStatus === 'captain_accepted';
    const isArrivedPickup = activeStatus === 'captain_arrived';
    const isGoingDropoff = activeStatus === 'trip_started';
    const isTripDone = activeStatus === 'trip_completed';

    const distText = distanceKm != null ? (distanceKm < 1 ? `${Math.round(distanceKm * 1000)}m` : `${distanceKm.toFixed(1)}km`) : '';

    let borderColor = isCaptainMode ? '#0f172a' : isNearest ? '#10b981' : isSelf ? '#0f172a' : '#38bdf8';
    let glowShadow = isCaptainMode ? '0 4px 14px rgba(0, 0, 0, 0.4)' : isNearest ? '0 4px 16px rgba(16, 185, 129, 0.5)' : '0 4px 14px rgba(0, 0, 0, 0.4)';
    let statusPillHtml = '';

    if (isCaptainMode) {
      statusPillHtml = '';
    } else if (isArrivingPickup) {
      borderColor = '#10b981';
      glowShadow = '0 4px 18px rgba(16, 185, 129, 0.6)';
      // Do not show text on map in passenger dashboard Captain arriving to A
      statusPillHtml = '';
    } else if (isArrivedPickup) {
      borderColor = '#10b981';
      glowShadow = '0 4px 18px rgba(16, 185, 129, 0.6)';
      statusPillHtml = `
        <div style="display: flex; align-items: center; gap: 5px; padding: 4px 10px; border-radius: 9999px; background: #020617; border: 2px solid #10b981; box-shadow: 0 8px 24px rgba(0,0,0,0.85); color: #ffffff; font-size: 11px; font-weight: 800; font-family: system-ui, -apple-system, sans-serif;">
          <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: #10b981; box-shadow: 0 0 10px #10b981;"></span>
          <span style="color: #34d399; font-weight: 900; letter-spacing: 0.2px;">📍 Captain Arrived at (A)</span>
        </div>
      `;
    } else if (isGoingDropoff) {
      borderColor = '#38bdf8';
      glowShadow = '0 4px 18px rgba(56, 189, 248, 0.6)';
      // When "trip in progress" (trip_started) in passenger dashboard, hide "on trip to dropoff B 17km" text
      statusPillHtml = '';
    } else if (isTripDone) {
      borderColor = '#10b981';
      statusPillHtml = `
        <div style="display: flex; align-items: center; gap: 5px; padding: 4px 10px; border-radius: 9999px; background: #020617; border: 2px solid #10b981; box-shadow: 0 8px 24px rgba(0,0,0,0.85); color: #ffffff; font-size: 11px; font-weight: 800; font-family: system-ui, -apple-system, sans-serif;">
          <span>🏁 Trip Completed at (B)</span>
        </div>
      `;
    } else {
      statusPillHtml = isCaptainMode ? '' : `
        <div style="display: flex; align-items: center; gap: 4px; padding: 3px 8px; border-radius: 9999px; background: #000000; border: 1.5px solid ${borderColor}; box-shadow: 0 8px 24px rgba(0,0,0,0.7); color: #ffffff; font-size: 11px; font-weight: 800; font-family: system-ui, -apple-system, sans-serif;">
          <span style="display: flex; width: 6px; height: 6px; border-radius: 50%; background: ${isNearest ? '#10b981' : '#22c55e'}; box-shadow: 0 0 6px ${isNearest ? '#10b981' : '#22c55e'};"></span>
          ${isNearest ? `<span style="color: #34d399; font-weight: 900; letter-spacing: 0.3px;">⭐ Nearest Captain</span>` : `<span style="color: #f1f5f9; font-weight: 800;">${name}</span>`}
          ${distText ? `<span style="color: #ffffff; font-size: 10px; font-weight: 800; background: ${isNearest ? 'rgba(16, 185, 129, 0.3)' : 'rgba(255,255,255,0.18)'}; padding: 1px 5px; border-radius: 4px;">${distText}</span>` : ''}
          ${accuracy ? `<span style="color: #94a3b8; font-size: 9px; font-family: monospace;">±${Math.round(accuracy)}m</span>` : ''}
        </div>
      `;
    }

    const boxWidth = isArrivingPickup ? 200 : 150;

    return L.divIcon({
      className: isNearest ? 'nearest-captain-icon' : 'captain-car-icon',
      html: `
        <div style="position: relative; width: ${boxWidth}px; height: 100px; display: flex; flex-direction: column; align-items: center; justify-content: flex-end; user-select: none; pointer-events: auto; cursor: pointer;">
          <!-- Top Floating Pill Label -->
          <div style="position: absolute; top: 0px; left: 50%; transform: translateX(-50%); white-space: nowrap; z-index: 20;">
            ${statusPillHtml}
          </div>

          <!-- Rotating Navigation Arrowhead Marker (Uploaded Navigation Icon) -->
          <div style="position: relative; width: 48px; height: 48px; margin-bottom: 6px; transform: rotate(${heading}deg); transition: transform 0.4s cubic-bezier(0.2, 0.8, 0.2, 1); display: flex; align-items: center; justify-content: center;">
            <!-- Heading notch pointer -->
            <div style="position: absolute; top: -8px; left: 50%; transform: translateX(-50%); width: 0; height: 0; border-left: 7px solid transparent; border-right: 7px solid transparent; border-bottom: 10px solid ${borderColor}; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.6)); z-index: 10;"></div>
            <!-- Circle core with Navigation Arrowhead -->
            <div style="width: 46px; height: 46px; border-radius: 50%; background: #ffffff; border: 3.5px solid ${borderColor}; display: flex; align-items: center; justify-content: center; box-shadow: ${glowShadow}, 0 0 0 2px rgba(0,0,0,0.7); overflow: hidden;">
              <svg viewBox="0 0 100 100" width="36" height="36" style="display: block;">
                <!-- Outer Black Ring -->
                <circle cx="50" cy="50" r="41" fill="#ffffff" stroke="#000000" stroke-width="11"/>
                <!-- Inner Navigation Arrowhead -->
                <path d="M 50,18 L 76,74 L 50,60 L 24,74 Z" fill="#000000" stroke="#000000" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
              </svg>
            </div>
          </div>
        </div>
      `,
      iconSize: [boxWidth, 100],
      iconAnchor: [boxWidth / 2, 74],
      popupAnchor: [0, -74],
    });
  };

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const initialLat = isCaptainMode
      ? (captainLat || 30.704649)
      : (passengerLat || pickupLat || 30.704649);
    const initialLng = isCaptainMode
      ? (captainLng || 76.717873)
      : (passengerLng || pickupLng || 76.717873);

    const map = L.map(mapContainerRef.current, {
      center: [initialLat, initialLng],
      zoom: 15,
      zoomControl: false,
      attributionControl: false,
    });

    const initialConfig = MAP_LAYERS[activeLayer];
    const tiles = L.tileLayer(initialConfig.url, {
      maxZoom: initialConfig.maxZoom,
      subdomains: initialConfig.subdomains,
    }).addTo(map);
    tileLayerRef.current = tiles;

    L.control.zoom({ position: 'topright' }).addTo(map);

    if (interactive && onMapClick) {
      map.on('click', (e) => {
        onMapClick(e.latlng.lat, e.latlng.lng);
      });
    }

    // Stop following when user manually drags map
    map.on('dragstart', () => {
      setIsFollowingPassenger(false);
      setIsFollowingCaptain(false);
    });

    mapInstanceRef.current = map;
    setMapReady(true);

    // Trigger invalidateSize after initial layout render
    const timer1 = setTimeout(() => map.invalidateSize(), 150);
    const timer2 = setTimeout(() => map.invalidateSize(), 500);

    // Watch for size changes
    const resizeObserver = new ResizeObserver(() => {
      map.invalidateSize();
    });
    if (mapContainerRef.current) {
      resizeObserver.observe(mapContainerRef.current);
    }

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      resizeObserver.disconnect();
      try {
        map.remove();
      } catch (err) {
        console.warn('Leaflet cleanup warning:', err);
      }
      mapInstanceRef.current = null;
      pickupMarkerRef.current = null;
      dropoffMarkerRef.current = null;
      passengerMarkerRef.current = null;
      passengerAccuracyCircleRef.current = null;
      passengerToPickupLineRef.current = null;
      captainMarkerRef.current = null;
      polylineRef.current = null;
      polylineGlowRef.current = null;
      lastFittedRouteKeyRef.current = '';
      setMapReady(false);
    };
  }, []);

  // Update Tile Layer when activeLayer changes
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (tileLayerRef.current) {
      map.removeLayer(tileLayerRef.current);
    }

    const config = MAP_LAYERS[activeLayer];
    const newTiles = L.tileLayer(config.url, {
      maxZoom: config.maxZoom,
      subdomains: config.subdomains,
    }).addTo(map);

    tileLayerRef.current = newTiles;
  }, [activeLayer]);

  // Update Markers, Passenger GPS, and Polyline
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const bounds: L.LatLngExpression[] = [];

    const hasPickup = Boolean(pickupLat && pickupLng && pickupLat !== 0 && pickupLng !== 0);
    const hasDropoff = Boolean(dropoffLat && dropoffLng && dropoffLat !== 0 && dropoffLng !== 0);

    // Calculate walking distance between passenger standing location and pickup location A
    let distToPickupMeters: number | null = null;
    if (passengerLat && passengerLng && hasPickup && pickupLat && pickupLng) {
      const dLat = ((pickupLat - passengerLat) * Math.PI) / 180;
      const dLon = ((pickupLng - passengerLng) * Math.PI) / 180;
      const aVal =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos((passengerLat * Math.PI) / 180) *
          Math.cos((pickupLat * Math.PI) / 180) *
          Math.sin(dLon / 2) *
          Math.sin(dLon / 2);
      distToPickupMeters = Math.round(6371000 * 2 * Math.atan2(Math.sqrt(aVal), Math.sqrt(1 - aVal)));
    }

    // Check if ride is currently active / booked
    const isRideBooked = Boolean(activeRideStatus);

    // Check if pickup is currently set to the passenger's exact position
    const isPickupAtPassenger = Boolean(
      hasPickup &&
      pickupLat &&
      pickupLng &&
      passengerLat &&
      passengerLng &&
      (distToPickupMeters !== null ? distToPickupMeters < 12 : false)
    );

    // Active pick and drop route search mode
    const isPickAndDropActive = Boolean(
      hasPickup &&
      hasDropoff &&
      pickupLat &&
      pickupLng &&
      dropoffLat &&
      dropoffLng
    );

    // 1. Passenger GPS Live Location Marker (Displayed only in passenger mode when no active ride is in progress)
    const isRideActiveNow = Boolean(
      activeRideStatus &&
      ['searching', 'captain_accepted', 'captain_arrived', 'trip_started', 'trip_completed'].includes(activeRideStatus)
    );
    const shouldShowPassengerGps = !isCaptainMode && !isRideActiveNow && !isRideBooked && Boolean(passengerLat && passengerLng);
    if (shouldShowPassengerGps && passengerLat && passengerLng) {
      if (!isPickAndDropActive) {
        bounds.push([passengerLat, passengerLng]);
      }
      const labelText = 'Where To ?';
      const pIcon = createPassengerIcon(labelText, isPickupAtPassenger);

      const passengerPopupHtml = `
        <div style="font-family: inherit; font-size: 12px; line-height: 1.4; min-width: 170px; color: #000000; padding: 2px;">
          <div style="font-weight: 900; color: #1d3f84; display: flex; align-items: center; gap: 6px; font-size: 13px; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; margin-bottom: 4px;">
            <span>📍 Where To ?</span>
          </div>
          <div style="color: #0f172a; font-size: 11.5px; font-weight: 600;">
            ${passengerName || 'Passenger (Standing Here)'}
          </div>
          <div style="color: #2563eb; font-size: 11px; margin-top: 4px; font-weight: 700;">
            Click to set Pickup Location (A)
          </div>
        </div>
      `;

      if (!passengerMarkerRef.current || !map.hasLayer(passengerMarkerRef.current)) {
        if (passengerMarkerRef.current) {
          try {
            map.removeLayer(passengerMarkerRef.current);
          } catch {}
        }
        passengerMarkerRef.current = L.marker([passengerLat, passengerLng], {
          icon: pIcon,
          zIndexOffset: 3000,
        })
          .addTo(map)
          .bindPopup(passengerPopupHtml);
      } else {
        passengerMarkerRef.current.setLatLng([passengerLat, passengerLng]);
        passengerMarkerRef.current.setIcon(pIcon);
        passengerMarkerRef.current.setPopupContent(passengerPopupHtml);
      }

      // On click text "Where To ?" or passenger marker: Auto set Passenger Pickup Location A on booking form
      passengerMarkerRef.current.off('click');
      passengerMarkerRef.current.on('click', (e: L.LeafletMouseEvent) => {
        L.DomEvent.stopPropagation(e);
        if (onSetPickupToPassengerLocation && passengerLat && passengerLng) {
          onSetPickupToPassengerLocation(passengerLat, passengerLng);
        }
      });

      // Clean up any previous accuracy circle
      if (passengerAccuracyCircleRef.current) {
        try {
          map.removeLayer(passengerAccuracyCircleRef.current);
          passengerAccuracyCircleRef.current = null;
        } catch {}
      }

      // Center map initially once on passenger location without vibrating camera animation
      if (!hasInitiallyCenteredPassengerRef.current) {
        hasInitiallyCenteredPassengerRef.current = true;
        map.setView([passengerLat, passengerLng], 16, {
          animate: false,
        });
      }
    } else {
      if (passengerMarkerRef.current) {
        map.removeLayer(passengerMarkerRef.current);
        passengerMarkerRef.current = null;
      }
      if (passengerAccuracyCircleRef.current) {
        map.removeLayer(passengerAccuracyCircleRef.current);
        passengerAccuracyCircleRef.current = null;
      }
    }

    // 2. Pickup Marker A (Rendered with the uploaded green pearl pushpin marker)
    const shouldRenderPickupPin = Boolean(hasPickup && pickupLat && pickupLng);
    if (shouldRenderPickupPin && pickupLat && pickupLng) {
      bounds.push([pickupLat, pickupLng]);
      // Hide text "Pickup A" showing near "Where To ?"
      const isNearWhereTo = Boolean(
        isPickupAtPassenger ||
        (distToPickupMeters !== null && distToPickupMeters < 80)
      );
      const aIcon = createPickupIcon(pickupAddress || undefined, pickupDistanceText, isNearWhereTo);

      const pickupPopupHtml = `
        <div style="font-family: inherit; font-size: 12px; line-height: 1.4; min-width: 180px; color: #000000; padding: 2px;">
          <div style="font-weight: 900; color: #059669; display: flex; align-items: center; gap: 6px; font-size: 13px; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; margin-bottom: 4px;">
            <img src="/marker_green.svg" alt="A" style="width: 12px; height: 26px; object-fit: contain; vertical-align: middle;" />
            <span>Pickup (A)${pickupDistanceText ? ` • ${pickupDistanceText}` : ''}</span>
          </div>
          <div style="color: #0f172a; font-size: 12px; font-weight: 700;">
            ${pickupAddress || 'Selected Pickup Point'}
          </div>
          ${distToPickupMeters !== null && distToPickupMeters > 5 ? `<div style="color: #64748b; font-size: 11px; margin-top: 4px; font-weight: 500;">Passenger standing <b>${distToPickupMeters}m</b> away</div>` : ''}
        </div>
      `;

      if (!pickupMarkerRef.current || !map.hasLayer(pickupMarkerRef.current)) {
        if (pickupMarkerRef.current) {
          try {
            map.removeLayer(pickupMarkerRef.current);
          } catch {}
        }
        pickupMarkerRef.current = L.marker([pickupLat, pickupLng], {
          icon: aIcon,
          zIndexOffset: 2000,
        })
          .addTo(map)
          .bindPopup(pickupPopupHtml);
        pickupMarkerRef.current.on('click', (e) => {
          L.DomEvent.stopPropagation(e);
        });
      } else {
        pickupMarkerRef.current.setLatLng([pickupLat, pickupLng]);
        pickupMarkerRef.current.setIcon(aIcon);
        pickupMarkerRef.current.setPopupContent(pickupPopupHtml);
      }
    } else if (pickupMarkerRef.current) {
      try {
        map.removeLayer(pickupMarkerRef.current);
      } catch {}
      pickupMarkerRef.current = null;
    }

    // Walking guide dashed line connecting Passenger Standing Location to Pickup Location A (only before pick and drop search when standing separately)
    if (!isPickAndDropActive && !isRideBooked && hasPickup && !isPickupAtPassenger && distToPickupMeters !== null && distToPickupMeters >= 4 && distToPickupMeters <= 1500 && passengerLat && passengerLng && pickupLat && pickupLng) {
      if (!passengerToPickupLineRef.current || !map.hasLayer(passengerToPickupLineRef.current)) {
        if (passengerToPickupLineRef.current) {
          try {
            map.removeLayer(passengerToPickupLineRef.current);
          } catch {}
        }
        passengerToPickupLineRef.current = L.polyline([[passengerLat, passengerLng], [pickupLat, pickupLng]], {
          color: '#000000',
          weight: 2.5,
          dashArray: '4, 8',
          opacity: 0.75,
        }).addTo(map);
      } else {
        passengerToPickupLineRef.current.setLatLngs([[passengerLat, passengerLng], [pickupLat, pickupLng]]);
      }
    } else if (passengerToPickupLineRef.current) {
      map.removeLayer(passengerToPickupLineRef.current);
      passengerToPickupLineRef.current = null;
    }

    // 3. Dropoff Marker (Location B - Destination)
    if (hasDropoff && dropoffLat && dropoffLng) {
      bounds.push([dropoffLat, dropoffLng]);
      const bIcon = createDropoffIcon(dropoffAddress || undefined, dropoffDistanceText);

      const dropoffPopupHtml = `
        <div style="font-family: inherit; font-size: 12px; line-height: 1.4; min-width: 180px; color: #000000; padding: 2px;">
          <div style="font-weight: 900; color: #e11d48; display: flex; align-items: center; gap: 6px; font-size: 13px; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; margin-bottom: 4px;">
            <img src="/marker_red.svg" alt="B" style="width: 12px; height: 26px; object-fit: contain; vertical-align: middle;" />
            <span>Drop-off (B)${dropoffDistanceText ? ` • ${dropoffDistanceText}` : ''}</span>
          </div>
          <div style="color: #0f172a; font-size: 12px; font-weight: 700;">
            ${dropoffAddress || 'Selected Destination'}
          </div>
          ${rideDistanceText ? `<div style="color: #64748b; font-size: 11px; margin-top: 4px; font-weight: 500;">Trip distance: <b>${rideDistanceText}</b></div>` : ''}
        </div>
      `;

      if (!dropoffMarkerRef.current || !map.hasLayer(dropoffMarkerRef.current)) {
        if (dropoffMarkerRef.current) {
          try {
            map.removeLayer(dropoffMarkerRef.current);
          } catch {}
        }
        dropoffMarkerRef.current = L.marker([dropoffLat, dropoffLng], {
          icon: bIcon,
          zIndexOffset: 2500,
        })
          .addTo(map)
          .bindPopup(dropoffPopupHtml);
        dropoffMarkerRef.current.on('click', (e) => {
          L.DomEvent.stopPropagation(e);
        });
      } else {
        dropoffMarkerRef.current.setLatLng([dropoffLat, dropoffLng]);
        dropoffMarkerRef.current.setIcon(bIcon);
        dropoffMarkerRef.current.setZIndexOffset(2500);
        dropoffMarkerRef.current.setPopupContent(dropoffPopupHtml);
      }
    } else if (dropoffMarkerRef.current) {
      map.removeLayer(dropoffMarkerRef.current);
      dropoffMarkerRef.current = null;
    }

    // 4. Captain Marker (Only shown if showPassengerOnly is false and coordinates provided)
    if (!showPassengerOnly && captainLat && captainLng) {
      if (!showLocationsABOnly) {
        bounds.push([captainLat, captainLng]);
      }

      let activeDistKm: number | undefined = undefined;
      if (activeRideStatus === 'captain_accepted' && pickupLat && pickupLng) {
        activeDistKm = calculateHaversineDistanceKm(captainLat, captainLng, pickupLat, pickupLng);
      } else if (activeRideStatus === 'trip_started' && dropoffLat && dropoffLng) {
        activeDistKm = calculateHaversineDistanceKm(captainLat, captainLng, dropoffLat, dropoffLng);
      }

      const cIcon = createCaptainIcon(
        captainHeading,
        captainName || (isCaptainMode ? 'You (Captain)' : 'Captain'),
        captainAccuracy,
        isCaptainMode,
        false,
        undefined,
        activeDistKm,
        activeRideStatus
      );

      if (!captainMarkerRef.current || !map.hasLayer(captainMarkerRef.current)) {
        if (captainMarkerRef.current) {
          try {
            map.removeLayer(captainMarkerRef.current);
          } catch {}
        }
        captainMarkerRef.current = L.marker([captainLat, captainLng], {
          icon: cIcon,
          zIndexOffset: 1400,
        })
          .addTo(map)
          .bindPopup(`
            <div style="padding: 4px; font-size: 12px; color: #0f172a; font-weight: 600;">
              <div style="font-weight: 800; font-size: 13px; color: #d97706;">🏍️ ${captainName || 'Captain Live Location'}</div>
              <div>Status: <b>${activeRideStatus === 'captain_accepted' ? 'Arriving to Pickup (A)' : activeRideStatus === 'trip_started' ? 'Going to Dropoff (B)' : 'Online & Live Tracking'}</b></div>
              ${activeDistKm != null ? `<div>Remaining: <b>${activeDistKm < 1 ? `${Math.round(activeDistKm * 1000)}m` : `${activeDistKm.toFixed(1)}km`}</b></div>` : ''}
              ${captainAccuracy ? `<div>GPS Accuracy: ±${Math.round(captainAccuracy)}m</div>` : ''}
              <div style="font-size: 11px; color: #64748b; margin-top: 2px;">GPS: ${captainLat.toFixed(5)}, ${captainLng.toFixed(5)}</div>
            </div>
          `);
      } else {
        captainMarkerRef.current.setLatLng([captainLat, captainLng]);
        captainMarkerRef.current.setIcon(cIcon);
      }

      // Accuracy circle around captain live position (disabled in captain mode)
      if (isCaptainMode) {
        if (captainAccuracyCircleRef.current) {
          try {
            map.removeLayer(captainAccuracyCircleRef.current);
            captainAccuracyCircleRef.current = null;
          } catch {}
        }
      } else {
        const capRadius = Math.max(12, Math.min(captainAccuracy || 20, 80));
        if (!captainAccuracyCircleRef.current || !map.hasLayer(captainAccuracyCircleRef.current)) {
          if (captainAccuracyCircleRef.current) {
            try {
              map.removeLayer(captainAccuracyCircleRef.current);
            } catch {}
          }
          captainAccuracyCircleRef.current = L.circle([captainLat, captainLng], {
            radius: capRadius,
            color: activeRideStatus === 'trip_started' ? '#0284c7' : '#0f172a',
            fillColor: activeRideStatus === 'trip_started' ? '#38bdf8' : '#0f172a',
            fillOpacity: 0.08,
            weight: 1.5,
            dashArray: '4, 4',
          }).addTo(map);
        } else {
          captainAccuracyCircleRef.current.setLatLng([captainLat, captainLng]);
          captainAccuracyCircleRef.current.setRadius(capRadius);
        }
      }
    } else {
      if (captainMarkerRef.current) {
        map.removeLayer(captainMarkerRef.current);
        captainMarkerRef.current = null;
      }
      if (captainAccuracyCircleRef.current) {
        map.removeLayer(captainAccuracyCircleRef.current);
        captainAccuracyCircleRef.current = null;
      }
    }

    // 4c. Active Ride Guidance Line:
    // (Removed previous animated/dashed polyline style in passenger app to show only simple dark blue route between mark A and B)
    if (captainToTargetLineRef.current) {
      try {
        map.removeLayer(captainToTargetLineRef.current);
      } catch {}
      captainToTargetLineRef.current = null;
    }

    // 4b. Nearby Available Captains (Always displayed on passenger map with nearest captain icon)
    if (!isCaptainMode && nearbyCaptains && nearbyCaptains.length > 0) {
      const activeIds = new Set(nearbyCaptains.map((c) => c.id));
      nearbyCaptainMarkersRef.current.forEach((marker, id) => {
        if (!activeIds.has(id)) {
          try {
            map.removeLayer(marker);
          } catch {}
          nearbyCaptainMarkersRef.current.delete(id);
        }
      });

      nearbyCaptains.forEach((cpt) => {
        // Skip if active single captain marker already placed at identical spot
        if (captainLat && captainLng && Math.abs(cpt.lat - captainLat) < 0.0001 && Math.abs(cpt.lng - captainLng) < 0.0001) {
          return;
        }

        const isNearest = Boolean(cpt.isNearest || (nearestCaptain && nearestCaptain.id === cpt.id));
        const cIcon = createCaptainIcon(
          cpt.heading || 0,
          cpt.name,
          null,
          false,
          isNearest,
          cpt.etaMinutes,
          cpt.distanceKm
        );

        let marker = nearbyCaptainMarkersRef.current.get(cpt.id);
        if (!marker || !map.hasLayer(marker)) {
          if (marker) {
            try {
              map.removeLayer(marker);
            } catch {}
          }
          marker = L.marker([cpt.lat, cpt.lng], {
            icon: cIcon,
            zIndexOffset: isNearest ? 1480 : 1320,
          }).addTo(map);

          nearbyCaptainMarkersRef.current.set(cpt.id, marker);
        } else {
          marker.setLatLng([cpt.lat, cpt.lng]);
          marker.setIcon(cIcon);
        }

        const distLabel = cpt.distanceKm != null ? (cpt.distanceKm < 1 ? `${Math.round(cpt.distanceKm * 1000)}m` : `${cpt.distanceKm.toFixed(1)} km`) : 'Nearby';

        marker.bindPopup(`
          <div style="padding: 6px 8px; font-size: 12px; color: #0f172a; min-width: 185px; font-family: system-ui, -apple-system, sans-serif;">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px;">
              <span style="font-weight: 800; font-size: 12px; color: ${isNearest ? '#059669' : '#d97706'};">
                ${isNearest ? '⭐ Nearest Available Captain' : '🏍️ Available Captain'}
              </span>
              <span style="background: #ecfdf5; color: #065f46; font-size: 9px; font-weight: 800; padding: 1px 6px; border-radius: 9999px;">ONLINE</span>
            </div>
            <div style="font-weight: 800; font-size: 13px; color: #0f172a;">${cpt.name}</div>
            <div style="color: #64748b; font-size: 11px; margin-top: 2px;">
              ${cpt.vehicleModel || 'Motoride Bike'} ${cpt.vehiclePlate ? `• <b>${cpt.vehiclePlate}</b>` : ''}
            </div>
            <div style="display: flex; align-items: center; justify-content: space-between; margin-top: 6px; padding-top: 5px; border-top: 1px solid #e2e8f0; font-size: 11px;">
              <span style="color: #d97706; font-weight: 800;">★ ${cpt.rating ? cpt.rating.toFixed(1) : '4.9'}</span>
              <span style="color: #0f172a; font-weight: 700;">${distLabel} ${cpt.etaMinutes ? `(~${cpt.etaMinutes} min)` : ''}</span>
            </div>
          </div>
        `);

        if (onSelectCaptain) {
          marker.on('click', () => onSelectCaptain(cpt));
        }
      });
    } else if (nearbyCaptainMarkersRef.current.size > 0) {
      nearbyCaptainMarkersRef.current.forEach((marker) => {
        try {
          map.removeLayer(marker);
        } catch {}
      });
      nearbyCaptainMarkersRef.current.clear();
    }

    // 5. Simple Dark Blue Polyline Route (Connecting from pickup Location A to drop-off Location B)
    if (hasPickup && hasDropoff && pickupLat && pickupLng && dropoffLat && dropoffLng) {
      const latlngs: [number, number][] = [
        [pickupLat, pickupLng],
        [dropoffLat, dropoffLng],
      ];

      // Remove any previous glow / casing polyline
      if (polylineGlowRef.current) {
        try {
          map.removeLayer(polylineGlowRef.current);
        } catch {}
        polylineGlowRef.current = null;
      }

      // Draw simple dark blue polyline between Location A and B
      const routePolylineColor = '#002060'; // Simple Dark Blue

      if (!polylineRef.current || !map.hasLayer(polylineRef.current)) {
        if (polylineRef.current) {
          try {
            map.removeLayer(polylineRef.current);
          } catch {}
        }
        polylineRef.current = L.polyline(latlngs, {
          color: routePolylineColor,
          weight: 5,
          opacity: 0.95,
          lineCap: 'round',
          lineJoin: 'round',
        }).addTo(map);
      } else {
        polylineRef.current.setLatLngs(latlngs);
        polylineRef.current.setStyle({
          color: routePolylineColor,
          weight: 5,
          opacity: 0.95,
          dashArray: undefined,
          className: '',
        });
      }

      // Ensure no distance tooltip/tab is attached to the route polyline on map
      polylineRef.current.unbindTooltip();

      if (routeDistanceMarkerRef.current) {
        map.removeLayer(routeDistanceMarkerRef.current);
        routeDistanceMarkerRef.current = null;
      }
    } else {
      if (polylineRef.current) {
        map.removeLayer(polylineRef.current);
        polylineRef.current = null;
      }
      if (polylineGlowRef.current) {
        map.removeLayer(polylineGlowRef.current);
        polylineGlowRef.current = null;
      }
      if (routeDistanceMarkerRef.current) {
        map.removeLayer(routeDistanceMarkerRef.current);
        routeDistanceMarkerRef.current = null;
      }
    }

    // Auto-fit bounds or center on position
    if (showLocationsABOnly && hasPickup && hasDropoff && pickupLat && pickupLng && dropoffLat && dropoffLng) {
      const abBounds = L.latLngBounds([
        [pickupLat, pickupLng],
        [dropoffLat, dropoffLng],
      ]);
      map.invalidateSize();
      const bottomPad = bottomSheetPadding || 340;
      map.fitBounds(abBounds, {
        paddingTopLeft: [70, 40],
        paddingBottomRight: [40, bottomPad],
        maxZoom: 16,
        animate: true,
      });
    } else if (isCaptainMode && captainLat && captainLng) {
      if (!hasPickup && !hasDropoff) {
        // Standby/Browsing mode: focus on captain live GPS
        if (!hasInitiallyCenteredCaptainRef.current) {
          hasInitiallyCenteredCaptainRef.current = true;
          map.setView([captainLat, captainLng], 16, { animate: false });
        } else if (isFollowingCaptain) {
          map.panTo([captainLat, captainLng], { animate: true, duration: 0.4 });
        }
      } else {
        // Active ride or inspecting route in captain mode: fit route bounds to show Location A and B
        if (bounds.length > 1) {
          map.invalidateSize();
          const bottomPad = bottomSheetPadding || 60;
          map.fitBounds(L.latLngBounds(bounds), {
            paddingTopLeft: [60, 40],
            paddingBottomRight: [40, bottomPad],
            maxZoom: 16,
            animate: false,
          });
        } else if (isFollowingCaptain) {
          map.panTo([captainLat, captainLng], { animate: true, duration: 0.4 });
        }
      }
    } else if (hasPickup && hasDropoff && pickupLat && pickupLng && dropoffLat && dropoffLng) {
      const currentRouteKey = `${pickupLat.toFixed(4)}_${pickupLng.toFixed(4)}_${dropoffLat.toFixed(4)}_${dropoffLng.toFixed(4)}_${activeRideStatus || ''}`;
      if (lastFittedRouteKeyRef.current !== currentRouteKey) {
        lastFittedRouteKeyRef.current = currentRouteKey;
        const routeBounds = L.latLngBounds([
          [pickupLat, pickupLng],
          [dropoffLat, dropoffLng],
        ]);
        if (captainLat && captainLng) {
          routeBounds.extend([captainLat, captainLng]);
        }
        if (shouldShowPassengerGps && passengerLat && passengerLng) {
          routeBounds.extend([passengerLat, passengerLng]);
        }
        map.invalidateSize();
        const bottomPad = bottomSheetPadding || 180;
        map.fitBounds(routeBounds, {
          paddingTopLeft: [70, 40],
          paddingBottomRight: [40, bottomPad],
          maxZoom: 16,
          animate: true,
        });
      }
    } else if (!isCaptainMode && !hasDropoff && (pickupLat || passengerLat) && (pickupLng || passengerLng)) {
      const focusLat = pickupLat || passengerLat!;
      const focusLng = pickupLng || passengerLng!;
      const pad = bottomSheetPadding || 280;
      map.invalidateSize();
      map.fitBounds(L.latLngBounds([[focusLat, focusLng], [focusLat, focusLng]]), {
        paddingBottomRight: [40, pad],
        paddingTopLeft: [70, 40],
        maxZoom: 16,
        animate: true,
      });
    } else if (bounds.length > 1 && !isFollowingPassenger) {
      map.invalidateSize();
      map.fitBounds(L.latLngBounds(bounds), { padding: [60, 60], maxZoom: 16, animate: false });
    } else if (bounds.length >= 1 && !isFollowingPassenger) {
      map.setView(bounds[0], 15, { animate: false });
    } else if (passengerLat && passengerLng && !hasInitiallyCenteredPassengerRef.current) {
      hasInitiallyCenteredPassengerRef.current = true;
      const pad = bottomSheetPadding || 0;
      if (pad > 0) {
        map.fitBounds(L.latLngBounds([[passengerLat, passengerLng], [passengerLat, passengerLng]]), {
          paddingBottomRight: [40, pad],
          paddingTopLeft: [70, 40],
          maxZoom: 16,
          animate: false,
        });
      } else {
        map.setView([passengerLat, passengerLng], 16, { animate: false });
      }
    }
  }, [
    mapReady,
    pickupLat,
    pickupLng,
    pickupAddress,
    dropoffLat,
    dropoffLng,
    dropoffAddress,
    captainLat,
    captainLng,
    captainHeading,
    captainAccuracy,
    captainName,
    isCaptainMode,
    isFollowingCaptain,
    passengerLat,
    passengerLng,
    passengerAccuracy,
    passengerName,
    showPassengerOnly,
    showLocationsABOnly,
    isFollowingPassenger,
    onSetPickupToPassengerLocation,
    nearbyCaptains,
    nearestCaptain,
    onSelectCaptain,
    activeRideStatus,
    bottomSheetPadding,
  ]);

  // Smoothly pan & zoom to external focus coordinates when requested
  useEffect(() => {
    if (focusCoords && mapInstanceRef.current && focusCoords.lat && focusCoords.lng) {
      setIsFollowingCaptain(false);
      setIsFollowingPassenger(false);
      const targetZoom = focusCoords.zoom ?? 16;
      mapInstanceRef.current.flyTo([focusCoords.lat, focusCoords.lng], targetZoom, {
        animate: true,
        duration: 0.6,
      });
    }
  }, [focusCoords]);

  // Center on Passenger or Captain Live Location with Navigator
  const handleNavigatorCenter = () => {
    if (!mapInstanceRef.current) return;
    if (isCaptainMode) {
      setIsFollowingCaptain(true);
      if (captainLat && captainLng) {
        mapInstanceRef.current.flyTo([captainLat, captainLng], 16, { animate: true, duration: 0.8 });
      }
    } else {
      setIsFollowingPassenger(true);
      const targetLat = passengerLat || pickupLat;
      const targetLng = passengerLng || pickupLng;
      if (targetLat && targetLng) {
        const pad = bottomSheetPadding || 0;
        if (pad > 0) {
          mapInstanceRef.current.fitBounds(
            L.latLngBounds([[targetLat, targetLng], [targetLat, targetLng]]),
            {
              paddingBottomRight: [40, pad],
              paddingTopLeft: [70, 40],
              maxZoom: 16,
              animate: true,
              duration: 0.8,
            }
          );
        } else {
          mapInstanceRef.current.flyTo([targetLat, targetLng], 16, { animate: true, duration: 0.8 });
        }
      }
    }
    if (onLocateMe) {
      onLocateMe();
    }
  };

  const handleFocusNearestCaptain = () => {
    if (!mapInstanceRef.current || !nearestCaptain) return;
    setIsFollowingPassenger(false);
    mapInstanceRef.current.flyTo([nearestCaptain.lat, nearestCaptain.lng], 16, {
      animate: true,
      duration: 0.9,
    });
    const marker = nearbyCaptainMarkersRef.current.get(nearestCaptain.id);
    if (marker) {
      setTimeout(() => {
        try {
          marker.openPopup();
        } catch {}
      }, 500);
    }
    if (onFocusNearestCaptain) {
      onFocusNearestCaptain();
    }
  };

  const handleLocateMe = () => {
    if (!mapInstanceRef.current) return;
    if (isCaptainMode) {
      setIsFollowingCaptain(true);
      if (captainLat && captainLng) {
        mapInstanceRef.current.flyTo([captainLat, captainLng], 16, { animate: true, duration: 0.9 });
      }
    } else {
      setIsFollowingPassenger(true);
      const targetLat = passengerLat || pickupLat;
      const targetLng = passengerLng || pickupLng;
      if (targetLat && targetLng) {
        const pad = bottomSheetPadding || 0;
        if (pad > 0) {
          mapInstanceRef.current.fitBounds(
            L.latLngBounds([[targetLat, targetLng], [targetLat, targetLng]]),
            {
              paddingBottomRight: [40, pad],
              paddingTopLeft: [70, 40],
              maxZoom: 16,
              animate: true,
              duration: 0.9,
            }
          );
        } else {
          mapInstanceRef.current.flyTo([targetLat, targetLng], 16, { animate: true, duration: 0.9 });
        }
      }
    }
    if (onLocateMe) {
      onLocateMe();
    }
  };

  const handleCenter = () => {
    if (!mapInstanceRef.current) return;
    if (isCaptainMode && captainLat && captainLng) {
      setIsFollowingCaptain(true);
      mapInstanceRef.current.flyTo([captainLat, captainLng], 15, { animate: true, duration: 0.8 });
    } else {
      const targetLat = passengerLat || pickupLat || captainLat;
      const targetLng = passengerLng || pickupLng || captainLng;
      if (targetLat && targetLng) {
        const pad = bottomSheetPadding || 0;
        if (pad > 0) {
          mapInstanceRef.current.fitBounds(
            L.latLngBounds([[targetLat, targetLng], [targetLat, targetLng]]),
            {
              paddingBottomRight: [40, pad],
              paddingTopLeft: [70, 40],
              maxZoom: 16,
              animate: true,
              duration: 0.8,
            }
          );
        } else {
          mapInstanceRef.current.flyTo([targetLat, targetLng], 16, { animate: true, duration: 0.8 });
        }
      }
    }
  };

  return (
    <div
      className={`relative ${className} overflow-hidden transition-colors duration-300 ${
        activeLayer === 'voyager-dark' ? 'bg-slate-950' : 'bg-slate-100'
      }`}
    >
      <div ref={mapContainerRef} className="w-full h-full" />

      {/* Map Overlay Controls - Hidden by default */}
      {showOverlayControls && (
        <>
          {/* Top Left: Live Passenger GPS Status HUD & Nearest Captain (Hidden in Captain Mode) */}
          {!isCaptainMode && !showLocationsABOnly && (
            <div className="absolute top-3 left-3 z-[400] flex flex-wrap items-center gap-2 max-w-[calc(100%-1.5rem)]">
              {passengerLat && passengerLng && (
                <button
                  type="button"
                  onClick={handleLocateMe}
                  title="Passenger Live Location GPS - Click to Recenter on My Location"
                  className="flex items-center gap-2 px-3 py-1.5 rounded-2xl bg-slate-950/90 text-white backdrop-blur-md border border-slate-700/90 shadow-xl text-xs font-semibold hover:border-blue-500/80 transition-all cursor-pointer active:scale-95"
                >
                  <div className="relative flex items-center justify-center w-2.5 h-2.5">
                    <span className="absolute w-full h-full rounded-full bg-blue-400 animate-ping opacity-75" />
                    <span className="relative w-2 h-2 rounded-full bg-blue-500" />
                  </div>
                  <span className="text-slate-200">🎯 My Location</span>
                  <span className="text-emerald-400 font-mono-num font-bold text-[11px] bg-emerald-500/10 px-1.5 py-0.5 rounded-lg border border-emerald-500/30">
                    {passengerAccuracy ? `±${Math.round(passengerAccuracy)}m` : 'Live'}
                  </span>
                </button>
              )}

              {nearestCaptain && (
                <button
                  type="button"
                  onClick={handleFocusNearestCaptain}
                  title={`Nearest Captain: ${nearestCaptain.name} (${nearestCaptain.distanceKm ? (nearestCaptain.distanceKm < 1 ? Math.round(nearestCaptain.distanceKm * 1000) + 'm' : nearestCaptain.distanceKm.toFixed(1) + ' km') : 'Nearby'}) - Click to view on map`}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-2xl bg-slate-950/95 text-white backdrop-blur-md border border-emerald-500/90 shadow-xl text-xs font-semibold hover:border-emerald-400 hover:bg-slate-900 transition-all cursor-pointer active:scale-95"
                >
                  <div className="relative flex items-center justify-center w-2.5 h-2.5">
                    <span className="absolute w-full h-full rounded-full bg-emerald-400 animate-ping opacity-75" />
                    <span className="relative w-2 h-2 rounded-full bg-emerald-500" />
                  </div>
                  <span className="text-emerald-400 font-bold">🏍️ Nearest Captain</span>
                  {nearestCaptain.distanceKm != null && (
                    <span className="text-emerald-300 font-mono-num font-bold text-[11px] bg-emerald-500/20 px-1.5 py-0.5 rounded-lg border border-emerald-500/30">
                      {nearestCaptain.distanceKm < 1 ? `${Math.round(nearestCaptain.distanceKm * 1000)}m` : `${nearestCaptain.distanceKm.toFixed(1)} km`}
                      {nearestCaptain.etaMinutes ? ` (~${nearestCaptain.etaMinutes}m)` : ''}
                    </span>
                  )}
                </button>
              )}
            </div>
          )}

          {/* Top Right: Google Maps Layering Switcher, Navigator Controls & Recenter */}
          <div className="absolute top-3 right-3 z-[400] flex items-center gap-2 max-w-[calc(100%-1.5rem)]">
            {/* Layer Quick Switcher (Hidden in Captain Dashboard) */}
            {!isCaptainMode && (
              <div className="flex items-center p-1 rounded-2xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-slate-200/90 shadow-md">
                <button
                  type="button"
                  onClick={() => handleSelectLayer('google-street')}
                  title="Google Street / Roadmaps (Default)"
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    activeLayer === 'google-street'
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  <Compass className="w-3.5 h-3.5 text-current" />
                  <span className="hidden sm:inline">Google Street</span>
                  <span className="sm:hidden">Street</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleSelectLayer('google-terrain')}
                  title="Google Terrain (Topographic Relief)"
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    activeLayer === 'google-terrain'
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  <Mountain className="w-3.5 h-3.5 text-current" />
                  <span className="hidden sm:inline">Google Terrain</span>
                  <span className="sm:hidden">Terrain</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleSelectLayer('voyager-dark')}
                  title="Voyager Dark Night Mode"
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    activeLayer === 'voyager-dark'
                      ? 'bg-slate-900 text-white shadow-sm'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  <Moon className="w-3.5 h-3.5 text-current" />
                  <span className="hidden sm:inline">Voyager Dark</span>
                  <span className="sm:hidden">Dark</span>
                </button>
              </div>
            )}

            {/* Live GPS Navigator / Follow Button (Hidden in Captain Dashboard) */}
            {!isCaptainMode && !showLocationsABOnly && (
              <button
                type="button"
                onClick={handleNavigatorCenter}
                title="Center Navigator on Passenger Real-Time Live Location"
                className={`flex items-center gap-1.5 px-3 py-2 rounded-2xl border shadow-md backdrop-blur-md transition-all active:scale-95 cursor-pointer text-xs font-bold shrink-0 ${
                  isFollowingPassenger
                    ? 'bg-blue-600 text-white border-blue-500 ring-2 ring-blue-400/40 shadow-blue-500/20'
                    : 'bg-white/95 hover:bg-white text-slate-800 border-slate-200/90'
                }`}
              >
                <Navigation className={`w-4 h-4 ${isFollowingPassenger ? 'text-white fill-white' : 'text-blue-600'}`} />
                <span className="hidden sm:inline">Navigator</span>
              </button>
            )}

            {/* Clean Floating Recenter Control */}
            <button
              type="button"
              onClick={handleCenter}
              title="Center Map"
              className="flex items-center gap-1.5 px-3 py-2 rounded-2xl bg-white/95 hover:bg-white text-slate-800 border border-slate-200/90 shadow-md backdrop-blur-md transition-all active:scale-95 cursor-pointer text-xs font-bold shrink-0"
            >
              <Crosshair className="w-4 h-4 text-emerald-600" />
              <span className="hidden md:inline">Recenter</span>
            </button>
          </div>
        </>
      )}
    </div>
  );
};
