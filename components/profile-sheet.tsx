"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Cropper from "react-easy-crop";
import type { Area } from "react-easy-crop";
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
} from "@/components/ui/sheet";
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Loader2, Camera } from "lucide-react";
import { toast } from "sonner";
import { profileApi, type UserProfile } from "@/lib/services/profile";

function createImage(url: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.addEventListener("load", () => resolve(img));
        img.addEventListener("error", reject);
        img.setAttribute("crossOrigin", "anonymous");
        img.src = url;
    });
}

async function getCroppedImg(src: string, crop: Area): Promise<string> {
    const image = await createImage(src);
    const canvas = document.createElement("canvas");
    canvas.width = crop.width;
    canvas.height = crop.height;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(image, crop.x, crop.y, crop.width, crop.height, 0, 0, crop.width, crop.height);
    return canvas.toDataURL("image/jpeg", 0.88);
}

const ROLE_LABELS: Record<string, string> = {
    ADMIN: "Admin",
    OFFICER: "Officer",
    APPLICANT: "Applicant",
};

const profileSchema = z.object({
    name: z.string().min(2, "Name must be at least 2 characters"),
    phone: z.string().optional(),
    organization: z.string().optional(),
});

type ProfileFormData = z.infer<typeof profileSchema>;

interface ProfileSheetProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function ProfileSheet({ open, onOpenChange }: ProfileSheetProps) {
    const { data: session, update: updateSession } = useSession();
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [userData, setUserData] = useState<UserProfile | null>(null);
    const [avatarSrc, setAvatarSrc] = useState<string | null>(null);

