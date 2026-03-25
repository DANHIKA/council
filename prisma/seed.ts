import "dotenv/config";
import { PrismaClient, UserRole } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient({
    adapter: new PrismaPg(
        new Pool({
            connectionString: process.env.DATABASE_URL,
        }),
    ),
});

function slugToCode(name: string): string {
    return name
        .trim()
        .toUpperCase()
        .replace(/&/g, "AND")
        .replace(/[^A-Z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "");
}

type RequirementDef = {
    key: string;
    label: string;
    description?: string;
    required?: boolean;
    sortOrder?: number;
    acceptMime?: string;
    acceptExt?: string;
};

type PermitTypeDef = {
    name: string;
    description?: string;
    requirements: RequirementDef[];
};

const DEFAULT_REQUIREMENTS: RequirementDef[] = [
    {
        key: "ID_COPY",
        label: "Applicant ID Copy",
        description: "National ID / passport copy for the main applicant.",
        required: true,
        sortOrder: 1,
        acceptMime: "application/pdf,image/*",
        acceptExt: ".pdf,.png,.jpg,.jpeg",
    },
    {
        key: "APPLICATION_LETTER",
        label: "Application Letter",
        description: "A brief letter describing the request.",
        required: true,
        sortOrder: 2,
        acceptMime: "application/pdf,image/*",
        acceptExt: ".pdf,.png,.jpg,.jpeg",
    },
    {
        key: "PROOF_OF_OWNERSHIP",
        label: "Proof of Ownership / Authorization",
        description: "Title deed, lease agreement, or owner authorization letter.",
        required: true,
        sortOrder: 3,
        acceptMime: "application/pdf,image/*",
        acceptExt: ".pdf,.png,.jpg,.jpeg",
    },
    {
        key: "PAYMENT_RECEIPT",
        label: "Payment Receipt",
        description: "Proof of payment for the application.",
        required: true,
        sortOrder: 99,
        acceptMime: "application/pdf,image/*",
        acceptExt: ".pdf,.png,.jpg,.jpeg",
    },
];

const PERMIT_TYPES: PermitTypeDef[] = [
    {
        name: "Building Construction",
        description: "Construction or extension of buildings/structures.",
        requirements: [
            ...DEFAULT_REQUIREMENTS,
            {
                key: "SITE_PLAN",
                label: "Site Plan",
                description: "Site plan showing boundaries, access, and building footprint.",
                required: true,
                sortOrder: 10,
                acceptMime: "application/pdf,image/*",
                acceptExt: ".pdf,.png,.jpg,.jpeg",
            },
            {
                key: "ARCHITECTURAL_DRAWINGS",
                label: "Architectural Drawings",
                description: "Floor plans, elevations, and sections.",
                required: true,
                sortOrder: 11,
                acceptMime: "application/pdf,image/*",
                acceptExt: ".pdf,.png,.jpg,.jpeg",
            },
        ],
    },
    {
        name: "Demolition",
        description: "Demolition of existing structures.",
        requirements: [
            ...DEFAULT_REQUIREMENTS,
            {
                key: "DEMOLITION_PLAN",
                label: "Demolition Plan",
                description: "Plan describing demolition method and safety measures.",
                required: true,
                sortOrder: 10,
                acceptMime: "application/pdf",
                acceptExt: ".pdf",
            },
            {
                key: "SAFETY_PLAN",
                label: "Safety Plan",
                description: "Risk assessment and safety plan for workers and the public.",
                required: true,
                sortOrder: 11,
                acceptMime: "application/pdf",
                acceptExt: ".pdf",
            },
        ],
    },
    {
        name: "Electrical Installation",
        description: "Electrical wiring, installations, and upgrades.",
        requirements: [
            ...DEFAULT_REQUIREMENTS,
            {
                key: "ELECTRICAL_DIAGRAM",
                label: "Electrical Diagram",
                description: "Single-line diagram / wiring plan.",
                required: true,
                sortOrder: 10,
                acceptMime: "application/pdf,image/*",
                acceptExt: ".pdf,.png,.jpg,.jpeg",
            },
            {
                key: "LICENSED_ELECTRICIAN",
                label: "Licensed Electrician Details",
                description: "Proof of registration/licensing of the electrician/contractor.",
                required: true,
                sortOrder: 11,
                acceptMime: "application/pdf,image/*",
                acceptExt: ".pdf,.png,.jpg,.jpeg",
            },
        ],
    },
    {
        name: "Plumbing",
        description: "Plumbing installation or modification.",
        requirements: [
            ...DEFAULT_REQUIREMENTS,
            {
                key: "PLUMBING_PLAN",
                label: "Plumbing Plan",
                description: "Layout of piping, fixtures, and connection points.",
                required: true,
                sortOrder: 10,
                acceptMime: "application/pdf,image/*",
                acceptExt: ".pdf,.png,.jpg,.jpeg",
            },
            {
                key: "LICENSED_PLUMBER",
                label: "Licensed Plumber Details",
                description: "Proof of registration/licensing of the plumber/contractor.",
                required: true,
                sortOrder: 11,
                acceptMime: "application/pdf,image/*",
                acceptExt: ".pdf,.png,.jpg,.jpeg",
            },
        ],
    },
    {
        name: "Land Use Change",
        description: "Change of land use / zoning.",
        requirements: [
            ...DEFAULT_REQUIREMENTS,
            {
                key: "MOTIVATION_REPORT",
                label: "Motivation Report",
                description: "Written justification for land use change.",
                required: true,
                sortOrder: 10,
                acceptMime: "application/pdf",
                acceptExt: ".pdf",
            },
            {
                key: "ZONING_MAP",
                label: "Zoning Map / Extract",
                description: "Zoning map showing current and proposed zoning.",
                required: true,
                sortOrder: 11,
                acceptMime: "application/pdf,image/*",
                acceptExt: ".pdf,.png,.jpg,.jpeg",
            },
        ],
    },
    {
        name: "Business License",
        description: "Licensing for operating a business.",
        requirements: [
            ...DEFAULT_REQUIREMENTS,
            {
                key: "BUSINESS_REGISTRATION",
                label: "Business Registration",
                description: "Company registration certificate or equivalent.",
                required: true,
                sortOrder: 10,
                acceptMime: "application/pdf,image/*",
                acceptExt: ".pdf,.png,.jpg,.jpeg",
            },
            {
                key: "TAX_CLEARANCE",
                label: "Tax Clearance",
                description: "Proof of tax compliance.",
                required: false,
                sortOrder: 11,
                acceptMime: "application/pdf,image/*",
                acceptExt: ".pdf,.png,.jpg,.jpeg",
            },
        ],
    },
    {
        name: "Outdoor Advertising",
        description: "Billboards, signage, and outdoor advertising.",
        requirements: [
            ...DEFAULT_REQUIREMENTS,
            {
                key: "SIGNAGE_DESIGN",
                label: "Signage Design",
                description: "Artwork/design with dimensions and materials.",
                required: true,
                sortOrder: 10,
                acceptMime: "application/pdf,image/*",
                acceptExt: ".pdf,.png,.jpg,.jpeg",
            },
            {
                key: "LOCATION_PHOTOS",
                label: "Location Photos",
                description: "Photos of the proposed installation location.",
                required: true,
                sortOrder: 11,
                acceptMime: "image/*,application/pdf",
                acceptExt: ".png,.jpg,.jpeg,.pdf",
            },
        ],
    },
    {
        name: "Environmental Impact",
        description: "Environmental impact screening/assessment.",
        requirements: [
            ...DEFAULT_REQUIREMENTS,
            {
                key: "EIA_REPORT",
                label: "Environmental Impact Report",
                description: "Assessment/report by relevant practitioner (where applicable).",
                required: true,
                sortOrder: 10,
                acceptMime: "application/pdf",
                acceptExt: ".pdf",
            },
            {
                key: "MITIGATION_PLAN",
                label: "Mitigation Plan",
                description: "Plan outlining mitigation measures.",
                required: false,
                sortOrder: 11,
                acceptMime: "application/pdf",
                acceptExt: ".pdf",
            },
        ],
    },
    {
        name: "Road Excavation",
        description: "Excavation works affecting roads/sidewalks.",
        requirements: [
            ...DEFAULT_REQUIREMENTS,
            {
                key: "TRAFFIC_MANAGEMENT_PLAN",
                label: "Traffic Management Plan",
                description: "Plan for traffic control and pedestrian safety.",
                required: true,
                sortOrder: 10,
                acceptMime: "application/pdf",
                acceptExt: ".pdf",
            },
            {
                key: "WORK_METHOD_STATEMENT",
                label: "Method Statement",
                description: "Work methods and restoration details.",
                required: true,
                sortOrder: 11,
                acceptMime: "application/pdf",
                acceptExt: ".pdf",
            },
        ],
    },
    {
        name: "Event Permit",
        description: "Public or private events requiring council approval.",
        requirements: [
            ...DEFAULT_REQUIREMENTS,
            {
                key: "EVENT_PROGRAM",
                label: "Event Program",
                description: "Event schedule/program and expected attendance.",
                required: true,
                sortOrder: 10,
                acceptMime: "application/pdf",
                acceptExt: ".pdf",
            },
            {
                key: "VENUE_PERMISSION",
                label: "Venue Permission Letter",
                description: "Permission letter from venue owner/manager.",
                required: true,
                sortOrder: 11,
                acceptMime: "application/pdf,image/*",
                acceptExt: ".pdf,.png,.jpg,.jpeg",
            },
            {
                key: "SECURITY_PLAN",
                label: "Security Plan",
                description: "Security arrangements and crowd management.",
                required: false,
                sortOrder: 12,
                acceptMime: "application/pdf",
                acceptExt: ".pdf",
            },
        ],
    },
    {
        name: "Food Handling",
        description: "Food handling / food premises compliance.",
        requirements: [
            ...DEFAULT_REQUIREMENTS,
            {
                key: "HEALTH_CERTIFICATE",
                label: "Health Certificate (if applicable)",
                description: "Health inspection certificate or application.",
                required: false,
                sortOrder: 10,
                acceptMime: "application/pdf,image/*",
                acceptExt: ".pdf,.png,.jpg,.jpeg",
            },
            {
                key: "KITCHEN_LAYOUT",
                label: "Kitchen / Premises Layout",
                description: "Layout plan of premises/kitchen area.",
                required: true,
                sortOrder: 11,
                acceptMime: "application/pdf,image/*",
                acceptExt: ".pdf,.png,.jpg,.jpeg",
            },
        ],
    },
    {
        name: "Liquor License",
        description: "Liquor trading license-related applications.",
        requirements: [
            ...DEFAULT_REQUIREMENTS,
            {
                key: "BUSINESS_PLAN",
                label: "Business Plan",
                description: "Outline of business operations and compliance approach.",
                required: false,
                sortOrder: 10,
                acceptMime: "application/pdf",
                acceptExt: ".pdf",
            },
            {
                key: "NEIGHBOR_NOTIFICATION",
                label: "Neighbor Notification Proof",
                description: "Proof of community/neighbor notification where required.",
                required: false,
                sortOrder: 11,
                acceptMime: "application/pdf,image/*",
                acceptExt: ".pdf,.png,.jpg,.jpeg",
            },
        ],
    },
    {
        name: "Telecommunications",
        description: "Telecom infrastructure installations.",
        requirements: [
            ...DEFAULT_REQUIREMENTS,
            {
                key: "NETWORK_LAYOUT",
                label: "Network Layout / Plan",
                description: "Infrastructure layout and technical plan.",
                required: true,
                sortOrder: 10,
                acceptMime: "application/pdf",
                acceptExt: ".pdf",
            },
            {
                key: "EQUIPMENT_SPECS",
                label: "Equipment Specifications",
                description: "Technical specifications for equipment.",
                required: false,
                sortOrder: 11,
                acceptMime: "application/pdf",
                acceptExt: ".pdf",
            },
        ],
    },
    {
        name: "Water & Sewer Connection",
        description: "New or modified water/sewer connections.",
        requirements: [
            ...DEFAULT_REQUIREMENTS,
            {
                key: "CONNECTION_PLAN",
                label: "Connection Plan",
                description: "Plan showing connection points and pipe sizes.",
                required: true,
                sortOrder: 10,
                acceptMime: "application/pdf,image/*",
                acceptExt: ".pdf,.png,.jpg,.jpeg",
            },
            {
                key: "PLUMBER_DETAILS",
                label: "Contractor Details",
                description: "Contractor/plumber company details and registration.",
                required: false,
                sortOrder: 11,
                acceptMime: "application/pdf,image/*",
                acceptExt: ".pdf,.png,.jpg,.jpeg",
            },
        ],
    },
    {
        name: "Other",
        description: "Other permit applications.",
        requirements: [
            ...DEFAULT_REQUIREMENTS,
            {
                key: "SUPPORTING_DOCUMENT",
                label: "Supporting Document",
                description: "Any other supporting documentation.",
                required: false,
                sortOrder: 10,
                acceptMime: "application/pdf,image/*",
                acceptExt: ".pdf,.png,.jpg,.jpeg",
            },
        ],
    },
];

async function upsertPermitTypesAndRequirements() {
    for (const permitType of PERMIT_TYPES) {
        const code = slugToCode(permitType.name);

        const dbPermitType = await prisma.permitType.upsert({
            where: { code },
            update: {
                name: permitType.name,
                description: permitType.description,
            },
            create: {
                code,
                name: permitType.name,
                description: permitType.description,
            },
        });

        for (const req of permitType.requirements) {
            await prisma.permitRequirement.upsert({
                where: {
                    permitTypeId_key: {
                        permitTypeId: dbPermitType.id,
                        key: req.key,
                    },
                },
                update: {
                    label: req.label,
                    description: req.description,
                    required: req.required ?? true,
                    sortOrder: req.sortOrder ?? 0,
                    acceptMime: req.acceptMime,
                    acceptExt: req.acceptExt,
                },
                create: {
                    permitTypeId: dbPermitType.id,
                    key: req.key,
                    label: req.label,
                    description: req.description,
                    required: req.required ?? true,
                    sortOrder: req.sortOrder ?? 0,
                    acceptMime: req.acceptMime,
                    acceptExt: req.acceptExt,
                },
            });
        }
    }
}

async function ensureDemoUsers() {
    const officerEmail = "officer@demo.local";
    const adminEmail = "admin@demo.local";
    const applicantEmail = "applicant@demo.local";

    const passwordHash = await bcrypt.hash("Password123!", 10);

    await prisma.user.upsert({
        where: { email: officerEmail },
        update: { role: UserRole.OFFICER },
        create: {
            email: officerEmail,
            name: "Demo Officer",
            role: UserRole.OFFICER,
            password: passwordHash,
        },
    });

    await prisma.user.upsert({
        where: { email: adminEmail },
        update: { role: UserRole.ADMIN },
        create: {
            email: adminEmail,
            name: "Demo Admin",
            role: UserRole.ADMIN,
            password: passwordHash,
        },
    });

    await prisma.user.upsert({
        where: { email: applicantEmail },
        update: { role: UserRole.APPLICANT },
        create: {
            email: applicantEmail,
            name: "Demo Applicant",
            role: UserRole.APPLICANT,
            password: passwordHash,
        },
    });
}

async function main() {
    await upsertPermitTypesAndRequirements();
    await ensureDemoUsers();
}

main()
    .then(async () => {
        await prisma.$disconnect();
        // eslint-disable-next-line no-console
        console.log("Seed completed");
    })
    .catch(async (e) => {
        // eslint-disable-next-line no-console
        console.error(e);
        await prisma.$disconnect();
        process.exit(1);
    });
