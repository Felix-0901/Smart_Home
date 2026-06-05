export type RangeMode = "24h" | "7d" | "custom";

export function getRangeStart(mode: RangeMode) {
  const now = Date.now();

  if (mode === "24h") {
    return new Date(now - 24 * 60 * 60 * 1000).toISOString();
  }

  if (mode === "7d") {
    return new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();
  }

  return undefined;
}

export function toDateTimeInputValue(date: Date) {
  const offsetMs = date.getTimezoneOffset() * 60 * 1000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

export function fromDateTimeInputValue(value: string) {
  if (!value.trim()) {
    return undefined;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}
