"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
    SpeechInput,
    SpeechInputRecordButton,
    SpeechInputPreview,
    SpeechInputCancelButton,
} from "@/components/ui/speech-input";
import { Button } from "@/components/ui/button";
import { Mic, MicOff } from "lucide-react";
import { cn } from "@/lib/utils";

interface VoiceInputProps {
    onTranscript: (transcript: string) => void;
    className?: string;
}

async function getScribeToken(): Promise<string> {
    const res = await fetch("/api/scribe-token");
    if (!res.ok) throw new Error("Scribe not configured");
    const data = await res.json();
    if (!data.token) throw new Error("No token");
    return data.token;
}

/** Scribe-powered voice input — requires ELEVENLABS_API_KEY in .env */
function ScribeVoiceInput({ onTranscript, className }: VoiceInputProps) {
    return (
        <SpeechInput
            getToken={getScribeToken}
            onChange={(e) => { if (e.transcript) onTranscript(e.transcript); }}
            className={className}
            size="sm"
        >
            <SpeechInputRecordButton />
            <SpeechInputPreview placeholder="Listening..." />
            <SpeechInputCancelButton />
        </SpeechInput>
    );
}

/** Web Speech API fallback — works in Chrome/Edge with no API key */
function WebSpeechVoiceInput({ onTranscript, className }: VoiceInputProps) {
    const [isListening, setIsListening] = useState(false);
    const recognitionRef = useRef<any>(null);

    useEffect(() => {
        const SR =
            (window as any).SpeechRecognition ||
            (window as any).webkitSpeechRecognition;
        if (!SR) return;
        const r = new SR();
        r.continuous = true;
        r.interimResults = true;
        r.lang = "en-US";
        r.onresult = (e: any) => {
            let text = "";
            for (let i = e.resultIndex; i < e.results.length; i++) {
                text += e.results[i][0].transcript;
            }
            if (e.results[e.results.length - 1].isFinal) onTranscript(text);
        };
        r.onerror = (e: any) => {
            setIsListening(false);
            if (e.error === "not-allowed") toast.error("Microphone access denied.");
        };
        r.onend = () => setIsListening(false);
        recognitionRef.current = r;
    }, [onTranscript]);

    const toggle = useCallback(() => {
        const r = recognitionRef.current;
        if (!r) { toast.error("Speech recognition not supported in this browser."); return; }
        if (isListening) { r.stop(); setIsListening(false); }
        else { try { r.start(); setIsListening(true); } catch { setIsListening(false); } }
    }, [isListening]);

    return (
        <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={toggle}
            className={cn(
                "h-8 gap-2 text-xs font-medium transition-all duration-300",
                isListening
                    ? "bg-red-50 border-red-200 text-red-600 hover:bg-red-100 animate-pulse"
                    : "hover:bg-primary/5",
                className
            )}
        >
            {isListening ? (
                <><MicOff className="h-3.5 w-3.5" /> Stop</>
            ) : (
                <><Mic className="h-3.5 w-3.5" /> Voice</>
            )}
        </Button>
    );
}

/**
 * VoiceInput — probes for ElevenLabs Scribe on mount; uses it when available,
 * otherwise falls back to the browser's Web Speech API.
 * Set ELEVENLABS_API_KEY in .env to enable Scribe.
 */
export function VoiceInput({ onTranscript, className }: VoiceInputProps) {
    const [scribeAvailable, setScribeAvailable] = useState(false);

    useEffect(() => {
        fetch("/api/scribe-token")
            .then((r) => { if (r.ok) setScribeAvailable(true); })
            .catch(() => {});
    }, []);

    if (scribeAvailable) {
        return <ScribeVoiceInput onTranscript={onTranscript} className={className} />;
    }
    return <WebSpeechVoiceInput onTranscript={onTranscript} className={className} />;
}
