import { useState, useEffect, useRef, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useParams } from 'react-router-dom';
import { API_URL } from './config';

// Small/critical components loaded immediately (needed on first render)
import Login from './components/Login';
import ModuleSelector from './components/ModuleSelector';
import ErrorBoundary from './components/ErrorBoundary';
import BalanceCheck from './components/BalanceCheck';
import FestivalBalanceCheck from './components/FestivalBalanceCheck';
import LandingPage from './components/LandingPage';
import { ThemeProvider } from './contexts/ThemeContext';
import { LanguageProvider } from './contexts/LanguageContext';
import './App.css';

// Heavy components loaded lazily — only downloaded when the user navigates to that page
const Dashboard = lazy(() => import('./components/Dashboard'));
const Customers = lazy(() => import('./components/Customers'));
const CustomerLoans = lazy(() => import('./components/CustomerLoans'));
const LoanDetails = lazy(() => import('./components/LoanDetails'));
const ExcelPaymentTracker = lazy(() => import('./components/ExcelPaymentTracker'));
const VaddiList = lazy(() => import('./components/VaddiList'));
const SundayCollections = lazy(() => import('./components/SundayCollections'));
const OverduePayments = lazy(() => import('./components/OverduePayments'));
const MonthlyFinanceView = lazy(() => import('./components/MonthlyFinanceView'));
const WeeklyFinanceView = lazy(() => import('./components/WeeklyFinanceView'));
const InvestmentsList = lazy(() => import('./components/InvestmentsList'));
const ArchivedLoans = lazy(() => import('./components/ArchivedLoans'));
const UserManagement = lazy(() => import('./components/UserManagement'));
const DailyFinance = lazy(() => import('./components/DailyFinance'));
const AdminProfit = lazy(() => import('./components/AdminProfit'));
const UserCollections = lazy(() => import('./components/UserCollections'));
const AdminCollections = lazy(() => import('./components/AdminCollections'));
const ChitDashboard = lazy(() => import('./components/ChitDashboard'));
const AutoFinanceDashboard = lazy(() => import('./components/AutoFinanceDashboard'));
const FestivalFund = lazy(() => import('./components/FestivalFund'));

// PASSWORD VERSION - Must match Login.jsx to keep session valid
const CURRENT_PASSWORD_VERSION = '2025-01-27-v2';

// Loading screen shown while a lazy component is being downloaded
function PageLoader() {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      height: '100vh',
      background: '#0f172a',
      color: '#94a3b8',
      gap: '16px'
    }}>
      <div style={{
        width: '40px',
        height: '40px',
        border: '3px solid #334155',
        borderTopColor: '#6366f1',
        borderRadius: '50%',
        animation: 'spin 0.8s linear infinite'
      }} />
      <div style={{ fontSize: '14px', letterSpacing: '0.05em' }}>Loading...</div>
    </div>
  );
}

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

function UserCollectionsWrapper() {
  const navigate = useNavigate();
  return <UserCollections navigateTo={(path) => navigate(`/${path}`)} />;
}

function AdminCollectionsWrapper() {
  const navigate = useNavigate();
  return <AdminCollections navigateTo={(path) => navigate(`/${path}`)} />;
}

function ChitDashboardWrapper() {
  const navigate = useNavigate();
  return <ChitDashboard navigateTo={(path) => navigate(`/${path}`)} />;
}

function AutoFinanceDashboardWrapper() {
  const navigate = useNavigate();
  return <AutoFinanceDashboard navigateTo={(path) => navigate(`/${path}`)} />;
}

function FestivalFundWrapper() {
  const navigate = useNavigate();
  return <FestivalFund navigateTo={(path) => navigate(`/${path}`)} />;
}


