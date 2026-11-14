import { env, createExecutionContext, waitOnExecutionContext } from "cloudflare:test";
import { beforeAll, describe, expect, it } from "vitest";
import { app } from "../src/index";
import { seed, sql } from "./helpers";

beforeAll(seed);

async function send(method: string, path: string, form?: Record<string, string> | FormData, cookie?: string) {
  const body = form instanceof FormData ? form : form ? new URLSearchParams(form).toString() : undefined;
  const ctx = createExecutionContext();
  const res = await app.fetch(new Request(`https://aestheva.test${path}`, {
    method, redirect: "manual", body,
    headers: { ...(body && !(form instanceof FormData) ? { "content-type": "application/x-www-form-urlencoded" } : {}), ...(cookie ? { cookie } : {}), "cf-connecting-ip": "198.51.100.90" },
  }), env, ctx);
  await waitOnExecutionContext(ctx);
  return { status: res.status, text: await res.text(), headers: res.headers };
}
const csrfIn = (html: string) => /name="csrf" value="([0-9a-f]{64})"/.exec(html)![1];
const cookieOf = (r: { headers: Headers }) => r.headers.get("set-cookie")!.split(";")[0];
const linkIn = (text: string) => /https:\/\/aestheva\.test(\/leadership\/set-password\?t=[A-Za-z0-9_-]+)/.exec(text)![1];
const tokenOf = (path: string) => new URL("https://x" + path).searchParams.get("t")!;

type Sent = { to: string; subject: string; text: string };
let sent: Sent[] = [];
let ops = "", opsCsrf = "", shaji = "", greeshma = "", sCsrf = "", gCsrf = "";
const pw = { s: "kovalam lighthouse at dawn", g: "coorg coffee after rain" };
const pdf = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34, 0x0a, 0x25, 0x25, 0x45, 0x4f, 0x46]);

async function signIn(email: string, password: string) {
  const r = await send("POST", "/leadership/login", { email, password });
  expect(r.status).toBe(303);
  return cookieOf(r);
}

