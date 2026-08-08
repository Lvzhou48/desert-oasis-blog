const SHANGHAI_OFFSET_MILLISECONDS = 8 * 60 * 60 * 1000;
const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIMEZONE_DATETIME = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,9}))?)?(Z|([+-])(\d{2}):(\d{2}))$/i;

function isLeapYear(year: number) {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

function daysInMonth(year: number, month: number) {
  if (month === 2) return isLeapYear(year) ? 29 : 28;
  if ([4, 6, 9, 11].includes(month)) return 30;
  return month >= 1 && month <= 12 ? 31 : 0;
}

function isValidContentYear(year: number) {
  return year >= 1900 && year <= 9999;
}

function isValidCalendarDate(year: number, month: number, day: number) {
  return isValidContentYear(year) && day >= 1 && day <= daysInMonth(year, month);
}

export function parseContentDate(value: unknown): Date {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) throw new TypeError('Expected a valid date');
    return value;
  }

  if (typeof value === 'string') {
    const dateOnly = DATE_ONLY.exec(value);
    if (dateOnly) {
      const [, yearText, monthText, dayText] = dateOnly;
      const year = Number(yearText);
      const month = Number(monthText);
      const day = Number(dayText);
      if (!isValidCalendarDate(year, month, day)) throw new TypeError('Expected a valid date');
      const instant = new Date(Date.UTC(year, month - 1, day) - SHANGHAI_OFFSET_MILLISECONDS);
      const local = new Date(instant.getTime() + SHANGHAI_OFFSET_MILLISECONDS);
      if (local.getUTCFullYear() !== year || local.getUTCMonth() !== month - 1 || local.getUTCDate() !== day) {
        throw new TypeError('Expected a valid date');
      }
      return instant;
    }
  }

  if (typeof value !== 'string') throw new TypeError('Expected a valid date');
  const datetime = TIMEZONE_DATETIME.exec(value);
  if (!datetime) throw new TypeError('Expected a valid date');
  const [, yearText, monthText, dayText, hourText, minuteText, secondText, , zone, , offsetHourText, offsetMinuteText] = datetime;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const second = secondText === undefined ? 0 : Number(secondText);
  if (!isValidCalendarDate(year, month, day) || hour > 23 || minute > 59 || second > 59) {
    throw new TypeError('Expected a valid date');
  }
  if (zone.toUpperCase() !== 'Z') {
    const offsetHour = Number(offsetHourText);
    const offsetMinute = Number(offsetMinuteText);
    if (offsetHour > 14 || offsetMinute > 59 || (offsetHour === 14 && offsetMinute !== 0)) {
      throw new TypeError('Expected a valid date');
    }
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) throw new TypeError('Expected a valid date');
  return parsed;
}
