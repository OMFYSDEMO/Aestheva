import { POLICY } from "../config";
import type { IstNow } from "./time";
import { daysBetween } from "./time";

export const SLOT_MIN = 30;

/** The 30-minute inventory slots a booking occupies. */
export function slotsFor(startMin: number, durMin: number): number[] {
  const first = Math.floor(startMin / SLOT_MIN), n = Math.ceil(durMin / SLOT_MIN);
  return Array.from({ length: n }, (_, i) => first + i);
}

export interface Hours { start_min: number; end_min: number }

/**
 * Start times (minutes after midnight, IST) at which a staff member can begin a service on a date.
 * Starts sit on the 30-minute grid inside the rota, the whole service must finish by the end of the rota,
 * every slot it covers must be free, and today's starts must be at least the lead time away.
 */
export function freeStarts(opts: { date: string; hours: Hours | null | undefined; durMin: number; occupied: Set<number>; now: IstNow; leadMin?: number; windowDays?: number }): number[] {
  const { date, hours, durMin, occupied, now } = opts;
  if (!hours) return [];
  const ahead = daysBetween(now.date, date);
  if (ahead < 0 || ahead > (opts.windowDays ?? POLICY.windowDays)) return [];
  const earliest = ahead === 0 ? now.min + (opts.leadMin ?? POLICY.leadMinutes) : -1;
  const out: number[] = [];
  for (let t = Math.ceil(hours.start_min / SLOT_MIN) * SLOT_MIN; t + durMin <= hours.end_min; t += SLOT_MIN) {
    if (t < earliest) continue;
    if (slotsFor(t, durMin).some((s) => occupied.has(s))) continue;
    out.push(t);
  }
  return out;
}