    const [cropSrc, setCropSrc] = useState<string | null>(null);
    const [crop, setCrop] = useState({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(1);
    const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
    const [cropDialogOpen, setCropDialogOpen] = useState(false);
    const [applyingCrop, setApplyingCrop] = useState(false);

    const fileInputRef = useRef<HTMLInputElement>(null);

    const { register, handleSubmit, formState: { errors, isDirty }, reset } =
        useForm<ProfileFormData>({ resolver: zodResolver(profileSchema) });

    useEffect(() => {
        if (!open || !session) return;
        setLoading(true);
        profileApi.getProfile()
            .then(({ user }) => {
                setUserData(user);
                setAvatarSrc(user.image ?? null);
                reset({ name: user.name ?? "", phone: user.phone ?? "", organization: user.organization ?? "" });
            })
            .catch(() => toast.error("Failed to load profile"))
            .finally(() => setLoading(false));
    }, [open, session, reset]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
            setCropSrc(reader.result as string);
            setCrop({ x: 0, y: 0 });
            setZoom(1);
            setCropDialogOpen(true);
        };
        reader.readAsDataURL(file);
        e.target.value = "";
    };

    const onCropComplete = useCallback((_: Area, pixels: Area) => {
        setCroppedAreaPixels(pixels);
    }, []);

    const handleApplyCrop = async () => {
        if (!cropSrc || !croppedAreaPixels) return;
        setApplyingCrop(true);
        try {
            const dataUrl = await getCroppedImg(cropSrc, croppedAreaPixels);
            setAvatarSrc(dataUrl);
            setCropDialogOpen(false);
            const { user } = await profileApi.updateProfile({
                name: userData?.name ?? "",
                phone: userData?.phone ?? undefined,
                organization: userData?.organization ?? undefined,
                image: dataUrl,
            });
            setUserData(user);
            await updateSession({ user: { image: dataUrl } });
            toast.success("Photo updated");
        } catch {
            toast.error("Failed to update photo");
        } finally {
            setApplyingCrop(false);
        }
    };

    const onSubmit = async (data: ProfileFormData) => {
        setSaving(true);
        try {
            const { user } = await profileApi.updateProfile({
                name: data.name,
                phone: data.phone,
                organization: data.organization,
            });
            setUserData(user);
            reset({ name: user.name ?? "", phone: user.phone ?? "", organization: user.organization ?? "" });
            await updateSession({ user: { name: user.name ?? "" } });
            toast.success("Profile saved");
        } catch (err: any) {
            toast.error(err.message ?? "Failed to save");
        } finally {
            setSaving(false);
        }
    };

    const name = userData?.name ?? session?.user?.name ?? "User";
    const email = session?.user?.email ?? "";
    const initials = name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
    const roleLabel = ROLE_LABELS[userData?.role ?? ""] ?? userData?.role ?? "";

    return (
        <>
            <Sheet open={open} onOpenChange={onOpenChange}>
                <SheetContent side="right" className="w-full sm:max-w-sm flex flex-col p-0">
                    <SheetHeader className="px-6 pt-6 pb-4 border-b shrink-0">
                        <SheetTitle>Profile</SheetTitle>
                    </SheetHeader>

                    {loading ? (
                        <div className="flex-1 flex items-center justify-center">
                            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                        </div>
                    ) : (
                        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
                            {/* Avatar */}
                            <div className="flex items-center gap-4">
                                <div className="relative group cursor-pointer shrink-0" onClick={() => fileInputRef.current?.click()}>
                                    <Avatar className="h-16 w-16 text-base">
                                        {avatarSrc && <AvatarImage src={avatarSrc} alt={name} />}
                                        <AvatarFallback>{initials}</AvatarFallback>
                                    </Avatar>
                                    <div className="absolute inset-0 rounded-full bg-black/45 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                        <Camera className="h-4 w-4 text-white" />
                                    </div>
                                </div>
                                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
                                <div className="min-w-0">
                                    <p className="font-semibold truncate">{name}</p>
                                    <p className="text-sm text-muted-foreground">{roleLabel}</p>
                                    <button type="button" onClick={() => fileInputRef.current?.click()} className="mt-1 text-xs text-primary hover:underline">
                                        Change photo
                                    </button>
                                </div>
                            </div>

                            {/* Form */}
                            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                                <div className="space-y-1.5">
                                    <Label htmlFor="ps-name">Full name</Label>
                                    <Input id="ps-name" {...register("name")} />
                                    {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
                                </div>

                                <div className="space-y-1.5">
                                    <Label htmlFor="ps-email">Email</Label>
                                    <Input id="ps-email" value={email} disabled className="bg-muted/40" />
                                </div>

                                <div className="space-y-1.5">
                                    <Label htmlFor="ps-phone">Phone</Label>
                                    <Input id="ps-phone" {...register("phone")} placeholder="+265 999 000 000" />
                                </div>

                                <div className="space-y-1.5">
                                    <Label htmlFor="ps-org">Organization</Label>
                                    <Input id="ps-org" {...register("organization")} placeholder="Optional" />
                                </div>

                                <div className="flex justify-end pt-2">
                                    <Button type="submit" disabled={!isDirty || saving}>
                                        {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                                        Save
                                    </Button>
                                </div>
                            </form>
                        </div>
                    )}
                </SheetContent>
            </Sheet>

            <Dialog open={cropDialogOpen} onOpenChange={setCropDialogOpen}>
                <DialogContent className="max-w-sm" showCloseButton={false}>
                    <DialogHeader>
                        <DialogTitle>Crop photo</DialogTitle>
                    </DialogHeader>
                    <div className="relative h-64 rounded-2xl overflow-hidden bg-muted">
                        {cropSrc && (
                            <Cropper
                                image={cropSrc}
                                crop={crop}
                                zoom={zoom}
                                aspect={1}
                                cropShape="round"
                                showGrid={false}
                                onCropChange={setCrop}
                                onZoomChange={setZoom}
                                onCropComplete={onCropComplete}
                            />
                        )}
                    </div>
                    <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Zoom</Label>
                        <input type="range" min={1} max={3} step={0.05} value={zoom}
                            onChange={e => setZoom(Number(e.target.value))} className="w-full accent-primary" />
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setCropDialogOpen(false)}>Cancel</Button>
                        <Button onClick={handleApplyCrop} disabled={applyingCrop}>
                            {applyingCrop && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                            Apply
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
