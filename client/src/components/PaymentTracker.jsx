import { useState, useEffect } from 'react';
import { API_URL } from '../config';

function PaymentTracker({ navigateTo }) {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchPaymentStatus();
  }, [selectedDate]);

  const fetchPaymentStatus = async () => {
    setLoading(true);
    try {
      // Get all customers with loans
      const customersResponse = await fetch(`${API_URL}/customers`);
      const allCustomers = await customersResponse.json();

      // For each customer with loan, check if they paid on selected date
      const customerStatusPromises = allCustomers.map(async (customer) => {
        if (!customer.loan_id) return null;

        // Get all payments for this loan
        const loanResponse = await fetch(`${API_URL}/loans/${customer.loan_id}`);
        const loanData = await loanResponse.json();

        // Check if any payment was made on selected date
        const paidOnDate = loanData.payments?.some(
          payment => payment.payment_date === selectedDate
        );

        return {
          ...customer,
          paidOnDate,
          weeklyAmount: customer.weekly_amount
        };
      });

      const results = await Promise.all(customerStatusPromises);
      const customersWithLoans = results.filter(c => c !== null);
      setCustomers(customersWithLoans);
    } catch (error) {
      console.error('Error fetching payment status:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    return `₹${amount.toLocaleString('en-IN')}`;
  };

  const paidCount = customers.filter(c => c.paidOnDate).length;
  const unpaidCount = customers.filter(c => !c.paidOnDate).length;

  return (
    <div>
      <div className="navbar">
        <svg
          className="nav-icon"
          fill="white"
          viewBox="0 0 24 24"
          onClick={() => navigateTo('dashboard')}
          title="Back to Dashboard"
        >
          <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z" />
        </svg>
        <h2>Payment Tracker</h2>
        <div style={{ width: '40px' }}></div>
      </div>

      <div style={{ padding: '20px' }}>
        <div style={{
          background: 'white',
          borderRadius: '12px',
          padding: '20px',
          marginBottom: '20px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
        }}>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, color: '#1f2937' }}>
            Select Date
          </label>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            style={{
              width: '100%',
              padding: '12px',
              borderRadius: '8px',
              border: '2px solid #e5e7eb',
              fontSize: '16px',
              fontWeight: 600
            }}
          />
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
          gap: '12px',
          marginBottom: '20px'
        }}>
          <div style={{
            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
            padding: '16px',
            borderRadius: '12px',
            color: 'white',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '32px', fontWeight: 700 }}>{paidCount}</div>
            <div style={{ fontSize: '14px', opacity: 0.9 }}>Paid</div>
          </div>

          <div style={{
            background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
            padding: '16px',
            borderRadius: '12px',
            color: 'white',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '32px', fontWeight: 700 }}>{unpaidCount}</div>
            <div style={{ fontSize: '14px', opacity: 0.9 }}>Not Paid</div>
          </div>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#6b7280' }}>
            Loading...
          </div>
        ) : customers.length === 0 ? (
          <div style={{
            background: '#f3f4f6',
            padding: '40px',
            borderRadius: '12px',
            textAlign: 'center',
            color: '#6b7280'
          }}>
            No customers with active loans
          </div>
        ) : (
          customers.map((customer) => (
            <div
              key={customer.id}
              style={{
                background: 'white',
                borderRadius: '12px',
                padding: '16px',
                marginBottom: '12px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}
            >
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: '16px', color: '#1f2937', marginBottom: '4px' }}>
                  {customer.name}
                </div>
                <div style={{ fontSize: '14px', color: '#6b7280' }}>
                  📱 {customer.phone}
                </div>
                <div style={{ fontSize: '14px', color: '#6b7280', marginTop: '4px' }}>
                  Weekly: {formatCurrency(customer.weeklyAmount)}
                </div>
              </div>

              <div style={{
                width: '60px',
                height: '60px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: customer.paidOnDate ? '#d1fae5' : '#fee2e2',
                fontSize: '28px'
              }}>
                {customer.paidOnDate ? '✓' : '✗'}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default PaymentTracker;
