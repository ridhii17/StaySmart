const APP_TIME_ZONE = "Asia/Kolkata";

function parseDateOnly(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value ? parsed : null;
}

function todayDateOnly() {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: APP_TIME_ZONE }).format(new Date());
  return parseDateOnly(today);
}

module.exports = { APP_TIME_ZONE, parseDateOnly, todayDateOnly };
