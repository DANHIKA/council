import { useMutation } from "@tanstack/react-query";
import { certificatesApi } from "@/lib/services";

export const useDownloadCertificate = () => {
    return useMutation({
        mutationFn: (applicationId: string) => certificatesApi.download(applicationId),
    });
};
