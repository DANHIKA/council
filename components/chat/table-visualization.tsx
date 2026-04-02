"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Download, Copy } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export interface TableColumn {
    key: string;
    header: string;
    type?: "text" | "number" | "date" | "badge" | "status";
    format?: (value: any) => string | React.ReactNode;
}

export interface TableConfig {
    title?: string;
    columns: TableColumn[];
    data: any[];
    compact?: boolean;
    showExport?: boolean;
}

export function TableVisualization({ config }: { config: TableConfig }) {
    const { title, columns, data, compact = false, showExport = true } = config;

    const [sortKey, setSortKey] = useState<string | null>(null);
    const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

    const handleSort = (key: string) => {
        if (sortKey === key) {
            setSortDirection(sortDirection === "asc" ? "desc" : "asc");
        } else {
            setSortKey(key);
            setSortDirection("asc");
        }
    };

    const sortedData = [...data].sort((a, b) => {
        if (!sortKey) return 0;
        const aVal = a[sortKey];
        const bVal = b[sortKey];
        if (aVal < bVal) return sortDirection === "asc" ? -1 : 1;
        if (aVal > bVal) return sortDirection === "asc" ? 1 : -1;
        return 0;
    });

    const handleExportCSV = () => {
        const headers = columns.map((col) => col.header).join(",");
        const rows = sortedData.map((row) =>
            columns.map((col) => {
                const value = row[col.key];
                // Escape commas and quotes in CSV
                return `"${String(value).replace(/"/g, '""')}"`;
            }).join(",")
        );
        const csv = [headers, ...rows].join("\n");
        const blob = new Blob([csv], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${title?.toLowerCase().replace(/\s+/g, "-") || "data"}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const handleCopyTable = async () => {
        const text = sortedData.map((row) =>
            columns.map((col) => row[col.key]).join("\t")
        ).join("\n");
        try {
            await navigator.clipboard.writeText(text);
            toast("Table copied", {
                description: "Table data copied to clipboard",
            });
        } catch {
            toast.error("Copy failed", {
                description: "Unable to copy to clipboard",
            });
        }
    };

    const renderCell = (column: TableColumn, value: any) => {
        if (column.format) {
            return column.format(value);
        }

        switch (column.type) {
            case "badge":
                return <Badge variant="secondary">{String(value)}</Badge>;
            case "status": {
                const statusVariants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
                    approved: "default",
                    pending: "secondary",
                    rejected: "destructive",
                    in_progress: "outline",
                    completed: "default",
                };
                const variant = statusVariants[String(value).toLowerCase()] ?? "secondary";
                return (
                    <Badge variant={variant}>
                        {String(value)}
                    </Badge>
                );
            }
            case "number":
                return typeof value === "number" ? value.toLocaleString() : value;
            case "date":
                return value ? new Date(value).toLocaleDateString() : "-";
            default:
                return value;
        }
    };

    return (
        <Card className="w-full">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-lg">{title || "Data Table"}</CardTitle>
                {showExport && data.length > 0 && (
                    <div className="flex gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleCopyTable}
                            className="h-8 gap-1"
                        >
                            <Copy className="h-3.5 w-3.5" />
                            <span className="text-xs">Copy</span>
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleExportCSV}
                            className="h-8 gap-1"
                        >
                            <Download className="h-3.5 w-3.5" />
                            <span className="text-xs">Export</span>
                        </Button>
                    </div>
                )}
            </CardHeader>
            <CardContent>
                <div className="rounded-md border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                {columns.map((col) => (
                                    <TableHead
                                        key={col.key}
                                        className={compact ? "py-2" : "py-3"}
                                        onClick={
                                            col.type === "number" || col.type === "date"
                                                ? () => handleSort(col.key)
                                                : undefined
                                        }
                                        style={
                                            col.type === "number" || col.type === "date"
                                                ? { cursor: "pointer" }
                                                : undefined
                                        }
                                    >
                                        {col.header}
                                        {sortKey === col.key && (
                                            <span className="ml-1 text-xs">
                                                {sortDirection === "asc" ? "↑" : "↓"}
                                            </span>
                                        )}
                                    </TableHead>
                                ))}
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {sortedData.length === 0 ? (
                                <TableRow>
                                    <TableCell
                                        colSpan={columns.length}
                                        className="text-center py-8 text-muted-foreground"
                                    >
                                        No data available
                                    </TableCell>
                                </TableRow>
                            ) : (
                                sortedData.map((row, rowIndex) => (
                                    <TableRow key={rowIndex}>
                                        {columns.map((col) => (
                                            <TableCell
                                                key={col.key}
                                                className={compact ? "py-2" : "py-3"}
                                            >
                                                {renderCell(col, row[col.key])}
                                            </TableCell>
                                        ))}
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>
                {data.length > 0 && (
                    <p className="text-xs text-muted-foreground mt-2">
                        Showing {data.length} {data.length === 1 ? "row" : "rows"}
                    </p>
                )}
            </CardContent>
        </Card>
    );
}

export function SummaryStats({ stats }: { stats: { label: string; value: string | number; trend?: string; icon?: React.ReactNode }[] }) {
    return (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {stats.map((stat, index) => (
                <Card key={index}>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">{stat.label}</CardTitle>
                        {stat.icon}
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stat.value}</div>
                        {stat.trend && (
                            <p className="text-xs text-muted-foreground mt-1">{stat.trend}</p>
                        )}
                    </CardContent>
                </Card>
            ))}
        </div>
    );
}
