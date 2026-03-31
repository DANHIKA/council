import React from "react";
import { Document, Page, Text, View, StyleSheet, Image, renderToBuffer } from "@react-pdf/renderer";
import QRCode from "qrcode";

const styles = StyleSheet.create({
    page: {
        paddingTop: 60,
        paddingBottom: 60,
        paddingHorizontal: 70,
        backgroundColor: "#ffffff",
        fontFamily: "Helvetica",
    },
    border: {
        border: "3pt solid #1a3c6e",
        padding: 30,
        flex: 1,
    },
    innerBorder: {
        border: "1pt solid #1a3c6e",
        padding: 20,
        flex: 1,
        alignItems: "center",
    },
    headerRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        marginBottom: 10,
    },
    headerTitle: {
        fontSize: 11,
        color: "#1a3c6e",
        fontFamily: "Helvetica-Bold",
        letterSpacing: 3,
        textTransform: "uppercase",
    },
    mainTitle: {
        fontSize: 26,
        fontFamily: "Helvetica-Bold",
        color: "#1a3c6e",
        textAlign: "center",
        letterSpacing: 2,
        marginBottom: 4,
    },
    subTitle: {
        fontSize: 13,
        color: "#4a6fa5",
        textAlign: "center",
        fontFamily: "Helvetica-Oblique",
        marginBottom: 20,
    },
    divider: {
        borderBottom: "1pt solid #1a3c6e",
        width: "80%",
        marginVertical: 14,
    },
    certNoLabel: {
        fontSize: 9,
        color: "#888",
        letterSpacing: 2,
        textTransform: "uppercase",
        textAlign: "center",
        marginBottom: 2,
    },
    certNo: {
        fontSize: 13,
        fontFamily: "Helvetica-Bold",
        color: "#1a3c6e",
        textAlign: "center",
        marginBottom: 16,
        letterSpacing: 1,
    },
    certifyText: {
        fontSize: 10,
        color: "#555",
        textAlign: "center",
        marginBottom: 8,
    },
    applicantName: {
        fontSize: 20,
        fontFamily: "Helvetica-Bold",
        color: "#1a1a1a",
        textAlign: "center",
        marginBottom: 8,
    },
    grantedText: {
        fontSize: 10,
        color: "#555",
        textAlign: "center",
        marginBottom: 4,
    },
    permitType: {
        fontSize: 16,
        fontFamily: "Helvetica-Bold",
        color: "#1a3c6e",
        textAlign: "center",
        marginBottom: 4,
    },
    locationText: {
        fontSize: 10,
        color: "#666",
        textAlign: "center",
        marginBottom: 20,
        fontFamily: "Helvetica-Oblique",
    },
    datesRow: {
        flexDirection: "row",
        justifyContent: "space-around",
        width: "100%",
        marginBottom: 20,
    },
    dateBox: {
        alignItems: "center",
        padding: 10,
        border: "1pt solid #d0d8e8",
        borderRadius: 4,
        width: "40%",
        backgroundColor: "#f5f8ff",
    },
    dateLabel: {
        fontSize: 8,
        color: "#888",
        letterSpacing: 1,
        textTransform: "uppercase",
        marginBottom: 3,
    },
    dateValue: {
        fontSize: 11,
        fontFamily: "Helvetica-Bold",
        color: "#1a3c6e",
    },
    qrContainer: {
        alignItems: "center",
        marginBottom: 16,
    },
    qrImage: {
        width: 72,
        height: 72,
        marginBottom: 4,
    },
    qrLabel: {
        fontSize: 7,
        color: "#aaa",
        letterSpacing: 1,
        textTransform: "uppercase",
    },
    footer: {
        marginTop: 12,
        alignItems: "center",
    },
    footerText: {
        fontSize: 8,
        color: "#aaa",
        textAlign: "center",
        letterSpacing: 0.5,
    },
    sealRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        width: "100%",
        marginTop: 12,
    },
    signBlock: {
        alignItems: "center",
        width: "40%",
    },
    signLine: {
        borderBottom: "1pt solid #1a3c6e",
        width: "100%",
        marginBottom: 4,
    },
    signLabel: {
        fontSize: 8,
        color: "#888",
        textAlign: "center",
        letterSpacing: 0.5,
    },
});

function formatDate(date: Date): string {
    return new Date(date).toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "long",
        year: "numeric",
    });
}

interface CertificateData {
    certificateNo: string;
    applicantName: string;
    permitType: string;
    location: string;
    issueDate: Date;
    expiryDate: Date;
    qrCodeDataUrl: string;
}

const CertificateDocument: React.FC<{ data: CertificateData }> = ({ data }) => (
    <Document title={`Permit Certificate - ${data.certificateNo}`} author="Council Permit Portal">
        <Page size="A4" style={styles.page}>
            <View style={styles.border}>
                <View style={styles.innerBorder}>
                    <View style={styles.headerRow}>
                        <Text style={styles.headerTitle}>Council Permit Portal</Text>
                    </View>

                    <Text style={styles.mainTitle}>PERMIT CERTIFICATE</Text>
                    <Text style={styles.subTitle}>Official Certificate of Authorization</Text>

                    <View style={styles.divider} />

                    <Text style={styles.certNoLabel}>Certificate Number</Text>
                    <Text style={styles.certNo}>{data.certificateNo}</Text>

                    <Text style={styles.certifyText}>This is to certify that</Text>
                    <Text style={styles.applicantName}>{data.applicantName}</Text>
                    <Text style={styles.grantedText}>has been duly authorized and granted a</Text>
                    <Text style={styles.permitType}>{data.permitType}</Text>
                    <Text style={styles.locationText}>at {data.location}</Text>

                    <View style={styles.divider} />

                    <View style={styles.datesRow}>
                        <View style={styles.dateBox}>
                            <Text style={styles.dateLabel}>Issue Date</Text>
                            <Text style={styles.dateValue}>{formatDate(data.issueDate)}</Text>
                        </View>
                        <View style={styles.dateBox}>
                            <Text style={styles.dateLabel}>Expiry Date</Text>
                            <Text style={styles.dateValue}>{formatDate(data.expiryDate)}</Text>
                        </View>
                    </View>

                    <View style={styles.qrContainer}>
                        <Image src={data.qrCodeDataUrl} style={styles.qrImage} />
                        <Text style={styles.qrLabel}>Scan to verify</Text>
                    </View>

                    <View style={styles.sealRow}>
                        <View style={styles.signBlock}>
                            <View style={styles.signLine} />
                            <Text style={styles.signLabel}>Authorised Signature</Text>
                        </View>
                        <View style={styles.signBlock}>
                            <View style={styles.signLine} />
                            <Text style={styles.signLabel}>Official Stamp</Text>
                        </View>
                    </View>

                    <View style={styles.footer}>
                        <Text style={styles.footerText}>
                            This certificate was issued by the Council Permit Portal and is valid until {formatDate(data.expiryDate)}.
                        </Text>
                        <Text style={styles.footerText}>
                            Verify authenticity at: council.gov/verify/{data.certificateNo}
                        </Text>
                    </View>
                </View>
            </View>
        </Page>
    </Document>
);

export async function generateCertificatePdf(data: Omit<CertificateData, "qrCodeDataUrl"> & { qrCodePayload: string }): Promise<Buffer> {
    const qrCodeDataUrl = await QRCode.toDataURL(data.qrCodePayload, {
        width: 200,
        margin: 1,
        color: { dark: "#1a3c6e", light: "#ffffff" },
    });

    const docData: CertificateData = { ...data, qrCodeDataUrl };
    return renderToBuffer(<CertificateDocument data={docData} />);
}
