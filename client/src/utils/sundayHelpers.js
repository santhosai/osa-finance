/**
 * Sunday-centric utility functions for finance application
 * All loans and payments operate on Sundays only
 */

/**
 * Get the next Sunday from a given date
 * @param {Date|string} date - Input date
 * @returns {Date} - Next Sunday
 */
export function getNextSunday(date = new Date()) {
  const d = new Date(date);
  const day = d.getDay();
  const daysUntilSunday = day === 0 ? 7 : 7 - day;
  d.setDate(d.getDate() + daysUntilSunday);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Get the previous Sunday from a given date
 * @param {Date|string} date - Input date
 * @returns {Date} - Previous Sunday
 */
export function getPreviousSunday(date = new Date()) {
  const d = new Date(date);
  const day = d.getDay();
  const daysSinceSunday = day === 0 ? 7 : day;
  d.setDate(d.getDate() - daysSinceSunday);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Get this week's Sunday (could be today if today is Sunday, or last Sunday)
 * @returns {Date} - This week's Sunday
 */
export function getThisSunday() {
  const today = new Date();
  const day = today.getDay();

  if (day === 0) {
    // Today is Sunday
    today.setHours(0, 0, 0, 0);
    return today;
  }

  // Return last Sunday
  return getPreviousSunday(today);
}

/**
 * Get last Sunday (always previous Sunday, even if today is Sunday)
 * @returns {Date} - Last Sunday
 */
export function getLastSunday() {
  const today = new Date();
  const day = today.getDay();
  const daysToSubtract = day === 0 ? 7 : day;
  today.setDate(today.getDate() - daysToSubtract);
  today.setHours(0, 0, 0, 0);
  return today;
}

/**
 * Check if a given date is a Sunday
 * @param {Date|string} date - Date to check
 * @returns {boolean} - True if Sunday
 */
export function isSunday(date) {
  const d = new Date(date);
  return d.getDay() === 0;
}

/**
 * Generate payment schedule for a loan starting on a Sunday
 * @param {Date|string} loanStartSunday - Loan disbursement Sunday
 * @param {number} totalWeeks - Total number of weeks (default 10)
 * @returns {Array} - Array of Sunday dates for payment schedule
 */
export function generatePaymentSchedule(loanStartSunday, totalWeeks = 10) {
  const startDate = new Date(loanStartSunday);

  if (!isSunday(startDate)) {
    throw new Error('Loan start date must be a Sunday');
  }

  const schedule = [];

  // First payment is NEXT Sunday after loan disbursement
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

/**
 * Get all Sundays between two dates (inclusive)
 * @param {Date|string} startDate - Start date
 * @param {Date|string} endDate - End date
 * @returns {Array<Date>} - Array of Sunday dates
 */
export function getSundaysInRange(startDate, endDate) {
  const sundays = [];
  let currentDate = new Date(startDate);
  const end = new Date(endDate);

  // Move to first Sunday if not already
  if (!isSunday(currentDate)) {
    currentDate = getNextSunday(currentDate);
  }

  while (currentDate <= end) {
    sundays.push(new Date(currentDate));
    currentDate.setDate(currentDate.getDate() + 7);
  }

  return sundays;
}

/**
 * Get the next N Sundays starting from today
 * @param {number} count - Number of Sundays to get (default 4)
 * @returns {Array<Date>} - Array of upcoming Sunday dates
 */
export function getUpcomingSundays(count = 4) {
  const sundays = [];
  let currentSunday = getNextSunday(new Date());

  for (let i = 0; i < count; i++) {
    sundays.push(new Date(currentSunday));
    currentSunday.setDate(currentSunday.getDate() + 7);
  }

  return sundays;
}

/**
 * Format Sunday for display in UI
 * @param {Date|string} date - Sunday date
 * @param {number} weekNumber - Optional week number
 * @returns {string} - Formatted string (e.g., "Nov 17, 2024" or "Nov 17, 2024 (Week 1)")
 */
export function formatSundayDisplay(date, weekNumber = null) {
  const d = new Date(date);
  const options = { month: 'short', day: 'numeric', year: 'numeric' };
  const formatted = d.toLocaleDateString('en-US', options);

  if (weekNumber !== null) {
    return `${formatted} (Week ${weekNumber})`;
  }

  return formatted;
}

/**
 * Format date for API (YYYY-MM-DD)
 * @param {Date|string} date - Date to format
 * @returns {string} - Formatted date string
 */
export function formatDateForAPI(date) {
  const d = new Date(date);
  return d.toISOString().split('T')[0];
}

/**
 * Format date for display (DD/MM/YYYY)
 * @param {Date|string} date - Date to format
 * @returns {string} - Formatted date string
 */
export function formatDateForDisplay(date) {
  const d = new Date(date);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

/**
 * Get the week number for a payment based on loan start date
 * @param {Date|string} loanStartSunday - Loan start Sunday
 * @param {Date|string} paymentSunday - Payment Sunday
 * @returns {number} - Week number (1-based)
 */
export function getWeekNumber(loanStartSunday, paymentSunday) {
  const startDate = new Date(loanStartSunday);
  const paymentDate = new Date(paymentSunday);

  const diffTime = paymentDate - startDate;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  const weekNumber = Math.ceil(diffDays / 7);

  return weekNumber;
}

/**
 * Calculate expected completion date for a loan
 * @param {Date|string} loanStartSunday - Loan start Sunday
 * @param {number} totalWeeks - Total weeks of loan
 * @returns {Date} - Expected completion Sunday
 */
export function calculateCompletionDate(loanStartSunday, totalWeeks) {
  const startDate = new Date(loanStartSunday);
  const completionDate = new Date(startDate);
  completionDate.setDate(startDate.getDate() + (totalWeeks * 7));
  return completionDate;
}

/**
 * Check if a Sunday is in the past
 * @param {Date|string} sunday - Sunday to check
 * @returns {boolean} - True if past Sunday
 */
export function isPastSunday(sunday) {
  const thisSunday = getThisSunday();
  const checkDate = new Date(sunday);
  checkDate.setHours(0, 0, 0, 0);
  return checkDate < thisSunday;
}

/**
 * Check if a Sunday is today
 * @param {Date|string} sunday - Sunday to check
 * @returns {boolean} - True if today is Sunday and matches
 */
export function isToday(sunday) {
  const today = new Date();
  const checkDate = new Date(sunday);

  return (
    today.getFullYear() === checkDate.getFullYear() &&
    today.getMonth() === checkDate.getMonth() &&
    today.getDate() === checkDate.getDate()
  );
}

/**
 * Get relative Sunday label (This Sunday, Last Sunday, Next Sunday)
 * @param {Date|string} sunday - Sunday date
 * @returns {string} - Relative label
 */
export function getRelativeSundayLabel(sunday) {
  const checkDate = new Date(sunday);
  checkDate.setHours(0, 0, 0, 0);

  const thisSunday = getThisSunday();
  const lastSunday = getLastSunday();
  const nextSunday = getNextSunday(new Date());

  if (checkDate.getTime() === thisSunday.getTime()) {
    return 'This Sunday';
  } else if (checkDate.getTime() === lastSunday.getTime()) {
    return 'Last Sunday';
  } else if (checkDate.getTime() === nextSunday.getTime()) {
    return 'Next Sunday';
  }

  return formatSundayDisplay(checkDate);
}
