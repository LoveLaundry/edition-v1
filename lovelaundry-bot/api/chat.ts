import express from "express";
import cors from "cors";
import { buildContext, extractOrderRef } from "../src/knowledge/context";
import { getOrderTracking, formatTracking } from "../src/knowledge/liveData";
import { faqs } from "../src/knowledge/businessData";
import type { Lang } from "../src/knowledge/businessData";

// ─────────────────────── Knowledge base (imported) ───────────────────────
const FALLBACK: Record<string, string> = {
    en: "I'm not sure I understand that. Could you rephrase?\n\nI can help with services, pricing, pickup/delivery, locations, hours, commercial services, loyalty, or tracking your order.",
    sin: "මට ඔබේ පණිවිඩය තේරුම් ගත නොහැක. කරුණාකර නැවත කියන්න.\n\nසේවා, මිල, එකතු/බෙදාහැරීම, පිහිටීම්, වේලාවන්, ව්‍යාපාරික සේවා, ලාභය හෝ ඔබේ ඇණවුම ලුහුබදිනවා නම් උදව් කළ හැක.",
};

// ─────────────────────── Classifier ───────────────────────
function classifyIntent(text: string): string {
    const lower = text.toLowerCase();
    const rules: Array<{ intent: string; test: RegExp }> = [
        { intent: "greeting", test: /\b(hi|hello|hey|good\s*(morning|evening)|sup|howdy)\b/ },
        { intent: "services", test: /\b(service|offer|provide|wash|fold|iron|dry\s*clean|laundry)\b/ },
        { intent: "pricing", test: /\b(how\s*much|price|cost|rate|charge|fee|tariff|quote)\b/ },
        { intent: "pickup", test: /\b(pick\s*up|deliver|collect|drop\s*off|schedule|book|turnaround)\b/ },
        { intent: "locations", test: /\b(where|location|address|branch|chilaw|madampe|mahawewa|find\s*you|map)\b/ },
        { intent: "hours", test: /\b(hour|open|close|time|when|available)\b/ },
        { intent: "contact", test: /\b(contact|phone|whatsapp|call|email|number|reach)\b/ },
        { intent: "commercial", test: /\b(hotel|business|commercial|bulk|restaurant|spa|gym|corporate|linen)\b/ },
        { intent: "careers", test: /\b(job|hiring|work|career|team|employ|vacancy|apply)\b/ },
        { intent: "quality", test: /\b(quality|care|safe|damage|delicate|stain|silk|trust)\b/ },
        { intent: "track", test: /\b(track|tracking|status|where\s*is\s*my|order\s*update|my\s*laundry)\b/ },
        { intent: "process", test: /\b(process|how\s*it\s*works|steps|what\s*happens)\b/ },
    ];
    for (const rule of rules) {
        if (rule.test.test(lower)) return rule.intent;
    }
    for (const faq of faqs) {
        if (faq.patterns.some((p) => lower.includes(p))) return faq.intent;
    }
    return "fallback";
}

function replyFromCorpus(intent: string, lang: Lang): string {
    if (intent === "fallback") return FALLBACK[lang] ?? FALLBACK.en;
    const faq = faqs.find((f) => f.intent === intent);
    if (!faq) return FALLBACK[lang] ?? FALLBACK.en;
    const pool =
        lang === "sin" && faq.responses.sin && faq.responses.sin.length > 0
            ? faq.responses.sin
            : faq.responses.en;
    return pool[Math.floor(Math.random() * pool.length)];
}

// ─────────────────── Our own model integration ───────────────────
function systemPrompt(lang: Lang): string {
    const langName = lang === "sin" ? "Sinhala" : "English";
    return [
        "You are the Love Laundry customer support assistant, a laundry and dry-cleaning business in Chilaw, Sri Lanka.",
        `Answer in ${langName}. Be friendly, concise and helpful.`,
        "Use ONLY the facts provided in the LOVE LAUNDRY KNOWLEDGE BASE and any LIVE ORDER INFORMATION below.",
        "Never invent services, prices, locations, phone numbers or policies that are not in the context.",
        "If the answer is not in the context, say you don't know and invite the customer to WhatsApp " +
            companyWhatsApp() +
            " for help.",
        "For actions that need a human (booking, complaints, refunds) give the contact details and offer to connect them.",
    ].join(" ");
}

