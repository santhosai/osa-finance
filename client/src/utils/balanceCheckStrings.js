// English / Tamil text for the public balance-check page (BalanceCheck.jsx).
// Both languages must carry the same keys. Customer names, amounts, phone
// numbers and custom loan names are data and are shown as-is in both.

const en = {
  brand: 'Om Sai Murugan Finance',
  subtitle: 'Check Your Loan Balance',
  copyright: '© 2026 Om Sai Murugan Finance. All rights reserved.',

  // Phone entry
  enterPhone: 'Enter Your Phone Number',
  enterPhoneSub: "We'll show you all your loan details",
  phonePlaceholder: '10-digit mobile number',
  checking: 'Checking...',
  checkBalance: 'Check Balance',
  secureNote: 'Your information is secure and will only be used to display your loan details. We do not store any data.',
  errInvalidPhone: 'Please enter a valid 10-digit phone number',
  errNotFound: 'No customer found with this phone number',
  errFetch: 'Failed to fetch balance. Please try again.',

  // Customer header
  welcome: (name) => `Welcome, ${name}!`,
  checkAnother: 'Check Another Number',

  // Loan types
  monthlyFinance: 'Monthly Finance',
  weeklyLoan: 'Weekly Loan',
  weeklyLoans: 'Weekly Loans',
  dailyLoan: 'Daily Loan',
  interestLoan: 'Interest Loan',
  vehicleLoan: 'Vehicle Loan',
  generalLoan: 'General Loan',
  loanKinds: { Weekly: 'Weekly', Daily: 'Daily', Interest: 'Interest' },
  loanWord: 'Loan',
  loansWord: 'Loans',

  // Loan fields
  paymentDay: (day) => `Payment Day: ${day} of every month`,
  loanAmount: 'Loan Amount',
  balanceDue: 'Balance Due',
  balance: 'Balance',
  monthlyPayment: 'Monthly Payment',
  weeklyPayment: 'Weekly Payment',
  dailyPayment: 'Daily Payment',
  totalMonths: 'Total Months',
  months: (n) => `${n} months`,
  startDate: 'Start Date',
  principalAmount: 'Principal Amount',
  interestRate: 'Interest Rate',
  monthlyInterest: 'Monthly Interest',
  perMonth: '/month',
  loanGiven: 'Loan Given',
  emiStart: 'EMI Start',
  currentMonth: (cur, total) => `Current Month: M${cur} / ${total}`,
  totalPaid: 'Total Paid',
  totalPaidInline: 'Total paid',
  paymentsCount: (n) => `${n} payment${n !== 1 ? 's' : ''}`,
  loanGivenLine: (given, start) => `Loan given ${given} · EMI start ${start}`,
  monthOf: (cur, total) => `Month ${cur}/${total}`,
  startedLine: (date, n) => `Started ${date} · ${n} payment${n !== 1 ? 's' : ''} made`,
  emiPerMonth: 'EMI/month',
  emisPaid: (paid, total) => `${paid}/${total} EMIs paid`,
  totalPayable: 'Total Payable',
  emiNo: (n) => `EMI #${n}`,

  // Payments
  payNowUpi: 'Pay Now via UPI',
  payInterestUpi: 'Pay Interest via UPI',
  payEmiNow: 'Pay EMI Now',
  historyToggle: (expanded, n) => `${expanded ? 'Hide' : 'View'} Payment History (${n})`,
  paymentHistory: 'Payment History',
  paymentTimeline: 'Payment Timeline',
  paymentNo: (n) => `Payment #${n}`,
  noPayments: 'No payments made yet',
  payModes: {},

  // Empty state / linked accounts / footer
  noActiveLoans: 'No Active Loans',
  noActiveLoansSub: 'You have no outstanding loans at this time.',
  alsoLinked: (n) => `Also linked to this number (${n})`,
  queries: 'For any queries, contact us:',

  // UPI payment modal
  payViaUpi: 'Pay via UPI',
  loanPayment: 'Loan Payment',
  amountToPay: 'Amount to Pay:',
  currentBalance: 'Current Balance:',
  payToUpi: 'Pay to UPI ID:',
  or: 'OR',
  openUpiApp: 'Open UPI App to Pay',
  instructionsTitle: 'Payment Instructions:',
  steps: [
    'Click "Open UPI App to Pay" above',
    'Complete the payment in your UPI app',
    'Take a screenshot of the payment success page',
    'Upload the screenshot below',
    'Click "Submit" to notify us'
  ],
  noteLabel: 'Note:',
  noteText: 'If payment fails in UPI app, still upload the screenshot showing the payment attempt. Our admin will verify and update manually.',
  uploadLabel: 'Upload Payment Screenshot',
  optional: '(Optional)',
  screenshotSelected: 'Screenshot selected:',
  cancel: 'Cancel',
  uploading: 'Uploading...',
  submitting: 'Submitting...',
  submitPayment: 'Submit Payment',
  verifyNote: 'Your payment will be verified by our admin before updating your balance',

  // Success modal
  paymentSubmitted: 'Payment Submitted!',
  amount: 'Amount',
  customer: 'Customer',
  adminNotified: 'Admin notified via WhatsApp!',
  sendWhatsappNote: 'Please send the WhatsApp message that opened. Admin will verify and approve your payment.',
  done: 'Done',

  // Alerts
  alertImageOnly: 'Please upload an image file',
  alertFileSize: 'File size must be less than 5MB',
  alertLoanMissing: 'Loan information missing',
  alertMinAmount: 'Minimum payment amount is ₹10. Please contact admin for smaller amounts.',
  confirmNoScreenshot:
    'No screenshot uploaded.\n\n' +
    'You can still submit, but admin will need to verify manually.\n\n' +
    'Click OK to submit without screenshot, or Cancel to upload one.',
  confirmUploadFailed:
    'Screenshot upload failed (slow network).\n\n' +
    'Click OK to submit without screenshot.\n' +
    'Admin will verify your payment manually.',
  alertSubmitFailed: (message) =>
    '❌ Payment Submission Failed!\n\n' +
    'Error: ' + message + '\n\n' +
    'Please try again or contact admin at:\n' +
    '📞 +91 8667510724'
};

