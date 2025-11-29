import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useParams } from 'react-router-dom';
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
import InvestmentsList from './components/InvestmentsList';
import ArchivedLoans from './components/ArchivedLoans';
import UserManagement from './components/UserManagement';
import DailyFinance from './components/DailyFinance';
import AdminProfit from './components/AdminProfit';
import ErrorBoundary from './components/ErrorBoundary';
import { ThemeProvider } from './contexts/ThemeContext';
import { LanguageProvider } from './contexts/LanguageContext';
import './App.css';

// PASSWORD VERSION - Must match Login.jsx to keep session valid
const CURRENT_PASSWORD_VERSION = '2025-01-27-v2';

// Wrapper components that use useNavigate
function DashboardWrapper() {
  const navigate = useNavigate();
  return <Dashboard navigateTo={(path, id) => id ? navigate(`/${path}/${id}`) : navigate(`/${path}`)} />;
}

function CustomersWrapper() {
  const navigate = useNavigate();
  return <Customers navigateTo={(path, id) => id ? navigate(`/${path}/${id}`) : navigate(`/${path}`)} />;
}

function CustomerLoansWrapper() {
  const { customerId } = useParams();
  const navigate = useNavigate();
  return <CustomerLoans customerId={customerId} navigateTo={(path, id) => id ? navigate(`/${path}/${id}`) : navigate(`/${path}`)} />;
}

function LoanDetailsWrapper() {
  const { loanId } = useParams();
  const navigate = useNavigate();
  return <LoanDetails loanId={loanId} navigateTo={(path) => navigate(`/${path}`)} />;
}

function SundayCollectionsWrapper() {
  const navigate = useNavigate();
  return <SundayCollections navigateTo={(path) => navigate(`/${path}`)} />;
}

function OverduePaymentsWrapper() {
  const navigate = useNavigate();
  return <OverduePayments navigateTo={(path) => navigate(`/${path}`)} />;
}

function ExcelPaymentTrackerWrapper() {
  const navigate = useNavigate();
  return <ExcelPaymentTracker navigateTo={(path) => navigate(`/${path}`)} />;
}

function VaddiListWrapper() {
  const navigate = useNavigate();
  return (
    <ErrorBoundary>
      <VaddiList navigateTo={(path) => navigate(`/${path}`)} />
    </ErrorBoundary>
  );
}

function WeeklyFinanceViewWrapper() {
  const navigate = useNavigate();
  return <WeeklyFinanceView navigateTo={(path) => navigate(`/${path}`)} />;
}

function MonthlyFinanceViewWrapper() {
  const navigate = useNavigate();
  return <MonthlyFinanceView navigateTo={(path) => navigate(`/${path}`)} />;
}

function InvestmentsListWrapper() {
  const navigate = useNavigate();
  return <InvestmentsList navigateTo={(path) => navigate(`/${path}`)} />;
}

function ArchivedLoansWrapper() {
  const navigate = useNavigate();
  return <ArchivedLoans navigateTo={(path) => navigate(`/${path}`)} />;
}

function UserManagementWrapper() {
  const navigate = useNavigate();
  return <UserManagement navigateTo={(path) => navigate(`/${path}`)} />;
}

function DailyFinanceWrapper() {
  const navigate = useNavigate();
  return <DailyFinance navigateTo={(path) => navigate(`/${path}`)} />;
}

function AdminProfitWrapper() {
  const navigate = useNavigate();
  return <AdminProfit navigateTo={(path) => navigate(`/${path}`)} />;
}

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

  useEffect(() => {
    // Save login state to localStorage
    localStorage.setItem('isLoggedIn', isLoggedIn);
  }, [isLoggedIn]);

  const handleLogout = () => {
    setIsLoggedIn(false);
    localStorage.removeItem('isLoggedIn');
  };

  // Show login page if not logged in
  if (!isLoggedIn) {
    return <Login onLogin={setIsLoggedIn} />;
  }

  return (
    <ThemeProvider>
      <LanguageProvider>
        <BrowserRouter>
          <div className="app">
            <Routes>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard" element={<DashboardWrapper />} />
              <Route path="/customers" element={<CustomersWrapper />} />
              <Route path="/customer-loans/:customerId" element={<CustomerLoansWrapper />} />
              <Route path="/loan-details/:loanId" element={<LoanDetailsWrapper />} />
              <Route path="/sunday-collections" element={<SundayCollectionsWrapper />} />
              <Route path="/overdue-payments" element={<OverduePaymentsWrapper />} />
              <Route path="/payment-tracker" element={<ExcelPaymentTrackerWrapper />} />
              <Route path="/vaddi-list" element={<VaddiListWrapper />} />
              <Route path="/weekly-finance" element={<WeeklyFinanceViewWrapper />} />
              <Route path="/monthly-finance" element={<MonthlyFinanceViewWrapper />} />
              <Route path="/investments" element={<InvestmentsListWrapper />} />
              <Route path="/archived-loans" element={<ArchivedLoansWrapper />} />
              <Route path="/daily-finance" element={<DailyFinanceWrapper />} />
              <Route path="/user-management" element={<UserManagementWrapper />} />
              <Route path="/admin-profit" element={<AdminProfitWrapper />} />
            </Routes>
          </div>
        </BrowserRouter>
      </LanguageProvider>
    </ThemeProvider>
  );
}

export default App;
