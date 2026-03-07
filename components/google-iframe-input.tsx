"use client";

import { useState, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { MapPin, Globe, CheckCircle2, XCircle, Loader2 } from "lucide-react";

interface GoogleIframeInputProps {
    onLocationExtracted?: (locationData: {
        latitude?: number;
        longitude?: number;
        placeId?: string;
        address?: string;
        zoom?: number;
    }) => void;
    value?: string;
    onChange?: (value: string) => void;
    disabled?: boolean;
}

export function GoogleIframeInput({
    onLocationExtracted,
    value = "",
    onChange,
    disabled = false
}: GoogleIframeInputProps) {
    const [iframeCode, setIframeCode] = useState(value);
    const [isProcessing, setIsProcessing] = useState(false);
    const [extractedData, setExtractedData] = useState<any>(null);
    const [error, setError] = useState<string | null>(null);

    const parseGoogleMapsIframe = useCallback((iframeHtml: string) => {
        try {
            // Extract src attribute from iframe
            const srcMatch = iframeHtml.match(/src=["']([^"']+)["']/i);
            if (!srcMatch) {
                throw new Error("Invalid iframe code. Please paste a complete Google Maps embed iframe.");
            }

            const srcUrl = srcMatch[1];

            // Check if it's a Google Maps URL
            if (!srcUrl.includes('maps.google.com') && !srcUrl.includes('google.com/maps')) {
                throw new Error("Please provide a valid Google Maps embed iframe.");
            }

            // Parse URL parameters
            const url = new URL(srcUrl);
            const params = new URLSearchParams(url.search);

            const locationData: any = {};

            // Extract place ID if present
            const placeId = params.get('place_id') || params.get('place');
            if (placeId) {
                locationData.placeId = placeId;
            }

            // Extract coordinates from various possible formats
            const q = params.get('q');
            if (q) {
                // Check if q contains coordinates (format: lat,lng)
                const coordMatch = q.match(/^(-?\d+\.?\d*),(-?\d+\.?\d*)$/);
                if (coordMatch) {
                    locationData.latitude = parseFloat(coordMatch[1]);
                    locationData.longitude = parseFloat(coordMatch[2]);
                } else {
                    // Store as address
                    locationData.address = decodeURIComponent(q);
                }
            }

            // Extract center coordinates
            const center = params.get('center');
            if (center && !locationData.latitude) {
                const coordMatch = center.match(/^(-?\d+\.?\d*),(-?\d+\.?\d*)$/);
                if (coordMatch) {
                    locationData.latitude = parseFloat(coordMatch[1]);
                    locationData.longitude = parseFloat(coordMatch[2]);
                }
            }

            // Extract zoom level
            const zoom = params.get('zoom') || params.get('z');
            if (zoom) {
                locationData.zoom = parseInt(zoom);
            }

            // Extract ll (latitude,longitude) parameter
            const ll = params.get('ll');
            if (ll && !locationData.latitude) {
                const coordMatch = ll.match(/^(-?\d+\.?\d*),(-?\d+\.?\d*)$/);
                if (coordMatch) {
                    locationData.latitude = parseFloat(coordMatch[1]);
                    locationData.longitude = parseFloat(coordMatch[2]);
                }
            }

            // Extract from pb parameter (Google Maps serialized string)
            const pb = params.get('pb');
            if (pb && !locationData.latitude) {
                // pb usually contains !2d<longitude> and !3d<latitude>
                const latMatch = pb.match(/!3d(-?\d+\.?\d*)/);
                const lngMatch = pb.match(/!2d(-?\d+\.?\d*)/);
                
                if (latMatch) locationData.latitude = parseFloat(latMatch[1]);
                if (lngMatch) locationData.longitude = parseFloat(lngMatch[1]);

                // Extract name/address from !2s
                 const sMatch = pb.match(/!2s([^!]+)/);
                 if (sMatch && !locationData.address) {
                     let decoded = decodeURIComponent(sMatch[1].replace(/\+/g, ' '));
                     // Basic HTML entity decoding for common characters like &#39;
                     decoded = decoded.replace(/&#39;/g, "'")
                                    .replace(/&amp;/g, "&")
                                    .replace(/&quot;/g, '"')
                                    .replace(/&lt;/g, "<")
                                    .replace(/&gt;/g, ">");
                     locationData.address = decoded;
                 }
            }

            // Validate that we have some location data
            if (!locationData.latitude && !locationData.longitude && !locationData.placeId && !locationData.address) {
                throw new Error("Could not extract location data from the iframe. Please ensure the iframe contains valid location information.");
            }

            return locationData;

        } catch (err) {
            throw new Error(err instanceof Error ? err.message : "Failed to parse iframe code");
        }
    }, []);

    const handleExtractLocation = useCallback(async () => {
        if (!iframeCode.trim()) {
            setError("Please enter iframe code");
            return;
        }

        setIsProcessing(true);
        setError(null);
        setExtractedData(null);

        try {
            const locationData = parseGoogleMapsIframe(iframeCode);
            setExtractedData(locationData);
            onLocationExtracted?.(locationData);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to extract location data");
        } finally {
            setIsProcessing(false);
        }
    }, [iframeCode, parseGoogleMapsIframe, onLocationExtracted]);

    const handleIframeChange = (newValue: string) => {
        setIframeCode(newValue);
        onChange?.(newValue);
        setError(null);
        setExtractedData(null);
    };

    const getValidationStatus = () => {
        if (error) return "error";
        if (extractedData) return "success";
        return "idle";
    };

    const status = getValidationStatus();

    return (
        <Card className="border-dashed">
            <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-primary" />
                    Extract Location from Google Maps
                </CardTitle>
                <CardDescription className="text-xs">
                    Paste the "Embed a map" HTML code from Google Maps to automatically extract coordinates.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
                <Textarea
                    placeholder='<iframe src="https://www.google.com/maps/embed?..." ...></iframe>'
                    className="min-h-[80px] text-xs font-mono"
                    value={iframeCode}
                    onChange={(e) => handleIframeChange(e.target.value)}
                    disabled={disabled || isProcessing}
                />
                
                <div className="flex justify-between items-center">
                    <div className="flex gap-2">
                        {extractedData && !error && (
                            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 text-[10px]">
                                <CheckCircle2 className="h-3 w-3 mr-1" />
                                Location Extracted
                            </Badge>
                        )}
                        {error && (
                            <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 text-[10px]">
                                <XCircle className="h-3 w-3 mr-1" />
                                Invalid Code
                            </Badge>
                        )}
                    </div>
                    <Button 
                        type="button" 
                        size="sm" 
                        onClick={handleExtractLocation}
                        disabled={!iframeCode.trim() || disabled || isProcessing}
                    >
                        {isProcessing ? (
                            <Loader2 className="h-3 w-3 animate-spin mr-1" />
                        ) : (
                            <Globe className="h-3 w-3 mr-1" />
                        )}
                        Extract
                    </Button>
                </div>

                {error && (
                    <p className="text-[10px] text-destructive mt-1">{error}</p>
                )}

                {extractedData && !error && (
                    <div className="grid grid-cols-2 gap-2 p-2 bg-muted/50 rounded text-[10px]">
                        <div>
                            <span className="text-muted-foreground block uppercase font-bold tracking-tighter">Latitude</span>
                            <span className="font-mono">{extractedData.latitude?.toFixed(6) || "N/A"}</span>
                        </div>
                        <div>
                            <span className="text-muted-foreground block uppercase font-bold tracking-tighter">Longitude</span>
                            <span className="font-mono">{extractedData.longitude?.toFixed(6) || "N/A"}</span>
                        </div>
                        {extractedData.address && (
                            <div className="col-span-2">
                                <span className="text-muted-foreground block uppercase font-bold tracking-tighter">Extracted Address</span>
                                <span className="truncate block">{extractedData.address}</span>
                            </div>
                        )}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
