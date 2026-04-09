"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { permitTypesApi } from "@/lib/services";
import type { PermitType } from "@/lib/types";
import { Loader2, FileText, ArrowRight, Info } from "lucide-react";
import { NewApplicationSheet } from "@/components/new-application-sheet";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export default function PermitsPage() {
    const [permitTypes, setPermitTypes] = useState<PermitType[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedPermit, setSelectedPermit] = useState<PermitType | null>(null);
    const [applicationSheetOpen, setApplicationSheetOpen] = useState(false);

    useEffect(() => {
        setLoading(true);
        permitTypesApi.list({ includeRequirements: true })
            .then(data => setPermitTypes(data.permitTypes || []))
            .catch(() => {
                // Error is handled by the alert
            })
            .finally(() => setLoading(false));
    }, []);

    const handleApplyClick = (permitType: PermitType) => {
        setSelectedPermit(permitType);
        setApplicationSheetOpen(true);
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[50vh]">
                <div className="flex flex-col items-center gap-4">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <p className="text-muted-foreground">Loading permit types...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="container mx-auto py-8 max-w-7xl space-y-8">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Permit Types</h1>
                <p className="text-muted-foreground mt-1">
                    Browse available permits and start your application
                </p>
            </div>

            {permitTypes.length === 0 ? (
                <Alert>
                    <Info className="h-4 w-4" />
                    <AlertTitle>No permits available</AlertTitle>
                    <AlertDescription>
                        There are currently no permit types available. Please contact support.
                    </AlertDescription>
                </Alert>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {permitTypes.map((permit) => (
                        <Card key={permit.id} className="hover:shadow-lg transition-shadow">
                            <CardHeader className="pb-3">
                                <CardTitle className="text-lg">{permit.name}</CardTitle>
                                {permit.description && (
                                    <CardDescription>{permit.description}</CardDescription>
                                )}
                            </CardHeader>
                            <CardContent>
                                <div className="flex items-center justify-between mb-4">
                                    <span className="text-sm text-muted-foreground">Fee</span>
                                    <span className="text-xl font-bold">
                                        {permit.currency} {Number(permit.fee).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                    </span>
                                </div>
                                <Button 
                                    className="w-full" 
                                    onClick={() => handleApplyClick(permit)}
                                >
                                    Apply Now
                                    <ArrowRight className="h-4 w-4 ml-2" />
                                </Button>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            {/* New Application Sheet */}
            <NewApplicationSheet
                open={applicationSheetOpen}
                onOpenChange={setApplicationSheetOpen}
                prefilledPermitTypeId={selectedPermit?.id}
                onSuccess={() => {
                    setApplicationSheetOpen(false);
                    setSelectedPermit(null);
                }}
            />
        </div>
    );
}
