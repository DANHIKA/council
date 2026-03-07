"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Save, Building, Phone, Mail, User } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { profileApi, type UserProfile } from "@/lib/services/profile";

const profileSchema = z.object({
    name: z.string().min(2, "Name must be at least 2 characters"),
    email: z.string().email().readonly(),
    phone: z.string().optional(),
    organization: z.string().optional(),
});

type ProfileFormData = z.infer<typeof profileSchema>;

export default function ProfilePage() {
    const { data: session, status, update: updateSession } = useSession();
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [userData, setUserData] = useState<UserProfile | null>(null);

    const {
        register,
        handleSubmit,
        formState: { errors, isDirty },
        reset,
    } = useForm<ProfileFormData>({
        resolver: zodResolver(profileSchema),
    });

    useEffect(() => {
        if (status === "loading") return;
        if (!session) {
            router.push("/auth/login");
            return;
        }

        async function fetchProfile() {
            try {
                const data = await profileApi.getProfile();
                setUserData(data.user);
                reset({
                    name: data.user.name || "",
                    email: data.user.email || "",
                    phone: data.user.phone || "",
                    organization: data.user.organization || "",
                });
            } catch (err) {
                console.error("Failed to fetch profile:", err);
                toast.error("Failed to load profile");
            } finally {
                setLoading(false);
            }
        }
        fetchProfile();
    }, [session, status, router, reset]);

    const onSubmit = async (data: ProfileFormData) => {
        setSaving(true);
        try {
            const updated = await profileApi.updateProfile({
                name: data.name,
                phone: data.phone,
                organization: data.organization,
            });

            setUserData(updated.user);
            reset({
                name: updated.user.name || "",
                email: updated.user.email,
                phone: updated.user.phone || "",
                organization: updated.user.organization || "",
            });
            
            // Update session so header reflects new name immediately
            await updateSession({ user: { name: updated.user.name || "" } });
            
            toast.success("Profile updated successfully");
        } catch (err: any) {
            console.error(err);
            toast.error(err.message || "Failed to update profile");
        } finally {
            setSaving(false);
        }
    };

    if (status === "loading" || loading) {
        return (
            <div className="flex justify-center items-center min-h-[50vh]">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="container mx-auto py-8 max-w-2xl">
            <h1 className="text-3xl font-bold mb-2">Profile Settings</h1>
            <p className="text-muted-foreground mb-8">Manage your account information</p>

            <div className="grid gap-6">
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <User className="h-5 w-5" />
                            Personal Information
                        </CardTitle>
                        <CardDescription>
                            Update your personal details and contact information.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="email">Email Address</Label>
                                <div className="relative">
                                    <Mail className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                                    <Input 
                                        id="email" 
                                        {...register("email")} 
                                        disabled 
                                        className="pl-9 bg-muted/50" 
                                    />
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    Email cannot be changed. Contact support for assistance.
                                </p>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="name">Full Name</Label>
                                <Input id="name" {...register("name")} />
                                {errors.name && (
                                    <p className="text-sm text-destructive">{errors.name.message}</p>
                                )}
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="phone">Phone Number</Label>
                                <div className="relative">
                                    <Phone className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                                    <Input 
                                        id="phone" 
                                        {...register("phone")} 
                                        className="pl-9" 
                                        placeholder="+1 (555) 000-0000"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="organization">Organization / Company</Label>
                                <div className="relative">
                                    <Building className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                                    <Input 
                                        id="organization" 
                                        {...register("organization")} 
                                        className="pl-9" 
                                        placeholder="Acme Corp (Optional)"
                                    />
                                </div>
                            </div>

                            <div className="pt-4 flex justify-end">
                                <Button type="submit" disabled={!isDirty || saving}>
                                    {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                                    <Save className="h-4 w-4 mr-2" />
                                    Save Changes
                                </Button>
                            </div>
                        </form>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Account Status</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/20">
                            <div>
                                <p className="font-medium">Current Role</p>
                                <p className="text-sm text-muted-foreground">
                                    Determines your permissions within the system.
                                </p>
                            </div>
                            <Badge variant="outline" className="text-sm px-3 py-1">
                                {userData?.role || "APPLICANT"}
                            </Badge>
                        </div>
                        
                        <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/20">
                            <div>
                                <p className="font-medium">Member Since</p>
                                <p className="text-sm text-muted-foreground">
                                    Date your account was created.
                                </p>
                            </div>
                            <span className="text-sm font-medium">
                                {userData?.createdAt ? new Date(userData.createdAt).toLocaleDateString() : "-"}
                            </span>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
