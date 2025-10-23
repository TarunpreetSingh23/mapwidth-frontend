"use client";
import React, { useState, useEffect, useMemo } from 'react';
import { FaSpinner } from 'react-icons/fa'; // Only non-map icons imported here

// Coordinates for a central location in Amritsar, India
const AMRITSAR_COORDS = [31.6339, 74.8770];
const DEFAULT_CENTER = AMRITSAR_COORDS;

// --- MapAdjuster: Component to programmatically adjust the map view ---
// Must be defined outside MapVisualization but passed the necessary hook/props
const MapAdjuster = ({ route, useMapHook }) => {
    const map = useMapHook ? useMapHook() : null; 
    
    useEffect(() => {
        if (!map) return;
        
        // CRITICAL FIX: Force the map to resize itself.
        // This solves the common "blur/gray tiles" issue when Leaflet is rendered in a non-visible container first.
        map.invalidateSize();

        if (route && route.length > 0) {
            const bounds = route.map(p => [p[0], p[1]]);
            try {
                map.fitBounds(bounds, { padding: [50, 50] }); 
            } catch (e) {
                console.warn("Map bounds fit error:", e);
            }
        } else if (map) {
            // Reset to default center if no route is loaded
            map.setView(DEFAULT_CENTER, 14);
        }
    }, [map, route]);
    return null;
};
MapAdjuster.displayName = 'MapAdjuster';

// --- Custom Icon Factory ---
const createCustomIcon = (color, index) => {
    let L = null;
    try {
        L = typeof window !== 'undefined' ? require('leaflet') : null;
    } catch (e) {
        return null; 
    }

    if (!L) return null;

    // SVG Path for FaMapMarkerAlt (Manually embedded for compilation stability)
    const svgPath = "M172.268 501.67C26.971 291.031 0 269.413 0 192 0 85.961 85.961 0 192 0s192 85.961 192 192c0 77.413-26.971 99.031-172.268 309.67-9.535 13.774-29.93 13.773-39.464 0zM192 272c44.183 0 80-35.817 80-80s-35.817-80-80-80-80 35.817-80 80 35.817 80 80 80z";

    // Use Tailwind classes directly in HTML string
    const iconHtml = `<div class="flex flex-col items-center marker-icon-wrapper">
                        <span class="text-3xl text-${color}-600">
                            <svg fill="currentColor" viewBox="0 0 384 512" width="1em" height="1em" xmlns="http://www.w3.org/2000/svg">
                                <path d="${svgPath}"/>
                            </svg>
                        </span>
                        <span class="text-xs font-bold text-gray-800 bg-white px-1 rounded-sm shadow-md">${index === 0 ? 'START' : 'END'}</span>
                    </div>`;

    return L.divIcon({
        className: 'custom-map-icon',
        html: iconHtml,
        iconSize: [30, 48], 
        iconAnchor: [15, 48], 
        popupAnchor: [0, -48]
    });
};


// --- Reusable Map Component ---
const MapVisualization = ({ routeData, startMarker, endMarker }) => {
    const [MapComponents, setMapComponents] = useState(null);
    const [MapReady, setMapReady] = useState(false);
    const [mapRenderKey, setMapRenderKey] = useState(0); 

    // Dynamic loading of react-leaflet on mount
    useEffect(() => {
        if (typeof window !== 'undefined' && !MapComponents) {
            import('react-leaflet').then(mod => {
                const { MapContainer, TileLayer, Polyline, Marker, useMap } = mod;
                setMapComponents({ MapContainer, TileLayer, Polyline, Marker, useMap });
                setMapReady(true);
                setMapRenderKey(prev => prev + 1); 
            }).catch(e => {
                console.error("Failed to load map components:", e);
                setMapReady(false);
            });
        }
    }, [MapComponents]);

    if (!MapReady || !MapComponents) {
        // Fallback for loading state
        return (
            <div className="flex items-center justify-center w-full bg-gray-200 rounded-lg" style={{ height: '300px' }}>
                <FaSpinner className="animate-spin mr-3 text-gray-700" /> Loading Map Components...
            </div>
        );
    }

    const { MapContainer, TileLayer, Polyline, Marker, useMap } = MapComponents;
    const startIcon = createCustomIcon('green', 0);
    const endIcon = createCustomIcon('red', 1);

    // Determine the route/marker data to display
    const currentRoute = routeData?.route;
    const markerRoute = startMarker && endMarker 
        ? [[startMarker.lat, startMarker.lng], [endMarker.lat, endMarker.lng]] 
        : null;

    // Use route data if available, otherwise use markers for map adjustment
    const mapAdjustRoute = currentRoute || markerRoute;

    return (
        <div className="w-full rounded-xl shadow-2xl overflow-hidden" style={{ height: '300px' }}>
            <MapContainer 
                key={mapRenderKey} 
                center={DEFAULT_CENTER} 
                zoom={14} 
                scrollWheelZoom={true}
                className="w-full h-full z-0" // z-0 is important for Tailwind conflict
            >
                <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />

                {/* Draw Start Marker */}
                {startMarker && startIcon && (
                    <Marker 
                        position={[startMarker.lat, startMarker.lng]} 
                        icon={startIcon}
                        title={startMarker.name || "Start Point"}
                    />
                )}

                {/* Draw End Marker */}
                {endMarker && endIcon && (
                    <Marker 
                        position={[endMarker.lat, endMarker.lng]} 
                        icon={endIcon}
                        title={endMarker.name || "End Point"}
                    />
                )}

                {/* Draw the Route Polyline */}
                {currentRoute && (
                    <Polyline
                        positions={currentRoute}
                        color="#3b82f6" // blue-500
                        weight={6}
                        opacity={0.8}
                    />
                )}
                
                {/* Adjust map view based on route or markers */}
                <MapAdjuster route={mapAdjustRoute} useMapHook={useMap} />

            </MapContainer>
        </div>
    );
};

export default MapVisualization;
