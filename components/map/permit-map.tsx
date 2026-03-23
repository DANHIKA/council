"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { MapMouseEvent } from "maplibre-gl";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    Map,
    useMap,
    MapMarker,
    MarkerContent,
    MarkerPopup,
    MapControls,
} from "@/components/ui/map";
import { getStatusColor, getStatusLabel } from "@/lib/utils";
import type { Application } from "@/lib/types";
import { Ruler, RotateCcw, Pentagon, MapPin } from "lucide-react";

// MapLibre uses [longitude, latitude] — opposite of Leaflet!
const DEFAULT_CENTER: [number, number] = [28.0473, -26.2041]; // Johannesburg
const DEFAULT_ZOOM = 12;

const MAP_STYLES = {
    street: "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json",
    dark: "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json",
    voyager: "https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json",
} as const;

type MapStyleKey = keyof typeof MAP_STYLES;

const STYLE_LABELS: Record<MapStyleKey, string> = {
    street: "Street",
    dark: "Dark",
    voyager: "Terrain",
};

const STATUS_COLORS: Record<string, string> = {
    APPROVED: "#22c55e",
    REJECTED: "#ef4444",
    UNDER_REVIEW: "#eab308",
    REQUIRES_CORRECTION: "#f97316",
    SUBMITTED: "#3b82f6",
};

function getStatusColorHex(status: string): string {
    return STATUS_COLORS[status] ?? "#3b82f6";
}

function haversineDistance(
    [lng1, lat1]: [number, number],
    [lng2, lat2]: [number, number]
): number {
    const R = 6371000;
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lng2 - lng1) * Math.PI) / 180;
    const a =
        Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Shoelace formula for geodetic area in square metres.
 * Points are [lng, lat]. Returns absolute area in m².
 */
function polygonAreaM2(points: [number, number][]): number {
    if (points.length < 3) return 0;
    // Convert to Cartesian metres using equirectangular projection at centroid lat
    const avgLat = points.reduce((s, p) => s + p[1], 0) / points.length;
    const cosLat = Math.cos((avgLat * Math.PI) / 180);
    const R = 6371000;
    const toM = (p: [number, number]): [number, number] => [
        p[0] * (Math.PI / 180) * R * cosLat,
        p[1] * (Math.PI / 180) * R,
    ];
    const pts = points.map(toM);
    let area = 0;
    const n = pts.length;
    for (let i = 0; i < n; i++) {
        const [x1, y1] = pts[i];
        const [x2, y2] = pts[(i + 1) % n];
        area += x1 * y2 - x2 * y1;
    }
    return Math.abs(area / 2);
}

function formatArea(m2: number): string {
    if (m2 >= 10000) return `${(m2 / 10000).toFixed(2)} ha`;
    return `${m2.toFixed(0)} m²`;
}

// ─── Inner component (must be child of <Map> to use useMap) ──────────────────

interface MapInteractionsProps {
    mapStyle: MapStyleKey;
    measureMode: boolean;
    drawMode: boolean;
    onMapClick: (lng: number, lat: number) => void;
    onMapDblClick: (lng: number, lat: number) => void;
    onMouseMove: (lng: number, lat: number) => void;
    polygonPoints: [number, number][];
    polygonClosed: boolean;
    measurePoints: [number, number][];
}

