import { AppError, EXIT } from "./errors.js";

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatter(timezone: string): Intl.DateTimeFormat {
  let result = formatters.get(timezone);
  if (!result) {
    result = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    });
    if (formatters.size >= 32) formatters.clear();
    formatters.set(timezone, result);
  }
  return result;
}

export function dayKey(date: Date, timezone: string): string {
  const parts = formatter(timezone).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes): string => {
    const part = parts.find((item) => item.type === type);
    if (!part) throw new AppError("CLOCK_ERROR", `Cannot format timezone ${timezone}`, EXIT.FAILURE);
    return part.value;
  };
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/** First instant of the next local calendar day, including DST transitions. */
export function nextReset(date: Date, timezone: string): Date {
  const current = dayKey(date, timezone);
  let low = date.getTime();
  let high = low + 72 * 60 * 60 * 1_000;
  if (dayKey(new Date(high), timezone) === current) {
    throw new AppError("CLOCK_ERROR", `Cannot find the next day in ${timezone}`, EXIT.FAILURE);
  }
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (dayKey(new Date(middle), timezone) === current) low = middle + 1;
    else high = middle;
  }
  return new Date(low);
}
