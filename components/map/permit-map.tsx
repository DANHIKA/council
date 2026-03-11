"use client";

import { useEffect, useState, useCallback } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getStatusColor, getStatusLabel } from "@/lib/utils";
import type { Application } from "@/lib/types";
import { MapPin, Target, Loader2 } from "lucide-react";

// Fix Leaflet default icon issue
const iconUrl = "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png";
const iconRetinaUrl = "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png";
const shadowUrl = "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png";

const DefaultIcon = L.icon({
    iconUrl,
    iconRetinaUrl,
    shadowUrl,
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41],
});

// Custom icon for user location
const UserLocationIcon = L.divIcon({
  html: `<div class="bg-blue-500 w-4 h-4 rounded-full border-2 border-white shadow-lg animate-pulse"></div>`,
  className: "user-location-marker",
  iconSize: [16, 16],
  iconAnchor: [8, 8],
});

L.Marker.prototype.options.icon = DefaultIcon;

interface PermitMapProps {
    applications: Application[];
}

function MapController({ center }: { center: [number, number] | null }) {
    const map = useMap();
    useEffect(() => {
        if (center) {
            map.setView(center, 14);
        }
    }, [center, map]);
    return null;
}

export default function PermitMap({ applications }: PermitMapProps) {
    const defaultCenter: [number, number] = [-26.2041, 28.0473]; // Johannesburg default
    const [center, setCenter] = useState<[number, number]>(defaultCenter);
    const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
    const [isLocating, setIsLocating] = useState(false);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
        // Try to get user location on mount
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const { latitude, longitude } = position.coords;
                    const loc: [number, number] = [latitude, longitude];
                    setUserLocation(loc);
                    setCenter(loc);
                },
                (error) => {
                    console.error("Geolocation error:", error);
                }
            );
        }
    }, []);

    const handleLocateMe = useCallback(() => {
        if (!navigator.geolocation) return;
        
        setIsLocating(true);
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const { latitude, longitude } = position.coords;
                const loc: [number, number] = [latitude, longitude];
                setUserLocation(loc);
                setCenter(loc);
                setIsLocating(false);
            },
            (error) => {
                console.error("Geolocation error:", error);
                setIsLocating(false);
            }
        );
    }, []);

    if (!mounted) return <div className="h-full w-full bg-muted/20 animate-pulse rounded-lg" />;

    return (
        <div className="relative h-full w-full">
            <MapContainer
                center={center}
                zoom={12}
                scrollWheelZoom={true}
                style={{ height: "100%", width: "100%", borderRadius: "0.5rem" }}
            >
                <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <MapController center={center} />
                
                {userLocation && (
                    <Marker position={userLocation} icon={UserLocationIcon}>
                        <Popup>
                            <span className="text-xs font-medium">You are here</span>
                        </Popup>
                    </Marker>
                )}

                {applications.map((app) => (
                    app.latitude && app.longitude ? (
                        <Marker
                            key={app.id}
                            position={[app.latitude, app.longitude]}
                        >
                            <Popup>
                                <div className="p-1 min-w-[200px]">
                                    <div className="flex items-center justify-between mb-2 gap-2">
                                        <h3 className="font-bold text-sm">{app.permitType}</h3>
                                        <Badge className={getStatusColor(app.status)} variant="secondary">
                                            {getStatusLabel(app.status)}
                                        </Badge>
                                    </div>
                                    <p className="text-xs mb-2 line-clamp-2">{app.description}</p>
                                    <p className="text-xs text-muted-foreground mb-2">{app.location}</p>
                                    <Button size="sm" className="w-full h-7 text-xs" render={<Link href={`/applications/${app.id}`} />}>
                                    View Details
                                </Button>
                                </div>
                            </Popup>
                        </Marker>
                    ) : null
                ))}
            </MapContainer>

            {/* Locate Me Button Overlay */}
            <div className="absolute bottom-6 right-6 z-[1000]">
                <Button 
                    size="icon" 
                    variant="secondary" 
                    className="h-10 w-10 rounded-full shadow-lg border border-border"
                    onClick={handleLocateMe}
                    disabled={isLocating}
                    title="Find my location"
                >
                    {isLocating ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                        <Target className="h-5 w-5 text-primary" />
                    )}
                </Button>
            </div>
        </div>
    );
}