function MapInteractions({
    mapStyle,
    measureMode,
    drawMode,
    onMapClick,
    onMapDblClick,
    onMouseMove,
    polygonPoints,
    polygonClosed,
    measurePoints,
}: MapInteractionsProps) {
    const { map } = useMap();
    const prevStyleRef = useRef<MapStyleKey>("street");
    const onClickRef = useRef(onMapClick);
    const onDblClickRef = useRef(onMapDblClick);
    const onMoveRef = useRef(onMouseMove);
    onClickRef.current = onMapClick;
    onDblClickRef.current = onMapDblClick;
    onMoveRef.current = onMouseMove;

    // Style change
    useEffect(() => {
        if (!map || prevStyleRef.current === mapStyle) return;
        prevStyleRef.current = mapStyle;
        map.setStyle(MAP_STYLES[mapStyle]);
    }, [map, mapStyle]);

    // Mouse cursor + click handlers
    useEffect(() => {
        if (!map) return;
        const active = measureMode || drawMode;
        map.getCanvas().style.cursor = active ? "crosshair" : "";

        const clickHandler = (e: MapMouseEvent) => {
            onClickRef.current(e.lngLat.lng, e.lngLat.lat);
        };
        const dblClickHandler = (e: MapMouseEvent) => {
            e.preventDefault();
            onDblClickRef.current(e.lngLat.lng, e.lngLat.lat);
        };
        const moveHandler = (e: MapMouseEvent) => {
            onMoveRef.current(e.lngLat.lng, e.lngLat.lat);
        };

        if (active) {
            map.on("click", clickHandler);
            map.on("dblclick", dblClickHandler);
        }
        map.on("mousemove", moveHandler);

        return () => {
            map.off("click", clickHandler);
            map.off("dblclick", dblClickHandler);
            map.off("mousemove", moveHandler);
            map.getCanvas().style.cursor = "";
        };
    }, [map, measureMode, drawMode]);

    // ── Draw polygon GeoJSON layer ──────────────────────────────────────────
    useEffect(() => {
        if (!map) return;

        const addLayers = () => {
            // Check if style is loaded
            if (!map.isStyleLoaded()) return;

            // Polygon fill + outline
            if (!map.getSource("draw-polygon")) {
                map.addSource("draw-polygon", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
                map.addLayer({
                    id: "draw-polygon-fill",
                    type: "fill",
                    source: "draw-polygon",
                    paint: { "fill-color": "#3b82f6", "fill-opacity": 0.15 },
                });
                map.addLayer({
                    id: "draw-polygon-outline",
                    type: "line",
                    source: "draw-polygon",
                    paint: { "line-color": "#3b82f6", "line-width": 2 },
                });
            }
            // In-progress draw line
            if (!map.getSource("draw-line")) {
                map.addSource("draw-line", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
                map.addLayer({
                    id: "draw-line-layer",
                    type: "line",
                    source: "draw-line",
                    paint: { "line-color": "#3b82f6", "line-width": 2, "line-dasharray": [4, 3] },
                });
            }
            // Measure line
            if (!map.getSource("measure-line")) {
                map.addSource("measure-line", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
                map.addLayer({
                    id: "measure-line-layer",
                    type: "line",
                    source: "measure-line",
                    paint: { "line-color": "#8b5cf6", "line-width": 2, "line-dasharray": [4, 3] },
                });
            }
        };

        // Try to add layers immediately if style is loaded
        if (map.isStyleLoaded()) {
            addLayers();
        }
        
        // Also listen for style load event
        map.on("style.load", addLayers);
        return () => { map.off("style.load", addLayers); };
    }, [map]);

    // Update polygon data
    useEffect(() => {
        if (!map) return;

        const polySource = map.getSource("draw-polygon") as any;
        const lineSource = map.getSource("draw-line") as any;

        if (!polySource || !lineSource) return;

        if (polygonPoints.length === 0) {
            polySource.setData({ type: "FeatureCollection", features: [] });
            lineSource.setData({ type: "FeatureCollection", features: [] });
            return;
        }

        if (polygonClosed && polygonPoints.length >= 3) {
            const ring = [...polygonPoints, polygonPoints[0]];
            polySource.setData({
                type: "FeatureCollection",
                features: [{ type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [ring] } }],
            });
            lineSource.setData({ type: "FeatureCollection", features: [] });
        } else {
            polySource.setData({ type: "FeatureCollection", features: [] });
            lineSource.setData({
                type: "FeatureCollection",
                features: [{ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: polygonPoints } }],
            });
        }
    }, [map, polygonPoints, polygonClosed]);

    // Update measure line data
    useEffect(() => {
        if (!map) return;
        const src = map.getSource("measure-line") as any;
        if (!src) return;
        if (measurePoints.length < 2) {
            src.setData({ type: "FeatureCollection", features: [] });
            return;
        }
        src.setData({
            type: "FeatureCollection",
            features: [{ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: measurePoints } }],
        });
    }, [map, measurePoints]);

    return null;
}

// ─── Main component ───────────────────────────────────────────────────────────

interface PermitMapProps {
    applications: Application[];
}

type ActiveTool = "none" | "measure" | "draw";