const ta = {
  brand: 'ஓம் சாய் முருகன் ஃபைனான்ஸ்',
  subtitle: 'உங்கள் கடன் நிலுவையைப் பார்க்கவும்',
  copyright: '© 2026 ஓம் சாய் முருகன் ஃபைனான்ஸ். அனைத்து உரிமைகளும் பாதுகாக்கப்பட்டவை.',

  // Phone entry
  enterPhone: 'உங்கள் மொபைல் எண்ணை உள்ளிடவும்',
  enterPhoneSub: 'உங்கள் அனைத்து கடன் விவரங்களையும் காட்டுவோம்',
  phonePlaceholder: '10 இலக்க மொபைல் எண்',
  checking: 'சரிபார்க்கிறது...',
  checkBalance: 'நிலுவையைப் பார்க்க',
  secureNote: 'உங்கள் தகவல் பாதுகாப்பானது; உங்கள் கடன் விவரங்களைக் காட்ட மட்டுமே பயன்படுத்தப்படும். நாங்கள் எந்தத் தகவலையும் சேமிப்பதில்லை.',
  errInvalidPhone: 'சரியான 10 இலக்க மொபைல் எண்ணை உள்ளிடவும்',
  errNotFound: 'இந்த மொபைல் எண்ணில் வாடிக்கையாளர் யாரும் இல்லை',
  errFetch: 'நிலுவையைப் பெற முடியவில்லை. மீண்டும் முயற்சிக்கவும்.',

  // Customer header
  welcome: (name) => `வணக்கம், ${name}!`,
  checkAnother: 'வேறு எண்ணைப் பார்க்க',

  // Loan types
  monthlyFinance: 'மாதாந்திர ஃபைனான்ஸ்',
  weeklyLoan: 'வாரக் கடன்',
  weeklyLoans: 'வாரக் கடன்கள்',
  dailyLoan: 'தினசரி கடன்',
  interestLoan: 'வட்டிக் கடன்',
  vehicleLoan: 'வாகனக் கடன்',
  generalLoan: 'பொது கடன்',
  loanKinds: { Weekly: 'வார', Daily: 'தினசரி', Interest: 'வட்டி' },
  loanWord: 'கடன்',
  loansWord: 'கடன்கள்',

  // Loan fields
  paymentDay: (day) => `செலுத்தும் நாள்: ஒவ்வொரு மாதமும் ${day}-ஆம் தேதி`,
  loanAmount: 'கடன் தொகை',
  balanceDue: 'நிலுவைத் தொகை',
  balance: 'நிலுவை',
  monthlyPayment: 'மாத தவணை',
  weeklyPayment: 'வார தவணை',
  dailyPayment: 'தினசரி தவணை',
  totalMonths: 'மொத்த மாதங்கள்',
  months: (n) => `${n} மாதங்கள்`,
  startDate: 'தொடக்க தேதி',
  principalAmount: 'அசல் தொகை',
  interestRate: 'வட்டி விகிதம்',
  monthlyInterest: 'மாத வட்டி',
  perMonth: '/மாதம்',
  loanGiven: 'கடன் வழங்கிய தேதி',
  emiStart: 'தவணை தொடக்கம்',
  currentMonth: (cur, total) => `நடப்பு மாதம்: ${cur} / ${total}`,
  totalPaid: 'மொத்தம் செலுத்தியது',
  totalPaidInline: 'மொத்தம் செலுத்தியது',
  paymentsCount: (n) => `${n} ${n !== 1 ? 'தவணைகள்' : 'தவணை'}`,
  loanGivenLine: (given, start) => `கடன் வழங்கியது ${given} · தவணை தொடக்கம் ${start}`,
  monthOf: (cur, total) => `மாதம் ${cur}/${total}`,
  startedLine: (date, n) => `தொடங்கியது ${date} · ${n} ${n !== 1 ? 'தவணைகள்' : 'தவணை'} செலுத்தப்பட்டது`,
  emiPerMonth: 'தவணை/மாதம்',
  emisPaid: (paid, total) => `${paid}/${total} தவணைகள் செலுத்தப்பட்டது`,
  totalPayable: 'மொத்தம் செலுத்த வேண்டியது',
  emiNo: (n) => `தவணை #${n}`,

  // Payments
  payNowUpi: 'UPI மூலம் இப்போது செலுத்துங்கள்',
  payInterestUpi: 'UPI மூலம் வட்டி செலுத்துங்கள்',
  payEmiNow: 'இப்போது தவணை செலுத்துங்கள்',
  historyToggle: (expanded, n) => `செலுத்திய விவரங்களை ${expanded ? 'மறை' : 'பார்க்க'} (${n})`,
  paymentHistory: 'செலுத்திய விவரங்கள்',
  paymentTimeline: 'செலுத்திய விவரங்கள்',
  paymentNo: (n) => `தவணை #${n}`,
  noPayments: 'இதுவரை எந்தத் தொகையும் செலுத்தப்படவில்லை',
  payModes: { cash: 'ரொக்கம்', upi: 'UPI', online: 'ஆன்லைன்' },

  // Empty state / linked accounts / footer
  noActiveLoans: 'நிலுவையில் கடன் இல்லை',
  noActiveLoansSub: 'தற்போது உங்களுக்கு நிலுவையில் எந்தக் கடனும் இல்லை.',
  alsoLinked: (n) => `இந்த எண்ணுடன் இணைந்த மற்றவர்கள் (${n})`,
  queries: 'ஏதேனும் சந்தேகம் இருந்தால் தொடர்பு கொள்ளுங்கள்:',

  // UPI payment modal
  payViaUpi: 'UPI மூலம் செலுத்துங்கள்',
  loanPayment: 'கடன் தவணை',
  amountToPay: 'செலுத்த வேண்டிய தொகை:',
  currentBalance: 'தற்போதைய நிலுவை:',
  payToUpi: 'இந்த UPI ID-க்கு செலுத்துங்கள்:',
  or: 'அல்லது',
  openUpiApp: 'UPI ஆப்பைத் திறந்து செலுத்துங்கள்',
  instructionsTitle: 'செலுத்தும் வழிமுறைகள்:',
  steps: [
    'மேலே உள்ள "UPI ஆப்பைத் திறந்து செலுத்துங்கள்" பட்டனை அழுத்தவும்',
    'உங்கள் UPI ஆப்பில் பணத்தைச் செலுத்தவும்',
    'பணம் செலுத்தப்பட்ட பக்கத்தை ஸ்கிரீன்ஷாட் எடுக்கவும்',
    'அந்த ஸ்கிரீன்ஷாட்டை கீழே பதிவேற்றவும்',
    'எங்களுக்குத் தெரிவிக்க "சமர்ப்பிக்கவும்" பட்டனை அழுத்தவும்'
  ],
  noteLabel: 'குறிப்பு:',
  noteText: 'UPI ஆப்பில் பணம் செலுத்த முடியாமல் போனாலும், அந்த முயற்சியின் ஸ்கிரீன்ஷாட்டைப் பதிவேற்றவும். எங்கள் நிர்வாகி சரிபார்த்து புதுப்பிப்பார்.',
  uploadLabel: 'பணம் செலுத்திய ஸ்கிரீன்ஷாட்டைப் பதிவேற்றவும்',
  optional: '(விருப்பம்)',
  screenshotSelected: 'ஸ்கிரீன்ஷாட் தேர்வு செய்யப்பட்டது:',
  cancel: 'ரத்து',
  uploading: 'பதிவேற்றுகிறது...',
  submitting: 'சமர்ப்பிக்கிறது...',
  submitPayment: 'சமர்ப்பிக்கவும்',
  verifyNote: 'எங்கள் நிர்வாகி சரிபார்த்த பிறகே உங்கள் நிலுவை புதுப்பிக்கப்படும்',

  // Success modal
  paymentSubmitted: 'விவரம் சமர்ப்பிக்கப்பட்டது!',
  amount: 'தொகை',
  customer: 'வாடிக்கையாளர்',
  adminNotified: 'WhatsApp மூலம் நிர்வாகிக்குத் தெரிவிக்கப்பட்டது!',
  sendWhatsappNote: 'திறந்துள்ள WhatsApp செய்தியை அனுப்பவும். நிர்வாகி சரிபார்த்து உங்கள் பணத்தை அனுமதிப்பார்.',
  done: 'முடிந்தது',

  // Alerts
  alertImageOnly: 'படக் கோப்பை மட்டும் பதிவேற்றவும்',
  alertFileSize: 'கோப்பின் அளவு 5MB-க்குள் இருக்க வேண்டும்',
  alertLoanMissing: 'கடன் விவரம் கிடைக்கவில்லை',
  alertMinAmount: 'குறைந்தபட்சம் ₹10 செலுத்த வேண்டும். அதற்கும் குறைவான தொகைக்கு நிர்வாகியைத் தொடர்பு கொள்ளவும்.',
  confirmNoScreenshot:
    'ஸ்கிரீன்ஷாட் பதிவேற்றப்படவில்லை.\n\n' +
    'இருந்தாலும் சமர்ப்பிக்கலாம்; நிர்வாகி தனியாகச் சரிபார்க்க வேண்டியிருக்கும்.\n\n' +
    'ஸ்கிரீன்ஷாட் இல்லாமல் சமர்ப்பிக்க OK, பதிவேற்ற Cancel அழுத்தவும்.',
  confirmUploadFailed:
    'ஸ்கிரீன்ஷாட் பதிவேற்ற முடியவில்லை (நெட்வொர்க் மெதுவாக உள்ளது).\n\n' +
    'ஸ்கிரீன்ஷாட் இல்லாமல் சமர்ப்பிக்க OK அழுத்தவும்.\n' +
    'நிர்வாகி உங்கள் பணத்தைத் தனியாகச் சரிபார்ப்பார்.',
  alertSubmitFailed: (message) =>
    '❌ சமர்ப்பிக்க முடியவில்லை!\n\n' +
    'பிழை: ' + message + '\n\n' +
    'மீண்டும் முயற்சிக்கவும் அல்லது நிர்வாகியைத் தொடர்பு கொள்ளவும்:\n' +
    '📞 +91 8667510724'
};

export const BALANCE_CHECK_STRINGS = { en, ta };
