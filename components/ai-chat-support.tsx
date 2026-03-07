"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { MessageSquare, X, Send, Sparkles, Loader2, Minus } from "lucide-react";
import { useSession } from "next-auth/react";
import { cn } from "@/lib/utils";

interface Message {
    role: "user" | "assistant";
    content: string;
}

export function AIChatSupport() {
    const { data: session } = useSession();
    const [isOpen, setIsOpen] = useState(false);
    const [isMinimized, setIsMinimized] = useState(false);
    const [messages, setMessages] = useState<Message[]>([
        { role: "assistant", content: "Hello! I'm your Council Assistant. How can I help you with your permit application today?" }
    ]);
    const [input, setInput] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

    // Only show to APPLICANTS (citizens) or guests
    const userRole = (session?.user as any)?.role;
    if (userRole === "OFFICER" || userRole === "ADMIN") return null;

    const handleSend = async () => {
        if (!input.trim() || isLoading) return;

        const userMessage: Message = { role: "user", content: input };
        setMessages(prev => [...prev, userMessage]);
        setInput("");
        setIsLoading(true);

        try {
            const chatHistory = messages.map(m => ({
                role: m.role,
                content: m.content
            }));
            chatHistory.push(userMessage);

            const res = await fetch("/api/ai/chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ messages: chatHistory }),
            });
            
            const data = await res.json();
            if (data.error) throw new Error(data.error);

            setMessages(prev => [...prev, { role: "assistant", content: data.response }]);
        } catch (err) {
            console.error("AI Chat failed:", err);
            setMessages(prev => [...prev, { role: "assistant", content: "Sorry, I'm having trouble connecting right now. Please try again later." }]);
        } finally {
            setIsLoading(false);
        }
    };

    if (!isOpen) {
        return (
            <div className="fixed bottom-6 right-6 z-50">
                <Button 
                    onClick={() => setIsOpen(true)} 
                    size="icon" 
                    className="h-14 w-14 rounded-full shadow-lg hover:scale-110 transition-transform bg-primary text-primary-foreground"
                >
                    <MessageSquare className="h-6 w-6" />
                </Button>
            </div>
        );
    }

    return (
        <div className={cn(
            "fixed bottom-6 right-6 z-50 w-80 sm:w-96 transition-all duration-300 ease-in-out",
            isMinimized ? "h-14" : "h-[500px]"
        )}>
            <Card className="h-full flex flex-col shadow-2xl border-primary/20 overflow-hidden">
                <CardHeader className="p-4 bg-primary text-primary-foreground flex flex-row items-center justify-between space-y-0">
                    <CardTitle className="text-sm font-bold flex items-center gap-2">
                        <Sparkles className="h-4 w-4" />
                        Council Assistant
                    </CardTitle>
                    <div className="flex items-center gap-1">
                        <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 text-primary-foreground hover:bg-primary-foreground/10"
                            onClick={() => setIsMinimized(!isMinimized)}
                        >
                            <Minus className="h-4 w-4" />
                        </Button>
                        <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 text-primary-foreground hover:bg-primary-foreground/10"
                            onClick={() => setIsOpen(false)}
                        >
                            <X className="h-4 w-4" />
                        </Button>
                    </div>
                </CardHeader>
                
                {!isMinimized && (
                    <>
                        <CardContent 
                            ref={scrollRef}
                            className="flex-1 overflow-y-auto p-4 space-y-4 bg-muted/30 scrollbar-thin"
                        >
                            {messages.map((m, i) => (
                                <div 
                                    key={i} 
                                    className={cn(
                                        "flex",
                                        m.role === "user" ? "justify-end" : "justify-start"
                                    )}
                                >
                                    <div className={cn(
                                        "max-w-[80%] p-3 rounded-lg text-sm",
                                        m.role === "user" 
                                            ? "bg-primary text-primary-foreground rounded-br-none" 
                                            : "bg-background border border-primary/10 rounded-bl-none shadow-sm"
                                    )}>
                                        {m.content}
                                    </div>
                                </div>
                            ))}
                            {isLoading && (
                                <div className="flex justify-start">
                                    <div className="bg-background border border-primary/10 p-3 rounded-lg rounded-bl-none shadow-sm">
                                        <Loader2 className="h-4 w-4 animate-spin text-primary" />
                                    </div>
                                </div>
                            )}
                        </CardContent>
                        <CardFooter className="p-4 bg-background border-t">
                            <form 
                                onSubmit={(e) => { e.preventDefault(); handleSend(); }}
                                className="flex w-full items-center gap-2"
                            >
                                <Input 
                                    placeholder="Ask a question..." 
                                    value={input}
                                    onChange={(e) => setInput(e.target.value)}
                                    disabled={isLoading}
                                    className="flex-1"
                                />
                                <Button 
                                    type="submit" 
                                    size="icon" 
                                    disabled={isLoading || !input.trim()}
                                >
                                    <Send className="h-4 w-4" />
                                </Button>
                            </form>
                        </CardFooter>
                    </>
                )}
            </Card>
        </div>
    );
}
