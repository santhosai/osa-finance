import { useState, useEffect } from 'react';
import AddCustomerModal from './AddCustomerModal';
import AddLoanModal from './AddLoanModal';
import DeleteCustomerModal from './DeleteCustomerModal';
import EditCustomerModal from './EditCustomerModal';
import { API_URL } from '../config';

function Customers({ navigateTo }) {
  const [customers, setCustomers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddCustomerModal, setShowAddCustomerModal] = useState(false);
  const [showAddLoanModal, setShowAddLoanModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [customerToDelete, setCustomerToDelete] = useState(null);
  const [customerToEdit, setCustomerToEdit] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const customersPerPage = 20;

  useEffect(() => {
    // Debounce search to avoid too many API calls
    const timeoutId = setTimeout(() => {
      setCurrentPage(1); // Reset to page 1 when search changes
      fetchCustomers();
    }, 300); // Wait 300ms after user stops typing

    return () => clearTimeout(timeoutId);
  }, [searchTerm]);

  const fetchCustomers = async () => {
    setLoading(true);
    try {
      const url = searchTerm
        ? `${API_URL}/customers?search=${encodeURIComponent(searchTerm)}`
        : `${API_URL}/customers`;
      const response = await fetch(url);
      const data = await response.json();
      setCustomers(data);
    } catch (error) {
      console.error('Error fetching customers:', error);
    } finally {
      setLoading(false);
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

      {loading ? (
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
              top: '12px',
              right: '70px',
              background: '#dbeafe',
              border: '1px solid #93c5fd',
              borderRadius: '6px',
              padding: '6px 10px',
              cursor: 'pointer',
              fontSize: '14px',
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
            fetchCustomers();
          }}
        />
      )}
    </div>
  );
}

export default Customers;
