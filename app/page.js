"use client"
import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { Truck, Route as RouteIcon, Loader2, MapPin, Play, StopCircle, Menu, X, Globe, Gauge } from 'lucide-react'; // Added icons

const API_BASE_URL = 'https://mapwidth-backend.onrender.com/'; // Corrected URL structure
const DEFAULT_CENTER = [31.6339, 74.8770];
const DEFAULT_ZOOM = 14;

// Vehicle options with width in meters
const VEHICLES = [
    { label: "Bike", width: 1.0 },
    { label: "Car", width: 2.0 },
    { label: "4-Seater", width: 2.2 },
    { label: "7-Seater", width: 2.5 },
    { label: "Truck", width: 3.0 },
];

// --- Helper function to calculate bearing/rotation (in degrees) ---
const calculateBearing = (p1, p2) => {
    const lat1 = p1[0] * Math.PI / 180;
    const lon1 = p1[1] * Math.PI / 180;
    const lat2 = p2[0] * Math.PI / 180;
    const lon2 = p2[1] * Math.PI / 180;

    const dLon = lon2 - lon1;

    const y = Math.sin(dLon) * Math.cos(lat2);
    const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
    
    let brng = Math.atan2(y, x) * 180 / Math.PI;

    return (brng + 360) % 360;
};

// --- MapRenderer ---
const MapRenderer = ({ routePolyline, startMarker, endMarker, onMapClick, navIndex }) => {
    const mapRef = useRef(null);
    const layerGroupRef = useRef(null);
    const navMarkerRef = useRef(null);
    const [mapInitialized, setMapInitialized] = useState(false);

    const createNavIcon = useCallback((rotation = 0) => {
        if (typeof window.L === 'undefined') return null;
        
        const arrowHtml = `
            <div style="
                width: 0; 
                height: 0; 
                border-left: 8px solid transparent;
                border-right: 8px solid transparent;
                border-bottom: 15px solid #0056D6; /* Bright Blue Arrow */
                transform: rotate(${rotation}deg);
                transform-origin: 50% 100%;
                filter: drop-shadow(0 0 4px rgba(0, 0, 0, 0.4)); /* Stronger shadow */
            "></div>
        `;

        return window.L.divIcon({ 
            className: 'nav-arrow-icon',
            html: arrowHtml,
            iconSize: [16, 20],
            iconAnchor: [8, 20],
        });
    }, []);

    useEffect(() => {
        if (mapRef.current || typeof window.L === 'undefined') return;
        const L = window.L;
        const map = L.map('leaflet-map-container', { zoomControl: false }).setView(DEFAULT_CENTER, DEFAULT_ZOOM);
        mapRef.current = map;
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '&copy; OpenStreetMap contributors' }).addTo(map);
        layerGroupRef.current = L.layerGroup().addTo(map);
        L.control.zoom({ position: 'bottomright' }).addTo(map);

        map.on('click', e => {
            if (onMapClick) onMapClick({ lat: e.latlng.lat, lng: e.latlng.lng, name: "Selected Point" });
        });
        setMapInitialized(true);
        return () => { map.remove(); mapRef.current = null; };
    }, [onMapClick]);

    useEffect(() => {
        if (!mapInitialized || typeof window.L === 'undefined') return;
        const map = mapRef.current;
        const layerGroup = layerGroupRef.current;
        const L = window.L;
        
        layerGroup.clearLayers();

        const startIcon = L.divIcon({className:'bg-green-500 rounded-full w-3 h-3 shadow-lg ring-4 ring-white', iconSize: [12, 12]});
        const endIcon = L.divIcon({className:'bg-red-500 rounded-full w-3 h-3 shadow-lg ring-4 ring-white', iconSize: [12, 12]});


        if (startMarker) L.marker([startMarker.lat, startMarker.lng], { icon: startIcon }).addTo(layerGroup).bindPopup("Start");
        if (endMarker) L.marker([endMarker.lat, endMarker.lng], { icon: endIcon }).addTo(layerGroup).bindPopup("End");

        let pointsToFit = [];
        if (routePolyline && routePolyline.length > 1) {
            L.polyline(routePolyline, { color: '#10b981', weight: 6, opacity: 0.8, lineCap: 'round' }).addTo(layerGroup);
            pointsToFit = routePolyline;
        }

        if (routePolyline && navIndex !== null && navIndex < routePolyline.length) {
            const currentPoint = routePolyline[navIndex];
            const nextPoint = routePolyline[Math.min(navIndex + 1, routePolyline.length - 1)];
            
            const rotation = navIndex < routePolyline.length - 1 
                ? calculateBearing(currentPoint, nextPoint) 
                : 0;

            const navIcon = createNavIcon(rotation);

            if (navMarkerRef.current) {
                navMarkerRef.current.setLatLng(currentPoint);
                navMarkerRef.current.setIcon(navIcon);
            } else {
                navMarkerRef.current = L.marker(currentPoint, { icon: navIcon }).addTo(layerGroup);
            }
            
            map.panTo(currentPoint, { animate: true, duration: 0.3 });
        } else if (navMarkerRef.current) {
            navMarkerRef.current.remove();
            navMarkerRef.current = null;
        }

        if (startMarker && endMarker && !navMarkerRef.current) {
            pointsToFit.push([startMarker.lat, startMarker.lng]);
            pointsToFit.push([endMarker.lat, endMarker.lng]);

            if (pointsToFit.length > 1) map.fitBounds(pointsToFit, { 
                paddingTopLeft: [400, 50],
                paddingBottomRight: [50, 50] 
            });
            else if (pointsToFit.length === 1) map.setView(pointsToFit[0], DEFAULT_ZOOM);
        }

        map.invalidateSize();
    }, [routePolyline, startMarker, endMarker, navIndex, createNavIcon, mapInitialized]);

    return (
        <>
            <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
            <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
            <div id="leaflet-map-container" className="absolute inset-0 w-full h-full" style={{ zIndex: 1 }} />
        </>
    );
};

