import { useState, useEffect, useRef, useCallback } from 'react';
import { RecaptchaVerifier, signInWithPhoneNumber, onAuthStateChanged } from 'firebase/auth';
import { auth } from '../firebase';
import { API_URL } from '../config';
import {
  PONGAL_TOTAL_MONTHS, pongalUpiLink, pongalNormalizePhone,
  pongalConsecutiveMissedStreak, pongalElapsedMonths, PONGAL_UPI_VPA
} from '../utils/pongalHelpers';

const SHOP_PHONE = '918667510724';

// Warm, friendly harvest-gold palette for the public-facing side — distinct from the
// admin's darker theme (mobile-first, since customers mostly open this on a phone).
const S = {
  page: { minHeight: '100vh', background: 'linear-gradient(180deg, #FFF6E6 0%, #FDECC8 100%)', fontFamily: 'system-ui, sans-serif', color: '#3a2a12' },
  header: { textAlign: 'center', padding: '28px 16px 18px' },
  title: { fontSize: 22, fontWeight: 800, color: '#B4530A', margin: 0 },
  subtitle: { fontSize: 13, color: '#8a6a3c', marginTop: 6 },
  container: { maxWidth: 480, margin: '0 auto', padding: '0 16px 40px' },
  card: { background: 'white', borderRadius: 16, padding: 20, marginBottom: 16, boxShadow: '0 4px 16px rgba(180,83,10,0.1)', border: '1px solid #f5deb0' },
  input: { width: '100%', boxSizing: 'border-box', padding: '12px 14px', borderRadius: 10, border: '1px solid #eacd8f', fontSize: 15, marginBottom: 12 },
  btn: { width: '100%', padding: '13px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,#f2a93b,#c2410c)', color: 'white', fontWeight: 700, fontSize: 15, cursor: 'pointer' },
  btnSecondary: { width: '100%', padding: '13px', borderRadius: 10, border: '1px solid #eacd8f', background: 'white', color: '#B4530A', fontWeight: 700, fontSize: 14, cursor: 'pointer', marginTop: 8 },
  monthGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginTop: 10 },
  monthCell: (state, selected) => ({
    borderRadius: 10, padding: '10px 4px', textAlign: 'center', cursor: state === 'unpaid' ? 'pointer' : 'default',
    border: selected ? '2px solid #c2410c' : '1px solid #f0e0bd',
    background: state === 'paid' ? '#e8f8ee' : state === 'pending' ? '#fff4e0' : '#fff9ef',
    color: state === 'paid' ? '#166534' : state === 'pending' ? '#92400e' : '#8a6a3c'
  }),
  badge: (kind) => ({ display: 'inline-block', padding: '3px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700, background: kind === 'danger' ? '#fee2e2' : '#fef3c7', color: kind === 'danger' ? '#b91c1c' : '#92400e' })
};

const monthName = (n) => ['January','February','March','April','May','June','July','August','September','October','November','December'][n - 1] || `Month ${n}`;

async function authFetch(path, options = {}) {
  const idToken = await auth.currentUser.getIdToken();
  return fetch(`${API_URL}${path}`, {
    ...options,
    headers: { ...(options.headers || {}), Authorization: `Bearer ${idToken}` }
  });
}

function PongalCustomerPortal() {
  const [checkingSession, setCheckingSession] = useState(true);
  const [signedIn, setSignedIn] = useState(false);
  const [phone, setPhone] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState('');
  const [confirmationResult, setConfirmationResult] = useState(null);
  const [authError, setAuthError] = useState('');
  const [sending, setSending] = useState(false);

  const [accounts, setAccounts] = useState(null);
  const [selectedAccountId, setSelectedAccountId] = useState(null);
  const [account, setAccount] = useState(null);
  const [plan, setPlan] = useState(null);

  const [selectedMonths, setSelectedMonths] = useState(new Set());
  const [payStep, setPayStep] = useState('select'); // select -> upi -> confirm
  const [upiRef, setUpiRef] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [tab, setTab] = useState('account'); // account | history | rules

  const recaptchaRef = useRef(null);

  const lookupAccounts = useCallback(async () => {
    try {
      const res = await authFetch('/pongal-fund/customer/lookup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
      const data = await res.json();
      setAccounts(data.accounts || []);
      if ((data.accounts || []).length === 1) setSelectedAccountId(data.accounts[0].id);
    } catch { setAccounts([]); }
  }, []);

  const loadAccount = useCallback(async (id) => {
    try {
      const res = await authFetch(`/pongal-fund/customer/${id}/account`);
      if (!res.ok) return;
      const data = await res.json();
      setAccount(data);
      setPlan(data.plan);
    } catch { /* ignore */ }
  }, []);

  // Restore an existing Firebase session on reload — no need to re-verify OTP every visit.
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setSignedIn(!!user);
      setCheckingSession(false);
      if (user) lookupAccounts();
    });
    return unsub;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { if (selectedAccountId) loadAccount(selectedAccountId); }, [selectedAccountId, loadAccount]);

  const setupRecaptcha = () => {
    if (recaptchaRef.current) return recaptchaRef.current;
    const verifier = new RecaptchaVerifier(auth, 'pongal-recaptcha-container', { size: 'invisible' });
    recaptchaRef.current = verifier;
    return verifier;
  };

  const sendOtp = async (e) => {
    e.preventDefault();
    setAuthError('');
    const normalized = pongalNormalizePhone(phone);
    if (normalized.length !== 10) { setAuthError('Enter a valid 10-digit phone number'); return; }
    setSending(true);
    try {
      const verifier = setupRecaptcha();
      const result = await signInWithPhoneNumber(auth, `+91${normalized}`, verifier);
      setConfirmationResult(result);
      setOtpSent(true);
    } catch (err) {
      setAuthError(err.message || 'Could not send OTP. Please try again.');
    }
    setSending(false);
  };

  const verifyOtp = async (e) => {
    e.preventDefault();
    setAuthError('');
    if (!confirmationResult) return;
    setSending(true);
    try {
      await confirmationResult.confirm(otp);
      setSignedIn(true);
      await lookupAccounts();
    } catch {
      setAuthError('Incorrect code — please check and try again.');
    }
    setSending(false);
  };

  const paidMonths = new Set((account?.paid_months) || []);
  const pendingMonths = new Set((account?.payments || []).filter(p => p.status === 'pending').map(p => p.month_number));

  const toggleMonth = (m) => {
    if (paidMonths.has(m) || pendingMonths.has(m)) return;
    const next = new Set(selectedMonths);
    if (next.has(m)) next.delete(m); else next.add(m);
    setSelectedMonths(next);
  };

  const monthlyAmount = plan?.monthly_amount || 0;
  const combinedAmount = selectedMonths.size * monthlyAmount;
  const upiLink = pongalUpiLink(combinedAmount, `Pongal ${account?.card_number || ''} - ${selectedMonths.size} month(s)`);

  const submitPayment = async () => {
    if (!upiRef.trim()) { alert('Please enter the UPI transaction reference'); return; }
    setSubmitting(true);
    try {
      const now = new Date();
      const res = await authFetch(`/pongal-fund/customer/${account.id}/submit-payment`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          months: [...selectedMonths], amount: combinedAmount, upi_ref: upiRef,
          paid_date: now.toISOString().slice(0, 10), paid_time: now.toTimeString().slice(0, 5)
        })
      });
      if (!res.ok) { const d = await res.json(); alert(d.error || 'Could not submit — please try again'); setSubmitting(false); return; }
      setSelectedMonths(new Set());
      setUpiRef('');
      setPayStep('select');
      await loadAccount(account.id);
    } catch { alert('Network error — please try again'); }
    setSubmitting(false);
  };

  if (checkingSession) {
    return <div style={S.page}><div style={S.container}><div style={S.card}>Loading...</div></div></div>;
  }

  // ---- Not signed in: phone + OTP flow ----
  if (!signedIn) {
    return (
      <div style={S.page}>
        <div style={S.header}>
          <h1 style={S.title}>🌾 Pongal Savings Scheme</h1>
          <p style={S.subtitle}>Check your account, pay your months, track your package</p>
        </div>
        <div style={S.container}>
          <div style={S.card}>
            {!otpSent ? (
              <form onSubmit={sendOtp}>
                <label style={{ fontSize: 13, fontWeight: 600, marginBottom: 6, display: 'block' }}>Your Phone Number</label>
                <input style={S.input} value={phone} onChange={e => setPhone(e.target.value)} placeholder="10-digit mobile number" inputMode="numeric" />
                {authError && <div style={{ color: '#b91c1c', fontSize: 13, marginBottom: 10 }}>{authError}</div>}
                <button style={S.btn} disabled={sending} type="submit">{sending ? 'Sending OTP...' : 'Send OTP'}</button>
              </form>
            ) : (
              <form onSubmit={verifyOtp}>
                <label style={{ fontSize: 13, fontWeight: 600, marginBottom: 6, display: 'block' }}>Enter the code sent to +91{pongalNormalizePhone(phone)}</label>
                <input style={S.input} value={otp} onChange={e => setOtp(e.target.value)} placeholder="6-digit code" inputMode="numeric" />
                {authError && <div style={{ color: '#b91c1c', fontSize: 13, marginBottom: 10 }}>{authError}</div>}
                <button style={S.btn} disabled={sending} type="submit">{sending ? 'Verifying...' : 'Verify & Continue'}</button>
                <button style={S.btnSecondary} type="button" onClick={() => { setOtpSent(false); setOtp(''); }}>Change Number</button>
              </form>
            )}
            <div id="pongal-recaptcha-container" />
          </div>
          <ShopContact />
        </div>
      </div>
    );
  }

  // ---- Signed in, multiple cards found: account picker ----
  if (signedIn && accounts && accounts.length > 1 && !account) {
    return (
      <div style={S.page}>
        <div style={S.header}>
          <h1 style={S.title}>🌾 Choose Your Account</h1>
          <p style={S.subtitle}>We found {accounts.length} cards linked to this number</p>
        </div>
        <div style={S.container}>
          {accounts.map(a => (
            <div key={a.id} style={{ ...S.card, cursor: 'pointer' }} onClick={() => setSelectedAccountId(a.id)}>
              <div style={{ fontWeight: 800, fontSize: 16 }}>{a.name}</div>
              <div style={{ color: '#8a6a3c', fontSize: 13 }}>{a.card_number} • {a.village} • {a.scheme_year}</div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (signedIn && accounts && accounts.length === 0) {
    return (
      <div style={S.page}>
        <div style={S.container}>
          <div style={{ ...S.card, textAlign: 'center', marginTop: 40 }}>
            <div style={{ fontSize: 32 }}>🤔</div>
            <div style={{ fontWeight: 700, marginTop: 8 }}>No Pongal Scheme account found for this number</div>
            <div style={{ color: '#8a6a3c', fontSize: 13, marginTop: 6 }}>If you've already registered at the shop, please contact us below.</div>
          </div>
          <ShopContact />
        </div>
      </div>
    );
  }

  if (!account) {
    return <div style={S.page}><div style={S.container}><div style={S.card}>Loading your account...</div></div></div>;
  }

  const elapsed = pongalElapsedMonths(account.scheme_year);
  const streak = pongalConsecutiveMissedStreak(account.paid_months, elapsed);

  // ---- Signed in, account loaded ----
  return (
    <div style={S.page}>
      <div style={S.header}>
        <h1 style={S.title}>🌾 {account.name}</h1>
        <p style={S.subtitle}>{account.card_number} • {account.village} • Scheme {account.scheme_year}</p>
      </div>
      <div style={S.container}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
          {['account', 'history', 'rules'].map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              flex: 1, padding: '10px', borderRadius: 10, border: 'none', fontWeight: 700, fontSize: 13, cursor: 'pointer',
              background: tab === t ? 'linear-gradient(135deg,#f2a93b,#c2410c)' : 'white', color: tab === t ? 'white' : '#8a6a3c'
            }}>
              {t === 'account' ? 'Account' : t === 'history' ? 'History' : 'Rules'}
            </button>
          ))}
        </div>

        {tab === 'account' && (
          <>
            <div style={S.card}>
              <div style={{ fontSize: 13, color: '#8a6a3c', marginBottom: 6 }}>{(account.paid_months || []).length}/{PONGAL_TOTAL_MONTHS} months paid</div>
              <div style={{ background: '#f5deb0', borderRadius: 999, height: 10, overflow: 'hidden' }}>
                <div style={{ width: `${((account.paid_months || []).length / PONGAL_TOTAL_MONTHS) * 100}%`, height: '100%', background: 'linear-gradient(90deg,#f2a93b,#c2410c)' }} />
              </div>
              {streak >= 3 && <div style={{ marginTop: 10 }}><span style={S.badge('danger')}>⚠ {streak} months missed in a row — please pay soon</span></div>}
              {account.handover_done && <div style={{ marginTop: 10 }}><span style={S.badge()}>🎁 Package already handed over</span></div>}
            </div>

            <div style={S.card}>
              <h4 style={{ marginTop: 0 }}>12-Month Grid</h4>
              <div style={S.monthGrid}>
                {Array.from({ length: PONGAL_TOTAL_MONTHS }, (_, i) => i + 1).map(m => {
                  const payment = (account.payments || []).find(p => p.month_number === m && p.status !== 'rejected');
                  const state = paidMonths.has(m) ? 'paid' : pendingMonths.has(m) ? 'pending' : 'unpaid';
                  return (
                    <div key={m} style={S.monthCell(state, selectedMonths.has(m))} onClick={() => toggleMonth(m)}>
                      <div style={{ fontWeight: 700, fontSize: 11 }}>{monthName(m).slice(0, 3)}</div>
                      {state === 'paid' && payment && <div style={{ fontSize: 8, marginTop: 2 }}>{payment.paid_date}<br />{payment.mode === 'upi' ? 'Online' : 'Shop'}</div>}
                      {state === 'pending' && <div style={{ fontSize: 8, marginTop: 2 }}>Under review</div>}
                      {state === 'unpaid' && <div style={{ fontSize: 8, marginTop: 2 }}>₹{monthlyAmount}</div>}
                    </div>
                  );
                })}
              </div>

              {selectedMonths.size > 0 && payStep === 'select' && (
                <div style={{ marginTop: 16, padding: 12, background: '#FFF6E6', borderRadius: 10 }}>
                  <div style={{ fontWeight: 700, marginBottom: 8 }}>{selectedMonths.size} month(s) selected — ₹{combinedAmount.toLocaleString('en-IN')}</div>
                  <a href={upiLink} style={{ ...S.btn, textDecoration: 'none', display: 'block', textAlign: 'center', boxSizing: 'border-box' }} onClick={() => setPayStep('confirm')}>
                    Pay ₹{combinedAmount.toLocaleString('en-IN')} via UPI
                  </a>
                  <button style={S.btnSecondary} onClick={() => setSelectedMonths(new Set())}>Clear Selection</button>
                </div>
              )}

              {payStep === 'confirm' && selectedMonths.size > 0 && (
                <div style={{ marginTop: 16, padding: 12, background: '#FFF6E6', borderRadius: 10 }}>
                  <div style={{ fontWeight: 700, marginBottom: 8 }}>After paying, enter your UPI reference to confirm</div>
                  <input style={S.input} value={upiRef} onChange={e => setUpiRef(e.target.value)} placeholder="UPI transaction / reference ID" />
                  <button style={S.btn} disabled={submitting} onClick={submitPayment}>{submitting ? 'Submitting...' : 'Submit for Confirmation'}</button>
                  <button style={S.btnSecondary} onClick={() => setPayStep('select')}>Back</button>
                </div>
              )}
            </div>
          </>
        )}

        {tab === 'history' && (
          <div style={S.card}>
            <h4 style={{ marginTop: 0 }}>Payment History</h4>
            {(account.payments || []).length === 0 && <div style={{ color: '#8a6a3c' }}>No payments yet.</div>}
            {(account.payments || []).slice().sort((a, b) => b.month_number - a.month_number).map(p => (
              <div key={p.id} style={{ padding: '10px 0', borderBottom: '1px solid #f0e0bd' }}>
                <div style={{ fontWeight: 700, fontSize: 13 }}>
                  {p.month_number > PONGAL_TOTAL_MONTHS ? 'Package Handover' : monthName(p.month_number)} — ₹{p.amount}
                  <span style={{ marginLeft: 8 }}><span style={S.badge(p.status === 'rejected' ? 'danger' : undefined)}>{p.status}</span></span>
                </div>
                <div style={{ fontSize: 12, color: '#8a6a3c' }}>{p.paid_date} {p.paid_time} • {p.mode === 'upi' ? 'Online (UPI)' : p.mode === 'cash' ? 'Paid at shop' : p.mode}</div>
              </div>
            ))}
          </div>
        )}

        {tab === 'rules' && (
          <>
            <div style={S.card}>
              <h4 style={{ marginTop: 0 }}>This Year's Package</h4>
              <ul style={{ fontSize: 14, paddingLeft: 20, lineHeight: 1.8 }}>
                {(plan?.package_items || []).map((item, i) => <li key={i}>{item}</li>)}
                {(!plan || (plan.package_items || []).length === 0) && <li>Package list not published yet.</li>}
              </ul>
            </div>
            <div style={S.card}>
              <h4 style={{ marginTop: 0 }}>Scheme Rules</h4>
              <ul style={{ fontSize: 13, lineHeight: 1.8, paddingLeft: 20 }}>
                <li>Pay 12 months continuously to receive the full grocery package at Pongal.</li>
                <li>Payment window: between the 5th and 20th of each month.</li>
                <li>Missing 3 months in a row puts your account at risk of removal.</li>
                <li>No cash refunds — the scheme pays out in goods only.</li>
              </ul>
            </div>
            <ShopContact />
          </>
        )}
      </div>
    </div>
  );
}

function ShopContact() {
  return (
    <div style={S.card}>
      <h4 style={{ marginTop: 0 }}>Contact the Shop</h4>
      <div style={{ display: 'flex', gap: 10 }}>
        <a href={`tel:+${SHOP_PHONE}`} style={{ ...S.btn, textDecoration: 'none', textAlign: 'center' }}>📞 Call</a>
        <a href={`https://wa.me/${SHOP_PHONE}`} target="_blank" rel="noreferrer" style={{ ...S.btn, textDecoration: 'none', textAlign: 'center', background: '#25D366' }}>💬 WhatsApp</a>
      </div>
    </div>
  );
}

export default PongalCustomerPortal;
