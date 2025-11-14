import { useState, useEffect } from 'react';
import AddCustomerModal from './AddCustomerModal';
import AddLoanModal from './AddLoanModal';
import DeleteCustomerModal from './DeleteCustomerModal';
import { API_URL } from '../config';

function Customers({ navigateTo }) {
  const [customers, setCustomers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddCustomerModal, setShowAddCustomerModal] = useState(false);
  const [showAddLoanModal, setShowAddLoanModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [customerToDelete, setCustomerToDelete] = useState(null);

  useEffect(() => {
    fetchCustomers();
  }, [searchTerm]);

  const fetchCustomers = async () => {
    try {
      const url = searchTerm
        ? `${API_URL}/customers?search=${encodeURIComponent(searchTerm)}`
        : `${API_URL}/customers`;
      const response = await fetch(url);
      const data = await response.json();
      setCustomers(data);
    } catch (error) {
      console.error('Error fetching customers:', error);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    } else {
      const daysAgo = Math.floor((today - date) / (1000 * 60 * 60 * 24));
      return `${daysAgo} days ago`;
    }
  };

  const formatCurrency = (amount) => {
    return `₹${amount.toLocaleString('en-IN')}`;
  };

  const handleCustomerClick = (customer) => {
    if (customer.loan_id) {
      navigateTo('loan-details', customer.loan_id);
    } else {
      setSelectedCustomer(customer);
      setShowAddLoanModal(true);
    }
  };

  const handleDeleteClick = (e, customer) => {
    e.stopPropagation(); // Prevent triggering handleCustomerClick
    setCustomerToDelete(customer);
    setShowDeleteModal(true);
  };

  const downloadAllData = async () => {
    try {
      // Fetch full loan details for each customer to get start date and other info
      const customerPromises = customers.map(async (customer) => {
        if (customer.loan_id) {
          const loanResponse = await fetch(`${API_URL}/loans/${customer.loan_id}`);
          const loanData = await loanResponse.json();
          return { ...customer, loanDetails: loanData };
        }
        return customer;
      });

      const customersWithDetails = await Promise.all(customerPromises);

      // Create CSV header with date fields
      const csvHeader = 'Customer Name,Phone,Loan Amount,Balance,Weekly Payment,Status,Total Paid,Progress %,Start Date,Last Payment Date,Weeks Remaining,Expected Completion Date\n';

      const csvRows = customersWithDetails.map(customer => {
        if (customer.loan_id) {
          const totalPaid = customer.loan_amount - customer.balance;
          const progress = ((totalPaid / customer.loan_amount) * 100).toFixed(1);
          const lastPayment = customer.last_payment_date || 'No payments';
          const weeksRemaining = customer.loanDetails?.weeksRemaining || 0;

          // Calculate expected completion date
          const startDate = customer.loanDetails?.start_date || '';
          const expectedDate = startDate ? new Date(startDate) : null;
          if (expectedDate) {
            expectedDate.setDate(expectedDate.getDate() + (customer.loanDetails?.totalWeeks * 7));
          }
          const expectedCompletion = expectedDate ? expectedDate.toISOString().split('T')[0] : '-';

          return `${customer.name},${customer.phone},${customer.loan_amount},${customer.balance},${customer.weekly_amount},${customer.status},${totalPaid},${progress}%,${startDate},${lastPayment},${weeksRemaining},${expectedCompletion}`;
        } else {
          return `${customer.name},${customer.phone},No Active Loan,-,-,-,-,-,-,-,-,-`;
        }
      }).join('\n');

      const csvContent = csvHeader + csvRows;

      // Create blob and download
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);

      link.setAttribute('href', url);
      link.setAttribute('download', `All_Customers_Report_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error('Error downloading data:', error);
      alert('Failed to download report');
    }
  };

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
        <h2>Customers</h2>
        <svg
          className="nav-icon"
          fill="white"
          viewBox="0 0 24 24"
          onClick={downloadAllData}
          title="Download All Customer Data"
        >
          <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/>
        </svg>
      </div>

      <div className="search-bar">
        <input
          type="text"
          className="search-input"
          placeholder="Search by name or phone..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {customers.map((customer) => (
        <div
          key={customer.id}
          className="customer-card"
          onClick={() => handleCustomerClick(customer)}
          style={{ position: 'relative' }}
        >
          <button
            onClick={(e) => handleDeleteClick(e, customer)}
            style={{
              position: 'absolute',
              top: '12px',
              right: '12px',
              background: '#fee2e2',
              border: '1px solid #fca5a5',
              borderRadius: '6px',
              padding: '6px 10px',
              cursor: 'pointer',
              fontSize: '14px',
              color: '#991b1b',
              fontWeight: 600,
              transition: 'all 0.2s',
              zIndex: 10
            }}
            onMouseOver={(e) => {
              e.target.style.background = '#fca5a5';
              e.target.style.color = 'white';
            }}
            onMouseOut={(e) => {
              e.target.style.background = '#fee2e2';
              e.target.style.color = '#991b1b';
            }}
            title="Delete Customer"
          >
            🗑️
          </button>
          <div className="customer-name">{customer.name}</div>
          <div className="customer-phone">📱 {customer.phone}</div>
          {customer.loan_id ? (
            <div className="customer-loan">
              <div className="loan-info">
                <div className="loan-label">Active Loan</div>
                <div className="loan-value">{formatCurrency(customer.loan_amount)}</div>
              </div>
              <div className="loan-info">
                <div className="loan-label">Balance</div>
                <div className="loan-value">{formatCurrency(customer.balance)}</div>
              </div>
              <div className="loan-info">
                <div className="loan-label">Last Payment</div>
                <div className="loan-value">{formatDate(customer.last_payment_date)}</div>
              </div>
            </div>
          ) : (
            <div className="customer-loan">
              <div className="loan-info">
                <div className="loan-label">No active loan</div>
                <div className="loan-value" style={{ color: '#6b7280' }}>
                  Click to add loan
                </div>
              </div>
            </div>
          )}
        </div>
      ))}

      <button className="fab" onClick={() => setShowAddCustomerModal(true)}>
        +
      </button>

      {showAddCustomerModal && (
        <AddCustomerModal
          onClose={() => setShowAddCustomerModal(false)}
          onSuccess={() => {
            setShowAddCustomerModal(false);
            fetchCustomers();
          }}
        />
      )}

      {showAddLoanModal && selectedCustomer && (
        <AddLoanModal
          customerId={selectedCustomer.id}
          customerName={selectedCustomer.name}
          customerPhone={selectedCustomer.phone}
          onClose={() => {
            setShowAddLoanModal(false);
            setSelectedCustomer(null);
          }}
          onSuccess={() => {
            setShowAddLoanModal(false);
            setSelectedCustomer(null);
            fetchCustomers();
          }}
        />
      )}

      {showDeleteModal && customerToDelete && (
        <DeleteCustomerModal
          customer={customerToDelete}
          onClose={() => {
            setShowDeleteModal(false);
            setCustomerToDelete(null);
          }}
          onSuccess={() => {
            setShowDeleteModal(false);
            setCustomerToDelete(null);
            fetchCustomers();
          }}
        />
      )}
    </div>
  );
}

export default Customers;
