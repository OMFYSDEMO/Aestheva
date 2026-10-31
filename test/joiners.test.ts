import { env, createExecutionContext, waitOnExecutionContext } from "cloudflare:test";
import { beforeAll, describe, expect, it } from "vitest";
import { app } from "../src/index";
import { joinerRows } from "../src/services/joiners";
import { seed, sql } from "./helpers";

async function send(method: string, path: string, form?: Record<string, string>, cookie?: string) {
  const ctx = createExecutionContext();
  const res = await app.fetch(new Request(`https://aestheva.test${path}`, {
    method, redirect: "manual", body: form ? new URLSearchParams(form).toString() : undefined,
    headers: { ...(form ? { "content-type": "application/x-www-form-urlencoded" } : {}), ...(cookie ? { cookie } : {}) },
  }), env, ctx);
  await waitOnExecutionContext(ctx);
  return { status: res.status, text: await res.text(), headers: res.headers };
}
const csrfIn = (html: string) => /name="csrf" value="([0-9a-f]{64})"/.exec(html)![1];

describe("new joiners desk", () => {
  type Sent = { to: string; subject: string; text: string; html: string };
  const sent: Sent[] = [];
  let ops = "";

  beforeAll(async () => {
    await seed();
    (env as { EMAIL: unknown }).EMAIL = { send: async (m: Sent) => { sent.push(m); return { messageId: "m" }; } };
    ops = (await send("POST", "/ops/login", { key: "test-ops-key" })).headers.get("set-cookie")!.split(";")[0];
    // Two joiners: a salon that has started (signed in, details without a PAN, one photo), and a clinic that hasn't signed in.
    await sql(`INSERT INTO providers (id, slug, name, type, area, address, tagline, about, hours_text, phone, status, photos_json, created_at) VALUES
      ('j1', 'rose-salon', 'Rose Salon', 'Salon & studio', 'Pattom', 'Pattom 695004', 'Hair and makeup in Pattom', 'A friendly salon for hair, nails and makeup in Pattom.', 'Daily 10-7', '+919800000001', 'draft', '[{"src":"/x","alt":"x"}]', strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-1 days')),
      ('j2', 'smile-dental', 'Smile Dental', 'Clinic', 'Ulloor', 'Ulloor 695011', '', '', '', '+919800000002', 'draft', '[]', strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-5 days'))`);
    await sql(`INSERT INTO provider_users (id, provider_id, name, email, password_hash, last_login_at) VALUES
      ('pu_j1', 'j1', 'Rose Mary', 'rose@salon.example', 'pbkdf2-sha256$x', strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-2 hours')),
      ('pu_j2', 'j2', 'Dr Anil Kumar', 'anil@dental.example', 'unset$abc', NULL)`);
    await sql("INSERT INTO audit_log (actor, action, entity, entity_id, at) VALUES ('provider_user:pu_j1', 'listing.details', 'provider', 'j1', strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-2 hours'))");
  });

  it("lists every joiner with each step done or not, and flags the stuck", async () => {
    const rows = await joinerRows(env.DB);
    const rose = rows.find((r) => r.id === "j1")!, smile = rows.find((r) => r.id === "j2")!;
    expect(rose.steps.find((s) => s.key === "photos")!.done).toBe(true);
    expect(rose.steps.find((s) => s.key === "details")!.done).toBe(false);   // no PAN yet
    expect(rose.tasks.map((t) => t.key)).toEqual(["details", "team", "treatments", "documents", "terms"]);
    expect(rose.tasks[0].title).toBe("Add your PAN under Your business");
    expect(rose.stuck).toBe(false);
    expect(smile.tasks[0].key).toBe("signin");
    expect(smile.stuck).toBe(true);   // joined 5 days ago, nothing since
    expect(rows.indexOf(smile)).toBeLessThan(rows.indexOf(rose));   // the stuck come first
    expect(rows.some((r) => r.id === "p1")).toBe(false);   // live and complete: not a joiner

    const page = await send("GET", "/ops/joiners", undefined, ops);
    for (const t of ["New joiners", "Rose Salon", "Smile Dental", "Stuck", "Not signed in yet", "Email what's left"]) expect(page.text, t).toContain(t);
  });

  it("emails what's left in one click, with a fresh password link for anyone who hasn't set one", async () => {
    const page = await send("GET", "/ops/joiners", undefined, ops);
    const r = await send("POST", "/ops/joiners/j2/nudge", { csrf: csrfIn(page.text), note: "Welcome aboard, Dr Anil. Call us if anything is unclear." }, ops);
    expect(r.headers.get("location")).toBe("/ops/joiners?sent=1");
    const mail = sent.find((m) => m.to === "anil@dental.example")!;
    expect(mail.subject).toBe("Smile Dental: 7 steps left to go live on Aestheva");
    expect(mail.text).toMatch(/^Hello Anil,/);
    expect(mail.text).toContain("Welcome aboard, Dr Anil.");
    expect(mail.text).toContain("2. Fill in Your business");
    expect(mail.text).toMatch(/1\. Set your password and sign in\n.*\n   https:\/\/aestheva\.test\/clinic\/set-password\?t=[A-Za-z0-9_-]+/);
    expect(mail.text).toContain("council registration for each doctor or dentist");   // medical wording for a clinic
    expect((await sql("SELECT COUNT(*) AS n FROM password_links WHERE user_id = 'pu_j2'"))[0].n).toBe(1);
    expect((await sql("SELECT data_json FROM audit_log WHERE action = 'provider.nudged' AND entity_id = 'j2'"))[0].data_json).toContain('"sent":1');

    await send("POST", "/ops/joiners/j1/nudge", { csrf: csrfIn(page.text), note: "" }, ops);
    const rose = sent.find((m) => m.to === "rose@salon.example")!;
    expect(rose.text).not.toContain("set-password");   // already signed in
    expect(rose.text).toContain("credited against your PAN");
    expect(rose.text).toContain("training certificate or a portfolio");   // beauty wording
    expect((await send("GET", "/ops/joiners", undefined, ops)).text).toContain("Last reminder: just now");
  });
});
