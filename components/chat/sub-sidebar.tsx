"use client";

import { Plus, FileText, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ChatSession {
    id: string;
    title: string;
    provider: string;
    messageCount: number;
    createdAt: string;
    updatedAt: string;
}

interface SubSidebarProps {
    sessions: ChatSession[];
    loading: boolean;
    currentId: string | null;
    onSelect: (id: string) => void;
    onDelete: (id: string, e: React.MouseEvent) => void;
    onNew: () => void;
}

export function SubSidebar({ sessions, loading, currentId, onSelect, onDelete, onNew }: SubSidebarProps) {
    return (
        <div className="flex flex-col h-full">
            <div className="p-2">
                <button
                    onClick={onNew}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors font-medium"
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
                    <div className="flex flex-col items-center justify-center py-8 gap-1 text-center">
                        <FileText className="h-6 w-6 text-muted-foreground/40" />
                        <p className="text-xs text-muted-foreground">No conversations yet</p>
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
                                <FileText className="h-3.5 w-3.5 shrink-0 opacity-60" />
                                <span className="flex-1 truncate text-xs">{s.title}</span>
                                <button
                                    onClick={(e) => onDelete(s.id, e)}
                                    className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-destructive/10 hover:text-destructive transition-all"
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
