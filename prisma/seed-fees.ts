import "dotenv/config";
import { PrismaClient, Department } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const prisma = new PrismaClient({
    adapter: new PrismaPg(
        new Pool({
            connectionString: process.env.DATABASE_URL,
        }),
    ),
});

// Define permit types with fees (self-contained for fresh DB)
const PERMIT_TYPES: {
    name: string;
    description: string;
    applicationFee: number;
    permitFee: number;
    validityMonths: number;
    department: Department;
}[] = [
    { name: "Building Construction", description: "Construction or extension of buildings/structures.", applicationFee: 5000, permitFee: 50000, validityMonths: 24, department: Department.BUILDING },
    { name: "Demolition", description: "Demolition of existing structures.", applicationFee: 3000, permitFee: 25000, validityMonths: 6, department: Department.BUILDING },
    { name: "Electrical Installation", description: "Electrical wiring, installations, and upgrades.", applicationFee: 2000, permitFee: 15000, validityMonths: 12, department: Department.BUILDING },
    { name: "Plumbing", description: "Plumbing installation or modification.", applicationFee: 2000, permitFee: 15000, validityMonths: 12, department: Department.BUILDING },
    { name: "Land Use Change", description: "Change of land use / zoning.", applicationFee: 10000, permitFee: 100000, validityMonths: 60, department: Department.GENERAL },
    { name: "Business License", description: "Licensing for operating a business.", applicationFee: 5000, permitFee: 30000, validityMonths: 12, department: Department.BUSINESS },
    { name: "Outdoor Advertising", description: "Billboards, signage, and outdoor advertising.", applicationFee: 3000, permitFee: 20000, validityMonths: 12, department: Department.GENERAL },
    { name: "Environmental Impact", description: "Environmental impact screening/assessment.", applicationFee: 15000, permitFee: 75000, validityMonths: 24, department: Department.ENVIRONMENTAL },
    { name: "Road Excavation", description: "Excavation works affecting roads/sidewalks.", applicationFee: 5000, permitFee: 40000, validityMonths: 3, department: Department.ROADS },
    { name: "Event Permit", description: "Public or private events requiring council approval.", applicationFee: 2000, permitFee: 10000, validityMonths: 1, department: Department.EVENTS },
    { name: "Food Handling", description: "Food handling / food premises compliance.", applicationFee: 2000, permitFee: 12000, validityMonths: 12, department: Department.ENVIRONMENTAL },
    { name: "Liquor License", description: "Liquor trading license-related applications.", applicationFee: 10000, permitFee: 100000, validityMonths: 12, department: Department.BUSINESS },
    { name: "Telecommunications", description: "Telecom infrastructure installations.", applicationFee: 15000, permitFee: 80000, validityMonths: 24, department: Department.BUILDING },
    { name: "Water & Sewer Connection", description: "New or modified water/sewer connections.", applicationFee: 3000, permitFee: 25000, validityMonths: 12, department: Department.BUILDING },
    { name: "Other", description: "Other permit applications.", applicationFee: 1000, permitFee: 5000, validityMonths: 12, department: Department.GENERAL },
];

async function upsertPermitTypesAndFees() {
    console.log("Upserting permit types with fees...\n");

    for (const pt of PERMIT_TYPES) {
        const code = pt.name
            .trim()
            .toUpperCase()
            .replace(/&/g, "AND")
            .replace(/[^A-Z0-9]+/g, "_")
            .replace(/^_+|_+$/g, "");

        const result = await prisma.permitType.upsert({
            where: { code },
            create: {
                code,
                name: pt.name,
                description: pt.description,
                applicationFee: pt.applicationFee,
                permitFee: pt.permitFee,
                validityMonths: pt.validityMonths,
                department: pt.department,
            },
            update: {
                name: pt.name,
                description: pt.description,
                applicationFee: pt.applicationFee,
                permitFee: pt.permitFee,
                validityMonths: pt.validityMonths,
                department: pt.department,
            },
        });

        const appFee = Number(result.applicationFee);
        const permitFee = Number(result.permitFee);
        console.log(`  ${appFee > 0 || permitFee > 0 ? "✓" : "○"} ${pt.name}: App=MWK ${appFee.toLocaleString()}, Permit=MWK ${permitFee.toLocaleString()}, Validity: ${result.validityMonths} months`);
    }

    console.log(`\nDone. ${PERMIT_TYPES.length} permit types processed.`);
}

async function main() {
    await upsertPermitTypesAndFees();
}

main()
    .then(async () => {
        await prisma.$disconnect();
    })
    .catch(async (e) => {
        console.error(e);
        await prisma.$disconnect();
        process.exit(1);
    });
