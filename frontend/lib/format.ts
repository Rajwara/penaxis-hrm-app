import { AttendanceOutWithUser } from "./types";

const DISPLAY_TZ = "Asia/Karachi";

// The backend stores and returns timestamps as naive UTC (no timezone suffix).
// We explicitly treat them as UTC here, then render everything in Asia/Karachi
// so times are correct and consistent regardless of the viewer's device settings.
// Exported so other places doing time-math (not just display formatting) on
// these raw timestamps parse them the same correct way.
export function parseAsUTC(dateTimeStr: string): Date {
  const hasTzInfo = /[Zz]|[+-]\d{2}:?\d{2}$/.test(dateTimeStr);
  return new Date(hasTzInfo ? dateTimeStr : `${dateTimeStr}Z`);
}

export function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00Z");
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: DISPLAY_TZ,
  });
}

export function formatTime(dateTimeStr: string | null): string {
  if (!dateTimeStr) return "--:--";
  const d = parseAsUTC(dateTimeStr);
  return d.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: DISPLAY_TZ,
  });
}

export function formatDateTime(dateTimeStr: string | null): string {
  if (!dateTimeStr) return "-";
  const d = parseAsUTC(dateTimeStr);
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: DISPLAY_TZ,
  });
}

export function nowInKarachi(): Date {
  return new Date();
}

export function formatLiveClock(d: Date): string {
  return d.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZone: DISPLAY_TZ,
  });
}

export function formatLiveDate(d: Date): string {
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: DISPLAY_TZ,
  });
}

export function todayInKarachi(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: DISPLAY_TZ });
}

// Asia/Karachi (Pakistan Standard Time) is a fixed UTC+05:00 offset with no
// DST, so converting between Karachi wall-clock time and UTC is safe as
// simple fixed-hour arithmetic - no IANA tz database lookup needed.
const KARACHI_UTC_OFFSET_HOURS = 5;

function pad2(n: number): string {
  return n.toString().padStart(2, "0");
}

// Converts an admin-entered Asia/Karachi wall-clock date + time (from
// <input type="date">/<input type="time">, so "YYYY-MM-DD" / "HH:MM") into
// the naive-UTC datetime string the backend stores. Karachi is AHEAD of
// UTC, so this SUBTRACTS the offset - never add it here.
export function karachiLocalToNaiveUTC(dateStr: string, timeStr: string): string {
  const [year, month, day] = dateStr.split("-").map(Number);
  const [hour, minute] = timeStr.split(":").map(Number);
  const asIfUTC = Date.UTC(year, month - 1, day, hour, minute, 0);
  const utcInstant = new Date(asIfUTC - KARACHI_UTC_OFFSET_HOURS * 60 * 60 * 1000);
  return utcInstant.toISOString().slice(0, 19);
}

// Inverse of karachiLocalToNaiveUTC: given a stored naive-UTC datetime
// string, returns the Asia/Karachi wall-clock date/time as raw
// "YYYY-MM-DD" / "HH:MM" strings for pre-filling date/time <input> values.
// Uses the UTC accessors on the shifted Date (not the local get* ones,
// which would incorrectly apply the browser's own timezone on top).
export function naiveUTCToKarachiLocalParts(dateTimeStr: string): { date: string; time: string } {
  const utcInstant = parseAsUTC(dateTimeStr);
  const karachiShifted = new Date(utcInstant.getTime() + KARACHI_UTC_OFFSET_HOURS * 60 * 60 * 1000);
  const date = `${karachiShifted.getUTCFullYear()}-${pad2(karachiShifted.getUTCMonth() + 1)}-${pad2(karachiShifted.getUTCDate())}`;
  const time = `${pad2(karachiShifted.getUTCHours())}:${pad2(karachiShifted.getUTCMinutes())}`;
  return { date, time };
}

export function hoursWorked(checkIn: string | null, checkOut: string | null): string {
  if (!checkIn || !checkOut) return "-";
  const ms = parseAsUTC(checkOut).getTime() - parseAsUTC(checkIn).getTime();
  if (ms <= 0) return "-";
  const hrs = ms / (1000 * 60 * 60);
  return `${hrs.toFixed(1)}h`;
}

export interface AttendanceSessionGroup {
  user_id: number;
  date: string;
  user_name: string;
  user_department: string;
  sessions: AttendanceOutWithUser[];
  totalHours: string;
}

// The same employee can have multiple check-in/check-out sessions on the
// same date (e.g. a lunch break in between). Attendance tables show one row
// per employee per day rather than one row per session, so this collapses
// same user_id + date records into a group, sorted earliest-session-first,
// with a combined total (summing each session's own worked time, not the
// gap between the first check-in and the last check-out, so break time
// isn't counted as worked).
export function groupAttendanceSessions(records: AttendanceOutWithUser[]): AttendanceSessionGroup[] {
  const groups = new Map<string, AttendanceSessionGroup>();
  for (const r of records) {
    const key = `${r.user_id}|${r.date}`;
    let group = groups.get(key);
    if (!group) {
      group = {
        user_id: r.user_id,
        date: r.date,
        user_name: r.user_name,
        user_department: r.user_department,
        sessions: [],
        totalHours: "",
      };
      groups.set(key, group);
    }
    group.sessions.push(r);
  }

  const result = Array.from(groups.values());
  for (const group of result) {
    group.sessions.sort((a, b) => {
      if (!a.check_in) return 1;
      if (!b.check_in) return -1;
      return parseAsUTC(a.check_in).getTime() - parseAsUTC(b.check_in).getTime();
    });
    let totalMs = 0;
    for (const s of group.sessions) {
      if (s.check_in && s.check_out) {
        const ms = parseAsUTC(s.check_out).getTime() - parseAsUTC(s.check_in).getTime();
        if (ms > 0) totalMs += ms;
      }
    }
    group.totalHours = totalMs > 0 ? `${(totalMs / (1000 * 60 * 60)).toFixed(1)}h` : "-";
  }
  return result;
}

export const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
