"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { permitTypesApi } from "@/lib/services";
import type { PermitType } from "@/lib/types";
import { Loader2, Plus, Edit, Trash2, Eye, X, Save } from "lucide-react";
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
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
} from "@/components/ui/sheet";
import { toast } from "sonner";

const DEPARTMENTS = ["BUILDING", "BUSINESS", "ENVIRONMENTAL", "ROADS", "EVENTS", "GENERAL"] as const;

export default function AdminPermitsPage() {
    const [permitTypes, setPermitTypes] = useState<PermitType[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedPermit, setSelectedPermit] = useState<PermitType | null>(null);
    const [detailsOpen, setDetailsOpen] = useState(false);

    // Create/Edit dialog
    const [editOpen, setEditOpen] = useState(false);
    const [editingPermit, setEditingPermit] = useState<PermitType | null>(null);
    const [formName, setFormName] = useState("");
    const [formDesc, setFormDesc] = useState("");
    const [formAppFee, setFormAppFee] = useState("0");
    const [formPermitFee, setFormPermitFee] = useState("0");
    const [formValidityMonths, setFormValidityMonths] = useState("12");
    const [formCurrency, setFormCurrency] = useState("MWK");
    const [formDept, setFormDept] = useState("GENERAL");
    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState<string | null>(null);

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

    const openCreate = () => {
        setEditingPermit(null);
        setFormName("");
        setFormDesc("");
        setFormAppFee("0");
        setFormPermitFee("0");
        setFormValidityMonths("12");
        setFormCurrency("MWK");
        setFormDept("GENERAL");
        setEditOpen(true);
    };

    const openEdit = (permit: PermitType) => {
        setEditingPermit(permit);
        setFormName(permit.name);
        setFormDesc(permit.description || "");
        setFormAppFee(String(Number(permit.applicationFee ?? permit.fee) || 0));
        setFormPermitFee(String(Number(permit.permitFee ?? 0)));
        setFormValidityMonths(String(permit.validityMonths ?? 12));
        setFormCurrency(permit.currency || "MWK");
        setFormDept("GENERAL");
        setDetailsOpen(false);
        setEditOpen(true);
    };

    const handleSave = async () => {
        if (!formName.trim()) {
            toast.error("Name is required");
            return;
        }
        setSaving(true);
        try {
            const payload = {
                name: formName.trim(),
                description: formDesc.trim() || undefined,
                applicationFee: Number(formAppFee) || 0,
                permitFee: Number(formPermitFee) || 0,
                validityMonths: Number(formValidityMonths) || 12,
                currency: formCurrency,
                department: formDept,
            };

            if (editingPermit) {
                await fetch(`/api/admin/permit-types/${editingPermit.id}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload),
                });
                toast.success("Permit type updated");
            } else {
                await fetch("/api/admin/permit-types", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload),
                });
                toast.success("Permit type created");
            }

            setEditOpen(false);
            loadPermitTypes();
        } catch {
            toast.error(editingPermit ? "Failed to update" : "Failed to create");
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (permit: PermitType) => {
        if (!confirm(`Delete "${permit.name}"? This cannot be undone if it has no applications.`)) return;
        setDeleting(permit.id);
        try {
            const res = await fetch(`/api/admin/permit-types/${permit.id}`, { method: "DELETE" });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Failed to delete");
            toast.success("Permit type deleted");
            loadPermitTypes();
            if (selectedPermit?.id === permit.id) {
                setSelectedPermit(null);
                setDetailsOpen(false);
            }
        } catch (err: any) {
            toast.error(err.message || "Failed to delete");
        } finally {
            setDeleting(null);
        }
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
                <Button onClick={openCreate}>
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
                                    <TableHead>Application Fee</TableHead>
                                    <TableHead>Permit Fee</TableHead>
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
                                        <TableCell className="font-semibold">
                                            MWK {Number(permit.applicationFee ?? permit.fee ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                        </TableCell>
                                        <TableCell className="font-semibold">
                                            MWK {Number(permit.permitFee ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="secondary">
                                                {permit.requirements?.length || 0} document{(permit.requirements?.length || 0) !== 1 ? "s" : ""}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex items-center justify-end gap-1">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => handleViewDetails(permit)}
                                                >
                                                    <Eye className="h-4 w-4" />
                                                </Button>
                                                <Button variant="ghost" size="icon" onClick={() => openEdit(permit)}>
                                                    <Edit className="h-4 w-4" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => handleDelete(permit)}
                                                    disabled={deleting === permit.id}
                                                >
                                                    {deleting === permit.id ? (
                                                        <Loader2 className="h-4 w-4 animate-spin text-destructive" />
                                                    ) : (
                                                        <Trash2 className="h-4 w-4 text-destructive" />
                                                    )}
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

                            <div className="grid grid-cols-3 gap-4">
                                <div className="space-y-2">
                                    <h4 className="text-sm font-medium text-muted-foreground">Application Fee</h4>
                                    <p className="text-xl font-bold">
                                        MWK {Number(selectedPermit.applicationFee ?? selectedPermit.fee ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                    </p>
                                </div>
                                <div className="space-y-2">
                                    <h4 className="text-sm font-medium text-muted-foreground">Permit Fee</h4>
                                    <p className="text-xl font-bold">
                                        MWK {Number(selectedPermit.permitFee ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                    </p>
                                </div>
                                <div className="space-y-2">
                                    <h4 className="text-sm font-medium text-muted-foreground">Validity</h4>
                                    <p className="text-xl font-bold">
                                        {selectedPermit.validityMonths ?? 12} months
                                    </p>
                                </div>
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
                                <Button className="flex-1" onClick={() => openEdit(selectedPermit)}>
                                    <Edit className="h-4 w-4 mr-2" />
                                    Edit
                                </Button>
                                <Button variant="destructive" onClick={() => handleDelete(selectedPermit)}>
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    Delete
                                </Button>
                            </div>
                        </div>
                    )}
                </SheetContent>
            </Sheet>

            {/* Create/Edit Dialog */}
            <Dialog open={editOpen} onOpenChange={setEditOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{editingPermit ? "Edit" : "Create"} Permit Type</DialogTitle>
                        <DialogDescription>
                            {editingPermit ? "Update" : "Add a new"} permit type configuration.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <div className="space-y-2">
                            <Label htmlFor="pt-name">Name *</Label>
                            <Input
                                id="pt-name"
                                value={formName}
                                onChange={(e) => setFormName(e.target.value)}
                                placeholder="e.g. Building Construction"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="pt-desc">Description</Label>
                            <Textarea
                                id="pt-desc"
                                value={formDesc}
                                onChange={(e) => setFormDesc(e.target.value)}
                                placeholder="Brief description of this permit type"
                                rows={2}
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="pt-app-fee">Application Fee (MWK)</Label>
                                <Input
                                    id="pt-app-fee"
                                    type="number"
                                    min="0"
                                    value={formAppFee}
                                    onChange={(e) => setFormAppFee(e.target.value)}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="pt-permit-fee">Permit Fee (MWK)</Label>
                                <Input
                                    id="pt-permit-fee"
                                    type="number"
                                    min="0"
                                    value={formPermitFee}
                                    onChange={(e) => setFormPermitFee(e.target.value)}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="pt-validity">Validity (months)</Label>
                                <Input
                                    id="pt-validity"
                                    type="number"
                                    min="1"
                                    max="120"
                                    value={formValidityMonths}
                                    onChange={(e) => setFormValidityMonths(e.target.value)}
                                />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Currency</Label>
                                <Select value={formCurrency} onValueChange={(v) => setFormCurrency(v || "MWK")}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="MWK">MWK</SelectItem>
                                        <SelectItem value="USD">USD</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>Department</Label>
                                <Select value={formDept} onValueChange={(v) => setFormDept((v || "GENERAL") as any)}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        {DEPARTMENTS.map((d) => (
                                            <SelectItem key={d} value={d}>{d}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setEditOpen(false)} disabled={saving}>
                            Cancel
                        </Button>
                        <Button onClick={handleSave} disabled={saving}>
                            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                            {editingPermit ? "Update" : "Create"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
