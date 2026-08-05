// The backend stores and returns timestamps as naive UTC (no timezone suffix).
// We explicitly treat them as UTC here, then render everything in Asia/Karachi
// so times are correct and consistent regardless of the viewer's device settings.
const DISPLAY_TZ = "Asia/Karachi";

function parseAsUTC(dateTimeStr: string): Date {
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

export const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
