"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    BarChart,
    Bar,
    PieChart,
    Pie,
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
    Cell,
} from "recharts";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export interface ChartDataPoint {
    name: string;
    value: number;
    [key: string]: any;
}

export interface ChartConfig {
    title?: string;
    type: "bar" | "pie" | "line" | "horizontalBar";
    data: ChartDataPoint[];
    xKey?: string;
    yKey?: string;
    colors?: string[];
    showGrid?: boolean;
    showLegend?: boolean;
}

const DEFAULT_COLORS = [
    "hsl(var(--primary))",
    "hsl(var(--secondary))",
    "hsl(var(--accent))",
    "hsl(var(--destructive))",
    "hsl(var(--success))",
    "hsl(var(--warning))",
    "hsl(var(--info))",
];

const CHART_HEIGHT = 300;

export function ChartVisualization({ config }: { config: ChartConfig }) {
    const {
        title,
        type,
        data,
        xKey = "name",
        yKey = "value",
        colors = DEFAULT_COLORS,
        showGrid = true,
        showLegend = true,
    } = config;

    if (!data || data.length === 0) {
        return (
            <Card className="w-full">
                <CardHeader>
                    <CardTitle className="text-lg">{title || "Chart"}</CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-muted-foreground text-center py-8">
                        No data available to display
                    </p>
                </CardContent>
            </Card>
        );
    }

    const renderChart = () => {
        const commonProps = {
            data,
            margin: { top: 10, right: 10, left: 10, bottom: 10 },
        };

        switch (type) {
            case "bar":
                return (
                    <BarChart {...commonProps}>
                        {showGrid && <CartesianGrid strokeDasharray="3 3" stroke="#374151" />}
                        <XAxis dataKey={xKey} tick={{ fontSize: 12 }} />
                        <YAxis tick={{ fontSize: 12 }} />
                        <Tooltip
                            contentStyle={{
                                backgroundColor: "hsl(var(--background))",
                                border: "1px solid hsl(var(--border))",
                                borderRadius: "8px",
                            }}
                        />
                        {showLegend && <Legend />}
                        <Bar dataKey={yKey} fill={colors[0]} radius={[4, 4, 0, 0]} />
                    </BarChart>
                );

            case "horizontalBar":
                return (
                    <BarChart {...commonProps} layout="vertical">
                        {showGrid && <CartesianGrid strokeDasharray="3 3" stroke="#374151" />}
                        <XAxis type="number" tick={{ fontSize: 12 }} />
                        <YAxis dataKey={xKey} type="category" tick={{ fontSize: 12 }} width={100} />
                        <Tooltip
                            contentStyle={{
                                backgroundColor: "hsl(var(--background))",
                                border: "1px solid hsl(var(--border))",
                                borderRadius: "8px",
                            }}
                        />
                        {showLegend && <Legend />}
                        <Bar dataKey={yKey} fill={colors[0]} radius={[0, 4, 4, 0]} />
                    </BarChart>
                );

            case "pie":
                return (
                    <PieChart>
                        <Pie
                            data={data}
                            dataKey={yKey}
                            nameKey={xKey}
                            cx="50%"
                            cy="50%"
                            outerRadius={Math.min(CHART_HEIGHT, 400) / 2 - 20}
                            label
                        >
                            {data.map((entry, index) => (
                                <Cell
                                    key={`cell-${index}`}
                                    fill={colors[index % colors.length]}
                                />
                            ))}
                        </Pie>
                        <Tooltip
                            contentStyle={{
                                backgroundColor: "hsl(var(--background))",
                                border: "1px solid hsl(var(--border))",
                                borderRadius: "8px",
                            }}
                        />
                        {showLegend && <Legend />}
                    </PieChart>
                );

            case "line":
                return (
                    <LineChart {...commonProps}>
                        {showGrid && <CartesianGrid strokeDasharray="3 3" stroke="#374151" />}
                        <XAxis dataKey={xKey} tick={{ fontSize: 12 }} />
                        <YAxis tick={{ fontSize: 12 }} />
                        <Tooltip
                            contentStyle={{
                                backgroundColor: "hsl(var(--background))",
                                border: "1px solid hsl(var(--border))",
                                borderRadius: "8px",
                            }}
                        />
                        {showLegend && <Legend />}
                        <Line
                            type="monotone"
                            dataKey={yKey}
                            stroke={colors[0]}
                            strokeWidth={2}
                            dot={{ fill: colors[0], strokeWidth: 2 }}
                        />
                    </LineChart>
                );

            default:
                return <BarChart data={data} />;
        }
    };

    return (
        <Card className="w-full">
            <CardHeader>
                <CardTitle className="text-lg">{title || "Data Visualization"}</CardTitle>
            </CardHeader>
            <CardContent>
                <div style={{ height: CHART_HEIGHT }}>
                    <ResponsiveContainer width="100%" height="100%">
                        {renderChart()}
                    </ResponsiveContainer>
                </div>
            </CardContent>
        </Card>
    );
}

export function MultiSeriesChart({
    title,
    data,
    categories,
    dataKey,
}: {
    title?: string;
    data: any[];
    categories: string[];
    dataKey: string;
}) {
    return (
        <Card className="w-full">
            <CardHeader>
                <CardTitle className="text-lg">{title || "Multi-Series Chart"}</CardTitle>
            </CardHeader>
            <CardContent>
                <div style={{ height: CHART_HEIGHT }}>
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={data} margin={{ top: 10, right: 10, left: 10, bottom: 10 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                            <XAxis dataKey={dataKey} tick={{ fontSize: 12 }} />
                            <YAxis tick={{ fontSize: 12 }} />
                            <Tooltip
                                contentStyle={{
                                    backgroundColor: "hsl(var(--background))",
                                    border: "1px solid hsl(var(--border))",
                                    borderRadius: "8px",
                                }}
                            />
                            <Legend />
                            {categories.map((cat, index) => (
                                <Bar
                                    key={cat}
                                    dataKey={cat}
                                    fill={DEFAULT_COLORS[index % DEFAULT_COLORS.length]}
                                    radius={[4, 4, 0, 0]}
                                />
                            ))}
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </CardContent>
        </Card>
    );
}
