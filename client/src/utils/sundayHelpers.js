/**
 * Day-centric utility functions for finance application
 * Supports Sunday (0) and Thursday (4) collection days
 * All original Sunday functions preserved for backward compatibility
 */

const DAY_NAMES = { 0: 'Sunday', 4: 'Thursday' };

/**
 * Generic: Get the next occurrence of a specific day from a given date
 * @param {Date|string} date - Input date
 * @param {number} dayOfWeek - Target day (0=Sunday, 4=Thursday)
 * @returns {Date}
 */
export function getNextDay(date = new Date(), dayOfWeek = 0) {
  const d = new Date(date);
  const day = d.getDay();
  const daysUntil = day === dayOfWeek ? 7 : ((dayOfWeek - day + 7) % 7);
  d.setDate(d.getDate() + daysUntil);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Generic: Get the previous occurrence of a specific day
 * @param {Date|string} date - Input date
 * @param {number} dayOfWeek - Target day (0=Sunday, 4=Thursday)
 * @returns {Date}
 */
export function getPreviousDay(date = new Date(), dayOfWeek = 0) {
  const d = new Date(date);
  const day = d.getDay();
  const daysSince = day === dayOfWeek ? 7 : ((day - dayOfWeek + 7) % 7);
  d.setDate(d.getDate() - daysSince);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Generic: Get this week's target day (today if it matches, or last occurrence)
 * @param {number} dayOfWeek - Target day (0=Sunday, 4=Thursday)
 * @returns {Date}
 */
export function getThisDay(dayOfWeek = 0) {
  const today = new Date();
  const day = today.getDay();

  if (day === dayOfWeek) {
    today.setHours(0, 0, 0, 0);
    return today;
  }

  return getPreviousDay(today, dayOfWeek);
}

/**
 * Generic: Get last occurrence (always previous, even if today matches)
 * @param {number} dayOfWeek - Target day (0=Sunday, 4=Thursday)
 * @returns {Date}
 */
export function getLastDay(dayOfWeek = 0) {
  const today = new Date();
  const day = today.getDay();
  const daysToSubtract = day === dayOfWeek ? 7 : ((day - dayOfWeek + 7) % 7);
  today.setDate(today.getDate() - daysToSubtract);
  today.setHours(0, 0, 0, 0);
  return today;
}

/**
 * Generic: Check if a given date falls on the target day
 * @param {Date|string} date - Date to check
 * @param {number} dayOfWeek - Target day (0=Sunday, 4=Thursday)
 * @returns {boolean}
 */
export function isTargetDay(date, dayOfWeek = 0) {
  const d = new Date(date);
  return d.getDay() === dayOfWeek;
}

/**
 * Generic: Get the next N occurrences of a specific day
 * @param {number} count - Number of days to get
 * @param {number} dayOfWeek - Target day (0=Sunday, 4=Thursday)
 * @returns {Array<Date>}
 */
export function getUpcomingDays(count = 4, dayOfWeek = 0) {
  const days = [];
  let current = getNextDay(new Date(), dayOfWeek);

  for (let i = 0; i < count; i++) {
    days.push(new Date(current));
    current.setDate(current.getDate() + 7);
  }

  return days;
}

/**
 * Generic: Get all occurrences of a day between two dates
 * @param {Date|string} startDate
 * @param {Date|string} endDate
 * @param {number} dayOfWeek - Target day (0=Sunday, 4=Thursday)
 * @returns {Array<Date>}
 */
export function getDaysInRange(startDate, endDate, dayOfWeek = 0) {
  const days = [];
  let currentDate = new Date(startDate);
  const end = new Date(endDate);

  if (!isTargetDay(currentDate, dayOfWeek)) {
    currentDate = getNextDay(currentDate, dayOfWeek);
  }

  while (currentDate <= end) {
    days.push(new Date(currentDate));
    currentDate.setDate(currentDate.getDate() + 7);
  }

  return days;
}

/**
 * Generic: Check if a target day is in the past
 * @param {Date|string} date
 * @param {number} dayOfWeek - Target day (0=Sunday, 4=Thursday)
 * @returns {boolean}
 */
export function isPastDay(date, dayOfWeek = 0) {
  const thisDay = getThisDay(dayOfWeek);
  const checkDate = new Date(date);
  checkDate.setHours(0, 0, 0, 0);
  return checkDate < thisDay;
}

/**
 * Generic: Get relative day label (This Thursday, Last Sunday, etc.)
 * @param {Date|string} date
 * @param {number} dayOfWeek - Target day (0=Sunday, 4=Thursday)
 * @returns {string}
 */
export function getRelativeDayLabel(date, dayOfWeek = 0) {
  const checkDate = new Date(date);
  checkDate.setHours(0, 0, 0, 0);
  const dayName = DAY_NAMES[dayOfWeek] || 'Day';

  const thisDay = getThisDay(dayOfWeek);
  const lastDay = getLastDay(dayOfWeek);
  const nextDay = getNextDay(new Date(), dayOfWeek);

  if (checkDate.getTime() === thisDay.getTime()) {
    return `This ${dayName}`;
  } else if (checkDate.getTime() === lastDay.getTime()) {
    return `Last ${dayName}`;
  } else if (checkDate.getTime() === nextDay.getTime()) {
    return `Next ${dayName}`;
  }

  return formatSundayDisplay(checkDate);
}

/**
 * Helper: Convert collection_day string to dayOfWeek number
 * @param {string} collectionDay - 'Sunday' or 'Thursday'
 * @returns {number} - 0 for Sunday, 4 for Thursday
 */
export function collectionDayToNumber(collectionDay) {
  return collectionDay === 'Thursday' ? 4 : 0;
}

// ============ BACKWARD-COMPATIBLE SUNDAY FUNCTIONS ============

export function getNextSunday(date = new Date()) {
  return getNextDay(date, 0);
}

export function getPreviousSunday(date = new Date()) {
  return getPreviousDay(date, 0);
}

export function getThisSunday() {
  return getThisDay(0);
}

export function getLastSunday() {
  return getLastDay(0);
}

export function isSunday(date) {
  return isTargetDay(date, 0);
}

export function getSundaysInRange(startDate, endDate) {
  return getDaysInRange(startDate, endDate, 0);
}

export function getUpcomingSundays(count = 4) {
  return getUpcomingDays(count, 0);
}

export function isPastSunday(sunday) {
  return isPastDay(sunday, 0);
}

export function getRelativeSundayLabel(sunday) {
  return getRelativeDayLabel(sunday, 0);
}

// ============ THURSDAY CONVENIENCE FUNCTIONS ============

export function getNextThursday(date = new Date()) {
  return getNextDay(date, 4);
}

export function getPreviousThursday(date = new Date()) {
  return getPreviousDay(date, 4);
}

export function getThisThursday() {
  return getThisDay(4);
}

export function isThursday(date) {
  return isTargetDay(date, 4);
}

// ============ DAY-AGNOSTIC FUNCTIONS (no changes needed) ============

export function generatePaymentSchedule(loanStartDay, totalWeeks = 10) {
  const startDate = new Date(loanStartDay);
  const schedule = [];

  for (let week = 1; week <= totalWeeks; week++) {
    const paymentDate = new Date(startDate);
    paymentDate.setDate(startDate.getDate() + (week * 7));
    schedule.push({
      weekNumber: week,
      paymentDate: paymentDate,
      paymentDateStr: formatDateForAPI(paymentDate)
    });
  }

  return schedule;
}

export function formatSundayDisplay(date, weekNumber = null) {
  const d = new Date(date);
  const options = { month: 'short', day: 'numeric', year: 'numeric' };
  const formatted = d.toLocaleDateString('en-US', options);

  if (weekNumber !== null) {
    return `${formatted} (Week ${weekNumber})`;
  }

  return formatted;
}

export function formatDateForAPI(date) {
  const d = new Date(date);
  return d.toISOString().split('T')[0];
}

export function formatDateForDisplay(date) {
  const d = new Date(date);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

export function getWeekNumber(loanStartDay, paymentDay) {
  const startDate = new Date(loanStartDay);
  const paymentDate = new Date(paymentDay);

  const diffTime = paymentDate - startDate;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  const weekNumber = Math.ceil(diffDays / 7);

  return weekNumber;
}

export function calculateCompletionDate(loanStartDay, totalWeeks) {
  const startDate = new Date(loanStartDay);
  const completionDate = new Date(startDate);
  completionDate.setDate(startDate.getDate() + (totalWeeks * 7));
  return completionDate;
}

export function isToday(date) {
  const today = new Date();
  const checkDate = new Date(date);

  return (
    today.getFullYear() === checkDate.getFullYear() &&
    today.getMonth() === checkDate.getMonth() &&
    today.getDate() === checkDate.getDate()
  );
}