// --- Main App ---
const App = () => {
    const [startMarker, setStartMarker] = useState(null);
    const [endMarker, setEndMarker] = useState(null);
    const [selectedVehicle, setSelectedVehicle] = useState(VEHICLES[1]);
    const [routeData, setRouteData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [navIndex, setNavIndex] = useState(null);
    const [isNavigating, setIsNavigating] = useState(false);
    const [isPanelOpen, setIsPanelOpen] = useState(true);

    // Get current location
    useEffect(() => {
        navigator.geolocation.getCurrentPosition(pos => {
            setStartMarker({ lat: pos.coords.latitude, lng: pos.coords.longitude, name: "Current Location" });
            setIsPanelOpen(true);
        }, err => {
            console.error(err);
            setIsPanelOpen(true);
        });
    }, []);

    // Animate navigation
    useEffect(() => {
        if (!routeData?.route || !isNavigating) {
            setNavIndex(null); 
            return;
        }

        setNavIndex(0);
        
        const interval = setInterval(() => {
            setNavIndex(prev => {
                if (prev === null) return 0;
                if (prev + 1 < routeData.route.length) {
                    return prev + 1;
                } else {
                    setIsNavigating(false);
                    return routeData.route.length - 1;
                }
            });
        }, 300);

        return () => clearInterval(interval);
    }, [routeData, isNavigating]);

    // --- UPDATED fetchRoute function ---
    const fetchRoute = async () => {
        if (!startMarker || !endMarker) { 
            setError("Select start and end locations"); 
            return; 
        }
        setLoading(true); 
        setError(null); 
        setRouteData(null);
        setIsNavigating(false);
        
        try {
            const params = new URLSearchParams({
                start_lat: startMarker.lat,
                start_lon: startMarker.lng,
                end_lat: endMarker.lat,
                end_lon: endMarker.lng,
                vehicle_width: selectedVehicle.width*2.2
            }).toString();

            const response = await fetch(`${API_BASE_URL}route?${params}`); // Corrected API_BASE_URL usage
            const data = await response.json();
            
            // 1. Check for critical API failures (route field must exist)
            if (!data || !data.route) {
                // Throw error if no route was returned (even after fallback failure)
                throw new Error(data.error || "Route calculation failed. Check coordinates or Flask API status.");
            }
            
            // 2. Handle non-fatal warnings
            if (data.error) {
                // Set the warning message but proceed with displaying the route
                setError(data.error); 
            }

            // 3. Set placeholders if data is missing (for the frontend display)
            if (data.distance_km === undefined) data.distance_km = 0;
            if (data.duration_min === undefined) data.duration_min = 0;

            setRouteData(data);
            
        } catch (err) {
            // Display any fatal error caught
            setError(`[Error] ${err.message}. Ensure Flask API is running.`);
            setRouteData(null);
        } finally { 
            setLoading(false); 
        }
    };
    // --- END UPDATED fetchRoute function ---

    const handleStartNavigation = () => {
        if (routeData?.route && routeData.route.length > 0) {
            setIsNavigating(true);
            setIsPanelOpen(false);
        } else {
            setError("Please find a route first.");
        }
    };
    
    const handleStopNavigation = () => {
        setIsNavigating(false);
        setNavIndex(null);
        setIsPanelOpen(true);
    };

    return (
        <div className="relative w-full h-screen overflow-hidden">
            
            {/* 1. Full-Screen Map Background */}
            <MapRenderer
                routePolyline={routeData?.route}
                startMarker={startMarker}
                endMarker={endMarker}
                navIndex={navIndex}
                onMapClick={pos => setEndMarker(pos)}
            />
            
            {/* 2. Floating Action Button (FAB) */}
            <div className="fixed top-4 left-4 z-20">
                {isNavigating ? (
                    <button onClick={handleStopNavigation} className="p-3 rounded-full bg-red-600 text-white shadow-xl hover:bg-red-700 transition" aria-label="Stop Navigation">
                        <StopCircle className="w-6 h-6" />
                    </button>
                ) : !isPanelOpen && (
                    <button onClick={() => setIsPanelOpen(true)} className="p-3 rounded-full bg-white text-gray-800 shadow-xl hover:bg-gray-100 transition" aria-label="Open Route Planner">
                        <Menu className="w-6 h-6" />
                    </button>
                )}
            </div>

            {/* 3. Collapsible Side Panel for Controls and Details */}
            <div 
                className={`
                    fixed top-0 left-0 w-full h-full max-w-sm lg:w-96 lg:h-full lg:max-h-none
                    z-10 p-4 transition-transform duration-300 ease-in-out
                    bg-white/95 backdrop-blur-md shadow-2xl overflow-y-auto
                    ${isPanelOpen ? 'translate-x-0' : '-translate-x-full'}
                    lg:rounded-none
                `}
            >
                <div className="flex justify-between items-center border-b pb-4 mb-4">
                    <h1 className="text-2xl font-extrabold flex items-center text-gray-800">
                        <Truck className="mr-2 w-6 h-6 text-indigo-600" /> Wide Load Route
                    </h1>
                    <button onClick={() => setIsPanelOpen(false)} className="text-gray-500 hover:text-indigo-600 transition p-1" aria-label="Close Panel">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* Status/Inputs */}
                <div className="space-y-4 mb-6">
                    <div className="p-3 bg-gray-100 rounded-lg shadow-inner">
                        <p className="font-medium text-sm text-gray-600 flex items-center mb-1">
                            <MapPin className="w-4 h-4 mr-1 text-green-500" /> Start: {startMarker ? 'Current Location' : 'Loading...'}
                        </p>
                        <p className="font-medium text-sm text-gray-600 flex items-center">
                            <MapPin className="w-4 h-4 mr-1 text-red-500" /> End: {endMarker ? 'Selected Point' : 'Click on Map'}
                        </p>
                    </div>

                    {/* Vehicle selection (horizontal buttons) */}
                    <div className="space-y-2">
                        <p className="text-sm font-medium text-gray-700 flex items-center"><Truck className="w-4 h-4 mr-1 text-indigo-500" /> Select Vehicle Width</p>
                        <div className="flex flex-wrap gap-2">
                            {VEHICLES.map(v => (
                                <button key={v.label} onClick={() => setSelectedVehicle(v)} className={`flex-1 min-w-[70px] py-2 px-3 rounded-lg font-semibold text-sm transition ${selectedVehicle.label === v.label ? 'bg-indigo-600 text-white shadow-md' : 'bg-gray-200 text-gray-800 hover:bg-gray-300'}`}>
                                    {v.label} ({v.width}m)
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Action Buttons */}
                <div className="space-y-3">
                    <button onClick={fetchRoute} disabled={loading || !endMarker} className="w-full py-3 rounded-xl bg-indigo-600 text-white font-bold flex items-center justify-center shadow-lg hover:bg-indigo-700 transition disabled:opacity-50">
                        {loading ? <Loader2 className="animate-spin mr-2 w-5 h-5" /> : <RouteIcon className="mr-2 w-5 h-5" />} {routeData ? 'Re-Calculate Route' : 'Find Route'}
                    </button>
                    
                    {routeData && (
                        <button onClick={handleStartNavigation} className="w-full py-3 rounded-xl bg-green-600 text-white font-bold flex items-center justify-center shadow-lg hover:bg-green-700 transition">
                            <Play className="mr-2 w-5 h-5" /> Start Live Navigation
                        </button>
                    )}
                </div>


                {/* Results/Error Panel */}
                {error && (
                    <div className={`mt-6 border px-4 py-3 rounded-xl shadow-md text-sm ${routeData ? 'bg-yellow-50 border-yellow-400 text-yellow-700' : 'bg-red-50 border-red-400 text-red-700'}`}>
                        {error}
                    </div>
                )}

                {routeData && (
                    <div className="pt-6 border-t border-gray-200 space-y-3 mt-6">
                        <h3 className="text-xl font-bold text-gray-800">Route Summary</h3>
                        
                        {/* Distance and Time Display (Prominent) */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-gray-50 p-3 rounded-lg shadow-sm border border-gray-200">
                                <p className="text-gray-500 text-sm font-medium flex items-center"><Globe className="w-4 h-4 mr-1"/> Distance</p>
                                <p className="text-gray-800 text-2xl font-extrabold mt-1">{routeData.distance_km.toFixed(1)} <span className="text-lg font-semibold">km</span></p>
                            </div>
                            <div className="bg-gray-50 p-3 rounded-lg shadow-sm border border-gray-200">
                                <p className="text-gray-500 text-sm font-medium flex items-center"><Gauge className="w-4 h-4 mr-1"/> Avg Time</p>
                                <p className="text-gray-800 text-2xl font-extrabold mt-1">
                                    {selectedVehicle.width >= 3 ? routeData.duration_min + 9 : routeData.duration_min + 4} 
                                    <span className="text-lg font-semibold">min</span>
                                </p>
                            </div>
                        </div>
                        
                        <p className="text-gray-500 text-xs">Path Nodes: {routeData.num_nodes} | Vehicle Restriction: {selectedVehicle.width} m</p>

                        {/* Key Roads List (Collapsible) */}
                        {routeData.route_names && (
                            <details className="cursor-pointer">
                                <summary className="text-sm font-medium text-indigo-600 hover:text-indigo-700 transition">View Key Roads ({routeData.route_names.length})</summary>
                                <ul className="list-disc ml-5 text-sm text-gray-600 bg-gray-50 p-3 rounded mt-2 max-h-40 overflow-y-auto border">
                                    {routeData.route_names.map((n, i) => <li key={i}>{n}</li>)}
                                </ul>
                            </details>
                        )}
                    </div>
                )}
            </div>
            
        </div>
    );
};

export default App;
