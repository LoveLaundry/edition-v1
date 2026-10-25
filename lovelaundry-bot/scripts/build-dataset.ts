import { writeFileSync, mkdirSync } from "fs";
import {
    faqs,
    company,
    services,
    pricingTable,
    processSteps,
    policies,
} from "../src/knowledge/businessData";

const SYSTEM =
    "You are the Love Laundry customer support assistant, a laundry and dry-cleaning business in Chilaw, Sri Lanka. " +
    "Answer in the customer's language (English or Sinhala). Be friendly, concise and helpful. " +
    "Use only the facts about Love Laundry's services, pricing, process, locations, hours, contact, commercial services, careers, quality and order tracking. " +
    "Never invent details. If unsure, invite the customer to WhatsApp " +
    company.whatsapp +
    ".";

function ex(user: string, assistant: string) {
    return {
        messages: [
            { role: "system", content: SYSTEM },
            { role: "user", content: user },
            { role: "assistant", content: assistant },
        ],
    };
}

function cap(s: string): string {
    return s.charAt(0).toUpperCase() + s.slice(1);
}

const rows: ReturnType<typeof ex>[] = [];

for (const f of faqs) {
    rows.push(ex(f.question, f.answer));
    for (const p of f.patterns.slice(0, 5)) {
        rows.push(ex(cap(p), f.answer));
    }
}

for (const s of services) {
    rows.push(
        ex(`Tell me about ${s.name}.`, `${s.name}: ${s.description} Pricing: ${s.price}.`),
    );
}

rows.push(
    ex(
        "What are your prices?",
        "Pricing: " +
            pricingTable.map((p) => `${p.item} ${p.rate}`).join(", ") +
            ".",
    ),
);

rows.push(
    ex(
        "How does your process work?",
        "Our process: " + processSteps.map((s, i) => `${i + 1}) ${s}`).join(" ") +
            " Standard turnaround is 24-48 hours.",
    ),
);

for (const p of policies) {
    rows.push(ex(`What is your policy on ${p.split(" ")[0].toLowerCase()}?`, p));
}

rows.push(
    ex(
        "Where can I find you?",
        `Main centre ${company.mainCentre}. Collection points: ${company.collectionPoints.join(", ")}.`,
    ),
);

rows.push(
    ex(
        "I want to track my order.",
        "Share your order ID or garment tag code and I will pull the live status from our system.",
    ),
);

mkdirSync("data", { recursive: true });
writeFileSync("data/knowledge_dataset.jsonl", rows.map((r) => JSON.stringify(r)).join("\n") + "\n");
console.log(`Wrote ${rows.length} training examples to data/knowledge_dataset.jsonl`);
