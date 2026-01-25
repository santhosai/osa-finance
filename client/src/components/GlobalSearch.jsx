import { useState, useEffect, useRef } from 'react';
import { API_URL } from '../config';

function GlobalSearch({ onClose, navigateTo, isDarkMode }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState({
    weekly: [],
    monthly: [],
    daily: [],
    vaddi: [],
    chit: []
  });
  const [loading, setLoading] = useState(false);
  const [allData, setAllData] = useState(null);
  const inputRef = useRef(null);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Fetch all data on mount
  useEffect(() => {
    const fetchAllData = async () => {
      setLoading(true);
      try {
        const safeFetch = async (url) => {
          try {
            const res = await fetch(url);
            if (!res.ok) return [];
            return await res.json();
          } catch (e) {
            console.error(`Failed to fetch ${url}:`, e);
            return [];
          }
        };

        const [weekly, monthly, daily, vaddi, chitGroups] = await Promise.all([
          safeFetch(`${API_URL}/customers`),
          safeFetch(`${API_URL}/monthly-finance/customers`),
          safeFetch(`${API_URL}/daily-customers`),
          safeFetch(`${API_URL}/vaddi-entries`),
          safeFetch(`${API_URL}/chit-groups`)
        ]);

        // Fetch chit members
        let chitMembers = [];
        for (const group of chitGroups) {
          const members = await safeFetch(`${API_URL}/chit-groups/${group.id}/members`);
          chitMembers.push(...members.map(m => ({ ...m, groupName: group.name, groupId: group.id })));
        }

        setAllData({ weekly, monthly, daily, vaddi, chitMembers, chitGroups });
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchAllData();
  }, []);

  // Search when term changes
  useEffect(() => {
    if (!allData || searchTerm.length < 2) {
      setResults({ weekly: [], monthly: [], daily: [], vaddi: [], chit: [] });
      return;
    }

    const term = searchTerm.toLowerCase().trim();

    // Search Weekly Finance
    const weeklyResults = [];
    allData.weekly.forEach(customer => {
      const nameMatch = customer.name?.toLowerCase().includes(term);
      const phoneMatch = customer.phone?.toString().includes(term);
      if (nameMatch || phoneMatch) {
        customer.loans?.forEach(loan => {
          weeklyResults.push({
            id: loan.id,
            customerId: customer.id,
            name: customer.name,
            phone: customer.phone,
            loanName: loan.loan_name,
            amount: loan.loan_amount,
            balance: loan.balance,
            status: loan.status,
            type: 'weekly'
          });
        });
      }
    });

    // Search Monthly Finance
    const monthlyResults = allData.monthly
      .filter(c =>
        c.name?.toLowerCase().includes(term) ||
        c.phone?.toString().includes(term)
      )
      .map(c => ({
        id: c.id,
        name: c.name,
        phone: c.phone,
        amount: c.loan_amount,
        balance: c.balance,
        status: c.status,
        paymentDay: c.payment_day,
        type: 'monthly'
      }));

    // Search Daily Finance
    const dailyResults = [];
    allData.daily.forEach(customer => {
      const nameMatch = customer.name?.toLowerCase().includes(term);
      const phoneMatch = customer.phone?.toString().includes(term);
      if (nameMatch || phoneMatch) {
        customer.loans?.forEach(loan => {
          dailyResults.push({
            id: loan.id,
            customerId: customer.id,
            name: customer.name,
            phone: customer.phone,
            amount: loan.asked_amount,
            returnAmount: loan.return_amount,
            status: loan.status,
            type: 'daily'
          });
        });
      }
    });

    // Search Vaddi
    const vaddiResults = allData.vaddi
      .filter(v =>
        v.customer_name?.toLowerCase().includes(term) ||
        v.phone?.toString().includes(term)
      )
      .map(v => ({
        id: v.id,
        name: v.customer_name,
        phone: v.phone,
        amount: v.principal_amount || v.amount,
        interestRate: v.interest_rate,
        status: v.status,
        type: 'vaddi'
      }));

    // Search Chit Members
    const chitResults = allData.chitMembers
      .filter(m =>
        m.name?.toLowerCase().includes(term) ||
        m.phone?.toString().includes(term)
      )
      .map(m => ({
        id: m.id,
        groupId: m.groupId,
        name: m.name,
        phone: m.phone,
        groupName: m.groupName,
        monthlyAmount: m.monthly_amount,
        type: 'chit'
      }));

    setResults({
      weekly: weeklyResults.slice(0, 10),
      monthly: monthlyResults.slice(0, 10),
      daily: dailyResults.slice(0, 10),
      vaddi: vaddiResults.slice(0, 10),
      chit: chitResults.slice(0, 10)
    });
  }, [searchTerm, allData]);

  const totalResults = results.weekly.length + results.monthly.length +
    results.daily.length + results.vaddi.length + results.chit.length;

  const handleResultClick = (item) => {
    onClose();
    // Navigate based on type
    switch (item.type) {
      case 'weekly':
        navigateTo('customers');
        break;
      case 'monthly':
        navigateTo('monthly-finance');
        break;
      case 'daily':
        navigateTo('daily-finance');
        break;
      case 'vaddi':
        navigateTo('vaddi-list');
        break;
      case 'chit':
        navigateTo('chit-fund');
        break;
      default:
        break;
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(amount || 0);
  };

  const ResultSection = ({ title, icon, items, color }) => {
    if (items.length === 0) return null;

    return (
      <div style={{ marginBottom: '16px' }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          marginBottom: '8px',
          padding: '6px 10px',
          background: color,
          borderRadius: '6px'
        }}>
          <span>{icon}</span>
          <span style={{ color: 'white', fontSize: '13px', fontWeight: 600 }}>
            {title} ({items.length})
          </span>
        </div>
        {items.map((item, idx) => (
          <div
            key={`${item.type}-${item.id}-${idx}`}
            onClick={() => handleResultClick(item)}
            style={{
              padding: '12px',
              background: isDarkMode ? '#374151' : '#f3f4f6',
              borderRadius: '8px',
              marginBottom: '6px',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => e.target.style.background = isDarkMode ? '#4b5563' : '#e5e7eb'}
            onMouseLeave={(e) => e.target.style.background = isDarkMode ? '#374151' : '#f3f4f6'}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{
                  color: isDarkMode ? 'white' : '#1f2937',
                  fontSize: '14px',
                  fontWeight: 600
                }}>
                  {item.name}
                </div>
                <div style={{
                  color: isDarkMode ? '#9ca3af' : '#6b7280',
                  fontSize: '12px',
                  marginTop: '2px'
                }}>
                  {item.phone || 'No phone'}
                  {item.loanName && ` • ${item.loanName}`}
                  {item.groupName && ` • ${item.groupName}`}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{
                  color: isDarkMode ? '#10b981' : '#059669',
                  fontSize: '13px',
                  fontWeight: 600
                }}>
                  {formatCurrency(item.amount)}
                </div>
                {item.balance !== undefined && (
                  <div style={{
                    color: isDarkMode ? '#f59e0b' : '#d97706',
                    fontSize: '11px'
                  }}>
                    Bal: {formatCurrency(item.balance)}
                  </div>
                )}
                {item.status && (
                  <span style={{
                    display: 'inline-block',
                    marginTop: '4px',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    fontSize: '10px',
                    fontWeight: 600,
                    background: item.status === 'active' ? '#dcfce7' : '#fee2e2',
                    color: item.status === 'active' ? '#166534' : '#991b1b'
                  }}>
                    {item.status.toUpperCase()}
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.85)',
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '20px',
      paddingTop: '60px',
      overflowY: 'auto'
    }}>
      <div style={{
        backgroundColor: isDarkMode ? '#1f2937' : 'white',
        borderRadius: '16px',
        width: '100%',
        maxWidth: '500px',
        maxHeight: '80vh',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column'
      }}>
        {/* Header */}
        <div style={{
          padding: '16px',
          background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
          display: 'flex',
          alignItems: 'center',
          gap: '12px'
        }}>
          <span style={{ fontSize: '24px' }}>🔍</span>
          <input
            ref={inputRef}
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search customers across all sections..."
            style={{
              flex: 1,
              padding: '12px 16px',
              borderRadius: '8px',
              border: 'none',
              fontSize: '15px',
              outline: 'none',
              background: 'white'
            }}
          />
          <button
            onClick={onClose}
            style={{
              background: 'rgba(255,255,255,0.2)',
              border: 'none',
              color: 'white',
              fontSize: '20px',
              cursor: 'pointer',
              padding: '6px 12px',
              borderRadius: '6px'
            }}
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div style={{
          padding: '16px',
          overflowY: 'auto',
          flex: 1
        }}>
          {loading ? (
            <div style={{
              textAlign: 'center',
              padding: '40px',
              color: isDarkMode ? '#9ca3af' : '#6b7280'
            }}>
              <div style={{ fontSize: '30px', marginBottom: '10px' }}>⏳</div>
              Loading data...
            </div>
          ) : searchTerm.length < 2 ? (
            <div style={{
              textAlign: 'center',
              padding: '40px',
              color: isDarkMode ? '#9ca3af' : '#6b7280'
            }}>
              <div style={{ fontSize: '40px', marginBottom: '10px' }}>🔎</div>
              <div style={{ fontSize: '14px' }}>Type at least 2 characters to search</div>
              <div style={{ fontSize: '12px', marginTop: '8px', opacity: 0.7 }}>
                Search by name or phone number
              </div>
            </div>
          ) : totalResults === 0 ? (
            <div style={{
              textAlign: 'center',
              padding: '40px',
              color: isDarkMode ? '#9ca3af' : '#6b7280'
            }}>
              <div style={{ fontSize: '40px', marginBottom: '10px' }}>😕</div>
              <div style={{ fontSize: '14px' }}>No results found for "{searchTerm}"</div>
              <div style={{ fontSize: '12px', marginTop: '8px', opacity: 0.7 }}>
                Try a different name or phone number
              </div>
            </div>
          ) : (
            <>
              <div style={{
                marginBottom: '16px',
                padding: '10px',
                background: isDarkMode ? '#374151' : '#f0fdf4',
                borderRadius: '8px',
                color: isDarkMode ? '#10b981' : '#166534',
                fontSize: '13px',
                textAlign: 'center'
              }}>
                Found {totalResults} result{totalResults !== 1 ? 's' : ''} for "{searchTerm}"
              </div>

              <ResultSection
                title="Weekly Finance"
                icon="📅"
                items={results.weekly}
                color="linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)"
              />
              <ResultSection
                title="Monthly Finance"
                icon="📆"
                items={results.monthly}
                color="linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)"
              />
              <ResultSection
                title="Daily Finance"
                icon="📋"
                items={results.daily}
                color="linear-gradient(135deg, #f59e0b 0%, #d97706 100%)"
              />
              <ResultSection
                title="Vaddi List"
                icon="💰"
                items={results.vaddi}
                color="linear-gradient(135deg, #10b981 0%, #059669 100%)"
              />
              <ResultSection
                title="Chit Fund"
                icon="👥"
                items={results.chit}
                color="linear-gradient(135deg, #ec4899 0%, #be185d 100%)"
              />
            </>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '12px 16px',
          borderTop: `1px solid ${isDarkMode ? '#374151' : '#e5e7eb'}`,
          background: isDarkMode ? '#111827' : '#f9fafb',
          fontSize: '11px',
          color: isDarkMode ? '#6b7280' : '#9ca3af',
          textAlign: 'center'
        }}>
          Searches: Weekly • Monthly • Daily • Vaddi • Chit Fund
        </div>
      </div>
    </div>
  );
}

export default GlobalSearch;
