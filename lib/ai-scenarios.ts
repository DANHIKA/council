export interface AIScenario {
    query: string;
    recommendation: string;
    explanation: string;
    keywords: string[];
}

export const PERMIT_SCENARIOS: AIScenario[] = [
    // --- Building Construction ---
    {
        query: "I want to build a small shed in my backyard for my tools",
        recommendation: "Building Construction",
        explanation: "Required for any new permanent structures on your property.",
        keywords: ["build", "shed", "garage", "structure", "house"]
    },
    {
        query: "Adding a new master bedroom and ensuite to the back of my house",
        recommendation: "Building Construction",
        explanation: "Major structural additions and floor plan changes require building approval.",
        keywords: ["extension", "addition", "bedroom", "ensuite", "room"]
    },
    {
        query: "Building a swimming pool in the garden for the kids",
        recommendation: "Building Construction",
        explanation: "Pools are considered major structures and require safety verification.",
        keywords: ["pool", "swimming", "water", "digging"]
    },
    {
        query: "Constructing a new double-car garage next to the driveway",
        recommendation: "Building Construction",
        explanation: "New garages are standalone structures that must comply with zoning laws.",
        keywords: ["garage", "carport", "driveway", "parking"]
    },
    {
        query: "Building a wooden deck in my backyard for BBQs",
        recommendation: "Building Construction",
        explanation: "Elevated decks often require structural checks for safety.",
        keywords: ["deck", "patio", "wood", "outdoor", "bbq"]
    },

    // --- Business License ---
    {
        query: "Starting a new coffee shop in the town center",
        recommendation: "Business License",
        explanation: "Necessary for operating any commercial business or retail outlet.",
        keywords: ["shop", "business", "store", "cafe", "restaurant", "sell"]
    },
    {
        query: "I want to open a hair salon in my spare room at home",
        recommendation: "Business License",
        explanation: "Home-based businesses still require registration for zoning and health standards.",
        keywords: ["salon", "hair", "nails", "home", "beauty"]
    },
    {
        query: "Starting a mobile food truck to sell tacos at various locations",
        recommendation: "Business License",
        explanation: "Mobile food vendors need specific permits to operate on council land.",
        keywords: ["food", "truck", "taco", "van", "vendor"]
    },
    {
        query: "Opening a new gym and fitness studio in the warehouse district",
        recommendation: "Business License",
        explanation: "Commercial fitness centers require specific business and safety licensing.",
        keywords: ["gym", "fitness", "studio", "training", "workout"]
    },
    {
        query: "I want to run a professional daycare from my house",
        recommendation: "Business License",
        explanation: "Childcare services are highly regulated and require formal business approval.",
        keywords: ["daycare", "child", "kids", "care", "home"]
    },

    // --- Renovation/Repair ---
    {
        query: "I need to fix my broken wooden fence",
        recommendation: "Renovation/Repair",
        explanation: "Covers maintenance and repairs to existing boundary structures.",
        keywords: ["fix", "repair", "fence", "broken", "renovate", "painting"]
    },
    {
        query: "Replacing the old roof tiles because they are leaking",
        recommendation: "Renovation/Repair",
        explanation: "Maintenance of the primary structure like roofing falls under repair permits.",
        keywords: ["roof", "tiles", "leaking", "rain", "ceiling"]
    },
    {
        query: "Removing an internal wall to create an open-plan kitchen",
        recommendation: "Renovation/Repair",
        explanation: "Internal modifications that might affect structural integrity need review.",
        keywords: ["wall", "internal", "kitchen", "open", "renovation"]
    },
    {
        query: "Refurbishing my old balcony to make it safe again",
        recommendation: "Renovation/Repair",
        explanation: "Repairing existing structures like balconies for safety compliance.",
        keywords: ["balcony", "safety", "rust", "wood", "repair"]
    },

    // --- Public Event ---
    {
        query: "Organizing a community food festival at the local park",
        recommendation: "Public Event",
        explanation: "Required for gatherings in public spaces involving food or large crowds.",
        keywords: ["festival", "event", "park", "market", "gathering"]
    },
    {
        query: "I want to hold a local music concert in the town square",
        recommendation: "Public Event",
        explanation: "Loud events in public squares require noise and crowd control permits.",
        keywords: ["music", "concert", "band", "stage", "sound"]
    },
    {
        query: "Closing down High Street for a charity 5k run",
        recommendation: "Public Event",
        explanation: "Road closures for public activities require significant coordination and permitting.",
        keywords: ["road", "street", "closure", "race", "run", "marathon"]
    },
    {
        query: "Organizing a Saturday morning farmers market at the library parking lot",
        recommendation: "Public Event",
        explanation: "Regular markets on public land require recurring event permits.",
        keywords: ["market", "farmers", "stalls", "library", "parking"]
    },

    // --- Signage/Advertising ---
    {
        query: "I want to put up a large glowing sign for my new office",
        recommendation: "Signage/Advertising",
        explanation: "Required for any external signs or advertisements visible from the street.",
        keywords: ["sign", "billboard", "advertising", "poster", "banner"]
    },
    {
        query: "Installing a digital screen on the front of my shop to show ads",
        recommendation: "Signage/Advertising",
        explanation: "Digital and illuminated signs have specific rules to avoid driver distraction.",
        keywords: ["digital", "screen", "ads", "video", "electronic"]
    },
    {
        query: "Putting up a tall flagpole with my company logo outside the building",
        recommendation: "Signage/Advertising",
        explanation: "Tall structures used for branding require height and safety clearance.",
        keywords: ["flag", "pole", "logo", "branding", "tall"]
    },

    // --- Green Energy/Environment ---
    {
        query: "Installing solar panels on my roof to save electricity",
        recommendation: "Green Energy/Environment",
        explanation: "Specific permit for renewable energy installations and environmental changes.",
        keywords: ["solar", "panels", "electricity", "green", "energy"]
    },
    {
        query: "Installing a large wind turbine in my backyard to power my workshop",
        recommendation: "Green Energy/Environment",
        explanation: "Wind turbines have specific height and noise regulations in residential areas.",
        keywords: ["wind", "turbine", "power", "generator", "sustainable"]
    },
    {
        query: "Putting in a massive underground rainwater tank for my garden",
        recommendation: "Green Energy/Environment",
        explanation: "Large scale water storage systems require environmental and safety checks.",
        keywords: ["water", "tank", "rain", "garden", "underground"]
    },

    // --- Environmental/Tree ---
    {
        query: "I want to cut down a large oak tree that is leaning over my house",
        recommendation: "Environmental/Tree",
        explanation: "Required for removing protected trees or significant vegetation.",
        keywords: ["tree", "cut", "removal", "garden", "vegetation"]
    },
    {
        query: "Clearing some thick bushland to make space for a new fence",
        recommendation: "Environmental/Tree",
        explanation: "Land clearing, even for fences, often requires environmental assessment.",
        keywords: ["clear", "bush", "scrub", "land", "vegetation"]
    },
    {
        query: "Digging a new pond or lake on my rural property",
        recommendation: "Environmental/Tree",
        explanation: "Significant changes to land drainage and ecology require environmental permits.",
        keywords: ["pond", "lake", "dig", "water", "landscape"]
    }
];

export function getRelevantScenarios(userQuery: string, limit = 4): AIScenario[] {
    const query = userQuery.toLowerCase();
    // Simple keyword matching to find the most relevant examples
    return [...PERMIT_SCENARIOS]
        .sort((a, b) => {
            const aMatches = a.keywords.filter(k => query.includes(k)).length;
            const bMatches = b.keywords.filter(k => query.includes(k)).length;
            return bMatches - aMatches;
        })
        .slice(0, limit);
}
