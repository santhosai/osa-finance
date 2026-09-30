// Shared helpers for the Pongal Savings Scheme module (admin + customer portal).
// Kept separate from sundayHelpers.js since that file is about weekly day-of-week
// collection scheduling — a different concept from a fixed 12-month calendar scheme.

export const PONGAL_TOTAL_MONTHS = 12;

// Shop UPI details for the customer payment deep link — swap these if the VPA/name changes.
export const PONGAL_UPI_VPA = '8667510724@pthdfc';
export const PONGAL_UPI_PAYEE_NAME = 'Om Sai Murugan Finance';

// True consecutive-streak detector, per the scheme rule "miss 3 months IN A ROW" —
// deliberately NOT the cumulative-shortfall style Festival Fund's isOverdue() uses,
// since that only approximates "in a row" and can misfire on out-of-order payments.
export function pongalConsecutiveMissedStreak(paidMonths, elapsedMonthCount) {
  const paid = new Set(paidMonths || []);
  let streak = 0;
  for (let m = Math.min(elapsedMonthCount, PONGAL_TOTAL_MONTHS); m >= 1; m--) {
    if (paid.has(m)) break;
    streak++;
  }
  return streak;
}

export function pongalIsOverdue(paidMonths, elapsedMonthCount) {
  return pongalConsecutiveMissedStreak(paidMonths, elapsedMonthCount) >= 3;
}

// How many of the 12 months are "elapsed" (due) as of today, given the customer's
// scheme year — a simple 12-month calendar starting January of the scheme year.
export function pongalElapsedMonths(schemeYear) {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1; // 1-12
  if (currentYear > schemeYear) return PONGAL_TOTAL_MONTHS;
  if (currentYear < schemeYear) return 0;
  return currentMonth;
}

export function pongalNormalizePhone(raw) {
  return String(raw || '').replace(/\D/g, '').slice(-10);
}

export function pongalUpiLink(amount, note) {
  const params = new URLSearchParams({
    pa: PONGAL_UPI_VPA,
    pn: PONGAL_UPI_PAYEE_NAME,
    am: String(amount),
    cu: 'INR',
    tn: note || 'Pongal Scheme Payment'
  });
  return `upi://pay?${params.toString()}`;
}

// Builds ONE combined WhatsApp message covering every month in a batch, instead of
// one message per month — this is genuinely new logic (Festival Fund's message
// builder only ever covers a single payment).
export function pongalBuildBatchMessage({ customer, months, totalAmount, paidDate, promoNote }) {
  const monthList = [...months].sort((a, b) => a - b);
  const isHandover = monthList.length === 1 && monthList[0] === PONGAL_TOTAL_MONTHS + 1;
  const paidMonths = (customer.paid_months || []);
  const remaining = Math.max(0, PONGAL_TOTAL_MONTHS - paidMonths.length);

  if (isHandover) {
    return [
      `🎊 பொங்கல் பரிசு பொருள் வழங்கல் / Pongal Package Handover`,
      ``,
      `Card No: ${customer.card_number}`,
      `Name: ${customer.name}`,
      `12 months completed — package handed over on ${paidDate}.`,
      ``,
      `நன்றி! Thank you for saving with us all year.`,
      `- Om Sai Murugan Finance`,
      promoNote ? `\n${promoNote}` : ''
    ].join('\n');
  }

  const monthLabel = monthList.length === 1
    ? `Month ${monthList[0]}`
    : `Months ${monthList.join(', ')} (${monthList.length} months)`;

  return [
    `✅ Payment Received — Pongal Savings Scheme`,
    ``,
    `Card No: ${customer.card_number}`,
    `Name: ${customer.name}`,
    `${monthLabel} • ₹${totalAmount.toLocaleString('en-IN')}`,
    `Date: ${paidDate}`,
    `Paid so far: ${paidMonths.length}/${PONGAL_TOTAL_MONTHS} • ${remaining} month(s) left`,
    ``,
    `Thank you for your payment!`,
    `- Om Sai Murugan Finance`,
    promoNote ? `\n${promoNote}` : ''
  ].join('\n');
}

export function pongalSendWhatsApp(customer, message) {
  const phone = pongalNormalizePhone(customer.phone);
  window.open(`https://wa.me/91${phone}?text=${encodeURIComponent(message)}`, '_blank');
}

export function pongalBuildReminderMessage({ customer, unpaidMonths, monthlyAmount, promoNote }) {
  const totalDue = unpaidMonths.length * monthlyAmount;
  return [
    `🔔 Pongal Scheme Payment Reminder`,
    ``,
    `Card No: ${customer.card_number}`,
    `Name: ${customer.name}`,
    `Pending months: ${unpaidMonths.join(', ')}`,
    `Amount due: ₹${totalDue.toLocaleString('en-IN')}`,
    ``,
    `Please pay between the 5th-20th of the month to stay on schedule.`,
    `- Om Sai Murugan Finance`,
    promoNote ? `\n${promoNote}` : ''
  ].join('\n');
}