function companyWhatsApp(): string {
    const c = faqs.find((f) => f.intent === "contact");
    return "+94 77 4200 919";
}

async function askModel(
    message: string,
    lang: Lang,
    context: string,
): Promise<string> {
    const provider = process.env.LLM_PROVIDER;
    const apiKey = process.env.LLM_API_KEY;
    const model = process.env.LLM_MODEL ?? "lovelaundry";
    const baseUrl = process.env.LLM_BASE_URL ?? "http://localhost:11434/v1";
    if (!provider || !apiKey) throw new Error("Model not configured");
    const res = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
            model,
            messages: [
                {
                    role: "system",
                    content: systemPrompt(lang) + "\n\n--- LOVE LAUNDRY KNOWLEDGE BASE ---\n" + context,
                },
                { role: "user", content: message },
            ],
        }),
    });
    if (!res.ok) throw new Error(`Model request failed: ${res.status}`);
    const data = (await res.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
    };
    const reply = data.choices?.[0]?.message?.content?.trim();
    if (!reply) throw new Error("Model returned empty reply");
    return reply;
}

export async function generateReply(message: string, lang: Lang = "en"): Promise<string> {
    const ref = extractOrderRef(message);
    if (ref) {
        const tracking = await getOrderTracking(ref);
        if (tracking) return formatTracking(tracking, lang);
    }

    if (process.env.LLM_PROVIDER && process.env.LLM_API_KEY) {
        const context = await buildContext(message, lang);
        try {
            return await askModel(message, lang, context);
        } catch {
            // Fall through to rule-based corpus on any model failure.
        }
    }
    const intent = classifyIntent(message);
    return replyFromCorpus(intent, lang);
}

// ─────────────────────── Express app ───────────────────────
const app = express();
const API_KEY = process.env.CHAT_API_KEY?.trim();
const allowedOrigins = (process.env.CHAT_ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
const requestLog = new Map<string, number[]>();
const RATE_LIMIT = 30;
const RATE_WINDOW_MS = 60_000;

app.use(cors({
    origin: allowedOrigins.length > 0 ? allowedOrigins : false,
    methods: ["POST", "OPTIONS"],
}));
app.use(express.json({ limit: "32kb" }));

function clientKey(req: express.Request): string {
    return req.ip || req.socket.remoteAddress || "unknown";
}

function isRateLimited(key: string): boolean {
    const now = Date.now();
    const recent = (requestLog.get(key) ?? []).filter((at) => at > now - RATE_WINDOW_MS);
    if (recent.length >= RATE_LIMIT) {
        requestLog.set(key, recent);
        return true;
    }
    recent.push(now);
    requestLog.set(key, recent);
    return false;
}

app.post("/api/chat", async (req, res) => {
    try {
        if (!API_KEY) {
            return res.status(503).json({ error: "service unavailable" });
        }
        if (req.headers["x-api-key"] !== API_KEY) {
            return res.status(401).json({ error: "unauthorized" });
        }
        if (isRateLimited(clientKey(req))) {
            return res.status(429).json({ error: "too many requests" });
        }
        const body = req.body as { message?: unknown; lang?: unknown };
        if (typeof body.message !== "string" || body.message.trim() === "") {
            return res.status(400).json({ error: "message is required" });
        }
        if (body.message.length > 4000) {
            return res.status(413).json({ error: "message too long" });
        }
        const lang = body.lang === "sin" ? "sin" : "en";
        const reply = await generateReply(body.message, lang);
        const payload = { reply, intent: undefined };
        res.json(payload);
    } catch {
        res.status(500).json({ error: "internal error" });
    }
});

app.get("/health", (_req, res) => {
    res.json({ ok: true });
});

export { app };

const handler = (req: any, res: any) => {
    try {
        return app(req, res);
    } catch (e: any) {
        console.error("BOT_HANDLER_ERROR", e);
        if (!res.headersSent) {
            res.statusCode = 500;
            res.setHeader("Content-Type", "application/json");
            res.end(
                JSON.stringify({
                    error: "bot handler failed",
                }),
            );
        }
    }
};

export default handler;
