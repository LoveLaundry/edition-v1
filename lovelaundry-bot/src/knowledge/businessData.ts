export type Lang = "en" | "sin";

export interface Faq {
    intent: string;
    patterns: string[];
    responses: { en: string[]; sin?: string[] };
    question: string;
    answer: string;
}

/**
 * The business operates only in Sri Lanka, so every timestamp we hand to the
 * model is rendered on the Asia/Colombo clock. Without this the serverless
 * runtime (UTC) would make us quote customers the wrong time.
 */
export const TIME_ZONE = "Asia/Colombo";

/** Render an instant for the model, explicitly on the Sri Lankan clock. */
export function formatLkt(value: string | number | Date): string {
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return new Intl.DateTimeFormat("en-GB", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: TIME_ZONE,
    }).format(date);
}

export const company = {
    name: "Love Laundry",
    mainCentre: "Chilaw, Sri Lanka",
    collectionPoints: [
        "Madampe",
        "Mahawewa",
        "Kottaramulla",
        "Dunakadeniya",
        "Bibiladeniya",
        "Wennappuwa",
    ],
    phone: "+94 77 4200 919",
    whatsapp: "+94 77 4200 919",
    email: "lovelaundry01@gmail.com",
    bookingHours: "24/7 via WhatsApp",
    pickupDeliveryHours: "Mon-Sat: 8 AM - 7 PM; Sunday: 9 AM - 5 PM",
    rating: "4.9/5",
};

export const services = [
    {
        name: "Wash & Fold",
        description:
            "Everyday laundry washed, dried, folded and returned fresh. Ideal for clothes, linens and daily wear.",
        price: "From Rs. 200/kg",
    },
    {
        name: "Ironing",
        description: "Crisp, pressed clothes handled by our press team. Shirts, trousers, dresses and more.",
        price: "From Rs. 50/piece",
    },
    {
        name: "Dry Cleaning",
        description:
            "Suits, dresses, delicates, silk and formal wear cleaned with professional-grade solvents.",
        price: "From Rs. 300/piece",
    },
    {
        name: "Pickup & Delivery",
        description:
            "We collect your laundry from your door and deliver it back fresh. Free pickup and delivery across our coverage area.",
        price: "Free with service",
    },
    {
        name: "Hotel Linen",
        description:
            "Commercial linen service for hotels: bedsheets, towels, uniforms processed at scale with reliable turnaround.",
        price: "Custom quote",
    },
    {
        name: "Commercial Laundry",
        description:
            "Bulk laundry processing for restaurants, spas and businesses with scheduled collection and delivery.",
        price: "Custom quote",
    },
    {
        name: "Bulk Processing",
        description:
            "High-volume washing and folding for events, institutions and corporate clients.",
        price: "Custom quote",
    },
];

export const pricingTable = [
    { item: "Wash & Fold", rate: "From Rs. 200/kg" },
    { item: "Ironing", rate: "From Rs. 50/piece" },
    { item: "Dry Cleaning", rate: "From Rs. 300/piece" },
    { item: "Pickup & Delivery", rate: "Free with any service" },
];

export const processSteps = [
    "Book via WhatsApp, phone call or the website Track Order form.",
    "We collect your laundry from your door (free pickup).",
    "Garments are sorted, washed, ironed or dry cleaned per service.",
    "Each item passes a quality inspection before packing.",
    "We deliver your fresh laundry back to your door.",
];

export const policies = [
    "Turnaround time is typically 24-48 hours for standard orders.",
    "Delicates, silk and stained items receive separate handling.",
    "We inspect every garment before delivery and track it through the order lifecycle.",
    "For an exact quote, share the items and service with us on WhatsApp.",
];

