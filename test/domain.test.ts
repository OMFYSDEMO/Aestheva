import { describe, expect, it } from "vitest";
import { freeStarts, slotsFor } from "../src/domain/availability";
import { addDays, fmtTime, hoursUntil, istToUtc, nowIst } from "../src/domain/time";
import { inr } from "../src/domain/money";
import { normalisePhone } from "../src/services/bookings";

describe("time in IST", () => {
  it("reads the IST wall clock from a UTC instant", () => {
    expect(nowIst(new Date("2026-10-29T20:00:00Z"))).toEqual({ date: "2026-10-30", min: 90 });   // 01:30 IST next day
    expect(istToUtc("2026-10-30", 90).toISOString()).toBe("2026-10-29T20:00:00.000Z");
    expect(hoursUntil("2026-10-31", 600, new Date("2026-10-30T04:30:00Z"))).toBe(24);           // 10:00 IST to 10:00 IST
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(fmtTime(0)).toBe("12:00 am"); expect(fmtTime(750)).toBe("12:30 pm"); expect(fmtTime(1170)).toBe("7:30 pm");
  });
  it("formats rupees from paise with Indian grouping", () => {
    expect(inr(150000)).toBe("₹1,500"); expect(inr(12345678)).toBe("₹1,23,456.78");
  });
});

describe("availability", () => {
  const now = { date: "2026-11-02", min: 9 * 60 };
  const hours = { start_min: 600, end_min: 780 };   // 10:00 to 13:00
  it("covers a booking's duration in 30-minute slots", () => {
    expect(slotsFor(600, 30)).toEqual([20]); expect(slotsFor(600, 45)).toEqual([20, 21]); expect(slotsFor(600, 90)).toEqual([20, 21, 22]);
  });
  it("offers starts that finish inside the rota and avoid taken slots", () => {
    expect(freeStarts({ date: "2026-11-03", hours, durMin: 60, occupied: new Set(), now })).toEqual([600, 630, 660, 690, 720]);
    expect(freeStarts({ date: "2026-11-03", hours, durMin: 60, occupied: new Set([22]), now })).toEqual([600, 690, 720]);   // 11:00–11:30 taken
  });
  it("keeps today's starts at least the lead time away, and refuses the past and far future", () => {
    expect(freeStarts({ date: "2026-11-02", hours, durMin: 30, occupied: new Set(), now: { date: "2026-11-02", min: 620 } })).toEqual([690, 720, 750]);
    expect(freeStarts({ date: "2026-11-01", hours, durMin: 30, occupied: new Set(), now })).toEqual([]);
    expect(freeStarts({ date: "2027-02-01", hours, durMin: 30, occupied: new Set(), now })).toEqual([]);
    expect(freeStarts({ date: "2026-11-03", hours: null, durMin: 30, occupied: new Set(), now })).toEqual([]);
  });
});

describe("phone numbers", () => {
  it("normalises Indian mobiles to E.164 and rejects the rest", () => {
    for (const v of ["9876543210", "98765 43210", "+91 98765 43210", "09876543210", "919876543210"]) expect(normalisePhone(v)).toBe("+919876543210");
    for (const v of ["12345", "5876543210", "+44 7700 900123", ""]) expect(normalisePhone(v)).toBeNull();
  });
});
