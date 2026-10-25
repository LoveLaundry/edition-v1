import { formatLkt, type Lang } from "./businessData";

export interface TrackingStatusEntry {
    status?: string;
    changed_at?: string;
    changed_by?: string;
    note?: string;
}

export interface TrackingInfo {
    id?: string | number;
    quotation_title?: string;
    tag?: string;
    status?: string;
    status_history?: TrackingStatusEntry[];
    created_at?: string;
    updated_at?: string;
    garment_label?: string;
}

const QUOTATION_SERVICE_URL = (process.env.QUOTATION_SERVICE_URL || "").replace(/\/+$/, "");
const BILL_SERVICE_URL = (process.env.BILL_SERVICE_URL || "").replace(/\/+$/, "");

const STATUS_LABELS: Record<string, string> = {
    draft: "Draft",
    received: "Received",
    washing: "Washing",
    pressing: "Pressing / Ironing",
    folding: "Folding",
    packing: "Packing",
    ready: "Ready",
    out_for_delivery: "Out for Delivery",
    delivered: "Delivered",
    cancelled: "Cancelled",
};

export function statusLabel(status?: string): string {
    if (!status) return "Unknown";
    return STATUS_LABELS[status] ?? status;
}

function timeout(ms: number): AbortSignal {
    return AbortSignal.timeout(ms);
}

export async function getOrderTracking(ref: string): Promise<TrackingInfo | null> {
    if (!QUOTATION_SERVICE_URL) return null;
    const candidates = [
        `${QUOTATION_SERVICE_URL}/quotations/${encodeURIComponent(ref)}/tracking`,
        `${QUOTATION_SERVICE_URL}/tags/${encodeURIComponent(ref)}/tracking`,
    ];
    for (const url of candidates) {
        try {
            const res = await fetch(url, { signal: timeout(5000) });
            if (res.ok) {
                const data = (await res.json()) as TrackingInfo;
                if (data && data.status) return data;
            }
        } catch {
            // try next candidate
        }
    }
    return null;
}

/**
 * Loyalty lookups are intentionally disabled here. The bot must not carry a
 * database master key or impersonate an internal service. Add a scoped,
 * authenticated service endpoint before re-enabling this capability.
 */
export async function getLoyalty(_clientRef: string): Promise<string | null> {
    return null;
}

export function formatTracking(info: TrackingInfo, lang: Lang): string {
    const lines: string[] = [];
    const title = info.quotation_title ? ` (${info.quotation_title})` : "";
    lines.push(`Order ${info.id ?? info.tag ?? "unknown"}${title}`);
    if (info.garment_label) lines.push(`Garment: ${info.garment_label}`);
    lines.push(`Current status: ${statusLabel(info.status)}`);
    if (info.status_history && info.status_history.length > 0) {
        lines.push("History:");
        for (const h of info.status_history) {
            const when = h.changed_at
                ? formatLkt(h.changed_at)
                : "";
            lines.push(`- ${statusLabel(h.status)} ${when ? `(${when})` : ""}`);
        }
    }
    return lines.join("\n");
}
