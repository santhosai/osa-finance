import { useState } from 'react';
import useSWR from 'swr';
import AddCustomerModal from './AddCustomerModal';
import AddLoanModal from './AddLoanModal';
import DeleteCustomerModal from './DeleteCustomerModal';
import EditCustomerModal from './EditCustomerModal';
import { API_URL } from '../config';

// Fetcher function for SWR
const fetcher = (url) => fetch(url).then(res => res.json());

function Customers({ navigateTo }) {
  const [activeTab, setActiveTab] = useState('weekly'); // 'weekly' or 'monthly'
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddCustomerModal, setShowAddCustomerModal] = useState(false);
  const [showAddLoanModal, setShowAddLoanModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [customerToDelete, setCustomerToDelete] = useState(null);
  const [customerToEdit, setCustomerToEdit] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const customersPerPage = 20;

  // Fetch Weekly customers
  const weeklyUrl = searchTerm
    ? `${API_URL}/customers?search=${encodeURIComponent(searchTerm)}`
    : `${API_URL}/customers`;

  const { data: weeklyCustomers = [], error: weeklyError, isLoading: weeklyLoading, mutate: mutateWeekly } = useSWR(weeklyUrl, fetcher, {
    refreshInterval: 30000, // Auto-refresh every 30 seconds
    revalidateOnFocus: true,
    dedupingInterval: 2000,
  });

  // Fetch Monthly Finance customers
  const monthlyUrl = `${API_URL}/monthly-finance/customers`;

  const { data: monthlyCustomers = [], error: monthlyError, isLoading: monthlyLoading, mutate: mutateMonthly } = useSWR(monthlyUrl, fetcher, {
    refreshInterval: 30000, // Auto-refresh every 30 seconds
    revalidateOnFocus: true,
    dedupingInterval: 2000,
  });

  // Use appropriate data based on active tab
  const customers = activeTab === 'weekly' ? weeklyCustomers : monthlyCustomers;
  const isLoading = activeTab === 'weekly' ? weeklyLoading : monthlyLoading;
  const error = activeTab === 'weekly' ? weeklyError : monthlyError;
  const mutate = activeTab === 'weekly' ? mutateWeekly : mutateMonthly;

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
    if (activeTab === 'monthly') {
      // For Monthly Finance customers, navigate to Monthly Finance view
      navigateTo('monthly-finance');
    } else if (customer.loans && customer.loans.length > 0) {
      // Customer has loans - navigate to customer loans view
      navigateTo('customer-loans', customer.id);
    } else {
      // Customer has no loans - open add loan modal
      setSelectedCustomer(customer);
      setShowAddLoanModal(true);
    }
  };

  const handleDeleteClick = async (e, customer) => {
    e.stopPropagation(); // Prevent triggering handleCustomerClick

    if (activeTab === 'monthly') {
      // Delete Monthly Finance customer directly
      if (!window.confirm(`Are you sure you want to delete ${customer.name}?`)) {
        return;
      }

      try {
        const response = await fetch(`${API_URL}/monthly-finance/customers/${customer.id}`, {
          method: 'DELETE'
        });

        if (!response.ok) {
          throw new Error('Failed to delete customer');
        }

        // Refresh the monthly customers list
        mutateMonthly();
        alert('Customer deleted successfully!');
      } catch (error) {
        console.error('Error deleting Monthly Finance customer:', error);
        alert('Failed to delete customer: ' + error.message);
      }
    } else {
      // Delete Weekly customer using modal
      setCustomerToDelete(customer);
      setShowDeleteModal(true);
    }
  };

  const handleEditClick = (e, customer) => {
    e.stopPropagation(); // Prevent triggering handleCustomerClick
    setCustomerToEdit(customer);
    setShowEditModal(true);
  };

  // Pagination logic
  const indexOfLastCustomer = currentPage * customersPerPage;
  const indexOfFirstCustomer = indexOfLastCustomer - customersPerPage;
  const currentCustomers = customers.slice(indexOfFirstCustomer, indexOfLastCustomer);
  const totalPages = Math.ceil(customers.length / customersPerPage);

  const goToNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const goToPreviousPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const downloadAllData = async () => {
    try {
      // Create CSV header
      const csvHeader = 'Customer Name,Phone,Loan Amount,Balance,Weekly Payment,Start Date,Last Payment Date,Status\n';

      const csvRows = [];

      customers.forEach(customer => {
        if (customer.loans && customer.loans.length > 0) {
          // Create a row for each loan
          customer.loans.forEach(loan => {
            const totalPaid = loan.loan_amount - loan.balance;
            const lastPayment = loan.last_payment_date || 'No payments';
            const startDate = loan.start_date || '-';

            csvRows.push(`${customer.name},${customer.phone},${loan.loan_amount},${loan.balance},${loan.weekly_amount},${startDate},${lastPayment},${loan.status}`);
          });
        } else {
          // Customer with no loans
          csvRows.push(`${customer.name},${customer.phone},No Active Loan,-,-,-,-,-`);
        }
      });

      const csvContent = csvHeader + csvRows.join('\n');

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

      {/* Tabs for Weekly/Monthly */}
      <div style={{
        display: 'flex',
        gap: '0',
        padding: '0 16px',
        background: '#f3f4f6',
        borderBottom: '2px solid #e5e7eb'
      }}>
        <button
          onClick={() => {
            setActiveTab('weekly');
            setCurrentPage(1);
          }}
          style={{
            flex: 1,
            padding: '14px 20px',
            border: 'none',
            background: activeTab === 'weekly' ? 'white' : 'transparent',
            color: activeTab === 'weekly' ? '#1e40af' : '#6b7280',
            fontWeight: activeTab === 'weekly' ? 700 : 600,
            fontSize: '16px',
            cursor: 'pointer',
            borderBottom: activeTab === 'weekly' ? '3px solid #1e40af' : '3px solid transparent',
            transition: 'all 0.2s'
          }}
        >
          📅 Weekly ({weeklyCustomers.length})
        </button>
        <button
          onClick={() => {
            setActiveTab('monthly');
            setCurrentPage(1);
          }}
          style={{
            flex: 1,
            padding: '14px 20px',
            border: 'none',
            background: activeTab === 'monthly' ? 'white' : 'transparent',
            color: activeTab === 'monthly' ? '#7c3aed' : '#6b7280',
            fontWeight: activeTab === 'monthly' ? 700 : 600,
            fontSize: '16px',
            cursor: 'pointer',
            borderBottom: activeTab === 'monthly' ? '3px solid #7c3aed' : '3px solid transparent',
            transition: 'all 0.2s'
          }}
        >
          💰 Monthly ({monthlyCustomers.length})
        </button>
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

      {isLoading ? (
        <div style={{
          textAlign: 'center',
          padding: '60px 20px',
          color: '#6b7280'
        }}>
          <div style={{
            fontSize: '48px',
            marginBottom: '16px',
            animation: 'spin 1s linear infinite'
          }}>⏳</div>
          <div style={{ fontSize: '18px', fontWeight: 600 }}>Loading customers...</div>
          <style>{`
            @keyframes spin {
              from { transform: rotate(0deg); }
              to { transform: rotate(360deg); }
            }
          `}</style>
        </div>
      ) : customers.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: '60px 20px',
          background: 'white',
          margin: '0 16px',
          borderRadius: '12px'
        }}>
          <div style={{ fontSize: '64px', marginBottom: '16px' }}>👥</div>
          <div style={{ fontSize: '18px', fontWeight: 600, color: '#1f2937', marginBottom: '8px' }}>
            {searchTerm ? 'No customers found' : 'No customers yet'}
          </div>
          <div style={{ fontSize: '14px', color: '#6b7280' }}>
            {searchTerm ? 'Try a different search term' : 'Click the + button to add your first customer'}
          </div>
        </div>
      ) : (
        <>
        {currentCustomers.map((customer) => (
        <div
          key={customer.id}
          className="customer-card"
          onClick={() => handleCustomerClick(customer)}
          style={{ position: 'relative' }}
        >
          <button
            onClick={(e) => handleEditClick(e, customer)}
            style={{
              position: 'absolute',
              top: '8px',
              right: '52px',
              background: '#dbeafe',
              border: '1px solid #93c5fd',
              borderRadius: '5px',
              padding: '4px 8px',
              cursor: 'pointer',
              fontSize: '12px',
              color: '#1e40af',
              fontWeight: 600,
              transition: 'all 0.2s',
              zIndex: 10
            }}
            onMouseOver={(e) => {
              e.target.style.background = '#3b82f6';
              e.target.style.color = 'white';
            }}
            onMouseOut={(e) => {
              e.target.style.background = '#dbeafe';
              e.target.style.color = '#1e40af';
            }}
            title="Edit Customer"
          >
            ✏️
          </button>
          <button
            onClick={(e) => handleDeleteClick(e, customer)}
            style={{
              position: 'absolute',
              top: '8px',
              right: '8px',
              background: '#fee2e2',
              border: '1px solid #fca5a5',
              borderRadius: '5px',
              padding: '4px 8px',
              cursor: 'pointer',
              fontSize: '12px',
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

          {/* Display different info for Weekly vs Monthly customers */}
          {activeTab === 'monthly' ? (
            <div className="customer-loan">
              <div className="loan-info">
                <div className="loan-label">Loan Amount</div>
                <div className="loan-value">{formatCurrency(customer.loan_amount)}</div>
              </div>
              <div className="loan-info">
                <div className="loan-label">Balance</div>
                <div className="loan-value">{formatCurrency(customer.balance)}</div>
              </div>
              <div className="loan-info">
                <div className="loan-label">Monthly Payment</div>
                <div className="loan-value">{formatCurrency(customer.monthly_amount)}</div>
              </div>
              <div className="loan-info">
                <div className="loan-label">Progress</div>
                <div className="loan-value">
                  {Math.floor((customer.loan_amount - customer.balance) / customer.monthly_amount)}/{customer.total_months} months
                </div>
              </div>
            </div>
          ) : customer.total_active_loans > 0 ? (
            <div className="customer-loan">
              <div className="loan-info">
                <div className="loan-label">Active Loans</div>
                <div className="loan-value">
                  {customer.total_active_loans} {customer.total_active_loans === 1 ? 'loan' : 'loans'}
                </div>
              </div>
              <div className="loan-info">
                <div className="loan-label">Loan Given</div>
                <div className="loan-value">
                  {formatCurrency(customer.loans.reduce((sum, loan) => sum + loan.loan_amount, 0))}
                </div>
              </div>
              <div className="loan-info">
                <div className="loan-label">Total Balance</div>
                <div className="loan-value">{formatCurrency(customer.total_balance)}</div>
              </div>
              <div className="loan-info">
                <div className="loan-label">Most Recent</div>
                <div className="loan-value">
                  {customer.loans && customer.loans.length > 0
                    ? formatDate(customer.loans[customer.loans.length - 1].last_payment_date)
                    : '-'}
                </div>
              </div>
            </div>
          ) : (
            <div className="customer-loan">
              <div className="loan-info">
                <div className="loan-label">No active loans</div>
                <div className="loan-value" style={{ color: '#6b7280' }}>
                  Click to add loan
                </div>
              </div>
            </div>
          )}
        </div>
        ))}

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            gap: '12px',
            padding: '24px 16px',
            marginBottom: '80px'
          }}>
            <button
              onClick={goToPreviousPage}
              disabled={currentPage === 1}
              style={{
                padding: '10px 20px',
                borderRadius: '8px',
                border: 'none',
                background: currentPage === 1 ? '#e5e7eb' : 'linear-gradient(135deg, #1e40af 0%, #1e3a8a 100%)',
                color: currentPage === 1 ? '#9ca3af' : 'white',
                fontSize: '16px',
                fontWeight: 600,
                cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                boxShadow: currentPage === 1 ? 'none' : '0 4px 12px rgba(30, 64, 175, 0.25)'
              }}
            >
              ← Previous
            </button>

            <div style={{
              padding: '10px 16px',
              background: 'white',
              borderRadius: '8px',
              fontWeight: 600,
              color: '#1f2937',
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
            }}>
              Page {currentPage} of {totalPages}
            </div>

            <button
              onClick={goToNextPage}
              disabled={currentPage === totalPages}
              style={{
                padding: '10px 20px',
                borderRadius: '8px',
                border: 'none',
                background: currentPage === totalPages ? '#e5e7eb' : 'linear-gradient(135deg, #1e40af 0%, #1e3a8a 100%)',
                color: currentPage === totalPages ? '#9ca3af' : 'white',
                fontSize: '16px',
                fontWeight: 600,
                cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                boxShadow: currentPage === totalPages ? 'none' : '0 4px 12px rgba(30, 64, 175, 0.25)'
              }}
            >
              Next →
            </button>
          </div>
        )}

        {/* Customer count info */}
        <div style={{
          textAlign: 'center',
          padding: '12px',
          color: '#6b7280',
          fontSize: '14px',
          marginBottom: '20px'
        }}>
          Showing {indexOfFirstCustomer + 1}-{Math.min(indexOfLastCustomer, customers.length)} of {customers.length} customers
        </div>
        </>
      )}

      <button
        className="fab"
        onClick={() => {
          if (activeTab === 'monthly') {
            // Navigate to Monthly Finance view to add customer there
            navigateTo('monthly-finance');
          } else {
            // Open Weekly customer modal
            setShowAddCustomerModal(true);
          }
        }}
      >
        +
      </button>

      {showAddCustomerModal && (
        <AddCustomerModal
          onClose={() => setShowAddCustomerModal(false)}
          onSuccess={() => {
            setShowAddCustomerModal(false);
            mutate(); // SWR: Re-fetch data automatically
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
            mutate(); // SWR: Re-fetch data automatically
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
            mutate(); // SWR: Re-fetch data automatically
          }}
        />
      )}

      {showEditModal && customerToEdit && (
        <EditCustomerModal
          customer={customerToEdit}
          onClose={() => {
            setShowEditModal(false);
            setCustomerToEdit(null);
          }}
          onSuccess={() => {
            setShowEditModal(false);
            setCustomerToEdit(null);
            mutate(); // SWR: Re-fetch data automatically
          }}
        />
      )}
    </div>
  );
}

export default Customers;
