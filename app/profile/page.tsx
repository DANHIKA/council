"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Cropper from "react-easy-crop";
import type { Area } from "react-easy-crop";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Loader2, Camera } from "lucide-react";
import { toast } from "sonner";
import { profileApi, type UserProfile } from "@/lib/services/profile";

// ─── Crop helper ──────────────────────────────────────────────────────────────

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

// ─── Role label ───────────────────────────────────────────────────────────────

const ROLE_LABELS: Record<string, string> = {
    ADMIN: "Admin",
    OFFICER: "Officer",
    APPLICANT: "Applicant",
};

// ─── Schema ───────────────────────────────────────────────────────────────────

const profileSchema = z.object({
    name: z.string().min(2, "Name must be at least 2 characters"),
    phone: z.string().optional(),
    organization: z.string().optional(),
});

type ProfileFormData = z.infer<typeof profileSchema>;

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ProfilePage() {
    const { data: session, status, update: updateSession } = useSession();
    const router = useRouter();

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [userData, setUserData] = useState<UserProfile | null>(null);
    const [avatarSrc, setAvatarSrc] = useState<string | null>(null);

    // Crop state
    const [cropSrc, setCropSrc] = useState<string | null>(null);
    const [crop, setCrop] = useState({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(1);
    const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
    const [cropDialogOpen, setCropDialogOpen] = useState(false);
    const [applyingCrop, setApplyingCrop] = useState(false);

    const fileInputRef = useRef<HTMLInputElement>(null);

    const {
        register,
        handleSubmit,
        formState: { errors, isDirty },
        reset,
    } = useForm<ProfileFormData>({ resolver: zodResolver(profileSchema) });

    useEffect(() => {
        if (status === "loading") return;
        if (!session) { router.push("/auth/login"); return; }

        profileApi.getProfile()
            .then(({ user }) => {
                setUserData(user);
                setAvatarSrc(user.image ?? null);
                reset({
                    name: user.name ?? "",
                    phone: user.phone ?? "",
                    organization: user.organization ?? "",
                });
            })
            .catch(() => toast.error("Failed to load profile"))
            .finally(() => setLoading(false));
    }, [session, status, router, reset]);

    // ── Avatar upload ──────────────────────────────────────────────────────────

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
        // Reset so same file can be picked again
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

            // Save image immediately
            const { user } = await profileApi.updateProfile({
                name: userData?.name ?? "",
                phone: userData?.phone ?? undefined,
                organization: userData?.organization ?? undefined,
                image: dataUrl,
            });
            setUserData(user);
            await updateSession({ user: { image: dataUrl } });
            toast.success("Profile photo updated");
        } catch {
            toast.error("Failed to update photo");
        } finally {
            setApplyingCrop(false);
        }
    };

    // ── Form submit ────────────────────────────────────────────────────────────

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
            toast.error(err.message ?? "Failed to save profile");
        } finally {
            setSaving(false);
        }
    };

    // ── Render ─────────────────────────────────────────────────────────────────

    if (status === "loading" || loading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
        );
    }

    const name = userData?.name ?? session?.user?.name ?? "User";
    const email = session?.user?.email ?? "";
    const initials = name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
    const roleLabel = ROLE_LABELS[userData?.role ?? ""] ?? userData?.role ?? "";
    const joinedDate = userData?.createdAt
        ? new Date(userData.createdAt).toLocaleDateString("en-GB", { month: "long", year: "numeric" })
        : null;

    return (
        <>
            <div className="container mx-auto py-12 max-w-lg space-y-10">

                {/* Identity row */}
                <div className="flex items-center gap-5">
                    <div
                        className="relative group cursor-pointer shrink-0"
                        onClick={() => fileInputRef.current?.click()}
                    >
                        <Avatar className="h-20 w-20 text-lg">
                            {avatarSrc && <AvatarImage src={avatarSrc} alt={name} />}
                            <AvatarFallback>{initials}</AvatarFallback>
                        </Avatar>
                        <div className="absolute inset-0 rounded-full bg-black/45 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                            <Camera className="h-5 w-5 text-white" />
                        </div>
                    </div>
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleFileChange}
                    />

                    <div className="min-w-0">
                        <p className="text-xl font-semibold truncate">{name}</p>
                        <p className="text-sm text-muted-foreground mt-0.5">
                            {roleLabel}
                            {joinedDate && (
                                <> · Joined {joinedDate}</>
                            )}
                        </p>
                        <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="mt-2 text-xs text-primary hover:underline"
                        >
                            Change photo
                        </button>
                    </div>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
                    <div className="space-y-1.5">
                        <Label htmlFor="name">Full name</Label>
                        <Input id="name" {...register("name")} />
                        {errors.name && (
                            <p className="text-xs text-destructive">{errors.name.message}</p>
                        )}
                    </div>

                    <div className="space-y-1.5">
                        <Label htmlFor="email">Email</Label>
                        <Input id="email" value={email} disabled className="bg-muted/40" />
                        <p className="text-xs text-muted-foreground">Email cannot be changed.</p>
                    </div>

                    <div className="space-y-1.5">
                        <Label htmlFor="phone">Phone</Label>
                        <Input id="phone" {...register("phone")} placeholder="+1 (555) 000-0000" />
                    </div>

                    <div className="space-y-1.5">
                        <Label htmlFor="organization">Organization</Label>
                        <Input id="organization" {...register("organization")} placeholder="Optional" />
                    </div>

                    <div className="flex justify-end pt-2">
                        <Button type="submit" disabled={!isDirty || saving}>
                            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                            Save changes
                        </Button>
                    </div>
                </form>
            </div>

            {/* Crop dialog */}
            <Dialog open={cropDialogOpen} onOpenChange={setCropDialogOpen}>
                <DialogContent className="max-w-sm" showCloseButton={false}>
                    <DialogHeader>
                        <DialogTitle>Crop photo</DialogTitle>
                    </DialogHeader>

                    <div className="relative h-72 rounded-2xl overflow-hidden bg-muted">
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
                        <input
                            type="range"
                            min={1}
                            max={3}
                            step={0.05}
                            value={zoom}
                            onChange={(e) => setZoom(Number(e.target.value))}
                            className="w-full accent-primary"
                        />
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setCropDialogOpen(false)}>
                            Cancel
                        </Button>
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
