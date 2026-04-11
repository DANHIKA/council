"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import {
    Conversation,
    ConversationContent,
    ConversationScrollButton,
} from "@/components/ui/conversation";
import { Message, MessageContent } from "@/components/ui/message";
import { ShimmeringText } from "@/components/ui/shimmering-text";
import { SentIcon, SparklesIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import {
    Mic,
    MicOff,
    Send,
    HelpCircle,
    FileText,
    Receipt,
    Workflow,
    X,
    Menu,
    ChevronDown,
} from "lucide-react";
import { useSession } from "@/hooks/useSession";
import { cn } from "@/lib/utils";
import { EnhancedMessageContent } from "@/components/chat/enhanced-message";
import { ActionCard, executeAction, type ProposedAction, type ActionState } from "@/components/chat/action-card";
import { SubSidebar, type ChatSession } from "@/components/chat/sub-sidebar";
import { toast } from "sonner";

type AIProvider = "groq" | "gemini" | "ollama";

const PROVIDERS: { value: AIProvider; label: string; model: string }[] = [
    { value: "groq", label: "Groq", model: "Llama 3.1 70B" },
    { value: "gemini", label: "Gemini", model: "Gemini 2.0 Flash" },
    { value: "ollama", label: "Ollama", model: "TinyLLaMA" },
];

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
    action?: ActionState;
}

