import { env, createExecutionContext, waitOnExecutionContext } from "cloudflare:test";
import seedSql from "../seed/dev-sample.sql?raw";
import { app } from "../src/index";
import { addDays, nowIst } from "../src/domain/time";
import { RazorpayGateway, setGatewayForTests } from "../src/services/gateway";
import { hmacSha256Hex } from "../src/db";

export async function seed() {
  const stmts = seedSql.split(/;\s*\n/).map((s) => s.replace(/^\s*--.*$/gm, "").trim()).filter(Boolean);
  await env.DB.batch(stmts.map((s) => env.DB.prepare(s)));
}

export async function req(method: string, path: string, body?: unknown, headers: Record<string, string> = {}) {
  const ctx = createExecutionContext();
  const res = await app.fetch(new Request(`https://aestheva.test${path}`, {
    method, headers: { "content-type": "application/json", ...headers }, body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body),
  }), env, ctx);
  await waitOnExecutionContext(ctx);
  const text = await res.text();
  let json: any; try { json = JSON.parse(text); } catch { json = null; }
  return { status: res.status, json, text };
}

export const sql = <T = any>(q: string, ...params: unknown[]) => env.DB.prepare(q).bind(...params).all<T>().then((r) => r.results);
export const day = (n: number) => addDays(nowIst().date, n);

/**
 * A Razorpay API stand-in: the real RazorpayGateway class runs against this fetch, so request shapes,
 * auth and signature checks are exercised without the network.
 */
export function fakeRazorpay() {
  const calls: { method: string; path: string; body: any }[] = [];
  const orders = new Map<string, number>();
  const payments = new Map<string, { id: string; order_id: string; amount: number; status: string; method: string }>();
  let n = 0;
  const tag = crypto.randomUUID().slice(0, 6);   // ids stay unique across fakes sharing one database
  const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input)), path = url.pathname.replace(/^\/v1/, ""), method = init?.method ?? "GET";
    const body = init?.body ? JSON.parse(String(init.body)) : null;
    calls.push({ method, path, body });
    const ok = (j: unknown) => new Response(JSON.stringify(j), { status: 200, headers: { "content-type": "application/json" } });
    if (method === "POST" && path === "/orders") { const id = `order_${tag}${++n}`; orders.set(id, body.amount); return ok({ id, amount: body.amount, status: "created" }); }
    let m = path.match(/^\/payments\/([^/]+)$/);
    if (m && method === "GET") return payments.has(m[1]) ? ok(payments.get(m[1])) : new Response(JSON.stringify({ error: { description: "not found" } }), { status: 400 });
    m = path.match(/^\/payments\/([^/]+)\/capture$/);
    if (m) { const p = payments.get(m[1])!; p.status = "captured"; return ok(p); }
    m = path.match(/^\/payments\/([^/]+)\/refund$/);
    if (m) return ok({ id: `rfnd_${tag}${++n}`, status: "processed", amount: body.amount });
    return new Response("{}", { status: 404 });
  }) as typeof fetch;
  const gw = new RazorpayGateway("rzp_test_key", "test_key_secret", fetchImpl);
  return {
    calls, orders,
    /** Make this fake the gateway the Worker uses (call in beforeAll of each describe). */
    install: () => setGatewayForTests(gw),
    /** The client pays: Razorpay now knows the payment, and Checkout hands back this signed response. */
    async pay(orderId: string, status = "captured") {
      const id = `pay_${tag}${++n}`;
      payments.set(id, { id, order_id: orderId, amount: orders.get(orderId)!, status, method: "upi" });
      return { razorpay_order_id: orderId, razorpay_payment_id: id, razorpay_signature: await hmacSha256Hex("test_key_secret", `${orderId}|${id}`) };
    },
    payment: (id: string) => payments.get(id)!,
  };
}

export async function webhook(event: string, payload: unknown, eventId: string, secret = "test_webhook_secret") {
  const raw = JSON.stringify({ event, payload, created_at: Date.now() });
  return req("POST", "/hooks/razorpay", raw, { "x-razorpay-signature": await hmacSha256Hex(secret, raw), "x-razorpay-event-id": eventId });
}

export const guest = { name: "Test Client", phone: "98765 43210", email: "client@example.com" };
