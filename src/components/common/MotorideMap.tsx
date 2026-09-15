import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { Navigation, Crosshair, Compass, Mountain, Moon, LocateFixed } from 'lucide-react';

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

const MAP_LAYERS: Record<MapLayerType, MapLayerConfig> = {
  'google-street': {
    id: 'google-street',
    label: 'Google Street',
    shortLabel: 'Street',
    tooltip: 'Google Maps Roadmaps & Street View (Default)',
    url: 'https://mt{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}',
    subdomains: ['0', '1', '2', '3'],
    maxZoom: 20,
  },
  'google-terrain': {
    id: 'google-terrain',
    label: 'Google Terrain',
    shortLabel: 'Terrain',
    tooltip: 'Google Maps Topographic Terrain & Relief',
    url: 'https://mt{s}.google.com/vt/lyrs=p&x={x}&y={y}&z={z}',
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
}

export const MotorideMap: React.FC<MotorideMapProps> = ({
  pickupLat,
  pickupLng,
  pickupAddress,
  dropoffLat,
  dropoffLng,
  dropoffAddress,
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
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const pickupMarkerRef = useRef<L.Marker | null>(null);
  const dropoffMarkerRef = useRef<L.Marker | null>(null);
  const captainMarkerRef = useRef<L.Marker | null>(null);
  const captainAccuracyCircleRef = useRef<L.Circle | null>(null);
  const passengerMarkerRef = useRef<L.Marker | null>(null);
  const passengerAccuracyCircleRef = useRef<L.Circle | null>(null);
  const passengerToPickupLineRef = useRef<L.Polyline | null>(null);
  const polylineRef = useRef<L.Polyline | null>(null);
  const polylineGlowRef = useRef<L.Polyline | null>(null);
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

  // Custom DivIcon for Passenger Standing Location with the User's uploaded Rise-Hand Hailing Silhouette Icon
  const createPassengerIcon = (label: string = 'Standing Here (GPS)', isPickupHere: boolean = false) =>
    L.divIcon({
      className: 'passenger-standing-marker',
      html: `
        <div style="position: relative; width: 84px; height: 80px; display: flex; flex-direction: column; align-items: center; justify-content: flex-end; user-select: none; pointer-events: auto; cursor: pointer;" title="${isPickupHere ? 'Pickup Location (A) is set here' : 'One click to set as Pickup Location (A)'}">
          <!-- GPS Radar Ripple Pulse Rings -->
          <div style="position: absolute; bottom: 8px; left: 50%; transform: translateX(-50%); width: ${isPickupHere ? '68px' : '60px'}; height: ${isPickupHere ? '68px' : '60px'}; border-radius: 50%; background: ${isPickupHere ? 'rgba(16, 185, 129, 0.28)' : 'rgba(0, 0, 0, 0.14)'}; animation: radar-ping 2s cubic-bezier(0, 0, 0.2, 1) infinite; pointer-events: none;"></div>
          <div style="position: absolute; bottom: 14px; left: 50%; transform: translateX(-50%); width: 44px; height: 44px; border-radius: 50%; background: rgba(16, 185, 129, 0.22); pointer-events: none;"></div>

          <!-- Top Floating Label: Standing Here or Tap to set Pickup -->
          <div style="position: absolute; top: -14px; left: 50%; transform: translateX(-50%); background: ${isPickupHere ? '#022c22' : '#000000'}; color: #ffffff; font-family: system-ui, -apple-system, sans-serif; font-size: 10px; font-weight: 800; padding: 2.5px 9px; border-radius: 9999px; border: 1.5px solid ${isPickupHere ? '#10b981' : '#ffffff'}; white-space: nowrap; box-shadow: 0 4px 14px rgba(0,0,0,0.6); pointer-events: none; letter-spacing: 0.3px; z-index: 30; display: flex; align-items: center; gap: 4px;">
            <span style="width: 6px; height: 6px; border-radius: 50%; background: #10b981; display: inline-block; box-shadow: 0 0 6px #10b981;"></span>
            <span>${label || 'Standing Here'}</span>
          </div>

          <!-- Standing Passenger Pin Circle Badge with Crisp White Background & Solid Black/Emerald Border -->
          <div style="position: relative; width: 46px; height: 46px; border-radius: 50%; background: #ffffff; border: 3px solid ${isPickupHere ? '#10b981' : '#000000'}; box-shadow: 0 6px 20px rgba(0,0,0,0.45), 0 0 0 2px ${isPickupHere ? 'rgba(16,185,129,0.7)' : 'rgba(255,255,255,0.95)'}; display: flex; align-items: center; justify-content: center; z-index: 20;">
            <!-- Exact Silhouette of Passenger with Raised Hand (risehand icon) -->
            <svg viewBox="0 0 200 200" width="30" height="30" style="color: #000000; display: block;">
              <circle cx="124" cy="72" r="39" fill="currentColor" />
              <path d="M 72,200 C 74,168 56,122 36,80 C 26,58 13,36 9,21 C 5,8 17,-1 29,4 C 38,9 47,25 58,52 C 70,82 86,112 106,124 C 114,117 128,114 142,118 C 162,124 180,152 196,200 Z" fill="currentColor" />
            </svg>

            <!-- Bottom Pointer Arrow pointing to ground coordinates -->
            <div style="position: absolute; bottom: -5px; left: 50%; transform: translateX(-50%) rotate(45deg); width: 10px; height: 10px; background: ${isPickupHere ? '#10b981' : '#000000'}; border-right: 2px solid #ffffff; border-bottom: 2px solid #ffffff; z-index: 15;"></div>
          </div>

          <!-- Exact GPS Ground Contact Pinpoint -->
          <div style="width: 6px; height: 6px; border-radius: 50%; background: ${isPickupHere ? '#10b981' : '#000000'}; margin-top: 5px; box-shadow: 0 2px 4px rgba(0,0,0,0.6); z-index: 10;"></div>
        </div>
      `,
      iconSize: [84, 80],
      iconAnchor: [42, 76],
      popupAnchor: [0, -76],
    });


  // Custom DivIcons for Location A and Location B
  const createPickupIcon = () =>
    L.divIcon({
      className: 'custom-pin-icon marker-pin-a',
      html: `
        <div style="position: relative; width: 84px; height: 64px; display: flex; flex-direction: column; align-items: center; justify-content: flex-end; cursor: pointer; user-select: none; pointer-events: auto;">
          <div style="padding: 3px 8px; margin-bottom: 3px; border-radius: 6px; background: #020617; color: #34d399; font-weight: 900; font-size: 11px; border: 1.5px solid #10b981; box-shadow: 0 4px 14px rgba(0,0,0,0.7); white-space: nowrap; letter-spacing: 0.5px; font-family: system-ui, -apple-system, sans-serif;">
            A • PICKUP
          </div>
          <div style="position: relative; display: flex; align-items: center; justify-content: center;">
            <div style="width: 32px; height: 32px; border-radius: 50%; background: #10b981; color: #ffffff; display: flex; align-items: center; justify-content: center; font-weight: 900; font-size: 15px; box-shadow: 0 4px 16px rgba(16, 185, 129, 0.85); border: 2.5px solid #ffffff;">
              A
            </div>
            <div style="position: absolute; bottom: -4px; width: 9px; height: 9px; background: #10b981; transform: rotate(45deg); border-right: 2px solid #ffffff; border-bottom: 2px solid #ffffff;"></div>
          </div>
        </div>
      `,
      iconSize: [96, 64],
      iconAnchor: [48, 64],
      popupAnchor: [0, -64],
    });

  const createDropoffIcon = () =>
    L.divIcon({
      className: 'custom-pin-icon marker-pin-b',
      html: `
        <div style="position: relative; width: 84px; height: 64px; display: flex; flex-direction: column; align-items: center; justify-content: flex-end; cursor: pointer; user-select: none; pointer-events: auto;">
          <div style="padding: 3px 8px; margin-bottom: 3px; border-radius: 6px; background: #020617; color: #fb7185; font-weight: 900; font-size: 11px; border: 1.5px solid #f43f5e; box-shadow: 0 4px 14px rgba(0,0,0,0.7); white-space: nowrap; letter-spacing: 0.5px; font-family: system-ui, -apple-system, sans-serif;">
            B • DROP-OFF
          </div>
          <div style="position: relative; display: flex; align-items: center; justify-content: center;">
            <div style="width: 32px; height: 32px; border-radius: 50%; background: #f43f5e; color: #ffffff; display: flex; align-items: center; justify-content: center; font-weight: 900; font-size: 15px; box-shadow: 0 4px 16px rgba(244, 63, 94, 0.85); border: 2.5px solid #ffffff;">
              B
            </div>
            <div style="position: absolute; bottom: -4px; width: 9px; height: 9px; background: #f43f5e; transform: rotate(45deg); border-right: 2px solid #ffffff; border-bottom: 2px solid #ffffff;"></div>
          </div>
        </div>
      `,
      iconSize: [96, 64],
      iconAnchor: [48, 64],
      popupAnchor: [0, -64],
    });

  const createCaptainIcon = (
    heading: number = 0,
    name: string = 'You • Captain',
    accuracy?: number | null,
    isSelf: boolean = true,
    isNearest: boolean = false,
    etaMinutes?: number,
    distanceKm?: number
  ) => {
    const borderColor = isNearest ? '#10b981' : isSelf ? '#f59e0b' : '#38bdf8';
    const pingColor = isNearest ? 'rgba(16, 185, 129, 0.35)' : 'rgba(245, 158, 11, 0.22)';
    const pingColorInner = isNearest ? 'rgba(16, 185, 129, 0.45)' : 'rgba(245, 158, 11, 0.30)';
    const glowShadow = isNearest ? '0 4px 18px rgba(16, 185, 129, 0.65)' : '0 4px 18px rgba(245, 158, 11, 0.55)';
    const distText = distanceKm != null ? (distanceKm < 1 ? `${Math.round(distanceKm * 1000)}m` : `${distanceKm.toFixed(1)}km`) : '';

    return L.divIcon({
      className: isNearest ? 'nearest-captain-icon' : 'captain-car-icon',
      html: `
        <div style="position: relative; width: 140px; height: 96px; display: flex; flex-direction: column; align-items: center; justify-content: flex-end; user-select: none; pointer-events: auto; cursor: pointer;">
          <!-- Live Sonar / Radar Pulse Rings -->
          <div style="position: absolute; bottom: 8px; left: 50%; transform: translateX(-50%); width: ${isNearest ? '76px' : '68px'}; height: ${isNearest ? '76px' : '68px'}; border-radius: 50%; background: ${pingColor}; animation: radar-ping 2s cubic-bezier(0, 0, 0.2, 1) infinite; pointer-events: none;"></div>
          <div style="position: absolute; bottom: 14px; left: 50%; transform: translateX(-50%); width: 48px; height: 48px; border-radius: 50%; background: ${pingColorInner}; pointer-events: none;"></div>

          <!-- Top Floating Pill Label -->
          <div style="position: absolute; top: 0px; left: 50%; transform: translateX(-50%); white-space: nowrap; z-index: 20;">
            <div style="display: flex; align-items: center; gap: 4px; padding: 3px 8px; border-radius: 9999px; background: #000000; border: 1.5px solid ${borderColor}; box-shadow: 0 8px 24px rgba(0,0,0,0.7); color: #ffffff; font-size: 11px; font-weight: 800; font-family: system-ui, -apple-system, sans-serif;">
              <span style="display: flex; width: 6px; height: 6px; border-radius: 50%; background: ${isNearest ? '#10b981' : '#22c55e'}; box-shadow: 0 0 6px ${isNearest ? '#10b981' : '#22c55e'};"></span>
              ${isNearest ? `<span style="color: #34d399; font-weight: 900; letter-spacing: 0.3px;">⭐ Nearest Captain</span>` : `<span style="color: #f1f5f9; font-weight: 800;">${name}</span>`}
              ${distText ? `<span style="color: #ffffff; font-size: 10px; font-weight: 800; background: ${isNearest ? 'rgba(16, 185, 129, 0.3)' : 'rgba(255,255,255,0.18)'}; padding: 1px 5px; border-radius: 4px;">${distText}</span>` : ''}
              ${accuracy ? `<span style="color: #94a3b8; font-size: 9px; font-family: monospace;">±${Math.round(accuracy)}m</span>` : ''}
            </div>
          </div>

          <!-- Rotating Vehicle Marker -->
          <div style="position: relative; width: 44px; height: 44px; margin-bottom: 6px; transform: rotate(${heading}deg); transition: transform 0.35s ease-out; display: flex; align-items: center; justify-content: center;">
            <!-- Heading notch pointer -->
            <div style="position: absolute; top: -7px; left: 50%; transform: translateX(-50%); width: 0; height: 0; border-left: 6px solid transparent; border-right: 6px solid transparent; border-bottom: 9px solid ${borderColor}; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.5));"></div>
            <!-- Circle core -->
            <div style="width: 44px; height: 44px; border-radius: 50%; background: #000000; border: 3px solid ${borderColor}; color: #ffffff; display: flex; align-items: center; justify-content: center; box-shadow: ${glowShadow}, 0 0 0 2px rgba(0,0,0,0.5); font-size: 20px;">
              🏍️
            </div>
          </div>
        </div>
      `,
      iconSize: [140, 96],
      iconAnchor: [70, 72],
      popupAnchor: [0, -72],
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

    L.control.zoom({ position: 'bottomright' }).addTo(map);

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

    const hasPickup = Boolean(pickupLat && pickupLng && pickupAddress && pickupAddress.trim() !== '');
    const hasDropoff = Boolean(dropoffLat && dropoffLng && dropoffAddress && dropoffAddress.trim() !== '');

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

    // Always show passenger standing marker with icon whenever passenger coordinates are available and not suppressed
    const shouldShowPassengerStanding = Boolean(
      passengerLat &&
      passengerLng &&
      !showLocationsABOnly
    );

    // Check if pickup is currently set to the passenger's exact position
    const isPickupAtPassenger = Boolean(
      hasPickup &&
      pickupLat &&
      pickupLng &&
      passengerLat &&
      passengerLng &&
      (distToPickupMeters !== null ? distToPickupMeters < 12 : false)
    );

    // 1. Passenger Standing Location Marker (Always displayed on map with custom passenger hailing silhouette icon)
    if (shouldShowPassengerStanding && passengerLat && passengerLng) {
      bounds.push([passengerLat, passengerLng]);
      const labelText = isPickupAtPassenger
        ? 'A • PICKUP (Current Position)'
        : hasPickup
        ? (passengerName === 'My Location' || passengerName === 'Standing Here' ? '🧍 You (Tap for A)' : `${passengerName} (Tap for A)`)
        : '📍 Tap to set Pickup';
      const pIcon = createPassengerIcon(labelText, isPickupAtPassenger);

      if (!passengerMarkerRef.current || !map.hasLayer(passengerMarkerRef.current)) {
        if (passengerMarkerRef.current) {
          try {
            map.removeLayer(passengerMarkerRef.current);
          } catch {}
        }
        passengerMarkerRef.current = L.marker([passengerLat, passengerLng], {
          icon: pIcon,
          zIndexOffset: 3000,
        }).addTo(map);
      } else {
        passengerMarkerRef.current.setLatLng([passengerLat, passengerLng]);
        passengerMarkerRef.current.setIcon(pIcon);
      }

      // One click on passenger icon immediately adds / sets pickup location
      passengerMarkerRef.current.off('click');
      passengerMarkerRef.current.on('click', (e: L.LeafletMouseEvent) => {
        L.DomEvent.stopPropagation(e);
        if (onSetPickupToPassengerLocation && passengerLat && passengerLng) {
          onSetPickupToPassengerLocation(passengerLat, passengerLng);
        }
      });

      // Accuracy circle around passenger live location
      const circleRadius = Math.max(12, Math.min(passengerAccuracy || 20, 80));
      if (!passengerAccuracyCircleRef.current || !map.hasLayer(passengerAccuracyCircleRef.current)) {
        if (passengerAccuracyCircleRef.current) {
          try {
            map.removeLayer(passengerAccuracyCircleRef.current);
          } catch {}
        }
        passengerAccuracyCircleRef.current = L.circle([passengerLat, passengerLng], {
          radius: circleRadius,
          color: '#000000',
          fillColor: '#10b981',
          fillOpacity: 0.12,
          weight: 1.5,
          dashArray: '4, 4',
        }).addTo(map);
      } else {
        passengerAccuracyCircleRef.current.setLatLng([passengerLat, passengerLng]);
        passengerAccuracyCircleRef.current.setRadius(circleRadius);
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

    // 2. Pickup Marker (Location A - Only shown when pickup location is selected AND not at passenger standing position to prevent duplicate pins)
    if (hasPickup && pickupLat && pickupLng && !isPickupAtPassenger) {
      bounds.push([pickupLat, pickupLng]);
      const aIcon = createPickupIcon();

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
          .bindPopup(`
            <div style="font-family: inherit; font-size: 12px; line-height: 1.4; min-width: 175px; color: #000000;">
              <div style="font-weight: 900; color: #059669; display: flex; align-items: center; gap: 6px; font-size: 13px;">
                <span>🟢 Pickup Location (A)</span>
              </div>
              <div style="color: #1e293b; font-size: 11px; margin-top: 5px; font-weight: 600;">
                ${pickupAddress || 'Selected Pickup Point'}<br/>
                ${distToPickupMeters !== null ? `<span style="color: #64748b; font-weight: 500;">Passenger standing <b>${distToPickupMeters}m</b> away</span>` : ''}
              </div>
            </div>
          `);
      } else {
        // Do NOT call setIcon on existing marker - this prevents DOM reconstruction which causes shaking
        pickupMarkerRef.current.setLatLng([pickupLat, pickupLng]);
      }
    } else if (pickupMarkerRef.current) {
      map.removeLayer(pickupMarkerRef.current);
      pickupMarkerRef.current = null;
    }

    // Walking guide dashed line connecting Passenger Standing Location to Pickup Location A (only when standing separately)
    if (hasPickup && !isPickupAtPassenger && distToPickupMeters !== null && distToPickupMeters >= 4 && distToPickupMeters <= 1500 && passengerLat && passengerLng && pickupLat && pickupLng) {
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

    // 3. Dropoff Marker (Location B - Only shown when dropoff location is selected)
    if (hasDropoff && dropoffLat && dropoffLng) {
      bounds.push([dropoffLat, dropoffLng]);
      const bIcon = createDropoffIcon();

      if (!dropoffMarkerRef.current || !map.hasLayer(dropoffMarkerRef.current)) {
        if (dropoffMarkerRef.current) {
          try {
            map.removeLayer(dropoffMarkerRef.current);
          } catch {}
        }
        dropoffMarkerRef.current = L.marker([dropoffLat, dropoffLng], {
          icon: bIcon,
          zIndexOffset: 1500,
        })
          .addTo(map)
          .bindPopup(`<b>Destination (B):</b><br/>${dropoffAddress || 'Selected Point'}`);
      } else {
        // Do NOT call setIcon on existing marker - this prevents DOM reconstruction which causes shaking
        dropoffMarkerRef.current.setLatLng([dropoffLat, dropoffLng]);
      }
    } else if (dropoffMarkerRef.current) {
      map.removeLayer(dropoffMarkerRef.current);
      dropoffMarkerRef.current = null;
    }

    // 4. Captain Marker (Only shown if showPassengerOnly is false and coordinates provided)
    if (!showPassengerOnly && captainLat && captainLng) {
      bounds.push([captainLat, captainLng]);
      const cIcon = createCaptainIcon(
        captainHeading,
        captainName || (isCaptainMode ? 'You (Captain)' : 'Captain'),
        captainAccuracy,
        isCaptainMode
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
              <div>Status: <b>Online & Live Tracking</b></div>
              ${captainAccuracy ? `<div>GPS Accuracy: ±${Math.round(captainAccuracy)}m</div>` : ''}
              <div style="font-size: 11px; color: #64748b; margin-top: 2px;">GPS: ${captainLat.toFixed(5)}, ${captainLng.toFixed(5)}</div>
            </div>
          `);
      } else {
        captainMarkerRef.current.setLatLng([captainLat, captainLng]);
        captainMarkerRef.current.setIcon(cIcon);
      }

      // Accuracy circle around captain live position
      const capRadius = Math.max(12, Math.min(captainAccuracy || 20, 80));
      if (!captainAccuracyCircleRef.current || !map.hasLayer(captainAccuracyCircleRef.current)) {
        if (captainAccuracyCircleRef.current) {
          try {
            map.removeLayer(captainAccuracyCircleRef.current);
          } catch {}
        }
        captainAccuracyCircleRef.current = L.circle([captainLat, captainLng], {
          radius: capRadius,
          color: '#f59e0b',
          fillColor: '#f59e0b',
          fillOpacity: 0.12,
          weight: 1.5,
          dashArray: '4, 4',
        }).addTo(map);
      } else {
        captainAccuracyCircleRef.current.setLatLng([captainLat, captainLng]);
        captainAccuracyCircleRef.current.setRadius(capRadius);
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

    // 5. Polyline Route (Connecting from pickup Location A to drop-off Location B)
    if (hasPickup && hasDropoff && pickupLat && pickupLng && dropoffLat && dropoffLng) {
      const latlngs: [number, number][] = [
        [pickupLat, pickupLng],
        [dropoffLat, dropoffLng],
      ];

      // Calculate distance using Haversine formula
      const calcDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
        const R = 6371; // km
        const dLat = ((lat2 - lat1) * Math.PI) / 180;
        const dLon = ((lon2 - lon1) * Math.PI) / 180;
        const a =
          Math.sin(dLat / 2) * Math.sin(dLat / 2) +
          Math.cos((lat1 * Math.PI) / 180) *
            Math.cos((lat2 * Math.PI) / 180) *
            Math.sin(dLon / 2) *
            Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return Number((R * c).toFixed(1));
      };

      const distance = calcDistance(pickupLat, pickupLng, dropoffLat, dropoffLng);
      const formattedDistance = distance < 1 ? `${Math.round(distance * 1000)}m` : `${distance} km`;

      const tooltipContent = `
        <div style="display: flex; align-items: center; gap: 8px; padding: 6px 14px; border-radius: 9999px; background: rgba(2, 6, 23, 0.95); border: 1.5px solid rgba(16, 185, 129, 0.7); box-shadow: 0 10px 25px -5px rgba(0,0,0,0.6); font-size: 11px; font-weight: 800; color: #f8fafc; backdrop-filter: blur(8px);">
          <span style="display: flex; width: 7px; height: 7px; border-radius: 50%; background: #34d399; box-shadow: 0 0 8px #34d399;"></span>
          <span style="color: #34d399; font-weight: 900; letter-spacing: 0.5px;">A ➔ B</span>
          <span style="color: #64748b;">•</span>
          <span style="font-family: monospace; color: #ffffff; font-size: 12px; font-weight: 900;">${formattedDistance}</span>
        </div>
      `;

      // 5a. Stretched glow / casing polyline
      if (!polylineGlowRef.current || !map.hasLayer(polylineGlowRef.current)) {
        if (polylineGlowRef.current) {
          try {
            map.removeLayer(polylineGlowRef.current);
          } catch {}
        }
        polylineGlowRef.current = L.polyline(latlngs, {
          color: '#059669',
          weight: 9,
          opacity: 0.35,
          lineCap: 'round',
          lineJoin: 'round',
        }).addTo(map);
      } else {
        polylineGlowRef.current.setLatLngs(latlngs);
      }

      // 5b. Stretched active animated polyline
      if (!polylineRef.current || !map.hasLayer(polylineRef.current)) {
        if (polylineRef.current) {
          try {
            map.removeLayer(polylineRef.current);
          } catch {}
        }
        polylineRef.current = L.polyline(latlngs, {
          color: '#10b981',
          weight: 4.5,
          opacity: 0.95,
          dashArray: '12, 10',
          className: 'stretch-polyline-dash',
          lineCap: 'round',
          lineJoin: 'round',
        }).addTo(map);
      } else {
        polylineRef.current.setLatLngs(latlngs);
      }

      // Refresh the tooltip to display updated distance centered on stretched polyline
      polylineRef.current.unbindTooltip();
      polylineRef.current.bindTooltip(tooltipContent, {
        permanent: true,
        direction: 'center',
        className: 'custom-distance-tooltip',
      }).openTooltip();
    } else {
      if (polylineRef.current) {
        map.removeLayer(polylineRef.current);
        polylineRef.current = null;
      }
      if (polylineGlowRef.current) {
        map.removeLayer(polylineGlowRef.current);
        polylineGlowRef.current = null;
      }
    }

    // Auto-fit bounds or center on position
    if (isCaptainMode && captainLat && captainLng) {
      if (!hasPickup && !hasDropoff) {
        // Standby/Browsing mode: focus on captain live GPS
        if (!hasInitiallyCenteredCaptainRef.current) {
          hasInitiallyCenteredCaptainRef.current = true;
          map.setView([captainLat, captainLng], 16, { animate: false });
        } else if (isFollowingCaptain) {
          map.panTo([captainLat, captainLng], { animate: true, duration: 0.4 });
        }
      } else {
        // Active ride in captain mode: fit route bounds or follow captain
        if (bounds.length > 1 && !isFollowingCaptain) {
          map.invalidateSize();
          map.fitBounds(L.latLngBounds(bounds), { padding: [60, 60], maxZoom: 16, animate: false });
        } else if (isFollowingCaptain) {
          map.panTo([captainLat, captainLng], { animate: true, duration: 0.4 });
        }
      }
    } else if (hasPickup && hasDropoff && pickupLat && pickupLng && dropoffLat && dropoffLng) {
      const currentRouteKey = `${pickupLat.toFixed(4)}_${pickupLng.toFixed(4)}_${dropoffLat.toFixed(4)}_${dropoffLng.toFixed(4)}_${shouldShowPassengerStanding}`;
      if (lastFittedRouteKeyRef.current !== currentRouteKey) {
        lastFittedRouteKeyRef.current = currentRouteKey;
        const routeBounds = L.latLngBounds([
          [pickupLat, pickupLng],
          [dropoffLat, dropoffLng],
        ]);
        if (shouldShowPassengerStanding && passengerLat && passengerLng) {
          routeBounds.extend([passengerLat, passengerLng]);
        }
        map.invalidateSize();
        map.fitBounds(routeBounds, {
          padding: [80, 80],
          maxZoom: 16,
          animate: false,
        });
      }
    } else if (!hasPickup && passengerLat && passengerLng && isFollowingPassenger) {
      map.setView([passengerLat, passengerLng], 16, { animate: false });
    } else if (bounds.length > 1 && !isFollowingPassenger) {
      map.invalidateSize();
      map.fitBounds(L.latLngBounds(bounds), { padding: [60, 60], maxZoom: 16, animate: false });
    } else if (bounds.length >= 1 && !isFollowingPassenger) {
      map.setView(bounds[0], 15, { animate: false });
    } else if (passengerLat && passengerLng && !hasInitiallyCenteredPassengerRef.current) {
      hasInitiallyCenteredPassengerRef.current = true;
      map.setView([passengerLat, passengerLng], 16, { animate: false });
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
  ]);

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
        mapInstanceRef.current.flyTo([targetLat, targetLng], 16, { animate: true, duration: 0.8 });
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
        mapInstanceRef.current.flyTo([targetLat, targetLng], 16, { animate: true, duration: 0.9 });
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
    } else if (pickupLat && pickupLng) {
      mapInstanceRef.current.flyTo([pickupLat, pickupLng], 15, { animate: true, duration: 0.8 });
    } else if (passengerLat && passengerLng) {
      mapInstanceRef.current.flyTo([passengerLat, passengerLng], 15, { animate: true, duration: 0.8 });
    } else if (captainLat && captainLng) {
      mapInstanceRef.current.flyTo([captainLat, captainLng], 15, { animate: true, duration: 0.8 });
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