describe("leadership record", () => {
  beforeAll(async () => {
    (env as { EMAIL: unknown }).EMAIL = { send: async (m: Sent) => { sent.push(m); return { messageId: "m" }; } };
    ops = cookieOf(await send("POST", "/ops/login", { key: "test-ops-key" }));
    opsCsrf = csrfIn((await send("GET", "/ops/leadership", undefined, ops)).text);
  });

  it("is closed to anyone without a leader's own login, including the team key", async () => {
    for (const p of ["/leadership", "/leadership/agreements", "/leadership/new", "/leadership/print", "/leadership/record.csv", "/leadership/entries/1"]) {
      const r = await send("GET", p, undefined, ops);
      expect(r.status).toBe(303);
      expect(r.headers.get("location")).toBe("/leadership/login");
    }
    const page = (await send("GET", "/ops/leadership", undefined, ops)).text;
    expect(page).toContain("the team key gives no access to it");
    expect(page).not.toContain("The record</a>");
  });

  it("gives leaders logins from the team area, and records every change of access", async () => {
    expect((await send("POST", "/ops/leadership", { csrf: opsCsrf, name: "Shaji Anandan", role: "Managing Director", email: "Shaji@example.com" }, ops)).status).toBe(303);
    expect((await send("POST", "/ops/leadership", { csrf: opsCsrf, name: "Greeshma Achaiah", role: "Chief Executive Officer", email: "greeshma@example.com" }, ops)).status).toBe(303);
    expect((await send("POST", "/ops/leadership", { csrf: opsCsrf, name: "Someone", role: "Director", email: "shaji@example.com" }, ops)).status).toBe(409);
    const rows = await sql("SELECT seq, kind, title FROM leader_entries ORDER BY seq");
    expect(rows.map((r) => r.kind)).toEqual(["opened", "access", "access"]);
    expect(rows[2].title).toContain("Greeshma Achaiah, Chief Executive Officer");

    for (const [email, password] of [["shaji@example.com", pw.s], ["greeshma@example.com", pw.g]]) {
      const id = (await sql("SELECT id FROM leaders WHERE email = ?", email))[0].id;
      sent = [];
      expect((await send("POST", `/ops/leadership/${id}/invite`, { csrf: opsCsrf }, ops)).status).toBe(303);
      const link = linkIn(sent.find((m) => m.to === email)!.text);
      expect((await send("POST", "/leadership/set-password", { t: tokenOf(link), password, confirm: password })).headers.get("location")).toBe("/leadership/login?set=1");
    }
    shaji = await signIn("shaji@example.com", pw.s);
    greeshma = await signIn("greeshma@example.com", pw.g);
    const home = await send("GET", "/leadership", undefined, shaji);
    expect(home.text).toContain("Record intact.");
    expect(home.text).toContain("Leadership record opened");
    sCsrf = csrfIn(home.text);
    gCsrf = csrfIn((await send("GET", "/leadership", undefined, greeshma)).text);
  });

  it("adds an agreement with a file, emails both leaders a copy, and keeps the file's fingerprint", async () => {
    sent = [];
    const fd = new FormData();
    for (const [k, v] of Object.entries({ csrf: sCsrf, kind: "agreement", occurred_on: "2026-11-11", channel: "Document", title: "12-month plan agreed in principle", body: "We agree the 12-month plan dated 11 November 2026, built on Greeshma's roadmap." })) fd.append(k, v);
    fd.append("files", new File([pdf], "12-month plan.pdf", { type: "application/pdf" }));
    const r = await send("POST", "/leadership/new", fd, shaji);
    expect(r.status).toBe(303);
    expect(r.headers.get("location")).toBe("/leadership/entries/4?done=1");
    const [e] = await sql("SELECT * FROM leader_entries WHERE seq = 4");
    expect(e.author_name).toBe("Shaji Anandan (Managing Director)");
    expect(e.occurred_on).toBe("2026-11-11");
    const files = JSON.parse(e.files_json);
    expect(files[0].sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(sent.map((m) => m.to).sort()).toEqual(["greeshma@example.com", "shaji@example.com"]);
    expect(sent[0].subject).toBe("Leadership record #4: 12-month plan agreed in principle");
    expect(sent[0].text).toContain(e.hash);

    const file = await send("GET", "/leadership/files/4/1", undefined, greeshma);
    expect(file.status).toBe(200);
    expect(file.headers.get("content-disposition")).toContain("12-month plan.pdf");
    expect((await send("GET", "/leadership/agreements", undefined, greeshma)).text).toContain("Waiting for Greeshma Achaiah");
  });

  it("refuses files that aren't documents, photos or emails", async () => {
    const fd = new FormData();
    for (const [k, v] of Object.entries({ csrf: sCsrf, kind: "note", occurred_on: "2026-11-12", title: "A program" })) fd.append(k, v);
    fd.append("files", new File([new Uint8Array([0x4d, 0x5a, 0x90, 0x00])], "tool.exe"));
    const r = await send("POST", "/leadership/new", fd, shaji);
    expect(r.status).toBe(400);
    expect(r.text).toContain("please attach a PDF");
    expect(await sql("SELECT seq FROM leader_entries WHERE seq = 5")).toHaveLength(0);
  });

  it("lets the other leader confirm or dispute, never the author", async () => {
    expect((await send("POST", "/leadership/entries/4/respond", { csrf: sCsrf, answer: "confirm" }, shaji)).status).toBe(400);
    expect((await send("GET", "/leadership/entries/4", undefined, shaji)).text).not.toContain("Confirm or dispute this entry");
    const page = (await send("GET", "/leadership/entries/4", undefined, greeshma)).text;
    expect(page).toContain("Confirm or dispute this entry");
    const noReason = await send("POST", "/leadership/entries/4/respond", { csrf: gCsrf, answer: "dispute", comment: "" }, greeshma);
    expect(noReason.status).toBe(400);
    expect((await send("POST", "/leadership/entries/4/respond", { csrf: gCsrf, answer: "confirm", comment: "Agreed." }, greeshma)).status).toBe(303);
    const [c] = await sql("SELECT kind, refers_to, author_name FROM leader_entries WHERE seq = 5");
    expect(c).toMatchObject({ kind: "confirm", refers_to: 4, author_name: "Greeshma Achaiah (Chief Executive Officer)" });
    expect((await send("GET", "/leadership/agreements", undefined, shaji)).text).toContain("Agreed · confirmed");
  });

  it("needs the earlier entry's number for a correction or a new version, and marks the old version replaced", async () => {
    const bad = await send("POST", "/leadership/new", { csrf: gCsrf, kind: "revision", occurred_on: "2026-11-13", title: "Plan, version 2" }, greeshma);
    expect(bad.status).toBe(400);
    expect(bad.text).toContain("number of the earlier entry");
    const future = await send("POST", "/leadership/new", { csrf: gCsrf, kind: "note", occurred_on: "2099-01-01", title: "From the future" }, greeshma);
    expect(future.status).toBe(400);
    expect((await send("POST", "/leadership/new", { csrf: gCsrf, kind: "revision", occurred_on: "2026-11-13", channel: "Email", title: "12-month plan, version 2", refers_to: "#4", body: "Kochi moves to months 5 to 7." }, greeshma)).status).toBe(303);
    const agreements = (await send("GET", "/leadership/agreements", undefined, shaji)).text;
    expect(agreements).toContain("Replaced by #6");
    expect(agreements).toContain("Waiting for Shaji Anandan");
  });

  it("can't be changed or deleted, even directly in the database", async () => {
    await expect(env.DB.prepare("UPDATE leader_entries SET title = 'Something else' WHERE seq = 4").run()).rejects.toThrow(/append-only/);
    await expect(env.DB.prepare("DELETE FROM leader_entries WHERE seq = 5").run()).rejects.toThrow(/append-only/);
  });

  it("exports and prints the whole record with fingerprints", async () => {
    const csv = await send("GET", "/leadership/record.csv", undefined, greeshma);
    expect(csv.headers.get("content-type")).toContain("text/csv");
    expect(csv.text).toContain("12-month plan agreed in principle");
    expect(csv.text.trim().split("\n")).toHaveLength(7);
    const print = (await send("GET", "/leadership/print", undefined, greeshma)).text;
    expect(print).toContain("The complete record");
    expect(print).toContain("Greeshma Achaiah (Chief Executive Officer)");
  });

  it("ends a leader's session when their login is turned off, and records it", async () => {
    const id = (await sql("SELECT id FROM leaders WHERE email = 'greeshma@example.com'"))[0].id;
    expect((await send("POST", `/ops/leadership/${id}/off`, { csrf: opsCsrf }, ops)).status).toBe(303);
    expect((await send("GET", "/leadership", undefined, greeshma)).status).toBe(303);
    expect((await sql("SELECT title FROM leader_entries ORDER BY seq DESC LIMIT 1"))[0].title).toBe("Access turned off: Greeshma Achaiah");
    await send("POST", `/ops/leadership/${id}/on`, { csrf: opsCsrf }, ops);
  });

  it("shows when an earlier entry has been tampered with", async () => {
    await env.DB.prepare("DROP TRIGGER leader_entries_no_update").run();
    await env.DB.prepare("UPDATE leader_entries SET body = 'We never agreed this.' WHERE seq = 4").run();
    const home = (await send("GET", "/leadership", undefined, shaji)).text;
    expect(home).toContain("The record does not check out from entry #4");
  });
});