// Main app component wrapper
function AppContent() {
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

  const [selectedModule, setSelectedModule] = useState(null);

  useEffect(() => {
    // Save login state to localStorage
    localStorage.setItem('isLoggedIn', isLoggedIn);
    // Reset module selection when logged out
    if (!isLoggedIn) {
      setSelectedModule(null);
    }
  }, [isLoggedIn]);

  const handleLogout = () => {
    setIsLoggedIn(false);
    setSelectedModule(null); // Reset module selection on logout
    localStorage.removeItem('isLoggedIn');
  };

  // Show login page if not logged in
  if (!isLoggedIn) {
    return <Login onLoginSuccess={() => setIsLoggedIn(true)} />;
  }

  // Show module selector after login
  if (!selectedModule) {
    return <ModuleSelector onSelectModule={setSelectedModule} />;
  }

  // FINANCE MODULE - Only Finance routes
  if (selectedModule === 'finance') {
    return (
      <ThemeProvider>
        <LanguageProvider>
          <div className="app">
            <Suspense fallback={<PageLoader />}>
              <Routes>
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
                <Route path="/my-collections" element={<UserCollectionsWrapper />} />
                <Route path="/admin-collections" element={<AdminCollectionsWrapper />} />
                <Route path="*" element={<Navigate to="/dashboard" replace />} />
              </Routes>
            </Suspense>
          </div>
        </LanguageProvider>
      </ThemeProvider>
    );
  }

  // CHIT MODULE - Only Chit routes
  if (selectedModule === 'chit') {
    return (
      <ThemeProvider>
        <LanguageProvider>
          <div className="app">
            <Suspense fallback={<PageLoader />}>
              <Routes>
                <Route path="/chit-dashboard" element={<ChitDashboardWrapper />} />
                <Route path="*" element={<Navigate to="/chit-dashboard" replace />} />
              </Routes>
            </Suspense>
          </div>
        </LanguageProvider>
      </ThemeProvider>
    );
  }

  // AUTO FINANCE MODULE - Vehicle Loans & EMI
  if (selectedModule === 'auto-finance') {
    return (
      <ThemeProvider>
        <LanguageProvider>
          <div className="app">
            <Suspense fallback={<PageLoader />}>
              <Routes>
                <Route path="/auto-finance" element={<AutoFinanceDashboardWrapper />} />
                <Route path="*" element={<Navigate to="/auto-finance" replace />} />
              </Routes>
            </Suspense>
          </div>
        </LanguageProvider>
      </ThemeProvider>
    );
  }

  // FESTIVAL FUND MODULE
  if (selectedModule === 'festival-fund') {
    return (
      <div className="app">
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/festival-fund" element={<FestivalFundWrapper />} />
            <Route path="*" element={<Navigate to="/festival-fund" replace />} />
          </Routes>
        </Suspense>
      </div>
    );
  }

  // Fallback (should never reach here)
  return null;
}

// PWA update banner — shows when a new service worker is waiting
function PWAUpdateBanner() {
  const [show, setShow] = useState(false);
  const swRef = useRef(null);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.ready.then(reg => {
      const check = (sw) => {
        if (sw && sw.state === 'installed') { swRef.current = sw; setShow(true); }
      };
      if (reg.waiting) { swRef.current = reg.waiting; setShow(true); }
      reg.addEventListener('updatefound', () => {
        const sw = reg.installing;
        if (sw) sw.addEventListener('statechange', () => check(sw));
      });
    });
    // Poll for updates every 60 seconds
    const iv = setInterval(() => { navigator.serviceWorker.ready.then(r => r.update()); }, 60000);
    return () => clearInterval(iv);
  }, []);

  const reload = () => {
    if (swRef.current) {
      swRef.current.postMessage({ type: 'SKIP_WAITING' });
      window.location.reload();
    }
  };

  if (!show) return null;
  return (
    <div style={{
      position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 9999,
      background: 'linear-gradient(135deg,#1e40af,#1e3a8a)',
      padding: '12px 16px', display: 'flex', alignItems: 'center',
      justifyContent: 'space-between', gap: 12,
      borderTop: '2px solid #3b82f6', boxShadow: '0 -4px 20px rgba(0,0,0,0.4)'
    }}>
      <div>
        <div style={{ color: 'white', fontSize: 13, fontWeight: 700 }}>🆕 New version available</div>
        <div style={{ color: '#93c5fd', fontSize: 11 }}>Tap Update to get the latest features</div>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={() => setShow(false)}
          style={{ padding: '6px 12px', background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: 7, color: 'white', fontSize: 12, cursor: 'pointer' }}>
          Later
        </button>
        <button onClick={reload}
          style={{ padding: '6px 14px', background: '#3b82f6', border: 'none', borderRadius: 7, color: 'white', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
          Update Now
        </button>
      </div>
    </div>
  );
}

// Main App component with public routes
// Warm up the server the moment the app loads (fixes cold-start blank screen)
function ServerWarmup() {
  useEffect(() => { fetch(`${API_URL}/health`).catch(() => {}); }, []);
  return null;
}

function App() {
  return (
    <BrowserRouter>
      <ServerWarmup />
      <PWAUpdateBanner />
      <Routes>
        {/* Public routes - no authentication required */}
        <Route path="/website" element={<LandingPage />} />
        <Route path="/balance-check" element={<BalanceCheck />} />
        <Route path="/festival-balance-check" element={<FestivalBalanceCheck />} />

        {/* All other routes require authentication */}
        <Route path="/*" element={<AppContent />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
