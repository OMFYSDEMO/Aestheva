import type { Env } from "../env";
import { HttpError, hmacSha256Hex, newId, safeEqual } from "../db";

export interface GatewayPayment { id: string; order_id: string; amount: number; status: string; method: string | null }
export interface GatewayRefund { id: string; status: "pending" | "processed" | "failed" }

/** What the booking flow needs from a payment gateway. Amounts are paise. */
export interface Gateway {
  kind: "razorpay" | "simulated";
  keyId: string;
  createOrder(amount: number, receipt: string, notes: Record<string, string>): Promise<{ id: string }>;
  verifyCheckout(orderId: string, paymentId: string, signature: string): Promise<boolean>;
  fetchPayment(paymentId: string): Promise<GatewayPayment>;
  capture(paymentId: string, amount: number): Promise<GatewayPayment>;
  refund(paymentId: string, amount: number, notes: Record<string, string>): Promise<GatewayRefund>;
}

const API = "https://api.razorpay.com/v1";

export class RazorpayGateway implements Gateway {
  kind = "razorpay" as const;
  constructor(public keyId: string, private keySecret: string, private fetchImpl: typeof fetch = (i, init) => fetch(i, init)) {}

  private async call<T>(method: string, path: string, body?: unknown): Promise<T> {
    const res = await this.fetchImpl(API + path, {
      method,
      headers: { authorization: "Basic " + btoa(`${this.keyId}:${this.keySecret}`), "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    let json: any; try { json = JSON.parse(text); } catch { json = { raw: text }; }
    if (!res.ok) {
      const desc = json?.error?.description || json?.error?.code || `HTTP ${res.status}`;
      throw new HttpError(502, `Razorpay: ${desc}`, { path, status: res.status });
    }
    return json as T;
  }

  async createOrder(amount: number, receipt: string, notes: Record<string, string>) {
    const o = await this.call<{ id: string }>("POST", "/orders", { amount, currency: "INR", receipt: receipt.slice(0, 40), notes });
    return { id: o.id };
  }
  // Razorpay Checkout returns signature = HMAC-SHA256(order_id + "|" + payment_id, key_secret).
  async verifyCheckout(orderId: string, paymentId: string, signature: string) {
    return safeEqual(await hmacSha256Hex(this.keySecret, `${orderId}|${paymentId}`), String(signature || ""));
  }
  async fetchPayment(paymentId: string) {
    const p = await this.call<any>("GET", `/payments/${encodeURIComponent(paymentId)}`);
    return { id: p.id, order_id: p.order_id, amount: p.amount, status: p.status, method: p.method ?? null };
  }
  async capture(paymentId: string, amount: number) {
    const p = await this.call<any>("POST", `/payments/${encodeURIComponent(paymentId)}/capture`, { amount, currency: "INR" });
    return { id: p.id, order_id: p.order_id, amount: p.amount, status: p.status, method: p.method ?? null };
  }
  async refund(paymentId: string, amount: number, notes: Record<string, string>) {
    const r = await this.call<any>("POST", `/payments/${encodeURIComponent(paymentId)}/refund`, { amount, speed: "normal", notes });
    return { id: r.id, status: (r.status === "processed" ? "processed" : r.status === "failed" ? "failed" : "pending") as GatewayRefund["status"] };
  }
}

/** Stand-in used in development and tests when no Razorpay keys are configured. Never used in production. */
export class SimulatedGateway implements Gateway {
  kind = "simulated" as const;
  keyId = "simulated";
  orders = new Map<string, number>();
  async createOrder(amount: number) { const id = newId("sim_order"); this.orders.set(id, amount); return { id }; }
  async verifyCheckout(orderId: string, paymentId: string, signature: string) { return signature === `sim:${orderId}|${paymentId}`; }
  async fetchPayment(paymentId: string) { return { id: paymentId, order_id: "", amount: 0, status: "captured", method: "upi" }; }
  async capture(paymentId: string, amount: number) { return { id: paymentId, order_id: "", amount, status: "captured", method: "upi" }; }
  async refund() { return { id: newId("sim_rfnd"), status: "processed" as const }; }
}

let override: Gateway | null = null;
/** Tests replace the gateway so no network call leaves the Worker. */
export function setGatewayForTests(g: Gateway | null) { override = g; }

const simulated = new SimulatedGateway();
export function gatewayFor(env: Env): Gateway {
  if (override) return override;
  if (env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET) return new RazorpayGateway(env.RAZORPAY_KEY_ID, env.RAZORPAY_KEY_SECRET);
  if (env.APP_ENV === "production") throw new HttpError(503, "Online payments are not configured yet");
  return simulated;
}

/** True when a request carries the preview key, which lets draft venues be viewed and booked. */
export function previewAllowed(env: Env, key: unknown): boolean {
  return !!env.PREVIEW_KEY && typeof key === "string" && key.length > 0 && safeEqual(key, env.PREVIEW_KEY);
}

/** Which payments are active: shown on /api/health and used for the test-mode notice. */
export function paymentMode(env: Env): "live" | "test" | "simulated" | "off" {
  if (env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET) return env.RAZORPAY_KEY_ID.startsWith("rzp_live_") ? "live" : "test";
  return env.APP_ENV === "production" ? "off" : "simulated";
}

/** Webhook signature = HMAC-SHA256(raw body, webhook secret), hex, in the X-Razorpay-Signature header. */
export async function verifyWebhook(env: Env, rawBody: string, signature: string | null): Promise<boolean> {
  if (!env.RAZORPAY_WEBHOOK_SECRET || !signature) return false;
  return safeEqual(await hmacSha256Hex(env.RAZORPAY_WEBHOOK_SECRET, rawBody), signature);
}
