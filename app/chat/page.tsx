"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
    Conversation,
    ConversationContent,
    ConversationScrollButton,
    ConversationEmptyState,
} from "@/components/ui/conversation";
import { Message, MessageContent } from "@/components/ui/message";
import { ShimmeringText } from "@/components/ui/shimmering-text";
import {
    InputGroup,
    InputGroupInput,
    InputGroupButton,
    InputGroupAddon,
} from "@/components/ui/input-group";
import { BarVisualizer, type AgentState } from "@/components/ui/bar-visualizer";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { SentIcon, SparklesIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Mic, MicOff, Cpu, Trash2 } from "lucide-react";
import { useSession } from "@/hooks/useSession";
import { cn } from "@/lib/utils";
import { EnhancedMessageContent } from "@/components/chat/enhanced-message";
import { toast } from "sonner";

type AIProvider = "groq" | "gemini" | "ollama";

const PROVIDER_INFO: Record<AIProvider, { label: string; model: string; desc: string }> = {
    groq: { label: "Groq", model: "Llama 3.1 70B", desc: "Fast & reliable" },
    gemini: { label: "Gemini", model: "Gemini 2.0 Flash", desc: "Smart & versatile" },
    ollama: { label: "Ollama", model: "TinyLLaMA", desc: "Local & private" },
};

interface ToolCall {
    type: "chart" | "table" | "stats";
    data: any;
    config: any;
}

