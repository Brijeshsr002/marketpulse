import { CORS, json, preflight } from "@/lib/http";
import { handleRpc } from "@/lib/mcp";

// Optional shared secret. When MCP_API_KEY is set, clients must send
// "Authorization: Bearer <key>" or append ?key=<key> to the server URL.
function authorized(request: Request) {
  const key = process.env.MCP_API_KEY;
  if (!key) return true;
  const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  return bearer === key || new URL(request.url).searchParams.get("key") === key;
}

export async function POST(request: Request) {
  if (!authorized(request)) return json({ jsonrpc: "2.0", id: null, error: { code: -32001, message: "Unauthorized" } }, 401);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } }, 400);
  }

  if (Array.isArray(body)) {
    const responses = (await Promise.all(body.map(handleRpc))).filter(Boolean);
    return responses.length ? json(responses) : new Response(null, { status: 202, headers: CORS });
  }
  const response = await handleRpc(body as Parameters<typeof handleRpc>[0]);
  return response ? json(response) : new Response(null, { status: 202, headers: CORS });
}

// Stateless server: no server-initiated SSE stream and no sessions to delete.
export function GET() {
  return new Response("MarketPulse MCP endpoint. POST JSON-RPC here. Docs: /docs", {
    status: 405,
    headers: { ...CORS, Allow: "POST, OPTIONS" },
  });
}

export const OPTIONS = preflight;
