"use client";

import { useState, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { HugeiconsIcon } from "@hugeicons/react";
import { 
    File02Icon, 
    Download01Icon, 
    Cancel01Icon, 
    Upload01Icon 
} from "@hugeicons/core-free-icons";
import type { UploadedDocument } from "@/lib/types/application";

interface UploadedFileProps {
    file: UploadedDocument;
    showStatus?: boolean;
    onDelete?: (id: string) => void;
}

export function UploadedFile({ file, showStatus = false, onDelete }: UploadedFileProps) {
    const formatFileSize = (bytes: number) => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'APPROVED':
                return 'bg-green-100 text-green-800';
            case 'REJECTED':
                return 'bg-red-100 text-red-800';
            case 'PENDING':
                return 'bg-yellow-100 text-yellow-800';
            default:
                return 'bg-gray-100 text-gray-800';
        }
    };

    return (
        <Card className="p-4">
            <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3 flex-1 min-w-0">
                    <HugeiconsIcon icon={File02Icon} className="h-8 w-8 text-muted-foreground flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{file.name}</p>
                        <div className="flex items-center space-x-2 text-xs text-muted-foreground">
                            <span>{formatFileSize(file.fileSize)}</span>
                            <span>•</span>
                            <span>{new Date(file.createdAt).toLocaleDateString()}</span>
                        </div>
                    </div>
                </div>
                <div className="flex items-center space-x-2">
                    {showStatus && (
                        <Badge className={getStatusColor(file.status)} variant="secondary">
                            {file.status}
                        </Badge>
                    )}
                    <Button size="sm" variant="outline" render={<a href={file.fileUrl} target="_blank" rel="noopener noreferrer" />}>
                        <HugeiconsIcon icon={Download01Icon} className="h-4 w-4" />
                    </Button>
                    {onDelete && (
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={() => onDelete(file.id)}
                            className="text-destructive hover:text-destructive"
                        >
                            <HugeiconsIcon icon={Cancel01Icon} className="h-4 w-4" />
                        </Button>
                    )}
                </div>
            </div>
        </Card>
    );
}

interface FileUploadProps {
    onUpload: (files: File[]) => Promise<void>;
    accept?: string;
    multiple?: boolean;
    maxSize?: number; // in bytes
    disabled?: boolean;
}

export function FileUpload({ onUpload, accept = "*", multiple = false, maxSize = 10 * 1024 * 1024, disabled = false }: FileUploadProps) {
    const [isDragging, setIsDragging] = useState(false);
    const [isUploading, setIsUploading] = useState(false);

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    }, []);

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
    }, []);

    const handleDrop = useCallback(async (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        
        const files = Array.from(e.dataTransfer.files);
        if (files.length > 0) {
            await handleFiles(files);
        }
    }, []);

    const handleFileInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        if (files.length > 0) {
            await handleFiles(files);
        }
    };

    const handleFiles = async (files: File[]) => {
        // Check file sizes
        const oversizedFiles = files.filter(file => file.size > maxSize);
        if (oversizedFiles.length > 0) {
            alert(`Some files are too large. Maximum size is ${maxSize / 1024 / 1024}MB.`);
            return;
        }

        setIsUploading(true);
        try {
            await onUpload(files);
        } catch (error) {
            console.error('Upload failed:', error);
            alert('Upload failed. Please try again.');
        } finally {
            setIsUploading(false);
        }
    };

    return (
        <Card 
            className={`border-2 border-dashed transition-colors ${
                isDragging ? 'border-primary bg-primary/5' : 'border-muted-foreground/25'
            } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
        >
            <CardContent className="p-8">
                <div className="flex flex-col items-center gap-2">
                    <HugeiconsIcon icon={Upload01Icon} className="h-8 w-8 text-muted-foreground" />
                    <div className="text-center">
                        <p className="text-sm font-medium">Click to upload or drag and drop</p>
                        <p className="text-xs text-muted-foreground">Max size: 10MB</p>
                    </div>
                    <Button variant="outline" disabled={disabled || isUploading} render={<label />}>
                        Select File
                        <input
                            type="file"
                            className="hidden"
                            accept={accept}
                            multiple={multiple}
                            onChange={(e) => e.target.files && onUpload(Array.from(e.target.files))}
                            disabled={disabled || isUploading}
                        />
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}
