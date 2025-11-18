import { useState, useEffect } from 'react';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import Customers from './components/Customers';
import LoanDetails from './components/LoanDetails';
import PaymentTracker from './components/PaymentTracker';
import VaddiList from './components/VaddiList';
import MonthlyFinance from './components/MonthlyFinance';
import SundayCollections from './components/SundayCollections';
import OverduePayments from './components/OverduePayments';
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

  useEffect(() => {
    // Save login state to localStorage
    localStorage.setItem('isLoggedIn', isLoggedIn);
  }, [isLoggedIn]);

  const handleLogout = () => {
    setIsLoggedIn(false);
    localStorage.removeItem('isLoggedIn');
    setCurrentView('dashboard');
    setSelectedLoanId(null);
  };

  const navigateTo = (view, loanId = null) => {
    setCurrentView(view);
    setSelectedLoanId(loanId);
  };

  // Show login page if not logged in
  if (!isLoggedIn) {
    return <Login onLogin={setIsLoggedIn} />;
  }

  return (
    <div className="app">
      {currentView === 'dashboard' && <Dashboard navigateTo={navigateTo} />}
      {currentView === 'customers' && <Customers navigateTo={navigateTo} />}
      {currentView === 'sunday-collections' && <SundayCollections navigateTo={navigateTo} />}
      {currentView === 'overdue-payments' && <OverduePayments navigateTo={navigateTo} />}
      {currentView === 'payment-tracker' && <PaymentTracker navigateTo={navigateTo} />}
      {currentView === 'vaddi-list' && <VaddiList navigateTo={navigateTo} />}
      {currentView === 'monthly-finance' && <MonthlyFinance navigateTo={navigateTo} />}
      {currentView === 'loan-details' && selectedLoanId && (
        <LoanDetails loanId={selectedLoanId} navigateTo={navigateTo} />
      )}
    </div>
  );
}

export default App;
