// Business Date Utilities - Centralized date handling with timezone support
// Replaces scattered new Date() calls throughout the codebase

const DEFAULT_TIMEZONE = 'America/Argentina/Buenos_Aires';

let currentTimezone = DEFAULT_TIMEZONE;

export function setBusinessTimezone(timezone) {
  currentTimezone = timezone;
}

export function getBusinessTimezone() {
  return currentTimezone;
}

export function businessDate(timezone = null) {
  const tz = timezone || currentTimezone;
  const now = new Date();
  const options = { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' };
  const formatter = new Intl.DateTimeFormat('en-CA', options);
  const parts = formatter.formatToParts(now);
  const dateObj = {};
  parts.forEach((p) => {
    if (p.type !== 'literal') dateObj[p.type] = parseInt(p.value, 10);
  });
  return new Date(dateObj.year, dateObj.month - 1, dateObj.day);
}

export function businessDateString(timezone = null) {
  return formatDateISO(businessDate(timezone));
}

export function formatDateISO(date) {
  if (!date || !(date instanceof Date) || isNaN(date.getTime())) {
    return null;
  }
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function parseDate(dateStr, timezone = null) {
  if (!dateStr) return null;
  const date = new Date(dateStr);
  return isNaN(date.getTime()) ? null : date;
}

export function addDays(date, days) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

export function addMonths(date, months) {
  const result = new Date(date);
  result.setMonth(result.getMonth() + months);
  return result;
}

export function addYears(date, years) {
  const result = new Date(date);
  result.setFullYear(result.getFullYear() + years);
  return result;
}

export function diffDays(date1, date2) {
  const oneDay = 24 * 60 * 60 * 1000;
  const d1 = new Date(date1).setHours(0, 0, 0, 0);
  const d2 = new Date(date2).setHours(0, 0, 0, 0);
  return Math.round((d1 - d2) / oneDay);
}

export function isSameDay(date1, date2) {
  return formatDateISO(date1) === formatDateISO(date2);
}

export function isToday(date, timezone = null) {
  return isSameDay(date, businessDate(timezone));
}

export function isBefore(date1, date2) {
  return formatDateISO(date1) < formatDateISO(date2);
}

export function isAfter(date1, date2) {
  return formatDateISO(date1) > formatDateISO(date2);
}

export function isBetween(date, start, end) {
  const d = formatDateISO(date);
  return d >= formatDateISO(start) && d <= formatDateISO(end);
}

export function getDaysUntil(date) {
  return diffDays(date, businessDate());
}

export function isExpiringSoon(date, daysThreshold = 7) {
  const days = getDaysUntil(date);
  return days >= 0 && days <= daysThreshold;
}

export function isExpired(date) {
  return isBefore(date, businessDate());
}

export function toLocaleDateString(date, locale = 'es-AR', options = {}, timezone = null) {
  const tz = timezone || currentTimezone;
  const defaultOptions = { timeZone: tz, day: '2-digit', month: '2-digit', year: 'numeric' };
  return new Date(date).toLocaleDateString(locale, { ...defaultOptions, ...options });
}

export function startOfWeek(date, timezone = null) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.setDate(diff));
}

export function endOfWeek(date, timezone = null) {
  const start = startOfWeek(date);
  return addDays(start, 6);
}

export function startOfMonth(date, timezone = null) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function endOfMonth(date, timezone = null) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

export const businessDateUtils = {
  setTimezone: setBusinessTimezone,
  getTimezone: getBusinessTimezone,
  today: businessDate,
  todayISO: businessDateString,
  parse: parseDate,
  addDays,
  addMonths,
  addYears,
  diffDays,
  isSameDay,
  isToday,
  isBefore,
  isAfter,
  isBetween,
  getDaysUntil,
  isExpiringSoon,
  isExpired,
  format: toLocaleDateString,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth
};

export default businessDateUtils;
