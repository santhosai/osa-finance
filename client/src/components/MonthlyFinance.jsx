import { useState, useEffect } from 'react';

const MonthlyFinance = ({ navigateTo }) => {
  const [customers, setCustomers] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    amount: '',
    date: '',
    monthlyInstallment: '',
    totalMonths: ''
  });
  const [showForm, setShowForm] = useState(false);

  // Load customers from localStorage on mount
  useEffect(() => {
    const savedCustomers = localStorage.getItem('monthlyFinanceCustomers');
    if (savedCustomers) {
      setCustomers(JSON.parse(savedCustomers));
    }
  }, []);

  // Save customers to localStorage
  const saveCustomers = (newCustomers) => {
    localStorage.setItem('monthlyFinanceCustomers', JSON.stringify(newCustomers));
    setCustomers(newCustomers);
  };

  // Handle form input changes
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Add new customer
  const handleAddCustomer = (e) => {
    e.preventDefault();

    if (!formData.name || !formData.amount || !formData.date || !formData.monthlyInstallment || !formData.totalMonths) {
      alert('Please fill all fields');
      return;
    }

    const amount = parseFloat(formData.amount);
    const monthlyInstallment = parseFloat(formData.monthlyInstallment);
    const totalMonths = parseInt(formData.totalMonths);

    // Generate payment schedule
    const startDate = new Date(formData.date);
    const paymentSchedule = [];

    for (let i = 0; i < totalMonths; i++) {
      const paymentDate = new Date(startDate);
      paymentDate.setMonth(startDate.getMonth() + i);

      paymentSchedule.push({
        month: i + 1,
        date: paymentDate.toISOString().split('T')[0],
        amount: monthlyInstallment,
        paid: false
      });
    }

    const newCustomer = {
      id: Date.now(),
      name: formData.name,
      totalAmount: amount,
      monthlyInstallment: monthlyInstallment,
      totalMonths: totalMonths,
      startDate: formData.date,
      paymentSchedule: paymentSchedule,
      balance: amount
    };

    const updatedCustomers = [...customers, newCustomer];
    saveCustomers(updatedCustomers);

    // Reset form
    setFormData({ name: '', amount: '', date: '', monthlyInstallment: '', totalMonths: '' });
    setShowForm(false);
  };

  // Toggle payment status
  const togglePayment = (customerId, monthIndex) => {
    const updatedCustomers = customers.map(customer => {
      if (customer.id === customerId) {
        const updatedSchedule = [...customer.paymentSchedule];
        updatedSchedule[monthIndex].paid = !updatedSchedule[monthIndex].paid;

        // Calculate new balance
        const totalPaid = updatedSchedule
          .filter(payment => payment.paid)
          .reduce((sum, payment) => sum + payment.amount, 0);

        return {
          ...customer,
          paymentSchedule: updatedSchedule,
          balance: customer.totalAmount - totalPaid
        };
      }
      return customer;
    });

    saveCustomers(updatedCustomers);
  };

  // Delete customer
  const handleDeleteCustomer = (id) => {
    if (window.confirm('Are you sure you want to delete this customer?')) {
      const updatedCustomers = customers.filter(c => c.id !== id);
      saveCustomers(updatedCustomers);
      if (selectedCustomer && selectedCustomer.id === id) {
        setSelectedCustomer(null);
      }
    }
  };

  // Download as CSV
  const handleDownload = () => {
    if (customers.length === 0) {
      alert('No data to download');
      return;
    }

    let csvContent = 'Customer Name,Total Amount,Monthly Installment,Total Months,Start Date,Balance,Paid Months\n';

    customers.forEach(customer => {
      const paidMonths = customer.paymentSchedule.filter(p => p.paid).length;
      csvContent += `${customer.name},₹${customer.totalAmount},₹${customer.monthlyInstallment},${customer.totalMonths},${customer.startDate},₹${customer.balance},${paidMonths}/${customer.totalMonths}\n`;
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);

    link.setAttribute('href', url);
    link.setAttribute('download', `monthly_finance_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Render detail view for selected customer
  if (selectedCustomer) {
    return (
      <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #1e3a8a 0%, #1e293b 100%)' }}>
        {/* Header */}
        <div style={{
          background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
          padding: '16px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
          marginBottom: '16px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button
              onClick={() => navigateTo('dashboard')}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'white',
                cursor: 'pointer',
                fontSize: '24px',
                padding: '4px',
                display: 'flex',
                alignItems: 'center'
              }}
            >
              ←
            </button>
            <h2 style={{ margin: 0, color: 'white', fontSize: '20px', fontWeight: 700 }}>Monthly Finance - {selectedCustomer.name}</h2>
          </div>
        </div>

        <div style={{ padding: '16px' }}>
          <div style={{
            background: 'white',
            padding: '20px',
            borderRadius: '12px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
            marginBottom: '20px'
          }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
          <button
            onClick={() => setSelectedCustomer(null)}
            style={{
              background: '#64748b',
              color: 'white',
              border: 'none',
              padding: '10px 20px',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '14px'
            }}
          >
            ← Back to List
          </button>
          <h3 style={{ margin: 0, fontSize: '20px', fontWeight: 700, color: '#1e293b' }}>
            {selectedCustomer.name}
          </h3>
        </div>

        {/* Summary Card */}
        <div style={{
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          color: 'white',
          padding: '20px',
          borderRadius: '12px',
          marginBottom: '20px'
        }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '15px' }}>
            <div>
              <div style={{ fontSize: '14px', opacity: 0.9 }}>Total Amount</div>
              <div style={{ fontSize: '20px', fontWeight: 700 }}>₹{selectedCustomer.totalAmount.toLocaleString('en-IN')}</div>
            </div>
            <div>
              <div style={{ fontSize: '14px', opacity: 0.9 }}>Monthly Payment</div>
              <div style={{ fontSize: '20px', fontWeight: 700 }}>₹{selectedCustomer.monthlyInstallment.toLocaleString('en-IN')}</div>
            </div>
            <div>
              <div style={{ fontSize: '14px', opacity: 0.9 }}>Balance</div>
              <div style={{ fontSize: '20px', fontWeight: 700 }}>₹{selectedCustomer.balance.toLocaleString('en-IN')}</div>
            </div>
            <div>
              <div style={{ fontSize: '14px', opacity: 0.9 }}>Progress</div>
              <div style={{ fontSize: '20px', fontWeight: 700 }}>
                {selectedCustomer.paymentSchedule.filter(p => p.paid).length}/{selectedCustomer.totalMonths}
              </div>
            </div>
          </div>
        </div>

        {/* Payment Schedule */}
        <h4 style={{ marginBottom: '15px', color: '#1e293b', fontSize: '18px', fontWeight: 600 }}>
          Payment Schedule
        </h4>
        <div style={{ display: 'grid', gap: '10px' }}>
          {selectedCustomer.paymentSchedule.map((payment, index) => (
            <div
              key={index}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '16px',
                background: payment.paid
                  ? 'linear-gradient(135deg, #d4f4dd 0%, #c3f0cf 100%)'
                  : 'linear-gradient(135deg, #f0f4ff 0%, #e6ecff 100%)',
                borderRadius: '8px',
                borderLeft: payment.paid ? '4px solid #10b981' : '4px solid #667eea',
                transition: 'all 0.3s ease'
              }}
            >
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: '16px', color: '#1e293b', marginBottom: '4px' }}>
                  Month {payment.month}
                </div>
                <div style={{ fontSize: '13px', color: '#64748b' }}>
                  {new Date(payment.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} | ₹{payment.amount.toLocaleString('en-IN')}
                </div>
              </div>
              <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', gap: '8px' }}>
                <input
                  type="checkbox"
                  checked={payment.paid}
                  onChange={() => togglePayment(selectedCustomer.id, index)}
                  style={{
                    width: '24px',
                    height: '24px',
                    cursor: 'pointer',
                    accentColor: '#10b981'
                  }}
                />
                <span style={{ fontSize: '14px', fontWeight: 600, color: payment.paid ? '#10b981' : '#64748b' }}>
                  {payment.paid ? 'Paid ✓' : 'Pending'}
                </span>
              </label>
            </div>
          ))}
        </div>
          </div>
        </div>
      </div>
    );
  }

  // Render list view
  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #1e3a8a 0%, #1e293b 100%)' }}>
      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
        padding: '16px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
        marginBottom: '16px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            onClick={() => navigateTo('dashboard')}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'white',
              cursor: 'pointer',
              fontSize: '24px',
              padding: '4px',
              display: 'flex',
              alignItems: 'center'
            }}
          >
            ←
          </button>
          <h2 style={{ margin: 0, color: 'white', fontSize: '20px', fontWeight: 700 }}>Monthly Finance</h2>
        </div>
      </div>

      <div style={{ padding: '16px' }}>
        {/* List View */}
        <div style={{
          background: 'white',
          padding: '20px',
          borderRadius: '12px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
          marginBottom: '20px'
        }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
          <h3 style={{ margin: 0, fontSize: '20px', fontWeight: 700, color: '#1e293b' }}>
            💰 Monthly Finance
          </h3>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <button
              onClick={handleDownload}
              style={{
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                color: 'white',
                border: 'none',
                padding: '10px 20px',
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: '14px'
              }}
            >
              📥 Download CSV
            </button>
            <button
              onClick={() => setShowForm(!showForm)}
              style={{
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                color: 'white',
                border: 'none',
                padding: '10px 20px',
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: '14px'
              }}
            >
              {showForm ? '✕ Cancel' : '+ Add Customer'}
            </button>
          </div>
        </div>

        {/* Add Customer Form */}
        {showForm && (
          <form onSubmit={handleAddCustomer} style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
            gap: '12px',
            marginBottom: '20px',
            padding: '16px',
            background: '#f8f9fa',
            borderRadius: '8px'
          }}>
            <input
              type="text"
              name="name"
              placeholder="Customer Name"
              value={formData.name}
              onChange={handleInputChange}
              style={{
                padding: '12px',
                border: '1px solid #ddd',
                borderRadius: '6px',
                fontSize: '14px'
              }}
            />
            <input
              type="number"
              name="amount"
              placeholder="Total Amount"
              value={formData.amount}
              onChange={handleInputChange}
              style={{
                padding: '12px',
                border: '1px solid #ddd',
                borderRadius: '6px',
                fontSize: '14px'
              }}
            />
            <input
              type="number"
              name="monthlyInstallment"
              placeholder="Monthly Payment"
              value={formData.monthlyInstallment}
              onChange={handleInputChange}
              style={{
                padding: '12px',
                border: '1px solid #ddd',
                borderRadius: '6px',
                fontSize: '14px'
              }}
            />
            <input
              type="number"
              name="totalMonths"
              placeholder="Total Months"
              min="1"
              value={formData.totalMonths}
              onChange={handleInputChange}
              style={{
                padding: '12px',
                border: '1px solid #ddd',
                borderRadius: '6px',
                fontSize: '14px'
              }}
            />
            <input
              type="date"
              name="date"
              placeholder="Start Date"
              value={formData.date}
              onChange={handleInputChange}
              style={{
                padding: '12px',
                border: '1px solid #ddd',
                borderRadius: '6px',
                fontSize: '14px'
              }}
            />
            <button type="submit" style={{
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: 'white',
              border: 'none',
              padding: '12px',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '14px'
            }}>
              + Add Customer
            </button>
          </form>
        )}

        {/* Customers List */}
        <div style={{ marginBottom: '16px' }}>
          {customers.length === 0 ? (
            <p style={{ textAlign: 'center', color: '#999', fontStyle: 'italic', padding: '20px' }}>
              No customers yet. Add your first customer above!
            </p>
          ) : (
            <div style={{ display: 'grid', gap: '10px' }}>
              {customers.map(customer => {
                const paidMonths = customer.paymentSchedule.filter(p => p.paid).length;
                const progressPercent = (paidMonths / customer.totalMonths) * 100;

                return (
                  <div
                    key={customer.id}
                    onClick={() => setSelectedCustomer(customer)}
                    style={{
                      padding: '16px',
                      background: 'linear-gradient(135deg, #f0f4ff 0%, #e6ecff 100%)',
                      borderRadius: '8px',
                      borderLeft: '4px solid #667eea',
                      cursor: 'pointer',
                      transition: 'all 0.3s ease'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'translateX(5px)';
                      e.currentTarget.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.3)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'translateX(0)';
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '12px' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 700, fontSize: '18px', color: '#1e293b', marginBottom: '8px' }}>
                          {customer.name}
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '8px', fontSize: '13px', color: '#64748b' }}>
                          <div>
                            <strong>Amount:</strong> ₹{customer.totalAmount.toLocaleString('en-IN')}
                          </div>
                          <div>
                            <strong>Balance:</strong> ₹{customer.balance.toLocaleString('en-IN')}
                          </div>
                          <div>
                            <strong>Started:</strong> {new Date(customer.startDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteCustomer(customer.id);
                        }}
                        style={{
                          background: '#ef4444',
                          color: 'white',
                          border: 'none',
                          borderRadius: '50%',
                          width: '32px',
                          height: '32px',
                          fontSize: '18px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                        title="Delete"
                      >
                        ×
                      </button>
                    </div>

                    {/* Progress Bar */}
                    <div style={{ marginTop: '10px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#64748b', marginBottom: '4px' }}>
                        <span>Progress: {paidMonths}/{customer.totalMonths} months</span>
                        <span>{Math.round(progressPercent)}%</span>
                      </div>
                      <div style={{
                        width: '100%',
                        height: '8px',
                        background: '#e2e8f0',
                        borderRadius: '4px',
                        overflow: 'hidden'
                      }}>
                        <div style={{
                          width: `${progressPercent}%`,
                          height: '100%',
                          background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                          transition: 'width 0.3s ease'
                        }} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
      </div>
    </div>
  );
};

export default MonthlyFinance;
