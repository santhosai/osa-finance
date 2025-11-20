import { useState, useEffect } from 'react';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import Customers from './components/Customers';
import CustomerLoans from './components/CustomerLoans';
import LoanDetails from './components/LoanDetails';
import ExcelPaymentTracker from './components/ExcelPaymentTracker';
import VaddiList from './components/VaddiList';
import SundayCollections from './components/SundayCollections';
import OverduePayments from './components/OverduePayments';
import MonthlyFinanceView from './components/MonthlyFinanceView';
import WeeklyFinanceView from './components/WeeklyFinanceView';
import './App.css';

// PASSWORD VERSION - Must match Login.jsx to keep session valid
const CURRENT_PASSWORD_VERSION = '2025-01-18-v2';

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(() => {
    // Check localStorage for existing login session
    const loggedIn = localStorage.getItem('isLoggedIn') === 'true';
    const storedVersion = localStorage.getItem('passwordVersion');

    // Force logout if password version doesn't match (password was changed)
    if (loggedIn && storedVersion !== CURRENT_PASSWORD_VERSION) {
      localStorage.removeItem('isLoggedIn');
      localStorage.removeItem('passwordVersion');
      return false;
    }

    return loggedIn;
  });
  const [currentView, setCurrentView] = useState('dashboard');
  const [selectedLoanId, setSelectedLoanId] = useState(null);
  const [selectedCustomerId, setSelectedCustomerId] = useState(null);

  useEffect(() => {
    // Save login state to localStorage
    localStorage.setItem('isLoggedIn', isLoggedIn);
  }, [isLoggedIn]);

  const handleLogout = () => {
    setIsLoggedIn(false);
    localStorage.removeItem('isLoggedIn');
    setCurrentView('dashboard');
    setSelectedLoanId(null);
    setSelectedCustomerId(null);
  };

  const navigateTo = (view, id = null) => {
    setCurrentView(view);
    // id could be either loanId or customerId depending on the view
    if (view === 'loan-details') {
      setSelectedLoanId(id);
      setSelectedCustomerId(null);
    } else if (view === 'customer-loans') {
      setSelectedCustomerId(id);
      setSelectedLoanId(null);
    } else {
      setSelectedLoanId(null);
      setSelectedCustomerId(null);
    }
  };

  // Show login page if not logged in
  if (!isLoggedIn) {
    return <Login onLogin={setIsLoggedIn} />;
  }

  return (
    <div className="app">
      {currentView === 'dashboard' && <Dashboard navigateTo={navigateTo} />}
      {currentView === 'customers' && <Customers navigateTo={navigateTo} />}
      {currentView === 'customer-loans' && selectedCustomerId && (
        <CustomerLoans customerId={selectedCustomerId} navigateTo={navigateTo} />
      )}
      {currentView === 'sunday-collections' && <SundayCollections navigateTo={navigateTo} />}
      {currentView === 'overdue-payments' && <OverduePayments navigateTo={navigateTo} />}
      {currentView === 'payment-tracker' && <ExcelPaymentTracker navigateTo={navigateTo} />}
      {currentView === 'vaddi-list' && <VaddiList navigateTo={navigateTo} />}
      {currentView === 'weekly-finance' && <WeeklyFinanceView navigateTo={navigateTo} />}
      {currentView === 'monthly-finance' && <MonthlyFinanceView navigateTo={navigateTo} />}
      {currentView === 'loan-details' && selectedLoanId && (
        <LoanDetails loanId={selectedLoanId} navigateTo={navigateTo} />
      )}
    </div>
  );
}

export default App;
