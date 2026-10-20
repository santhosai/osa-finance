// Pure helpers for the Savings Schemes module (SavingsSchemes.jsx).
// A scheme runs `months` months from `start_month` ('YYYY-MM'); month numbers are 1-based.

export const EN_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const TA_MONTHS = ['ஜனவரி', 'பிப்ரவரி', 'மார்ச்', 'ஏப்ரல்', 'மே', 'ஜூன்', 'ஜூலை', 'ஆகஸ்ட்', 'செப்டம்பர்', 'அக்டோபர்', 'நவம்பர்', 'டிசம்பர்'];

export const formatRs = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;
export const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

// Calendar year/month of scheme month i
export function schemeYM(scheme, i) {
  const [y, m] = scheme.start_month.split('-').map(Number);
  const z = m - 1 + (i - 1);
  return { y: y + Math.floor(z / 12), m: (z % 12) + 1 };
}
export const schemeMonthKey = (scheme, i) => {
  const { y, m } = schemeYM(scheme, i);
  return `${y}-${String(m).padStart(2, '0')}`;
};
export const schemeMonthLabel = (scheme, i) => {
  const { y, m } = schemeYM(scheme, i);
  return `${EN_MONTHS[m - 1]} ${y}`;
};
export const schemeMonthTa = (scheme, i) => {
  const { y, m } = schemeYM(scheme, i);
  return `${TA_MONTHS[m - 1]} ${y}`;
};
export const monthKeyLabel = (key) => {
  if (!key) return '';
  const [y, m] = key.split('-').map(Number);
  return `${EN_MONTHS[m - 1]} ${y}`;
};

// Which scheme month today falls in: < 1 before the scheme starts, > months after it ends
export function currentSchemeMonth(scheme, date = new Date()) {
  const [y, m] = scheme.start_month.split('-').map(Number);
  return (date.getFullYear() - y) * 12 + (date.getMonth() + 1 - m) + 1;
}

// 'paid' | 'missed' (past and unpaid) | 'due' (this month, unpaid) | 'upcoming'
export function memberMonthStatus(member, i, currentMonth) {
  if (member.payments && member.payments[i]) return 'paid';
  if (i < currentMonth) return 'missed';
  if (i === currentMonth) return 'due';
  return 'upcoming';
}

export const paidMonths = (member) =>
  Object.keys(member.payments || {}).map(Number).filter(Boolean).sort((a, b) => a - b);

export function missedMonths(scheme, member, currentMonth) {
  const out = [];
  for (let i = 1; i < Math.min(currentMonth, scheme.months + 1); i++) {
    if (!(member.payments && member.payments[i])) out.push(i);
  }
  return out;
}

// Paid after the scheme's last pay day of that month
export function isLatePayment(scheme, i, payment) {
  if (!payment || !payment.date) return false;
  const { y, m } = schemeYM(scheme, i);
  const lastDay = new Date(y, m, 0).getDate();
  const end = `${y}-${String(m).padStart(2, '0')}-${String(Math.min(scheme.window_to || 31, lastDay)).padStart(2, '0')}`;
  return payment.date > end;
}

// Joining offer: member joined in or before the offer month
export function bonusEligible(scheme, member) {
  if (!scheme.bonus) return false;
  if (!scheme.bonus.join_month) return true;
  return String(member.join_month || '') <= scheme.bonus.join_month;
}

export const isCompleted = (scheme, member) => paidMonths(member).length >= scheme.months;

// ---------- WhatsApp ----------
export function whatsappLink(phone, text) {
  const digits = String(phone || '').replace(/\D/g, '').slice(-10);
  return `https://wa.me/91${digits}?text=${encodeURIComponent(text)}`;
}

const signOff = (scheme) => `- ${scheme.run_by || scheme.name}`;
const titleOf = (scheme) => scheme.name_ta || scheme.name;

export function receiptMessage(scheme, member, months) {
  const list = [...months].sort((a, b) => a - b);
  const paid = paidMonths(member).length;
  const left = Math.max(0, scheme.months - paid);
  const p = member.payments?.[list[0]] || {};
  const monthLine = list.length === 1
    ? `மாதம்: ${list[0]}/${scheme.months} (${schemeMonthTa(scheme, list[0])})`
    : `மாதங்கள்: ${list.map(i => schemeMonthTa(scheme, i)).join(', ')}`;
  return [
    `✅ ${titleOf(scheme)}`,
    ``,
    `அட்டை எண்: ${member.card_number}`,
    `பெயர்: ${member.name}`,
    `${monthLine} • ${formatRs(scheme.amount * list.length)}`,
    p.date ? `செலுத்திய தேதி: ${p.date.split('-').reverse().join('-')} • ${p.mode || ''}` : '',
    `செலுத்தியது: ${paid}/${scheme.months} • மீதம் ${left} மாதம் (${formatRs(left * scheme.amount)})`,
    ``,
    `நன்றி!`,
    signOff(scheme),
    scheme.whatsapp_note ? `\n${scheme.whatsapp_note}` : ''
  ].filter(line => line !== null).join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

export function reminderMessage(scheme, member, months) {
  const list = [...months].sort((a, b) => a - b);
  return [
    `🔔 ${titleOf(scheme)}`,
    ``,
    `வணக்கம் ${member.name},`,
    `${list.map(i => schemeMonthTa(scheme, i)).join(', ')} மாத தவணை ${formatRs(scheme.amount * list.length)} இன்னும் செலுத்தப்படவில்லை.`,
    `தயவுசெய்து ${scheme.window_from}–${scheme.window_to} தேதிக்குள் செலுத்தவும்.`,
    ``,
    `அட்டை எண்: ${member.card_number}`,
    signOff(scheme),
    scheme.whatsapp_note ? `\n${scheme.whatsapp_note}` : ''
  ].join('\n').trim();
}

export function handoverMessage(scheme, member) {
  return [
    `🎁 ${titleOf(scheme)}`,
    ``,
    `அட்டை எண்: ${member.card_number}`,
    `பெயர்: ${member.name}`,
    `${scheme.months} மாதங்களும் செலுத்தப்பட்டது. பொருட்கள் வழங்கப்பட்டன.`,
    ...scheme.items.map(it => `• ${it.name_ta || it.name}${it.per > 1 ? ` × ${it.per}` : ''}`),
    ``,
    `நன்றி!`,
    signOff(scheme)
  ].join('\n').trim();
}

// ---------- CSV (opens in Excel; BOM keeps Tamil readable) ----------
export function downloadCSV(filename, rows) {
  const cell = (v) => {
    const s = v === null || v === undefined ? '' : String(v);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = '﻿' + rows.map(r => r.map(cell).join(',')).join('\r\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
