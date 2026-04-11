"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
    Conversation,
    ConversationContent,
    ConversationScrollButton,
} from "@/components/ui/conversation";
import { Message, MessageContent } from "@/components/ui/message";
import { ShimmeringText } from "@/components/ui/shimmering-text";
import {
    InputGroup,
    InputGroupInput,
    InputGroupButton,
    InputGroupAddon,
} from "@/components/ui/input-group";
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
    Plus,
    Sidebar as SidebarIcon,
    X,
    Trash2,
    ChevronDown,
    Menu,
} from "lucide-react";
import { useSession } from "@/hooks/useSession";
import { cn } from "@/lib/utils";
import { EnhancedMessageContent } from "@/components/chat/enhanced-message";
import { ActionCard, executeAction, type ProposedAction, type ActionState } from "@/components/chat/action-card";
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

interface SavedSession {
    id: string;
    title: string;
    summary?: string | null;
    provider: string;
    messageCount: number;
    createdAt: string;
    updatedAt: string;
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

    // Session management
    const [sessions, setSessions] = useState<SavedSession[]>([]);
    const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
    const [sessionTitleGenerated, setSessionTitleGenerated] = useState(false);
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [loadingSessions, setLoadingSessions] = useState(false);

    // Restore state
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

    // Load sessions on mount
    useEffect(() => {
        loadSessions();
    }, []);

    // Load sessions
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

