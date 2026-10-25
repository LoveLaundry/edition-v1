import assert from "node:assert/strict";
import { after, before, test } from "node:test";

process.env.CHAT_API_KEY = "test-key";
process.env.LLM_PROVIDER = "";
process.env.LLM_API_KEY = "";

const { app } = await import("./chat");
const server = app.listen(0);

before(async () => {
    await new Promise<void>((resolve) => server.once("listening", resolve));
});

after(async () => {
    await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
    });
});

function endpoint(): string {
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    return `http://127.0.0.1:${address.port}/api/chat`;
}

test("unauthorized requests do not consume the authenticated rate limit", async () => {
    for (let i = 0; i < 31; i += 1) {
        const response = await fetch(endpoint(), {
            method: "POST",
            headers: {
                "content-type": "application/json",
                "x-api-key": "invalid-key",
            },
            body: JSON.stringify({ message: "hello" }),
        });
        assert.equal(response.status, 401);
    }

    const response = await fetch(endpoint(), {
        method: "POST",
        headers: {
            "content-type": "application/json",
            "x-api-key": "test-key",
        },
        body: JSON.stringify({ message: "hello" }),
    });
    assert.equal(response.status, 200);
});