export default function PermitMap({ applications }: PermitMapProps) {
    const [mapStyle, setMapStyle] = useState<MapStyleKey>("street");
    const [activeTool, setActiveTool] = useState<ActiveTool>("none");

    // Measure tool
    const [measurePoints, setMeasurePoints] = useState<[number, number][]>([]);

    // Draw tool
    const [polygonPoints, setPolygonPoints] = useState<[number, number][]>([]);
    const [polygonClosed, setPolygonClosed] = useState(false);

    // Cursor coordinates
    const [coords, setCoords] = useState<{ lng: number; lat: number } | null>(null);

    const handleMapClick = useCallback(
        (lng: number, lat: number) => {
            if (activeTool === "measure") {
                setMeasurePoints(prev => [...prev, [lng, lat]]);
            } else if (activeTool === "draw" && !polygonClosed) {
                setPolygonPoints(prev => [...prev, [lng, lat]]);
            }
        },
        [activeTool, polygonClosed]
    );

    const handleMapDblClick = useCallback(
        (_lng: number, _lat: number) => {
            if (activeTool === "draw" && polygonPoints.length >= 3) {
                setPolygonClosed(true);
            }
        },
        [activeTool, polygonPoints.length]
    );

    const handleMouseMove = useCallback((lng: number, lat: number) => {
        setCoords({ lng, lat });
    }, []);

    const clearMeasure = () => setMeasurePoints([]);
    const clearPolygon = () => {
        setPolygonPoints([]);
        setPolygonClosed(false);
    };

    const toggleTool = (tool: ActiveTool) => {
        setActiveTool(prev => (prev === tool ? "none" : tool));
        if (tool === "measure") clearPolygon();
        if (tool === "draw") clearMeasure();
    };

    const measureTotal =
        measurePoints.length > 1
            ? measurePoints
                  .slice(1)
                  .reduce((acc, pt, i) => acc + haversineDistance(measurePoints[i], pt), 0)
            : 0;

    const polygonArea = polygonClosed ? polygonAreaM2(polygonPoints) : 0;

    const appsWithCoords = applications.filter(a => a.latitude != null && a.longitude != null);

    const measureMode = activeTool === "measure";
    const drawMode = activeTool === "draw";

    return (
        <div className="relative h-full w-full">
            <Map className="h-full w-full rounded-lg" center={DEFAULT_CENTER} zoom={DEFAULT_ZOOM}>
                <MapInteractions
                    mapStyle={mapStyle}
                    measureMode={measureMode}
                    drawMode={drawMode}
                    onMapClick={handleMapClick}
                    onMapDblClick={handleMapDblClick}
                    onMouseMove={handleMouseMove}
                    polygonPoints={polygonPoints}
                    polygonClosed={polygonClosed}
                    measurePoints={measurePoints}
                />

                <MapControls position="bottom-right" showZoom showLocate showFullscreen />

                {/* Application markers */}
                {appsWithCoords.map(app => (
                    <MapMarker key={app.id} longitude={app.longitude!} latitude={app.latitude!}>
                        <MarkerContent>
                            <div
                                className="rounded-full border-2 border-white shadow-lg cursor-pointer hover:scale-110 transition-transform"
                                style={{ width: 22, height: 22, backgroundColor: getStatusColorHex(app.status) }}
                            />
                        </MarkerContent>
                        <MarkerPopup>
                            <div className="p-3 min-w-[210px] text-foreground bg-background rounded-lg shadow-md border">
                                <div className="flex items-start justify-between mb-2 gap-2">
                                    <h3 className="font-bold text-sm leading-tight">{app.permitType}</h3>
                                    <Badge className={getStatusColor(app.status)} variant="secondary">
                                        {getStatusLabel(app.status)}
                                    </Badge>
                                </div>
                                {app.description && (
                                    <p className="text-xs text-muted-foreground mb-1 line-clamp-2">
                                        {app.description}
                                    </p>
                                )}
                                {app.location && (
                                    <p className="text-xs text-muted-foreground mb-2">
                                        <MapPin className="inline h-3 w-3 mr-0.5" />
                                        {app.location}
                                    </p>
                                )}
                                {app.latitude && app.longitude && (
                                    <p className="text-[10px] text-muted-foreground mb-2 font-mono">
                                        {app.latitude.toFixed(5)}, {app.longitude.toFixed(5)}
                                    </p>
                                )}
                                <Link
                                    href={`/applications/${app.id}`}
                                    className="block w-full text-center text-xs font-medium bg-primary text-primary-foreground rounded px-2 py-1.5"
                                >
                                    View Details
                                </Link>
                            </div>
                        </MarkerPopup>
                    </MapMarker>
                ))}

                {/* Measure point markers */}
                {measureMode &&
                    measurePoints.map((pt, idx) => (
                        <MapMarker key={`m-${idx}`} longitude={pt[0]} latitude={pt[1]}>
                            <MarkerContent>
                                <div
                                    className="rounded-full border-2 border-white shadow flex items-center justify-center text-white font-bold"
                                    style={{ width: 20, height: 20, backgroundColor: "#8b5cf6", fontSize: 9 }}
                                >
                                    {idx + 1}
                                </div>
                            </MarkerContent>
                            <MarkerPopup>
                                <div className="p-2 text-xs text-foreground bg-background rounded shadow border font-mono">
                                    <p className="font-medium mb-1">Point {idx + 1}</p>
                                    <p>Lat: {pt[1].toFixed(6)}</p>
                                    <p>Lng: {pt[0].toFixed(6)}</p>
                                </div>
                            </MarkerPopup>
                        </MapMarker>
                    ))}

                {/* Draw polygon vertex markers */}
                {drawMode &&
                    polygonPoints.map((pt, idx) => (
                        <MapMarker key={`d-${idx}`} longitude={pt[0]} latitude={pt[1]}>
                            <MarkerContent>
                                <div
                                    className="rounded-full border-2 border-white shadow flex items-center justify-center text-white font-bold"
                                    style={{ width: 18, height: 18, backgroundColor: "#3b82f6", fontSize: 9 }}
                                >
                                    {idx + 1}
                                </div>
                            </MarkerContent>
                        </MapMarker>
                    ))}

                {/* Tools panel — top right */}
                <div className="absolute top-4 right-4 z-10 flex flex-col gap-2">
                    {/* Style switcher */}
                    <div className="bg-background/95 backdrop-blur rounded-lg border shadow-lg p-1 flex flex-col gap-0.5">
                        {(Object.keys(MAP_STYLES) as MapStyleKey[]).map(style => (
                            <Button
                                key={style}
                                size="sm"
                                variant={mapStyle === style ? "default" : "ghost"}
                                className="h-7 text-xs"
                                onClick={() => setMapStyle(style)}
                            >
                                {STYLE_LABELS[style]}
                            </Button>
                        ))}
                    </div>
                    {/* Tool buttons */}
                    <div className="bg-background/95 backdrop-blur rounded-lg border shadow-lg p-1 flex flex-col gap-0.5">
                        <Button
                            size="icon"
                            variant={measureMode ? "default" : "ghost"}
                            className="h-8 w-8"
                            title="Measure Distance"
                            onClick={() => toggleTool("measure")}
                        >
                            <Ruler className="h-4 w-4" />
                        </Button>
                        <Button
                            size="icon"
                            variant={drawMode ? "default" : "ghost"}
                            className="h-8 w-8"
                            title="Draw Area (double-click to close)"
                            onClick={() => toggleTool("draw")}
                        >
                            <Pentagon className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            </Map>

            {/* Coordinate display — bottom left */}
            {coords && (
                <div className="absolute bottom-4 left-4 z-10 bg-background/90 backdrop-blur rounded-md border shadow px-2.5 py-1 pointer-events-none font-mono">
                    <p className="text-[10px] text-muted-foreground">
                        {coords.lat.toFixed(5)}°, {coords.lng.toFixed(5)}°
                    </p>
                </div>
            )}

            {/* Measure panel */}
            {measureMode && measurePoints.length > 0 && (
                <div className="absolute bottom-24 left-4 z-10 bg-background/95 backdrop-blur rounded-lg border shadow-lg p-3 min-w-[180px]">
                    <div className="flex items-center justify-between mb-2">
                        <p className="text-xs font-semibold flex items-center gap-1.5">
                            <Ruler className="h-3 w-3" /> Measurement
                        </p>
                        <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={clearMeasure}>
                            <RotateCcw className="h-3 w-3" />
                        </Button>
                    </div>
                    <div className="space-y-1 text-xs text-muted-foreground">
                        <p>Points: {measurePoints.length}</p>
                        <p className="font-medium text-foreground">
                            Distance:{" "}
                            {measureTotal >= 1000
                                ? `${(measureTotal / 1000).toFixed(2)} km`
                                : `${measureTotal.toFixed(1)} m`}
                        </p>
                    </div>
                </div>
            )}

            {/* Draw / area panel */}
            {drawMode && polygonPoints.length > 0 && (
                <div className="absolute bottom-24 left-4 z-10 bg-background/95 backdrop-blur rounded-lg border shadow-lg p-3 min-w-[200px]">
                    <div className="flex items-center justify-between mb-2">
                        <p className="text-xs font-semibold flex items-center gap-1.5">
                            <Pentagon className="h-3 w-3" /> Area Drawing
                        </p>
                        <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={clearPolygon}>
                            <RotateCcw className="h-3 w-3" />
                        </Button>
                    </div>
                    <div className="space-y-1 text-xs text-muted-foreground">
                        <p>Vertices: {polygonPoints.length}</p>
                        {!polygonClosed && (
                            <p className="italic">Double-click to close polygon</p>
                        )}
                        {polygonClosed && (
                            <p className="font-medium text-foreground">
                                Area: {formatArea(polygonArea)}
                            </p>
                        )}
                    </div>
                </div>
            )}

        </div>
    );
}

