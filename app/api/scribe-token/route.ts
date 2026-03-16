import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

export async function GET() {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) {
        return NextResponse.json({ error: "Scribe not configured" }, { status: 503 });
    }

    try {
        const res = await fetch(
            "https://api.elevenlabs.io/v1/scribe/realtime/signed-url?model_id=scribe_v2_realtime",
            {
                method: "GET",
                headers: {
                    "xi-api-key": apiKey,
                },
            }
        );

        if (!res.ok) {
            const err = await res.text();
            console.error("ElevenLabs Scribe token error:", err);
            return NextResponse.json({ error: "Failed to get token" }, { status: 502 });
        }

        const data = await res.json();
        return NextResponse.json({ token: data.signed_url ?? data.token });
    } catch (error) {
        console.error("Scribe token route error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
