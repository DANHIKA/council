"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Mic, MicOff, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface VoiceInputProps {
    onTranscript: (transcript: string) => void;
    className?: string;
}

export function VoiceInput({ onTranscript, className }: VoiceInputProps) {
    const [isListening, setIsListening] = useState(false);
    const [recognition, setRecognition] = useState<any>(null);

    useEffect(() => {
        // Initialize Web Speech API
        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        
        if (SpeechRecognition) {
            const recognitionInstance = new SpeechRecognition();
            recognitionInstance.continuous = true;
            recognitionInstance.interimResults = true;
            recognitionInstance.lang = "en-US";

            recognitionInstance.onresult = (event: any) => {
                let currentTranscript = "";
                for (let i = event.resultIndex; i < event.results.length; i++) {
                    currentTranscript += event.results[i][0].transcript;
                }
                if (event.results[event.results.length - 1].isFinal) {
                    onTranscript(currentTranscript);
                }
            };

            recognitionInstance.onerror = (event: any) => {
                console.error("Speech recognition error:", event.error);
                setIsListening(false);
                if (event.error === "not-allowed") {
                    toast.error("Microphone access denied. Please enable it in your browser settings.");
                } else {
                    toast.error("Speech recognition error. Please try again.");
                }
            };

            recognitionInstance.onend = () => {
                setIsListening(false);
            };

            setRecognition(recognitionInstance);
        }
    }, [onTranscript]);

    const toggleListening = useCallback(() => {
        if (!recognition) {
            toast.error("Speech recognition is not supported in this browser.");
            return;
        }

        if (isListening) {
            recognition.stop();
            setIsListening(false);
        } else {
            try {
                recognition.start();
                setIsListening(true);
                toast.success("Listening... Speak now.");
            } catch (err) {
                console.error("Failed to start recognition:", err);
                recognition.stop();
                setIsListening(false);
            }
        }
    }, [isListening, recognition]);

    if (!(window as any).SpeechRecognition && !(window as any).webkitSpeechRecognition) {
        return null;
    }

    return (
        <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={toggleListening}
            className={cn(
                "h-8 gap-2 text-xs font-medium transition-all duration-300",
                isListening 
                    ? "bg-red-50 border-red-200 text-red-600 hover:bg-red-100 hover:text-red-700 animate-pulse" 
                    : "hover:bg-primary/5",
                className
            )}
        >
            {isListening ? (
                <>
                    <MicOff className="h-3.5 w-3.5" />
                    Stop Listening
                </>
            ) : (
                <>
                    <Mic className="h-3.5 w-3.5" />
                    Voice Input
                </>
            )}
        </Button>
    );
}
