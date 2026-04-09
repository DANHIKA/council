"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import MapLibreGL from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { MapPin, Link2, Search, X, Loader2, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export interface LocationValue {
    location: string;
    latitude?: number;
    longitude?: number;
}

interface LocationPickerProps {
    value: LocationValue;
    onChange: (value: LocationValue) => void;
    error?: string;
    disabled?: boolean;
}

interface GeocodingResult {
    place_id: number;
    display_name: string;
    lat: string;
    lon: string;
}

// Lilongwe, Malawi — center and bounds for the location picker
const LILONGWE_CENTER: [number, number] = [33.7741, -13.9626];
const DEFAULT_CENTER = LILONGWE_CENTER;
const DEFAULT_ZOOM = 12;
// Rough bounding box for Lilongwe (~20km radius around center)
const LILONGWE_BOUNDS: [[number, number], [number, number]] = [
    [33.60, -14.10],  // southwest
    [33.95, -13.80],  // northeast
];

const CARTO_LIGHT = "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json";
const CARTO_DARK = "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json";

function resolveMapStyle() {
    if (typeof document === "undefined") return CARTO_LIGHT;
    return document.documentElement.classList.contains("dark") ? CARTO_DARK : CARTO_LIGHT;
}

export function LocationPicker({ value, onChange, error, disabled }: LocationPickerProps) {
    const [expanded, setExpanded] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [searchResults, setSearchResults] = useState<GeocodingResult[]>([]);
    const [searching, setSearching] = useState(false);
    const [mapLinkInput, setMapLinkInput] = useState("");
    const [resolvingLink, setResolvingLink] = useState(false);
    const [linkError, setLinkError] = useState<string | null>(null);
    const [mapReady, setMapReady] = useState(false);

    const mapContainerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<MapLibreGL.Map | null>(null);
    const markerRef = useRef<MapLibreGL.Marker | null>(null);
    // Keep latest onChange/value in a ref so map click handler doesn't go stale
    const onChangeRef = useRef(onChange);
    const valueRef = useRef(value);
    useEffect(() => { onChangeRef.current = onChange; }, [onChange]);
    useEffect(() => { valueRef.current = value; }, [value]);

    // Initialize map when panel expands
    useEffect(() => {
        if (!expanded) return;

        const container = mapContainerRef.current;
        if (!container || mapRef.current) return;

        const map = new MapLibreGL.Map({
            container,
            style: resolveMapStyle(),
            center: value.longitude != null && value.latitude != null
                ? [value.longitude, value.latitude]
                : DEFAULT_CENTER,
            zoom: value.longitude != null && value.latitude != null ? 14 : DEFAULT_ZOOM,
            attributionControl: false,
            maxBounds: LILONGWE_BOUNDS,
            minZoom: 11,
            maxZoom: 18,
        });

        map.addControl(new MapLibreGL.NavigationControl({ showCompass: false }), "top-right");
        map.addControl(new MapLibreGL.AttributionControl({ compact: true }), "bottom-right");

        map.on("load", () => {
            map.resize();
            setMapReady(true);

            // Place existing marker if coordinates already set
            if (valueRef.current.latitude != null && valueRef.current.longitude != null) {
                const m = new MapLibreGL.Marker({ color: "#3b82f6" })
                    .setLngLat([valueRef.current.longitude, valueRef.current.latitude])
                    .addTo(map);
                markerRef.current = m;
            }
        });

        map.on("click", async (e) => {
            const { lng, lat } = e.lngLat;

            if (markerRef.current) {
                markerRef.current.setLngLat([lng, lat]);
            } else {
                const m = new MapLibreGL.Marker({ color: "#3b82f6" })
                    .setLngLat([lng, lat])
                    .addTo(map);
                markerRef.current = m;
            }

            // Reverse geocode
            try {
                const res = await fetch(
                    `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`
                );
                const data = await res.json();
                const address: string = data.display_name || `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
                onChangeRef.current({ location: address, latitude: lat, longitude: lng });
            } catch {
                onChangeRef.current({ ...valueRef.current, latitude: lat, longitude: lng });
            }
        });

        mapRef.current = map;

        return () => {
            map.remove();
            mapRef.current = null;
            markerRef.current = null;
            setMapReady(false);
        };
    }, [expanded]); // eslint-disable-line react-hooks/exhaustive-deps

    // Keep marker in sync when coordinates change externally (e.g. from link resolver)
    useEffect(() => {
        const map = mapRef.current;
        if (!map || value.latitude == null || value.longitude == null) return;

        if (markerRef.current) {
            markerRef.current.setLngLat([value.longitude, value.latitude]);
        } else if (mapRef.current) {
            const m = new MapLibreGL.Marker({ color: "#3b82f6" })
                .setLngLat([value.longitude, value.latitude])
                .addTo(map);
            markerRef.current = m;
        }

        map.flyTo({ center: [value.longitude, value.latitude], zoom: 14, duration: 800 });
    }, [value.latitude, value.longitude]);

    const handleSearch = useCallback(async () => {
        if (!searchQuery.trim()) return;
        setSearching(true);
        setSearchResults([]);
        try {
            const res = await fetch(
                `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(searchQuery + ', Lilongwe, Malawi')}&format=json&limit=5&countrycodes=mw&viewbox=33.60,-13.80,33.95,-14.10&bounded=1`
            );
            const data: GeocodingResult[] = await res.json();
            setSearchResults(data);
        } catch {
            // silent — user can try again
        } finally {
            setSearching(false);
        }
    }, [searchQuery]);

    const handleSelectSearchResult = (result: GeocodingResult) => {
        const lat = parseFloat(result.lat);
        const lng = parseFloat(result.lon);
        setSearchResults([]);
        setSearchQuery("");
        onChange({ location: result.display_name, latitude: lat, longitude: lng });
    };

    const handleResolveLink = async () => {
        if (!mapLinkInput.trim()) return;
        setResolvingLink(true);
        setLinkError(null);
        try {
            const res = await fetch("/api/resolve-map-link", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ url: mapLinkInput }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Failed to resolve link");
            const locationStr = data.address || `${(data.latitude as number).toFixed(6)}, ${(data.longitude as number).toFixed(6)}`;
            onChange({
                location: value.location || locationStr,
                latitude: data.latitude as number,
                longitude: data.longitude as number,
            });
            setMapLinkInput("");
        } catch (err: any) {
            setLinkError(err.message || "Failed to resolve link");
        } finally {
            setResolvingLink(false);
        }
    };

    const clearCoordinates = () => {
        onChange({ location: value.location, latitude: undefined, longitude: undefined });
        if (markerRef.current) {
            markerRef.current.remove();
            markerRef.current = null;
        }
    };

    const hasCoords = value.latitude != null && value.longitude != null;

    return (
        <div className="space-y-1.5">
            {/* Location text input */}
            <Input
                placeholder="Where in Lilongwe will this take place?"
                value={value.location}
                onChange={(e) => onChange({ ...value, location: e.target.value })}
                disabled={disabled}
                className={cn(error && "border-destructive")}
            />

            {/* Coordinate badge */}
            {hasCoords && (
                <div className="flex items-center gap-1.5">
                    <Badge variant="secondary" className="text-[11px] gap-1 pl-1.5 pr-1 font-mono">
                        <MapPin className="h-3 w-3 text-blue-500 shrink-0" />
                        {value.latitude!.toFixed(5)}, {value.longitude!.toFixed(5)}
                        <button
                            type="button"
                            onClick={clearCoordinates}
                            disabled={disabled}
                            className="ml-0.5 hover:text-destructive transition-colors"
                            aria-label="Clear coordinates"
                        >
                            <X className="h-3 w-3" />
                        </button>
                    </Badge>
                </div>
            )}

            {error && <p className="text-xs text-destructive">{error}</p>}

            {/* Expand toggle */}
            <button
                type="button"
                onClick={() => setExpanded((v) => !v)}
                disabled={disabled}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
                <MapPin className="h-3 w-3" />
                {hasCoords ? "Update coordinates" : "Add precise coordinates"}
                <ChevronDown className={cn("h-3 w-3 transition-transform", expanded && "rotate-180")} />
            </button>

            {/* Expanded picker panel */}
            {expanded && (
                <div className="border rounded-xl overflow-hidden">
                    <Tabs defaultValue="map">
                        <TabsList className="w-full rounded-none border-b h-9 bg-muted/40">
                            <TabsTrigger value="map" className="flex-1 text-xs gap-1.5 rounded-none data-[state=active]:bg-background">
                                <MapPin className="h-3 w-3" />
                                Search &amp; Pin
                            </TabsTrigger>
                            <TabsTrigger value="link" className="flex-1 text-xs gap-1.5 rounded-none data-[state=active]:bg-background">
                                <Link2 className="h-3 w-3" />
                                Map Link
                            </TabsTrigger>
                        </TabsList>

                        {/* ── Search & Pin tab ── */}
                        <TabsContent value="map" className="m-0">
                            {/* Search bar */}
                            <div className="p-2 border-b bg-muted/20">
                                <div className="flex gap-1.5">
                                    <Input
                                        placeholder="Search in Lilongwe…"
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                                        className="h-8 text-xs"
                                    />
                                    <Button
                                        type="button"
                                        size="sm"
                                        variant="secondary"
                                        onClick={handleSearch}
                                        disabled={searching || !searchQuery.trim()}
                                        className="h-8 px-2.5 shrink-0"
                                    >
                                        {searching
                                            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                            : <Search className="h-3.5 w-3.5" />
                                        }
                                    </Button>
                                </div>

                                {searchResults.length > 0 && (
                                    <div className="mt-1.5 border rounded-lg overflow-hidden shadow-sm">
                                        {searchResults.map((r) => (
                                            <button
                                                key={r.place_id}
                                                type="button"
                                                onClick={() => handleSelectSearchResult(r)}
                                                className="w-full text-left px-2.5 py-2 text-xs hover:bg-muted transition-colors border-b last:border-b-0 leading-snug"
                                            >
                                                {r.display_name}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Map */}
                            <div className="relative">
                                <div ref={mapContainerRef} className="h-[240px] w-full" />
                                {!mapReady && (
                                    <div className="absolute inset-0 flex items-center justify-center bg-muted/60">
                                        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                                    </div>
                                )}
                                <div className="absolute bottom-2 left-2 bg-background/80 backdrop-blur-sm text-[10px] text-muted-foreground px-2 py-1 rounded pointer-events-none">
                                    Click anywhere to place a pin
                                </div>
                            </div>
                        </TabsContent>

                        {/* ── Map Link tab ── */}
                        <TabsContent value="link" className="m-0 p-3 space-y-2.5">
                            <p className="text-xs text-muted-foreground leading-relaxed">
                                Paste a Google Maps link — short links like <span className="font-mono">maps.app.goo.gl/…</span> or
                                full URLs like <span className="font-mono">google.com/maps/place/…</span> both work.
                                The server will resolve the link and extract coordinates.
                            </p>
                            <div className="flex gap-1.5">
                                <Input
                                    placeholder="https://maps.app.goo.gl/…"
                                    value={mapLinkInput}
                                    onChange={(e) => {
                                        setMapLinkInput(e.target.value);
                                        setLinkError(null);
                                    }}
                                    onKeyDown={(e) => e.key === "Enter" && handleResolveLink()}
                                    className="h-8 text-xs"
                                />
                                <Button
                                    type="button"
                                    size="sm"
                                    variant="secondary"
                                    onClick={handleResolveLink}
                                    disabled={resolvingLink || !mapLinkInput.trim()}
                                    className="h-8 px-3 shrink-0"
                                >
                                    {resolvingLink
                                        ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                        : "Extract"
                                    }
                                </Button>
                            </div>
                            {linkError && <p className="text-xs text-destructive">{linkError}</p>}
                            {hasCoords && !linkError && (
                                <div className="flex items-center gap-1.5 text-xs text-green-600 dark:text-green-400">
                                    <MapPin className="h-3.5 w-3.5" />
                                    Coordinates set: {value.latitude!.toFixed(5)}, {value.longitude!.toFixed(5)}
                                </div>
                            )}
                        </TabsContent>
                    </Tabs>
                </div>
            )}
        </div>
    );
}
