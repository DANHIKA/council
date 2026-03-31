import { NextRequest, NextResponse } from "next/server";

function extractCoordsFromUrl(url: string): { latitude?: number; longitude?: number; address?: string } {
    try {
        const urlObj = new URL(url);

        // /maps/place/Name/@lat,lng,zoom or /maps/@lat,lng,zoom
        const atMatch = urlObj.pathname.match(/@(-?\d+\.?\d*),(-?\d+\.?\d*)/);
        if (atMatch) {
            return { latitude: parseFloat(atMatch[1]), longitude: parseFloat(atMatch[2]) };
        }

        // q=lat,lng or q=address
        const q = urlObj.searchParams.get("q");
        if (q) {
            const coordMatch = q.match(/^(-?\d+\.?\d*),(-?\d+\.?\d*)$/);
            if (coordMatch) {
                return { latitude: parseFloat(coordMatch[1]), longitude: parseFloat(coordMatch[2]) };
            }
            return { address: decodeURIComponent(q) };
        }

        // center=lat,lng
        const center = urlObj.searchParams.get("center");
        if (center) {
            const coordMatch = center.match(/^(-?\d+\.?\d*),(-?\d+\.?\d*)$/);
            if (coordMatch) {
                return { latitude: parseFloat(coordMatch[1]), longitude: parseFloat(coordMatch[2]) };
            }
        }

        // pb=...!3d<lat>...!2d<lng>
        const pb = urlObj.searchParams.get("pb");
        if (pb) {
            const latMatch = pb.match(/!3d(-?\d+\.?\d*)/);
            const lngMatch = pb.match(/!2d(-?\d+\.?\d*)/);
            if (latMatch && lngMatch) {
                return { latitude: parseFloat(latMatch[1]), longitude: parseFloat(lngMatch[1]) };
            }
        }

        return {};
    } catch {
        return {};
    }
}

export async function POST(req: NextRequest) {
    try {
        const { url } = await req.json();

        if (!url || typeof url !== "string") {
            return NextResponse.json({ error: "URL is required" }, { status: 400 });
        }

        const isGoogleMaps =
            url.includes("google.com/maps") ||
            url.includes("maps.app.goo.gl") ||
            url.includes("goo.gl/maps") ||
            url.includes("maps.google.com");

        if (!isGoogleMaps) {
            return NextResponse.json({ error: "Not a valid Google Maps link" }, { status: 400 });
        }

        let resolvedUrl = url;

        // Follow redirects for short URLs to get the full URL with coordinates
        if (url.includes("goo.gl") || url.includes("maps.app.goo.gl")) {
            const response = await fetch(url, {
                method: "GET",
                redirect: "follow",
                headers: { "User-Agent": "Mozilla/5.0 (compatible; CouncilPermitPortal/1.0)" },
            });
            resolvedUrl = response.url;
        }

        const coords = extractCoordsFromUrl(resolvedUrl);

        if (!coords.latitude || !coords.longitude) {
            return NextResponse.json(
                { error: "Could not extract coordinates from this link. Try searching on the map instead." },
                { status: 422 }
            );
        }

        return NextResponse.json({ resolvedUrl, ...coords });
    } catch (error) {
        console.error("Resolve map link error:", error);
        return NextResponse.json({ error: "Failed to resolve URL" }, { status: 500 });
    }
}