interface SavedMessage {
    id: string;
    role: string;
    content: string;
    createdAt: string;
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

function getGreeting() {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
}

const SUGGESTIONS = [
    { icon: FileText, label: "Permits", prompt: "What permits are available?" },
    { icon: HelpCircle, label: "Requirements", prompt: "What do I need to apply?" },
    { icon: Receipt, label: "Fees", prompt: "What are the permit fees?" },
    { icon: Workflow, label: "Process", prompt: "How does the application process work?" },
];

export default function AIChatPage() {
    const { data: session } = useSession();

    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState("");
    const [chatStatus, setChatStatus] = useState<"idle" | "sending" | "thinking" | "responding">("idle");
    const [selectedProvider, setSelectedProvider] = useState<AIProvider>("groq");
    const [providerOpen, setProviderOpen] = useState(false);

    const [sessions, setSessions] = useState<ChatSession[]>([]);
    const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
    const [sessionTitleGenerated, setSessionTitleGenerated] = useState(false);
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [loadingSessions, setLoadingSessions] = useState(false);
    const [restoring, setRestoring] = useState(false);

    const mic = useMicInput(
        useCallback(
            (t: string) => setInput((prev) => (prev ? `${prev} ${t}` : t)),
            []
        )
    );

    const userRole = (session?.user as any)?.role;
    const userName = (session?.user as any)?.name || session?.user?.email?.split("@")[0] || "there";
    const isStaff = userRole === "OFFICER" || userRole === "ADMIN";
    const chatEndpoint = isStaff ? "/api/ai/staff-chat" : "/api/ai/chat";
    const chatPlaceholder = isStaff
        ? "Ask about applications, stats, workload..."
        : "Type your question...";

    useEffect(() => {
        if (session?.user?.id) {
            loadSessions();
        }
    }, [session?.user?.id]);

    const loadSessions = async () => {
        setLoadingSessions(true);
        try {
            const res = await fetch("/api/chat-sessions");
            if (res.ok) {
                const data = await res.json();
                setSessions(data);
            }
        } catch (e) {
            console.error("Failed to load sessions", e);
        }
        setLoadingSessions(false);
    };

    const startNewChat = async () => {
        setCurrentSessionId(null);
        setMessages([]);
        setSessionTitleGenerated(false);
        try {
            const res = await fetch("/api/chat-sessions", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ title: "New Chat", provider: selectedProvider }),
            });
            if (res.ok) {
                const data = await res.json();
                setCurrentSessionId(data.id);
                loadSessions();
            }
        } catch (e) {
            console.error("Failed to create session", e);
        }
        if (window.innerWidth < 768) setSidebarOpen(false);
    };

    const loadSession = async (id: string) => {
        setRestoring(true);
        try {
            const res = await fetch(`/api/chat-sessions?id=${id}`);
            if (res.ok) {
                const data = await res.json();
                setCurrentSessionId(data.id);
                setSelectedProvider(data.provider as AIProvider);
                setSessionTitleGenerated(true);
                const saved: ChatMessage[] = data.messages.map((m: SavedMessage) => ({
                    role: m.role as "user" | "assistant",
                    content: m.content,
                    status: "complete",
                }));
                setMessages(saved);
            }
        } catch (e) {
            console.error("Failed to load session", e);
            toast.error("Failed to load conversation");
        }
        setRestoring(false);
        if (window.innerWidth < 768) setSidebarOpen(false);
    };

    const deleteSession = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        try {
            const res = await fetch(`/api/chat-sessions?id=${id}`, { method: "DELETE" });
            if (res.ok) {
                if (currentSessionId === id) {
                    setCurrentSessionId(null);
                    setMessages([]);
                    setSessionTitleGenerated(false);
                }
                loadSessions();
                toast("Conversation deleted");
            }
        } catch {
            toast.error("Failed to delete");
        }
    };

    const generateTitle = async (firstMessage: string, sessionId: string) => {
        try {
            const res = await fetch(`/api/chat-messages?message=${encodeURIComponent(firstMessage.slice(0, 200))}`);
            if (res.ok) {
                const { title } = await res.json();
                if (title) {
                    await fetch(`/api/chat-sessions?id=${sessionId}`, {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ title }),
                    });
                    loadSessions();
                }
            }
        } catch (e) {
            console.error("Failed to generate title", e);
        }
    };

    const saveMessages = useCallback(async (newMessages: ChatMessage[], sessionId?: string | null) => {
        const sid = sessionId || currentSessionId;
        if (!sid || newMessages.length === 0) return;
        try {
            await fetch("/api/chat-messages", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    sessionId: sid,
                    messages: newMessages.map((m) => ({ role: m.role, content: m.content })),
                }),
            });
        } catch (e) {
            console.error("Failed to save messages", e);
        }
    }, [currentSessionId]);

    const handleSend = async (overrideInput?: string) => {
        const text = (overrideInput ?? input).trim();
        if (!text || chatStatus !== "idle") return;
        if (!overrideInput) setInput("");

        let activeSessionId = currentSessionId;
        if (!activeSessionId) {
            try {
                const res = await fetch("/api/chat-sessions", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ title: "New Chat", provider: selectedProvider }),
                });
                if (res.ok) {
                    const data = await res.json();
                    activeSessionId = data.id;
                    setCurrentSessionId(data.id);
                    loadSessions();
                }
            } catch (e) {
                console.error("Failed to create session", e);
            }
        }

        const userMsg: ChatMessage = { role: "user", content: text, status: "complete" };
        setMessages((prev) => [...prev, userMsg]);
        setChatStatus("sending");

        if (!sessionTitleGenerated && activeSessionId) {
            generateTitle(text, activeSessionId);
            setSessionTitleGenerated(true);
        }

        const history = messages
            .filter((m) => m.status === "complete")
            .map((m) => ({ role: m.role, content: m.content }));
        history.push({ role: "user", content: text });

        await new Promise((r) => setTimeout(r, 250));
        setChatStatus("thinking");
        setMessages((prev) => [...prev, { role: "assistant", content: "", status: "thinking" }]);

        try {
            const res = await fetch(chatEndpoint, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    messages: history,
                    provider: selectedProvider,
                    includeVisualization: true,
                    includeActions: true,
                }),
            });
            const data = await res.json();
            if (data.error) throw new Error(data.error);

            const toolCalls: ToolCall[] = [];
            if (data.visualization) {
                const { type, chart, table, stats } = data.visualization;
                if (type === "chart" && chart) toolCalls.push({ type: "chart", data: chart.data, config: chart });
                else if (type === "table" && table) toolCalls.push({ type: "table", data: table.data, config: table });
                else if (type === "stats" && stats) toolCalls.push({ type: "stats", data: stats, config: {} });
            }

            const action: ActionState | undefined = data.action
                ? { proposal: data.action as ProposedAction, status: "pending" }
                : undefined;

            const assistantMsg: ChatMessage = {
                role: "assistant",
                content: data.response,
                status: "complete",
                toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
                action,
            };

            setMessages((prev) => [...prev.filter((m) => m.status !== "thinking"), assistantMsg]);
            setChatStatus("idle");

            saveMessages([userMsg, assistantMsg], activeSessionId);
            loadSessions();
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

    const handleActionConfirm = async (messageIndex: number, notes?: string) => {
        const msg = messages[messageIndex];
        if (!msg?.action) return;
        setMessages((prev) =>
            prev.map((m, i) =>
                i === messageIndex ? { ...m, action: { ...m.action!, status: "loading" } } : m
            )
        );
        try {
            const result = await executeAction(msg.action.proposal, notes);
            setMessages((prev) =>
                prev.map((m, i) =>
                    i === messageIndex ? { ...m, action: { ...m.action!, status: "done", result } } : m
                )
            );
        } catch (err: any) {
            const errMsg = err?.message ?? "Something went wrong.";
            setMessages((prev) =>
                prev.map((m, i) =>
                    i === messageIndex ? { ...m, action: { ...m.action!, status: "error", result: errMsg } } : m
                )
            );
            toast.error("Action failed", { description: errMsg });
        }
    };

    const handleActionCancel = (messageIndex: number) => {
        setMessages((prev) =>
            prev.map((m, i) =>
                i === messageIndex && m.action ? { ...m, action: { ...m.action, status: "cancelled" } } : m
            )
        );
    };

    const currentProvider = PROVIDERS.find((p) => p.value === selectedProvider);
    const currentTitle = sessions.find((s) => s.id === currentSessionId)?.title;

    // ── Shared sidebar props ─────────────────────────────────────────────────────
    const sidebarProps = {
        sessions,
        loading: loadingSessions,
        currentId: currentSessionId,
        onSelect: loadSession,
        onDelete: deleteSession,
        onNew: startNewChat,
    };

    // ── Shared input bar ─────────────────────────────────────────────────────────
    function InputBar({ className }: { className?: string }) {
        return (
            <div className={cn("border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 p-3", className)}>
                <div className="max-w-3xl mx-auto">
                    <form onSubmit={(e) => { e.preventDefault(); handleSend(); }}>
                        <div className="flex items-center gap-2 rounded-xl border bg-background px-3 py-2">
                            {mic.supported && (
                                <button
                                    type="button"
                                    onClick={mic.toggle}
                                    className={cn(
                                        "shrink-0 p-1 rounded-md transition-colors",
                                        mic.isListening ? "text-red-500" : "text-muted-foreground hover:text-foreground"
                                    )}
                                >
                                    {mic.isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                                </button>
                            )}
                            <input
                                placeholder={chatPlaceholder}
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                disabled={chatStatus !== "idle"}
                                className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground disabled:opacity-50 min-w-0"
                                onKeyDown={(e) => {
                                    if (e.key === "Enter" && !e.shiftKey) {
                                        e.preventDefault();
                                        handleSend();
                                    }
                                }}
                            />
                            <div className="flex items-center gap-1 shrink-0">
                                <div className="relative">
                                    <button
                                        type="button"
                                        onClick={() => setProviderOpen(!providerOpen)}
                                        className="inline-flex items-center gap-1 px-2 py-1 text-xs text-muted-foreground hover:text-foreground rounded-md hover:bg-muted transition-colors"
                                    >
                                        {currentProvider?.label}
                                        <ChevronDown className="h-3 w-3" />
                                    </button>
                                    {providerOpen && (
                                        <div className="absolute bottom-full right-0 mb-1 w-44 bg-card border rounded-lg shadow-lg py-1 z-50">
                                            {PROVIDERS.map((p) => (
                                                <button
                                                    key={p.value}
                                                    type="button"
                                                    onClick={() => {
                                                        setSelectedProvider(p.value);
                                                        setProviderOpen(false);
                                                    }}
                                                    className={cn(
                                                        "w-full text-left px-3 py-1.5 text-xs hover:bg-muted transition-colors",
                                                        selectedProvider === p.value && "bg-muted font-medium"
                                                    )}
                                                >
                                                    {p.label}
                                                    <span className="block text-muted-foreground text-[10px]">{p.model}</span>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                <button
                                    type="submit"
                                    disabled={!input.trim() || chatStatus !== "idle"}
                                    className="h-7 w-7 flex items-center justify-center rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40 transition-colors"
                                >
                                    <Send className="h-3.5 w-3.5" />
                                </button>
                            </div>
                        </div>
                    </form>
                    <p className="text-[11px] text-muted-foreground text-center mt-1.5">
                        AI can make mistakes. Verify important information.
                    </p>
                </div>
            </div>
        );
    }

    // ── Empty / welcome state ────────────────────────────────────────────────────
    if (messages.length === 0 && !restoring) {
        return (
            <div className="flex h-full">
                {/* Mobile sidebar overlay */}
                {sidebarOpen && (
                    <div className="fixed inset-0 z-50 flex md:hidden">
                        <div className="fixed inset-0 bg-black/50" onClick={() => setSidebarOpen(false)} />
                        <div className="relative w-64 bg-card border-r flex flex-col">
                            <div className="flex items-center justify-between p-3 border-b">
                                <span className="text-sm font-semibold">Conversations</span>
                                <button onClick={() => setSidebarOpen(false)} className="text-muted-foreground hover:text-foreground">
                                    <X className="h-4 w-4" />
                                </button>
                            </div>
                            <div className="flex-1 overflow-y-auto">
                                <SubSidebar {...sidebarProps} />
                            </div>
                        </div>
                    </div>
                )}

                {/* Desktop sidebar */}
                <div className="hidden md:flex w-56 border-r flex-col bg-card/40">
                    <div className="px-3 py-3 border-b">
                        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Conversations</span>
                    </div>
                    <div className="flex-1 overflow-y-auto">
                        <SubSidebar {...sidebarProps} />
                    </div>
                </div>

                {/* Welcome area */}
                <div className="flex-1 flex flex-col overflow-hidden">
                    <div className="flex-1 flex flex-col items-center justify-center px-4">
                        <button
                            onClick={() => setSidebarOpen(!sidebarOpen)}
                            className="absolute top-4 left-4 md:hidden p-2 text-muted-foreground hover:text-foreground"
                        >
                            <Menu className="h-5 w-5" />
                        </button>

                        <div className="flex items-center gap-3 mb-6">
                            <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center">
                                <HugeiconsIcon icon={SparklesIcon} className="h-4 w-4 text-primary" />
                            </div>
                            <h1 className="text-3xl font-serif font-medium text-foreground">
                                {getGreeting()}, {userName}
                            </h1>
                        </div>

                        <div className="w-full max-w-2xl">
                            <InputBar />
                            <div className="flex flex-wrap items-center justify-center gap-2 mt-4">
                                {SUGGESTIONS.map((s) => (
                                    <button
                                        key={s.label}
                                        onClick={() => handleSend(s.prompt)}
                                        className="inline-flex items-center gap-2 px-4 py-2 rounded-full border text-sm text-muted-foreground hover:text-foreground hover:border-foreground/20 bg-background transition-colors"
                                    >
                                        <s.icon className="h-4 w-4" />
                                        {s.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // ── Chat view ────────────────────────────────────────────────────────────────
    return (
        <div className="flex h-full">
            {/* Mobile sidebar overlay */}
            {sidebarOpen && (
                <div className="fixed inset-0 z-50 flex md:hidden">
                    <div className="fixed inset-0 bg-black/50" onClick={() => setSidebarOpen(false)} />
                    <div className="relative w-64 bg-card border-r flex flex-col">
                        <div className="flex items-center justify-between p-3 border-b">
                            <span className="text-sm font-semibold">Conversations</span>
                            <button onClick={() => setSidebarOpen(false)} className="text-muted-foreground hover:text-foreground">
                                <X className="h-4 w-4" />
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto">
                            <SubSidebar {...sidebarProps} />
                        </div>
                    </div>
                </div>
            )}

            {/* Desktop sidebar */}
            <div className="hidden md:flex w-56 border-r flex-col bg-card/40">
                <div className="px-3 py-3 border-b">
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Conversations</span>
                </div>
                <div className="flex-1 overflow-y-auto">
                    <SubSidebar {...sidebarProps} />
                </div>
            </div>

            {/* Chat area */}
            <div className="flex-1 flex flex-col overflow-hidden">
                {/* Header */}
                <header className="border-b bg-background/95 backdrop-blur px-4 py-2.5 flex items-center gap-3 shrink-0">
                    <button
                        onClick={() => setSidebarOpen(!sidebarOpen)}
                        className="p-1.5 -ml-1.5 text-muted-foreground hover:text-foreground md:hidden"
                    >
                        <Menu className="h-5 w-5" />
                    </button>
                    <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <HugeiconsIcon icon={SparklesIcon} className="h-3 w-3 text-primary" />
                    </div>
                    <span className="text-sm font-semibold truncate">
                        {currentTitle || "AI Assistant"}
                    </span>
                </header>

                {/* Messages */}
                <Conversation className="flex-1">
                    <ConversationContent className="py-4 px-0">
                        <div className="max-w-3xl mx-auto px-4">
                            {messages.map((m, i) =>
                                m.status === "thinking" ? (
                                    <Message key={i} from="assistant" className="px-3 py-2">
                                        <MessageContent variant="flat" className="py-1.5">
                                            <ShimmeringText text="Thinking..." duration={1.5} startOnView={false} className="text-sm" />
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
                                            {m.action && (
                                                <ActionCard
                                                    action={m.action.proposal}
                                                    status={m.action.status}
                                                    result={m.action.result}
                                                    onConfirm={(notes) => handleActionConfirm(i, notes)}
                                                    onCancel={() => handleActionCancel(i)}
                                                />
                                            )}
                                        </MessageContent>
                                    </Message>
                                )
                            )}
                        </div>
                    </ConversationContent>
                    <ConversationScrollButton />
                </Conversation>

                {/* Input — sits naturally at the bottom of the flex column */}
                <InputBar className="shrink-0" />
            </div>
        </div>
    );
}
