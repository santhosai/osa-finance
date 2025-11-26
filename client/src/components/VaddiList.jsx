import { useState, useEffect } from 'react';
import useSWR from 'swr';
import { jsPDF } from 'jspdf';
import { API_URL } from '../config';

const fetcher = (url) => fetch(url).then(res => res.json());

const VaddiList = ({ navigateTo }) => {
  const [activeTab, setActiveTab] = useState('monthly'); // 'monthly' or 'grid'
  const [selectedDay, setSelectedDay] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({ name: '', amount: '', phone: '' });
  const [loading, setLoading] = useState(false);

  // Monthly View state
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState(null);
  const [paymentData, setPaymentData] = useState({ totalAmount: '', myShare: '', friendShare: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);

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
  const paidThisMonth = activeEntries.filter(e => paidEntryIds.has(e.id));
  const unpaidThisMonth = activeEntries.filter(e => !paidEntryIds.has(e.id));

  // Group entries by day
  const entriesByDay = {};
  for (let day = 1; day <= 31; day++) {
    entriesByDay[day] = safeEntries.filter(e => e.day === day);
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
    setFormData({ name: '', amount: '', phone: '' });
  };

  // Close modal
  const closeModal = () => {
    setShowModal(false);
    setSelectedDay(null);
    setFormData({ name: '', amount: '', phone: '' });
  };

  // Open payment modal
  const openPaymentModal = (entry) => {
    setSelectedEntry(entry);
    setPaymentData({
      totalAmount: entry.amount?.toString() || '',
      myShare: '',
      friendShare: ''
    });
    setShowPaymentModal(true);
  };

  // Close payment modal
  const closePaymentModal = () => {
    setShowPaymentModal(false);
    setSelectedEntry(null);
    setPaymentData({ totalAmount: '', myShare: '', friendShare: '' });
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

    const total = parseInt(paymentData.totalAmount) || 0;
    const myShare = parseInt(paymentData.myShare) || 0;
    const friendShare = parseInt(paymentData.friendShare) || 0;

    if (total <= 0 || myShare < 0 || friendShare < 0) {
      alert('Please enter valid amounts');
      return;
    }

    if (myShare + friendShare !== total) {
      alert('My Share + Friend Share must equal Total Amount');
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch(`${API_URL}/vaddi-entries/${selectedEntry.id}/monthly-payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          month: selectedMonth,
          totalAmount: total,
          myShare: myShare,
          friendShare: friendShare
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to record payment');
      }

      mutatePayments();
      mutateSummary();
      closePaymentModal();
      alert('Payment recorded successfully!');
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

  // Add new entry for selected day
  const handleAddEntry = async (e) => {
    e.preventDefault();

    // Prevent double submission
    if (loading) return;

    if (!formData.name || !formData.amount || !formData.phone) {
      alert('Please fill all fields');
      return;
    }

    if (formData.phone.length !== 10) {
      alert('Phone number must be 10 digits');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/vaddi-entries`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          day: selectedDay,
          name: formData.name,
          amount: parseInt(formData.amount),
          phone: formData.phone
        })
      });

      if (!response.ok) {
        throw new Error('Failed to add entry');
      }

      mutate();
      setFormData({ name: '', amount: '', phone: '' });
      alert('Entry added successfully!');
    } catch (error) {
      console.error('Error adding entry:', error);
      alert('Failed to add entry: ' + error.message);
    } finally {
      setLoading(false);
    }
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
    doc.text(`Vaddi Report - ${monthName}`, 105, 27, { align: 'center' });

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
    doc.text(`My Profit: ${formatCurrency(summary.myProfit)}`, 80, 65);
    doc.text(`Friend Share: ${formatCurrency(summary.friendShare)}`, 140, 65);
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
        doc.text(`Total: ${formatCurrency(payment?.totalAmount)}`, 100, yPos);
        doc.text(`My: ${formatCurrency(payment?.myShare)} | Friend: ${formatCurrency(payment?.friendShare)}`, 140, yPos);
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
        doc.text(`Interest: ${formatCurrency(entry.amount)}`, 120, yPos);
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
    doc.save(`Vaddi_Report_${selectedMonth}.pdf`);
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
            Vaddi List
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
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '24px', fontWeight: 700 }}>{formatCurrency(summary.totalCollected)}</div>
                <div style={{ fontSize: '12px', opacity: 0.8 }}>Total Collected</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '24px', fontWeight: 700, color: '#10b981' }}>{formatCurrency(summary.myProfit)}</div>
                <div style={{ fontSize: '12px', opacity: 0.8 }}>My Profit</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '24px', fontWeight: 700, color: '#f59e0b' }}>{formatCurrency(summary.friendShare)}</div>
                <div style={{ fontSize: '12px', opacity: 0.8 }}>Friend Share</div>
              </div>
            </div>
            <div style={{ marginTop: '12px', textAlign: 'center', fontSize: '13px', opacity: 0.9 }}>
              {paidThisMonth.length} Paid / {unpaidThisMonth.length} Unpaid
            </div>
            {/* PDF Export Button */}
            <button
              onClick={generatePDF}
              style={{
                marginTop: '14px',
                width: '100%',
                padding: '10px',
                background: 'rgba(255,255,255,0.2)',
                border: '2px solid rgba(255,255,255,0.4)',
                borderRadius: '8px',
                color: 'white',
                fontWeight: 700,
                fontSize: '14px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
            >
              📄 Download PDF Report
            </button>
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
                        <div>
                          <div style={{ fontWeight: 700, color: '#1e293b', marginBottom: '4px' }}>
                            {entry.name}
                          </div>
                          <div style={{ fontSize: '13px', color: '#059669', fontWeight: 600 }}>
                            {formatCurrency(entry.amount)} • Day {entry.day}
                          </div>
                        </div>
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
                          <div>
                            <div style={{ fontWeight: 700, color: '#1e293b', marginBottom: '4px' }}>
                              {entry.name}
                            </div>
                            <div style={{ fontSize: '13px', color: '#059669', fontWeight: 600 }}>
                              Total: {formatCurrency(payment?.totalAmount)} • Day {entry.day}
                            </div>
                            {payment && (
                              <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>
                                My: {formatCurrency(payment.myShare)} | Friend: {formatCurrency(payment.friendShare)}
                              </div>
                            )}
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
              📜 Vaddi Payment History
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
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
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
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '20px', fontWeight: 700 }}>
                    {formatCurrency(allMonthsSummary.reduce((sum, m) => sum + (m.friendShare || 0), 0))}
                  </div>
                  <div style={{ fontSize: '11px', opacity: 0.8 }}>Friend</div>
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
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
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
                        <div style={{ textAlign: 'center', padding: '8px', background: 'rgba(245, 158, 11, 0.1)', borderRadius: '8px' }}>
                          <div style={{ fontSize: '16px', fontWeight: 700, color: '#f59e0b' }}>
                            {formatCurrency(monthData.friendShare || 0)}
                          </div>
                          <div style={{ fontSize: '10px', color: '#6b7280' }}>Friend</div>
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

              {/* Add Entry Form */}
              <form onSubmit={handleAddEntry} style={{ marginBottom: '20px' }}>
                <div style={{ marginBottom: '12px' }}>
                  <label style={{ display: 'block', marginBottom: '6px', fontWeight: 600, color: '#374151', fontSize: '14px' }}>
                    👤 Name
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
                    💰 Monthly Interest Amount
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={formData.amount}
                    onChange={(e) => {
                      const value = e.target.value.replace(/[^0-9]/g, '');
                      setFormData({ ...formData, amount: value });
                    }}
                    placeholder="Amount in ₹"
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

                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', marginBottom: '6px', fontWeight: 600, color: '#374151', fontSize: '14px' }}>
                    📱 Mobile Number
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

                <button
                  type="submit"
                  disabled={loading}
                  style={{
                    width: '100%',
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
                  {loading ? 'Adding...' : '➕ Add Entry'}
                </button>
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
                                {formatCurrency(entry.amount)}
                              </div>
                              <div style={{ fontSize: '12px', color: '#6b7280' }}>
                                📱 {entry.phone}
                              </div>
                              {isSettled && entry.settledDate && (
                                <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '4px' }}>
                                  Settled: {entry.settledDate}
                                </div>
                              )}
                            </div>
                            <div style={{ display: 'flex', gap: '6px', flexDirection: 'column' }}>
                              {isSettled ? (
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
                              ) : (
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
                                  ✓ Full Settled
                                </button>
                              )}
                            </div>
                          </div>
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
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '6px', fontWeight: 600, color: '#374151' }}>
                  💰 Total Amount Collected
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={paymentData.totalAmount}
                  onChange={(e) => {
                    const value = e.target.value.replace(/[^0-9]/g, '');
                    setPaymentData({ ...paymentData, totalAmount: value });
                  }}
                  placeholder="Total amount"
                  autoComplete="off"
                  required
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: '2px solid #e5e7eb',
                    borderRadius: '8px',
                    fontSize: '16px'
                  }}
                />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '6px', fontWeight: 600, color: '#374151' }}>
                  👤 My Share
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={paymentData.myShare}
                  onChange={(e) => {
                    const value = e.target.value.replace(/[^0-9]/g, '');
                    setPaymentData({ ...paymentData, myShare: value });
                  }}
                  placeholder="Your share"
                  autoComplete="off"
                  required
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: '2px solid #e5e7eb',
                    borderRadius: '8px',
                    fontSize: '16px'
                  }}
                />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '6px', fontWeight: 600, color: '#374151' }}>
                  🤝 Friend Share
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={paymentData.friendShare}
                  onChange={(e) => {
                    const value = e.target.value.replace(/[^0-9]/g, '');
                    setPaymentData({ ...paymentData, friendShare: value });
                  }}
                  placeholder="Friend's share"
                  autoComplete="off"
                  required
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: '2px solid #e5e7eb',
                    borderRadius: '8px',
                    fontSize: '16px'
                  }}
                />
              </div>

              {/* Validation Message */}
              {paymentData.totalAmount && paymentData.myShare && paymentData.friendShare && (
                <div style={{
                  padding: '12px',
                  marginBottom: '16px',
                  borderRadius: '8px',
                  background: parseInt(paymentData.myShare) + parseInt(paymentData.friendShare) === parseInt(paymentData.totalAmount)
                    ? '#f0fdf4'
                    : '#fef2f2',
                  color: parseInt(paymentData.myShare) + parseInt(paymentData.friendShare) === parseInt(paymentData.totalAmount)
                    ? '#059669'
                    : '#dc2626',
                  fontSize: '13px',
                  fontWeight: 600
                }}>
                  {parseInt(paymentData.myShare) + parseInt(paymentData.friendShare) === parseInt(paymentData.totalAmount)
                    ? '✓ Shares add up correctly!'
                    : `✗ Shares (${formatCurrency(parseInt(paymentData.myShare || 0) + parseInt(paymentData.friendShare || 0))}) don't match total (${formatCurrency(parseInt(paymentData.totalAmount || 0))})`
                  }
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                style={{
                  width: '100%',
                  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
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
                {isSubmitting ? 'Recording...' : '✓ Record Payment'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default VaddiList;
