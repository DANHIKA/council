import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { renderToStream, Document, Page, Text, View, StyleSheet, Image, Font } from "@react-pdf/renderer";
import QRCode from "qrcode";

// Register fonts
Font.register({
    family: "Roboto",
    src: "https://cdnjs.cloudflare.com/ajax/libs/ink/3.1.10/fonts/Roboto/roboto-medium-webfont.ttf",
});

const styles = StyleSheet.create({
    page: {
        flexDirection: "column",
        backgroundColor: "#ffffff",
        padding: 50,
        fontFamily: "Roboto",
    },
    header: {
        marginBottom: 30,
        textAlign: "center",
        borderBottomWidth: 2,
        borderBottomColor: "#111827",
        paddingBottom: 20,
    },
    title: {
        fontSize: 24,
        fontWeight: "bold",
        marginBottom: 10,
        color: "#111827",
    },
    subtitle: {
        fontSize: 14,
        color: "#6b7280",
    },
    content: {
        marginBottom: 40,
        marginTop: 20,
    },
    row: {
        flexDirection: "row",
        marginBottom: 15,
        alignItems: "center",
    },
    label: {
        width: 150,
        fontSize: 12,
        color: "#6b7280",
        fontWeight: "bold",
    },
    value: {
        flex: 1,
        fontSize: 12,
        color: "#111827",
    },
    qrSection: {
        marginTop: 40,
        alignItems: "center",
        justifyContent: "center",
    },
    qrCode: {
        width: 150,
        height: 150,
    },
    footer: {
        position: "absolute",
        bottom: 30,
        left: 0,
        right: 0,
        textAlign: "center",
        fontSize: 10,
        color: "#9ca3af",
    },
    watermark: {
        position: "absolute",
        top: 300,
        left: 100,
        fontSize: 80,
        color: "#f3f4f6",
        transform: "rotate(-45deg)",
        opacity: 0.5,
        zIndex: -1,
    }
});

const CertificateDocument = ({ application, qrDataUrl }: { application: any, qrDataUrl: string }) => (
    <Document>
        <Page size="A4" style={styles.page}>
            <View style={styles.header}>
                <Text style={styles.title}>OFFICIAL PERMIT CERTIFICATE</Text>
                <Text style={styles.subtitle}>Council Regulatory Authority</Text>
            </View>

            <View style={styles.content}>
                <View style={styles.row}>
                    <Text style={styles.label}>Certificate Number:</Text>
                    <Text style={styles.value}>{application.certificate.certificateNo}</Text>
                </View>
                <View style={styles.row}>
                    <Text style={styles.label}>Permit Type:</Text>
                    <Text style={styles.value}>{application.permitType}</Text>
                </View>
                <View style={styles.row}>
                    <Text style={styles.label}>Issue Date:</Text>
                    <Text style={styles.value}>{new Date(application.certificate.issueDate).toLocaleDateString()}</Text>
                </View>
                <View style={styles.row}>
                    <Text style={styles.label}>Expiry Date:</Text>
                    <Text style={styles.value}>{new Date(application.certificate.expiryDate).toLocaleDateString()}</Text>
                </View>
                
                <View style={{ height: 20 }} />

                <View style={styles.row}>
                    <Text style={styles.label}>Issued To:</Text>
                    <Text style={styles.value}>{application.applicant.name}</Text>
                </View>
                <View style={styles.row}>
                    <Text style={styles.label}>Organization:</Text>
                    <Text style={styles.value}>{application.applicant.organization || "N/A"}</Text>
                </View>
                <View style={styles.row}>
                    <Text style={styles.label}>Authorized Location:</Text>
                    <Text style={styles.value}>{application.location}</Text>
                </View>
            </View>

            <View style={styles.qrSection}>
                <Image src={qrDataUrl} style={styles.qrCode} />
                <Text style={{ fontSize: 10, marginTop: 10, color: "#6b7280" }}>
                    Scan to verify authenticity
                </Text>
            </View>

            <Text style={styles.watermark}>OFFICIAL</Text>

            <View style={styles.footer}>
                <Text>This document is electronically generated and valid without a signature.</Text>
                <Text>Verify at: https://council-app.com/verify/{application.certificate.certificateNo}</Text>
            </View>
        </Page>
    </Document>
);

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const application = await prisma.permitApplication.findUnique({
            where: { id },
            include: {
                applicant: { select: { id: true, name: true, organization: true } },
                certificate: true,
            },
        });

        if (!application || !application.certificate) {
            return NextResponse.json({ error: "Certificate not found" }, { status: 404 });
        }

        const userRole = (session.user as any).role as string | undefined;
        const isOwner = application.applicantId === session.user.id;
        const isStaff = userRole === "OFFICER" || userRole === "ADMIN";

        if (!isOwner && !isStaff) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        // Increment download count
        await prisma.certificate.update({
            where: { id: application.certificate.id },
            data: { downloadCount: { increment: 1 } },
        });

        // Generate QR Code
        const qrDataUrl = await QRCode.toDataURL(JSON.stringify({
            no: application.certificate.certificateNo,
            app: application.id,
            iss: application.certificate.issueDate,
        }));

        const stream = await renderToStream(
            <CertificateDocument application={application} qrDataUrl={qrDataUrl} />
        );

        return new NextResponse(stream as any, {
            headers: {
                "Content-Type": "application/pdf",
                "Content-Disposition": `attachment; filename="certificate-${application.certificate.certificateNo}.pdf"`,
            },
        });
    } catch (error) {
        console.error("Certificate download error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
