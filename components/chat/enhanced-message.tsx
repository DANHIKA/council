"use client";

import { Response } from "@/components/ui/response";
import { ChartVisualization, type ChartConfig } from "./chart-visualization";
import { TableVisualization, type TableConfig } from "./table-visualization";
import { SummaryStats } from "./table-visualization";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, CheckCircle, Info } from "lucide-react";

export interface ToolCall {
    type: "chart" | "table" | "stats";
    data: any;
    config: ChartConfig | TableConfig | any;
}

export interface MessageWithTools {
    role: "user" | "assistant";
    content: string;
    status: "complete" | "thinking";
    toolCalls?: ToolCall[];
    suggestions?: string[];
}

interface EnhancedMessageContentProps {
    message: MessageWithTools;
    variant?: "flat" | "contained";
}

export function EnhancedMessageContent({ message, variant = "flat" }: EnhancedMessageContentProps) {
    if (message.status === "thinking") {
        return null;
    }

    const hasToolCalls = message.toolCalls && message.toolCalls.length > 0;

    if (message.role === "user" || !hasToolCalls) {
        return message.role === "assistant" ? (
            <Response>{message.content}</Response>
        ) : (
            message.content
        );
    }

    return (
        <div className="space-y-4">
            {message.content && <Response>{message.content}</Response>}
            
            {message.toolCalls?.map((toolCall, index) => (
                <div key={index} className="mt-4">
                    {toolCall.type === "chart" && (
                        <ChartVisualization config={toolCall.config as ChartConfig} />
                    )}
                    {toolCall.type === "table" && (
                        <TableVisualization config={toolCall.config as TableConfig} />
                    )}
                    {toolCall.type === "stats" && (
                        <SummaryStats stats={toolCall.data} />
                    )}
                </div>
            ))}
        </div>
    );
}

export function parseToolCallsFromResponse(content: string, metadata?: any): ToolCall[] {
    const toolCalls: ToolCall[] = [];

    if (!metadata) {
        return toolCalls;
    }

    if (metadata.chart) {
        toolCalls.push({
            type: "chart",
            data: metadata.chart.data,
            config: metadata.chart,
        });
    }

    if (metadata.table) {
        toolCalls.push({
            type: "table",
            data: metadata.table.data,
            config: metadata.table,
        });
    }

    if (metadata.stats) {
        toolCalls.push({
            type: "stats",
            data: metadata.stats,
            config: {},
        });
    }

    return toolCalls;
}

interface AlertBoxProps {
    type: "info" | "success" | "warning" | "error";
    title?: string;
    children: React.ReactNode;
}

export function AlertBox({ type, title, children }: AlertBoxProps) {
    const variants = {
        info: {
            icon: Info,
            className: "border-blue-500 bg-blue-500/10",
        },
        success: {
            icon: CheckCircle,
            className: "border-green-500 bg-green-500/10",
        },
        warning: {
            icon: AlertCircle,
            className: "border-yellow-500 bg-yellow-500/10",
        },
        error: {
            icon: AlertCircle,
            className: "border-red-500 bg-red-500/10",
        },
    };

    const Icon = variants[type].icon;

    return (
        <Alert className={variants[type].className}>
            <Icon className="h-4 w-4" />
            {title && <AlertDescription className="font-medium">{title}</AlertDescription>}
            <AlertDescription className="mt-1">{children}</AlertDescription>
        </Alert>
    );
}