export const faqs: Faq[] = [
    {
        intent: "greeting",
        patterns: ["hi", "hello", "hey", "good morning", "good evening", "howdy", "sup"],
        responses: {
            en: [
                "Hello! Welcome to Love Laundry. How can I help you today?",
                "Hey there! Need help with laundry? I'm here for you.",
                "Hi! Thanks for reaching out to Love Laundry. What can I do for you?",
            ],
        },
        question: "Hello, who is this?",
        answer:
            "Hello! I'm the Love Laundry assistant. We're a laundry and dry-cleaning service based in Chilaw, Sri Lanka, offering wash & fold, ironing, dry cleaning, and free pickup & delivery. How can I help you today?",
    },
    {
        intent: "services",
        patterns: ["service", "offer", "provide", "wash", "fold", "iron", "dry clean", "laundry"],
        responses: {
            en: [
                "We offer Wash & Fold, Ironing, Dry Cleaning, Pickup & Delivery, plus commercial services (Hotel Linen, Commercial Laundry, Bulk Processing). Would you like details on any of these?",
            ],
        },
        question: "What services do you offer?",
        answer:
            "We offer four main retail services: Wash & Fold (from Rs. 200/kg), Ironing (from Rs. 50/piece), Dry Cleaning (from Rs. 300/piece), and free Pickup & Delivery. For businesses we provide Hotel Linen, Commercial Laundry and Bulk Processing on custom quotes.",
    },
    {
        intent: "pricing",
        patterns: ["how much", "price", "cost", "rate", "charge", "fee", "tariff", "quote"],
        responses: {
            en: [
                "Wash & Fold from Rs. 200/kg, Ironing from Rs. 50/piece, Dry Cleaning from Rs. 300/piece. For an exact quote, WhatsApp us your items.",
            ],
        },
        question: "How much does laundry cost?",
        answer:
            "Our general pricing: Wash & Fold from Rs. 200/kg, Ironing from Rs. 50/piece, Dry Cleaning from Rs. 300/piece. Pickup and delivery are free with any service. For an exact quote, send your items to us on WhatsApp.",
    },
    {
        intent: "pickup",
        patterns: ["pick up", "pickup", "deliver", "collect", "drop off", "schedule", "book", "turnaround"],
        responses: {
            en: [
                "We offer free pickup and delivery! Book via WhatsApp, we collect, clean, and return your laundry in 24-48 hours.",
            ],
        },
        question: "How does pickup and delivery work?",
        answer:
            "We offer free pickup and delivery. Book via WhatsApp, phone or the website, we collect your laundry from your door, wash/fold/iron or dry clean it, then deliver it back fresh. Typical turnaround is 24-48 hours.",
    },
    {
        intent: "locations",
        patterns: ["where", "location", "address", "branch", "chilaw", "madampe", "mahawewa", "find you", "map"],
        responses: {
            en: [
                "Our main centre is in Chilaw. Collection points: Madampe, Mahawewa, Kottaramulla, Dunakadeniya, Bibiladeniya and Wennappuwa.",
            ],
        },
        question: "Where are you located?",
        answer:
            "Our main centre is in Chilaw, Sri Lanka. We also have collection points in Madampe, Mahawewa, Kottaramulla, Dunakadeniya, Bibiladeniya and Wennappuwa. You can see all locations on the map on our website.",
    },
    {
        intent: "hours",
        patterns: ["hour", "open", "close", "time", "when", "available"],
        responses: {
            en: [
                "WhatsApp booking is 24/7. Pickup & delivery: Mon-Sat 8 AM-7 PM, Sunday 9 AM-5 PM.",
            ],
        },
        question: "What are your hours?",
        answer:
            "You can book with us 24/7 via WhatsApp. Pickup and delivery hours are Monday to Saturday 8 AM - 7 PM, and Sunday 9 AM - 5 PM.",
    },
    {
        intent: "contact",
        patterns: ["contact", "phone", "whatsapp", "call", "email", "number", "reach"],
        responses: {
            en: [
                "Reach us at Phone/WhatsApp +94 77 4200 919 or email lovelaundry01@gmail.com.",
            ],
        },
        question: "How do I contact Love Laundry?",
        answer:
            "Reach us at Phone or WhatsApp +94 77 4200 919, or email lovelaundry01@gmail.com. We're happy to help anytime via WhatsApp.",
    },
    {
        intent: "commercial",
        patterns: ["hotel", "business", "commercial", "bulk", "restaurant", "spa", "gym", "corporate", "linen"],
        responses: {
            en: [
                "Yes! We serve hotels, restaurants, spas and businesses with Hotel Linen, Commercial Laundry and Bulk Processing. Contact us for a custom quote.",
            ],
        },
        question: "Do you handle commercial laundry?",
        answer:
            "Yes! We serve hotels, restaurants, spas and businesses. Our commercial services include Hotel Linen, Commercial Laundry and Bulk Processing. We partner with several hotels and offer custom quotes based on volume and schedule.",
    },
    {
        intent: "careers",
        patterns: ["job", "hiring", "work", "career", "team", "employ", "vacancy", "apply"],
        responses: {
            en: [
                "We're hiring delivery drivers, machine operators, ironers and collection agents. Send us a WhatsApp to apply!",
            ],
        },
        question: "Are you hiring?",
        answer:
            "We're hiring! Current openings include Delivery Driver, Machine Operator, Ironer / Presser and Collection Agent. Benefits include competitive pay, training and flexible schedules. Send us a WhatsApp message to apply.",
    },
    {
        intent: "quality",
        patterns: ["quality", "care", "safe", "damage", "delicate", "stain", "silk", "trust"],
        responses: {
            en: [
                "We treat every garment with professional care: graded equipment, separate handling for delicates, quality inspection before delivery, 4.9/5 rating.",
            ],
        },
        question: "How do you ensure quality?",
        answer:
            "We treat every garment with professional care: professional-grade equipment, separate handling for delicates and stained items, a quality inspection before delivery, and a 4.9/5 customer rating.",
    },
    {
        intent: "track",
        patterns: ["track", "status", "where is my order", "order update", "my laundry"],
        responses: {
            en: [
                "Share your order ID or tag code and I'll pull the latest status from our system.",
            ],
        },
        question: "How can I track my order?",
        answer:
            "Share your order ID or garment tag code and I'll look up the live status from our system, including each stage from received through washing, pressing, folding, packing, ready and out for delivery.",
    },
    {
        intent: "process",
        patterns: ["process", "how it works", "steps", "what happens"],
        responses: {
            en: [
                "Book, we collect, we clean, we inspect, we deliver - usually within 24-48 hours.",
            ],
        },
        question: "How does your service work?",
        answer:
            "Our process: 1) Book via WhatsApp, phone or the website. 2) We collect your laundry (free). 3) Garments are sorted, washed, ironed or dry cleaned. 4) Each item passes quality inspection. 5) We deliver it back fresh. Standard turnaround is 24-48 hours.",
    },
];

export const knowledgeBaseText = `
COMPANY: ${company.name} - laundry and dry-cleaning service in ${company.mainCentre}. Rating ${company.rating}.
CONTACT: Phone/WhatsApp ${company.whatsapp}, Email ${company.email}. Booking ${company.bookingHours}. Pickup/Delivery ${company.pickupDeliveryHours}.
LOCATIONS: Main centre ${company.mainCentre}. Collection points: ${company.collectionPoints.join(", ")}.
SERVICES:
${services.map((s) => `- ${s.name}: ${s.description} (${s.price})`).join("\n")}
PRICING:
${pricingTable.map((p) => `- ${p.item}: ${p.rate}`).join("\n")}
PROCESS:
${processSteps.map((s, i) => `${i + 1}. ${s}`).join("\n")}
POLICIES:
${policies.map((p) => `- ${p}`).join("\n")}
`.trim();
