 "use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
} from "@/components/ui/sheet";
import {
    Conversation,
    ConversationContent,
    ConversationScrollButton,
    ConversationEmptyState,
} from "@/components/ui/conversation";
import { Message, MessageContent } from "@/components/ui/message";
import { Response } from "@/components/ui/response";
import { ShimmeringText } from "@/components/ui/shimmering-text";
import {
    InputGroup,
    InputGroupInput,
    InputGroupButton,
    InputGroupAddon,
} from "@/components/ui/input-group";
import { BarVisualizer, type AgentState } from "@/components/ui/bar-visualizer";
import { HugeiconsIcon } from "@hugeicons/react";
import {
    Chat01Icon,
    SentIcon,
    SparklesIcon,
} from "@hugeicons/core-free-icons";
import { Mic, MicOff } from "lucide-react";
import { useSession } from "next-auth/react";
import { cn } from "@/lib/utils";

interface ChatMessage {
    role: "user" | "assistant";
    content: string;
    status: "complete" | "thinking";
}

function useMicInput(onTranscript: (t: string) => void) {
    const [isListening, setIsListening] = useState(false);
    const recognitionRef = useRef<any>(null);

    useEffect(() => {
        if (typeof window === "undefined") return;
        const SR =
            (window as any).SpeechRecognition ||
            (window as any).webkitSpeechRecognition;
        if (!SR) return;
        const r = new SR();
        r.continuous = false;
        r.interimResults = false;
        r.lang = "en-US";
        r.onresult = (e: any) => {
            const text = e.results[0]?.[0]?.transcript || "";
            if (text) onTranscript(text);
        };
        r.onerror = () => setIsListening(false);
        r.onend = () => setIsListening(false);
        recognitionRef.current = r;
    }, [onTranscript]);

    const toggle = useCallback(() => {
        const r = recognitionRef.current;
        if (!r) return;
        if (isListening) {
            r.stop();
            setIsListening(false);
        } else {
            try {
                r.start();
                setIsListening(true);
            } catch {
                setIsListening(false);
            }
        }
    }, [isListening]);

    const supported =
        typeof window !== "undefined" &&
        !!(
            (window as any).SpeechRecognition ||
            (window as any).webkitSpeechRecognition
        );

    return { isListening, toggle, supported };
}

