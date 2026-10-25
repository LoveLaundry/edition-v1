import { knowledgeBaseText } from "./businessData";
import type { Lang } from "./businessData";
import { getOrderTracking, formatTracking } from "./liveData";

export function extractOrderRef(message: string): string | null {
    const m = message.match(
        /\b(?:track|tracking|status|where is my|my order|order (?:id|number|#)?|tag|ref|quotation)\b[^\n]{0,40}?([A-Za-z0-9][A-Za-z0-9_-]{3,})/i,
    );
    if (m) return m[1];
    const structured = message.match(/\b([a-z]{1,4}[-_]\d{2,}|[a-h0-9]{8,})\b/i);
    if (structured) return structured[1];
    return null;
}

export async function buildContext(message: string, lang: Lang): Promise<string> {
    const parts: string[] = [knowledgeBaseText];
    const ref = extractOrderRef(message);
    if (ref) {
        const tracking = await getOrderTracking(ref);
        if (tracking) {
            parts.push("LIVE ORDER INFORMATION:\n" + formatTracking(tracking, lang));
        }
    }
    return parts.join("\n\n");
}
