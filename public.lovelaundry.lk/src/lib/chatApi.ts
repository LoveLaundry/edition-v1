/**
 * Public chatbot client.
 *
 * Conversations are persisted in the quotation-service so that admins can see
 * and take over public chats. The widget sends guest messages there; the
 * service asks lovelaundry-bot for a reply (unless an admin has taken over),
 * and the widget polls the conversation to learn who it is talking to.
 *
 * Configure `VITE_CHAT_API_URL` to the quotation-service base URL
 * (e.g. https://your-quotation-service.vercel.app).
 */
const BASE: string = (import.meta.env.VITE_CHAT_API_URL as string | undefined) ?? ""

export interface ServerMessage {
    id: string
    sender: "guest" | "bot" | "admin"
    text: string
    sender_name?: string | null
    timestamp: string
}

export interface ConversationState {
    conversation_id: string
    messages: ServerMessage[]
    assigned_admin_name: string | null
}

function ids(): { conversationId: string; guestId: string } {
    let conversationId = localStorage.getItem("ll_chat_conversation_id")
    let guestId = localStorage.getItem("ll_chat_guest_id")
    if (!conversationId) {
        conversationId = crypto.randomUUID()
        localStorage.setItem("ll_chat_conversation_id", conversationId)
    }
    if (!guestId) {
        guestId = crypto.randomUUID()
        localStorage.setItem("ll_chat_guest_id", guestId)
    }
    return { conversationId, guestId }
}

export function getChatIds(): { conversationId: string; guestId: string } {
    return ids()
}

async function postJson(url: string, body: unknown): Promise<ConversationState> {
    const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    })
    if (!res.ok) throw new Error(`Chat API error: ${res.status}`)
    return (await res.json()) as ConversationState
}

async function getJson(url: string): Promise<ConversationState> {
    const res = await fetch(url)
    if (!res.ok) throw new Error(`Chat API error: ${res.status}`)
    return (await res.json()) as ConversationState
}

export async function sendGuestMessage(
    conversationId: string,
    guestId: string,
    message: string,
    lang: "en" | "sin",
): Promise<ConversationState> {
    const base = BASE.replace(/\/$/, "")
    const url = `${base}/chat/conversations/${conversationId}/messages`
    return postJson(url, { message, guest_id: guestId, lang })
}

export async function fetchConversation(
    conversationId: string,
    guestId: string,
): Promise<ConversationState> {
    const base = BASE.replace(/\/$/, "")
    const url = `${base}/chat/conversations/${conversationId}?guest_id=${encodeURIComponent(guestId)}`
    return getJson(url)
}