export function AIChatSupport() {
    const { data: session } = useSession();

    // ── All hooks called unconditionally ─────────────────────────────────
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState("");
    const [chatStatus, setChatStatus] = useState<
        "idle" | "sending" | "thinking" | "responding"
    >("idle");

    const mic = useMicInput(
        useCallback(
            (t: string) => setInput((prev) => (prev ? `${prev} ${t}` : t)),
            []
        )
    );
    // ─────────────────────────────────────────────────────────────────────

    const userRole = (session?.user as any)?.role;
    const isStaff = userRole === "OFFICER" || userRole === "ADMIN";
    const chatEndpoint = isStaff ? "/api/ai/staff-chat" : "/api/ai/chat";
    const chatTitle = isStaff ? "Staff Assistant" : "Council Assistant";
    const chatDescription = isStaff
        ? "Ask me about applications, stats, workload, or anything in the queue."
        : "Ask me anything about your permit application.";
    const chatPlaceholder = isStaff ? "e.g. How many pending sign-offs?" : "Ask a question...";

    const agentState: AgentState =
        chatStatus === "thinking"
            ? "thinking"
            : chatStatus === "responding"
            ? "speaking"
            : chatStatus === "sending"
            ? "connecting"
            : "listening";

    const handleSend = async () => {
        if (!input.trim() || chatStatus !== "idle") return;

        const text = input.trim();
        setInput("");
        setMessages((prev) => [
            ...prev,
            { role: "user", content: text, status: "complete" },
        ]);
        setChatStatus("sending");

        const history = messages
            .filter((m) => m.status === "complete")
            .map((m) => ({ role: m.role, content: m.content }));
        history.push({ role: "user", content: text });

        await new Promise((r) => setTimeout(r, 250));
        setChatStatus("thinking");
        setMessages((prev) => [
            ...prev,
            { role: "assistant", content: "", status: "thinking" },
        ]);

        try {
            const res = await fetch(chatEndpoint, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ messages: history }),
            });
            const data = await res.json();
            if (data.error) throw new Error(data.error);

            setMessages((prev) => [
                ...prev.filter((m) => m.status !== "thinking"),
                { role: "assistant", content: data.response, status: "complete" },
            ]);
            setChatStatus("idle");
        } catch {
            setMessages((prev) => [
                ...prev.filter((m) => m.status !== "thinking"),
                {
                    role: "assistant",
                    content:
                        "Sorry, I'm having trouble connecting right now. Please try again.",
                    status: "complete",
                },
            ]);
            setChatStatus("idle");
        }
    };

    return (
        <>
            {/* Floating button to trigger drawer */}
            <div className="fixed bottom-6 right-6 z-50">
                <Sheet open={isOpen} onOpenChange={setIsOpen}>
                    <Button
                        size="icon"
                        className="h-14 w-14 rounded-full shadow-xl hover:scale-110 transition-transform bg-primary text-primary-foreground"
                        onClick={() => setIsOpen(true)}
                    >
                        <HugeiconsIcon icon={Chat01Icon} className="h-6 w-6" />
                    </Button>
                    <SheetContent side="right" className="w-full sm:w-[400px] p-0 flex flex-col">
                        <SheetHeader className="p-4 bg-primary text-primary-foreground flex flex-row items-center justify-between space-y-0 shrink-0">
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                                <HugeiconsIcon icon={SparklesIcon} className="h-5 w-5 shrink-0" />
                                <SheetTitle className="text-sm font-bold text-primary-foreground m-0">
                                    {chatTitle}
                                </SheetTitle>
                                {chatStatus !== "idle" && (
                                    <BarVisualizer
                                        state={agentState}
                                        demo
                                        barCount={7}
                                        minHeight={20}
                                        maxHeight={80}
                                        centerAlign
                                        className="!h-5 !w-10 !bg-transparent !p-0 !rounded-none shrink-0"
                                    />
                                )}
                            </div>
                        </SheetHeader>

                        {/* Messages */}
                        <Conversation className="bg-muted/20 flex-1 overflow-hidden">
                            <ConversationContent className="py-2 px-0">
                                {messages.length === 0 ? (
                                    <ConversationEmptyState
                                        icon={
                                            <HugeiconsIcon
                                                icon={SparklesIcon}
                                                className="h-10 w-10 opacity-20"
                                            />
                                        }
                                        title={chatTitle}
                                        description={chatDescription}
                                    />
                                ) : (
                                    messages.map((m, i) =>
                                        m.status === "thinking" ? (
                                            <Message key={i} from="assistant" className="px-3 py-1">
                                                <MessageContent variant="flat" className="py-1.5">
                                                    <ShimmeringText
                                                        text="Thinking..."
                                                        duration={1.5}
                                                        startOnView={false}
                                                        className="text-sm"
                                                    />
                                                </MessageContent>
                                            </Message>
                                        ) : (
                                            <Message key={i} from={m.role} className="px-3 py-1">
                                                <MessageContent
                                                    variant={
                                                        m.role === "assistant" ? "flat" : "contained"
                                                    }
                                                    className={
                                                        m.role === "assistant"
                                                            ? "text-sm prose prose-sm dark:prose-invert max-w-none"
                                                            : "text-sm"
                                                    }
                                                >
                                                    {m.role === "assistant" ? (
                                                        <Response>{m.content}</Response>
                                                    ) : (
                                                        m.content
                                                    )}
                                                </MessageContent>
                                            </Message>
                                        )
                                    )
                                )}
                            </ConversationContent>
                            <ConversationScrollButton />
                        </Conversation>

                        {/* Input */}
                        <div className="p-3 bg-background border-t shrink-0">
                            <form
                                onSubmit={(e) => {
                                    e.preventDefault();
                                    handleSend();
                                }}
                            >
                                <InputGroup>
                                    {mic.supported && (
                                        <InputGroupAddon align="inline-start">
                                            <InputGroupButton
                                                size="icon-sm"
                                                onClick={mic.toggle}
                                                type="button"
                                                className={cn(
                                                    "transition-colors",
                                                    mic.isListening
                                                        ? "text-red-500 hover:text-red-600"
                                                        : "text-muted-foreground hover:text-foreground"
                                                )}
                                                title={
                                                    mic.isListening ? "Stop listening" : "Voice input"
                                                }
                                            >
                                                {mic.isListening ? (
                                                    <MicOff className="h-3.5 w-3.5" />
                                                ) : (
                                                    <Mic className="h-3.5 w-3.5" />
                                                )}
                                            </InputGroupButton>
                                        </InputGroupAddon>
                                    )}
                                    <InputGroupInput
                                        placeholder={
                                            mic.isListening ? "Listening..." : chatPlaceholder
                                        }
                                        value={input}
                                        onChange={(e) => setInput(e.target.value)}
                                        disabled={chatStatus !== "idle"}
                                        onKeyDown={(e) => {
                                            if (e.key === "Enter" && !e.shiftKey) {
                                                e.preventDefault();
                                                handleSend();
                                            }
                                        }}
                                    />
                                    <InputGroupAddon align="inline-end">
                                        <InputGroupButton
                                            type="submit"
                                            size="icon-sm"
                                            disabled={chatStatus !== "idle" || !input.trim()}
                                            className="bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40"
                                        >
                                            <HugeiconsIcon
                                                icon={SentIcon}
                                                className="h-3.5 w-3.5"
                                            />
                                        </InputGroupButton>
                                    </InputGroupAddon>
                                </InputGroup>
                            </form>
                        </div>
                    </SheetContent>
                </Sheet>
            </div>
        </>
    );
}
