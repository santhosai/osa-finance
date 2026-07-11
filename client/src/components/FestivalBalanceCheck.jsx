import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { API_URL } from '../config';

const SCHEME_INFO = {
  1: { payout: 11000, gift: '1 கிலோ கோழி' },
  2: { payout: 22000, gift: '1 கிலோ மட்டன்' },
};

function formatCurrency(amount) {
  if (amount === null || amount === undefined || isNaN(amount)) return '₹0';
  return `₹${Number(amount).toLocaleString('en-IN')}`;
}

function formatDate(dateString) {
  if (!dateString) return '-';
  return new Date(dateString).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatMonth(monthStr) {
  if (!monthStr || monthStr === 'payout') return '';
  const [y, m] = monthStr.split('-');
  return new Date(y, m - 1, 1).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
}

// Public, read-only self-service page — a member enters (or arrives with) their phone
// number and sees their own Festival Fund payment progress, no login required.
function FestivalBalanceCheck() {
  const [searchParams] = useSearchParams();
  const [phone, setPhone] = useState(searchParams.get('phone') || '');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState({});

  const checkBalance = async (p) => {
    if (p.length !== 10) {
      setError('சரியான 10 இலக்க மொபைல் எண்ணை உள்ளிடவும்');
      return;
    }
    setLoading(true);
    setError('');
    setData(null);
    try {
      const res = await fetch(`${API_URL}/festival-fund/balance-check/${p}`);
      if (res.status === 404) {
        setError('இந்த எண்ணுக்கு உறுப்பினர் யாரும் இல்லை');
        setLoading(false);
        return;
      }
      if (!res.ok) throw new Error('Server error');
      setData(await res.json());
    } catch (err) {
      console.error('Error fetching festival fund balance:', err);
      setError('தகவல் பெற முடியவில்லை. மீண்டும் முயற்சிக்கவும்.');
    }
    setLoading(false);
  };

  // Auto-check when arriving via a link with ?phone= already filled in
  useEffect(() => {
    const p = searchParams.get('phone');
    if (p && p.length === 10) checkBalance(p);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    checkBalance(phone);
  };

  const reset = () => {
    setPhone('');
    setData(null);
    setError('');
    setExpanded({});
  };

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(160deg, #7A1B3D 0%, #4A0E24 100%)', padding: '20px' }}>
      <div style={{ textAlign: 'center', color: 'white', marginBottom: '24px', paddingTop: '16px' }}>
        <div style={{ fontSize: '32px', marginBottom: '6px' }}>🎉</div>
        <h1 style={{ fontSize: '22px', fontWeight: 700, margin: '0 0 4px 0' }}>OM SAI MURUGAN FINANCE</h1>
        <p style={{ fontSize: '14px', margin: 0, opacity: 0.9 }}>திருவிழா சிறு சேமிப்பு — Check Your Payments</p>
      </div>

      <div style={{ maxWidth: '480px', margin: '0 auto' }}>
        {!data ? (
          <form onSubmit={handleSubmit} style={{ background: 'white', borderRadius: '16px', padding: '28px', boxShadow: '0 10px 40px rgba(0,0,0,0.25)' }}>
            <div style={{ textAlign: 'center', marginBottom: '20px' }}>
              <div style={{ fontSize: '36px', marginBottom: '10px' }}>📱</div>
              <div style={{ fontSize: '16px', fontWeight: 700, color: '#2B1810' }}>உங்கள் மொபைல் எண்ணை உள்ளிடவும்</div>
              <div style={{ fontSize: '12px', color: '#6b5647', marginTop: '4px' }}>Enter your registered mobile number</div>
            </div>
            <input
              type="tel"
              placeholder="10-digit mobile number"
              value={phone}
              maxLength={10}
              onChange={e => { setPhone(e.target.value.replace(/\D/g, '')); setError(''); }}
              style={{ width: '100%', padding: '14px', border: '2px solid #E4D4B8', borderRadius: '10px', fontSize: '17px', textAlign: 'center', fontWeight: 600, boxSizing: 'border-box', marginBottom: '14px' }}
            />
            {error && (
              <div style={{ background: '#F8E3E3', color: '#B23A3A', padding: '10px', borderRadius: '8px', fontSize: '13px', marginBottom: '14px', textAlign: 'center' }}>{error}</div>
            )}
            <button
              type="submit"
              disabled={loading || phone.length !== 10}
              style={{ width: '100%', padding: '14px', background: loading || phone.length !== 10 ? '#9ca3af' : 'linear-gradient(135deg,#7A1B3D,#4A0E24)', color: 'white', border: 'none', borderRadius: '10px', fontSize: '15px', fontWeight: 700, cursor: loading || phone.length !== 10 ? 'not-allowed' : 'pointer' }}
            >
              {loading ? 'சரிபார்க்கிறது...' : 'சரிபார்க்க'}
            </button>
          </form>
        ) : (
          <div>
            <div style={{ background: 'white', borderRadius: '16px', padding: '20px', marginBottom: '14px', textAlign: 'center', boxShadow: '0 10px 40px rgba(0,0,0,0.25)' }}>
              <div style={{ fontSize: '13px', color: '#6b5647' }}>📱 {data.phone}</div>
              <button onClick={reset} style={{ marginTop: '10px', padding: '8px 20px', background: '#f1f5f9', color: '#475569', border: 'none', borderRadius: '8px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>
                வேறு எண்ணைச் சரிபார்க்க
              </button>
            </div>

            {data.enrollments.map((e, idx) => {
              const info = SCHEME_INFO[e.scheme] || {};
              const pct = Math.round((e.paid_count / e.total_months) * 100);
              const isOpen = expanded[idx];
              return (
                <div key={idx} style={{ background: 'white', borderRadius: '16px', padding: '20px', marginBottom: '14px', boxShadow: '0 6px 20px rgba(0,0,0,0.15)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                    <div>
                      <div style={{ fontSize: '17px', fontWeight: 700, color: '#2B1810' }}>{e.name}</div>
                      <div style={{ fontSize: '12px', color: '#6b5647', marginTop: '2px' }}>
                        {e.batch ? `${e.batch} Batch` : ''} · Scheme {e.scheme} — ₹{e.scheme_amount.toLocaleString('en-IN')}/month
                      </div>
                    </div>
                    {e.paid_count >= e.total_months && <span style={{ fontSize: '22px' }}>🎊</span>}
                  </div>

                  <div style={{ marginBottom: '10px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#6b5647', marginBottom: '4px' }}>
                      <span>முன்னேற்றம் (Progress)</span>
                      <span style={{ fontWeight: 700, color: pct >= 100 ? '#3F7D4F' : '#B8722A' }}>{e.paid_count}/{e.total_months} — {pct}%</span>
                    </div>
                    <div style={{ background: '#E4D4B8', borderRadius: 4, height: 8 }}>
                      <div style={{ width: `${pct}%`, height: '100%', background: pct >= 100 ? '#3F7D4F' : '#C89B3C', borderRadius: 4, transition: 'width .3s' }} />
                    </div>
                  </div>

                  <div style={{ background: '#F6E9D6', borderRadius: 8, padding: '10px 12px', fontSize: '12px', color: '#B8722A', marginBottom: '10px' }}>
                    🎁 முடிவில் திருவிழா பரிசு: ₹{(info.payout||0).toLocaleString('en-IN')} + {info.gift}
                    {e.payout && <div style={{ marginTop: '4px', color: '#3F7D4F', fontWeight: 700 }}>✅ வழங்கப்பட்டது — {formatDate(e.payout.payment_date)}</div>}
                  </div>

                  {e.payments.length > 0 && (
                    <button
                      onClick={() => setExpanded(x => ({ ...x, [idx]: !x[idx] }))}
                      style={{ width: '100%', padding: '10px', background: isOpen ? '#f1f5f9' : 'linear-gradient(135deg,#7A1B3D,#4A0E24)', color: isOpen ? '#475569' : 'white', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
                    >
                      {isOpen ? '▲ மறை' : '▼ பணம் செலுத்திய வரலாறு'} ({e.payments.length})
                    </button>
                  )}

                  {isOpen && (
                    <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {e.payments.map((p, i) => (
                        <div key={p.id || i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', background: '#FBF3E3', borderRadius: '8px', fontSize: '12px' }}>
                          <span style={{ color: '#2B1810', fontWeight: 600 }}>
                            {p.month_number === 11 ? '🎁 பரிசு' : `மாதம் ${p.month_number} — ${formatMonth(p.payment_month)}`}
                          </span>
                          <span style={{ color: '#6b5647' }}>{formatDate(p.payment_date)} · {(p.payment_mode||'cash').toUpperCase()} · {formatCurrency(p.amount)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}

            <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.85)', fontSize: '12px', marginTop: '18px', lineHeight: 1.8 }}>
              🌿 "சிறு சேமிப்பு இன்று... பெரிய நிம்மதி நாளை."<br />
              – Santhosh Kumar, OM SAI MURUGAN FINANCE<br />
              📞 8667510724
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default FestivalBalanceCheck;