interface ChatMessage {
    role: "user" | "assistant";
    content: string;
    status: "complete" | "thinking";
    toolCalls?: ToolCall[];
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

export default function AIChatPage() {
    const { data: session } = useSession();

    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState("");
    const [chatStatus, setChatStatus] = useState<
        "idle" | "sending" | "thinking" | "responding"
    >("idle");
    const [selectedProvider, setSelectedProvider] = useState<AIProvider>("groq");

    const mic = useMicInput(
        useCallback(
            (t: string) => setInput((prev) => (prev ? `${prev} ${t}` : t)),
            []
        )
    );

    const userRole = (session?.user as any)?.role;
    const isStaff = userRole === "OFFICER" || userRole === "ADMIN";
    const chatEndpoint = isStaff ? "/api/ai/staff-chat" : "/api/ai/chat";
    const chatTitle = "Council AI Assistant";
    const chatDescription = isStaff
        ? "Ask about applications, stats, workload, or anything in the queue."
        : "Ask about permits, requirements, or your application status.";
    const chatPlaceholder = isStaff
        ? "e.g. Show me pending applications as a table"
        : "e.g. What permits do I need to build a fence?";

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
                body: JSON.stringify({
                    messages: history,
                    provider: selectedProvider,
                    includeVisualization: true,
                }),
            });
            const data = await res.json();
            if (data.error) throw new Error(data.error);

            const toolCalls: ToolCall[] = [];

            if (data.visualization) {
                const { type, chart, table, stats } = data.visualization;
                if (type === "chart" && chart) {
                    toolCalls.push({ type: "chart", data: chart.data, config: chart });
                } else if (type === "table" && table) {
                    toolCalls.push({ type: "table", data: table.data, config: table });
                } else if (type === "stats" && stats) {
                    toolCalls.push({ type: "stats", data: stats, config: {} });
                }
            }

            setMessages((prev) => [
                ...prev.filter((m) => m.status !== "thinking"),
                {
                    role: "assistant",
                    content: data.response,
                    status: "complete",
                    toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
                },
            ]);
            setChatStatus("idle");
        } catch {
            setMessages((prev) => [
                ...prev.filter((m) => m.status !== "thinking"),
                {
                    role: "assistant",
                    content: "Sorry, I'm having trouble connecting right now. Please try again.",
                    status: "complete",
                },
            ]);
            setChatStatus("idle");
        }
    };

    const handleClearChat = () => {
        setMessages([]);
        toast("Chat cleared");
    };

    return (
        <div className="flex flex-col h-screen bg-background">
            {/* Header */}
            <header className="border-b bg-card">
                <div className="flex items-center justify-between px-4 py-3">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                        <HugeiconsIcon icon={SparklesIcon} className="h-5 w-5 text-primary shrink-0" />
                        <div className="min-w-0">
                            <h1 className="text-sm font-semibold leading-tight">{chatTitle}</h1>
                            <p className="text-xs text-muted-foreground truncate">{chatDescription}</p>
                        </div>
                        {chatStatus !== "idle" && (
                            <BarVisualizer
                                state={agentState}
                                demo
                                barCount={7}
                                minHeight={20}
                                maxHeight={80}
                                centerAlign
                                className="!h-6 !w-12 !bg-transparent !p-0 !rounded-none"
                            />
                        )}
                    </div>

                    <div className="flex items-center gap-1">
                        {/* Provider Selector */}
                        <Popover>
                            <PopoverTrigger>
                                <Button variant="ghost" size="sm" className="h-8 gap-1.5">
                                    <Cpu className="h-4 w-4" />
                                    <span className="text-xs font-medium hidden sm:inline">
                                        {PROVIDER_INFO[selectedProvider].label}
                                    </span>
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-52 p-2" align="end">
                                <p className="text-xs font-medium mb-2 px-1 text-muted-foreground">AI Provider</p>
                                <Select
                                    value={selectedProvider}
                                    onValueChange={(v) => setSelectedProvider(v as AIProvider)}
                                >
                                    <SelectTrigger className="h-8 text-xs">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {Object.entries(PROVIDER_INFO).map(([key, info]) => (
                                            <SelectItem key={key} value={key} className="text-xs">
                                                <span className="font-medium">{info.label}</span>
                                                <span className="text-muted-foreground ml-1 text-[10px]">
                                                    {info.model}
                                                </span>
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </PopoverContent>
                        </Popover>

                        {/* Clear */}
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleClearChat}
                            className="h-8 gap-1.5 text-muted-foreground hover:text-destructive"
                            disabled={messages.length === 0}
                        >
                            <Trash2 className="h-4 w-4" />
                            <span className="text-xs hidden sm:inline">Clear</span>
                        </Button>
                    </div>
                </div>
            </header>

            {/* Messages */}
            <Conversation className="bg-muted/20 flex-1 overflow-hidden">
                <ConversationContent className="py-4 px-0">
                    {messages.length === 0 ? (
                        <div className="container max-w-3xl mx-auto px-4">
                            <ConversationEmptyState
                                icon={
                                    <HugeiconsIcon
                                        icon={SparklesIcon}
                                        className="h-16 w-16 opacity-20"
                                    />
                                }
                                title={chatTitle}
                                description={chatDescription}
                            />
                        </div>
                    ) : (
                        <div className="container max-w-4xl mx-auto px-4">
                            {messages.map((m, i) =>
                                m.status === "thinking" ? (
                                    <Message key={i} from="assistant" className="px-3 py-2">
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
                                    <Message key={i} from={m.role} className="px-3 py-2">
                                        <MessageContent
                                            variant={m.role === "assistant" ? "flat" : "contained"}
                                            className={
                                                m.role === "assistant"
                                                    ? "text-sm prose prose-sm dark:prose-invert max-w-none"
                                                    : "text-sm"
                                            }
                                        >
                                            <EnhancedMessageContent message={m} />
                                        </MessageContent>
                                    </Message>
                                )
                            )}
                        </div>
                    )}
                </ConversationContent>
                <ConversationScrollButton />
            </Conversation>

            {/* Input */}
            <div className="border-t bg-background p-4">
                <div className="container max-w-4xl mx-auto">
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
                                        title={mic.isListening ? "Stop listening" : "Voice input"}
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
                                placeholder={mic.isListening ? "Listening..." : chatPlaceholder}
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
                                    <HugeiconsIcon icon={SentIcon} className="h-3.5 w-3.5" />
                                </InputGroupButton>
                            </InputGroupAddon>
                        </InputGroup>
                    </form>
                    <p className="text-xs text-muted-foreground text-center mt-2">
                        AI can make mistakes. Verify important information.
                    </p>
                </div>
            </div>
        </div>
    );
}
