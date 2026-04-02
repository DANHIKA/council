import "dotenv/config";
import { PrismaClient, UserRole } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

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
    applicationFee?: number;  // Non-refundable processing fee (MWK)
    permitFee?: number;       // Main permit fee after approval (MWK)
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
        applicationFee: 5000,  // MWK 5,000 - Non-refundable processing fee
        permitFee: 50000,      // MWK 50,000 - Main permit fee after approval
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
        applicationFee: 3000,  // MWK 3,000
        permitFee: 25000,      // MWK 25,000
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
        applicationFee: 2000,  // MWK 2,000
        permitFee: 15000,      // MWK 15,000
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
        applicationFee: 2000,  // MWK 2,000
        permitFee: 15000,      // MWK 15,000
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
        applicationFee: 10000, // MWK 10,000
        permitFee: 100000,     // MWK 100,000
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
        applicationFee: 5000,  // MWK 5,000
        permitFee: 30000,      // MWK 30,000
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
        applicationFee: 3000,  // MWK 3,000
        permitFee: 20000,      // MWK 20,000
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
        applicationFee: 15000, // MWK 15,000
        permitFee: 75000,      // MWK 75,000
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
        applicationFee: 5000,  // MWK 5,000
        permitFee: 40000,      // MWK 40,000
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
        applicationFee: 2000,  // MWK 2,000
        permitFee: 10000,      // MWK 10,000
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
        applicationFee: 2000,  // MWK 2,000
        permitFee: 12000,      // MWK 12,000
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
        applicationFee: 10000, // MWK 10,000
        permitFee: 100000,     // MWK 100,000
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
        applicationFee: 15000, // MWK 15,000
        permitFee: 80000,      // MWK 80,000
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
        applicationFee: 3000,  // MWK 3,000
        permitFee: 25000,      // MWK 25,000
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
        applicationFee: 1000,  // MWK 1,000
        permitFee: 5000,       // MWK 5,000
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
                applicationFee: permitType.applicationFee ?? 0,
                permitFee: permitType.permitFee ?? 0,
            },
            create: {
                code,
                name: permitType.name,
                description: permitType.description,
                applicationFee: permitType.applicationFee ?? 0,
                permitFee: permitType.permitFee ?? 0,
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
    const demoUsers = [
        { email: "officer@demo.local", name: "Demo Officer", role: UserRole.OFFICER },
        { email: "admin@demo.local",   name: "Demo Admin",   role: UserRole.ADMIN },
        { email: "applicant@demo.local", name: "Demo Applicant", role: UserRole.APPLICANT },
    ];

    for (const demo of demoUsers) {
        // Create Prisma user with no supabaseId — the "claim" pattern.
        // When the demo user signs up via the browser, their supabaseId will be linked.
        await prisma.user.upsert({
            where: { email: demo.email },
            update: { role: demo.role, name: demo.name },
            create: { email: demo.email, name: demo.name, role: demo.role },
        });
        console.log(`Upserted ${demo.role} user: ${demo.email}`);
    }
}

async function main() {
    await upsertPermitTypesAndRequirements();
    await ensureDemoUsers();
}

main()
    .then(async () => {
        await prisma.$disconnect();
        console.log("Seed completed");
    })
    .catch(async (e) => {
        console.error(e);
        await prisma.$disconnect();
        process.exit(1);
    });
