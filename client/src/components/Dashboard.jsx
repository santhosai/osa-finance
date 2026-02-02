import { useState, useEffect, useRef, useCallback } from 'react';
import useSWR from 'swr';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import AddCustomerModal from './AddCustomerModal';
import PaymentsThisWeekModal from './PaymentsThisWeekModal';
import DatabaseMonitorModal from './DatabaseMonitorModal';
import SendWishes from './SendWishes';
import PrintReceipt from './PrintReceipt';
import PrintReports from './PrintReports';
import BackupData from './BackupData';
import GlobalSearch from './GlobalSearch';
import AllPaymentsDueModal from './AllPaymentsDueModal';
import PaymentReminders from './PaymentReminders';
import BulkWhatsApp from './BulkWhatsApp';
import Reports from './Reports';
import { jsPDF } from 'jspdf';
import { API_URL } from '../config';
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';
import { requestNotificationPermission, onForegroundMessage } from '../firebase';

// Fetcher function for SWR
const fetcher = (url) => fetch(url).then(res => res.json());

function Dashboard({ navigateTo }) {
  // Theme and Language hooks
  const { isDarkMode, toggleDarkMode, theme } = useTheme();
  const { language, toggleLanguage, t } = useLanguage();

  const [showAddCustomerModal, setShowAddCustomerModal] = useState(false);
  const [showPaymentsThisWeekModal, setShowPaymentsThisWeekModal] = useState(false);
  const [showDatabaseMonitorModal, setShowDatabaseMonitorModal] = useState(false);
  const [showQuickRefModal, setShowQuickRefModal] = useState(false);
  const [showSendWishes, setShowSendWishes] = useState(false);
  const [showPrintReports, setShowPrintReports] = useState(false);
  const [showBackupModal, setShowBackupModal] = useState(false);
  const [showGlobalSearch, setShowGlobalSearch] = useState(false);
  const [showAllPaymentsDue, setShowAllPaymentsDue] = useState(false);
  const [showPaymentReminders, setShowPaymentReminders] = useState(false);
  const [showBulkWhatsApp, setShowBulkWhatsApp] = useState(false);
  const [showReports, setShowReports] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedMonthlyFinanceMonth, setSelectedMonthlyFinanceMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM format
  const [weeklyPaymentsData, setWeeklyPaymentsData] = useState({ paidLoans: [], unpaidLoans: [], loading: true });
  const [paymentsRefreshKey, setPaymentsRefreshKey] = useState(0); // To trigger re-fetch
  const [searchTerm, setSearchTerm] = useState('');
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [selectedUnpaid, setSelectedUnpaid] = useState(new Set());
  const [selectedPaid, setSelectedPaid] = useState(new Set()); // For bulk undo
  const [quickPayConfirm, setQuickPayConfirm] = useState(null); // { loan, customer, amount, weekNumber }
  const [isPaymentLoading, setIsPaymentLoading] = useState(false);
  const [undoPaymentConfirm, setUndoPaymentConfirm] = useState(null); // { loan, customer, paymentId }
  const [weeklyDiagnostic, setWeeklyDiagnostic] = useState(null); // Weekly loans overview
  const [showCharts, setShowCharts] = useState(false); // Toggle charts visibility
  const [loansGivenDate, setLoansGivenDate] = useState(new Date().toISOString().split('T')[0]); // For loans given tracker
  const [showLoansGivenModal, setShowLoansGivenModal] = useState(false); // For loans given modal
  const [printData, setPrintData] = useState(null); // For print receipt
  const [monthlyPaymentConfirm, setMonthlyPaymentConfirm] = useState(null); // For Monthly Finance payment confirmation
  const [monthlyUndoConfirm, setMonthlyUndoConfirm] = useState(null); // For Monthly Finance undo confirmation
  const [quickNote, setQuickNote] = useState(() => localStorage.getItem('dashboardQuickNote') || ''); // Quick Note
  const [showQuickNote, setShowQuickNote] = useState(true); // Show/hide quick note
  const [noteMode, setNoteMode] = useState('text'); // 'text' or 'draw' for stylus
  const [isDrawing, setIsDrawing] = useState(false);
  const [penColor, setPenColor] = useState('#000000');
  const [penSize, setPenSize] = useState(2);
  const canvasRef = useRef(null);
  const contextRef = useRef(null);

  // Pending Payments (UPI) state
  const [showPendingPayments, setShowPendingPayments] = useState(false);

  // Push Notification state
  const [notificationStatus, setNotificationStatus] = useState('unknown'); // 'unknown', 'enabled', 'disabled', 'error'

  // Use SWR for automatic caching and re-fetching
  const { data: stats, error, isLoading, mutate } = useSWR(`${API_URL}/stats`, fetcher, {
    refreshInterval: 30000, // Auto-refresh every 30 seconds
    revalidateOnFocus: true, // Auto-refresh when user returns to tab
    dedupingInterval: 2000, // Prevent duplicate requests within 2s
  });

  // Fetch customers with loans for the table
  const { data: customers = [], mutate: mutateCustomers } = useSWR(`${API_URL}/customers`, fetcher, {
    refreshInterval: 30000, // Auto-refresh every 30 seconds
    revalidateOnFocus: true,
    dedupingInterval: 2000,
  });

  // Get current month for Vaddi summary
  const currentMonth = (() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  })();

  // Fetch Vaddi monthly summary
  const { data: vaddiSummary = {} } = useSWR(`${API_URL}/vaddi-summary?month=${currentMonth}`, fetcher, {
    refreshInterval: 30000,
    revalidateOnFocus: true,
    dedupingInterval: 2000,
  });

  // Fetch Daily Finance summary
  const { data: dailySummary = {} } = useSWR(`${API_URL}/daily-summary`, fetcher, {
    refreshInterval: 30000,
    revalidateOnFocus: true,
    dedupingInterval: 2000,
  });

  // Fetch Monthly Finance customers
  const { data: monthlyCustomers = [], mutate: mutateMonthly } = useSWR(
    `${API_URL}/monthly-finance/customers`,
    fetcher,
    {
      refreshInterval: 30000,
      revalidateOnFocus: true,
      dedupingInterval: 2000,
    }
  );

  // Fetch Loans Given by date
  const { data: loansGivenData = { loans: [], total: 0, count: 0 } } = useSWR(
    `${API_URL}/loans-by-date?date=${loansGivenDate}`,
    fetcher,
    {
      refreshInterval: 30000,
      revalidateOnFocus: true,
      dedupingInterval: 2000,
    }
  );

  // Fetch Pending UPI Payments
  const { data: pendingPayments = [], mutate: mutatePendingPayments } = useSWR(
    `${API_URL}/pending-payments?status=pending`,
    fetcher,
    {
      refreshInterval: 15000, // Auto-refresh every 15 seconds for pending payments
      revalidateOnFocus: true,
      dedupingInterval: 2000,
    }
  );

  // Track previous pending payments count for notifications
  const prevPendingCountRef = useRef(0);
  const notificationAudioRef = useRef(null);

  // Function to enable push notifications manually
  const enablePushNotifications = async () => {
    try {
      setNotificationStatus('enabling');

      // Request permission and get FCM token
      const fcmToken = await requestNotificationPermission();

      if (fcmToken) {
        // Save FCM token to server
        const response = await fetch(`${API_URL}/register-fcm-token`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            token: fcmToken,
            userRole: 'admin',
            deviceInfo: navigator.userAgent
          })
        });

        if (response.ok) {
          setNotificationStatus('enabled');
          alert('✅ Push notifications enabled!\n\nYou will now receive alerts when customers make payments.');
        } else {
          throw new Error('Failed to register token');
        }
      } else {
        setNotificationStatus('disabled');
        alert('❌ Notifications blocked!\n\nPlease allow notifications in your browser settings.');
      }
    } catch (error) {
      console.error('FCM setup error:', error);
      setNotificationStatus('error');
      alert('❌ Error enabling notifications:\n' + error.message);
    }
  };

  // Request notification permission and register FCM token on mount
  useEffect(() => {
    const setupNotifications = async () => {
      const userRole = localStorage.getItem('userRole');

      // Only setup FCM for admin users
      if (userRole === 'admin') {
        try {
          // Check current permission status
          if ('Notification' in window) {
            if (Notification.permission === 'granted') {
              // Try to get FCM token
              const fcmToken = await requestNotificationPermission();
              if (fcmToken) {
                await fetch(`${API_URL}/register-fcm-token`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    token: fcmToken,
                    userRole: 'admin',
                    deviceInfo: navigator.userAgent
                  })
                });
                setNotificationStatus('enabled');
                console.log('FCM token registered successfully');
              } else {
                setNotificationStatus('error');
              }
            } else if (Notification.permission === 'denied') {
              setNotificationStatus('disabled');
            } else {
              setNotificationStatus('unknown');
            }
          }
        } catch (error) {
          console.error('FCM setup error:', error);
          setNotificationStatus('error');
        }

        // Listen for foreground messages
        const unsubscribe = onForegroundMessage((payload) => {
          console.log('Foreground notification received:', payload);

          // Play custom notification sound
          try {
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();

            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);

            oscillator.frequency.value = 880;
            oscillator.type = 'sine';

            gainNode.gain.setValueAtTime(0.5, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.8);

            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.8);

            setTimeout(() => {
              const osc2 = audioContext.createOscillator();
              const gain2 = audioContext.createGain();
              osc2.connect(gain2);
              gain2.connect(audioContext.destination);
              osc2.frequency.value = 1100;
              osc2.type = 'sine';
              gain2.gain.setValueAtTime(0.5, audioContext.currentTime);
              gain2.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
              osc2.start(audioContext.currentTime);
              osc2.stop(audioContext.currentTime + 0.5);
            }, 200);
          } catch (error) {
            console.error('Error playing notification sound:', error);
          }

          // Show in-app notification
          if (payload.notification) {
            const notification = new Notification(payload.notification.title, {
              body: payload.notification.body,
              icon: '/murugan.png',
              requireInteraction: true,
              vibrate: [200, 100, 200, 100, 200]
            });

            notification.onclick = () => {
              window.focus();
              notification.close();
              mutatePendingPayments();
            };
          }
        });

        return () => unsubscribe();
      }
    };

    setupNotifications();
  }, []);

  // Monitor for new pending payments and trigger notifications
  useEffect(() => {
    if (!pendingPayments || pendingPayments.length === 0) {
      prevPendingCountRef.current = 0;
      return;
    }

    const currentCount = pendingPayments.length;
    const prevCount = prevPendingCountRef.current;

    // If we have new pending payments (count increased)
    if (currentCount > prevCount && prevCount > 0) {
      const newPaymentsCount = currentCount - prevCount;

      // Play notification sound (when app is active)
      try {
        // Create notification sound (beep) - works when tab is active
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        oscillator.frequency.value = 800; // Frequency in Hz
        oscillator.type = 'sine';

        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);

        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.5);
      } catch (error) {
        console.error('Error playing notification sound:', error);
      }

      // Show browser notification with sound and vibration
      if ('Notification' in window && Notification.permission === 'granted') {
        const notification = new Notification('🔔 New UPI Payment Request', {
          body: `${newPaymentsCount} new payment${newPaymentsCount > 1 ? 's' : ''} pending approval\nClick to view details`,
          icon: '/favicon.ico',
          badge: '/favicon.ico',
          tag: 'pending-payment',
          requireInteraction: true, // Keeps notification visible until user interacts
          silent: false, // Explicitly request sound (browser/OS will play default notification sound)
          vibrate: [200, 100, 200, 100, 200], // Vibration pattern for mobile devices
          renotify: true, // Re-alert even if notification with same tag exists
          timestamp: Date.now(),
        });

        // Focus window when notification is clicked
        notification.onclick = () => {
          window.focus();
          notification.close();
          // Scroll to pending payments section
          const pendingSection = document.querySelector('[data-section="pending-payments"]');
          if (pendingSection) {
            pendingSection.scrollIntoView({ behavior: 'smooth' });
          }
        };
      }
    }

    // Update previous count
    prevPendingCountRef.current = currentCount;
  }, [pendingPayments]);

  // Fetch weekly payments data when selectedDate or customers change
  const customersLength = customers?.length || 0;
  useEffect(() => {
    if (customersLength === 0) return;

    const fetchWeeklyPayments = async () => {
      setWeeklyPaymentsData({ paidLoans: [], unpaidLoans: [], loading: true });

      const selected = new Date(selectedDate + 'T00:00:00');
      const isSunday = selected.getDay() === 0;

      if (!isSunday) {
        setWeeklyPaymentsData({ paidLoans: [], unpaidLoans: [], loading: false });
        return;
      }

      const sundayDate = selectedDate;

      // Helper to get first payment Sunday
      const getFirstPaymentSunday = (startDateStr) => {
        const date = new Date(startDateStr + 'T00:00:00');
        const dayOfWeek = date.getDay();
        if (dayOfWeek === 0) return date;
        const daysUntilSunday = 7 - dayOfWeek;
        const firstSunday = new Date(date);
        firstSunday.setDate(date.getDate() + daysUntilSunday);
        return firstSunday;
      };

      // Get all loan IDs that need payment check
      const loansToCheck = [];
      if (!Array.isArray(customers)) {
        setWeeklyPaymentsData({ paidLoans: [], unpaidLoans: [], loading: false });
        return;
      }
      customers.forEach(customer => {
        if (!customer.loans || customer.loans.length === 0) return;
        customer.loans.forEach(loan => {
          if (loan.status === 'closed' || loan.loan_type !== 'Weekly' || loan.balance <= 0) return;

          // Skip loans where first payment Sunday hasn't arrived yet
          const firstPaymentSunday = getFirstPaymentSunday(loan.start_date);
          if (firstPaymentSunday > selected) return; // First payment is in the future

          // NEW LOGIC: Week number based on payments made, not calendar weeks
          // paymentsMade = how much collected / weekly amount
          const collected = loan.loan_amount - loan.balance;
          const paymentsMade = Math.floor(collected / loan.weekly_amount);
          const weekNumber = paymentsMade + 1; // Next week to pay

          // Show ALL loans with balance > 0 every Sunday (no more week 10 limit)
          // They owe money, so they should pay!
          loansToCheck.push({ customer, loan, weekNumber });
        });
      });

      if (loansToCheck.length === 0) {
        setWeeklyPaymentsData({ paidLoans: [], unpaidLoans: [], loading: false });
        return;
      }

      // Batch fetch: get all payments for this date in one call
      try {
        const paymentsResponse = await fetch(`${API_URL}/payments-by-date?date=${sundayDate}`);
        const paymentsOnDate = paymentsResponse.ok ? await paymentsResponse.json() : [];

        // Create a Map of loan_id -> payment data (includes balance_after and week_number)
        const paidLoanPayments = new Map(paymentsOnDate.map(p => [p.loan_id, p]));

        const paidLoans = [];
        const unpaidLoans = [];

        loansToCheck.forEach(({ customer, loan, weekNumber }) => {
          const totalWeeks = 10;
          const payment = paidLoanPayments.get(loan.loan_id);
          const isPaid = !!payment;

          // For paid loans, use the actual payment data (balance_after, week_number)
          // For unpaid loans, use the calculated values
          const actualWeekNumber = isPaid && payment.week_number ? payment.week_number : weekNumber;
          const actualBalance = isPaid && payment.balance_after !== undefined ? payment.balance_after : loan.balance;
          const remainingWeeks = totalWeeks - actualWeekNumber;

          const result = {
            customer,
            loan,
            weekNumber: actualWeekNumber,
            totalWeeks,
            remainingWeeks,
            paymentAmount: loan.weekly_amount,
            balance: actualBalance,
            isPaid,
            payment // Include payment data for WhatsApp
          };

          if (isPaid) {
            paidLoans.push(result);
          } else {
            unpaidLoans.push(result);
          }
        });

        setWeeklyPaymentsData({ paidLoans, unpaidLoans, loading: false });
      } catch (error) {
        console.error('Error fetching payments:', error);
        setWeeklyPaymentsData({ paidLoans: [], unpaidLoans: [], loading: false });
      }
    };

    fetchWeeklyPayments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate, customersLength, paymentsRefreshKey]);

  // Fetch weekly diagnostic data for overview
  useEffect(() => {
    const fetchDiagnostic = async () => {
      try {
        const response = await fetch(`${API_URL}/weekly-diagnostic`);
        if (response.ok) {
          const data = await response.json();
          // Calculate total balance from all loans
          const totalBalance = data.allLoans.reduce((sum, loan) => sum + loan.balance, 0);
          setWeeklyDiagnostic({
            ...data.summary,
            totalBalance,
            allLoans: data.allLoans
          });
        }
      } catch (error) {
        console.error('Error fetching diagnostic:', error);
      }
    };

    fetchDiagnostic();
  }, []); // Run on mount

  const formatCurrency = (amount) => {
    return `₹${amount.toLocaleString('en-IN')}`;
  };

  // Helper function to determine card background color based on outstanding balance
  const getUnpaidCardColor = (balance) => {
    if (balance > 10000) {
      return 'linear-gradient(135deg, #fee2e2 0%, #fca5a5 100%)'; // Red for high balance
    }
    if (balance > 5000) {
      return 'linear-gradient(135deg, #fed7aa 0%, #fb923c 100%)'; // Orange for medium balance
    }
    return 'linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%)'; // Light red for low balance
  };

  const handleRefresh = () => {
    mutate(); // SWR: Re-fetch stats
    mutateCustomers(); // SWR: Re-fetch customers
  };

  const handleLogout = () => {
    localStorage.removeItem('isLoggedIn');
    window.location.reload();
  };

  // Save Quick Note to localStorage
  const saveQuickNote = (note) => {
    setQuickNote(note);
    localStorage.setItem('dashboardQuickNote', note);
  };

  // Canvas drawing functions for stylus support
  const initializeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Set canvas size
    const container = canvas.parentElement;
    canvas.width = container.offsetWidth - 20;
    canvas.height = 200;

    const context = canvas.getContext('2d');
    context.lineCap = 'round';
    context.lineJoin = 'round';
    context.strokeStyle = penColor;
    context.lineWidth = penSize;
    contextRef.current = context;

    // Load saved drawing if exists
    const savedDrawing = localStorage.getItem('dashboardQuickDrawing');
    if (savedDrawing) {
      const img = new Image();
      img.onload = () => {
        context.drawImage(img, 0, 0);
      };
      img.src = savedDrawing;
    }
  }, [penColor, penSize]);

  useEffect(() => {
    if (noteMode === 'draw' && showQuickNote) {
      setTimeout(initializeCanvas, 100);
    }
  }, [noteMode, showQuickNote, initializeCanvas]);

  const getCanvasCoordinates = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();

    // Handle both touch and mouse events
    if (e.touches && e.touches[0]) {
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top
      };
    }
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
  };

  const startDrawing = (e) => {
    e.preventDefault();
    const { x, y } = getCanvasCoordinates(e);
    contextRef.current.beginPath();
    contextRef.current.moveTo(x, y);
    setIsDrawing(true);
  };

  const draw = (e) => {
    if (!isDrawing) return;
    e.preventDefault();
    const { x, y } = getCanvasCoordinates(e);
    contextRef.current.lineTo(x, y);
    contextRef.current.stroke();
  };

  const stopDrawing = () => {
    if (isDrawing) {
      contextRef.current.closePath();
      setIsDrawing(false);
      // Save drawing to localStorage
      const canvas = canvasRef.current;
      if (canvas) {
        const dataUrl = canvas.toDataURL();
        localStorage.setItem('dashboardQuickDrawing', dataUrl);
      }
    }
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');
    context.clearRect(0, 0, canvas.width, canvas.height);
    localStorage.removeItem('dashboardQuickDrawing');
  };

  const updatePenSettings = () => {
    if (contextRef.current) {
      contextRef.current.strokeStyle = penColor;
      contextRef.current.lineWidth = penSize;
    }
  };

  useEffect(() => {
    updatePenSettings();
  }, [penColor, penSize]);

  // Toggle selection of unpaid customer for WhatsApp share
  const toggleUnpaidSelection = (loanId) => {
    setSelectedUnpaid(prev => {
      const newSet = new Set(prev);
      if (newSet.has(loanId)) {
        newSet.delete(loanId);
      } else {
        newSet.add(loanId);
      }
      return newSet;
    });
  };

  // Select/Deselect all unpaid customers
  const toggleSelectAll = (unpaidLoans) => {
    if (selectedUnpaid.size === unpaidLoans.length) {
      setSelectedUnpaid(new Set());
    } else {
      setSelectedUnpaid(new Set(unpaidLoans.map(item => item.loan.loan_id)));
    }
  };

  // Share selected customers via WhatsApp
  const shareViaWhatsApp = (unpaidLoans) => {
    const selectedItems = unpaidLoans.filter(item => selectedUnpaid.has(item.loan.loan_id));
    if (selectedItems.length === 0) {
      alert('Please select at least one customer to share');
      return;
    }

    const dateStr = new Date(selectedDate).toLocaleDateString('en-IN', {
      weekday: 'long',
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });

    let message = `📅 *Weekly Collection - ${dateStr}*\n\n`;
    message += `Total: ${selectedItems.length} customers\n`;
    message += `━━━━━━━━━━━━━━━━━━\n\n`;

    selectedItems.forEach((item, index) => {
      const loanName = item.loan.loan_name && item.loan.loan_name !== 'General Loan'
        ? ` (${item.loan.loan_name})`
        : '';
      message += `${index + 1}. *${item.customer.name}*${loanName}\n`;
      message += `   Week ${item.weekNumber}/10 • ₹${item.paymentAmount.toLocaleString('en-IN')}\n`;
      if (item.customer.phone) {
        message += `   📞 ${item.customer.phone}\n`;
      }
      message += `\n`;
    });

    const totalAmount = selectedItems.reduce((sum, item) => sum + item.paymentAmount, 0);
    message += `━━━━━━━━━━━━━━━━━━\n`;
    message += `💰 *Total to Collect: ₹${totalAmount.toLocaleString('en-IN')}*`;

    const encodedMessage = encodeURIComponent(message);
    window.open(`https://wa.me/?text=${encodedMessage}`, '_blank');
  };

  // ESC/POS Commands for Thermal Printer
  const ESC = '\x1B';
  const GS = '\x1D';
  const THERMAL_COMMANDS = {
    INIT: ESC + '@',
    ALIGN_CENTER: ESC + 'a' + '\x01',
    ALIGN_LEFT: ESC + 'a' + '\x00',
    BOLD_ON: ESC + 'E' + '\x01',
    BOLD_OFF: ESC + 'E' + '\x00',
    DOUBLE_HEIGHT: GS + '!' + '\x10',
    NORMAL_SIZE: GS + '!' + '\x00',
    FEED: ESC + 'd' + '\x03',
    PARTIAL_CUT: GS + 'V' + '\x01',
    LINE: '--------------------------------\n',
    DASHED: '- - - - - - - - - - - - - - - -\n'
  };

  // Print Daily Summary via Thermal Printer
  const printDailySummaryThermal = async () => {
    const { paidLoans, unpaidLoans } = weeklyPaymentsData;
    if (paidLoans.length === 0 && unpaidLoans.length === 0) {
      alert('No data to print');
      return;
    }

    const paidTotal = paidLoans.reduce((sum, item) => sum + item.paymentAmount, 0);
    const unpaidTotal = unpaidLoans.reduce((sum, item) => sum + item.paymentAmount, 0);
    const dateStr = new Date(selectedDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

    let receipt = THERMAL_COMMANDS.INIT;
    receipt += THERMAL_COMMANDS.ALIGN_CENTER;
    receipt += THERMAL_COMMANDS.BOLD_ON;
    receipt += THERMAL_COMMANDS.DOUBLE_HEIGHT;
    receipt += 'OM SAI MURUGAN\n';
    receipt += 'FINANCE\n';
    receipt += THERMAL_COMMANDS.NORMAL_SIZE;
    receipt += THERMAL_COMMANDS.BOLD_OFF;
    receipt += THERMAL_COMMANDS.LINE;
    receipt += THERMAL_COMMANDS.BOLD_ON;
    receipt += '** DAILY COLLECTION **\n';
    receipt += `** ${dateStr} **\n`;
    receipt += THERMAL_COMMANDS.BOLD_OFF;
    receipt += THERMAL_COMMANDS.LINE;

    // Summary
    receipt += THERMAL_COMMANDS.ALIGN_LEFT;
    receipt += `Paid: ${paidLoans.length} | Rs.${paidTotal.toLocaleString('en-IN')}\n`;
    receipt += `Unpaid: ${unpaidLoans.length} | Rs.${unpaidTotal.toLocaleString('en-IN')}\n`;
    receipt += THERMAL_COMMANDS.BOLD_ON;
    receipt += `TOTAL: Rs.${(paidTotal + unpaidTotal).toLocaleString('en-IN')}\n`;
    receipt += THERMAL_COMMANDS.BOLD_OFF;
    receipt += THERMAL_COMMANDS.LINE;

    // Paid List
    if (paidLoans.length > 0) {
      receipt += THERMAL_COMMANDS.BOLD_ON;
      receipt += `PAID (${paidLoans.length}):\n`;
      receipt += THERMAL_COMMANDS.BOLD_OFF;
      paidLoans.forEach((item, i) => {
        receipt += `${i + 1}.${item.customer.name.substring(0, 15)}\n`;
        receipt += `  Rs.${item.paymentAmount.toLocaleString('en-IN')} Wk${item.weekNumber}\n`;
      });
      receipt += THERMAL_COMMANDS.DASHED;
    }

    // Unpaid List
    if (unpaidLoans.length > 0) {
      receipt += THERMAL_COMMANDS.BOLD_ON;
      receipt += `NOT PAID (${unpaidLoans.length}):\n`;
      receipt += THERMAL_COMMANDS.BOLD_OFF;
      unpaidLoans.forEach((item, i) => {
        receipt += `${i + 1}.${item.customer.name.substring(0, 15)}\n`;
        receipt += `  Rs.${item.paymentAmount.toLocaleString('en-IN')} Bal:${item.balance.toLocaleString('en-IN')}\n`;
      });
      receipt += THERMAL_COMMANDS.DASHED;
    }

    receipt += THERMAL_COMMANDS.ALIGN_CENTER;
    receipt += `Collected: Rs.${paidTotal.toLocaleString('en-IN')}\n`;
    receipt += 'Ph: 8667510724\n';
    receipt += THERMAL_COMMANDS.FEED;
    receipt += THERMAL_COMMANDS.PARTIAL_CUT;

    // Try to print via Bluetooth
    try {
      if (!navigator.bluetooth) {
        alert('Bluetooth not supported. Use the Normal Print option or RawBT app.');
        return;
      }

      const device = await navigator.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: ['000018f0-0000-1000-8000-00805f9b34fb', '49535343-fe7d-4ae5-8fa9-9fafd205e455', 'e7810a71-73ae-499d-8c15-faa9aef0c3f2']
      });

      const server = await device.gatt.connect();
      const services = await server.getPrimaryServices();
      let characteristic = null;

      for (const service of services) {
        try {
          const characteristics = await service.getCharacteristics();
          for (const char of characteristics) {
            if (char.properties.write || char.properties.writeWithoutResponse) {
              characteristic = char;
              break;
            }
          }
          if (characteristic) break;
        } catch (e) {}
      }

      if (!characteristic) {
        alert('Printer not compatible');
        return;
      }

      const encoder = new TextEncoder();
      const bytes = encoder.encode(receipt);
      const chunkSize = 100;

      for (let i = 0; i < bytes.length; i += chunkSize) {
        const chunk = bytes.slice(i, i + chunkSize);
        if (characteristic.properties.writeWithoutResponse) {
          await characteristic.writeValueWithoutResponse(chunk);
        } else {
          await characteristic.writeValue(chunk);
        }
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      alert('Printed successfully!');
    } catch (error) {
      console.error('Print error:', error);
      alert('Print failed: ' + error.message);
    }
  };

  // Print Loans Given via Thermal Printer
  const printLoansGivenThermal = async (loansData, dateStr) => {
    if (!loansData || loansData.length === 0) {
      alert('No loans to print');
      return;
    }

    console.log('🖨️ Printing loans data:', loansData);
    const totalGiven = loansData.reduce((sum, loan) => sum + (loan.loan_amount || loan.loanAmount || 0), 0);

    let receipt = THERMAL_COMMANDS.INIT;
    receipt += THERMAL_COMMANDS.ALIGN_CENTER;
    receipt += THERMAL_COMMANDS.BOLD_ON;
    receipt += THERMAL_COMMANDS.DOUBLE_HEIGHT;
    receipt += 'OM SAI MURUGAN\n';
    receipt += 'FINANCE\n';
    receipt += THERMAL_COMMANDS.NORMAL_SIZE;
    receipt += THERMAL_COMMANDS.BOLD_OFF;
    receipt += THERMAL_COMMANDS.LINE;
    receipt += THERMAL_COMMANDS.BOLD_ON;
    receipt += '** LOANS GIVEN **\n';
    receipt += `** ${dateStr} **\n`;
    receipt += THERMAL_COMMANDS.BOLD_OFF;
    receipt += THERMAL_COMMANDS.LINE;

    receipt += THERMAL_COMMANDS.ALIGN_LEFT;
    receipt += `Total Loans: ${loansData.length}\n`;
    receipt += THERMAL_COMMANDS.BOLD_ON;
    receipt += `TOTAL: Rs.${totalGiven.toLocaleString('en-IN')}\n`;
    receipt += THERMAL_COMMANDS.BOLD_OFF;
    receipt += THERMAL_COMMANDS.DASHED;

    loansData.forEach((item, i) => {
      console.log(`Loan ${i + 1}:`, item);
      const name = (item.customer_name || item.name || item.customerName || item.customer?.name || 'Customer').trim();
      const amount = item.loan_amount || item.loanAmount || 0;
      console.log(`  Name: "${name}", Amount: ${amount}`);
      receipt += `${i + 1}.${name.substring(0, 18)}\n`;
      receipt += `  Rs.${amount.toLocaleString('en-IN')}\n`;
    });

    receipt += THERMAL_COMMANDS.LINE;
    receipt += THERMAL_COMMANDS.ALIGN_CENTER;
    receipt += THERMAL_COMMANDS.BOLD_ON;
    receipt += `TOTAL: Rs.${totalGiven.toLocaleString('en-IN')}\n`;
    receipt += THERMAL_COMMANDS.BOLD_OFF;
    receipt += 'Ph: 8667510724\n';
    receipt += THERMAL_COMMANDS.FEED;
    receipt += THERMAL_COMMANDS.PARTIAL_CUT;

    // Try to print via Bluetooth
    try {
      if (!navigator.bluetooth) {
        alert('Bluetooth not supported. Use the Normal Print option or RawBT app.');
        return;
      }

      const device = await navigator.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: ['000018f0-0000-1000-8000-00805f9b34fb', '49535343-fe7d-4ae5-8fa9-9fafd205e455', 'e7810a71-73ae-499d-8c15-faa9aef0c3f2']
      });

      const server = await device.gatt.connect();
      const services = await server.getPrimaryServices();
      let characteristic = null;

      for (const service of services) {
        try {
          const characteristics = await service.getCharacteristics();
          for (const char of characteristics) {
            if (char.properties.write || char.properties.writeWithoutResponse) {
              characteristic = char;
              break;
            }
          }
          if (characteristic) break;
        } catch (e) {}
      }

      if (!characteristic) {
        alert('Printer not compatible');
        return;
      }

      const encoder = new TextEncoder();
      const bytes = encoder.encode(receipt);
      const chunkSize = 100;

      for (let i = 0; i < bytes.length; i += chunkSize) {
        const chunk = bytes.slice(i, i + chunkSize);
        if (characteristic.properties.writeWithoutResponse) {
          await characteristic.writeValueWithoutResponse(chunk);
        } else {
          await characteristic.writeValue(chunk);
        }
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      alert('Printed successfully!');
    } catch (error) {
      console.error('Print error:', error);
      alert('Print failed: ' + error.message);
    }
  };

  // Print Monthly Finance Audit via Thermal Printer
  const printMonthlyFinanceAuditThermal = async (paidList, unpaidList) => {
    if (paidList.length === 0 && unpaidList.length === 0) {
      alert('No data to print');
      return;
    }

    const paidTotal = paidList.reduce((sum, item) => sum + (item.monthly_amount || 0), 0);
    const unpaidTotal = unpaidList.reduce((sum, item) => sum + (item.monthly_amount || 0), 0);
    const now = new Date();
    const monthName = now.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });

    let receipt = THERMAL_COMMANDS.INIT;
    receipt += THERMAL_COMMANDS.ALIGN_CENTER;
    receipt += THERMAL_COMMANDS.BOLD_ON;
    receipt += THERMAL_COMMANDS.DOUBLE_HEIGHT;
    receipt += 'OM SAI MURUGAN\n';
    receipt += 'FINANCE\n';
    receipt += THERMAL_COMMANDS.NORMAL_SIZE;
    receipt += THERMAL_COMMANDS.BOLD_OFF;
    receipt += THERMAL_COMMANDS.LINE;
    receipt += THERMAL_COMMANDS.BOLD_ON;
    receipt += '** MONTHLY COLLECTION **\n';
    receipt += `** ${monthName} **\n`;
    receipt += THERMAL_COMMANDS.BOLD_OFF;
    receipt += THERMAL_COMMANDS.LINE;

    // Summary
    receipt += THERMAL_COMMANDS.ALIGN_LEFT;
    receipt += `Paid: ${paidList.length} | Rs.${paidTotal.toLocaleString('en-IN')}\n`;
    receipt += `Unpaid: ${unpaidList.length} | Rs.${unpaidTotal.toLocaleString('en-IN')}\n`;
    receipt += THERMAL_COMMANDS.BOLD_ON;
    receipt += `TOTAL: Rs.${(paidTotal + unpaidTotal).toLocaleString('en-IN')}\n`;
    receipt += THERMAL_COMMANDS.BOLD_OFF;
    receipt += THERMAL_COMMANDS.LINE;

    // Paid List
    if (paidList.length > 0) {
      receipt += THERMAL_COMMANDS.BOLD_ON;
      receipt += `PAID (${paidList.length}):\n`;
      receipt += THERMAL_COMMANDS.BOLD_OFF;
      paidList.forEach((item, i) => {
        receipt += `${i + 1}.${(item.customer_name || item.name || '').substring(0, 15)}\n`;
        receipt += `  Day:${item.payment_day} Rs.${(item.monthly_amount || 0).toLocaleString('en-IN')}\n`;
      });
      receipt += THERMAL_COMMANDS.DASHED;
    }

    // Unpaid List
    if (unpaidList.length > 0) {
      receipt += THERMAL_COMMANDS.BOLD_ON;
      receipt += `NOT PAID (${unpaidList.length}):\n`;
      receipt += THERMAL_COMMANDS.BOLD_OFF;
      unpaidList.forEach((item, i) => {
        receipt += `${i + 1}.${(item.customer_name || item.name || '').substring(0, 15)}\n`;
        receipt += `  Day:${item.payment_day} Rs.${(item.monthly_amount || 0).toLocaleString('en-IN')} Bal:${(item.balance || 0).toLocaleString('en-IN')}\n`;
      });
      receipt += THERMAL_COMMANDS.DASHED;
    }

    receipt += THERMAL_COMMANDS.ALIGN_CENTER;
    receipt += `Collected: Rs.${paidTotal.toLocaleString('en-IN')}\n`;
    receipt += 'Ph: 8667510724\n';
    receipt += THERMAL_COMMANDS.FEED;
    receipt += THERMAL_COMMANDS.PARTIAL_CUT;

    // Try to print via Bluetooth
    try {
      if (!navigator.bluetooth) {
        alert('Bluetooth not supported. Use the Normal Print option or RawBT app.');
        return;
      }

      const device = await navigator.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: ['000018f0-0000-1000-8000-00805f9b34fb', '49535343-fe7d-4ae5-8fa9-9fafd205e455', 'e7810a71-73ae-499d-8c15-faa9aef0c3f2']
      });

      const server = await device.gatt.connect();
      const services = await server.getPrimaryServices();
      let characteristic = null;

      for (const service of services) {
        try {
          const characteristics = await service.getCharacteristics();
          for (const char of characteristics) {
            if (char.properties.write || char.properties.writeWithoutResponse) {
              characteristic = char;
              break;
            }
          }
          if (characteristic) break;
        } catch (e) {}
      }

      if (!characteristic) {
        alert('Printer not compatible');
        return;
      }

      const encoder = new TextEncoder();
      const bytes = encoder.encode(receipt);
      const chunkSize = 100;

      for (let i = 0; i < bytes.length; i += chunkSize) {
        const chunk = bytes.slice(i, i + chunkSize);
        if (characteristic.properties.writeWithoutResponse) {
          await characteristic.writeValueWithoutResponse(chunk);
        } else {
          await characteristic.writeValue(chunk);
        }
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      alert('Printed successfully!');
    } catch (error) {
      console.error('Print error:', error);
      alert('Print failed: ' + error.message);
    }
  };

  // Quick Pay - record payment with one click
  const handleQuickPay = async () => {
    if (!quickPayConfirm || isPaymentLoading) return;

    setIsPaymentLoading(true);
    const { loan, amount } = quickPayConfirm;

    try {
      const response = await fetch(`${API_URL}/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          loan_id: loan.loan_id,
          amount: amount,
          payment_date: selectedDate,
          payment_method: 'Cash',
          notes: `Quick payment - Week ${quickPayConfirm.weekNumber}`,
          collected_by: localStorage.getItem('userId') || '',
          collected_by_name: localStorage.getItem('userName') || ''
        })
      });

      if (response.ok) {
        // Refresh data
        mutate();
        mutateCustomers();
        // Reset state and trigger re-fetch of weekly payments
        setQuickPayConfirm(null);
        // Force refresh weekly payments data
        setPaymentsRefreshKey(k => k + 1);
      } else {
        const error = await response.json();
        alert('Payment failed: ' + (error.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Quick pay error:', error);
      alert('Payment failed. Please try again.');
    } finally {
      setIsPaymentLoading(false);
    }
  };

  // Undo Payment - delete the payment and mark as unpaid
  const handleUndoPayment = async () => {
    if (!undoPaymentConfirm || isPaymentLoading) return;

    setIsPaymentLoading(true);

    try {
      // First, get the payment ID for this loan on this date
      const paymentsResponse = await fetch(`${API_URL}/payments-by-date?date=${selectedDate}`);
      const payments = await paymentsResponse.json();
      const payment = payments.find(p => p.loan_id === undoPaymentConfirm.loan.loan_id);

      if (!payment) {
        alert('Payment not found');
        setIsPaymentLoading(false);
        return;
      }

      // Delete the payment
      const response = await fetch(`${API_URL}/payments/${payment.id}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        // Refresh data
        mutate();
        mutateCustomers();
        setUndoPaymentConfirm(null);
        // Force refresh weekly payments data
        setPaymentsRefreshKey(k => k + 1);
      } else {
        const error = await response.json();
        alert('Failed to undo payment: ' + (error.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Undo payment error:', error);
      alert('Failed to undo payment. Please try again.');
    } finally {
      setIsPaymentLoading(false);
    }
  };

  // Bulk Undo - undo multiple selected payments
  const handleBulkUndo = async () => {
    if (selectedPaid.size === 0 || isPaymentLoading) return;

    const confirmMsg = `Are you sure you want to undo ${selectedPaid.size} payment(s)?`;
    if (!window.confirm(confirmMsg)) return;

    setIsPaymentLoading(true);

    try {
      // Get payment IDs for selected loans
      const paymentsResponse = await fetch(`${API_URL}/payments-by-date?date=${selectedDate}`);
      const payments = await paymentsResponse.json();

      let successCount = 0;
      let failCount = 0;

      for (const loanId of selectedPaid) {
        const payment = payments.find(p => p.loan_id === loanId);
        if (!payment) {
          failCount++;
          continue;
        }

        try {
          const response = await fetch(`${API_URL}/payments/${payment.id}`, {
            method: 'DELETE'
          });
          if (response.ok) {
            successCount++;
          } else {
            failCount++;
          }
        } catch {
          failCount++;
        }
      }

      // Refresh data
      mutate();
      mutateCustomers();
      setSelectedPaid(new Set());
      setPaymentsRefreshKey(k => k + 1);

      if (failCount > 0) {
        alert(`Undo complete: ${successCount} succeeded, ${failCount} failed`);
      }
    } catch (error) {
      console.error('Bulk undo error:', error);
      alert('Failed to undo payments. Please try again.');
    } finally {
      setIsPaymentLoading(false);
    }
  };

  // Monthly Finance Payment Handler
  const handleMonthlyPayment = async (customer) => {
    if (isPaymentLoading) return;

    setIsPaymentLoading(true);

    try {
      const response = await fetch(`${API_URL}/monthly-finance/customers/${customer.id}/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: customer.monthly_amount,
          payment_date: new Date().toISOString().split('T')[0],
          payment_mode: 'cash'
        })
      });

      if (!response.ok) throw new Error('Payment failed');

      const result = await response.json();

      // Show choice modal: WhatsApp/Print/Both/Skip
      const whatsappChoice = window.confirm(
        'Payment recorded!\n\n' +
        'Click OK to send WhatsApp\n' +
        'Click Cancel to skip'
      );

      if (whatsappChoice) {
        sendMonthlyWhatsApp(result.customer || customer);
      }

      // Ask about printing
      const printChoice = window.confirm('Print receipt?');
      if (printChoice) {
        printMonthlyReceipt(result.customer || customer);
      }

      // Refresh data
      mutateMonthly();

    } catch (error) {
      console.error('Payment error:', error);
      alert('Failed to record payment');
    } finally {
      setIsPaymentLoading(false);
    }
  };

  // Monthly Finance Undo Handler
  const handleMonthlyUndo = async (customer) => {
    if (isPaymentLoading) return;

    setIsPaymentLoading(true);

    try {
      const response = await fetch(`${API_URL}/monthly-finance/customers/${customer.id}/undo-payment`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' }
      });

      if (!response.ok) throw new Error('Undo failed');

      // Refresh data
      mutateMonthly();
      alert('Payment undone successfully');

    } catch (error) {
      console.error('Undo error:', error);
      alert('Failed to undo payment');
    } finally {
      setIsPaymentLoading(false);
    }
  };

  // Send Monthly Finance WhatsApp Receipt
  const sendMonthlyWhatsApp = (customer) => {
    if (!customer.phone) {
      alert('No phone number for this customer');
      return;
    }

    const paymentDay = customer.start_date ? new Date(customer.start_date).getDate() : '-';
    const message = `*Payment Receipt*\n\n` +
      `Customer: ${customer.customer_name || customer.name}\n` +
      `Amount Paid: ₹${customer.monthly_amount}\n` +
      `Balance: ₹${customer.balance}\n` +
      `Payment Day: ${paymentDay}\n\n` +
      `Thank you for your payment!\n- Om Sai Murugan Finance`;

    const cleanPhone = customer.phone.replace(/\D/g, '');
    const whatsappUrl = `https://wa.me/91${cleanPhone}?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
  };

  // Print Monthly Finance Receipt
  const printMonthlyReceipt = (customer) => {
    const paymentDay = customer.start_date ? new Date(customer.start_date).getDate() : '-';
    setPrintData({
      customerName: customer.customer_name || customer.name,
      phone: customer.phone,
      loanType: 'Monthly Finance',
      amountPaid: customer.monthly_amount,
      loanAmount: customer.loan_amount,
      balance: customer.balance,
      monthlyAmount: customer.monthly_amount,
      paymentDay: paymentDay,
      date: new Date().toISOString()
    });
  };

  // Approve Pending Payment
  const handleApprovePendingPayment = async (payment) => {
    if (!window.confirm(`Approve payment of ${formatCurrency(payment.amount)} from ${payment.customer_name}?`)) {
      return;
    }

    try {
      const response = await fetch(`${API_URL}/pending-payments/${payment.id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      if (!response.ok) {
        throw new Error('Failed to approve payment');
      }

      alert('Payment approved successfully!');
      mutatePendingPayments(); // Refresh pending payments
      mutate(); // Refresh stats
      mutateCustomers(); // Refresh customer data

      // Send WhatsApp notification
      if (payment.customer_phone) {
        const message = `✅ *Payment Approved*\n\n` +
          `Dear ${payment.customer_name},\n\n` +
          `Your payment of ₹${payment.amount} has been approved successfully!\n\n` +
          `Your balance has been updated.\n\n` +
          `Thank you for your payment!\n` +
          `- Om Sai Murugan Finance`;

        const cleanPhone = payment.customer_phone.replace(/\D/g, '');
        const whatsappUrl = `https://wa.me/91${cleanPhone}?text=${encodeURIComponent(message)}`;
        window.open(whatsappUrl, '_blank');
      }
    } catch (error) {
      console.error('Error approving payment:', error);
      alert('Failed to approve payment. Please try again.');
    }
  };

  // Reject Pending Payment
  const handleRejectPendingPayment = async (payment) => {
    const reason = window.prompt('Enter rejection reason (optional):');
    if (reason === null) return; // User cancelled

    try {
      const response = await fetch(`${API_URL}/pending-payments/${payment.id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: reason || 'Invalid payment proof' })
      });

      if (!response.ok) {
        throw new Error('Failed to reject payment');
      }

      alert('Payment rejected successfully!');
      mutatePendingPayments(); // Refresh pending payments

      // Send WhatsApp notification
      if (payment.customer_phone) {
        const rejectionReason = reason || 'Invalid payment proof';
        const message = `❌ *Payment Rejected*\n\n` +
          `Dear ${payment.customer_name},\n\n` +
          `Your payment of ₹${payment.amount} was rejected.\n\n` +
          `Reason: ${rejectionReason}\n\n` +
          `Please contact us for assistance or submit a valid payment proof.\n\n` +
          `- Om Sai Murugan Finance`;

        const cleanPhone = payment.customer_phone.replace(/\D/g, '');
        const whatsappUrl = `https://wa.me/91${cleanPhone}?text=${encodeURIComponent(message)}`;
        window.open(whatsappUrl, '_blank');
      }
    } catch (error) {
      console.error('Error rejecting payment:', error);
      alert('Failed to reject payment. Please try again.');
    }
  };

  // Show loading screen while initial data loads
  if (isLoading && !stats) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #1e3a8a 0%, #1e293b 100%)',
        color: 'white'
      }}>
        <div style={{
          width: '50px',
          height: '50px',
          border: '4px solid rgba(255,255,255,0.3)',
          borderTop: '4px solid #d97706',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite'
        }} />
        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
        <p style={{ marginTop: '16px', fontSize: '14px', opacity: 0.9 }}>Loading Dashboard...</p>
      </div>
    );
  }

  // Show error if API fails
  if (error && !stats) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #1e3a8a 0%, #1e293b 100%)',
        color: 'white',
        padding: '20px',
        textAlign: 'center'
      }}>
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>⚠️</div>
        <p style={{ fontSize: '16px', marginBottom: '12px' }}>Failed to load dashboard</p>
        <p style={{ fontSize: '12px', opacity: 0.7, marginBottom: '20px' }}>Please check your internet connection</p>
        <button
          onClick={() => window.location.reload()}
          style={{
            background: '#d97706',
            color: 'white',
            border: 'none',
            padding: '12px 24px',
            borderRadius: '8px',
            fontSize: '14px',
            fontWeight: 600,
            cursor: 'pointer'
          }}
        >
          🔄 Retry
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'linear-gradient(135deg, #1e3a8a 0%, #1e293b 100%)', maxWidth: '100vw', overflowX: 'hidden' }}>
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
      {/* Menu Sidebar */}
      <div
        style={{
          position: 'fixed',
          left: showSidebar ? '0' : '-280px',
          top: 0,
          width: '280px',
          maxWidth: '80vw',
          height: '100vh',
          background: 'linear-gradient(180deg, #1e293b 0%, #0f172a 100%)',
          transition: 'left 0.3s ease',
          zIndex: 1000,
          boxShadow: '2px 0 10px rgba(0,0,0,0.3)',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        <div style={{ padding: '14px', borderBottom: '1px solid #334155', flexShrink: 0 }}>
          <h3 style={{ color: '#d97706', margin: 0, fontSize: '16px', fontWeight: 700 }}>OM SAI MURUGAN</h3>
          <p style={{ color: '#94a3b8', margin: '3px 0 0', fontSize: '10px' }}>FINANCE</p>
        </div>

        <div style={{ padding: '6px 0', flex: 1, overflowY: 'auto' }}>
          <button
            onClick={() => { setShowSidebar(false); }}
            style={{
              width: '100%',
              padding: '10px 14px',
              background: '#1e40af',
              color: 'white',
              border: 'none',
              textAlign: 'left',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: 600,
              transition: 'background 0.15s'
            }}
            onMouseOver={(e) => e.target.style.background = '#1e3a8a'}
            onMouseOut={(e) => e.target.style.background = '#1e40af'}
          >
            📊 {t('dashboard')}
          </button>

          {/* Push Notifications - At Top for visibility */}
          {localStorage.getItem('userRole') === 'admin' && (
            <button
              onClick={() => {
                enablePushNotifications();
              }}
              style={{
                width: '100%',
                padding: '12px 14px',
                background: notificationStatus === 'enabled'
                  ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
                  : notificationStatus === 'disabled'
                  ? 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)'
                  : 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
                color: 'white',
                border: 'none',
                textAlign: 'left',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: '10px'
              }}
            >
              <span style={{ fontSize: '18px' }}>
                {notificationStatus === 'enabled' ? '🔔' : notificationStatus === 'disabled' ? '🔕' : '🔔'}
              </span>
              <span>
                {notificationStatus === 'enabled' ? '✓ Notifications ON' :
                 notificationStatus === 'disabled' ? 'Notifications Blocked' :
                 notificationStatus === 'enabling' ? 'Enabling...' :
                 'Enable Notifications'}
              </span>
            </button>
          )}

          <button
            onClick={() => { setShowSidebar(false); setShowAllPaymentsDue(true); }}
            style={{
              width: '100%',
              padding: '10px 14px',
              background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
              color: 'white',
              border: 'none',
              textAlign: 'left',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: 600,
              transition: 'background 0.15s'
            }}
          >
            📋 {t('allPaymentsDue')}
          </button>

          <button
            onClick={() => { setShowSidebar(false); setShowPendingPayments(true); }}
            style={{
              width: '100%',
              padding: '10px 14px',
              background: pendingPayments && pendingPayments.length > 0
                ? 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)'
                : 'transparent',
              color: 'white',
              border: 'none',
              textAlign: 'left',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: 600,
              transition: 'background 0.15s',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}
            onMouseOver={(e) => {
              if (!pendingPayments || pendingPayments.length === 0) {
                e.currentTarget.style.background = '#334155';
              }
            }}
            onMouseOut={(e) => {
              if (!pendingPayments || pendingPayments.length === 0) {
                e.currentTarget.style.background = 'transparent';
              }
            }}
          >
            <span>⏳ {language === 'ta' ? 'நிலுவை செலுத்துதல்' : 'Pending Payments'}</span>
            {pendingPayments && pendingPayments.length > 0 && (
              <span style={{
                background: 'white',
                color: '#d97706',
                borderRadius: '12px',
                padding: '2px 8px',
                fontSize: '11px',
                fontWeight: 700
              }}>
                {pendingPayments.length}
              </span>
            )}
          </button>

          <button
            onClick={() => { setShowSidebar(false); navigateTo('sunday-collections'); }}
            style={{
              width: '100%',
              padding: '10px 14px',
              background: 'transparent',
              color: 'white',
              border: 'none',
              textAlign: 'left',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: 600,
              transition: 'background 0.15s'
            }}
            onMouseOver={(e) => e.target.style.background = '#334155'}
            onMouseOut={(e) => e.target.style.background = 'transparent'}
          >
            📅 {t('sundayCollections')}
          </button>

          <button
            onClick={() => { setShowSidebar(false); navigateTo('overdue-payments'); }}
            style={{
              width: '100%',
              padding: '10px 14px',
              background: 'transparent',
              color: 'white',
              border: 'none',
              textAlign: 'left',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: 600,
              transition: 'background 0.15s'
            }}
            onMouseOver={(e) => e.target.style.background = '#334155'}
            onMouseOut={(e) => e.target.style.background = 'transparent'}
          >
            ⚠️ {t('overduePayments')}
          </button>

          <button
            onClick={() => { setShowSidebar(false); navigateTo('customers'); }}
            style={{
              width: '100%',
              padding: '10px 14px',
              background: 'transparent',
              color: 'white',
              border: 'none',
              textAlign: 'left',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: 600,
              transition: 'background 0.15s'
            }}
            onMouseOver={(e) => e.target.style.background = '#334155'}
            onMouseOut={(e) => e.target.style.background = 'transparent'}
          >
            👥 {t('customers')}
          </button>

          <button
            onClick={() => { setShowSidebar(false); navigateTo('payment-tracker'); }}
            style={{
              width: '100%',
              padding: '10px 14px',
              background: 'transparent',
              color: 'white',
              border: 'none',
              textAlign: 'left',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: 600,
              transition: 'background 0.15s'
            }}
            onMouseOver={(e) => e.target.style.background = '#334155'}
            onMouseOut={(e) => e.target.style.background = 'transparent'}
          >
            📅 {t('paymentTracker')}
          </button>

          <button
            onClick={() => { setShowSidebar(false); navigateTo('vaddi-list'); }}
            style={{
              width: '100%',
              padding: '10px 14px',
              background: 'transparent',
              color: 'white',
              border: 'none',
              textAlign: 'left',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: 600,
              transition: 'background 0.15s'
            }}
            onMouseOver={(e) => e.target.style.background = '#334155'}
            onMouseOut={(e) => e.target.style.background = 'transparent'}
          >
            💵 {t('interestLoans')}
          </button>

          <button
            onClick={() => { setShowSidebar(false); navigateTo('weekly-finance'); }}
            style={{
              width: '100%',
              padding: '10px 14px',
              background: 'transparent',
              color: 'white',
              border: 'none',
              textAlign: 'left',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: 600,
              transition: 'background 0.15s'
            }}
            onMouseOver={(e) => e.target.style.background = '#334155'}
            onMouseOut={(e) => e.target.style.background = 'transparent'}
          >
            📅 {t('weeklyFinance')}
          </button>

          <button
            onClick={() => { setShowSidebar(false); navigateTo('monthly-finance'); }}
            style={{
              width: '100%',
              padding: '10px 14px',
              background: 'transparent',
              color: 'white',
              border: 'none',
              textAlign: 'left',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: 600,
              transition: 'background 0.15s'
            }}
            onMouseOver={(e) => e.target.style.background = '#334155'}
            onMouseOut={(e) => e.target.style.background = 'transparent'}
          >
            💰 {t('monthlyFinance')}
          </button>

          <button
            onClick={() => { setShowSidebar(false); navigateTo('daily-finance'); }}
            style={{
              width: '100%',
              padding: '10px 14px',
              background: 'transparent',
              color: 'white',
              border: 'none',
              textAlign: 'left',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: 600,
              transition: 'background 0.15s'
            }}
            onMouseOver={(e) => e.target.style.background = '#334155'}
            onMouseOut={(e) => e.target.style.background = 'transparent'}
          >
            📆 {t('dailyFinance')}
          </button>

          <button
            onClick={() => { setShowSidebar(false); navigateTo('investments'); }}
            style={{
              width: '100%',
              padding: '10px 14px',
              background: 'transparent',
              color: 'white',
              border: 'none',
              textAlign: 'left',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: 600,
              transition: 'background 0.15s'
            }}
            onMouseOver={(e) => e.target.style.background = '#334155'}
            onMouseOut={(e) => e.target.style.background = 'transparent'}
          >
            💰 {t('investments')}
          </button>

          <button
            onClick={() => { setShowSidebar(false); navigateTo('archived-loans'); }}
            style={{
              width: '100%',
              padding: '10px 14px',
              background: 'transparent',
              color: 'white',
              border: 'none',
              textAlign: 'left',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: 600,
              transition: 'background 0.15s'
            }}
            onMouseOver={(e) => e.target.style.background = '#334155'}
            onMouseOut={(e) => e.target.style.background = 'transparent'}
          >
            📦 {t('archivedLoans')}
          </button>

          {localStorage.getItem('userRole') === 'admin' && (
            <button
              onClick={() => { setShowSidebar(false); navigateTo('user-management'); }}
              style={{
                width: '100%',
                padding: '10px 14px',
                background: 'transparent',
                color: 'white',
                border: 'none',
                textAlign: 'left',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: 600,
                transition: 'background 0.15s'
              }}
              onMouseOver={(e) => e.target.style.background = '#334155'}
              onMouseOut={(e) => e.target.style.background = 'transparent'}
            >
              👥 {t('userManagement')}
            </button>
          )}

          {/* My Collections - For Users */}
          {localStorage.getItem('userRole') !== 'admin' && (
            <button
              onClick={() => { setShowSidebar(false); navigateTo('my-collections'); }}
              style={{
                width: '100%',
                padding: '10px 14px',
                background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
                color: 'white',
                border: 'none',
                textAlign: 'left',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: 600,
                transition: 'background 0.15s',
                marginTop: '8px'
              }}
              onMouseOver={(e) => e.target.style.background = 'linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)'}
              onMouseOut={(e) => e.target.style.background = 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)'}
            >
              💰 My Collections
            </button>
          )}

          {/* User Collections - For Admin */}
          {localStorage.getItem('userRole') === 'admin' && (
            <button
              onClick={() => { setShowSidebar(false); navigateTo('admin-collections'); }}
              style={{
                width: '100%',
                padding: '10px 14px',
                background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                color: 'white',
                border: 'none',
                textAlign: 'left',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: 600,
                transition: 'background 0.15s',
                marginTop: '8px'
              }}
              onMouseOver={(e) => e.target.style.background = 'linear-gradient(135deg, #d97706 0%, #b45309 100%)'}
              onMouseOut={(e) => e.target.style.background = 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)'}
            >
              📊 User Collections
            </button>
          )}

          {/* Admin Profit - Password Protected */}
          <button
            onClick={() => { setShowSidebar(false); navigateTo('admin-profit'); }}
            style={{
              width: '100%',
              padding: '10px 14px',
              background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
              color: 'white',
              border: 'none',
              textAlign: 'left',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: 600,
              transition: 'background 0.15s',
              marginTop: '8px'
            }}
            onMouseOver={(e) => e.target.style.background = 'linear-gradient(135deg, #047857 0%, #065f46 100%)'}
            onMouseOut={(e) => e.target.style.background = 'linear-gradient(135deg, #059669 0%, #047857 100%)'}
          >
            🔐 {t('adminProfit')}
          </button>

          {/* Send Wishes */}
          <button
            onClick={() => { setShowSidebar(false); setShowSendWishes(true); }}
            style={{
              width: '100%',
              padding: '10px 14px',
              background: 'linear-gradient(135deg, #7c3aed 0%, #5b21b6 100%)',
              color: 'white',
              border: 'none',
              textAlign: 'left',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: 600,
              transition: 'background 0.15s',
              marginTop: '8px'
            }}
            onMouseOver={(e) => e.target.style.background = 'linear-gradient(135deg, #6d28d9 0%, #4c1d95 100%)'}
            onMouseOut={(e) => e.target.style.background = 'linear-gradient(135deg, #7c3aed 0%, #5b21b6 100%)'}
          >
            🎉 Send Wishes
          </button>

          {/* Print Reports */}
          <button
            onClick={() => { setShowSidebar(false); setShowPrintReports(true); }}
            style={{
              width: '100%',
              padding: '10px 14px',
              background: 'linear-gradient(135deg, #0891b2 0%, #0e7490 100%)',
              color: 'white',
              border: 'none',
              textAlign: 'left',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: 600,
              transition: 'background 0.15s',
              marginTop: '8px'
            }}
            onMouseOver={(e) => e.target.style.background = 'linear-gradient(135deg, #0e7490 0%, #155e75 100%)'}
            onMouseOut={(e) => e.target.style.background = 'linear-gradient(135deg, #0891b2 0%, #0e7490 100%)'}
          >
            🖨️ Print Reports
          </button>

          {/* Payment Reminders */}
          <button
            onClick={() => { setShowSidebar(false); setShowPaymentReminders(true); }}
            style={{
              width: '100%',
              padding: '10px 14px',
              background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
              color: 'white',
              border: 'none',
              textAlign: 'left',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: 600,
              transition: 'background 0.15s',
              marginTop: '8px'
            }}
            onMouseOver={(e) => e.target.style.background = 'linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)'}
            onMouseOut={(e) => e.target.style.background = 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)'}
          >
            🔔 Payment Reminders
          </button>

          {/* Bulk WhatsApp */}
          <button
            onClick={() => { setShowSidebar(false); setShowBulkWhatsApp(true); }}
            style={{
              width: '100%',
              padding: '10px 14px',
              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              color: 'white',
              border: 'none',
              textAlign: 'left',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: 600,
              transition: 'background 0.15s',
              marginTop: '8px'
            }}
            onMouseOver={(e) => e.target.style.background = 'linear-gradient(135deg, #059669 0%, #047857 100%)'}
            onMouseOut={(e) => e.target.style.background = 'linear-gradient(135deg, #10b981 0%, #059669 100%)'}
          >
            📱 Bulk Messages
          </button>

          {/* Reports */}
          <button
            onClick={() => { setShowSidebar(false); setShowReports(true); }}
            style={{
              width: '100%',
              padding: '10px 14px',
              background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
              color: 'white',
              border: 'none',
              textAlign: 'left',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: 600,
              transition: 'background 0.15s',
              marginTop: '8px'
            }}
            onMouseOver={(e) => e.target.style.background = 'linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)'}
            onMouseOut={(e) => e.target.style.background = 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)'}
          >
            📊 Reports / அறிக்கைகள்
          </button>

          {/* Dark Mode Toggle */}
          <button
            onClick={() => toggleDarkMode()}
            style={{
              width: '100%',
              padding: '10px 14px',
              background: isDarkMode
                ? 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)'
                : 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
              color: 'white',
              border: 'none',
              textAlign: 'left',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: 600,
              transition: 'background 0.15s',
              marginTop: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}
          >
            <span>{isDarkMode ? '☀️ Light Mode' : '🌙 Dark Mode'}</span>
            <span style={{
              width: '36px',
              height: '20px',
              background: isDarkMode ? '#059669' : '#4b5563',
              borderRadius: '10px',
              position: 'relative',
              transition: 'background 0.3s'
            }}>
              <span style={{
                position: 'absolute',
                top: '2px',
                left: isDarkMode ? '18px' : '2px',
                width: '16px',
                height: '16px',
                background: 'white',
                borderRadius: '50%',
                transition: 'left 0.3s'
              }}></span>
            </span>
          </button>

          {/* Backup to Excel */}
          <button
            onClick={() => { setShowSidebar(false); setShowBackupModal(true); }}
            style={{
              width: '100%',
              padding: '10px 14px',
              background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
              color: 'white',
              border: 'none',
              textAlign: 'left',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: 600,
              transition: 'background 0.15s',
              marginTop: '8px'
            }}
            onMouseOver={(e) => e.target.style.background = 'linear-gradient(135deg, #047857 0%, #065f46 100%)'}
            onMouseOut={(e) => e.target.style.background = 'linear-gradient(135deg, #059669 0%, #047857 100%)'}
          >
            💾 Backup to Excel
          </button>


        </div>

        {/* Logout Button - Fixed at bottom */}
        <div style={{ padding: '14px', borderTop: '1px solid #334155', flexShrink: 0 }}>
          <button
            onClick={handleLogout}
            style={{
              width: '100%',
              padding: '10px',
              background: '#dc2626',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: 600
            }}
          >
            🚪 {t('logout')}
          </button>
        </div>
      </div>

      {/* Overlay */}
      {showSidebar && (
        <div
          onClick={() => setShowSidebar(false)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.5)',
            zIndex: 999
          }}
        />
      )}

      {/* Main Content */}
      <div style={{ flex: 1, padding: '0', width: '100%' }}>
        {/* Header */}
        <div style={{
          background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
          padding: '10px 12px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              onClick={() => setShowSidebar(true)}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'white',
                cursor: 'pointer',
                fontSize: '20px',
                padding: '2px',
                display: 'flex',
                alignItems: 'center'
              }}
            >
              ☰
            </button>
            <h2 style={{ margin: 0, color: 'white', fontSize: '16px', fontWeight: 700 }}>{t('dashboard')}</h2>
            {/* Pending Payments Notification Badge */}
            {pendingPayments && pendingPayments.length > 0 && (
              <div
                onClick={() => {
                  setShowPendingPayments(true);
                  document.getElementById('pending-payments-section')?.scrollIntoView({ behavior: 'smooth' });
                }}
                style={{
                  position: 'relative',
                  background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                  color: 'white',
                  padding: '4px 10px',
                  borderRadius: '12px',
                  fontSize: '11px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  boxShadow: '0 2px 8px rgba(245, 158, 11, 0.4)',
                  animation: 'pulse 2s infinite'
                }}
              >
                <span>⏳</span>
                <span>{pendingPayments.length}</span>
                <style>{`
                  @keyframes pulse {
                    0%, 100% { transform: scale(1); }
                    50% { transform: scale(1.05); }
                  }
                `}</style>
              </div>
            )}
          </div>

          {/* Search Bar */}
          <div style={{ position: 'relative', flex: 1, maxWidth: '200px', margin: '0 8px' }}>
            <input
              type="text"
              placeholder="🔍 Search..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setShowSearchResults(e.target.value.length > 0);
              }}
              onFocus={() => setShowSearchResults(searchTerm.length > 0)}
              style={{
                width: '100%',
                padding: '6px 10px',
                borderRadius: '6px',
                border: 'none',
                fontSize: '12px',
                background: 'rgba(255,255,255,0.15)',
                color: 'white',
                outline: 'none'
              }}
            />
            {/* Search Results Dropdown */}
            {showSearchResults && searchTerm.length > 0 && (
              <div
                style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  right: 0,
                  background: 'white',
                  borderRadius: '8px',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
                  zIndex: 1001,
                  maxHeight: '300px',
                  overflowY: 'auto',
                  marginTop: '4px'
                }}
              >
                {(() => {
                  const searchLower = searchTerm.toLowerCase();
                  const results = customers
                    .filter(customer =>
                      customer.name.toLowerCase().includes(searchLower) ||
                      (customer.phone && customer.phone.includes(searchTerm)) ||
                      (customer.loans && customer.loans.some(loan =>
                        (loan.loan_name && loan.loan_name.toLowerCase().includes(searchLower))
                      ))
                    )
                    .slice(0, 10);

                  if (results.length === 0) {
                    return (
                      <div style={{ padding: '12px', color: '#6b7280', textAlign: 'center', fontSize: '12px' }}>
                        No results found
                      </div>
                    );
                  }

                  return results.map(customer => (
                    <div
                      key={customer.customer_id}
                      onClick={() => {
                        setShowSearchResults(false);
                        setSearchTerm('');
                        if (customer.loans && customer.loans.length > 0) {
                          navigateTo('loan-details', customer.loans[0].loan_id);
                        } else {
                          navigateTo('customers');
                        }
                      }}
                      style={{
                        padding: '10px 12px',
                        cursor: 'pointer',
                        borderBottom: '1px solid #f3f4f6',
                        transition: 'background 0.15s'
                      }}
                      onMouseOver={(e) => e.currentTarget.style.background = '#f0f9ff'}
                      onMouseOut={(e) => e.currentTarget.style.background = 'white'}
                    >
                      <div style={{ fontWeight: 600, fontSize: '12px', color: '#1e293b' }}>
                        {customer.name}
                      </div>
                      {customer.phone && (
                        <div style={{ fontSize: '10px', color: '#6b7280' }}>
                          📞 {customer.phone}
                        </div>
                      )}
                      {customer.loans && customer.loans.length > 0 && (
                        <div style={{ fontSize: '10px', color: '#059669', marginTop: '2px' }}>
                          {customer.loans.filter(l => l.status === 'active').length} active loan(s)
                        </div>
                      )}
                    </div>
                  ));
                })()}
              </div>
            )}
          </div>

          {/* Quick Reference Button */}
          <button
            onClick={() => setShowQuickRefModal(true)}
            style={{
              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              color: 'white',
              border: 'none',
              padding: '6px 12px',
              borderRadius: '6px',
              fontSize: '11px',
              fontWeight: 700,
              cursor: 'pointer',
              whiteSpace: 'nowrap'
            }}
            title="Quick Reference - All Customers"
          >
            📋 Quick Ref
          </button>

          {/* Database Size Monitor */}
          <div
            style={{
              background: 'linear-gradient(135deg, #0369a1 0%, #075985 100%)',
              color: 'white',
              padding: '4px 8px',
              borderRadius: '6px',
              fontSize: '10px',
              fontWeight: 600,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-end',
              minWidth: '80px',
              cursor: 'pointer'
            }}
            onClick={() => setShowDatabaseMonitorModal(true)}
            title="Click to view details and add notes. Auto-refreshes every 30s"
          >
            {stats && stats.database ? (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: '3px', marginBottom: '2px' }}>
                  <span>💾</span>
                  <span>{stats.database.estimatedSizeMB}MB / {stats.database.limitMB}MB</span>
                </div>
                <div style={{ width: '100%', height: '3px', background: 'rgba(255,255,255,0.3)', borderRadius: '2px', overflow: 'hidden' }}>
                  <div
                    style={{
                      width: `${Math.min(stats.database.usagePercent, 100)}%`,
                      height: '100%',
                      background: stats.database.usagePercent > 80 ? '#ef4444' : stats.database.usagePercent > 60 ? '#f59e0b' : '#10b981',
                      transition: 'width 0.3s ease'
                    }}
                  />
                </div>
              </>
            ) : (
              <span>Loading...</span>
            )}
          </div>
        </div>


        {/* Global Search Button */}
        <div
          onClick={() => setShowGlobalSearch(true)}
          style={{
            background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
            padding: '14px 16px',
            margin: '10px 10px 0 10px',
            borderRadius: '12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)',
            cursor: 'pointer'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '22px' }}>🔍</span>
            <div>
              <div style={{ color: 'white', fontSize: '14px', fontWeight: 700 }}>
                Search All Customers
              </div>
              <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: '11px' }}>
                Weekly • Monthly • Daily • Interest • Chit
              </div>
            </div>
          </div>
          <div style={{
            background: 'rgba(255,255,255,0.2)',
            padding: '6px 12px',
            borderRadius: '6px',
            color: 'white',
            fontSize: '11px',
            fontWeight: 600
          }}>
            TAP
          </div>
        </div>

        {/* Firebase Usage Monitor Quick Link */}
        <div
          onClick={() => window.open('https://console.firebase.google.com/project/financetracker-ba33d/usage', '_blank')}
          style={{
            background: isDarkMode
              ? 'linear-gradient(135deg, #1e40af 0%, #1e3a8a 100%)'
              : 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
            padding: '10px 16px',
            margin: '10px 10px 0 10px',
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
            cursor: 'pointer'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '18px' }}>📊</span>
            <div>
              <div style={{ color: 'white', fontSize: '12px', fontWeight: 600 }}>
                Firebase Usage Monitor
              </div>
              <div style={{ color: 'white', fontSize: '10px', opacity: 0.85 }}>
                Check database reads & billing
              </div>
            </div>
          </div>
          <span style={{ color: 'white', fontSize: '16px' }}>→</span>
        </div>

        {/* Quick Note Section with Stylus Support */}
        <div style={{
          background: isDarkMode
            ? 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)'
            : 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
          margin: '10px 10px 0 10px',
          borderRadius: '8px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          overflow: 'hidden'
        }}>
          <div
            onClick={() => setShowQuickNote(!showQuickNote)}
            style={{
              padding: '10px 14px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              cursor: 'pointer'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '16px' }}>📝</span>
              <span style={{ fontWeight: 600, fontSize: '13px', color: '#92400e' }}>Quick Note</span>
              {(quickNote || localStorage.getItem('dashboardQuickDrawing')) && !showQuickNote && (
                <span style={{ fontSize: '11px', color: '#b45309', opacity: 0.8 }}>
                  (has content)
                </span>
              )}
            </div>
            <span style={{ color: '#92400e', fontSize: '14px' }}>{showQuickNote ? '▼' : '▶'}</span>
          </div>
          {showQuickNote && (
            <div style={{ padding: '0 14px 14px 14px' }}>
              {/* Mode Toggle - Text or Draw */}
              <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
                <button
                  onClick={() => setNoteMode('text')}
                  style={{
                    flex: 1,
                    padding: '8px',
                    background: noteMode === 'text' ? '#92400e' : 'white',
                    color: noteMode === 'text' ? 'white' : '#92400e',
                    border: '1px solid #92400e',
                    borderRadius: '6px',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '4px'
                  }}
                >
                  ⌨️ Type
                </button>
                <button
                  onClick={() => setNoteMode('draw')}
                  style={{
                    flex: 1,
                    padding: '8px',
                    background: noteMode === 'draw' ? '#92400e' : 'white',
                    color: noteMode === 'draw' ? 'white' : '#92400e',
                    border: '1px solid #92400e',
                    borderRadius: '6px',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '4px'
                  }}
                >
                  ✏️ Draw (Stylus)
                </button>
              </div>

              {/* Text Mode */}
              {noteMode === 'text' && (
                <>
                  <textarea
                    value={quickNote}
                    onChange={(e) => saveQuickNote(e.target.value)}
                    placeholder="Type your notes here... (auto-saved)"
                    style={{
                      width: '100%',
                      minHeight: '80px',
                      padding: '10px',
                      borderRadius: '6px',
                      border: '1px solid #fbbf24',
                      background: 'white',
                      fontSize: '13px',
                      resize: 'vertical',
                      outline: 'none',
                      fontFamily: 'inherit'
                    }}
                  />
                  {quickNote && (
                    <button
                      onClick={() => saveQuickNote('')}
                      style={{
                        marginTop: '8px',
                        padding: '6px 12px',
                        background: '#fee2e2',
                        color: '#dc2626',
                        border: 'none',
                        borderRadius: '4px',
                        fontSize: '11px',
                        cursor: 'pointer',
                        fontWeight: 600
                      }}
                    >
                      Clear Note
                    </button>
                  )}
                </>
              )}

              {/* Draw Mode - Canvas for Stylus */}
              {noteMode === 'draw' && (
                <>
                  {/* Pen Settings */}
                  <div style={{ display: 'flex', gap: '10px', marginBottom: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <span style={{ fontSize: '11px', color: '#92400e' }}>Color:</span>
                      <input
                        type="color"
                        value={penColor}
                        onChange={(e) => setPenColor(e.target.value)}
                        style={{ width: '30px', height: '24px', border: 'none', cursor: 'pointer' }}
                      />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <span style={{ fontSize: '11px', color: '#92400e' }}>Size:</span>
                      <input
                        type="range"
                        min="1"
                        max="10"
                        value={penSize}
                        onChange={(e) => setPenSize(parseInt(e.target.value))}
                        style={{ width: '60px' }}
                      />
                      <span style={{ fontSize: '10px', color: '#92400e' }}>{penSize}px</span>
                    </div>
                    <button
                      onClick={clearCanvas}
                      style={{
                        padding: '4px 10px',
                        background: '#fee2e2',
                        color: '#dc2626',
                        border: 'none',
                        borderRadius: '4px',
                        fontSize: '10px',
                        cursor: 'pointer',
                        fontWeight: 600
                      }}
                    >
                      Clear Drawing
                    </button>
                  </div>
                  {/* Canvas */}
                  <div style={{
                    background: 'white',
                    borderRadius: '6px',
                    border: '1px solid #fbbf24',
                    padding: '10px',
                    touchAction: 'none'
                  }}>
                    <canvas
                      ref={canvasRef}
                      onMouseDown={startDrawing}
                      onMouseMove={draw}
                      onMouseUp={stopDrawing}
                      onMouseLeave={stopDrawing}
                      onTouchStart={startDrawing}
                      onTouchMove={draw}
                      onTouchEnd={stopDrawing}
                      style={{
                        display: 'block',
                        width: '100%',
                        background: '#fffef0',
                        borderRadius: '4px',
                        cursor: 'crosshair'
                      }}
                    />
                  </div>
                  <p style={{ fontSize: '10px', color: '#92400e', marginTop: '6px', textAlign: 'center' }}>
                    Use your stylus or finger to draw. Auto-saved!
                  </p>
                </>
              )}
            </div>
          )}
        </div>

        {/* Stats Grid */}
        <div style={{ padding: '10px' }}>
          {stats && (
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr',
              gap: '8px',
              marginBottom: '10px'
            }}>
              <div style={{
                background: 'linear-gradient(135deg, #1e40af 0%, #1e3a8a 100%)',
                padding: '10px 12px',
                borderRadius: '8px',
                boxShadow: '0 2px 6px rgba(30, 64, 175, 0.2)',
                color: 'white'
              }}>
                <div style={{ fontSize: '11px', opacity: 0.9, marginBottom: '4px', fontWeight: 600 }}>{t('activeLoans')}</div>
                <div style={{ fontSize: '20px', fontWeight: 700 }}>{stats.activeLoans}</div>
              </div>

              <div style={{
                background: 'linear-gradient(135deg, #b45309 0%, #92400e 100%)',
                padding: '10px 12px',
                borderRadius: '8px',
                boxShadow: '0 2px 6px rgba(180, 83, 9, 0.2)',
                color: 'white'
              }}>
                <div style={{ fontSize: '11px', opacity: 0.9, marginBottom: '4px', fontWeight: 600 }}>{t('totalOutstanding')}</div>
                <div style={{ fontSize: '20px', fontWeight: 700 }}>
                  {formatCurrency(stats.outstanding || 0)}
                </div>
                <div style={{ fontSize: '9px', opacity: 0.8, marginTop: '4px' }}>
                  <span>{t('weekly')}: {formatCurrency(stats.weeklyOutstanding || 0)}</span>
                  <span> | {t('monthly')}: {formatCurrency(stats.monthlyOutstanding || 0)}</span>
                </div>
              </div>

            </div>
          )}

          {/* Vaddi Monthly Summary Card */}
          <div
            onClick={() => navigateTo('vaddi-list')}
            style={{
              background: 'linear-gradient(135deg, #7c3aed 0%, #5b21b6 100%)',
              padding: '12px 14px',
              borderRadius: '10px',
              boxShadow: '0 4px 12px rgba(124, 58, 237, 0.3)',
              color: 'white',
              cursor: 'pointer',
              marginBottom: '10px',
              transition: 'transform 0.15s, box-shadow 0.15s'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 6px 16px rgba(124, 58, 237, 0.4)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(124, 58, 237, 0.3)';
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <div style={{ fontSize: '13px', fontWeight: 700, opacity: 0.95 }}>
                💰 Interest - {new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
              </div>
              <span style={{ fontSize: '10px', opacity: 0.8 }}>Tap to view →</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '18px', fontWeight: 700 }}>
                  {formatCurrency(vaddiSummary.totalCollected || 0)}
                </div>
                <div style={{ fontSize: '10px', opacity: 0.8 }}>{t('collected')}</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '18px', fontWeight: 700, color: '#86efac' }}>
                  {formatCurrency(vaddiSummary.myProfit || 0)}
                </div>
                <div style={{ fontSize: '10px', opacity: 0.8 }}>{t('myProfit')}</div>
              </div>
            </div>
            {vaddiSummary.paymentCount > 0 && (
              <div style={{ textAlign: 'center', marginTop: '8px', fontSize: '11px', opacity: 0.9 }}>
                {vaddiSummary.paymentCount} payments recorded this month
              </div>
            )}
          </div>

          {/* Daily Finance Summary Card */}
          <div
            onClick={() => navigateTo('daily-finance')}
            style={{
              background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
              padding: '12px 14px',
              borderRadius: '10px',
              boxShadow: '0 4px 12px rgba(245, 158, 11, 0.3)',
              color: 'white',
              cursor: 'pointer',
              marginBottom: '10px',
              transition: 'transform 0.15s, box-shadow 0.15s'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 6px 16px rgba(245, 158, 11, 0.4)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(245, 158, 11, 0.3)';
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <div style={{ fontSize: '13px', fontWeight: 700, opacity: 0.95 }}>
                📆 Daily Finance (100 Days)
              </div>
              <span style={{ fontSize: '10px', opacity: 0.8 }}>Tap to view →</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '18px', fontWeight: 700 }}>
                  {formatCurrency(dailySummary.total_given || 0)}
                </div>
                <div style={{ fontSize: '10px', opacity: 0.8 }}>{t('given')}</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '18px', fontWeight: 700, color: '#fee2e2' }}>
                  {formatCurrency(dailySummary.total_outstanding || 0)}
                </div>
                <div style={{ fontSize: '10px', opacity: 0.8 }}>{t('outstanding')}</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '18px', fontWeight: 700, color: '#86efac' }}>
                  {dailySummary.active_loans || 0}
                </div>
                <div style={{ fontSize: '10px', opacity: 0.8 }}>{t('active')}</div>
              </div>
            </div>
            {dailySummary.today_expected > 0 && (
              <div style={{ textAlign: 'center', marginTop: '8px', fontSize: '11px', opacity: 0.9 }}>
                Today: {formatCurrency(dailySummary.today_collected || 0)} / {formatCurrency(dailySummary.today_expected)} collected
              </div>
            )}
          </div>

          {/* Loans Given Tracker Card - Tap to view */}
          <div
            onClick={() => setShowLoansGivenModal(true)}
            style={{
              background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
              padding: '12px 14px',
              borderRadius: '10px',
              boxShadow: '0 4px 12px rgba(5, 150, 105, 0.3)',
              color: 'white',
              cursor: 'pointer',
              marginBottom: '10px',
              transition: 'transform 0.15s, box-shadow 0.15s'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 6px 16px rgba(5, 150, 105, 0.4)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(5, 150, 105, 0.3)';
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <div style={{ fontSize: '13px', fontWeight: 700, opacity: 0.95 }}>
                💸 Loans Given
              </div>
              <span style={{ fontSize: '10px', opacity: 0.8 }}>Tap to view →</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '18px', fontWeight: 700 }}>
                  {formatCurrency(loansGivenData.total || 0)}
                </div>
                <div style={{ fontSize: '10px', opacity: 0.8 }}>Today's Total</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '18px', fontWeight: 700, color: '#86efac' }}>
                  {loansGivenData.count || 0}
                </div>
                <div style={{ fontSize: '10px', opacity: 0.8 }}>Loans</div>
              </div>
            </div>
          </div>

          {/* Weekly Loans Overview Card */}
          {weeklyDiagnostic && (
            <div style={{
              background: 'linear-gradient(135deg, #0369a1 0%, #0c4a6e 100%)',
              borderRadius: '10px',
              padding: '12px 14px',
              marginBottom: '10px',
              boxShadow: '0 4px 12px rgba(3, 105, 161, 0.3)',
              color: 'white'
            }}>
              <div style={{ fontSize: '12px', fontWeight: 700, marginBottom: '10px', opacity: 0.95 }}>
                📊 {t('weeklyFinanceOverview')}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '8px' }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '16px', fontWeight: 700 }}>
                    {formatCurrency(weeklyDiagnostic.totalLoanAmount)}
                  </div>
                  <div style={{ fontSize: '9px', opacity: 0.8 }}>{t('totalGiven')}</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '16px', fontWeight: 700, color: '#fcd34d' }}>
                    {formatCurrency(weeklyDiagnostic.totalBalance)}
                  </div>
                  <div style={{ fontSize: '9px', opacity: 0.8 }}>{t('outstanding')}</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '16px', fontWeight: 700, color: '#86efac' }}>
                    {formatCurrency(weeklyDiagnostic.totalLoanAmount - weeklyDiagnostic.totalBalance)}
                  </div>
                  <div style={{ fontSize: '9px', opacity: 0.8 }}>{t('collected')}</div>
                </div>
              </div>
              <div style={{
                background: 'rgba(255,255,255,0.15)',
                borderRadius: '6px',
                padding: '6px 10px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                fontSize: '10px'
              }}>
                <span>
                  <strong>{weeklyDiagnostic.totalWeeklyLoans}</strong> active loans
                </span>
                <span style={{ opacity: 0.9 }}>
                  Weekly total: <strong>{formatCurrency(weeklyDiagnostic.totalWeeklyAmount)}</strong>/week
                </span>
              </div>
              {!weeklyPaymentsData.loading && (weeklyPaymentsData.paidLoans.length > 0 || weeklyPaymentsData.unpaidLoans.length > 0) && (
                <div style={{
                  marginTop: '8px',
                  padding: '6px 10px',
                  background: 'rgba(0,0,0,0.2)',
                  borderRadius: '6px',
                  fontSize: '10px',
                  textAlign: 'center'
                }}>
                  📅 This Sunday: <strong>{weeklyPaymentsData.paidLoans.length + weeklyPaymentsData.unpaidLoans.length}</strong> of {weeklyDiagnostic.totalWeeklyLoans} loans due
                </div>
              )}
            </div>
          )}

          {/* Weekly Payments Table */}
          <div style={{
            background: 'white',
            borderRadius: '8px',
            padding: '12px',
            marginBottom: '10px',
            boxShadow: '0 2px 6px rgba(0,0,0,0.1)'
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '10px',
              flexWrap: 'wrap',
              gap: '8px'
            }}>
              <h3 style={{
                margin: 0,
                fontSize: '14px',
                fontWeight: 700,
                color: '#1e293b'
              }}>
                📅 {t('weeklyPayments')}
              </h3>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                style={{
                  padding: '6px 10px',
                  borderRadius: '6px',
                  border: '1px solid #d1d5db',
                  fontSize: '12px',
                  fontWeight: 600,
                  color: '#1e293b'
                }}
              />
            </div>