    // Start a new chat
    const startNewChat = async () => {
        setCurrentSessionId(null);
        setMessages([]);
        setSessionTitleGenerated(false);

        // Create a placeholder session (title will be updated after first message)
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

    // Load a saved session
    const loadSession = async (id: string) => {
        setRestoring(true);
        try {
            const res = await fetch(`/api/chat-sessions?id=${id}`);
            if (res.ok) {
                const data = await res.json();
                setCurrentSessionId(data.id);
                setSelectedProvider(data.provider as AIProvider);
                setSessionTitleGenerated(true);

                // Convert saved messages to ChatMessage format
                const saved: ChatMessage[] = data.messages.map((m: SavedMessage) => ({
                    role: m.role as "user" | "assistant",
                    content: m.content,
                    status: "complete",
                }));
                setMessages(saved);

                // Build summary context for AI if available
                if (data.summary) {
                    console.log("Restored session summary:", data.summary);
                }
            }
        } catch (e) {
            console.error("Failed to load session", e);
            toast.error("Failed to load conversation");
        }
        setRestoring(false);
        if (window.innerWidth < 768) setSidebarOpen(false);
    };

    // Delete a session
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
        } catch (err) {
            toast.error("Failed to delete");
        }
    };

    // Generate title from first message
    const generateTitle = async (firstMessage: string) => {
        try {
            const res = await fetch(`/api/chat-messages?message=${encodeURIComponent(firstMessage.slice(0, 200))}`);
            if (res.ok) {
                const { title } = await res.json();
                if (title && currentSessionId) {
                    await fetch(`/api/chat-sessions?id=${currentSessionId}`, {
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

    // Compact conversation if too long
    const compactConversation = useCallback(async () => {
        if (!currentSessionId || messages.length < 20) return;
        try {
            const res = await fetch("/api/chat-messages", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ sessionId: currentSessionId }),
            });
            if (!res.ok) {
                toast.error("Failed to compress conversation history");
            }
        } catch (e) {
            console.error("Compaction failed", e);
            toast.error("Failed to compress conversation history");
        }
    }, [currentSessionId, messages.length]);

    // Save messages
    const saveMessages = useCallback(async (newMessages: ChatMessage[]) => {
        if (!currentSessionId || newMessages.length === 0) return;
        try {
            await fetch("/api/chat-messages", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    sessionId: currentSessionId,
                    messages: newMessages.map((m) => ({ role: m.role, content: m.content })),
                }),
            });
        } catch (e) {
            console.error("Failed to save messages", e);
        }
    }, [currentSessionId]);

    // Send message
    const handleSend = async () => {
        if (!input.trim() || chatStatus !== "idle") return;

        const text = input.trim();
        setInput("");

        // If no session, create one
        if (!currentSessionId) {
            await startNewChat();
            // Wait a tick for the session to be created
            await new Promise((r) => setTimeout(r, 100));
        }

        const userMsg: ChatMessage = { role: "user", content: text, status: "complete" };
        setMessages((prev) => [...prev, userMsg]);
        setChatStatus("sending");

        // Generate title from first message
        if (!sessionTitleGenerated && currentSessionId) {
            generateTitle(text);
            setSessionTitleGenerated(true);
        }

        // Build history for AI (include summary for context)
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

            const allNew = [userMsg, assistantMsg];
            setMessages((prev) => [...prev.filter((m) => m.status !== "thinking"), assistantMsg]);
            setChatStatus("idle");

            // Save to DB
            saveMessages(allNew);

            // Compact if conversation is getting long
            const totalMessages = messages.length + 2;
            if (totalMessages >= 20 && totalMessages % 10 === 0) {
                compactConversation();
            }
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

    const handleSuggestion = (prompt: string) => {
        setInput(prompt);
        setTimeout(() => handleSend(), 100);
    };

    // Action handlers
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
            // Save the result state
            saveMessages([messages[messageIndex]]);
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

    // ── Empty state ──────────────────────────────────────────────────────────

    if (messages.length === 0 && !restoring) {
        return (
            <div className="flex min-h-screen bg-[#faf9f6] dark:bg-background">
                {/* Sidebar */}
                {sidebarOpen && (
                    <div className="fixed inset-0 z-50 flex md:hidden">
                        <div className="fixed inset-0 bg-black/50" onClick={() => setSidebarOpen(false)} />
                        <div className="relative w-72 bg-card border-r flex flex-col">
                            <div className="flex items-center justify-between p-4 border-b">
                                <h2 className="text-sm font-semibold">Conversations</h2>
                                <button onClick={() => setSidebarOpen(false)} className="text-muted-foreground hover:text-foreground">
                                    <X className="h-4 w-4" />
                                </button>
                            </div>
                            <div className="flex-1 overflow-y-auto">
                                <SidebarContent sessions={sessions} loading={loadingSessions} currentId={currentSessionId} onSelect={loadSession} onDelete={deleteSession} onNew={startNewChat} />
                            </div>
                        </div>
                    </div>
                )}

                {/* Desktop sidebar */}
                <div className="hidden md:flex w-64 bg-card border-r flex-col">
                    <div className="flex items-center justify-between p-4 border-b">
                        <h2 className="text-sm font-semibold">Conversations</h2>
                    </div>
                    <div className="flex-1 overflow-y-auto">
                        <SidebarContent sessions={sessions} loading={loadingSessions} currentId={currentSessionId} onSelect={loadSession} onDelete={deleteSession} onNew={startNewChat} />
                    </div>
                </div>

                {/* Main content */}
                <div className="flex-1 flex flex-col">
                    <div className="flex-1 flex flex-col items-center justify-center px-4">
                        <button
                            onClick={() => setSidebarOpen(!sidebarOpen)}
                            className="absolute top-4 left-4 md:hidden p-2 text-muted-foreground hover:text-foreground"
                        >
                            <Menu className="h-5 w-5" />
                        </button>

                        <div className="flex items-center gap-3 mb-8">
                            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                                <HugeiconsIcon icon={SparklesIcon} className="h-4 w-4 text-primary" />
                            </div>
                            <h1 className="text-3xl md:text-4xl font-serif font-medium text-foreground">
                                {getGreeting()}, {userName}
                            </h1>
                        </div>

                        <div className="w-full max-w-2xl">
                            <div className="bg-white dark:bg-card rounded-2xl shadow-lg border p-4">
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
                                                        mic.isListening ? "text-red-500" : "text-muted-foreground"
                                                    )}
                                                >
                                                    {mic.isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                                                </InputGroupButton>
                                            </InputGroupAddon>
                                        )}
                                        <InputGroupInput
                                            placeholder={chatPlaceholder}
                                            value={input}
                                            onChange={(e) => setInput(e.target.value)}
                                            disabled={chatStatus !== "idle"}
                                            className="border-0 shadow-none text-base"
                                            onKeyDown={(e) => {
                                                if (e.key === "Enter" && !e.shiftKey) {
                                                    e.preventDefault();
                                                    handleSend();
                                                }
                                            }}
                                        />
                                        <InputGroupAddon align="inline-end">
                                            <div className="flex items-center gap-1">
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
                                                <InputGroupButton
                                                    type="submit"
                                                    size="icon-sm"
                                                    disabled={!input.trim()}
                                                    className="bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40"
                                                >
                                                    <Send className="h-4 w-4" />
                                                </InputGroupButton>
                                            </div>
                                        </InputGroupAddon>
                                    </InputGroup>
                                </form>
                            </div>

                            <div className="flex flex-wrap items-center justify-center gap-2 mt-6">
                                {SUGGESTIONS.map((s) => (
                                    <button
                                        key={s.label}
                                        onClick={() => handleSuggestion(s.prompt)}
                                        className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white dark:bg-card border text-sm text-muted-foreground hover:text-foreground hover:border-foreground/20 transition-colors"
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

    // ── Chat view ────────────────────────────────────────────────────────────

    return (
        <div className="flex min-h-screen bg-[#faf9f6] dark:bg-background">
            {/* Sidebar */}
            {sidebarOpen && (
                <div className="fixed inset-0 z-50 flex md:hidden">
                    <div className="fixed inset-0 bg-black/50" onClick={() => setSidebarOpen(false)} />
                    <div className="relative w-72 bg-card border-r flex flex-col">
                        <div className="flex items-center justify-between p-4 border-b">
                            <h2 className="text-sm font-semibold">Conversations</h2>
                            <button onClick={() => setSidebarOpen(false)} className="text-muted-foreground hover:text-foreground">
                                <X className="h-4 w-4" />
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto">
                            <SidebarContent sessions={sessions} loading={loadingSessions} currentId={currentSessionId} onSelect={loadSession} onDelete={deleteSession} onNew={startNewChat} />
                        </div>
                    </div>
                </div>
            )}

            {/* Desktop sidebar */}
            <div className="hidden md:flex w-64 bg-card border-r flex-col">
                <div className="flex items-center justify-between p-4 border-b">
                    <h2 className="text-sm font-semibold">Conversations</h2>
                </div>
                <div className="flex-1 overflow-y-auto">
                    <SidebarContent sessions={sessions} loading={loadingSessions} currentId={currentSessionId} onSelect={loadSession} onDelete={deleteSession} onNew={startNewChat} />
                </div>
            </div>

            <div className="flex-1 flex flex-col">
                {/* Header */}
                <header className="border-b bg-white/80 dark:bg-card/80 backdrop-blur">
                    <div className="flex items-center gap-3 px-4 py-3">
                        <button
                            onClick={() => setSidebarOpen(!sidebarOpen)}
                            className="p-2 -ml-2 text-muted-foreground hover:text-foreground md:hidden"
                        >
                            <Menu className="h-5 w-5" />
                        </button>
                        <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center">
                            <HugeiconsIcon icon={SparklesIcon} className="h-3.5 w-3.5 text-primary" />
                        </div>
                        <div className="min-w-0">
                            <h1 className="text-sm font-semibold leading-tight">
                                {sessions.find((s) => s.id === currentSessionId)?.title || "AI Assistant"}
                            </h1>
                        </div>
                    </div>
                </header>

                {/* Messages */}
                <Conversation className="flex-1 overflow-hidden bg-transparent">
                    <ConversationContent className="py-4 px-0">
                        <div className="container max-w-3xl mx-auto px-4">
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

                {/* Input */}
                <div className="border-t bg-white/80 dark:bg-card/80 backdrop-blur p-4">
                    <div className="container max-w-3xl mx-auto">
                        <form
                            onSubmit={(e) => {
                                e.preventDefault();
                                handleSend();
                            }}
                        >
                            <div className="bg-white dark:bg-card rounded-2xl shadow-lg border p-3">
                                <InputGroup>
                                    {mic.supported && (
                                        <InputGroupAddon align="inline-start">
                                            <InputGroupButton
                                                size="icon-sm"
                                                onClick={mic.toggle}
                                                type="button"
                                                className={cn(mic.isListening ? "text-red-500" : "text-muted-foreground")}
                                            >
                                                {mic.isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                                            </InputGroupButton>
                                        </InputGroupAddon>
                                    )}
                                    <InputGroupInput
                                        placeholder={chatPlaceholder}
                                        value={input}
                                        onChange={(e) => setInput(e.target.value)}
                                        disabled={chatStatus !== "idle"}
                                        className="border-0 shadow-none"
                                        onKeyDown={(e) => {
                                            if (e.key === "Enter" && !e.shiftKey) {
                                                e.preventDefault();
                                                handleSend();
                                            }
                                        }}
                                    />
                                    <InputGroupAddon align="inline-end">
                                        <div className="flex items-center gap-1">
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
                                            <InputGroupButton
                                                type="submit"
                                                size="icon-sm"
                                                disabled={!input.trim()}
                                                className="bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40"
                                            >
                                                <Send className="h-4 w-4" />
                                            </InputGroupButton>
                                        </div>
                                    </InputGroupAddon>
                                </InputGroup>
                            </div>
                        </form>
                        <p className="text-xs text-muted-foreground text-center mt-2">
                            AI can make mistakes. Verify important information.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ── Sidebar component ────────────────────────────────────────────────────────

function SidebarContent({
    sessions,
    loading,
    currentId,
    onSelect,
    onDelete,
    onNew,
}: {
    sessions: SavedSession[];
    loading: boolean;
    currentId: string | null;
    onSelect: (id: string) => void;
    onDelete: (id: string, e: React.MouseEvent) => void;
    onNew: () => void;
}) {
    return (
        <div className="flex flex-col h-full">
            <div className="p-2">
                <button
                    onClick={onNew}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                >
                    <Plus className="h-4 w-4" />
                    New Chat
                </button>
            </div>

            <div className="flex-1 overflow-y-auto px-2 pb-2">
                {loading ? (
                    <div className="flex items-center justify-center py-8 text-xs text-muted-foreground">
                        Loading...
                    </div>
                ) : sessions.length === 0 ? (
                    <div className="flex items-center justify-center py-8 text-xs text-muted-foreground">
                        No conversations yet
                    </div>
                ) : (
                    <div className="space-y-0.5">
                        {sessions.map((s) => (
                            <div
                                key={s.id}
                                onClick={() => onSelect(s.id)}
                                className={cn(
                                    "group flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer text-sm transition-colors",
                                    currentId === s.id
                                        ? "bg-primary/10 text-primary font-medium"
                                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                                )}
                            >
                                <FileText className="h-3.5 w-3.5 shrink-0" />
                                <span className="flex-1 truncate">{s.title}</span>
                                <button
                                    onClick={(e) => onDelete(s.id, e)}
                                    className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-muted-foreground/20 transition-all"
                                >
                                    <Trash2 className="h-3 w-3" />
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
