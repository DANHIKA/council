"use client";

import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getStatusColor, getStatusLabel } from "@/lib/utils";
import type { Application } from "@/lib/types";

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

L.Marker.prototype.options.icon = DefaultIcon;

interface PermitMapProps {
    applications: Application[];
}

function MapController({ center }: { center: [number, number] }) {
    const map = useMap();
    useEffect(() => {
        map.setView(center);
    }, [center, map]);
    return null;
}

export default function PermitMap({ applications }: PermitMapProps) {
    const defaultCenter: [number, number] = [-26.2041, 28.0473]; // Johannesburg default
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    if (!mounted) return <div className="h-full w-full bg-muted/20 animate-pulse rounded-lg" />;

    return (
        <MapContainer
            center={defaultCenter}
            zoom={12}
            scrollWheelZoom={true}
            style={{ height: "100%", width: "100%", borderRadius: "0.5rem" }}
        >
            <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
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
                                <Button size="sm" className="w-full h-7 text-xs" asChild>
                                    <Link href={`/applications/${app.id}`}>View Details</Link>
                                </Button>
                            </div>
                        </Popup>
                    </Marker>
                ) : null
            ))}
        </MapContainer>
    );
}