{(() => {
              // Get the selected date and check if it's a Sunday
              const selected = new Date(selectedDate + 'T00:00:00');
              const isSunday = selected.getDay() === 0;

              if (!isSunday) {
                return (
                  <div style={{
                    textAlign: 'center',
                    padding: '20px',
                    color: '#dc2626',
                    fontSize: '13px',
                    fontWeight: 600
                  }}>
                    ⚠️ Please select a Sunday. Collections are only on Sundays.
                  </div>
                );
              }

              // Show loading state while fetching payment data
              if (weeklyPaymentsData.loading) {
                return (
                  <div style={{
                    textAlign: 'center',
                    padding: '20px',
                    color: '#6b7280',
                    fontSize: '13px'
                  }}>
                    Loading payments...
                  </div>
                );
              }

              // Use data from state (fetched in useEffect)
              const { paidLoans, unpaidLoans } = weeklyPaymentsData;

              if (paidLoans.length === 0 && unpaidLoans.length === 0) {
                return (
                  <div style={{
                    textAlign: 'center',
                    padding: '20px',
                    color: '#6b7280',
                    fontSize: '13px'
                  }}>
                    No payments due for this Sunday
                  </div>
                );
              }

              // Calculate totals
              const paidTotal = paidLoans.reduce((sum, item) => sum + item.paymentAmount, 0);
              const unpaidTotal = unpaidLoans.reduce((sum, item) => sum + item.paymentAmount, 0);
              const grandTotal = paidTotal + unpaidTotal;

              return (
                <div>
                  {/* Total Summary */}
                  <div style={{
                    background: 'linear-gradient(135deg, #1e40af 0%, #1e3a8a 100%)',
                    borderRadius: '8px',
                    padding: '10px 14px',
                    marginBottom: '10px',
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr 1fr',
                    gap: '10px',
                    color: 'white'
                  }}>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '16px', fontWeight: 700, color: '#86efac' }}>
                        {formatCurrency(paidTotal)}
                      </div>
                      <div style={{ fontSize: '10px', opacity: 0.8 }}>{t('collected')}</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '16px', fontWeight: 700, color: '#fca5a5' }}>
                        {formatCurrency(unpaidTotal)}
                      </div>
                      <div style={{ fontSize: '10px', opacity: 0.8 }}>{t('pending')}</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '16px', fontWeight: 700 }}>
                        {formatCurrency(grandTotal)}
                      </div>
                      <div style={{ fontSize: '10px', opacity: 0.8 }}>{t('totalDue')}</div>
                    </div>
                  </div>

                  {/* Print Daily Summary Button */}
                  <button
                    onClick={printDailySummaryThermal}
                    style={{
                      width: '100%',
                      padding: '10px',
                      marginBottom: '10px',
                      background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      fontSize: '13px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      boxShadow: '0 2px 8px rgba(245, 158, 11, 0.3)'
                    }}
                  >
                    🖨️ Print Daily Summary (Thermal)
                  </button>

                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '10px',
                  overflowX: 'auto'
                }}>
                  {/* PAID Column */}
                  <div style={{
                    background: '#f0fdf4',
                    borderRadius: '8px',
                    padding: '10px',
                    minWidth: '250px'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <h4 style={{
                        margin: 0,
                        fontSize: '13px',
                        fontWeight: 700,
                        color: '#065f46'
                      }}>
                        ✓ {t('paid').toUpperCase()} ({paidLoans.length})
                      </h4>
                      {paidLoans.length > 0 && (
                        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                          <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px', color: '#065f46', cursor: 'pointer' }}>
                            <input
                              type="checkbox"
                              checked={selectedPaid.size === paidLoans.length && paidLoans.length > 0}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedPaid(new Set(paidLoans.map(p => p.loan.loan_id)));
                                } else {
                                  setSelectedPaid(new Set());
                                }
                              }}
                              style={{ cursor: 'pointer' }}
                            />
                            All
                          </label>
                          {selectedPaid.size > 0 && (
                            <button
                              onClick={handleBulkUndo}
                              disabled={isPaymentLoading}
                              style={{
                                background: '#dc2626',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                padding: '4px 8px',
                                fontSize: '10px',
                                fontWeight: 600,
                                cursor: isPaymentLoading ? 'not-allowed' : 'pointer',
                                opacity: isPaymentLoading ? 0.6 : 1
                              }}
                            >
                              {isPaymentLoading ? '...' : `Undo (${selectedPaid.size})`}
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                    <div style={{ display: 'grid', gap: '4px' }}>
                      {paidLoans.map(({ customer, loan, paymentAmount, weekNumber, totalWeeks, remainingWeeks, balance, payment }) => (
                        <div
                          key={loan.loan_id}
                          style={{
                            background: selectedPaid.has(loan.loan_id)
                              ? 'linear-gradient(135deg, #bbf7d0 0%, #86efac 100%)'
                              : 'linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%)',
                            padding: '6px 8px',
                            borderRadius: '6px',
                            border: selectedPaid.has(loan.loan_id) ? '2px solid #22c55e' : '1px solid #6ee7b7',
                            transition: 'all 0.15s',
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: '8px'
                          }}
                        >
                          {/* Checkbox for bulk selection */}
                          <input
                            type="checkbox"
                            checked={selectedPaid.has(loan.loan_id)}
                            onChange={(e) => {
                              e.stopPropagation();
                              const newSelected = new Set(selectedPaid);
                              if (newSelected.has(loan.loan_id)) {
                                newSelected.delete(loan.loan_id);
                              } else {
                                newSelected.add(loan.loan_id);
                              }
                              setSelectedPaid(newSelected);
                            }}
                            onClick={(e) => e.stopPropagation()}
                            style={{
                              cursor: 'pointer',
                              marginTop: '2px',
                              accentColor: '#22c55e'
                            }}
                          />
                          {/* Customer Info */}
                          <div
                            style={{ flex: 1, cursor: 'pointer' }}
                            onClick={() => navigateTo('loan-details', loan.loan_id)}
                            onMouseOver={(e) => {
                              e.currentTarget.parentElement.style.transform = 'scale(1.02)';
                              e.currentTarget.parentElement.style.boxShadow = '0 2px 8px rgba(16, 185, 129, 0.3)';
                            }}
                            onMouseOut={(e) => {
                              e.currentTarget.parentElement.style.transform = 'scale(1)';
                              e.currentTarget.parentElement.style.boxShadow = 'none';
                            }}
                          >
                            <div style={{ fontWeight: 700, fontSize: '11px', color: '#065f46', marginBottom: '2px' }}>
                              {customer.name}
                              {loan.loan_name && loan.loan_name !== 'General Loan' && (
                                <span style={{ fontSize: '10px', color: '#047857', fontWeight: 500, marginLeft: '4px' }}>
                                  • {loan.loan_name}
                                </span>
                              )}
                            </div>
                            <div style={{ fontSize: '10px', color: '#047857', fontWeight: 600, marginBottom: '1px' }}>
                              Week {weekNumber}/{totalWeeks} • {formatCurrency(paymentAmount)}
                            </div>
                            <div style={{ fontSize: '9px', color: '#059669', fontWeight: 500 }}>
                              Bal: {formatCurrency(balance)} • {remainingWeeks}w left
                            </div>
                          </div>

                          <div style={{ display: 'flex', gap: '4px' }}>
                            {/* WhatsApp Button */}
                            {customer.phone && (
                              <button
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  const phone = customer.phone.replace(/\D/g, '');
                                  const friendNameLine = loan.loan_name && loan.loan_name !== 'General Loan'
                                    ? `Friend name: ${loan.loan_name}\n`
                                    : '';
                                  const message = `Payment Receipt\n\nCustomer: ${customer.name}\n${friendNameLine}Amount: ${formatCurrency(paymentAmount)}\nDate: ${new Date(selectedDate).toLocaleDateString('en-IN')}\nWeek: ${weekNumber}\nBalance Remaining: ${formatCurrency(balance)}\n\nThank you for your payment!`;
                                  window.open(`https://wa.me/91${phone}?text=${encodeURIComponent(message)}`, '_blank');
                                  // Mark as sent in database
                                  if (payment?.id) {
                                    try {
                                      await fetch(`${API_URL}/payments/${payment.id}/whatsapp-sent`, {
                                        method: 'PUT',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({ sent_by: localStorage.getItem('userName') || 'Unknown' })
                                      });
                                      // Refresh to show updated status
                                      setPaymentsRefreshKey(k => k + 1);
                                    } catch (err) {
                                      console.error('Error marking WhatsApp sent:', err);
                                    }
                                  }
                                }}
                                style={{
                                  background: payment?.whatsapp_sent ? '#e5e7eb' : '#dcfce7',
                                  border: payment?.whatsapp_sent ? '1px solid #9ca3af' : '1px solid #86efac',
                                  borderRadius: '4px',
                                  padding: '4px 6px',
                                  cursor: 'pointer',
                                  fontSize: '9px',
                                  color: payment?.whatsapp_sent ? '#6b7280' : '#16a34a',
                                  fontWeight: 600,
                                  display: 'flex',
                                  flexDirection: 'column',
                                  alignItems: 'center',
                                  gap: '1px'
                                }}
                                title={payment?.whatsapp_sent ? `Already sent by ${payment.whatsapp_sent_by}` : 'Send WhatsApp receipt'}
                              >
                                {payment?.whatsapp_sent ? '✓' : '📱'}
                                <span>{payment?.whatsapp_sent ? 'Sent' : 'WA'}</span>
                              </button>
                            )}

                            {/* Print Button */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setPrintData({
                                  type: 'payment',
                                  data: {
                                    customerName: customer.name,
                                    phone: customer.phone,
                                    loanName: loan.loan_name,
                                    loanAmount: loan.loan_amount,
                                    amountPaid: paymentAmount,
                                    totalPaid: loan.loan_amount - balance,
                                    balance: balance,
                                    weekNumber: weekNumber,
                                    date: selectedDate,
                                    loanType: 'Weekly'
                                  }
                                });
                              }}
                              style={{
                                background: '#ede9fe',
                                border: '1px solid #c4b5fd',
                                borderRadius: '4px',
                                padding: '4px 6px',
                                cursor: 'pointer',
                                fontSize: '9px',
                                color: '#7c3aed',
                                fontWeight: 600,
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                gap: '1px'
                              }}
                              title="Print receipt"
                            >
                              🖨️
                              <span>Print</span>
                            </button>

                            {/* Undo Button */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setUndoPaymentConfirm({ loan, customer, amount: paymentAmount, weekNumber });
                              }}
                              style={{
                                background: '#fee2e2',
                                border: '1px solid #fca5a5',
                                borderRadius: '4px',
                                padding: '4px 6px',
                                cursor: 'pointer',
                                fontSize: '9px',
                                color: '#dc2626',
                                fontWeight: 600,
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                gap: '1px'
                              }}
                              title="Undo this payment"
                            >
                              ↩️
                              <span>Undo</span>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* UNPAID Column */}
                  <div style={{
                    background: '#fef2f2',
                    borderRadius: '8px',
                    padding: '10px',
                    minWidth: '250px'
                  }}>
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: '8px'
                    }}>
                      <h4 style={{
                        margin: 0,
                        fontSize: '13px',
                        fontWeight: 700,
                        color: '#991b1b'
                      }}>
                        ✗ {t('unpaid').toUpperCase()} ({unpaidLoans.length})
                      </h4>
                      {unpaidLoans.length > 0 && (
                        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                          <label style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            fontSize: '10px',
                            color: '#991b1b',
                            cursor: 'pointer'
                          }}>
                            <input
                              type="checkbox"
                              checked={selectedUnpaid.size === unpaidLoans.length && unpaidLoans.length > 0}
                              onChange={() => toggleSelectAll(unpaidLoans)}
                              style={{ cursor: 'pointer' }}
                            />
                            All
                          </label>
                        </div>
                      )}
                    </div>

                    {/* WhatsApp Share Button */}
                    {selectedUnpaid.size > 0 && (
                      <button
                        onClick={() => shareViaWhatsApp(unpaidLoans)}
                        style={{
                          width: '100%',
                          padding: '8px 12px',
                          marginBottom: '8px',
                          background: 'linear-gradient(135deg, #25D366 0%, #128C7E 100%)',
                          color: 'white',
                          border: 'none',
                          borderRadius: '6px',
                          fontSize: '12px',
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '6px',
                          boxShadow: '0 2px 6px rgba(37, 211, 102, 0.3)'
                        }}
                      >
                        📱 Share {selectedUnpaid.size} via WhatsApp
                      </button>
                    )}

                    <div style={{ display: 'grid', gap: '4px' }}>
                      {unpaidLoans.map(({ customer, loan, paymentAmount, weekNumber, totalWeeks, remainingWeeks, balance }) => (
                        <div
                          key={loan.loan_id}
                          style={{
                            background: getUnpaidCardColor(balance),
                            padding: '6px 8px',
                            borderRadius: '6px',
                            border: selectedUnpaid.has(loan.loan_id)
                              ? '2px solid #25D366'
                              : balance > 10000
                                ? '1px solid #fca5a5'
                                : balance > 5000
                                  ? '1px solid #fb923c'
                                  : '1px solid #fecaca',
                            transition: 'all 0.15s',
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: '8px'
                          }}
                        >
                          {/* Checkbox */}
                          <input
                            type="checkbox"
                            checked={selectedUnpaid.has(loan.loan_id)}
                            onChange={() => toggleUnpaidSelection(loan.loan_id)}
                            onClick={(e) => e.stopPropagation()}
                            style={{
                              cursor: 'pointer',
                              marginTop: '2px',
                              width: '16px',
                              height: '16px',
                              accentColor: '#25D366'
                            }}
                          />

                          {/* Customer Info */}
                          <div
                            style={{ flex: 1, cursor: 'pointer' }}
                            onClick={() => navigateTo('loan-details', loan.loan_id)}
                            onMouseOver={(e) => {
                              e.currentTarget.parentElement.style.transform = 'scale(1.02)';
                              e.currentTarget.parentElement.style.boxShadow = '0 2px 8px rgba(220, 38, 38, 0.3)';
                            }}
                            onMouseOut={(e) => {
                              e.currentTarget.parentElement.style.transform = 'scale(1)';
                              e.currentTarget.parentElement.style.boxShadow = 'none';
                            }}
                          >
                            <div style={{ fontWeight: 700, fontSize: '11px', color: '#7f1d1d', marginBottom: '2px' }}>
                              {customer.name}
                              {loan.loan_name && loan.loan_name !== 'General Loan' && (
                                <span style={{ fontSize: '10px', color: '#991b1b', fontWeight: 500, marginLeft: '4px' }}>
                                  • {loan.loan_name}
                                </span>
                              )}
                            </div>
                            <div style={{ fontSize: '10px', color: '#991b1b', fontWeight: 600, marginBottom: '1px' }}>
                              Week {weekNumber}/{totalWeeks} • {formatCurrency(paymentAmount)}
                            </div>
                            <div style={{ fontSize: '9px', color: '#dc2626', fontWeight: 700 }}>
                              ⚠️ {formatCurrency(balance)} • {remainingWeeks}w left
                            </div>
                          </div>

                          {/* Quick Pay Checkbox */}
                          <div
                            onClick={(e) => e.stopPropagation()}
                            style={{
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'center',
                              gap: '2px'
                            }}
                          >
                            <input
                              type="checkbox"
                              onChange={() => setQuickPayConfirm({ loan, customer, amount: paymentAmount, weekNumber })}
                              checked={false}
                              style={{
                                cursor: 'pointer',
                                width: '18px',
                                height: '18px',
                                accentColor: '#10b981'
                              }}
                            />
                            <span style={{ fontSize: '8px', color: '#059669', fontWeight: 600 }}>Paid</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                </div>
              );
            })()}
          </div>

          {/* Monthly Finance Payments Section */}
          <div style={{
            background: 'white',
            borderRadius: '8px',
            padding: '12px',
            marginBottom: '10px',
            marginTop: '10px',
            boxShadow: '0 2px 6px rgba(0,0,0,0.1)'
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '10px',
              flexWrap: 'wrap',
              gap: '8px'
            }}>
              <h3 style={{
                margin: 0,
                fontSize: '14px',
                fontWeight: 700,
                color: '#1e293b'
              }}>
                📅 {t('monthlyFinance')}
              </h3>
              <input
                type="month"
                value={selectedMonthlyFinanceMonth}
                onChange={(e) => setSelectedMonthlyFinanceMonth(e.target.value)}
                style={{
                  padding: '6px 10px',
                  border: '2px solid #7c3aed',
                  borderRadius: '6px',
                  fontSize: '13px',
                  fontWeight: 600,
                  color: '#1e293b',
                  background: 'white',
                  cursor: 'pointer'
                }}
              />
            </div>

            {(() => {
              // Calculate which customers have paid/not paid for the selected month
              const selectedDate = new Date(selectedMonthlyFinanceMonth + '-01');
              const currentMonth = selectedDate.getMonth();
              const currentYear = selectedDate.getFullYear();
              const currentDay = new Date().getDate();

              // Filter active monthly customers
              const activeMonthlyCustomers = (monthlyCustomers || []).filter(c =>
                c.status === 'active' && c.balance > 0
              );

              if (activeMonthlyCustomers.length === 0) {
                return (
                  <div style={{
                    textAlign: 'center',
                    padding: '20px',
                    color: '#6b7280',
                    fontSize: '13px'
                  }}>
                    No active monthly customers
                  </div>
                );
              }

              // Check payment status for each customer
              const paidMonthlyCustomers = [];
              const unpaidMonthlyCustomers = [];

              activeMonthlyCustomers.forEach(customer => {
                // Calculate how many months have been paid
                const totalPaid = customer.loan_amount - customer.balance;
                const monthsPaid = Math.floor(totalPaid / customer.monthly_amount);

                // Generate payment schedule to find which payment number is due in the selected month
                const startDate = new Date(customer.start_date);
                let foundPaymentInMonth = false;
                let isPaidForThisMonth = false;

                // Check all possible payment numbers (1 to total_months)
                for (let paymentNum = 0; paymentNum < customer.total_months; paymentNum++) {
                  const paymentDueDate = new Date(startDate);
                  paymentDueDate.setMonth(startDate.getMonth() + paymentNum); // First payment on start_date

                  const paymentMonth = paymentDueDate.getMonth();
                  const paymentYear = paymentDueDate.getFullYear();

                  // Check if this payment is due in the selected viewing month
                  if (paymentMonth === currentMonth && paymentYear === currentYear) {
                    foundPaymentInMonth = true;
                    // Check if this payment has been made (paymentNum is 0-indexed, so payment 1 = index 0)
                    isPaidForThisMonth = monthsPaid > paymentNum;
                    break;
                  }
                }

                // Only include customers who have a payment due in the selected month
                if (foundPaymentInMonth) {
                  if (isPaidForThisMonth) {
                    paidMonthlyCustomers.push(customer);
                  } else {
                    unpaidMonthlyCustomers.push(customer);
                  }
                }
              });

              // Sort by payment day (from start_date) - Date 1, Date 2, etc.
              paidMonthlyCustomers.sort((a, b) => {
                const dayA = a.start_date ? new Date(a.start_date).getDate() : 1;
                const dayB = b.start_date ? new Date(b.start_date).getDate() : 1;
                return dayA - dayB;
              });
              unpaidMonthlyCustomers.sort((a, b) => {
                const dayA = a.start_date ? new Date(a.start_date).getDate() : 1;
                const dayB = b.start_date ? new Date(b.start_date).getDate() : 1;
                return dayA - dayB;
              });

              // Calculate totals
              const paidTotal = paidMonthlyCustomers.reduce((sum, c) => sum + (c.monthly_amount || 0), 0);
              const unpaidTotal = unpaidMonthlyCustomers.reduce((sum, c) => sum + (c.monthly_amount || 0), 0);
              const grandTotal = paidTotal + unpaidTotal;

              return (
                <div>
                  {/* Total Summary */}
                  <div style={{
                    background: 'linear-gradient(135deg, #7c3aed 0%, #5b21b6 100%)',
                    borderRadius: '8px',
                    padding: '10px 14px',
                    marginBottom: '10px',
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr 1fr',
                    gap: '10px',
                    color: 'white'
                  }}>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '16px', fontWeight: 700, color: '#86efac' }}>
                        {formatCurrency(paidTotal)}
                      </div>
                      <div style={{ fontSize: '10px', opacity: 0.8 }}>{t('collected')} ({paidMonthlyCustomers.length})</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '16px', fontWeight: 700, color: '#fca5a5' }}>
                        {formatCurrency(unpaidTotal)}
                      </div>
                      <div style={{ fontSize: '10px', opacity: 0.8 }}>{t('pending')} ({unpaidMonthlyCustomers.length})</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '16px', fontWeight: 700 }}>
                        {formatCurrency(grandTotal)}
                      </div>
                      <div style={{ fontSize: '10px', opacity: 0.8 }}>{t('totalDue')}</div>
                    </div>
                  </div>

                  {/* Print Monthly Summary Button */}
                  <button
                    onClick={() => printMonthlyFinanceAuditThermal(paidMonthlyCustomers, unpaidMonthlyCustomers)}
                    style={{
                      width: '100%',
                      padding: '10px',
                      marginBottom: '10px',
                      background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      fontSize: '13px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      boxShadow: '0 2px 8px rgba(139, 92, 246, 0.3)'
                    }}
                  >
                    🖨️ Print Monthly Audit (Thermal)
                  </button>

                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '10px',
                    overflowX: 'auto'
                  }}>
                    {/* PAID Column */}
                    <div style={{
                      background: '#f0fdf4',
                      borderRadius: '8px',
                      padding: '10px',
                      minWidth: '200px'
                    }}>
                      <h4 style={{
                        margin: '0 0 8px 0',
                        fontSize: '13px',
                        fontWeight: 700,
                        color: '#065f46'
                      }}>
                        ✓ {t('paid').toUpperCase()} ({paidMonthlyCustomers.length})
                      </h4>
                      <div style={{ display: 'grid', gap: '4px', maxHeight: '300px', overflowY: 'auto' }}>
                        {paidMonthlyCustomers.map((customer) => {
                          const paymentDay = customer.start_date ? new Date(customer.start_date).getDate() : '-';
                          return (
                          <div
                            key={customer.id}
                            style={{
                              background: 'linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%)',
                              padding: '6px 8px',
                              borderRadius: '6px',
                              border: '1px solid #6ee7b7',
                              transition: 'all 0.15s',
                              display: 'flex',
                              alignItems: 'flex-start',
                              gap: '8px'
                            }}
                          >
                            {/* Customer Info - clickable */}
                            <div
                              style={{ flex: 1, cursor: 'pointer' }}
                              onClick={() => navigateTo('monthly-finance')}
                              onMouseOver={(e) => {
                                e.currentTarget.parentElement.style.transform = 'scale(1.02)';
                                e.currentTarget.parentElement.style.boxShadow = '0 2px 8px rgba(16, 185, 129, 0.3)';
                              }}
                              onMouseOut={(e) => {
                                e.currentTarget.parentElement.style.transform = 'scale(1)';
                                e.currentTarget.parentElement.style.boxShadow = 'none';
                              }}
                            >
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
                                <div style={{ fontWeight: 700, fontSize: '11px', color: '#065f46' }}>
                                  {customer.customer_name || customer.name}
                                </div>
                                <div style={{ fontWeight: 700, fontSize: '11px', color: '#047857', background: 'rgba(255,255,255,0.6)', padding: '2px 6px', borderRadius: '4px' }}>
                                  DATE {paymentDay}
                                </div>
                              </div>
                              <div style={{ fontSize: '10px', color: '#047857', fontWeight: 600, marginBottom: '1px' }}>
                                {formatCurrency(customer.monthly_amount || 0)}
                              </div>
                              <div style={{ fontSize: '9px', color: '#059669', fontWeight: 500 }}>
                                Bal: {formatCurrency(customer.balance || 0)} • M{customer.current_month || '-'}
                              </div>
                            </div>

                            {/* Action Buttons */}
                            <div style={{ display: 'flex', gap: '4px' }}>
                              {/* WhatsApp Button */}
                              {customer.phone && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    sendMonthlyWhatsApp(customer);
                                  }}
                                  style={{
                                    background: '#dcfce7',
                                    border: '1px solid #86efac',
                                    borderRadius: '4px',
                                    padding: '4px 6px',
                                    cursor: 'pointer',
                                    fontSize: '9px',
                                    color: '#16a34a',
                                    fontWeight: 600,
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    gap: '1px'
                                  }}
                                  title="Send WhatsApp receipt"
                                >
                                  📱
                                  <span>WA</span>
                                </button>
                              )}

                              {/* Print Button */}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  printMonthlyReceipt(customer);
                                }}
                                style={{
                                  background: '#ede9fe',
                                  border: '1px solid #c4b5fd',
                                  borderRadius: '4px',
                                  padding: '4px 6px',
                                  cursor: 'pointer',
                                  fontSize: '9px',
                                  color: '#7c3aed',
                                  fontWeight: 600,
                                  display: 'flex',
                                  flexDirection: 'column',
                                  alignItems: 'center',
                                  gap: '1px'
                                }}
                                title="Print receipt"
                              >
                                🖨️
                                <span>Print</span>
                              </button>

                              {/* Undo Button */}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setMonthlyUndoConfirm(customer);
                                }}
                                style={{
                                  background: '#fee2e2',
                                  border: '1px solid #fca5a5',
                                  borderRadius: '4px',
                                  padding: '4px 6px',
                                  cursor: 'pointer',
                                  fontSize: '9px',
                                  color: '#dc2626',
                                  fontWeight: 600,
                                  display: 'flex',
                                  flexDirection: 'column',
                                  alignItems: 'center',
                                  gap: '1px'
                                }}
                                title="Undo this payment"
                              >
                                ↩️
                                <span>Undo</span>
                              </button>
                            </div>
                          </div>
                          );
                        })}
                        {paidMonthlyCustomers.length === 0 && (
                          <div style={{ fontSize: '11px', color: '#6b7280', textAlign: 'center', padding: '10px' }}>
                            No payments yet
                          </div>
                        )}
                      </div>
                    </div>

                    {/* UNPAID Column */}
                    <div style={{
                      background: '#fef2f2',
                      borderRadius: '8px',
                      padding: '10px',
                      minWidth: '200px'
                    }}>
                      <h4 style={{
                        margin: '0 0 8px 0',
                        fontSize: '13px',
                        fontWeight: 700,
                        color: '#991b1b'
                      }}>
                        ✗ {t('unpaid').toUpperCase()} ({unpaidMonthlyCustomers.length})
                      </h4>
                      <div style={{ display: 'grid', gap: '4px', maxHeight: '300px', overflowY: 'auto' }}>
                        {unpaidMonthlyCustomers.map((customer) => {
                          const paymentDay = customer.start_date ? new Date(customer.start_date).getDate() : null;
                          const isDuePassed = paymentDay && paymentDay < currentDay;
                          return (
                            <div
                              key={customer.id}
                              style={{
                                background: isDuePassed
                                  ? 'linear-gradient(135deg, #fecaca 0%, #fca5a5 100%)'
                                  : 'linear-gradient(135deg, #fee2e2 0%, #fecaca 100%)',
                                padding: '6px 8px',
                                borderRadius: '6px',
                                border: isDuePassed ? '2px solid #ef4444' : '1px solid #fca5a5',
                                transition: 'all 0.15s',
                                display: 'flex',
                                alignItems: 'flex-start',
                                gap: '8px'
                              }}
                            >
                              {/* Customer Info - clickable */}
                              <div
                                style={{ flex: 1, cursor: 'pointer' }}
                                onClick={() => navigateTo('monthly-finance')}
                                onMouseOver={(e) => {
                                  e.currentTarget.parentElement.style.transform = 'scale(1.02)';
                                  e.currentTarget.parentElement.style.boxShadow = '0 2px 8px rgba(220, 38, 38, 0.3)';
                                }}
                                onMouseOut={(e) => {
                                  e.currentTarget.parentElement.style.transform = 'scale(1)';
                                  e.currentTarget.parentElement.style.boxShadow = 'none';
                                }}
                              >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
                                  <div style={{ fontWeight: 700, fontSize: '11px', color: '#7f1d1d' }}>
                                    {customer.customer_name || customer.name}
                                    {isDuePassed && <span style={{ marginLeft: '4px', color: '#dc2626' }}>⚠️</span>}
                                  </div>
                                  <div style={{ fontWeight: 700, fontSize: '11px', color: '#991b1b', background: 'rgba(255,255,255,0.6)', padding: '2px 6px', borderRadius: '4px' }}>
                                    DATE {paymentDay || '-'}
                                  </div>
                                </div>
                                <div style={{ fontSize: '10px', color: '#991b1b', fontWeight: 600, marginBottom: '1px' }}>
                                  {formatCurrency(customer.monthly_amount || 0)}
                                </div>
                                <div style={{ fontSize: '9px', color: '#dc2626', fontWeight: 500 }}>
                                  Bal: {formatCurrency(customer.balance || 0)} • M{customer.current_month || '-'}
                                </div>
                              </div>

                              {/* Pay Checkbox */}
                              <div
                                onClick={(e) => e.stopPropagation()}
                                style={{
                                  display: 'flex',
                                  flexDirection: 'column',
                                  alignItems: 'center',
                                  gap: '2px'
                                }}
                              >
                                <input
                                  type="checkbox"
                                  onChange={() => setMonthlyPaymentConfirm(customer)}
                                  checked={false}
                                  style={{
                                    cursor: 'pointer',
                                    width: '18px',
                                    height: '18px',
                                    accentColor: '#10b981'
                                  }}
                                />
                                <span style={{ fontSize: '8px', color: '#059669', fontWeight: 600 }}>Paid</span>
                              </div>
                            </div>
                          );
                        })}
                        {unpaidMonthlyCustomers.length === 0 && (
                          <div style={{ fontSize: '11px', color: '#6b7280', textAlign: 'center', padding: '10px' }}>
                            All payments collected!
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>

          {/* Pending Payments (UPI) Section */}
          {pendingPayments && pendingPayments.length > 0 && (
            <div
              id="pending-payments-section"
              data-section="pending-payments"
              style={{
                background: isDarkMode ? theme.backgroundCard : 'white',
                borderRadius: '12px',
                padding: '16px',
                marginTop: '10px',
                boxShadow: isDarkMode ? theme.shadow : '0 2px 6px rgba(0,0,0,0.1)'
              }}
            >
              <div
                onClick={() => setShowPendingPayments(!showPendingPayments)}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  cursor: 'pointer',
                  marginBottom: showPendingPayments ? '16px' : 0
                }}
              >
                <h3 style={{
                  margin: 0,
                  fontSize: '14px',
                  fontWeight: 700,
                  color: isDarkMode ? theme.text : '#1e293b',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <span style={{
                    background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                    color: 'white',
                    width: '24px',
                    height: '24px',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '12px',
                    fontWeight: 700
                  }}>
                    {pendingPayments.length}
                  </span>
                  {language === 'ta' ? '⏳ நிலுவையில் உள்ள கொடுப்பனவுகள்' : '⏳ Pending UPI Payments'}
                </h3>
                <span style={{
                  fontSize: '16px',
                  transition: 'transform 0.3s',
                  transform: showPendingPayments ? 'rotate(180deg)' : 'rotate(0deg)'
                }}>
                  {showPendingPayments ? '▲' : '▼'}
                </span>
              </div>

              {showPendingPayments && (
                <div style={{ display: 'grid', gap: '12px' }}>
                  {pendingPayments.map((payment) => (
                    <div
                      key={payment.id}
                      style={{
                        background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
                        border: '2px solid #f59e0b',
                        borderRadius: '12px',
                        padding: '16px',
                        boxShadow: '0 2px 8px rgba(245, 158, 11, 0.2)'
                      }}
                    >
                      {/* Payment Header */}
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        marginBottom: '12px',
                        paddingBottom: '12px',
                        borderBottom: '1px solid #f59e0b'
                      }}>
                        <div>
                          <div style={{
                            fontSize: '14px',
                            fontWeight: 700,
                            color: '#92400e',
                            marginBottom: '4px'
                          }}>
                            {payment.customer_name}
                          </div>
                          <div style={{
                            fontSize: '11px',
                            color: '#78350f',
                            fontFamily: 'monospace'
                          }}>
                            📱 {payment.customer_phone}
                          </div>
                        </div>
                        <div style={{
                          background: 'white',
                          padding: '6px 12px',
                          borderRadius: '8px',
                          fontSize: '12px',
                          fontWeight: 700,
                          color: '#059669'
                        }}>
                          {formatCurrency(payment.amount)}
                        </div>
                      </div>

                      {/* Payment Details */}
                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 1fr',
                        gap: '8px',
                        marginBottom: '12px',
                        fontSize: '11px',
                        color: '#78350f'
                      }}>
                        <div>
                          <strong>Loan Type:</strong> {payment.loan_type}
                        </div>
                        <div>
                          <strong>Loan ID:</strong> #{payment.loan_id}
                        </div>
                        <div style={{ gridColumn: '1 / -1' }}>
                          <strong>Submitted:</strong> {new Date(payment.created_at).toLocaleString('en-IN', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </div>
                      </div>

                      {/* Payment Screenshot */}
                      {payment?.payment_proof_url && (
                        <div style={{ marginBottom: '12px' }}>
                          <div style={{
                            fontSize: '11px',
                            fontWeight: 600,
                            color: '#78350f',
                            marginBottom: '6px'
                          }}>
                            Payment Screenshot:
                          </div>
                          <a
                            href={payment.payment_proof_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              display: 'block',
                              width: '100%',
                              maxWidth: '300px',
                              margin: '0 auto'
                            }}
                          >
                            <img
                              src={payment.payment_proof_url}
                              alt="Payment proof"
                              style={{
                                width: '100%',
                                height: 'auto',
                                borderRadius: '8px',
                                border: '2px solid #d97706',
                                cursor: 'pointer',
                                maxHeight: '200px',
                                objectFit: 'contain',
                                background: 'white'
                              }}
                            />
                          </a>
                          <div style={{
                            fontSize: '10px',
                            color: '#92400e',
                            textAlign: 'center',
                            marginTop: '4px'
                          }}>
                            Click to view full size
                          </div>
                        </div>
                      )}

                      {/* Action Buttons */}
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          onClick={() => handleApprovePendingPayment(payment)}
                          style={{
                            flex: 1,
                            padding: '12px',
                            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                            color: 'white',
                            border: 'none',
                            borderRadius: '8px',
                            fontSize: '13px',
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '6px',
                            boxShadow: '0 2px 8px rgba(16, 185, 129, 0.3)',
                            transition: 'all 0.2s'
                          }}
                          onMouseOver={(e) => {
                            e.currentTarget.style.transform = 'translateY(-2px)';
                            e.currentTarget.style.boxShadow = '0 4px 12px rgba(16, 185, 129, 0.4)';
                          }}
                          onMouseOut={(e) => {
                            e.currentTarget.style.transform = 'translateY(0)';
                            e.currentTarget.style.boxShadow = '0 2px 8px rgba(16, 185, 129, 0.3)';
                          }}
                        >
                          ✓ Approve
                        </button>
                        <button
                          onClick={() => handleRejectPendingPayment(payment)}
                          style={{
                            flex: 1,
                            padding: '12px',
                            background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                            color: 'white',
                            border: 'none',
                            borderRadius: '8px',
                            fontSize: '13px',
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '6px',
                            boxShadow: '0 2px 8px rgba(239, 68, 68, 0.3)',
                            transition: 'all 0.2s'
                          }}
                          onMouseOver={(e) => {
                            e.currentTarget.style.transform = 'translateY(-2px)';
                            e.currentTarget.style.boxShadow = '0 4px 12px rgba(239, 68, 68, 0.4)';
                          }}
                          onMouseOut={(e) => {
                            e.currentTarget.style.transform = 'translateY(0)';
                            e.currentTarget.style.boxShadow = '0 2px 8px rgba(239, 68, 68, 0.3)';
                          }}
                        >
                          ✗ Reject
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Charts Section */}
          <div style={{
            background: isDarkMode ? theme.backgroundCard : 'white',
            borderRadius: '12px',
            padding: '16px',
            marginTop: '10px',
            boxShadow: isDarkMode ? theme.shadow : '0 2px 6px rgba(0,0,0,0.1)'
          }}>
            <div
              onClick={() => setShowCharts(!showCharts)}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                cursor: 'pointer',
                marginBottom: showCharts ? '16px' : 0
              }}
            >
              <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: isDarkMode ? theme.text : '#1e293b' }}>
                {language === 'ta' ? '📊 கடன் விநியோகம்' : '📊 Loan Distribution Chart'}
              </h3>
              <span style={{ fontSize: '16px', transition: 'transform 0.3s', transform: showCharts ? 'rotate(180deg)' : 'rotate(0deg)' }}>
                {showCharts ? '▲' : '▼'}
              </span>
            </div>

            {showCharts && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', minHeight: '200px' }}>
                {/* Pie Chart - Loan Distribution */}
                <div style={{ height: '200px', minWidth: '150px' }}>
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie
                        data={[
                          { name: language === 'ta' ? 'வாராந்திர' : 'Weekly', value: stats?.total_loan_amount || 0 },
                          { name: language === 'ta' ? 'தினசரி' : 'Daily', value: dailySummary?.total_given || 0 },
                          { name: language === 'ta' ? 'வட்டி' : 'Interest', value: vaddiSummary?.totalAmount || 0 }
                        ]}
                        cx="50%"
                        cy="50%"
                        innerRadius={30}
                        outerRadius={60}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        <Cell fill="#3b82f6" />
                        <Cell fill="#22c55e" />
                        <Cell fill="#f59e0b" />
                      </Pie>
                      <Tooltip formatter={(value) => formatCurrency(value)} />
                      <Legend wrapperStyle={{ fontSize: '11px' }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                {/* Bar Chart - Collections vs Outstanding */}
                <div style={{ height: '200px', minWidth: '150px' }}>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart
                      data={[
                        {
                          name: language === 'ta' ? 'வாராந்திர' : 'Weekly',
                          collected: (stats?.total_loan_amount || 0) - (stats?.total_balance || 0),
                          balance: stats?.total_balance || 0
                        },
                        {
                          name: language === 'ta' ? 'தினசரி' : 'Daily',
                          collected: (dailySummary?.total_given || 0) - (dailySummary?.total_outstanding || 0),
                          balance: dailySummary?.total_outstanding || 0
                        }
                      ]}
                      margin={{ top: 10, right: 10, left: 0, bottom: 10 }}
                    >
                      <XAxis dataKey="name" tick={{ fill: isDarkMode ? theme.text : '#64748b', fontSize: 10 }} />
                      <YAxis tick={{ fill: isDarkMode ? theme.text : '#64748b', fontSize: 9 }} tickFormatter={(v) => `₹${(v/1000).toFixed(0)}k`} />
                      <Tooltip formatter={(value) => formatCurrency(value)} />
                      <Legend wrapperStyle={{ fontSize: '10px' }} />
                      <Bar dataKey="collected" name={language === 'ta' ? 'வசூல்' : 'Collected'} fill="#22c55e" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="balance" name={language === 'ta' ? 'நிலுவை' : 'Balance'} fill="#ef4444" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </div>

          {/* Spacer for bottom bar */}
          <div style={{ height: '70px' }} />

        </div>
      </div>

      {/* Bottom Settings Bar */}
      <div style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        background: isDarkMode ? 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)' : 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',
        padding: '12px 16px',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        gap: '20px',
        boxShadow: '0 -2px 10px rgba(0,0,0,0.1)',
        zIndex: 100
      }}>
        {/* Dark Mode Toggle */}
        <div
          onClick={toggleDarkMode}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            cursor: 'pointer',
            padding: '8px 12px',
            borderRadius: '8px',
            background: isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
            transition: 'all 0.3s'
          }}
        >
          <span style={{ fontSize: '18px' }}>{isDarkMode ? '☀️' : '🌙'}</span>
          <span style={{ fontSize: '13px', fontWeight: 600, color: isDarkMode ? theme.text : '#374151' }}>
            {isDarkMode ? t('light') : t('dark')}
          </span>
        </div>

        {/* Language Toggle */}
        <div
          onClick={toggleLanguage}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            cursor: 'pointer',
            padding: '8px 12px',
            borderRadius: '8px',
            background: isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
            transition: 'all 0.3s'
          }}
        >
          <span style={{ fontSize: '18px' }}>🌐</span>
          <span style={{ fontSize: '13px', fontWeight: 600, color: isDarkMode ? theme.text : '#374151' }}>
            {language === 'en' ? 'தமிழ்' : 'English'}
          </span>
        </div>
      </div>

      {showAddCustomerModal && (
        <AddCustomerModal
          onClose={() => setShowAddCustomerModal(false)}
          onSuccess={() => {
            setShowAddCustomerModal(false);
            mutate(); // SWR: Re-fetch data automatically
          }}
        />
      )}

      {showPaymentsThisWeekModal && (
        <PaymentsThisWeekModal
          onClose={() => setShowPaymentsThisWeekModal(false)}
        />
      )}

      {showDatabaseMonitorModal && (
        <DatabaseMonitorModal
          stats={stats}
          onClose={() => setShowDatabaseMonitorModal(false)}
          onRefresh={handleRefresh}
        />
      )}

      {showQuickRefModal && (
        <QuickReferenceModal
          customers={customers}
          onClose={() => setShowQuickRefModal(false)}
          formatCurrency={formatCurrency}
        />
      )}

      {showSendWishes && (
        <SendWishes onClose={() => setShowSendWishes(false)} />
      )}

      {showPrintReports && (
        <PrintReports onClose={() => setShowPrintReports(false)} />
      )}

      {/* Pending Payments Modal */}
      {showPendingPayments && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px'
          }}
          onClick={() => setShowPendingPayments(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'white',
              borderRadius: '16px',
              width: '100%',
              maxWidth: '800px',
              maxHeight: '90vh',
              overflow: 'auto',
              boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
            }}
          >
            {/* Header */}
            <div style={{
              padding: '20px',
              borderBottom: '2px solid #e5e7eb',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)'
            }}>
              <div>
                <h2 style={{
                  margin: 0,
                  fontSize: '20px',
                  fontWeight: 700,
                  color: '#92400e',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  ⏳ {language === 'ta' ? 'நிலுவையில் உள்ள கொடுப்பனவுகள்' : 'Pending UPI Payments'}
                  {pendingPayments && pendingPayments.length > 0 && (
                    <span style={{
                      background: '#f59e0b',
                      color: 'white',
                      borderRadius: '50%',
                      width: '28px',
                      height: '28px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '14px'
                    }}>
                      {pendingPayments.length}
                    </span>
                  )}
                </h2>
                <p style={{
                  margin: '4px 0 0 0',
                  fontSize: '13px',
                  color: '#78350f'
                }}>
                  {language === 'ta' ? 'வாடிக்கையாளர்கள் சமர்ப்பித்த கொடுப்பனவுகளை ஒப்புக்கொள் அல்லது நிராகரி' : 'Review and approve customer payment submissions'}
                </p>
              </div>
              <button
                onClick={() => setShowPendingPayments(false)}
                style={{
                  background: 'white',
                  border: '2px solid #f59e0b',
                  borderRadius: '50%',
                  width: '36px',
                  height: '36px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '20px',
                  color: '#92400e',
                  fontWeight: 700
                }}
              >
                ×
              </button>
            </div>

            {/* Content */}
            <div style={{
              padding: '20px'
            }}>
              {(!pendingPayments || pendingPayments.length === 0) ? (
                <div style={{
                  textAlign: 'center',
                  padding: '60px 20px',
                  color: '#64748b'
                }}>
                  <div style={{ fontSize: '64px', marginBottom: '16px' }}>✓</div>
                  <h3 style={{ margin: '0 0 8px 0', fontSize: '18px', fontWeight: 600 }}>
                    {language === 'ta' ? 'நிலுவையில் கொடுப்பனவுகள் இல்லை' : 'No Pending Payments'}
                  </h3>
                  <p style={{ margin: 0, fontSize: '14px' }}>
                    {language === 'ta' ? 'அனைத்து கொடுப்பனவுகளும் செயலாக்கப்பட்டன' : 'All payments have been processed'}
                  </p>
                </div>
              ) : (
                <div style={{ display: 'grid', gap: '16px' }}>
                  {Array.isArray(pendingPayments) && pendingPayments.map((payment) => (
                    <div
                      key={payment?.id || Math.random()}
                      style={{
                        background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
                        border: '2px solid #f59e0b',
                        borderRadius: '12px',
                        padding: '16px',
                        boxShadow: '0 2px 8px rgba(245, 158, 11, 0.2)'
                      }}
                    >
                      {/* Payment Header */}
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        marginBottom: '12px',
                        paddingBottom: '12px',
                        borderBottom: '1px solid #f59e0b'
                      }}>
                        <div>
                          <div style={{
                            fontSize: '16px',
                            fontWeight: 700,
                            color: '#92400e',
                            marginBottom: '4px'
                          }}>
                            {payment?.customer_name || 'Unknown'}
                          </div>
                          <div style={{
                            fontSize: '12px',
                            color: '#78350f',
                            fontFamily: 'monospace'
                          }}>
                            📱 {payment?.customer_phone || 'N/A'}
                          </div>
                        </div>
                        <div style={{
                          background: 'white',
                          padding: '8px 16px',
                          borderRadius: '8px',
                          fontSize: '14px',
                          fontWeight: 700,
                          color: '#059669'
                        }}>
                          {formatCurrency(payment?.amount || 0)}
                        </div>
                      </div>

                      {/* Payment Details */}
                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                        gap: '8px',
                        marginBottom: '12px',
                        fontSize: '12px',
                        color: '#78350f'
                      }}>
                        <div>
                          <strong>{language === 'ta' ? 'கடன் வகை:' : 'Loan Type:'}</strong> {payment?.loan_type || 'N/A'}
                        </div>
                        <div>
                          <strong>{language === 'ta' ? 'கடன் ID:' : 'Loan ID:'}</strong> #{payment?.loan_id || 'N/A'}
                        </div>
                        <div style={{ gridColumn: '1 / -1' }}>
                          <strong>{language === 'ta' ? 'சமர்ப்பிக்கப்பட்டது:' : 'Submitted:'}</strong> {payment?.created_at ? new Date(payment.created_at).toLocaleString('en-IN', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          }) : 'N/A'}
                        </div>
                      </div>

                      {/* Payment Screenshot */}
                      {payment?.payment_proof_url && (
                        <div style={{ marginBottom: '12px' }}>
                          <div style={{
                            fontSize: '12px',
                            fontWeight: 600,
                            color: '#78350f',
                            marginBottom: '8px'
                          }}>
                            {language === 'ta' ? 'கொடுப்பனவு ஸ்கிரீன்ஷாட்:' : 'Payment Screenshot:'}
                          </div>
                          <a
                            href={payment.payment_proof_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              display: 'block',
                              width: '100%',
                              maxWidth: '300px',
                              margin: '0 auto'
                            }}
                          >
                            <img
                              src={payment.payment_proof_url}
                              alt="Payment proof"
                              style={{
                                width: '100%',
                                height: 'auto',
                                borderRadius: '8px',
                                border: '2px solid #d97706',
                                cursor: 'pointer',
                                maxHeight: '200px',
                                objectFit: 'contain',
                                background: 'white'
                              }}
                            />
                          </a>
                          <div style={{
                            fontSize: '11px',
                            color: '#92400e',
                            textAlign: 'center',
                            marginTop: '4px'
                          }}>
                            {language === 'ta' ? 'முழு அளவு பார்க்க கிளிக் செய்யவும்' : 'Click to view full size'}
                          </div>
                        </div>
                      )}

                      {/* Action Buttons */}
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          onClick={() => handleApprovePendingPayment(payment)}
                          style={{
                            flex: 1,
                            padding: '12px',
                            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                            color: 'white',
                            border: 'none',
                            borderRadius: '8px',
                            fontSize: '14px',
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '6px',
                            boxShadow: '0 2px 8px rgba(16, 185, 129, 0.3)',
                            transition: 'all 0.2s'
                          }}
                          onMouseOver={(e) => {
                            e.currentTarget.style.transform = 'translateY(-2px)';
                            e.currentTarget.style.boxShadow = '0 4px 12px rgba(16, 185, 129, 0.4)';
                          }}
                          onMouseOut={(e) => {
                            e.currentTarget.style.transform = 'translateY(0)';
                            e.currentTarget.style.boxShadow = '0 2px 8px rgba(16, 185, 129, 0.3)';
                          }}
                        >
                          ✓ {language === 'ta' ? 'ஒப்புக்கொள்' : 'Approve'}
                        </button>
                        <button
                          onClick={() => handleRejectPendingPayment(payment)}
                          style={{
                            flex: 1,
                            padding: '12px',
                            background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                            color: 'white',
                            border: 'none',
                            borderRadius: '8px',
                            fontSize: '14px',
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '6px',
                            boxShadow: '0 2px 8px rgba(239, 68, 68, 0.3)',
                            transition: 'all 0.2s'
                          }}
                          onMouseOver={(e) => {
                            e.currentTarget.style.transform = 'translateY(-2px)';
                            e.currentTarget.style.boxShadow = '0 4px 12px rgba(239, 68, 68, 0.4)';
                          }}
                          onMouseOut={(e) => {
                            e.currentTarget.style.transform = 'translateY(0)';
                            e.currentTarget.style.boxShadow = '0 2px 8px rgba(239, 68, 68, 0.3)';
                          }}
                        >
                          ✗ {language === 'ta' ? 'நிராகரி' : 'Reject'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showBackupModal && (
        <BackupData onClose={() => setShowBackupModal(false)} />
      )}

      {showPaymentReminders && (
        <PaymentReminders onClose={() => setShowPaymentReminders(false)} />
      )}

      {showBulkWhatsApp && (
        <BulkWhatsApp onClose={() => setShowBulkWhatsApp(false)} />
      )}

      {showReports && (
        <Reports onClose={() => setShowReports(false)} language={language} />
      )}

      {showGlobalSearch && (
        <GlobalSearch
          onClose={() => setShowGlobalSearch(false)}
          navigateTo={navigateTo}
          isDarkMode={isDarkMode}
        />
      )}

      {/* Quick Pay Confirmation Modal */}
      {quickPayConfirm && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1001,
            padding: '20px'
          }}
          onClick={() => setQuickPayConfirm(null)}
        >
          <div
            style={{
              background: 'white',
              borderRadius: '16px',
              padding: '24px',
              maxWidth: '400px',
              width: '100%',
              boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ textAlign: 'center', marginBottom: '20px' }}>
              <div style={{ fontSize: '48px', marginBottom: '12px' }}>💰</div>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#1e293b' }}>
                Confirm Payment
              </h3>
            </div>

            <div style={{
              background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)',
              borderRadius: '12px',
              padding: '16px',
              marginBottom: '20px'
            }}>
              <div style={{ fontSize: '14px', fontWeight: 700, color: '#065f46', marginBottom: '8px' }}>
                {quickPayConfirm.customer.name}
              </div>
              {quickPayConfirm.loan.loan_name && quickPayConfirm.loan.loan_name !== 'General Loan' && (
                <div style={{ fontSize: '12px', color: '#047857', marginBottom: '4px' }}>
                  {quickPayConfirm.loan.loan_name}
                </div>
              )}
              <div style={{ fontSize: '12px', color: '#059669', marginBottom: '8px' }}>
                Week {quickPayConfirm.weekNumber}/10
              </div>
              <div style={{
                fontSize: '24px',
                fontWeight: 700,
                color: '#059669',
                textAlign: 'center',
                padding: '8px',
                background: 'white',
                borderRadius: '8px'
              }}>
                {formatCurrency(quickPayConfirm.amount)}
              </div>
              <div style={{ fontSize: '11px', color: '#6b7280', textAlign: 'center', marginTop: '8px' }}>
                Payment Date: {new Date(selectedDate).toLocaleDateString('en-IN', {
                  weekday: 'short',
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric'
                })}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={() => setQuickPayConfirm(null)}
                disabled={isPaymentLoading}
                style={{
                  flex: 1,
                  padding: '12px',
                  background: '#f1f5f9',
                  color: '#475569',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: isPaymentLoading ? 'not-allowed' : 'pointer',
                  opacity: isPaymentLoading ? 0.5 : 1
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleQuickPay}
                disabled={isPaymentLoading}
                style={{
                  flex: 1,
                  padding: '12px',
                  background: isPaymentLoading
                    ? '#9ca3af'
                    : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: 700,
                  cursor: isPaymentLoading ? 'not-allowed' : 'pointer',
                  boxShadow: isPaymentLoading ? 'none' : '0 4px 12px rgba(16, 185, 129, 0.3)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px'
                }}
              >
                {isPaymentLoading ? (
                  <>
                    <span style={{
                      width: '16px',
                      height: '16px',
                      border: '2px solid white',
                      borderTopColor: 'transparent',
                      borderRadius: '50%',
                      animation: 'spin 1s linear infinite'
                    }} />
                    Paying...
                  </>
                ) : (
                  '✓ Confirm Paid'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Undo Payment Confirmation Modal */}
      {undoPaymentConfirm && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1001,
            padding: '20px'
          }}
          onClick={() => setUndoPaymentConfirm(null)}
        >
          <div
            style={{
              background: 'white',
              borderRadius: '16px',
              padding: '24px',
              maxWidth: '400px',
              width: '100%',
              boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ textAlign: 'center', marginBottom: '20px' }}>
              <div style={{ fontSize: '48px', marginBottom: '12px' }}>⚠️</div>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#dc2626' }}>
                Undo Payment?
              </h3>
            </div>

            <div style={{
              background: 'linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%)',
              borderRadius: '12px',
              padding: '16px',
              marginBottom: '20px'
            }}>
              <div style={{ fontSize: '14px', fontWeight: 700, color: '#7f1d1d', marginBottom: '8px' }}>
                {undoPaymentConfirm.customer.name}
              </div>
              {undoPaymentConfirm.loan.loan_name && undoPaymentConfirm.loan.loan_name !== 'General Loan' && (
                <div style={{ fontSize: '12px', color: '#991b1b', marginBottom: '4px' }}>
                  {undoPaymentConfirm.loan.loan_name}
                </div>
              )}
              <div style={{ fontSize: '12px', color: '#dc2626', marginBottom: '8px' }}>
                Week {undoPaymentConfirm.weekNumber}/10
              </div>
              <div style={{
                fontSize: '24px',
                fontWeight: 700,
                color: '#dc2626',
                textAlign: 'center',
                padding: '8px',
                background: 'white',
                borderRadius: '8px'
              }}>
                {formatCurrency(undoPaymentConfirm.amount)}
              </div>
              <div style={{ fontSize: '11px', color: '#991b1b', textAlign: 'center', marginTop: '8px' }}>
                This will delete the payment and mark as unpaid
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={() => setUndoPaymentConfirm(null)}
                disabled={isPaymentLoading}
                style={{
                  flex: 1,
                  padding: '12px',
                  background: '#f1f5f9',
                  color: '#475569',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: isPaymentLoading ? 'not-allowed' : 'pointer',
                  opacity: isPaymentLoading ? 0.5 : 1
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleUndoPayment}
                disabled={isPaymentLoading}
                style={{
                  flex: 1,
                  padding: '12px',
                  background: isPaymentLoading
                    ? '#9ca3af'
                    : 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: 700,
                  cursor: isPaymentLoading ? 'not-allowed' : 'pointer',
                  boxShadow: isPaymentLoading ? 'none' : '0 4px 12px rgba(220, 38, 38, 0.3)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px'
                }}
              >
                {isPaymentLoading ? (
                  <>
                    <span style={{
                      width: '16px',
                      height: '16px',
                      border: '2px solid white',
                      borderTopColor: 'transparent',
                      borderRadius: '50%',
                      animation: 'spin 1s linear infinite'
                    }} />
                    Undoing...
                  </>
                ) : (
                  '↩️ Undo Payment'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Monthly Finance Payment Confirmation Modal */}
      {monthlyPaymentConfirm && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1001,
            padding: '20px'
          }}
          onClick={() => setMonthlyPaymentConfirm(null)}
        >
          <div
            style={{
              background: 'white',
              borderRadius: '16px',
              padding: '24px',
              maxWidth: '400px',
              width: '100%',
              boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ textAlign: 'center', marginBottom: '20px' }}>
              <div style={{ fontSize: '48px', marginBottom: '12px' }}>💰</div>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#1e293b' }}>
                Confirm Payment
              </h3>
            </div>

            <div style={{
              background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)',
              borderRadius: '12px',
              padding: '16px',
              marginBottom: '20px'
            }}>
              <div style={{ fontSize: '14px', fontWeight: 700, color: '#065f46', marginBottom: '8px' }}>
                {monthlyPaymentConfirm.customer_name || monthlyPaymentConfirm.name}
              </div>
              <div style={{ fontSize: '12px', color: '#059669', marginBottom: '8px' }}>
                Monthly Finance • Payment Day {monthlyPaymentConfirm.payment_day}
              </div>
              <div style={{
                fontSize: '24px',
                fontWeight: 700,
                color: '#059669',
                textAlign: 'center',
                padding: '8px',
                background: 'white',
                borderRadius: '8px'
              }}>
                {formatCurrency(monthlyPaymentConfirm.monthly_amount)}
              </div>
              <div style={{ fontSize: '11px', color: '#6b7280', textAlign: 'center', marginTop: '8px' }}>
                Payment Date: {new Date().toLocaleDateString('en-IN', {
                  weekday: 'short',
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric'
                })}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={() => setMonthlyPaymentConfirm(null)}
                disabled={isPaymentLoading}
                style={{
                  flex: 1,
                  padding: '12px',
                  background: '#f1f5f9',
                  color: '#475569',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: isPaymentLoading ? 'not-allowed' : 'pointer',
                  opacity: isPaymentLoading ? 0.5 : 1
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  handleMonthlyPayment(monthlyPaymentConfirm);
                  setMonthlyPaymentConfirm(null);
                }}
                disabled={isPaymentLoading}
                style={{
                  flex: 1,
                  padding: '12px',
                  background: isPaymentLoading
                    ? '#9ca3af'
                    : 'linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: 700,
                  cursor: isPaymentLoading ? 'not-allowed' : 'pointer',
                  boxShadow: isPaymentLoading ? 'none' : '0 4px 12px rgba(124, 58, 237, 0.3)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px'
                }}
              >
                {isPaymentLoading ? (
                  <>
                    <span style={{
                      width: '16px',
                      height: '16px',
                      border: '2px solid white',
                      borderTopColor: 'transparent',
                      borderRadius: '50%',
                      animation: 'spin 1s linear infinite'
                    }} />
                    Paying...
                  </>
                ) : (
                  '✓ Confirm Paid'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Monthly Finance Undo Payment Confirmation Modal */}
      {monthlyUndoConfirm && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1001,
            padding: '20px'
          }}
          onClick={() => setMonthlyUndoConfirm(null)}
        >
          <div
            style={{
              background: 'white',
              borderRadius: '16px',
              padding: '24px',
              maxWidth: '400px',
              width: '100%',
              boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ textAlign: 'center', marginBottom: '20px' }}>
              <div style={{ fontSize: '48px', marginBottom: '12px' }}>⚠️</div>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#dc2626' }}>
                Undo Payment?
              </h3>
            </div>

            <div style={{
              background: 'linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%)',
              borderRadius: '12px',
              padding: '16px',
              marginBottom: '20px'
            }}>
              <div style={{ fontSize: '14px', fontWeight: 700, color: '#7f1d1d', marginBottom: '8px' }}>
                {monthlyUndoConfirm.customer_name || monthlyUndoConfirm.name}
              </div>
              <div style={{ fontSize: '12px', color: '#dc2626', marginBottom: '8px' }}>
                Monthly Finance • Payment Day {monthlyUndoConfirm.payment_day}
              </div>
              <div style={{
                fontSize: '24px',
                fontWeight: 700,
                color: '#dc2626',
                textAlign: 'center',
                padding: '8px',
                background: 'white',
                borderRadius: '8px'
              }}>
                {formatCurrency(monthlyUndoConfirm.monthly_amount)}
              </div>
              <div style={{ fontSize: '11px', color: '#991b1b', textAlign: 'center', marginTop: '8px' }}>
                This will delete the most recent payment and mark as unpaid
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={() => setMonthlyUndoConfirm(null)}
                disabled={isPaymentLoading}
                style={{
                  flex: 1,
                  padding: '12px',
                  background: '#f1f5f9',
                  color: '#475569',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: isPaymentLoading ? 'not-allowed' : 'pointer',
                  opacity: isPaymentLoading ? 0.5 : 1
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  handleMonthlyUndo(monthlyUndoConfirm);
                  setMonthlyUndoConfirm(null);
                }}
                disabled={isPaymentLoading}
                style={{
                  flex: 1,
                  padding: '12px',
                  background: isPaymentLoading
                    ? '#9ca3af'
                    : 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: 700,
                  cursor: isPaymentLoading ? 'not-allowed' : 'pointer',
                  boxShadow: isPaymentLoading ? 'none' : '0 4px 12px rgba(220, 38, 38, 0.3)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px'
                }}
              >
                {isPaymentLoading ? (
                  <>
                    <span style={{
                      width: '16px',
                      height: '16px',
                      border: '2px solid white',
                      borderTopColor: 'transparent',
                      borderRadius: '50%',
                      animation: 'spin 1s linear infinite'
                    }} />
                    Undoing...
                  </>
                ) : (
                  '↩️ Undo Payment'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Loans Given Modal */}
      {showLoansGivenModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1001,
            padding: '20px'
          }}
          onClick={() => setShowLoansGivenModal(false)}
        >
          <div
            style={{
              background: 'white',
              borderRadius: '16px',
              padding: '0',
              maxWidth: '450px',
              width: '100%',
              maxHeight: '80vh',
              overflow: 'hidden',
              boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div style={{
              background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
              padding: '16px 20px',
              color: 'white',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div style={{ fontSize: '16px', fontWeight: 700 }}>💸 Loans Given</div>
              <button
                onClick={() => setShowLoansGivenModal(false)}
                style={{
                  background: 'rgba(255,255,255,0.2)',
                  border: 'none',
                  color: 'white',
                  width: '28px',
                  height: '28px',
                  borderRadius: '50%',
                  cursor: 'pointer',
                  fontSize: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >×</button>
            </div>

            {/* Date Picker */}
            <div style={{ padding: '16px 20px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
              <input
                type="date"
                value={loansGivenDate}
                onChange={(e) => setLoansGivenDate(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: '8px',
                  border: '2px solid #10b981',
                  fontSize: '14px',
                  fontWeight: 600
                }}
              />
            </div>

            {/* Summary */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '12px 20px',
              background: '#ecfdf5',
              borderBottom: '1px solid #d1fae5'
            }}>
              <div>
                <div style={{ fontSize: '11px', color: '#065f46' }}>Total Given</div>
                <div style={{ fontSize: '20px', fontWeight: 700, color: '#047857' }}>{formatCurrency(loansGivenData.total || 0)}</div>
              </div>
              <div style={{ textAlign: 'center', display: 'flex', gap: '8px' }}>
                {loansGivenData.loans && loansGivenData.loans.length > 0 && (
                  <>
                    <button
                      onClick={() => {
                        // Download PDF
                        const doc = new jsPDF({
                          orientation: 'portrait',
                          unit: 'mm',
                          format: 'a4'
                        });

                        const margin = 15;
                        const pageWidth = 210;

                        // Title
                        doc.setFontSize(16);
                        doc.setFont('helvetica', 'bold');
                        doc.text('OM SAI MURUGAN FINANCE', pageWidth / 2, margin + 5, { align: 'center' });

                        // Subtitle
                        doc.setFontSize(10);
                        doc.setFont('helvetica', 'normal');
                        doc.text(`Loans Given on ${new Date(loansGivenDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`, pageWidth / 2, margin + 12, { align: 'center' });

                        // Table header
                        let y = margin + 20;
                        doc.setFillColor(30, 41, 59);
                        doc.rect(margin, y, pageWidth - (margin * 2), 8, 'F');
                        doc.setTextColor(255, 255, 255);
                        doc.setFontSize(9);
                        doc.setFont('helvetica', 'bold');
                        doc.text('#', margin + 8, y + 5.5);
                        doc.text('Customer', margin + 20, y + 5.5);
                        doc.text('Type', margin + 95, y + 5.5);
                        doc.text('Amount', margin + 160, y + 5.5, { align: 'right' });

                        y += 8;
                        doc.setTextColor(0, 0, 0);
                        doc.setFont('helvetica', 'normal');
                        doc.setFontSize(8);

                        // Table rows
                        loansGivenData.loans.forEach((loan, idx) => {
                          if (y > 270) {
                            doc.addPage();
                            y = margin;
                          }

                          if (idx % 2 === 0) {
                            doc.setFillColor(248, 250, 252);
                            doc.rect(margin, y, pageWidth - (margin * 2), 7, 'F');
                          }

                          doc.text(String(idx + 1), margin + 8, y + 5);
                          doc.text((loan.customer_name || '').substring(0, 35), margin + 20, y + 5);
                          doc.text(loan.loan_type || '', margin + 95, y + 5);
                          doc.text(`Rs.${(loan.loan_amount || 0).toLocaleString('en-IN')}`, margin + 160, y + 5, { align: 'right' });

                          y += 7;
                        });

                        // Total
                        y += 5;
                        doc.setFillColor(236, 253, 245);
                        doc.rect(margin, y, pageWidth - (margin * 2), 10, 'F');
                        doc.setFontSize(10);
                        doc.setFont('helvetica', 'bold');
                        doc.text(`Total: Rs.${(loansGivenData.total || 0).toLocaleString('en-IN')} | Count: ${loansGivenData.count || 0}`, pageWidth / 2, y + 7, { align: 'center' });

                        // Footer
                        y += 15;
                        doc.setFontSize(8);
                        doc.setFont('helvetica', 'normal');
                        doc.setTextColor(100, 100, 100);
                        doc.text('Ph: 8667510724', pageWidth / 2, y, { align: 'center' });

                        // Download
                        doc.save(`LoansGiven_${loansGivenDate}.pdf`);
                      }}
                      style={{
                        padding: '8px 12px',
                        background: 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        fontSize: '11px',
                        fontWeight: 600,
                        cursor: 'pointer'
                      }}
                    >
                      📥 PDF
                    </button>
                    <button
                      onClick={() => {
                        // Print all loans summary
                        const printWindow = window.open('', '_blank');
                        const loansHtml = loansGivenData.loans.map((loan, idx) => `
                          <tr>
                            <td style="padding: 8px; border-bottom: 1px solid #ddd;">${idx + 1}</td>
                            <td style="padding: 8px; border-bottom: 1px solid #ddd;">${loan.customer_name}</td>
                            <td style="padding: 8px; border-bottom: 1px solid #ddd;">${loan.loan_type}</td>
                            <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: right;">₹${(loan.loan_amount || 0).toLocaleString('en-IN')}</td>
                          </tr>
                        `).join('');

                        printWindow.document.write(`
                          <!DOCTYPE html>
                          <html>
                          <head>
                            <title>Loans Given - ${loansGivenDate}</title>
                            <style>
                              body { font-family: Arial, sans-serif; padding: 20px; max-width: 400px; margin: 0 auto; }
                              h2 { text-align: center; margin-bottom: 5px; }
                              h3 { text-align: center; color: #666; margin-top: 0; font-weight: normal; }
                              table { width: 100%; border-collapse: collapse; margin: 15px 0; }
                              th { background: #1e293b; color: white; padding: 10px 8px; text-align: left; }
                              th:last-child { text-align: right; }
                              .total { font-size: 18px; font-weight: bold; text-align: center; margin: 20px 0; padding: 15px; background: #ecfdf5; border-radius: 8px; }
                              .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #666; }
                            </style>
                          </head>
                          <body>
                            <h2>OM SAI MURUGAN FINANCE</h2>
                            <h3>Loans Given on ${new Date(loansGivenDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</h3>
                            <table>
                              <thead>
                                <tr>
                                  <th>#</th>
                                  <th>Customer</th>
                                  <th>Type</th>
                                  <th>Amount</th>
                                </tr>
                              </thead>
                              <tbody>
                                ${loansHtml}
                              </tbody>
                            </table>
                            <div class="total">
                              Total: ₹${(loansGivenData.total || 0).toLocaleString('en-IN')} | Count: ${loansGivenData.count || 0}
                            </div>
                            <div class="footer">
                              📞 8667510724
                            </div>
                            <script>window.onload = function() { window.print(); window.onafterprint = function() { window.close(); } }</script>
                          </body>
                          </html>
                        `);
                        printWindow.document.close();
                      }}
                      style={{
                        padding: '8px 12px',
                        background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        fontSize: '11px',
                        fontWeight: 600,
                        cursor: 'pointer'
                      }}
                    >
                      🖨️ Print
                    </button>
                    <button
                      onClick={() => printLoansGivenThermal(loansGivenData.loans, new Date(loansGivenDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }))}
                      style={{
                        padding: '8px 12px',
                        background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        fontSize: '11px',
                        fontWeight: 600,
                        cursor: 'pointer'
                      }}
                    >
                      📱 Thermal
                    </button>
                  </>
                )}
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '11px', color: '#065f46' }}>Loans</div>
                <div style={{ fontSize: '20px', fontWeight: 700, color: '#047857' }}>{loansGivenData.count || 0}</div>
              </div>
            </div>

            {/* Loans List */}
            <div style={{ maxHeight: '300px', overflowY: 'auto', padding: '10px 20px' }}>
              {loansGivenData.loans && loansGivenData.loans.length > 0 ? (
                loansGivenData.loans.map((loan, index) => (
                  <div
                    key={loan.id || index}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '12px',
                      background: '#f8fafc',
                      borderRadius: '8px',
                      marginBottom: '8px',
                      transition: 'background 0.15s'
                    }}
                  >
                    <div
                      onClick={() => {
                        setShowLoansGivenModal(false);
                        if (loan.loan_type !== 'Vaddi') {
                          navigateTo('loan-details', loan.id);
                        }
                      }}
                      style={{ flex: 1, cursor: loan.loan_type !== 'Vaddi' ? 'pointer' : 'default' }}
                    >
                      <div style={{ fontSize: '13px', fontWeight: 600, color: '#1e293b' }}>{loan.customer_name}</div>
                      <div style={{ fontSize: '11px', color: '#64748b' }}>
                        {loan.loan_type} {loan.loan_name ? `• ${loan.loan_name}` : ''}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', marginRight: '10px' }}>
                      <div style={{ fontSize: '14px', fontWeight: 700, color: '#059669' }}>{formatCurrency(loan.loan_amount)}</div>
                      <div style={{ fontSize: '10px', color: '#64748b' }}>
                        {loan.loan_type === 'Weekly' ? `₹${loan.weekly_amount}/wk` :
                         loan.loan_type === 'Monthly' ? `₹${loan.monthly_amount}/mo` :
                         loan.loan_type === 'Monthly Finance' ? `₹${loan.monthly_amount}/mo` :
                         loan.loan_type === 'Daily' ? `₹${loan.daily_amount}/day` :
                         loan.loan_type === 'Vaddi' ? 'Interest Loan' : ''}
                      </div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setPrintData({
                          type: 'loan_given',
                          data: {
                            date: loan.loan_given_date,
                            loanId: loan.id,
                            customerName: loan.customer_name,
                            phone: loan.customer_phone,
                            loanType: loan.loan_type,
                            loanAmount: loan.loan_amount,
                            weeklyAmount: loan.weekly_amount,
                            monthlyAmount: loan.monthly_amount,
                            dailyAmount: loan.daily_amount,
                            askedAmount: loan.asked_amount
                          }
                        });
                      }}
                      style={{
                        padding: '8px 14px',
                        background: 'linear-gradient(135deg, #7c3aed 0%, #5b21b6 100%)',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        fontSize: '12px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      🖨️ Print
                    </button>
                  </div>
                ))
              ) : (
                <div style={{ textAlign: 'center', padding: '30px', color: '#64748b' }}>
                  <div style={{ fontSize: '40px', marginBottom: '10px' }}>📭</div>
                  <div style={{ fontSize: '13px' }}>No loans given on this date</div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Print Receipt Modal */}
      {printData && (
        <PrintReceipt
          type={printData.type}
          data={printData.data}
          onClose={() => setPrintData(null)}
        />
      )}

      {/* All Payments Due Modal */}
      {showAllPaymentsDue && (
        <AllPaymentsDueModal
          onClose={() => setShowAllPaymentsDue(false)}
          navigateTo={navigateTo}
        />
      )}
    </div>
  );
}

// Quick Reference Modal Component
function QuickReferenceModal({ customers, onClose, formatCurrency }) {
  // Get all customers with active loans
  const customersWithLoans = customers
    .filter(customer => customer.loans && customer.loans.length > 0)
    .flatMap(customer =>
      customer.loans
        .filter(loan => loan.status === 'active' && loan.balance > 0)
        .map(loan => ({
          name: customer.name,
          friendName: loan.loan_name || 'General Loan',
          amountGot: loan.loan_amount,
          balance: loan.balance
        }))
    )
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '20px'
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'white',
          borderRadius: '12px',
          maxWidth: '900px',
          width: '100%',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '20px',
            borderBottom: '2px solid #e5e7eb',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}
        >
          <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 700, color: '#1e293b' }}>
            📋 Quick Reference - All Active Loans
          </h2>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '28px',
              cursor: 'pointer',
              color: '#6b7280',
              padding: 0,
              lineHeight: 1
            }}
          >
            ×
          </button>
        </div>

        {/* Table Container */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
          {customersWithLoans.length === 0 ? (
            <div
              style={{
                textAlign: 'center',
                padding: '60px 20px',
                color: '#6b7280'
              }}
            >
              <div style={{ fontSize: '64px', marginBottom: '16px' }}>📭</div>
              <div style={{ fontSize: '18px', fontWeight: 600 }}>No Active Loans</div>
              <div style={{ fontSize: '14px', marginTop: '8px' }}>
                All loans are either closed or paid off
              </div>
            </div>
          ) : (
            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                fontSize: '14px'
              }}
            >
              <thead>
                <tr style={{ background: 'linear-gradient(135deg, #1e3a8a 0%, #1e293b 100%)', color: 'white' }}>
                  <th
                    style={{
                      padding: '12px',
                      textAlign: 'left',
                      fontWeight: 700,
                      fontSize: '13px',
                      borderTopLeftRadius: '8px'
                    }}
                  >
                    Name
                  </th>
                  <th
                    style={{
                      padding: '12px',
                      textAlign: 'left',
                      fontWeight: 700,
                      fontSize: '13px'
                    }}
                  >
                    Friend Name
                  </th>
                  <th
                    style={{
                      padding: '12px',
                      textAlign: 'right',
                      fontWeight: 700,
                      fontSize: '13px'
                    }}
                  >
                    Amount Got
                  </th>
                  <th
                    style={{
                      padding: '12px',
                      textAlign: 'right',
                      fontWeight: 700,
                      fontSize: '13px',
                      borderTopRightRadius: '8px'
                    }}
                  >
                    Balance
                  </th>
                </tr>
              </thead>
              <tbody>
                {customersWithLoans.map((row, index) => (
                  <tr
                    key={index}
                    style={{
                      background: index % 2 === 0 ? '#f9fafb' : 'white',
                      borderBottom: '1px solid #e5e7eb'
                    }}
                  >
                    <td style={{ padding: '12px', fontWeight: 600, color: '#1e293b' }}>
                      {row.name}
                    </td>
                    <td style={{ padding: '12px', color: '#6b7280' }}>
                      {row.friendName}
                    </td>
                    <td
                      style={{
                        padding: '12px',
                        textAlign: 'right',
                        fontWeight: 600,
                        color: '#059669'
                      }}
                    >
                      {formatCurrency(row.amountGot)}
                    </td>
                    <td
                      style={{
                        padding: '12px',
                        textAlign: 'right',
                        fontWeight: 700,
                        color: row.balance > 5000 ? '#dc2626' : '#f59e0b'
                      }}
                    >
                      {formatCurrency(row.balance)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ background: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)' }}>
                  <td
                    colSpan="2"
                    style={{
                      padding: '12px',
                      fontWeight: 700,
                      color: '#1e293b',
                      fontSize: '15px',
                      borderBottomLeftRadius: '8px'
                    }}
                  >
                    Total ({customersWithLoans.length} loans)
                  </td>
                  <td
                    style={{
                      padding: '12px',
                      textAlign: 'right',
                      fontWeight: 700,
                      color: '#059669',
                      fontSize: '15px'
                    }}
                  >
                    {formatCurrency(customersWithLoans.reduce((sum, row) => sum + row.amountGot, 0))}
                  </td>
                  <td
                    style={{
                      padding: '12px',
                      textAlign: 'right',
                      fontWeight: 700,
                      color: '#dc2626',
                      fontSize: '15px',
                      borderBottomRightRadius: '8px'
                    }}
                  >
                    {formatCurrency(customersWithLoans.reduce((sum, row) => sum + row.balance, 0))}
                  </td>
                </tr>
              </tfoot>
            </table>
          )}
        </div>

      </div>

    </div>
  );
}

export default Dashboard;
