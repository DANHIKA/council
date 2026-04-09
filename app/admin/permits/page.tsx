"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { permitTypesApi } from "@/lib/services";
import type { PermitType } from "@/lib/types";
import { Loader2, Plus, Edit, Trash2, Eye } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
} from "@/components/ui/sheet";
import { toast } from "sonner";

export default function AdminPermitsPage() {
    const [permitTypes, setPermitTypes] = useState<PermitType[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedPermit, setSelectedPermit] = useState<PermitType | null>(null);
    const [detailsOpen, setDetailsOpen] = useState(false);

    useEffect(() => {
        loadPermitTypes();
    }, []);

    const loadPermitTypes = async () => {
        setLoading(true);
        try {
            const data = await permitTypesApi.list({ includeRequirements: true });
            setPermitTypes(data.permitTypes || []);
        } catch {
            toast.error("Failed to load permit types");
        } finally {
            setLoading(false);
        }
    };

    const handleViewDetails = (permit: PermitType) => {
        setSelectedPermit(permit);
        setDetailsOpen(true);
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
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">Permit Types</h2>
                    <p className="text-muted-foreground mt-1">
                        Manage available permit types and their configurations
                    </p>
                </div>
                <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Permit Type
                </Button>
            </div>

            {permitTypes.length === 0 ? (
                <Alert>
                    <AlertTitle>No permit types found</AlertTitle>
                    <AlertDescription>
                        Create your first permit type to get started.
                    </AlertDescription>
                </Alert>
            ) : (
                <Card>
                    <CardHeader>
                        <CardTitle>All Permit Types</CardTitle>
                        <CardDescription>
                            {permitTypes.length} permit{permitTypes.length !== 1 ? "s" : ""} configured
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Name</TableHead>
                                    <TableHead>Code</TableHead>
                                    <TableHead>Fee</TableHead>
                                    <TableHead>Requirements</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {permitTypes.map((permit) => (
                                    <TableRow key={permit.id}>
                                        <TableCell className="font-medium">
                                            <div>
                                                <p>{permit.name}</p>
                                                {permit.description && (
                                                    <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                                                        {permit.description}
                                                    </p>
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                                                {permit.code}
                                            </code>
                                        </TableCell>
                                        <TableCell>
                                            <span className="font-semibold">
                                                {permit.currency} {Number(permit.fee).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                            </span>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="secondary">
                                                {permit.requirements?.length || 0} document{(permit.requirements?.length || 0) !== 1 ? "s" : ""}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => handleViewDetails(permit)}
                                                >
                                                    <Eye className="h-4 w-4" />
                                                </Button>
                                                <Button variant="ghost" size="icon">
                                                    <Edit className="h-4 w-4" />
                                                </Button>
                                                <Button variant="ghost" size="icon">
                                                    <Trash2 className="h-4 w-4 text-destructive" />
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            )}

            {/* Permit Details Sheet */}
            <Sheet open={detailsOpen} onOpenChange={setDetailsOpen}>
                <SheetContent className="w-[400px] sm:w-[540px]">
                    <SheetHeader>
                        <SheetTitle>{selectedPermit?.name}</SheetTitle>
                        <SheetDescription>
                            Permit type details and requirements
                        </SheetDescription>
                    </SheetHeader>
                    {selectedPermit && (
                        <div className="space-y-6 py-4">
                            <div className="space-y-2">
                                <h4 className="text-sm font-medium text-muted-foreground">Code</h4>
                                <code className="text-sm bg-muted px-2 py-1 rounded block">
                                    {selectedPermit.code}
                                </code>
                            </div>

                            {selectedPermit.description && (
                                <div className="space-y-2">
                                    <h4 className="text-sm font-medium text-muted-foreground">Description</h4>
                                    <p className="text-sm">{selectedPermit.description}</p>
                                </div>
                            )}

                            <div className="space-y-2">
                                <h4 className="text-sm font-medium text-muted-foreground">Application Fee</h4>
                                <p className="text-2xl font-bold">
                                    {selectedPermit.currency} {Number(selectedPermit.fee).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                </p>
                            </div>

                            {selectedPermit.requirements && selectedPermit.requirements.length > 0 && (
                                <div className="space-y-3">
                                    <h4 className="text-sm font-medium">Document Requirements</h4>
                                    <div className="space-y-2">
                                        {selectedPermit.requirements.map((req) => (
                                            <div key={req.id} className="flex items-start justify-between p-3 border rounded-lg">
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-medium">{req.label}</p>
                                                    {req.description && (
                                                        <p className="text-xs text-muted-foreground mt-1">{req.description}</p>
                                                    )}
                                                    {req.acceptMime && (
                                                        <p className="text-xs text-muted-foreground mt-1">
                                                            Accepted: {req.acceptMime}
                                                        </p>
                                                    )}
                                                </div>
                                                <Badge variant={req.required ? "default" : "outline"} className="ml-2 shrink-0">
                                                    {req.required ? "Required" : "Optional"}
                                                </Badge>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div className="pt-4 border-t flex gap-2">
                                <Button className="flex-1">
                                    <Edit className="h-4 w-4 mr-2" />
                                    Edit Permit Type
                                </Button>
                            </div>
                        </div>
                    )}
                </SheetContent>
            </Sheet>
        </div>
    );
}
