import { useState, useEffect } from 'react';
import useSWR from 'swr';
import { jsPDF } from 'jspdf';
import { API_URL } from '../config';
import PrintReceipt from './PrintReceipt';

const fetcher = (url) => fetch(url).then(res => res.json());

const VaddiList = ({ navigateTo }) => {
  const [activeTab, setActiveTab] = useState('monthly'); // 'monthly' or 'grid'
  const [selectedDay, setSelectedDay] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    amount: '',
    phone: '',
    loan_date: new Date().toISOString().split('T')[0],
    principal_amount: '',
    aadhar_number: '',
    interest_rate: '',
    collateral_type: ''
  });
  const [loading, setLoading] = useState(false);
  const [editingEntry, setEditingEntry] = useState(null);
  const [showAcknowledgmentModal, setShowAcknowledgmentModal] = useState(false);
  const [selectedEntryForAck, setSelectedEntryForAck] = useState(null);

  // Monthly View state
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState(null);
  const [paymentData, setPaymentData] = useState({ paymentType: 'interest', interestAmount: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [printReceiptData, setPrintReceiptData] = useState(null); // For thermal print
  const [showSendChoice, setShowSendChoice] = useState(false); // Show WhatsApp/Print choice modal
  const [pendingPaymentData, setPendingPaymentData] = useState(null); // Store payment data for choice modal

  // Fetch entries with SWR
  const { data: entries = [], error, isLoading, mutate } = useSWR(`${API_URL}/vaddi-entries`, fetcher, {
    refreshInterval: 30000,
    revalidateOnFocus: true
  });

  // Fetch payments for selected month
  const { data: monthPayments = [], mutate: mutatePayments } = useSWR(
    `${API_URL}/vaddi-payments?month=${selectedMonth}`,
    fetcher,
    { refreshInterval: 30000, revalidateOnFocus: true }
  );

  // Fetch monthly summary
  const { data: summary = {}, mutate: mutateSummary } = useSWR(
    `${API_URL}/vaddi-summary?month=${selectedMonth}`,
    fetcher,
    { refreshInterval: 30000, revalidateOnFocus: true }
  );

  // Fetch all months' history for history tab
  const { data: allMonthsSummary = [] } = useSWR(
    `${API_URL}/vaddi-history`,
    fetcher,
    { refreshInterval: 30000, revalidateOnFocus: true }
  );

  // Safe entries
  const safeEntries = Array.isArray(entries) ? entries.filter(e => e && e.id) : [];

  // Active entries (not settled)
  const activeEntries = safeEntries.filter(e => e.status !== 'settled');

  // Settled entries
  const settledEntries = safeEntries.filter(e => e.status === 'settled');

  // Get paid entry IDs for this month
  const paidEntryIds = new Set(monthPayments.map(p => p.entryId));

  // Separate into paid and unpaid for the month
  // Only show loans given BEFORE selected month in unpaid (interest starts from next month)
  const paidThisMonth = activeEntries.filter(e => paidEntryIds.has(e.id));
  const unpaidThisMonth = activeEntries.filter(e => {
    if (paidEntryIds.has(e.id)) return false;
    // If loan was given in the selected month, don't show in unpaid (interest starts next month)
    const loanMonth = e.loan_date ? e.loan_date.slice(0, 7) : e.createdAt?.slice(0, 7);
    return loanMonth < selectedMonth; // Only show if loan was given before selected month
  });

  // Loans given this month (new loans, not due yet)
  const newLoansThisMonth = activeEntries.filter(e => {
    if (paidEntryIds.has(e.id)) return false;
    const loanMonth = e.loan_date ? e.loan_date.slice(0, 7) : e.createdAt?.slice(0, 7);
    return loanMonth >= selectedMonth;
  });

  // Group entries by day - ONLY active entries (hide settled completely from grid)
  const entriesByDay = {};
  for (let day = 1; day <= 31; day++) {
    entriesByDay[day] = activeEntries.filter(e => e.day === day);
  }

  // Calculate total amount for a day
  const getDayTotal = (day) => {
    return entriesByDay[day].reduce((sum, e) => sum + (e.amount || 0), 0);
  };

  // Get customer count for a day
  const getDayCount = (day) => {
    return entriesByDay[day].filter(e => e.status !== 'settled').length;
  };

  // Calculate grand total
  const calculateGrandTotal = () => {
    return activeEntries.reduce((sum, e) => sum + (e.amount || 0), 0);
  };

  // Generate month options (Nov 2025 onwards, 12 months)
  const getMonthOptions = () => {
    const months = [];
    const startYear = 2025;
    const startMonth = 10; // November (0-indexed)

    for (let i = 0; i < 12; i++) {
      const monthIndex = (startMonth + i) % 12;
      const year = startYear + Math.floor((startMonth + i) / 12);
      const monthStr = `${year}-${String(monthIndex + 1).padStart(2, '0')}`;
      const monthName = new Date(year, monthIndex).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      months.push({ value: monthStr, label: monthName });
    }
    return months;
  };

  // Open modal for a day
  const handleDayClick = (day) => {
    setSelectedDay(day);
    setShowModal(true);
    setFormData({
      name: '',
      amount: '',
      phone: '',
      loan_date: new Date().toISOString().split('T')[0],
      principal_amount: '',
      aadhar_number: ''
    });
  };

  // Close modal
  const closeModal = () => {
    setShowModal(false);
    setSelectedDay(null);
    setFormData({
      name: '',
      amount: '',
      phone: '',
      loan_date: new Date().toISOString().split('T')[0],
      principal_amount: '',
      aadhar_number: ''
    });
  };

  // Open payment modal
  const openPaymentModal = (entry) => {
    setSelectedEntry(entry);
    // Calculate monthly interest: principal * rate / 100
    const monthlyInterest = Math.round((entry.principal_amount || entry.amount) * (entry.interest_rate || 0) / 100);
    setPaymentData({
      paymentType: 'interest',
      interestAmount: monthlyInterest.toString()
    });
    setShowPaymentModal(true);
  };

  // Close payment modal
  const closePaymentModal = () => {
    setShowPaymentModal(false);
    setSelectedEntry(null);
    setPaymentData({ paymentType: 'interest', interestAmount: '' });
  };

  // Undo/delete a payment
  const handleUndoPayment = async (paymentId, customerName) => {
    if (!window.confirm(`Undo payment for ${customerName}? This will move them back to Unpaid.`)) {
      return;
    }

    try {
      const response = await fetch(`${API_URL}/vaddi-payments/${paymentId}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        throw new Error('Failed to undo payment');
      }

      mutatePayments();
      mutateSummary();
      alert('Payment undone successfully');
    } catch (error) {
      console.error('Error undoing payment:', error);
      alert('Failed to undo payment: ' + error.message);
    }
  };

  // Handle payment submission
  const handlePaymentSubmit = async (e) => {
    e.preventDefault();

    if (isSubmitting) return;

    setIsSubmitting(true);

    try {
      if (paymentData.paymentType === 'settled') {
        // Settle the loan - customer paid full principal
        const response = await fetch(`${API_URL}/vaddi-entries/${selectedEntry.id}/settle`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' }
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'Failed to settle loan');
        }

        mutate(); // Refresh entries list
        mutatePayments();
        mutateSummary();

        // Store payment data for receipt
        setPendingPaymentData({
          customerName: selectedEntry.name,
          phone: selectedEntry.phone,
          loanType: 'Vaddi - SETTLED',
          amountPaid: selectedEntry.principal_amount || selectedEntry.amount,
          loanAmount: selectedEntry.principal_amount || selectedEntry.amount,
          balance: 0,
          interestMonth: 'Principal Returned',
          date: new Date().toISOString()
        });
        setShowSendChoice(true);

        closePaymentModal();
        alert('Loan marked as SETTLED! Principal returned.');
      } else {
        // Record interest payment
        const interestAmount = parseInt(paymentData.interestAmount) || 0;

        if (interestAmount <= 0) {
          alert('Please enter interest amount');
          setIsSubmitting(false);
          return;
        }

        const response = await fetch(`${API_URL}/vaddi-entries/${selectedEntry.id}/monthly-payment`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            month: selectedMonth,
            totalAmount: interestAmount,
            myShare: interestAmount,
            friendShare: 0
          })
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'Failed to record payment');
        }

        mutatePayments();
        mutateSummary();

        // Store payment data and show choice modal
        const monthName = getMonthOptions().find(m => m.value === selectedMonth)?.label || selectedMonth;
        setPendingPaymentData({
          customerName: selectedEntry.name,
          phone: selectedEntry.phone,
          loanType: 'Vaddi Interest',
          amountPaid: interestAmount,
          loanAmount: selectedEntry.principal_amount || selectedEntry.amount,
          balance: selectedEntry.principal_amount || selectedEntry.amount,
          interestMonth: monthName,
          date: new Date().toISOString()
        });
        setShowSendChoice(true);

        closePaymentModal();
      }
    } catch (error) {
      console.error('Error recording payment:', error);
      alert(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Select contact from phone
  const selectFromContacts = async () => {
    if (!('contacts' in navigator)) {
      alert('Contact picker not supported. Please use Chrome on Android for best experience.');
      return;
    }

    try {
      const props = ['name', 'tel'];
      const opts = { multiple: false };

      const contacts = await navigator.contacts.select(props, opts);

      if (contacts && contacts.length > 0) {
        const contact = contacts[0];

        let phone = '';
        if (contact.tel && contact.tel.length > 0) {
          phone = contact.tel[0].replace(/\D/g, '');
          if (phone.length > 10) {
            phone = phone.slice(-10);
          }
        }

        setFormData(prev => ({
          ...prev,
          name: contact.name && contact.name[0] ? contact.name[0] : prev.name,
          phone: phone
        }));
      }
    } catch (error) {
      if (error.name !== 'AbortError') {
        console.error('Error selecting contact:', error);
        alert('Failed to select contact: ' + error.message);
      }
    }
  };

  // Add or edit entry
  const handleSubmit = async (e) => {
    e.preventDefault();

    // Prevent double submission
    if (loading) return;

    if (!formData.name || !formData.amount || !formData.phone) {
      alert('Please fill Name, Interest Amount and Phone');
      return;
    }

    if (formData.phone.length !== 10) {
      alert('Phone number must be 10 digits');
      return;
    }

    setLoading(true);

    try {
      const payload = {
        name: formData.name,
        amount: parseInt(formData.amount),
        phone: formData.phone,
        loan_date: formData.loan_date,
        principal_amount: formData.principal_amount ? parseInt(formData.principal_amount) : null,
        aadhar_number: formData.aadhar_number,
        interest_rate: formData.interest_rate ? parseFloat(formData.interest_rate) : null,
        collateral_type: formData.collateral_type
      };

      let response;
      if (editingEntry) {
        // Update existing entry
        response = await fetch(`${API_URL}/vaddi-entries/${editingEntry.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      } else {
        // Add new entry
        payload.day = selectedDay;
        response = await fetch(`${API_URL}/vaddi-entries`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      }

      if (!response.ok) {
        throw new Error(editingEntry ? 'Failed to update entry' : 'Failed to add entry');
      }

      mutate();
      setFormData({
        name: '',
        amount: '',
        phone: '',
        loan_date: new Date().toISOString().split('T')[0],
        principal_amount: '',
        aadhar_number: '',
        interest_rate: '',
        collateral_type: ''
      });
      setEditingEntry(null);
      alert(editingEntry ? 'Entry updated successfully!' : 'Entry added successfully!');
    } catch (error) {
      console.error('Error saving entry:', error);
      alert('Failed to save entry: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Handle edit button click
  const handleEditEntry = (entry) => {
    setEditingEntry(entry);
    setFormData({
      name: entry.name || '',
      amount: entry.amount?.toString() || '',
      phone: entry.phone || '',
      loan_date: entry.loan_date || new Date().toISOString().split('T')[0],
      principal_amount: entry.principal_amount?.toString() || '',
      aadhar_number: entry.aadhar_number || '',
      interest_rate: entry.interest_rate?.toString() || '',
      collateral_type: entry.collateral_type || ''
    });
    setSelectedDay(entry.day);
    setShowModal(true);
  };

  // Cancel edit
  const handleCancelEdit = () => {
    setEditingEntry(null);
    setFormData({
      name: '',
      amount: '',
      phone: '',
      loan_date: new Date().toISOString().split('T')[0],
      principal_amount: '',
      aadhar_number: '',
      interest_rate: '',
      collateral_type: ''
    });
  };

  // Generate Acknowledgment PDF (Tamil)
  const generateAcknowledgmentPDF = (entry, shouldPrint = false) => {
    const doc = new jsPDF();
    const loanDate = entry.loan_date || new Date().toISOString().split('T')[0];
    const formattedDate = new Date(loanDate).toLocaleDateString('ta-IN', {
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    });

    // Header
    doc.setFillColor(30, 58, 138);
    doc.rect(0, 0, 210, 40, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('LOAN ACKNOWLEDGMENT', 105, 15, { align: 'center' });
    doc.setFontSize(14);
    doc.text('OM SAI MURUGAN FINANCE', 105, 28, { align: 'center' });
    doc.setFontSize(10);
    doc.text('Kadan Opputhal Pathiram', 105, 36, { align: 'center' });

    // Body
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');

    let yPos = 55;

    // Date
    doc.text(`Date / Theti: ${formattedDate}`, 20, yPos);
    yPos += 15;

    // Main content (Tamil transliteration + English)
    doc.setFontSize(10);
    const mainText = `Naan, ${entry.name}, Santhosh Kumar (OM SAI MURUGAN FINANCE) avarkalitam irunthu kadan petrathai oppukolkiren.`;
    const mainTextEn = `I, ${entry.name}, hereby acknowledge receiving a loan from Santhosh Kumar (OM SAI MURUGAN FINANCE).`;
    const splitMain = doc.splitTextToSize(mainText, 170);
    const splitMainEn = doc.splitTextToSize(mainTextEn, 170);
    doc.text(splitMain, 20, yPos);
    yPos += splitMain.length * 6;
    doc.setTextColor(100, 100, 100);
    doc.setFontSize(9);
    doc.text(splitMainEn, 20, yPos);
    doc.setTextColor(0, 0, 0);
    yPos += splitMainEn.length * 5 + 10;

    // Loan Details Box
    doc.setFillColor(240, 240, 250);
    doc.rect(15, yPos - 5, 180, 45, 'F');
    doc.setDrawColor(102, 126, 234);
    doc.rect(15, yPos - 5, 180, 45, 'S');

    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('KADAN VIVARANGAL / LOAN DETAILS', 20, yPos + 5);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);

    if (entry.principal_amount) {
      doc.text(`Asal Thogai / Principal Amount: Rs ${formatForThermal(entry.principal_amount)}/-`, 25, yPos + 18);
    }
    if (entry.amount) {
      doc.text(`Vatti Thogai / Monthly Interest: Rs ${formatForThermal(entry.amount)}/-`, 25, yPos + 25);
      yPos += 7;
    }
    if (entry.interest_rate) {
      doc.text(`Vatti Viruppu / Interest Rate: ${entry.interest_rate}% per month`, 25, yPos + 25);
      yPos += 7;
    }
    if (entry.collateral_type) {
      doc.text(`Othaikkapatta Porulgal / Collateral: ${entry.collateral_type}`, 25, yPos + 25);
      yPos += 7;
    }
    doc.text(`Vatti Seluthum Theti / Interest Due Day: ${entry.day} (Every Month)`, 25, yPos + 25);
    yPos += 55;

    // Terms
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('NIBANTHANAIKAL / TERMS:', 20, yPos);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    yPos += 10;

    const terms = [
      '1. Ovvoru mathamum kurippitta thetiyil vatti seluthven / I will pay interest on the due date every month.',
      '2. Vatti seluthath thavarinaal satta nadavadikaik edukkapadum / Legal action will be taken for non-payment.',
      '3. Asal thogaiyai paraspara oppanthathin padi thirumbi seluthuven / I will repay principal as per agreement.',
      '4. Intha opputhal pathiram en kadan kadamaikku saanraaga amaiyum / This acknowledgment is proof of my obligation.'
    ];

    terms.forEach(term => {
      const splitTerm = doc.splitTextToSize(term, 170);
      doc.text(splitTerm, 25, yPos);
      yPos += splitTerm.length * 5 + 3;
    });

    yPos += 8;

    // Borrower Details
    doc.setFillColor(255, 250, 240);
    doc.rect(15, yPos, 180, 35, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('KADAN VAANGIYAVAR VIVARAM / BORROWER DETAILS:', 20, yPos + 8);
    doc.setFont('helvetica', 'normal');
    doc.text(`Peyar / Name: ${entry.name}`, 25, yPos + 18);
    doc.text(`Tholaipesi / Phone: ${entry.phone}`, 25, yPos + 28);
    if (entry.aadhar_number) {
      doc.text(`Aadhar: ${entry.aadhar_number}`, 120, yPos + 18);
    }
    yPos += 45;

    // Signature Section
    doc.line(20, yPos + 20, 80, yPos + 20);
    doc.line(130, yPos + 20, 190, yPos + 20);
    doc.setFontSize(9);
    doc.text('Kadan Vaangiyavar Kaiyoppam', 22, yPos + 28);
    doc.text('Borrower Signature', 30, yPos + 34);
    doc.text('Kadan Koduppavar Kaiyoppam', 132, yPos + 28);
    doc.text('Lender Signature', 145, yPos + 34);

    yPos += 42;

    // Aadhar note
    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);
    doc.text('* Ungal Aadhar ennai kaiyoppathirkku keele ezhuthavum', 20, yPos);
    doc.text('  (Please write your Aadhar number below your signature)', 20, yPos + 5);

    // Footer
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(`Generated on ${new Date().toLocaleDateString('en-IN')} | Ithu sattapoorvamana aavanam / This is a legal document`, 105, 285, { align: 'center' });

    if (shouldPrint) {
      // Open in new window for printing
      const pdfBlob = doc.output('blob');
      const pdfUrl = URL.createObjectURL(pdfBlob);
      const printWindow = window.open(pdfUrl, '_blank');
      if (printWindow) {
        printWindow.onload = () => {
          printWindow.print();
        };
      }
    } else {
      // Save as PDF
      doc.save(`Acknowledgment_${entry.name.replace(/\s+/g, '_')}_${loanDate}.pdf`);
    }
  };

  // Upload signed acknowledgment
  const handleUploadAcknowledgment = async (file) => {
    if (!file || !selectedEntryForAck) return;

    const reader = new FileReader();
    reader.onloadend = async () => {
      // Compress image
      const img = new Image();
      img.onload = async () => {
        const canvas = document.createElement('canvas');
        const maxSize = 800;
        let width = img.width;
        let height = img.height;
        if (width > height && width > maxSize) {
          height = (height * maxSize) / width;
          width = maxSize;
        } else if (height > maxSize) {
          width = (width * maxSize) / height;
          height = maxSize;
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        const compressedData = canvas.toDataURL('image/jpeg', 0.7);

        try {
          const response = await fetch(`${API_URL}/vaddi-entries/${selectedEntryForAck.id}/acknowledgment`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ signed_acknowledgment: compressedData })
          });

          if (response.ok) {
            mutate();
            setShowAcknowledgmentModal(false);
            setSelectedEntryForAck(null);
            alert('Signed acknowledgment uploaded successfully!');
          } else {
            throw new Error('Failed to upload');
          }
        } catch (error) {
          console.error('Error uploading acknowledgment:', error);
          alert('Failed to upload acknowledgment');
        }
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  };

  // Mark as fully settled (gray out)
  const handleSettle = async (id) => {
    if (!window.confirm('Mark as Fully Settled? Customer will be grayed out and won\'t appear in monthly collections.')) {
      return;
    }

    try {
      const response = await fetch(`${API_URL}/vaddi-entries/${id}/settle`, {
        method: 'PUT'
      });

      if (!response.ok) {
        throw new Error('Failed to settle entry');
      }

      mutate();
      alert('Customer marked as settled');
    } catch (error) {
      console.error('Error settling entry:', error);
      alert('Failed to settle entry: ' + error.message);
    }
  };

  // Reactivate settled entry
  const handleReactivate = async (id) => {
    if (!window.confirm('Reactivate this customer?')) {
      return;
    }

    try {
      const response = await fetch(`${API_URL}/vaddi-entries/${id}/reactivate`, {
        method: 'PUT'
      });

      if (!response.ok) {
        throw new Error('Failed to reactivate entry');
      }

      mutate();
      alert('Customer reactivated');
    } catch (error) {
      console.error('Error reactivating entry:', error);
      alert('Failed to reactivate entry: ' + error.message);
    }
  };

  // Delete entry permanently
  const handleDelete = async (id) => {
    if (!window.confirm('Permanently delete this entry? This cannot be undone.')) {
      return;
    }

    try {
      const response = await fetch(`${API_URL}/vaddi-entries/${id}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        throw new Error('Failed to delete entry');
      }

      mutate();
    } catch (error) {
      console.error('Error deleting entry:', error);
      alert('Failed to delete entry: ' + error.message);
    }
  };

  // Download CSV
  const handleDownload = () => {
    if (safeEntries.length === 0) {
      alert('No data to download');
      return;
    }

    const csvHeader = 'Day,Name,Amount,Phone,Status\n';
    const csvRows = safeEntries.map(e => `${e.day},${e.name},₹${e.amount},${e.phone},${e.status || 'active'}`).join('\n');
    const csvContent = csvHeader + csvRows + `\n\nTotal Amount,₹${calculateGrandTotal()},,`;

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);

    link.setAttribute('href', url);
    link.setAttribute('download', `vaddi_list_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Format amount to K (e.g., 5000 -> 5k)
  const formatAmount = (amount) => {
    if (amount >= 1000) {
      return `₹${(amount / 1000).toFixed(0)}k`;
    }
    return `₹${amount}`;
  };

  // Format currency
  const formatCurrency = (amount) => {
    return `₹${(amount || 0).toLocaleString('en-IN')}`;
  };

  // Handle WhatsApp send for Vaddi
  const sendWhatsAppVaddi = () => {
    if (!pendingPaymentData || !pendingPaymentData.phone) return;

    const message = `Payment Receipt - Interest Loan

Customer: ${pendingPaymentData.customerName}
Month: ${pendingPaymentData.interestMonth}
Principal Amount: Rs.${pendingPaymentData.loanAmount.toLocaleString('en-IN')}
Date: ${new Date().toLocaleDateString('en-IN')}

Thank you for your payment!

- Om Sai Murugan Finance`;

    const cleanPhone = pendingPaymentData.phone.replace(/\D/g, '');
    const phoneWithCountryCode = `91${cleanPhone}`;
    const whatsappUrl = `https://wa.me/${phoneWithCountryCode}?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
  };

  // Handle choice selection for Vaddi
  const handleVaddiChoiceSelect = (choice) => {
    if (choice === 'whatsapp' || choice === 'both') {
      sendWhatsAppVaddi();
    }
    if (choice === 'print' || choice === 'both') {
      setPrintReceiptData(pendingPaymentData);
    }
    setShowSendChoice(false);
    setPendingPaymentData(null);
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
    LINE: '--------------------------------\n'
  };

  // Format amount for thermal printer (no commas, simple number)
  const formatForThermal = (amount) => {
    if (!amount) return '0';
    return Math.round(amount).toString();
  };

  // Print Vaddi Audit Report (Thermal)
  const printVaddiAuditThermal = async () => {
    try {
      if (!navigator.bluetooth) {
        alert('Bluetooth not supported. Use a Bluetooth-enabled browser.');
        return;
      }

      const device = await navigator.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: [
          '000018f0-0000-1000-8000-00805f9b34fb',
          '49535343-fe7d-4ae5-8fa9-9fafd205e455',
          'e7810a71-73ae-499d-8c15-faa9aef0c3f2'
        ]
      });

      const server = await device.gatt.connect();
      const services = await server.getPrimaryServices();
      let characteristic = null;

      for (const service of services) {
        const characteristics = await service.getCharacteristics();
        for (const char of characteristics) {
          if (char.properties.write || char.properties.writeWithoutResponse) {
            characteristic = char;
            break;
          }
        }
        if (characteristic) break;
      }

      if (!characteristic) {
        alert('Printer not compatible');
        return;
      }

      // Generate Audit Report
      let receipt = THERMAL_COMMANDS.INIT;
      receipt += THERMAL_COMMANDS.ALIGN_CENTER;
      receipt += THERMAL_COMMANDS.BOLD_ON;
      receipt += THERMAL_COMMANDS.DOUBLE_HEIGHT;
      receipt += 'VADDI LIST\n';
      receipt += 'AUDIT REPORT\n';
      receipt += THERMAL_COMMANDS.NORMAL_SIZE;
      receipt += THERMAL_COMMANDS.BOLD_OFF;
      receipt += `Date: ${new Date().toLocaleDateString('en-IN')}\n`;
      receipt += THERMAL_COMMANDS.LINE;

      // Summary
      const totalActive = activeEntries.length;
      const totalPrincipal = activeEntries.reduce((sum, e) => sum + (e.principal_amount || e.amount || 0), 0);
      const totalInterest = activeEntries.reduce((sum, e) => sum + (e.amount || 0), 0);

      receipt += THERMAL_COMMANDS.BOLD_ON;
      receipt += 'SUMMARY\n';
      receipt += THERMAL_COMMANDS.BOLD_OFF;
      receipt += THERMAL_COMMANDS.ALIGN_LEFT;
      receipt += `Active Entries: ${totalActive}\n`;
      receipt += `Total Principal: Rs ${formatForThermal(totalPrincipal)}\n`;
      receipt += `Total Monthly Int: Rs ${formatForThermal(totalInterest)}\n`;
      receipt += THERMAL_COMMANDS.LINE;

      // Customer List sorted by day
      receipt += THERMAL_COMMANDS.ALIGN_CENTER;
      receipt += THERMAL_COMMANDS.BOLD_ON;
      receipt += 'CUSTOMER LIST\n';
      receipt += THERMAL_COMMANDS.BOLD_OFF;
      receipt += THERMAL_COMMANDS.ALIGN_LEFT;

      // Sort by day
      const sortedEntries = [...activeEntries].sort((a, b) => (a.day || 0) - (b.day || 0));

      sortedEntries.forEach((entry, idx) => {
        const loanDate = entry.loan_date ? new Date(entry.loan_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' }) : '-';
        receipt += `${idx + 1}. ${entry.name}\n`;
        receipt += `   Ph: ${entry.phone || '-'}\n`;
        receipt += `   Day: ${entry.day} | Date: ${loanDate}\n`;
        receipt += `   Principal: Rs ${formatForThermal(entry.principal_amount || entry.amount || 0)}\n`;
        receipt += `   Interest: Rs ${formatForThermal(entry.amount || 0)}/mo\n`;
        if (entry.interest_rate) {
          receipt += `   Rate: ${entry.interest_rate}%\n`;
        }
        if (entry.collateral_type) {
          receipt += `   Collateral: ${entry.collateral_type}\n`;
        }
        if (entry.aadhar_number) {
          receipt += `   Aadhar: ${entry.aadhar_number}\n`;
        }
        receipt += '- - - - - - - - - - - - - -\n';
      });

      receipt += THERMAL_COMMANDS.LINE;
      receipt += THERMAL_COMMANDS.ALIGN_CENTER;
      receipt += 'Om Sai Murugan Finance\n';
      receipt += 'Ph: 8667510724\n';
      receipt += THERMAL_COMMANDS.FEED;
      receipt += THERMAL_COMMANDS.PARTIAL_CUT;

      // Send to printer
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

      alert('Interest audit report printed!');
    } catch (error) {
      if (error.name !== 'NotFoundError') {
        console.error('Print error:', error);
        alert('Print failed: ' + error.message);
      }
    }
  };

  // Print Single Day entries via Thermal Printer
  const printDayEntriesThermal = async (day) => {
    const dayEntries = entriesByDay[day] || [];
    if (dayEntries.length === 0) {
      alert('No entries to print for this day');
      return;
    }

    try {
      if (!navigator.bluetooth) {
        alert('Bluetooth not supported. Use a Bluetooth-enabled browser.');
        return;
      }

      const device = await navigator.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: [
          '000018f0-0000-1000-8000-00805f9b34fb',
          '49535343-fe7d-4ae5-8fa9-9fafd205e455',
          'e7810a71-73ae-499d-8c15-faa9aef0c3f2'
        ]
      });

      const server = await device.gatt.connect();
      const services = await server.getPrimaryServices();
      let characteristic = null;

      for (const service of services) {
        const characteristics = await service.getCharacteristics();
        for (const char of characteristics) {
          if (char.properties.write || char.properties.writeWithoutResponse) {
            characteristic = char;
            break;
          }
        }
        if (characteristic) break;
      }

      if (!characteristic) {
        alert('Printer not compatible');
        return;
      }

      // Calculate totals for this day
      const totalPrincipal = dayEntries.reduce((sum, e) => sum + (e.principal_amount || e.amount || 0), 0);
      const totalInterest = dayEntries.reduce((sum, e) => sum + (e.amount || 0), 0);

      // Generate Day Report
      let receipt = THERMAL_COMMANDS.INIT;
      receipt += THERMAL_COMMANDS.ALIGN_CENTER;
      receipt += THERMAL_COMMANDS.BOLD_ON;
      receipt += THERMAL_COMMANDS.DOUBLE_HEIGHT;
      receipt += 'INTEREST LOANS\n';
      receipt += `DAY ${day}\n`;
      receipt += THERMAL_COMMANDS.NORMAL_SIZE;
      receipt += THERMAL_COMMANDS.BOLD_OFF;
      receipt += `Date: ${new Date().toLocaleDateString('en-IN')}\n`;
      receipt += THERMAL_COMMANDS.LINE;

      // Summary
      receipt += THERMAL_COMMANDS.BOLD_ON;
      receipt += 'SUMMARY\n';
      receipt += THERMAL_COMMANDS.BOLD_OFF;
      receipt += THERMAL_COMMANDS.ALIGN_LEFT;
      receipt += `Entries: ${dayEntries.length}\n`;
      receipt += `Principal: Rs ${formatForThermal(totalPrincipal)}\n`;
      receipt += `Monthly Int: Rs ${formatForThermal(totalInterest)}\n`;
      receipt += THERMAL_COMMANDS.LINE;

      // Customer List
      receipt += THERMAL_COMMANDS.ALIGN_CENTER;
      receipt += THERMAL_COMMANDS.BOLD_ON;
      receipt += 'CUSTOMER LIST\n';
      receipt += THERMAL_COMMANDS.BOLD_OFF;
      receipt += THERMAL_COMMANDS.ALIGN_LEFT;

      dayEntries.forEach((entry, idx) => {
        const loanDate = entry.loan_date ? new Date(entry.loan_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' }) : '-';
        receipt += `${idx + 1}. ${entry.name}\n`;
        receipt += `   Ph: ${entry.phone || '-'}\n`;
        receipt += `   Date: ${loanDate}\n`;
        receipt += `   Principal: Rs ${formatForThermal(entry.principal_amount || entry.amount || 0)}\n`;
        receipt += `   Interest: Rs ${formatForThermal(entry.amount || 0)}/mo\n`;
        if (entry.interest_rate) {
          receipt += `   Rate: ${entry.interest_rate}%\n`;
        }
        if (entry.collateral_type) {
          receipt += `   Collateral: ${entry.collateral_type}\n`;
        }
        receipt += '- - - - - - - - - - - - - -\n';
      });

      receipt += THERMAL_COMMANDS.LINE;
      receipt += THERMAL_COMMANDS.ALIGN_CENTER;
      receipt += THERMAL_COMMANDS.BOLD_ON;
      receipt += `TOTAL: Rs ${formatForThermal(totalInterest)}/mo\n`;
      receipt += THERMAL_COMMANDS.BOLD_OFF;
      receipt += 'Om Sai Murugan Finance\n';
      receipt += 'Ph: 8667510724\n';
      receipt += THERMAL_COMMANDS.FEED;
      receipt += THERMAL_COMMANDS.PARTIAL_CUT;

      // Send to printer
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

      alert(`Day ${day} entries printed!`);
    } catch (error) {
      if (error.name !== 'NotFoundError') {
        console.error('Print error:', error);
        alert('Print failed: ' + error.message);
      }
    }
  };

  // Generate PDF report
  const generatePDF = () => {
    const doc = new jsPDF();
    const monthName = getMonthOptions().find(m => m.value === selectedMonth)?.label || selectedMonth;

    // Header
    doc.setFillColor(102, 126, 234);
    doc.rect(0, 0, 210, 35, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text('OM SAI MURUGAN FINANCE', 105, 15, { align: 'center' });
    doc.setFontSize(14);
    doc.text(`Interest Report - ${monthName}`, 105, 27, { align: 'center' });

    // Summary Box
    doc.setTextColor(0, 0, 0);
    doc.setFillColor(240, 240, 250);
    doc.rect(15, 45, 180, 35, 'F');
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Monthly Summary', 20, 55);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.text(`Total Collected: ${formatCurrency(summary.totalCollected)}`, 20, 65);
    doc.text(`My Profit: ${formatCurrency(summary.myProfit)}`, 110, 65);
    doc.text(`Payments: ${paidThisMonth.length} paid / ${unpaidThisMonth.length} pending`, 20, 73);

    let yPos = 95;

    // Paid Section
    doc.setFillColor(16, 185, 129);
    doc.rect(15, yPos - 7, 180, 10, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text(`PAID (${paidThisMonth.length})`, 20, yPos);
    yPos += 10;

    doc.setTextColor(0, 0, 0);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');

    if (paidThisMonth.length === 0) {
      doc.text('No payments recorded', 20, yPos);
      yPos += 10;
    } else {
      paidThisMonth.forEach((entry, index) => {
        const payment = monthPayments.find(p => p.entryId === entry.id);
        if (yPos > 270) {
          doc.addPage();
          yPos = 20;
        }
        doc.text(`${index + 1}. ${entry.name} (Day ${entry.day})`, 20, yPos);
        doc.text(`Interest: ${formatCurrency(payment?.totalAmount)}`, 120, yPos);
        yPos += 8;
      });
    }

    yPos += 10;

    // Unpaid Section
    if (yPos > 250) {
      doc.addPage();
      yPos = 20;
    }
    doc.setFillColor(239, 68, 68);
    doc.rect(15, yPos - 7, 180, 10, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text(`UNPAID (${unpaidThisMonth.length})`, 20, yPos);
    yPos += 10;

    doc.setTextColor(0, 0, 0);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');

    if (unpaidThisMonth.length === 0) {
      doc.text('All customers have paid!', 20, yPos);
    } else {
      unpaidThisMonth.forEach((entry, index) => {
        if (yPos > 270) {
          doc.addPage();
          yPos = 20;
        }
        doc.text(`${index + 1}. ${entry.name} (Day ${entry.day})`, 20, yPos);
        doc.text(`${formatCurrency(entry.principal_amount || entry.amount)}`, 120, yPos);
        yPos += 8;
      });
    }

    // Footer
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      doc.text(`Generated on ${new Date().toLocaleDateString('en-IN')} | Page ${i} of ${pageCount}`, 105, 290, { align: 'center' });
    }

    // Save the PDF
    doc.save(`Interest_Report_${selectedMonth}.pdf`);
  };

  if (isLoading) {
    return (
      <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #1e3a8a 0%, #1e293b 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', color: 'white' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>⏳</div>
          <div style={{ fontSize: '18px', fontWeight: 600 }}>Loading...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #1e3a8a 0%, #1e293b 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', color: 'white' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>❌</div>
          <div style={{ fontSize: '18px', fontWeight: 600 }}>Failed to load data</div>
          <button onClick={() => mutate()} style={{ marginTop: '16px', padding: '10px 20px', background: '#10b981', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #1e3a8a 0%, #1e293b 100%)' }}>
      {/* WhatsApp/Print Choice Modal */}
      {showSendChoice && pendingPaymentData && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 2000,
          padding: '20px'
        }}>
          <div style={{
            background: 'white',
            borderRadius: '16px',
            width: '100%',
            maxWidth: '320px',
            overflow: 'hidden'
          }}>
            <div style={{
              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              padding: '20px',
              textAlign: 'center',
              color: 'white'
            }}>
              <div style={{ fontSize: '40px', marginBottom: '8px' }}>✅</div>
              <div style={{ fontSize: '18px', fontWeight: 700 }}>Payment Recorded!</div>
              <div style={{ fontSize: '14px', opacity: 0.9, marginTop: '4px' }}>
                {formatCurrency(pendingPaymentData.amountPaid)} received
              </div>
            </div>

            <div style={{ padding: '20px' }}>
              <div style={{ fontSize: '14px', color: '#6b7280', textAlign: 'center', marginBottom: '16px' }}>
                How would you like to send receipt?
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <button
                  onClick={() => handleVaddiChoiceSelect('whatsapp')}
                  style={{
                    padding: '14px',
                    background: 'linear-gradient(135deg, #25D366 0%, #128C7E 100%)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '10px',
                    fontSize: '15px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px'
                  }}
                >
                  📱 WhatsApp Only
                </button>

                <button
                  onClick={() => handleVaddiChoiceSelect('print')}
                  style={{
                    padding: '14px',
                    background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '10px',
                    fontSize: '15px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px'
                  }}
                >
                  🖨️ Thermal Print Only
                </button>

                <button
                  onClick={() => handleVaddiChoiceSelect('both')}
                  style={{
                    padding: '14px',
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '10px',
                    fontSize: '15px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px'
                  }}
                >
                  📱🖨️ Both WhatsApp + Print
                </button>

                <button
                  onClick={() => handleVaddiChoiceSelect('skip')}
                  style={{
                    padding: '12px',
                    background: '#f3f4f6',
                    color: '#6b7280',
                    border: 'none',
                    borderRadius: '10px',
                    fontSize: '14px',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Skip
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
        padding: '16px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
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
              padding: '4px'
            }}
          >
            ←
          </button>
          <h2 style={{ margin: 0, color: 'white', fontSize: '20px', fontWeight: 700 }}>
            Interest Loans
          </h2>
        </div>
      </div>

      {/* Tab Switcher */}
      <div style={{ padding: '16px 16px 0' }}>
        <div style={{
          display: 'flex',
          gap: '8px',
          background: 'rgba(255,255,255,0.1)',
          padding: '4px',
          borderRadius: '8px'
        }}>
          <button
            onClick={() => setActiveTab('monthly')}
            style={{
              flex: 1,
              padding: '10px',
              border: 'none',
              borderRadius: '6px',
              fontWeight: 600,
              cursor: 'pointer',
              background: activeTab === 'monthly' ? 'white' : 'transparent',
              color: activeTab === 'monthly' ? '#667eea' : 'white'
            }}
          >
            📊 Monthly View
          </button>
          <button
            onClick={() => setActiveTab('grid')}
            style={{
              flex: 1,
              padding: '10px',
              border: 'none',
              borderRadius: '6px',
              fontWeight: 600,
              cursor: 'pointer',
              background: activeTab === 'grid' ? 'white' : 'transparent',
              color: activeTab === 'grid' ? '#667eea' : 'white'
            }}
          >
            📅 Grid
          </button>
          <button
            onClick={() => setActiveTab('history')}
            style={{
              flex: 1,
              padding: '10px',
              border: 'none',
              borderRadius: '6px',
              fontWeight: 600,
              cursor: 'pointer',
              background: activeTab === 'history' ? 'white' : 'transparent',
              color: activeTab === 'history' ? '#667eea' : 'white'
            }}
          >
            📜 History
          </button>
        </div>
      </div>

      {/* Monthly View Tab */}
      {activeTab === 'monthly' && (
        <div style={{ padding: '16px' }}>
          {/* Month Selector */}
          <div style={{
            background: 'white',
            borderRadius: '12px',
            padding: '16px',
            marginBottom: '16px'
          }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, color: '#374151' }}>
              Select Month
            </label>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              style={{
                width: '100%',
                padding: '12px',
                border: '2px solid #e5e7eb',
                borderRadius: '8px',
                fontSize: '16px',
                fontWeight: 600
              }}
            >
              {getMonthOptions().map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          {/* Monthly Summary Card */}
          <div style={{
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            borderRadius: '12px',
            padding: '20px',
            marginBottom: '16px',
            color: 'white'
          }}>
            <div style={{ fontSize: '14px', opacity: 0.9, marginBottom: '12px' }}>
              {getMonthOptions().find(m => m.value === selectedMonth)?.label} Summary
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '24px', fontWeight: 700 }}>{formatCurrency(summary.totalCollected)}</div>
                <div style={{ fontSize: '12px', opacity: 0.8 }}>Total Collected</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '24px', fontWeight: 700, color: '#10b981' }}>{formatCurrency(summary.myProfit)}</div>
                <div style={{ fontSize: '12px', opacity: 0.8 }}>My Profit</div>
              </div>
            </div>
            <div style={{ marginTop: '12px', textAlign: 'center', fontSize: '13px', opacity: 0.9 }}>
              {paidThisMonth.length} Paid / {unpaidThisMonth.length} Unpaid
            </div>
            {/* Action Buttons */}
            <div style={{ display: 'flex', gap: '8px', marginTop: '14px' }}>
              <button
                onClick={generatePDF}
                style={{
                  flex: 1,
                  padding: '10px',
                  background: 'rgba(255,255,255,0.2)',
                  border: '2px solid rgba(255,255,255,0.4)',
                  borderRadius: '8px',
                  color: 'white',
                  fontWeight: 700,
                  fontSize: '12px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px'
                }}
              >
                📄 PDF
              </button>
              <button
                onClick={printVaddiAuditThermal}
                style={{
                  flex: 1,
                  padding: '10px',
                  background: 'rgba(255,255,255,0.2)',
                  border: '2px solid rgba(255,255,255,0.4)',
                  borderRadius: '8px',
                  color: 'white',
                  fontWeight: 700,
                  fontSize: '12px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px'
                }}
              >
                🖨️ Print Audit
              </button>
            </div>
          </div>

          {/* Unpaid Section */}
          <div style={{
            background: 'white',
            borderRadius: '12px',
            marginBottom: '16px',
            overflow: 'hidden'
          }}>
            <div style={{
              padding: '14px 16px',
              background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
              color: 'white',
              fontWeight: 700,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <span>❌ Interest Unpaid</span>
              <span style={{
                background: 'rgba(255,255,255,0.2)',
                padding: '4px 12px',
                borderRadius: '20px',
                fontSize: '14px'
              }}>
                {unpaidThisMonth.length}
              </span>
            </div>
            <div style={{ padding: '12px' }}>
              {unpaidThisMonth.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '20px', color: '#9ca3af' }}>
                  All customers have paid for this month!
                </div>
              ) : (
                <div style={{ display: 'grid', gap: '10px' }}>
                  {unpaidThisMonth.map(entry => (
                    <div
                      key={entry.id}
                      onClick={() => openPaymentModal(entry)}
                      style={{
                        padding: '12px',
                        background: 'linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%)',
                        borderRadius: '8px',
                        borderLeft: '4px solid #ef4444',
                        cursor: 'pointer',
                        transition: 'transform 0.2s'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 700, color: '#1e293b', marginBottom: '4px' }}>
                            {entry.name}
                          </div>
                          <div style={{ fontSize: '13px', color: '#059669', fontWeight: 600 }}>
                            {formatCurrency(entry.amount)} • Day {entry.day}
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEditEntry(entry);
                            }}
                            style={{
                              background: '#6366f1',
                              color: 'white',
                              border: 'none',
                              padding: '6px 10px',
                              borderRadius: '6px',
                              fontSize: '11px',
                              fontWeight: 600,
                              cursor: 'pointer'
                            }}
                          >
                            ✏️ Edit
                          </button>
                          <div style={{
                            background: '#ef4444',
                            color: 'white',
                            padding: '6px 12px',
                            borderRadius: '6px',
                            fontSize: '12px',
                            fontWeight: 600
                          }}>
                            Record Payment →
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Paid Section */}
          <div style={{
            background: 'white',
            borderRadius: '12px',
            overflow: 'hidden'
          }}>
            <div style={{
              padding: '14px 16px',
              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              color: 'white',
              fontWeight: 700,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <span>✅ Interest Paid</span>
              <span style={{
                background: 'rgba(255,255,255,0.2)',
                padding: '4px 12px',
                borderRadius: '20px',
                fontSize: '14px'
              }}>
                {paidThisMonth.length}
              </span>
            </div>
            <div style={{ padding: '12px' }}>
              {paidThisMonth.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '20px', color: '#9ca3af' }}>
                  No payments recorded yet for this month
                </div>
              ) : (
                <div style={{ display: 'grid', gap: '10px' }}>
                  {paidThisMonth.map(entry => {
                    const payment = monthPayments.find(p => p.entryId === entry.id);
                    return (
                      <div
                        key={entry.id}
                        style={{
                          padding: '12px',
                          background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)',
                          borderRadius: '8px',
                          borderLeft: '4px solid #10b981'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 700, color: '#1e293b', marginBottom: '4px' }}>
                              {entry.name}
                            </div>
                            <div style={{ fontSize: '13px', color: '#059669', fontWeight: 600 }}>
                              Total: {formatCurrency(payment?.totalAmount)} • Day {entry.day}
                            </div>
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'flex-end' }}>
                            <div style={{
                              background: '#10b981',
                              color: 'white',
                              padding: '4px 8px',
                              borderRadius: '4px',
                              fontSize: '11px',
                              fontWeight: 600
                            }}>
                              ✓ PAID
                            </div>
                            <button
                              onClick={() => handleEditEntry(entry)}
                              style={{
                                background: '#6366f1',
                                color: 'white',
                                border: 'none',
                                padding: '4px 8px',
                                borderRadius: '4px',
                                fontSize: '10px',
                                fontWeight: 600,
                                cursor: 'pointer'
                              }}
                            >
                              ✏️ Edit
                            </button>
                            {payment && (
                              <button
                                onClick={() => handleUndoPayment(payment.id, entry.name)}
                                style={{
                                  background: '#f87171',
                                  color: 'white',
                                  border: 'none',
                                  padding: '4px 8px',
                                  borderRadius: '4px',
                                  fontSize: '10px',
                                  fontWeight: 600,
                                  cursor: 'pointer'
                                }}
                              >
                                ↩ Undo
                              </button>
                            )}
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
      )}

      {/* 31-Day Grid Tab */}
      {activeTab === 'grid' && (
        <div style={{ padding: '16px' }}>
          {/* Main Card */}
          <div style={{
            background: 'white',
            borderRadius: '12px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
            overflow: 'hidden'
          }}>
            {/* Title Bar */}
            <div style={{
              padding: '16px',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: 'white',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '12px'
            }}>
              <div style={{ fontSize: '18px', fontWeight: 700 }}>📅 31-Day Grid</div>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{
                  background: 'rgba(255,255,255,0.2)',
                  padding: '8px 16px',
                  borderRadius: '8px',
                  fontWeight: 600
                }}>
                  Total: {formatCurrency(calculateGrandTotal())}
                </div>
                <button
                  onClick={handleDownload}
                  style={{
                    background: '#10b981',
                    color: 'white',
                    border: 'none',
                    padding: '8px 16px',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontWeight: 600,
                    fontSize: '14px'
                  }}
                >
                  📥 Download
                </button>
              </div>
            </div>

            {/* 31-Day Calendar Grid */}
            <div style={{ padding: '20px' }}>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(7, 1fr)',
                gap: '8px'
              }}>
                {[...Array(31)].map((_, index) => {
                  const day = index + 1;
                  const dayTotal = getDayTotal(day);
                  const dayCount = getDayCount(day);
                  const hasData = entriesByDay[day].length > 0;
                  const hasSettled = entriesByDay[day].some(e => e.status === 'settled');

                  return (
                    <div
                      key={day}
                      onClick={() => handleDayClick(day)}
                      style={{
                        border: '2px solid #e5e7eb',
                        borderRadius: '8px',
                        padding: '12px 8px',
                        textAlign: 'center',
                        cursor: 'pointer',
                        background: hasData ? 'linear-gradient(135deg, #f0f4ff 0%, #e6ecff 100%)' : 'white',
                        transition: 'all 0.2s',
                        minHeight: '80px',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'center',
                        position: 'relative'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.transform = 'scale(1.05)';
                        e.currentTarget.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.3)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'scale(1)';
                        e.currentTarget.style.boxShadow = 'none';
                      }}
                    >
                      <div style={{
                        fontSize: '18px',
                        fontWeight: 700,
                        color: hasData ? '#667eea' : '#9ca3af',
                        marginBottom: '4px'
                      }}>
                        {day}
                      </div>
                      {hasData && (
                        <>
                          <div style={{
                            fontSize: '12px',
                            fontWeight: 600,
                            color: '#059669',
                            marginBottom: '2px'
                          }}>
                            {formatAmount(dayTotal)}
                          </div>
                          <div style={{
                            fontSize: '11px',
                            color: '#6b7280'
                          }}>
                            👥{dayCount}{hasSettled && ' 🔒'}
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* History Tab */}
      {activeTab === 'history' && (
        <div style={{ padding: '16px' }}>
          {/* History Header */}
          <div style={{
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            borderRadius: '12px',
            padding: '20px',
            marginBottom: '16px',
            color: 'white'
          }}>
            <div style={{ fontSize: '18px', fontWeight: 700, marginBottom: '8px' }}>
              📜 Interest Payment History
            </div>
            <div style={{ fontSize: '13px', opacity: 0.9 }}>
              View all past months' collections and profit sharing
            </div>
          </div>

          {/* All Time Summary */}
          {allMonthsSummary.length > 0 && (
            <div style={{
              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              borderRadius: '12px',
              padding: '16px',
              marginBottom: '16px',
              color: 'white'
            }}>
              <div style={{ fontSize: '14px', opacity: 0.9, marginBottom: '10px' }}>
                💰 All Time Total
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '20px', fontWeight: 700 }}>
                    {formatCurrency(allMonthsSummary.reduce((sum, m) => sum + (m.totalCollected || 0), 0))}
                  </div>
                  <div style={{ fontSize: '11px', opacity: 0.8 }}>Total</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '20px', fontWeight: 700 }}>
                    {formatCurrency(allMonthsSummary.reduce((sum, m) => sum + (m.myProfit || 0), 0))}
                  </div>
                  <div style={{ fontSize: '11px', opacity: 0.8 }}>My Profit</div>
                </div>
              </div>
            </div>
          )}

          {/* Monthly History Cards */}
          <div style={{ display: 'grid', gap: '12px' }}>
            {allMonthsSummary.length === 0 ? (
              <div style={{
                background: 'white',
                borderRadius: '12px',
                padding: '40px 20px',
                textAlign: 'center',
                color: '#6b7280'
              }}>
                <div style={{ fontSize: '48px', marginBottom: '12px' }}>📭</div>
                <div style={{ fontSize: '16px', fontWeight: 600 }}>No payment history yet</div>
                <div style={{ fontSize: '13px', marginTop: '8px' }}>
                  Start recording payments in Monthly View
                </div>
              </div>
            ) : (
              allMonthsSummary
                .sort((a, b) => b.month.localeCompare(a.month))
                .map((monthData, index) => {
                  const monthDate = new Date(monthData.month + '-01');
                  const monthName = monthDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
                  const isCurrentMonth = monthData.month === selectedMonth;

                  return (
                    <div
                      key={monthData.month}
                      onClick={() => {
                        setSelectedMonth(monthData.month);
                        setActiveTab('monthly');
                      }}
                      style={{
                        background: isCurrentMonth
                          ? 'linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%)'
                          : 'white',
                        borderRadius: '12px',
                        padding: '16px',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                        cursor: 'pointer',
                        border: isCurrentMonth ? '2px solid #3b82f6' : '2px solid transparent',
                        transition: 'all 0.2s'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                        <div style={{ fontWeight: 700, fontSize: '16px', color: '#1e293b' }}>
                          {monthName}
                          {isCurrentMonth && (
                            <span style={{
                              background: '#3b82f6',
                              color: 'white',
                              padding: '2px 8px',
                              borderRadius: '10px',
                              fontSize: '10px',
                              marginLeft: '8px'
                            }}>
                              Current
                            </span>
                          )}
                        </div>
                        <span style={{ color: '#6b7280', fontSize: '12px' }}>Tap to view →</span>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                        <div style={{ textAlign: 'center', padding: '8px', background: 'rgba(102, 126, 234, 0.1)', borderRadius: '8px' }}>
                          <div style={{ fontSize: '16px', fontWeight: 700, color: '#667eea' }}>
                            {formatCurrency(monthData.totalCollected || 0)}
                          </div>
                          <div style={{ fontSize: '10px', color: '#6b7280' }}>Total</div>
                        </div>
                        <div style={{ textAlign: 'center', padding: '8px', background: 'rgba(16, 185, 129, 0.1)', borderRadius: '8px' }}>
                          <div style={{ fontSize: '16px', fontWeight: 700, color: '#10b981' }}>
                            {formatCurrency(monthData.myProfit || 0)}
                          </div>
                          <div style={{ fontSize: '10px', color: '#6b7280' }}>My Profit</div>
                        </div>
                      </div>
                      {monthData.paymentCount > 0 && (
                        <div style={{ textAlign: 'center', marginTop: '10px', fontSize: '12px', color: '#6b7280' }}>
                          {monthData.paymentCount} payments recorded
                        </div>
                      )}
                    </div>
                  );
                })
            )}
          </div>
        </div>
      )}

      {/* Day Entries Modal */}
      {showModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000
          }}
          onClick={closeModal}
        >
          <div
            style={{
              background: 'white',
              borderRadius: '12px',
              maxWidth: '500px',
              width: '90%',
              maxHeight: '90vh',
              overflow: 'auto',
              boxShadow: '0 10px 40px rgba(0, 0, 0, 0.3)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div style={{
              padding: '16px',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: 'white',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>
                📅 Day {selectedDay}
              </h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                {entriesByDay[selectedDay]?.length > 0 && (
                  <button
                    onClick={() => printDayEntriesThermal(selectedDay)}
                    style={{
                      background: 'rgba(255,255,255,0.2)',
                      border: '2px solid rgba(255,255,255,0.4)',
                      color: 'white',
                      padding: '6px 12px',
                      borderRadius: '6px',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    🖨️ Print
                  </button>
                )}
                <button
                  onClick={closeModal}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'white',
                    fontSize: '24px',
                    cursor: 'pointer',
                    padding: '0',
                    width: '30px',
                    height: '30px'
                  }}
                >
                  ×
                </button>
              </div>
            </div>

            {/* Modal Content */}
            <div style={{ padding: '20px' }}>
              {/* Contact Picker Button */}
              <button
                type="button"
                onClick={selectFromContacts}
                disabled={loading}
                style={{
                  width: '100%',
                  background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                  color: 'white',
                  border: 'none',
                  padding: '12px',
                  borderRadius: '6px',
                  fontWeight: 600,
                  fontSize: '14px',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  marginBottom: '16px',
                  opacity: loading ? 0.6 : 1
                }}
              >
                👤 Select from Contacts
              </button>

              {/* Add/Edit Entry Form */}
              <form onSubmit={handleSubmit} style={{ marginBottom: '20px' }}>
                <div style={{ marginBottom: '12px' }}>
                  <label style={{ display: 'block', marginBottom: '6px', fontWeight: 600, color: '#374151', fontSize: '14px' }}>
                    👤 Name *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Customer name"
                    required
                    disabled={loading}
                    style={{
                      width: '100%',
                      padding: '10px',
                      border: '2px solid #e5e7eb',
                      borderRadius: '6px',
                      fontSize: '14px'
                    }}
                  />
                </div>

                <div style={{ marginBottom: '12px' }}>
                  <label style={{ display: 'block', marginBottom: '6px', fontWeight: 600, color: '#374151', fontSize: '14px' }}>
                    🏦 Principal Amount *
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={formData.principal_amount}
                    onChange={(e) => {
                      const value = e.target.value.replace(/[^0-9]/g, '');
                      setFormData({ ...formData, principal_amount: value, amount: value });
                    }}
                    placeholder="₹ Loan Amount"
                    autoComplete="off"
                    required
                    disabled={loading}
                    style={{
                      width: '100%',
                      padding: '10px',
                      border: '2px solid #e5e7eb',
                      borderRadius: '6px',
                      fontSize: '14px'
                    }}
                  />
                </div>

                <div style={{ display: 'flex', gap: '10px', marginBottom: '12px' }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', marginBottom: '6px', fontWeight: 600, color: '#374151', fontSize: '14px' }}>
                      📱 Phone *
                    </label>
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      placeholder="10 digits"
                      required
                      pattern="[0-9]{10}"
                      maxLength="10"
                      disabled={loading}
                      style={{
                        width: '100%',
                        padding: '10px',
                        border: '2px solid #e5e7eb',
                        borderRadius: '6px',
                        fontSize: '14px'
                      }}
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', marginBottom: '6px', fontWeight: 600, color: '#374151', fontSize: '14px' }}>
                      📅 Loan Date *
                    </label>
                    <input
                      type="date"
                      value={formData.loan_date}
                      onChange={(e) => setFormData({ ...formData, loan_date: e.target.value })}
                      required
                      disabled={loading}
                      style={{
                        width: '100%',
                        padding: '10px',
                        border: '2px solid #e5e7eb',
                        borderRadius: '6px',
                        fontSize: '14px'
                      }}
                    />
                  </div>
                </div>

                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', marginBottom: '6px', fontWeight: 600, color: '#374151', fontSize: '14px' }}>
                    🆔 Aadhar Number
                  </label>
                  <input
                    type="text"
                    value={formData.aadhar_number}
                    onChange={(e) => {
                      const value = e.target.value.replace(/[^0-9]/g, '').slice(0, 12);
                      setFormData({ ...formData, aadhar_number: value });
                    }}
                    placeholder="12 digit Aadhar (optional)"
                    maxLength="12"
                    disabled={loading}
                    style={{
                      width: '100%',
                      padding: '10px',
                      border: '2px solid #e5e7eb',
                      borderRadius: '6px',
                      fontSize: '14px'
                    }}
                  />
                </div>

                <div style={{ display: 'flex', gap: '10px', marginBottom: '12px' }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', marginBottom: '6px', fontWeight: 600, color: '#374151', fontSize: '14px' }}>
                      📊 Interest Rate (%)
                    </label>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={formData.interest_rate}
                      onChange={(e) => {
                        const value = e.target.value.replace(/[^0-9.]/g, '');
                        setFormData({ ...formData, interest_rate: value });
                      }}
                      placeholder="e.g., 8 or 8.5"
                      disabled={loading}
                      style={{
                        width: '100%',
                        padding: '10px',
                        border: '2px solid #e5e7eb',
                        borderRadius: '6px',
                        fontSize: '14px'
                      }}
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', marginBottom: '6px', fontWeight: 600, color: '#374151', fontSize: '14px' }}>
                      🏍️ Collateral / Basis
                    </label>
                    <select
                      value={formData.collateral_type}
                      onChange={(e) => setFormData({ ...formData, collateral_type: e.target.value })}
                      disabled={loading}
                      style={{
                        width: '100%',
                        padding: '10px',
                        border: '2px solid #e5e7eb',
                        borderRadius: '6px',
                        fontSize: '14px',
                        background: 'white'
                      }}
                    >
                      <option value="">Select...</option>
                      <option value="Vehicle">Vehicle</option>
                      <option value="Gold">Gold</option>
                      <option value="Property">Property</option>
                      <option value="Signature">Signature</option>
                      <option value="Documents">Documents</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '10px' }}>
                  {editingEntry && (
                    <button
                      type="button"
                      onClick={handleCancelEdit}
                      disabled={loading}
                      style={{
                        flex: 1,
                        background: '#e5e7eb',
                        color: '#374151',
                        border: 'none',
                        padding: '12px',
                        borderRadius: '6px',
                        fontWeight: 600,
                        fontSize: '14px',
                        cursor: loading ? 'not-allowed' : 'pointer',
                        opacity: loading ? 0.6 : 1
                      }}
                    >
                      Cancel
                    </button>
                  )}
                  <button
                    type="submit"
                    disabled={loading}
                    style={{
                      flex: 1,
                      background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                      color: 'white',
                      border: 'none',
                      padding: '12px',
                      borderRadius: '6px',
                      fontWeight: 600,
                      fontSize: '14px',
                      cursor: loading ? 'not-allowed' : 'pointer',
                      opacity: loading ? 0.6 : 1
                    }}
                  >
                    {loading ? (editingEntry ? 'Updating...' : 'Adding...') : (editingEntry ? '✓ Update Entry' : '➕ Add Entry')}
                  </button>
                </div>
              </form>

              {/* Entries List */}
              {entriesByDay[selectedDay].length > 0 && (
                <div>
                  <div style={{
                    fontSize: '14px',
                    fontWeight: 600,
                    color: '#374151',
                    marginBottom: '12px',
                    paddingBottom: '8px',
                    borderBottom: '2px solid #e5e7eb'
                  }}>
                    Entries ({entriesByDay[selectedDay].length})
                  </div>

                  <div style={{ display: 'grid', gap: '10px' }}>
                    {entriesByDay[selectedDay].map(entry => {
                      const isSettled = entry.status === 'settled';
                      return (
                        <div
                          key={entry.id}
                          style={{
                            padding: '12px',
                            background: isSettled
                              ? 'linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%)'
                              : 'linear-gradient(135deg, #f0f4ff 0%, #e6ecff 100%)',
                            borderRadius: '8px',
                            borderLeft: isSettled ? '3px solid #9ca3af' : '3px solid #667eea',
                            opacity: isSettled ? 0.7 : 1
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '8px' }}>
                            <div style={{ flex: 1 }}>
                              <div style={{
                                fontWeight: 700,
                                fontSize: '14px',
                                color: isSettled ? '#6b7280' : '#1e293b',
                                marginBottom: '4px',
                                textDecoration: isSettled ? 'line-through' : 'none'
                              }}>
                                {entry.name} {isSettled && '🔒'}
                              </div>
                              <div style={{ fontSize: '13px', color: isSettled ? '#9ca3af' : '#059669', fontWeight: 600, marginBottom: '2px' }}>
                                {entry.principal_amount ? `${formatCurrency(entry.principal_amount)}` : formatCurrency(entry.amount)}
                              </div>
                              <div style={{ fontSize: '12px', color: '#6b7280' }}>
                                📱 {entry.phone}
                                {entry.loan_date && ` • 📅 ${new Date(entry.loan_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' })}`}
                              </div>
                              {(entry.interest_rate || entry.collateral_type) && (
                                <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '2px' }}>
                                  {entry.interest_rate && `📊 ${entry.interest_rate}% interest`}
                                  {entry.interest_rate && entry.collateral_type && ' • '}
                                  {entry.collateral_type && `🏍️ ${entry.collateral_type}`}
                                </div>
                              )}
                              {entry.aadhar_number && (
                                <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '2px' }}>
                                  🆔 {entry.aadhar_number}
                                </div>
                              )}
                              {isSettled && entry.settledDate && (
                                <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '4px' }}>
                                  Settled: {entry.settledDate}
                                </div>
                              )}
                            </div>
                            <div style={{ display: 'flex', gap: '6px', flexDirection: 'column', alignItems: 'flex-end' }}>
                              {!isSettled && (
                                <button
                                  onClick={() => handleSettle(entry.id)}
                                  style={{
                                    background: '#10b981',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '6px',
                                    padding: '6px 12px',
                                    fontSize: '12px',
                                    cursor: 'pointer',
                                    fontWeight: 600,
                                    whiteSpace: 'nowrap'
                                  }}
                                >
                                  ✓ Settled
                                </button>
                              )}
                              {isSettled && (
                                <button
                                  onClick={() => handleReactivate(entry.id)}
                                  style={{
                                    background: '#3b82f6',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '6px',
                                    padding: '6px 12px',
                                    fontSize: '12px',
                                    cursor: 'pointer',
                                    fontWeight: 600,
                                    whiteSpace: 'nowrap'
                                  }}
                                >
                                  ↩ Reactivate
                                </button>
                              )}
                            </div>
                          </div>
                          {/* Action Buttons Row */}
                          {!isSettled && (
                            <div style={{ display: 'flex', gap: '6px', marginTop: '8px', flexWrap: 'wrap' }}>
                              <button
                                onClick={() => generateAcknowledgmentPDF(entry, false)}
                                style={{
                                  background: '#f59e0b',
                                  color: 'white',
                                  border: 'none',
                                  borderRadius: '4px',
                                  padding: '5px 10px',
                                  fontSize: '11px',
                                  cursor: 'pointer',
                                  fontWeight: 600
                                }}
                              >
                                📄 PDF
                              </button>
                              <button
                                onClick={() => generateAcknowledgmentPDF(entry, true)}
                                style={{
                                  background: '#3b82f6',
                                  color: 'white',
                                  border: 'none',
                                  borderRadius: '4px',
                                  padding: '5px 10px',
                                  fontSize: '11px',
                                  cursor: 'pointer',
                                  fontWeight: 600
                                }}
                              >
                                🖨️ Print
                              </button>
                              <button
                                onClick={() => {
                                  setSelectedEntryForAck(entry);
                                  setShowAcknowledgmentModal(true);
                                }}
                                style={{
                                  background: entry.signed_acknowledgment ? '#10b981' : '#8b5cf6',
                                  color: 'white',
                                  border: 'none',
                                  borderRadius: '4px',
                                  padding: '5px 10px',
                                  fontSize: '11px',
                                  cursor: 'pointer',
                                  fontWeight: 600
                                }}
                              >
                                {entry.signed_acknowledgment ? '✓ Signed' : '📷 Upload'}
                              </button>
                              <button
                                onClick={() => handleEditEntry(entry)}
                                style={{
                                  background: '#6366f1',
                                  color: 'white',
                                  border: 'none',
                                  borderRadius: '4px',
                                  padding: '5px 10px',
                                  fontSize: '11px',
                                  cursor: 'pointer',
                                  fontWeight: 600
                                }}
                              >
                                ✏️ Edit
                              </button>
                              <button
                                onClick={() => handleDelete(entry.id)}
                                style={{
                                  background: '#ef4444',
                                  color: 'white',
                                  border: 'none',
                                  borderRadius: '4px',
                                  padding: '5px 10px',
                                  fontSize: '11px',
                                  cursor: 'pointer',
                                  fontWeight: 600
                                }}
                              >
                                🗑️
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {entriesByDay[selectedDay].length === 0 && (
                <div style={{
                  textAlign: 'center',
                  padding: '30px',
                  color: '#9ca3af',
                  fontStyle: 'italic'
                }}>
                  No entries for this day. Add your first entry above!
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Payment Modal */}
      {showPaymentModal && selectedEntry && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000
          }}
          onClick={closePaymentModal}
        >
          <div
            style={{
              background: 'white',
              borderRadius: '12px',
              maxWidth: '400px',
              width: '90%',
              boxShadow: '0 10px 40px rgba(0, 0, 0, 0.3)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div style={{
              padding: '16px',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: 'white',
              borderRadius: '12px 12px 0 0'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>
                  Record Payment
                </h3>
                <button
                  onClick={closePaymentModal}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'white',
                    fontSize: '24px',
                    cursor: 'pointer'
                  }}
                >
                  ×
                </button>
              </div>
              <div style={{ marginTop: '8px', fontSize: '14px', opacity: 0.9 }}>
                {selectedEntry.name} • Day {selectedEntry.day}
              </div>
            </div>

            {/* Modal Content */}
            <form onSubmit={handlePaymentSubmit} style={{ padding: '20px' }}>
              {/* Payment Type Selection */}
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '10px', fontWeight: 600, color: '#374151' }}>
                  Payment Type
                </label>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button
                    type="button"
                    onClick={() => setPaymentData({ ...paymentData, paymentType: 'interest' })}
                    style={{
                      flex: 1,
                      padding: '14px 10px',
                      border: paymentData.paymentType === 'interest' ? '2px solid #10b981' : '2px solid #e5e7eb',
                      borderRadius: '10px',
                      background: paymentData.paymentType === 'interest' ? '#dcfce7' : 'white',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                  >
                    <div style={{ fontSize: '24px', marginBottom: '6px' }}>💵</div>
                    <div style={{ fontWeight: 700, fontSize: '14px', color: paymentData.paymentType === 'interest' ? '#059669' : '#374151' }}>
                      Only Interest
                    </div>
                    <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '4px' }}>
                      Monthly interest
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentData({ ...paymentData, paymentType: 'settled' })}
                    style={{
                      flex: 1,
                      padding: '14px 10px',
                      border: paymentData.paymentType === 'settled' ? '2px solid #f59e0b' : '2px solid #e5e7eb',
                      borderRadius: '10px',
                      background: paymentData.paymentType === 'settled' ? '#fef3c7' : 'white',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                  >
                    <div style={{ fontSize: '24px', marginBottom: '6px' }}>✅</div>
                    <div style={{ fontWeight: 700, fontSize: '14px', color: paymentData.paymentType === 'settled' ? '#d97706' : '#374151' }}>
                      Settled
                    </div>
                    <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '4px' }}>
                      Full principal paid
                    </div>
                  </button>
                </div>
              </div>

              {/* Interest Amount Input - Only show if payment type is 'interest' */}
              {paymentData.paymentType === 'interest' && (
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', marginBottom: '6px', fontWeight: 600, color: '#374151' }}>
                    💰 Interest Amount Collected
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={paymentData.interestAmount}
                    onChange={(e) => {
                      const value = e.target.value.replace(/[^0-9]/g, '');
                      setPaymentData({ ...paymentData, interestAmount: value });
                    }}
                    placeholder="Interest amount"
                    autoComplete="off"
                    style={{
                      width: '100%',
                      padding: '12px',
                      border: '2px solid #e5e7eb',
                      borderRadius: '8px',
                      fontSize: '18px',
                      fontWeight: 600
                    }}
                  />
                  <div style={{ marginTop: '8px', fontSize: '12px', color: '#6b7280' }}>
                    Principal: ₹{(selectedEntry?.principal_amount || selectedEntry?.amount || 0).toLocaleString('en-IN')} × {selectedEntry?.interest_rate || 0}% = ₹{Math.round((selectedEntry?.principal_amount || selectedEntry?.amount || 0) * (selectedEntry?.interest_rate || 0) / 100).toLocaleString('en-IN')}/month
                  </div>
                </div>
              )}

              {/* Settled Confirmation - Only show if payment type is 'settled' */}
              {paymentData.paymentType === 'settled' && (
                <div style={{
                  marginBottom: '16px',
                  padding: '16px',
                  background: '#fef3c7',
                  borderRadius: '10px',
                  border: '2px solid #fcd34d'
                }}>
                  <div style={{ fontSize: '14px', fontWeight: 600, color: '#92400e', marginBottom: '8px' }}>
                    ⚠️ Settle this loan?
                  </div>
                  <div style={{ fontSize: '13px', color: '#78350f' }}>
                    This will mark <strong>{selectedEntry?.name}</strong>'s loan as fully settled.
                  </div>
                  <div style={{ fontSize: '13px', color: '#78350f', marginTop: '6px' }}>
                    Principal: <strong>₹{(selectedEntry?.principal_amount || selectedEntry?.amount || 0).toLocaleString('en-IN')}</strong> returned.
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                style={{
                  width: '100%',
                  background: paymentData.paymentType === 'settled'
                    ? 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)'
                    : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  color: 'white',
                  border: 'none',
                  padding: '14px',
                  borderRadius: '8px',
                  fontWeight: 700,
                  fontSize: '16px',
                  cursor: isSubmitting ? 'not-allowed' : 'pointer',
                  opacity: isSubmitting ? 0.6 : 1
                }}
              >
                {isSubmitting ? 'Processing...' : paymentData.paymentType === 'settled' ? '✓ Mark as Settled' : '✓ Record Interest'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Acknowledgment Upload Modal */}
      {showAcknowledgmentModal && selectedEntryForAck && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10001
          }}
          onClick={() => {
            setShowAcknowledgmentModal(false);
            setSelectedEntryForAck(null);
          }}
        >
          <div
            style={{
              background: 'white',
              borderRadius: '12px',
              maxWidth: '400px',
              width: '90%',
              boxShadow: '0 10px 40px rgba(0, 0, 0, 0.3)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{
              padding: '16px',
              background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
              color: 'white',
              borderRadius: '12px 12px 0 0'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>
                  📷 Upload Signed Acknowledgment
                </h3>
                <button
                  onClick={() => {
                    setShowAcknowledgmentModal(false);
                    setSelectedEntryForAck(null);
                  }}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'white',
                    fontSize: '24px',
                    cursor: 'pointer'
                  }}
                >
                  ×
                </button>
              </div>
              <div style={{ marginTop: '8px', fontSize: '14px', opacity: 0.9 }}>
                {selectedEntryForAck.name}
              </div>
            </div>

            <div style={{ padding: '20px' }}>
              <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '16px' }}>
                Upload the signed acknowledgment document received from the customer. This will be stored for legal purposes.
              </p>

              {selectedEntryForAck.signed_acknowledgment ? (
                <div style={{ marginBottom: '16px' }}>
                  <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '8px' }}>
                    Current signed acknowledgment:
                  </div>
                  <img
                    src={selectedEntryForAck.signed_acknowledgment}
                    alt="Signed Acknowledgment"
                    style={{
                      width: '100%',
                      borderRadius: '8px',
                      border: '2px solid #e5e7eb'
                    }}
                  />
                </div>
              ) : null}

              <input
                type="file"
                accept="image/*"
                id="acknowledgmentUpload"
                style={{ display: 'none' }}
                onChange={(e) => {
                  const file = e.target.files[0];
                  if (file) handleUploadAcknowledgment(file);
                }}
              />

              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  onClick={() => document.getElementById('acknowledgmentUpload').click()}
                  style={{
                    flex: 1,
                    padding: '12px',
                    background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  📁 Choose File
                </button>
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  id="acknowledgmentCapture"
                  style={{ display: 'none' }}
                  onChange={(e) => {
                    const file = e.target.files[0];
                    if (file) handleUploadAcknowledgment(file);
                  }}
                />
                <button
                  onClick={() => document.getElementById('acknowledgmentCapture').click()}
                  style={{
                    flex: 1,
                    padding: '12px',
                    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  📷 Camera
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Thermal Print Receipt Modal */}
      {printReceiptData && (
        <PrintReceipt
          type="payment"
          data={printReceiptData}
          onClose={() => setPrintReceiptData(null)}
        />
      )}
    </div>
  );
};

export default VaddiList;
