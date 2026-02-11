import { useState, useEffect, useRef, useCallback } from 'react';
import useSWR from 'swr';
import { API_URL } from '../config';
import { storage } from '../firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import PrintReceipt from './PrintReceipt';

const fetcher = (url) => fetch(url).then(res => res.json());

// ─── Helpers ────────────────────────────────────────────────────────────────
const formatCurrency = (amt) => {
  if (!amt && amt !== 0) return '\u20B90';
  return `\u20B9${Number(amt).toLocaleString('en-IN')}`;
};

const formatDate = (d) => {
  if (!d) return '-';
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

const VEHICLE_ICONS = {
  bike: '🏍️',
  scooter: '🛵',
  car: '🚗',
  auto: '🛺',
};

const ADMIN_PHONE = '918667510724';

// ─── Component ──────────────────────────────────────────────────────────────
function AutoFinanceDashboard({ navigateTo }) {

  // ── Core data via SWR ───────────────────────────────────────────────────
  const { data: customers = [], mutate, isLoading } = useSWR(
    `${API_URL}/auto-finance/customers`,
    fetcher,
    { refreshInterval: 30000, revalidateOnFocus: true }
  );
  const { data: stats } = useSWR(
    `${API_URL}/auto-finance/stats`,
    fetcher,
    { refreshInterval: 30000 }
  );
  const { data: overdueList = [] } = useSWR(
    `${API_URL}/auto-finance/overdue`,
    fetcher,
    { refreshInterval: 60000 }
  );

  // ── UI state ────────────────────────────────────────────────────────────
  const [showSidebar, setShowSidebar] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [vehicleFilter, setVehicleFilter] = useState('all');

  // Add customer modal – multi-step
  const [showAddModal, setShowAddModal] = useState(false);
  const [addStep, setAddStep] = useState(1);
  const [newCustomer, setNewCustomer] = useState({
    name: '', phone: '', address: '', aadhaar: '', pan: '',
    guarantor_name: '', guarantor_phone: '', guarantor_aadhaar: '',
    vehicle_type: 'bike', make: '', model: '', year: '', reg_number: '', color: '',
    vehicle_price: '', down_payment: '', interest_rate: '', tenure_months: '12',
    document_charge: '', processing_fee: '',
    insurance_expiry: '',
  });
  const [docFiles, setDocFiles] = useState({
    aadhaar_front: null, aadhaar_back: null, pan_card: null,
    rc_book: null, insurance: null, photo: null,
  });
  const [docUrls, setDocUrls] = useState({});
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Detail view
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [customerPayments, setCustomerPayments] = useState([]);
  const [customerDocs, setCustomerDocs] = useState({});
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Payment modal
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentForm, setPaymentForm] = useState({
    amount: '', date: new Date().toISOString().split('T')[0],
    mode: 'Cash', late_fee: '', notes: '',
  });
  const [paymentSubmitting, setPaymentSubmitting] = useState(false);

  // EMI schedule
  const [showEmiSchedule, setShowEmiSchedule] = useState(false);
  const [emiScheduleData, setEmiScheduleData] = useState([]);
  const [loadingEmi, setLoadingEmi] = useState(false);

  // Foreclosure
  const [showForeclosure, setShowForeclosure] = useState(false);
  const [foreclosurePenalty, setForeclosurePenalty] = useState('2');
  const [foreclosureResult, setForeclosureResult] = useState(null);
  const [foreclosureLoading, setForeclosureLoading] = useState(false);

  // WhatsApp
  const [showWhatsApp, setShowWhatsApp] = useState(false);
  const [whatsAppData, setWhatsAppData] = useState(null);

  // Print
  const [showPrintReceipt, setShowPrintReceipt] = useState(false);
  const [printData, setPrintData] = useState(null);

  // Overdue section
  const [showOverdue, setShowOverdue] = useState(false);

  // Reports
  const [showReports, setShowReports] = useState(false);
  const [reportsData, setReportsData] = useState(null);
  const [reportsLoading, setReportsLoading] = useState(false);
  const [reportsMonth, setReportsMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  // Delete
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Edit
  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [editSubmitting, setEditSubmitting] = useState(false);

  // Document preview
  const [previewDoc, setPreviewDoc] = useState(null);

  // ── Fetch detail when customer selected ─────────────────────────────────
  useEffect(() => {
    if (!selectedCustomer) return;
    setLoadingDetail(true);
    Promise.all([
      fetch(`${API_URL}/auto-finance/customers/${selectedCustomer.id}/payments`).then(r => r.json()),
      fetch(`${API_URL}/auto-finance/customers/${selectedCustomer.id}/documents`).then(r => r.json()),
    ]).then(([payments, docs]) => {
      setCustomerPayments(Array.isArray(payments) ? payments : []);
      setCustomerDocs(docs && typeof docs === 'object' ? docs : {});
    }).catch(() => {
      setCustomerPayments([]);
      setCustomerDocs({});
    }).finally(() => setLoadingDetail(false));
  }, [selectedCustomer]);

  // ── Filtered customers ──────────────────────────────────────────────────
  const filteredCustomers = customers.filter(c => {
    const matchSearch = !searchTerm ||
      (c.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (c.phone || '').includes(searchTerm) ||
      (c.reg_number || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchVehicle = vehicleFilter === 'all' || c.vehicle_type === vehicleFilter;
    return matchSearch && matchVehicle;
  });

  // ── EMI calculator (live) ───────────────────────────────────────────────
  const calculateEmi = useCallback(() => {
    const price = parseFloat(newCustomer.vehicle_price) || 0;
    const dp = parseFloat(newCustomer.down_payment) || 0;
    const rate = parseFloat(newCustomer.interest_rate) || 0;
    const months = parseInt(newCustomer.tenure_months) || 12;
    const principal = price - dp;
    const totalInterest = principal * (rate / 100) * (months / 12);
    const totalPayable = principal + totalInterest;
    const emi = months > 0 ? totalPayable / months : 0;
    return { principal, totalInterest, totalPayable, emi };
  }, [newCustomer.vehicle_price, newCustomer.down_payment, newCustomer.interest_rate, newCustomer.tenure_months, newCustomer.document_charge, newCustomer.processing_fee]);

  // ── Upload documents to Firebase ────────────────────────────────────────
  const uploadDocuments = async () => {
    const urls = {};
    for (const [key, file] of Object.entries(docFiles)) {
      if (file) {
        const storageRef = ref(storage, `auto-finance/${newCustomer.phone}/${key}_${Date.now()}`);
        const snapshot = await uploadBytes(storageRef, file);
        urls[key] = await getDownloadURL(snapshot.ref);
      }
    }
    return urls;
  };

  // ── Submit new customer ─────────────────────────────────────────────────
  const handleAddCustomer = async () => {
    setSubmitting(true);
    try {
      let documentUrls = { ...docUrls };
      // Upload any remaining docs
      const freshUrls = await uploadDocuments();
      documentUrls = { ...documentUrls, ...freshUrls };

      const emiCalc = calculateEmi();
      const body = {
        name: newCustomer.name,
        phone: newCustomer.phone,
        address: newCustomer.address,
        aadhaar_number: newCustomer.aadhaar || '',
        pan_number: newCustomer.pan || '',
        guarantor_name: newCustomer.guarantor_name || '',
        guarantor_phone: newCustomer.guarantor_phone || '',
        guarantor_aadhaar: newCustomer.guarantor_aadhaar || '',
        vehicle_type: newCustomer.vehicle_type || 'bike',
        vehicle_make: newCustomer.make || '',
        vehicle_model: newCustomer.model || '',
        vehicle_year: parseInt(newCustomer.year) || new Date().getFullYear(),
        vehicle_reg_number: newCustomer.reg_number || '',
        vehicle_color: newCustomer.color || '',
        vehicle_price: parseFloat(newCustomer.vehicle_price) || 0,
        down_payment: parseFloat(newCustomer.down_payment) || 0,
        interest_rate: parseFloat(newCustomer.interest_rate) || 0,
        tenure_months: parseInt(newCustomer.tenure_months) || 12,
        document_charge: parseFloat(newCustomer.document_charge) || 0,
        processing_fee: parseFloat(newCustomer.processing_fee) || 0,
        start_date: newCustomer.start_date || '',
        loan_given_date: newCustomer.loan_given_date || '',
        insurance_expiry: newCustomer.insurance_expiry || '',
        loan_amount: emiCalc.principal,
        total_interest: emiCalc.totalInterest,
        total_payable: emiCalc.totalPayable,
        emi_amount: Math.round(emiCalc.emi),
        documents: documentUrls,
      };

      const res = await fetch(`${API_URL}/auto-finance/customers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        mutate();
        setShowAddModal(false);
        setAddStep(1);
        setNewCustomer({
          name: '', phone: '', address: '', aadhaar: '', pan: '',
          guarantor_name: '', guarantor_phone: '', guarantor_aadhaar: '',
          vehicle_type: 'bike', make: '', model: '', year: '', reg_number: '', color: '',
          vehicle_price: '', down_payment: '', interest_rate: '', tenure_months: '12',
          document_charge: '', processing_fee: '', insurance_expiry: '',
        });
        setDocFiles({ aadhaar_front: null, aadhaar_back: null, pan_card: null, rc_book: null, insurance: null, photo: null });
        setDocUrls({});
      } else {
        const err = await res.json().catch(() => ({}));
        alert(err.error || 'Failed to add customer');
      }
    } catch (e) {
      console.error(e);
      alert('Error adding customer');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Mark payment ────────────────────────────────────────────────────────
  const handleMarkPayment = async () => {
    if (!selectedCustomer) return;
    setPaymentSubmitting(true);
    try {
      const body = {
        amount: parseFloat(paymentForm.amount) || 0,
        date: paymentForm.date,
        mode: paymentForm.mode,
        late_fee: parseFloat(paymentForm.late_fee) || 0,
        notes: paymentForm.notes,
      };
      const res = await fetch(`${API_URL}/auto-finance/customers/${selectedCustomer.id}/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        const result = await res.json();
        mutate();
        // Refresh detail
        const payments = await fetch(`${API_URL}/auto-finance/customers/${selectedCustomer.id}/payments`).then(r => r.json());
        setCustomerPayments(Array.isArray(payments) ? payments : []);
        // Update selected customer balance
        const updatedCustomers = await fetch(`${API_URL}/auto-finance/customers`).then(r => r.json());
        const updated = (updatedCustomers || []).find(c => c.id === selectedCustomer.id);
        if (updated) setSelectedCustomer(updated);

        setShowPaymentModal(false);

        // Prepare WhatsApp / Print data
        const paidCount = (Array.isArray(payments) ? payments : []).length;
        const wpData = {
          name: selectedCustomer.name,
          vehicle_make: selectedCustomer.make,
          vehicle_model: selectedCustomer.model,
          emi_number: paidCount,
          tenure_months: selectedCustomer.tenure_months,
          amount: body.amount,
          date: formatDate(body.date),
          balance: updated ? updated.balance : selectedCustomer.balance - body.amount,
        };
        setWhatsAppData(wpData);

        setPrintData({
          type: 'auto_finance_payment',
          data: {
            customerName: selectedCustomer.name,
            phone: selectedCustomer.phone,
            vehicleName: `${selectedCustomer.make} ${selectedCustomer.model}`,
            vehicleReg: selectedCustomer.reg_number,
            emiNumber: paidCount,
            amount: body.amount,
            balance: updated ? updated.balance : selectedCustomer.balance - body.amount,
            date: body.date,
            loanAmount: selectedCustomer.loan_amount,
            totalPayable: selectedCustomer.total_payable,
          },
        });

        setShowWhatsApp(true);
      } else {
        const err = await res.json().catch(() => ({}));
        alert(err.error || 'Payment failed');
      }
    } catch (e) {
      console.error(e);
      alert('Error recording payment');
    } finally {
      setPaymentSubmitting(false);
    }
  };

  // ── Load EMI schedule ───────────────────────────────────────────────────
  const loadEmiSchedule = async () => {
    if (!selectedCustomer) return;
    setLoadingEmi(true);
    try {
      const data = await fetch(`${API_URL}/auto-finance/customers/${selectedCustomer.id}/emi-schedule`).then(r => r.json());
      setEmiScheduleData(Array.isArray(data) ? data : (data.schedule || []));
    } catch {
      setEmiScheduleData([]);
    } finally {
      setLoadingEmi(false);
    }
  };

  // ── Foreclosure ─────────────────────────────────────────────────────────
  const handleForeclosure = async () => {
    if (!selectedCustomer) return;
    setForeclosureLoading(true);
    try {
      const res = await fetch(`${API_URL}/auto-finance/customers/${selectedCustomer.id}/foreclose`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ penalty_percent: parseFloat(foreclosurePenalty) || 2 }),
      });
      if (res.ok) {
        const result = await res.json();
        setForeclosureResult(result);
      } else {
        alert('Foreclosure calculation failed');
      }
    } catch {
      alert('Error calculating foreclosure');
    } finally {
      setForeclosureLoading(false);
    }
  };

  // ── Delete customer ─────────────────────────────────────────────────────
  const handleDelete = async () => {
    if (!selectedCustomer) return;
    setDeleting(true);
    try {
      const res = await fetch(`${API_URL}/auto-finance/customers/${selectedCustomer.id}`, { method: 'DELETE' });
      if (res.ok) {
        mutate();
        setSelectedCustomer(null);
        setShowDeleteConfirm(false);
      } else {
        alert('Delete failed');
      }
    } catch {
      alert('Error deleting customer');
    } finally {
      setDeleting(false);
    }
  };

  // ── Edit customer ───────────────────────────────────────────────────────
  const openEdit = () => {
    setEditForm({
      name: selectedCustomer.name || '',
      phone: selectedCustomer.phone || '',
      address: selectedCustomer.address || '',
      aadhaar: selectedCustomer.aadhaar || '',
      pan: selectedCustomer.pan || '',
      guarantor_name: selectedCustomer.guarantor_name || '',
      guarantor_phone: selectedCustomer.guarantor_phone || '',
      guarantor_aadhaar: selectedCustomer.guarantor_aadhaar || '',
      vehicle_type: selectedCustomer.vehicle_type || 'bike',
      make: selectedCustomer.make || '',
      model: selectedCustomer.model || '',
      year: selectedCustomer.year || '',
      reg_number: selectedCustomer.reg_number || '',
      color: selectedCustomer.color || '',
    });
    setShowEditModal(true);
  };

  const handleEditSubmit = async () => {
    setEditSubmitting(true);
    try {
      const res = await fetch(`${API_URL}/auto-finance/customers/${selectedCustomer.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      });
      if (res.ok) {
        mutate();
        const updatedCustomers = await fetch(`${API_URL}/auto-finance/customers`).then(r => r.json());
        const updated = (updatedCustomers || []).find(c => c.id === selectedCustomer.id);
        if (updated) setSelectedCustomer(updated);
        setShowEditModal(false);
      } else {
        alert('Update failed');
      }
    } catch {
      alert('Error updating customer');
    } finally {
      setEditSubmitting(false);
    }
  };

  // ── Reports fetch ───────────────────────────────────────────────────────
  const loadReports = async () => {
    setReportsLoading(true);
    try {
      const data = await fetch(`${API_URL}/auto-finance/reports?month=${reportsMonth}`).then(r => r.json());
      setReportsData(data);
    } catch {
      setReportsData(null);
    } finally {
      setReportsLoading(false);
    }
  };

  // ── WhatsApp message builder (Tamil) ────────────────────────────────────
  const buildWhatsAppMessage = (d) => {
    return encodeURIComponent(
      `\uD83D\uDE97 *\u0BB5\u0BBE\u0B95\u0BA9 \u0B95\u0B9F\u0BA9\u0BCD - EMI \u0BAA\u0BA3\u0BAE\u0BCD \u0B9A\u0BC6\u0BB2\u0BC1\u0BA4\u0BCD\u0BA4\u0BAA\u0BCD\u0BAA\u0B9F\u0BCD\u0B9F\u0BA4\u0BC1*\n\n` +
      `\uD83D\uDC64 \u0BB5\u0BBE\u0B9F\u0BBF\u0B95\u0BCD\u0B95\u0BC8\u0BAF\u0BBE\u0BB3\u0BB0\u0BCD: ${d.name}\n` +
      `\uD83C\uDFCD\uFE0F \u0BB5\u0BBE\u0B95\u0BA9\u0BAE\u0BCD: ${d.vehicle_make} ${d.vehicle_model}\n` +
      `\uD83D\uDCCB EMI \u0B8E\u0BA3\u0BCD: ${d.emi_number}/${d.tenure_months}\n` +
      `\uD83D\uDCB0 \u0BA4\u0BCA\u0B95\u0BC8: \u20B9${Number(d.amount).toLocaleString('en-IN')}\n` +
      `\uD83D\uDCC5 \u0BA4\u0BC7\u0BA4\u0BBF: ${d.date}\n` +
      `\uD83D\uDCB3 \u0B87\u0BB0\u0BC1\u0BAA\u0BCD\u0BAA\u0BC1: \u20B9${Number(d.balance).toLocaleString('en-IN')}\n\n` +
      `\u0BA8\u0BA9\u0BCD\u0BB1\u0BBF! - Om Sai Murugan Finance`
    );
  };

  // ── Overdue WhatsApp reminder (Tamil) ───────────────────────────────────
  const buildOverdueReminder = (c) => {
    return encodeURIComponent(
      `\uD83D\uDE97 *\u0BB5\u0BBE\u0B95\u0BA9 \u0B95\u0B9F\u0BA9\u0BCD - EMI \u0BA8\u0BBF\u0BB2\u0BC1\u0BB5\u0BC8 \u0BA4\u0BCA\u0B95\u0BC8 \u0B85\u0BB1\u0BBF\u0BB5\u0BBF\u0BAA\u0BCD\u0BAA\u0BC1*\n\n` +
      `\uD83D\uDC64 ${c.name}\n` +
      `\uD83C\uDFCD\uFE0F ${c.make || ''} ${c.model || ''}\n` +
      `\u26A0\uFE0F \u0BA8\u0BBF\u0BB2\u0BC1\u0BB5\u0BC8\u0BA4\u0BCD \u0BA4\u0BCA\u0B95\u0BC8: \u20B9${Number(c.overdue_amount || 0).toLocaleString('en-IN')}\n` +
      `\uD83D\uDCC5 \u0B95\u0B9F\u0BA8\u0BCD\u0BA4 \u0BA8\u0BBE\u0B9F\u0BCD\u0B95\u0BB3\u0BCD: ${c.days_overdue || 0}\n\n` +
      `\u0BA4\u0BAF\u0BB5\u0BC1\u0B9A\u0BC6\u0BAF\u0BCD\u0BA4\u0BC1 \u0B89\u0B9F\u0BA9\u0BC7 \u0B9A\u0BC6\u0BB2\u0BC1\u0BA4\u0BCD\u0BA4\u0BB5\u0BC1\u0BAE\u0BCD.\n- Om Sai Murugan Finance`
    );
  };

  // ── Shared inline styles ────────────────────────────────────────────────
  const modalOverlay = {
    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex',
    alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: '10px',
  };
  const modalBox = {
    background: '#fff', borderRadius: '16px', width: '100%', maxWidth: '500px',
    maxHeight: '90vh', overflowY: 'auto', padding: '20px', position: 'relative',
  };
  const inputStyle = {
    width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: '8px',
    fontSize: '14px', outline: 'none', boxSizing: 'border-box',
  };
  const labelStyle = {
    display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '4px',
  };
  const btnPrimary = {
    padding: '10px 20px', background: 'linear-gradient(135deg, #0d9488, #14b8a6)',
    color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 600,
    cursor: 'pointer', fontSize: '14px',
  };
  const btnSecondary = {
    padding: '10px 20px', background: '#e5e7eb', color: '#374151',
    border: 'none', borderRadius: '8px', fontWeight: 600, cursor: 'pointer', fontSize: '14px',
  };
  const btnDanger = {
    padding: '10px 20px', background: '#ef4444', color: '#fff',
    border: 'none', borderRadius: '8px', fontWeight: 600, cursor: 'pointer', fontSize: '14px',
  };
  const sidebarBtn = {
    width: '100%', padding: '10px 14px', background: 'transparent', color: 'white',
    border: 'none', textAlign: 'left', cursor: 'pointer', fontSize: '13px', fontWeight: 600,
  };

  // ════════════════════════════════════════════════════════════════════════
  //  R E N D E R
  // ════════════════════════════════════════════════════════════════════════

  // ── If detail view is open ──────────────────────────────────────────────
  if (selectedCustomer) {
    const sc = selectedCustomer;
    const paidEmis = customerPayments.length;
    const totalEmis = sc.tenure_months || 0;
    const progressPct = totalEmis > 0 ? Math.min(100, (paidEmis / totalEmis) * 100) : 0;

    return (
      <div style={{ minHeight: '100vh', background: '#f0fdfa' }}>
        {/* ── Detail Header ────────────────────────────────────── */}
        <div style={{
          background: 'linear-gradient(135deg, #0d9488, #065f46)',
          padding: '16px 16px 20px', color: '#fff',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <button onClick={() => { setSelectedCustomer(null); setCustomerPayments([]); setCustomerDocs({}); }}
              style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff', borderRadius: '8px', padding: '8px 14px', cursor: 'pointer', fontWeight: 600, fontSize: '13px' }}>
              \u2190 Back
            </button>
            <div style={{
              padding: '4px 12px', borderRadius: '20px', fontSize: '11px', fontWeight: 700,
              background: sc.status === 'active' ? '#22c55e' : sc.status === 'defaulted' ? '#ef4444' : '#6b7280',
            }}>
              {(sc.status || 'active').toUpperCase()}
            </div>
          </div>
          <h2 style={{ margin: '12px 0 2px', fontSize: '20px' }}>{sc.name}</h2>
          <div style={{ fontSize: '13px', opacity: 0.85 }}>
            {VEHICLE_ICONS[sc.vehicle_type] || '\uD83D\uDE97'} {sc.make} {sc.model} &middot; {sc.reg_number}
          </div>
        </div>

        <div style={{ padding: '16px' }}>

          {loadingDetail && <div style={{ textAlign: 'center', padding: '20px', color: '#6b7280' }}>Loading...</div>}

          {/* ── Customer Info Card ────────────────────────────── */}
          <div style={{ background: '#fff', borderRadius: '12px', padding: '14px', marginBottom: '12px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
            <h4 style={{ margin: '0 0 8px', color: '#0d9488', fontSize: '13px' }}>Customer Info</h4>
            <div style={{ fontSize: '13px', lineHeight: 1.8, color: '#374151' }}>
              <div><strong>Phone:</strong> <a href={`tel:${sc.phone}`} style={{ color: '#0d9488' }}>{sc.phone}</a></div>
              {sc.aadhaar && <div><strong>Aadhaar:</strong> {sc.aadhaar}</div>}
              {sc.pan && <div><strong>PAN:</strong> {sc.pan}</div>}
              {sc.address && <div><strong>Address:</strong> {sc.address}</div>}
              {sc.guarantor_name && (
                <>
                  <div style={{ borderTop: '1px solid #e5e7eb', margin: '6px 0', paddingTop: '6px' }}>
                    <strong>Guarantor:</strong> {sc.guarantor_name}
                  </div>
                  {sc.guarantor_phone && <div><strong>Guarantor Ph:</strong> {sc.guarantor_phone}</div>}
                  {sc.guarantor_aadhaar && <div><strong>Guarantor Aadhaar:</strong> {sc.guarantor_aadhaar}</div>}
                </>
              )}
            </div>
          </div>

          {/* ── Vehicle Info Card ─────────────────────────────── */}
          <div style={{ background: '#fff', borderRadius: '12px', padding: '14px', marginBottom: '12px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
            <h4 style={{ margin: '0 0 8px', color: '#0d9488', fontSize: '13px' }}>Vehicle Info</h4>
            <div style={{ fontSize: '13px', lineHeight: 1.8, color: '#374151' }}>
              <div style={{ fontSize: '28px', textAlign: 'center', marginBottom: '6px' }}>{VEHICLE_ICONS[sc.vehicle_type] || '\uD83D\uDE97'}</div>
              <div><strong>Type:</strong> {(sc.vehicle_type || '').charAt(0).toUpperCase() + (sc.vehicle_type || '').slice(1)}</div>
              <div><strong>Make / Model:</strong> {sc.make} {sc.model}</div>
              {sc.year && <div><strong>Year:</strong> {sc.year}</div>}
              <div><strong>Reg Number:</strong> {sc.reg_number}</div>
              {sc.color && <div><strong>Color:</strong> {sc.color}</div>}
            </div>
          </div>

          {/* ── Loan Summary Card ─────────────────────────────── */}
          <div style={{ background: '#fff', borderRadius: '12px', padding: '14px', marginBottom: '12px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
            <h4 style={{ margin: '0 0 8px', color: '#0d9488', fontSize: '13px' }}>Loan Summary</h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '13px' }}>
              <div><span style={{ color: '#6b7280' }}>Loan Amount</span><br /><strong>{formatCurrency(sc.loan_amount)}</strong></div>
              <div><span style={{ color: '#6b7280' }}>Interest Rate</span><br /><strong>{sc.interest_rate}%</strong></div>
              <div><span style={{ color: '#6b7280' }}>Tenure</span><br /><strong>{sc.tenure_months} months</strong></div>
              <div><span style={{ color: '#6b7280' }}>EMI</span><br /><strong style={{ color: '#0d9488' }}>{formatCurrency(sc.emi_amount)}</strong></div>
              <div><span style={{ color: '#6b7280' }}>Total Payable</span><br /><strong>{formatCurrency(sc.total_payable)}</strong></div>
              <div><span style={{ color: '#6b7280' }}>Balance</span><br /><strong style={{ color: (sc.balance || 0) > 0 ? '#dc2626' : '#22c55e' }}>{formatCurrency(sc.balance)}</strong></div>
            </div>
            {/* Progress bar */}
            <div style={{ marginTop: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#6b7280', marginBottom: '4px' }}>
                <span>EMIs Paid: {paidEmis}/{totalEmis}</span>
                <span>{Math.round(progressPct)}%</span>
              </div>
              <div style={{ background: '#e5e7eb', borderRadius: '6px', height: '8px', overflow: 'hidden' }}>
                <div style={{ width: `${progressPct}%`, height: '100%', background: 'linear-gradient(90deg, #0d9488, #14b8a6)', borderRadius: '6px', transition: 'width 0.3s' }} />
              </div>
            </div>
          </div>

          {/* ── Actions Row ───────────────────────────────────── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginBottom: '12px' }}>
            {/* Mark Payment */}
            <button onClick={() => {
              setPaymentForm({ amount: String(sc.emi_amount || ''), date: new Date().toISOString().split('T')[0], mode: 'Cash', late_fee: '', notes: '' });
              setShowPaymentModal(true);
            }} style={{ padding: '10px 6px', background: '#0d9488', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}>
              \uD83D\uDCB0 Payment
            </button>
            {/* EMI Schedule */}
            <button onClick={() => { loadEmiSchedule(); setShowEmiSchedule(true); }}
              style={{ padding: '10px 6px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}>
              \uD83D\uDCC5 EMI Schedule
            </button>
            {/* WhatsApp */}
            <button onClick={() => {
              const msg = encodeURIComponent(`Hi ${sc.name}, your EMI of ${formatCurrency(sc.emi_amount)} is due. Please pay at your earliest. - Om Sai Murugan Finance`);
              window.open(`https://wa.me/${sc.phone?.replace(/\D/g, '')}?text=${msg}`, '_blank');
            }} style={{ padding: '10px 6px', background: '#22c55e', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}>
              \uD83D\uDCF1 WhatsApp
            </button>
            {/* Print */}
            <button onClick={() => {
              setPrintData({
                type: 'auto_finance_payment',
                data: {
                  customerName: sc.name, phone: sc.phone,
                  vehicleName: `${sc.make} ${sc.model}`, vehicleReg: sc.reg_number,
                  emiNumber: paidEmis, amount: sc.emi_amount, balance: sc.balance,
                  date: new Date().toISOString(), loanAmount: sc.loan_amount, totalPayable: sc.total_payable,
                },
              });
              setShowPrintReceipt(true);
            }} style={{ padding: '10px 6px', background: '#8b5cf6', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}>
              \uD83D\uDDA8\uFE0F Print
            </button>
            {/* Foreclosure */}
            <button onClick={() => { setForeclosureResult(null); setForeclosurePenalty('2'); setShowForeclosure(true); }}
              style={{ padding: '10px 6px', background: '#f59e0b', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}>
              \uD83D\uDD10 Foreclose
            </button>
            {/* Edit */}
            <button onClick={openEdit}
              style={{ padding: '10px 6px', background: '#6366f1', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}>
              \u270F\uFE0F Edit
            </button>
            {/* Delete */}
            <button onClick={() => setShowDeleteConfirm(true)}
              style={{ padding: '10px 6px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '11px', fontWeight: 600, cursor: 'pointer', gridColumn: 'span 3' }}>
              \uD83D\uDDD1\uFE0F Delete Customer
            </button>
          </div>

          {/* ── Payment History Table ─────────────────────────── */}
          <div style={{ background: '#fff', borderRadius: '12px', padding: '14px', marginBottom: '12px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
            <h4 style={{ margin: '0 0 10px', color: '#0d9488', fontSize: '13px' }}>Payment History</h4>
            {customerPayments.length === 0 ? (
              <div style={{ textAlign: 'center', color: '#9ca3af', padding: '16px', fontSize: '13px' }}>No payments yet</div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                  <thead>
                    <tr style={{ background: '#f0fdfa' }}>
                      <th style={{ padding: '8px 6px', textAlign: 'left', color: '#065f46', fontWeight: 600 }}>EMI#</th>
                      <th style={{ padding: '8px 6px', textAlign: 'left', color: '#065f46', fontWeight: 600 }}>Date</th>
                      <th style={{ padding: '8px 6px', textAlign: 'right', color: '#065f46', fontWeight: 600 }}>Amount</th>
                      <th style={{ padding: '8px 6px', textAlign: 'center', color: '#065f46', fontWeight: 600 }}>Mode</th>
                      <th style={{ padding: '8px 6px', textAlign: 'right', color: '#065f46', fontWeight: 600 }}>Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {customerPayments.map((p, i) => (
                      <tr key={p.id || i} style={{ borderBottom: '1px solid #f3f4f6' }}>
                        <td style={{ padding: '8px 6px' }}>{i + 1}</td>
                        <td style={{ padding: '8px 6px' }}>{formatDate(p.date)}</td>
                        <td style={{ padding: '8px 6px', textAlign: 'right', fontWeight: 600 }}>{formatCurrency(p.amount)}</td>
                        <td style={{ padding: '8px 6px', textAlign: 'center' }}>{p.mode || '-'}</td>
                        <td style={{ padding: '8px 6px', textAlign: 'right' }}>{formatCurrency(p.balance_after)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* ── Documents ─────────────────────────────────────── */}
          {customerDocs && Object.keys(customerDocs).length > 0 && (
            <div style={{ background: '#fff', borderRadius: '12px', padding: '14px', marginBottom: '12px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
              <h4 style={{ margin: '0 0 10px', color: '#0d9488', fontSize: '13px' }}>Documents</h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                {Object.entries(customerDocs).map(([key, url]) => (
                  url && (
                    <div key={key} onClick={() => setPreviewDoc(url)}
                      style={{ cursor: 'pointer', textAlign: 'center' }}>
                      <div style={{
                        width: '100%', paddingBottom: '100%', borderRadius: '8px',
                        background: `url(${url}) center/cover no-repeat`, border: '1px solid #e5e7eb',
                        position: 'relative',
                      }} />
                      <div style={{ fontSize: '10px', color: '#6b7280', marginTop: '4px' }}>
                        {key.replace(/_/g, ' ')}
                      </div>
                    </div>
                  )
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ═══════ DETAIL-VIEW MODALS ═══════════════════════════════ */}

        {/* ── Payment Modal ─────────────────────────────────── */}
        {showPaymentModal && (
          <div style={modalOverlay} onClick={() => setShowPaymentModal(false)}>
            <div style={modalBox} onClick={e => e.stopPropagation()}>
              <h3 style={{ margin: '0 0 16px', color: '#0d9488', fontSize: '16px' }}>\uD83D\uDCB0 Mark Payment</h3>

              <div style={{ marginBottom: '12px' }}>
                <label style={labelStyle}>Amount *</label>
                <input type="number" value={paymentForm.amount}
                  onChange={e => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                  style={inputStyle} placeholder="EMI Amount" />
              </div>
              <div style={{ marginBottom: '12px' }}>
                <label style={labelStyle}>Date</label>
                <input type="date" value={paymentForm.date}
                  onChange={e => setPaymentForm({ ...paymentForm, date: e.target.value })}
                  style={inputStyle} />
              </div>
              <div style={{ marginBottom: '12px' }}>
                <label style={labelStyle}>Payment Mode</label>
                <select value={paymentForm.mode}
                  onChange={e => setPaymentForm({ ...paymentForm, mode: e.target.value })}
                  style={inputStyle}>
                  <option>Cash</option>
                  <option>UPI</option>
                  <option>Bank Transfer</option>
                  <option>Cheque</option>
                </select>
              </div>
              <div style={{ marginBottom: '12px' }}>
                <label style={labelStyle}>Late Fee (optional)</label>
                <input type="number" value={paymentForm.late_fee}
                  onChange={e => setPaymentForm({ ...paymentForm, late_fee: e.target.value })}
                  style={inputStyle} placeholder="0" />
              </div>
              <div style={{ marginBottom: '16px' }}>
                <label style={labelStyle}>Notes (optional)</label>
                <input type="text" value={paymentForm.notes}
                  onChange={e => setPaymentForm({ ...paymentForm, notes: e.target.value })}
                  style={inputStyle} placeholder="Any notes..." />
              </div>

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button onClick={() => setShowPaymentModal(false)} style={btnSecondary}>Cancel</button>
                <button onClick={handleMarkPayment} disabled={paymentSubmitting || !paymentForm.amount}
                  style={{ ...btnPrimary, opacity: (paymentSubmitting || !paymentForm.amount) ? 0.6 : 1 }}>
                  {paymentSubmitting ? 'Saving...' : 'Record Payment'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── EMI Schedule Modal ────────────────────────────── */}
        {showEmiSchedule && (
          <div style={modalOverlay} onClick={() => setShowEmiSchedule(false)}>
            <div style={{ ...modalBox, maxWidth: '600px' }} onClick={e => e.stopPropagation()}>
              <h3 style={{ margin: '0 0 4px', color: '#0d9488', fontSize: '16px' }}>\uD83D\uDCC5 EMI Schedule</h3>
              <p style={{ margin: '0 0 12px', fontSize: '12px', color: '#6b7280' }}>
                {sc.make} {sc.model} - {sc.reg_number}
              </p>

              {loadingEmi ? (
                <div style={{ textAlign: 'center', padding: '30px', color: '#6b7280' }}>Loading schedule...</div>
              ) : (
                <>
                  {/* Summary */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px', marginBottom: '14px' }}>
                    {[
                      { label: 'Total', value: emiScheduleData.length, color: '#374151' },
                      { label: 'Paid', value: emiScheduleData.filter(e => e.status === 'paid').length, color: '#22c55e' },
                      { label: 'Remaining', value: emiScheduleData.filter(e => e.status === 'upcoming').length, color: '#3b82f6' },
                      { label: 'Overdue', value: emiScheduleData.filter(e => e.status === 'overdue').length, color: '#ef4444' },
                    ].map(s => (
                      <div key={s.label} style={{ textAlign: 'center', padding: '8px', background: '#f9fafb', borderRadius: '8px' }}>
                        <div style={{ fontSize: '18px', fontWeight: 700, color: s.color }}>{s.value}</div>
                        <div style={{ fontSize: '10px', color: '#6b7280' }}>{s.label}</div>
                      </div>
                    ))}
                  </div>

                  {/* EMI Grid */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px', maxHeight: '50vh', overflowY: 'auto' }}>
                    {emiScheduleData.map((emi, i) => {
                      const bg = emi.status === 'paid' ? '#dcfce7' : emi.status === 'overdue' ? '#fee2e2' : '#f3f4f6';
                      const border = emi.status === 'paid' ? '#22c55e' : emi.status === 'overdue' ? '#ef4444' : '#d1d5db';
                      return (
                        <div key={i} style={{
                          padding: '8px 6px', borderRadius: '8px', background: bg,
                          border: `1px solid ${border}`, textAlign: 'center', fontSize: '11px',
                        }}>
                          <div style={{ fontWeight: 700, marginBottom: '2px' }}>EMI {emi.emi_number || i + 1}</div>
                          <div style={{ color: '#6b7280', fontSize: '10px' }}>
                            {emi.status === 'paid' && formatDate(emi.paid_date)}
                            {emi.status === 'overdue' && `${emi.days_overdue || 0}d late`}
                            {emi.status === 'upcoming' && formatDate(emi.due_date)}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}

              <div style={{ marginTop: '14px', textAlign: 'right' }}>
                <button onClick={() => setShowEmiSchedule(false)} style={btnSecondary}>Close</button>
              </div>
            </div>
          </div>
        )}

        {/* ── WhatsApp Modal (after payment) ───────────────── */}
        {showWhatsApp && whatsAppData && (
          <div style={modalOverlay} onClick={() => setShowWhatsApp(false)}>
            <div style={modalBox} onClick={e => e.stopPropagation()}>
              <h3 style={{ margin: '0 0 12px', color: '#22c55e', fontSize: '16px' }}>\u2705 Payment Recorded!</h3>

              <div style={{ background: '#f0fdf4', borderRadius: '10px', padding: '14px', marginBottom: '14px', fontSize: '13px', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
                {`\uD83D\uDE97 \u0BB5\u0BBE\u0B95\u0BA9 \u0B95\u0B9F\u0BA9\u0BCD - EMI \u0BAA\u0BA3\u0BAE\u0BCD \u0B9A\u0BC6\u0BB2\u0BC1\u0BA4\u0BCD\u0BA4\u0BAA\u0BCD\u0BAA\u0B9F\u0BCD\u0B9F\u0BA4\u0BC1\n\n\uD83D\uDC64 \u0BB5\u0BBE\u0B9F\u0BBF\u0B95\u0BCD\u0B95\u0BC8\u0BAF\u0BBE\u0BB3\u0BB0\u0BCD: ${whatsAppData.name}\n\uD83C\uDFCD\uFE0F \u0BB5\u0BBE\u0B95\u0BA9\u0BAE\u0BCD: ${whatsAppData.vehicle_make} ${whatsAppData.vehicle_model}\n\uD83D\uDCCB EMI \u0B8E\u0BA3\u0BCD: ${whatsAppData.emi_number}/${whatsAppData.tenure_months}\n\uD83D\uDCB0 \u0BA4\u0BCA\u0B95\u0BC8: ${formatCurrency(whatsAppData.amount)}\n\uD83D\uDCC5 \u0BA4\u0BC7\u0BA4\u0BBF: ${whatsAppData.date}\n\uD83D\uDCB3 \u0B87\u0BB0\u0BC1\u0BAA\u0BCD\u0BAA\u0BC1: ${formatCurrency(whatsAppData.balance)}\n\n\u0BA8\u0BA9\u0BCD\u0BB1\u0BBF! - Om Sai Murugan Finance`}
              </div>

              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <button onClick={() => {
                  const msg = buildWhatsAppMessage(whatsAppData);
                  window.open(`https://wa.me/${ADMIN_PHONE}?text=${msg}`, '_blank');
                }} style={{ ...btnPrimary, background: '#22c55e', flex: 1 }}>
                  \uD83D\uDCF1 Send WhatsApp
                </button>
                <button onClick={() => { setShowWhatsApp(false); setShowPrintReceipt(true); }}
                  style={{ ...btnPrimary, background: '#8b5cf6', flex: 1 }}>
                  \uD83D\uDDA8\uFE0F Print Receipt
                </button>
                <button onClick={() => setShowWhatsApp(false)} style={{ ...btnSecondary, flex: '0 0 100%' }}>
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Print Receipt ─────────────────────────────────── */}
        {showPrintReceipt && printData && (
          <PrintReceipt
            type="auto_finance_payment"
            data={printData}
            onClose={() => setShowPrintReceipt(false)}
          />
        )}

        {/* ── Foreclosure Modal ─────────────────────────────── */}
        {showForeclosure && (
          <div style={modalOverlay} onClick={() => setShowForeclosure(false)}>
            <div style={modalBox} onClick={e => e.stopPropagation()}>
              <h3 style={{ margin: '0 0 14px', color: '#f59e0b', fontSize: '16px' }}>\uD83D\uDD10 Foreclosure Calculator</h3>

              {/* Existing info */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '14px' }}>
                {[
                  { label: 'Total Payable', value: formatCurrency(sc.total_payable) },
                  { label: 'Total Paid', value: formatCurrency((sc.total_payable || 0) - (sc.balance || 0)) },
                  { label: 'Current Balance', value: formatCurrency(sc.balance) },
                  { label: 'Remaining Principal', value: formatCurrency(sc.loan_amount ? sc.loan_amount - ((sc.total_payable || 0) - (sc.balance || 0)) * (sc.loan_amount / (sc.total_payable || 1)) : 0) },
                ].map((item, idx) => (
                  <div key={idx} style={{ background: '#fffbeb', borderRadius: '8px', padding: '10px', textAlign: 'center' }}>
                    <div style={{ fontSize: '10px', color: '#92400e' }}>{item.label}</div>
                    <div style={{ fontSize: '14px', fontWeight: 700, color: '#78350f' }}>{item.value}</div>
                  </div>
                ))}
              </div>

              <div style={{ marginBottom: '14px' }}>
                <label style={labelStyle}>Penalty % (on remaining principal)</label>
                <input type="number" value={foreclosurePenalty}
                  onChange={e => setForeclosurePenalty(e.target.value)}
                  style={inputStyle} placeholder="2" />
              </div>

              <button onClick={handleForeclosure} disabled={foreclosureLoading}
                style={{ ...btnPrimary, background: '#f59e0b', width: '100%', marginBottom: '14px' }}>
                {foreclosureLoading ? 'Calculating...' : 'Calculate Foreclosure'}
              </button>

              {foreclosureResult && (
                <div style={{ background: '#fef3c7', borderRadius: '10px', padding: '14px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '10px', color: '#92400e' }}>Foreclosure Amount</div>
                      <div style={{ fontSize: '18px', fontWeight: 700, color: '#78350f' }}>{formatCurrency(foreclosureResult.foreclosure_amount)}</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '10px', color: '#92400e' }}>Savings vs Full EMI</div>
                      <div style={{ fontSize: '18px', fontWeight: 700, color: '#15803d' }}>{formatCurrency(foreclosureResult.savings)}</div>
                    </div>
                  </div>
                </div>
              )}

              <div style={{ marginTop: '14px', textAlign: 'right' }}>
                <button onClick={() => setShowForeclosure(false)} style={btnSecondary}>Close</button>
              </div>
            </div>
          </div>
        )}

        {/* ── Edit Modal ────────────────────────────────────── */}
        {showEditModal && (
          <div style={modalOverlay} onClick={() => setShowEditModal(false)}>
            <div style={modalBox} onClick={e => e.stopPropagation()}>
              <h3 style={{ margin: '0 0 14px', color: '#6366f1', fontSize: '16px' }}>\u270F\uFE0F Edit Customer</h3>
              {[
                { key: 'name', label: 'Name' },
                { key: 'phone', label: 'Phone' },
                { key: 'address', label: 'Address' },
                { key: 'aadhaar', label: 'Aadhaar' },
                { key: 'pan', label: 'PAN' },
                { key: 'guarantor_name', label: 'Guarantor Name' },
                { key: 'guarantor_phone', label: 'Guarantor Phone' },
                { key: 'guarantor_aadhaar', label: 'Guarantor Aadhaar' },
                { key: 'make', label: 'Make' },
                { key: 'model', label: 'Model' },
                { key: 'year', label: 'Year' },
                { key: 'reg_number', label: 'Reg Number' },
                { key: 'color', label: 'Color' },
              ].map(f => (
                <div key={f.key} style={{ marginBottom: '10px' }}>
                  <label style={labelStyle}>{f.label}</label>
                  <input type="text" value={editForm[f.key] || ''}
                    onChange={e => setEditForm({ ...editForm, [f.key]: e.target.value })}
                    style={inputStyle} />
                </div>
              ))}
              <div style={{ marginBottom: '10px' }}>
                <label style={labelStyle}>Vehicle Type</label>
                <select value={editForm.vehicle_type || 'bike'}
                  onChange={e => setEditForm({ ...editForm, vehicle_type: e.target.value })}
                  style={inputStyle}>
                  <option value="bike">Bike</option>
                  <option value="scooter">Scooter</option>
                  <option value="car">Car</option>
                  <option value="auto">Auto</option>
                </select>
              </div>
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '14px' }}>
                <button onClick={() => setShowEditModal(false)} style={btnSecondary}>Cancel</button>
                <button onClick={handleEditSubmit} disabled={editSubmitting}
                  style={{ ...btnPrimary, background: '#6366f1', opacity: editSubmitting ? 0.6 : 1 }}>
                  {editSubmitting ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Delete Confirm Modal ──────────────────────────── */}
        {showDeleteConfirm && (
          <div style={modalOverlay} onClick={() => setShowDeleteConfirm(false)}>
            <div style={{ ...modalBox, maxWidth: '380px', textAlign: 'center' }} onClick={e => e.stopPropagation()}>
              <div style={{ fontSize: '48px', marginBottom: '10px' }}>\u26A0\uFE0F</div>
              <h3 style={{ margin: '0 0 8px', color: '#dc2626' }}>Delete Customer?</h3>
              <p style={{ color: '#6b7280', fontSize: '13px', marginBottom: '20px' }}>
                This will permanently delete <strong>{sc.name}</strong> and all associated data.
                This action cannot be undone.
              </p>
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
                <button onClick={() => setShowDeleteConfirm(false)} style={btnSecondary}>Cancel</button>
                <button onClick={handleDelete} disabled={deleting}
                  style={{ ...btnDanger, opacity: deleting ? 0.6 : 1 }}>
                  {deleting ? 'Deleting...' : 'Yes, Delete'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Document Preview Modal ────────────────────────── */}
        {previewDoc && (
          <div style={{ ...modalOverlay, background: 'rgba(0,0,0,0.85)' }} onClick={() => setPreviewDoc(null)}>
            <div style={{ maxWidth: '90vw', maxHeight: '90vh' }} onClick={e => e.stopPropagation()}>
              <img src={previewDoc} alt="Document"
                style={{ maxWidth: '100%', maxHeight: '85vh', borderRadius: '8px' }} />
              <div style={{ textAlign: 'center', marginTop: '10px' }}>
                <button onClick={() => setPreviewDoc(null)} style={{ ...btnSecondary, color: '#fff', background: 'rgba(255,255,255,0.2)' }}>Close</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ════════════════════════════════════════════════════════════════════════
  //  M A I N   D A S H B O A R D   V I E W
  // ════════════════════════════════════════════════════════════════════════
  return (
    <div style={{ minHeight: '100vh', background: '#f0fdfa' }}>

      {/* ═══════ SIDEBAR ═══════════════════════════════════════════════ */}
      <div style={{
        position: 'fixed', left: showSidebar ? '0' : '-280px', top: 0,
        width: '280px', height: '100vh',
        background: 'linear-gradient(180deg, #1e293b 0%, #0f172a 100%)',
        transition: 'left 0.3s ease', zIndex: 1000,
        boxShadow: '2px 0 10px rgba(0,0,0,0.3)',
      }}>
        <div style={{ padding: '14px', borderBottom: '1px solid #334155' }}>
          <h3 style={{ color: '#14b8a6', margin: 0, fontSize: '16px' }}>🚗 AUTO FINANCE</h3>
          <p style={{ color: '#94a3b8', margin: '3px 0 0', fontSize: '10px' }}>OM SAI MURUGAN</p>
        </div>
        <div style={{ padding: '6px 0' }}>
          <button onClick={() => { setShowSidebar(false); setShowOverdue(false); setShowReports(false); }}
            style={sidebarBtn}>
            🏠 Dashboard
          </button>
          <button onClick={() => { setShowSidebar(false); setShowAddModal(true); setAddStep(1); }}
            style={sidebarBtn}>
            ➕ Add Customer
          </button>
          <button onClick={() => { setShowSidebar(false); setShowOverdue(true); setShowReports(false); }}
            style={sidebarBtn}>
            ⚠️ Overdue ({overdueList.length})
          </button>
          <button onClick={() => { setShowSidebar(false); setShowReports(true); setShowOverdue(false); loadReports(); }}
            style={sidebarBtn}>
            📊 Reports
          </button>
          <div style={{ borderTop: '1px solid #334155', margin: '10px 0' }} />
          <button onClick={() => navigateTo('/')}
            style={{ ...sidebarBtn, color: '#f59e0b' }}>
            ← Module Selector
          </button>
        </div>
      </div>

      {/* Sidebar overlay */}
      {showSidebar && (
        <div onClick={() => setShowSidebar(false)}
          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.3)', zIndex: 999 }} />
      )}

      {/* ═══════ HEADER ════════════════════════════════════════════════ */}
      <div style={{
        background: 'linear-gradient(135deg, #0d9488 0%, #065f46 100%)',
        padding: '14px 16px 16px', color: '#fff',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
          <button onClick={() => setShowSidebar(true)}
            style={{ background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff', borderRadius: '8px', padding: '8px 10px', cursor: 'pointer', fontSize: '18px' }}>
            ☰
          </button>
          <h1 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>🚗 Auto Finance</h1>
        </div>
        <input
          type="text"
          placeholder="Search by name, phone, or reg number..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          style={{
            width: '100%', padding: '10px 14px', borderRadius: '10px',
            border: 'none', fontSize: '14px', outline: 'none',
            background: 'rgba(255,255,255,0.15)', color: '#fff',
            boxSizing: 'border-box',
          }}
        />
      </div>

      <div style={{ padding: '16px' }}>

        {/* ═══════ OVERDUE SECTION ═════════════════════════════════════ */}
        {showOverdue && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <h2 style={{ margin: 0, fontSize: '16px', color: '#dc2626' }}>\u26A0\uFE0F Overdue Customers</h2>
              <button onClick={() => setShowOverdue(false)} style={{ ...btnSecondary, padding: '6px 14px', fontSize: '12px' }}>Back</button>
            </div>
            {overdueList.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: '#22c55e', fontSize: '15px' }}>
                \u2705 No overdue customers!
              </div>
            ) : (
              overdueList.map(c => (
                <div key={c.id} style={{
                  background: '#fff', borderRadius: '12px', padding: '14px',
                  marginBottom: '10px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
                  borderLeft: '4px solid #ef4444',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '14px', color: '#1f2937' }}>{c.name}</div>
                      <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '2px' }}>
                        {VEHICLE_ICONS[c.vehicle_type] || '\uD83D\uDE97'} {c.make} {c.model} - {c.reg_number}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '11px', color: '#ef4444', fontWeight: 700 }}>{c.days_overdue || 0} days</div>
                      <div style={{ fontSize: '11px', color: '#6b7280' }}>{c.missed_emis || 0} missed</div>
                    </div>
                  </div>
                  <div style={{ fontSize: '15px', fontWeight: 700, color: '#dc2626', marginTop: '6px' }}>
                    Overdue: {formatCurrency(c.overdue_amount)}
                  </div>
                  <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                    <a href={`tel:${c.phone}`}
                      style={{ flex: 1, padding: '8px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: '8px', textAlign: 'center', textDecoration: 'none', fontSize: '12px', fontWeight: 600 }}>
                      \uD83D\uDCDE Call
                    </a>
                    <button onClick={() => {
                      const msg = buildOverdueReminder(c);
                      window.open(`https://wa.me/${(c.phone || '').replace(/\D/g, '')}?text=${msg}`, '_blank');
                    }} style={{ flex: 1, padding: '8px', background: '#22c55e', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>
                      \uD83D\uDCF1 WhatsApp
                    </button>
                    <button onClick={() => {
                      const found = customers.find(cu => cu.id === c.id);
                      if (found) setSelectedCustomer(found);
                    }} style={{ flex: 1, padding: '8px', background: '#0d9488', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>
                      View
                    </button>
                  </div>
                </div>
              ))
            )}
          </>
        )}

        {/* ═══════ REPORTS SECTION ═════════════════════════════════════ */}
        {showReports && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <h2 style={{ margin: 0, fontSize: '16px', color: '#0d9488' }}>\uD83D\uDCCA Reports</h2>
              <button onClick={() => setShowReports(false)} style={{ ...btnSecondary, padding: '6px 14px', fontSize: '12px' }}>Back</button>
            </div>
            <div style={{ marginBottom: '14px' }}>
              <label style={labelStyle}>Select Month</label>
              <input type="month" value={reportsMonth}
                onChange={e => { setReportsMonth(e.target.value); }}
                style={inputStyle} />
              <button onClick={loadReports} style={{ ...btnPrimary, marginTop: '8px', width: '100%' }}>
                {reportsLoading ? 'Loading...' : 'Generate Report'}
              </button>
            </div>
            {reportsData && (
              <div style={{ background: '#fff', borderRadius: '12px', padding: '14px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  {[
                    { label: 'Total Loans', value: reportsData.total_loans || 0 },
                    { label: 'Active Loans', value: reportsData.active_loans || 0 },
                    { label: 'New Loans', value: reportsData.new_loans || 0 },
                    { label: 'Closed Loans', value: reportsData.closed_loans || 0 },
                    { label: 'Collections', value: formatCurrency(reportsData.total_collected) },
                    { label: 'Pending', value: formatCurrency(reportsData.total_pending) },
                    { label: 'Total Disbursed', value: formatCurrency(reportsData.total_disbursed) },
                    { label: 'Interest Earned', value: formatCurrency(reportsData.interest_earned) },
                  ].map((item, idx) => (
                    <div key={idx} style={{ background: '#f0fdfa', borderRadius: '8px', padding: '10px', textAlign: 'center' }}>
                      <div style={{ fontSize: '10px', color: '#065f46' }}>{item.label}</div>
                      <div style={{ fontSize: '16px', fontWeight: 700, color: '#0d9488' }}>{item.value}</div>
                    </div>
                  ))}
                </div>

                {reportsData.collections_by_mode && (
                  <div style={{ marginTop: '14px' }}>
                    <h4 style={{ fontSize: '13px', color: '#065f46', marginBottom: '8px' }}>Collections by Mode</h4>
                    {Object.entries(reportsData.collections_by_mode).map(([mode, amount]) => (
                      <div key={mode} style={{
                        display: 'flex', justifyContent: 'space-between', padding: '6px 0',
                        borderBottom: '1px solid #e5e7eb', fontSize: '13px',
                      }}>
                        <span>{mode}</span>
                        <strong>{formatCurrency(amount)}</strong>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* ═══════ MAIN DASHBOARD (when not showing overdue/reports) ═══ */}
        {!showOverdue && !showReports && (
          <>
            {/* ── Summary Cards ─────────────────────────────────── */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '16px' }}>
              {/* Active Loans */}
              <div style={{
                background: '#fff', borderRadius: '12px', padding: '14px',
                boxShadow: '0 1px 4px rgba(0,0,0,0.06)', borderLeft: '4px solid #0d9488',
              }}>
                <div style={{ fontSize: '10px', color: '#6b7280', textTransform: 'uppercase', fontWeight: 600 }}>Active Loans</div>
                <div style={{ fontSize: '24px', fontWeight: 700, color: '#0d9488', marginTop: '4px' }}>
                  {stats?.activeLoans ?? customers.filter(c => c.status === 'active').length}
                </div>
              </div>
              {/* Monthly Collection Due */}
              <div style={{
                background: '#fff', borderRadius: '12px', padding: '14px',
                boxShadow: '0 1px 4px rgba(0,0,0,0.06)', borderLeft: '4px solid #3b82f6',
              }}>
                <div style={{ fontSize: '10px', color: '#6b7280', textTransform: 'uppercase', fontWeight: 600 }}>Monthly Due</div>
                <div style={{ fontSize: '24px', fontWeight: 700, color: '#3b82f6', marginTop: '4px' }}>
                  {formatCurrency(stats?.monthlyCollectionDue)}
                </div>
              </div>
              {/* Collected This Month */}
              <div style={{
                background: '#fff', borderRadius: '12px', padding: '14px',
                boxShadow: '0 1px 4px rgba(0,0,0,0.06)', borderLeft: '4px solid #22c55e',
              }}>
                <div style={{ fontSize: '10px', color: '#6b7280', textTransform: 'uppercase', fontWeight: 600 }}>Collected</div>
                <div style={{ fontSize: '24px', fontWeight: 700, color: '#22c55e', marginTop: '4px' }}>
                  {formatCurrency(stats?.collectedThisMonth)}
                </div>
              </div>
              {/* Overdue */}
              <div style={{
                background: '#fff', borderRadius: '12px', padding: '14px',
                boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
                borderLeft: `4px solid ${(stats?.overdueCount || overdueList.length) > 0 ? '#ef4444' : '#9ca3af'}`,
              }} onClick={() => setShowOverdue(true)}>
                <div style={{ fontSize: '10px', color: '#6b7280', textTransform: 'uppercase', fontWeight: 600 }}>Overdue</div>
                <div style={{
                  fontSize: '24px', fontWeight: 700, marginTop: '4px',
                  color: (stats?.overdueCount || overdueList.length) > 0 ? '#ef4444' : '#9ca3af',
                }}>
                  {stats?.overdueCount ?? overdueList.length}
                </div>
              </div>
            </div>

            {/* ── Vehicle Filter Tabs ──────────────────────────── */}
            <div style={{
              display: 'flex', gap: '6px', marginBottom: '14px',
              overflowX: 'auto', paddingBottom: '4px',
            }}>
              {[
                { key: 'all', label: 'All' },
                { key: 'bike', label: '\uD83C\uDFCD\uFE0F Bike' },
                { key: 'scooter', label: '\uD83D\uDEF5 Scooter' },
                { key: 'car', label: '\uD83D\uDE97 Car' },
                { key: 'auto', label: '\uD83D\uDEFA Auto' },
              ].map(tab => (
                <button key={tab.key} onClick={() => setVehicleFilter(tab.key)}
                  style={{
                    padding: '7px 14px', borderRadius: '20px', border: 'none',
                    fontSize: '12px', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
                    background: vehicleFilter === tab.key ? '#0d9488' : '#e5e7eb',
                    color: vehicleFilter === tab.key ? '#fff' : '#374151',
                  }}>
                  {tab.label}
                </button>
              ))}
            </div>

            {/* ── Customer List ─────────────────────────────────── */}
            {isLoading ? (
              <div style={{ textAlign: 'center', padding: '40px', color: '#6b7280' }}>Loading customers...</div>
            ) : filteredCustomers.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 20px' }}>
                <div style={{ fontSize: '40px', marginBottom: '10px' }}>\uD83D\uDE97</div>
                <div style={{ color: '#6b7280', fontSize: '14px' }}>
                  {searchTerm || vehicleFilter !== 'all' ? 'No matching customers found' : 'No customers yet. Add your first!'}
                </div>
                {!searchTerm && vehicleFilter === 'all' && (
                  <button onClick={() => { setShowAddModal(true); setAddStep(1); }}
                    style={{ ...btnPrimary, marginTop: '14px' }}>
                    \u2795 Add Customer
                  </button>
                )}
              </div>
            ) : (
              filteredCustomers.map(c => {
                const paidEmis = c.paid_emis || 0;
                const total = c.tenure_months || 1;
                const pct = Math.min(100, (paidEmis / total) * 100);
                const statusColor = c.status === 'active' ? '#22c55e' : c.status === 'defaulted' ? '#ef4444' : '#6b7280';

                return (
                  <div key={c.id} onClick={() => setSelectedCustomer(c)}
                    style={{
                      background: '#fff', borderRadius: '12px', padding: '14px',
                      marginBottom: '10px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
                      cursor: 'pointer', transition: 'box-shadow 0.2s',
                    }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '20px' }}>{VEHICLE_ICONS[c.vehicle_type] || '\uD83D\uDE97'}</span>
                          <div>
                            <div style={{ fontWeight: 700, fontSize: '14px', color: '#1f2937' }}>{c.name}</div>
                            <div style={{ fontSize: '11px', color: '#6b7280' }}>{c.phone}</div>
                          </div>
                        </div>
                        <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>
                          {c.make} {c.model} &middot; {c.reg_number}
                        </div>
                      </div>
                      <div style={{
                        padding: '3px 10px', borderRadius: '12px', fontSize: '10px',
                        fontWeight: 700, background: `${statusColor}20`, color: statusColor,
                      }}>
                        {(c.status || 'active').toUpperCase()}
                      </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px' }}>
                      <div>
                        <div style={{ fontSize: '11px', color: '#6b7280' }}>EMI</div>
                        <div style={{ fontSize: '15px', fontWeight: 700, color: '#0d9488' }}>{formatCurrency(c.emi_amount)}</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '11px', color: '#6b7280' }}>Balance</div>
                        <div style={{ fontSize: '15px', fontWeight: 700, color: '#dc2626' }}>{formatCurrency(c.balance)}</div>
                      </div>
                    </div>

                    {/* Progress bar */}
                    <div style={{ marginTop: '8px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#9ca3af', marginBottom: '3px' }}>
                        <span>Paid {paidEmis}/{total}</span>
                        <span>{Math.round(pct)}%</span>
                      </div>
                      <div style={{ background: '#e5e7eb', borderRadius: '4px', height: '6px', overflow: 'hidden' }}>
                        <div style={{
                          width: `${pct}%`, height: '100%',
                          background: pct >= 100 ? '#22c55e' : 'linear-gradient(90deg, #0d9488, #14b8a6)',
                          borderRadius: '4px', transition: 'width 0.3s',
                        }} />
                      </div>
                    </div>
                  </div>
                );
              })
            )}

            {/* FAB to add customer */}
            <button onClick={() => { setShowAddModal(true); setAddStep(1); }}
              style={{
                position: 'fixed', bottom: '24px', right: '24px',
                width: '56px', height: '56px', borderRadius: '50%',
                background: 'linear-gradient(135deg, #0d9488, #14b8a6)',
                color: '#fff', border: 'none', fontSize: '28px',
                boxShadow: '0 4px 16px rgba(13,148,136,0.4)',
                cursor: 'pointer', zIndex: 100, display: 'flex',
                alignItems: 'center', justifyContent: 'center',
              }}>
              +
            </button>
          </>
        )}
      </div>

      {/* ═══════ ADD CUSTOMER MODAL (6 Steps) ═════════════════════════ */}
      {showAddModal && (
        <div style={modalOverlay} onClick={() => setShowAddModal(false)}>
          <div style={{ ...modalBox, maxWidth: '520px' }} onClick={e => e.stopPropagation()}>
            {/* Step indicator */}
            <div style={{ display: 'flex', gap: '4px', marginBottom: '16px' }}>
              {[1, 2, 3, 4, 5, 6].map(s => (
                <div key={s} style={{
                  flex: 1, height: '4px', borderRadius: '2px',
                  background: s <= addStep ? '#0d9488' : '#e5e7eb',
                  transition: 'background 0.2s',
                }} />
              ))}
            </div>

            <h3 style={{ margin: '0 0 4px', color: '#0d9488', fontSize: '16px' }}>
              {addStep === 1 && '👤 Personal Details'}
              {addStep === 2 && '🤝 Guarantor Details'}
              {addStep === 3 && '🚗 Vehicle Details'}
              {addStep === 4 && '💰 Loan Details'}
              {addStep === 5 && '📄 Documents'}
              {addStep === 6 && '✅ Review & Confirm'}
            </h3>
            <p style={{ fontSize: '11px', color: '#9ca3af', marginTop: 0, marginBottom: '14px' }}>Step {addStep} of 6</p>

            {/* ── Step 1: Personal ──────────────────── */}
            {addStep === 1 && (
              <>
                <div style={{ marginBottom: '10px' }}>
                  <label style={labelStyle}>Name *</label>
                  <input type="text" value={newCustomer.name}
                    onChange={e => setNewCustomer({ ...newCustomer, name: e.target.value })}
                    style={inputStyle} placeholder="Full name" />
                </div>
                <div style={{ marginBottom: '10px' }}>
                  <label style={labelStyle}>Phone *</label>
                  <input type="tel" value={newCustomer.phone}
                    onChange={e => setNewCustomer({ ...newCustomer, phone: e.target.value })}
                    style={inputStyle} placeholder="10-digit mobile" />
                </div>
                <div style={{ marginBottom: '10px' }}>
                  <label style={labelStyle}>Address</label>
                  <input type="text" value={newCustomer.address}
                    onChange={e => setNewCustomer({ ...newCustomer, address: e.target.value })}
                    style={inputStyle} placeholder="Full address" />
                </div>
                <div style={{ marginBottom: '10px' }}>
                  <label style={labelStyle}>Aadhaar Number</label>
                  <input type="text" value={newCustomer.aadhaar}
                    onChange={e => setNewCustomer({ ...newCustomer, aadhaar: e.target.value })}
                    style={inputStyle} placeholder="12-digit Aadhaar" />
                </div>
                <div style={{ marginBottom: '10px' }}>
                  <label style={labelStyle}>PAN</label>
                  <input type="text" value={newCustomer.pan}
                    onChange={e => setNewCustomer({ ...newCustomer, pan: e.target.value.toUpperCase() })}
                    style={inputStyle} placeholder="ABCDE1234F" />
                </div>
              </>
            )}

            {/* ── Step 2: Guarantor ────────────────── */}
            {addStep === 2 && (
              <>
                <div style={{ marginBottom: '10px' }}>
                  <label style={labelStyle}>Guarantor Name</label>
                  <input type="text" value={newCustomer.guarantor_name}
                    onChange={e => setNewCustomer({ ...newCustomer, guarantor_name: e.target.value })}
                    style={inputStyle} placeholder="Guarantor full name" />
                </div>
                <div style={{ marginBottom: '10px' }}>
                  <label style={labelStyle}>Guarantor Phone</label>
                  <input type="tel" value={newCustomer.guarantor_phone}
                    onChange={e => setNewCustomer({ ...newCustomer, guarantor_phone: e.target.value })}
                    style={inputStyle} placeholder="Guarantor mobile" />
                </div>
                <div style={{ marginBottom: '10px' }}>
                  <label style={labelStyle}>Guarantor Aadhaar</label>
                  <input type="text" value={newCustomer.guarantor_aadhaar}
                    onChange={e => setNewCustomer({ ...newCustomer, guarantor_aadhaar: e.target.value })}
                    style={inputStyle} placeholder="Guarantor Aadhaar number" />
                </div>
              </>
            )}

            {/* ── Step 3: Vehicle ──────────────────── */}
            {addStep === 3 && (
              <>
                <div style={{ marginBottom: '10px' }}>
                  <label style={labelStyle}>Vehicle Type *</label>
                  <select value={newCustomer.vehicle_type}
                    onChange={e => setNewCustomer({ ...newCustomer, vehicle_type: e.target.value })}
                    style={inputStyle}>
                    <option value="bike">Bike</option>
                    <option value="scooter">Scooter</option>
                    <option value="car">Car</option>
                    <option value="auto">Auto</option>
                  </select>
                </div>
                <div style={{ marginBottom: '10px' }}>
                  <label style={labelStyle}>Make *</label>
                  <input type="text" value={newCustomer.make}
                    onChange={e => setNewCustomer({ ...newCustomer, make: e.target.value })}
                    style={inputStyle} placeholder="e.g. Honda, TVS, Bajaj" />
                </div>
                <div style={{ marginBottom: '10px' }}>
                  <label style={labelStyle}>Model *</label>
                  <input type="text" value={newCustomer.model}
                    onChange={e => setNewCustomer({ ...newCustomer, model: e.target.value })}
                    style={inputStyle} placeholder="e.g. Activa, Pulsar" />
                </div>
                <div style={{ marginBottom: '10px' }}>
                  <label style={labelStyle}>Year</label>
                  <input type="number" value={newCustomer.year}
                    onChange={e => setNewCustomer({ ...newCustomer, year: e.target.value })}
                    style={inputStyle} placeholder="2024" />
                </div>
                <div style={{ marginBottom: '10px' }}>
                  <label style={labelStyle}>Registration Number *</label>
                  <input type="text" value={newCustomer.reg_number}
                    onChange={e => setNewCustomer({ ...newCustomer, reg_number: e.target.value.toUpperCase() })}
                    style={inputStyle} placeholder="TN XX AB 1234" />
                </div>
                <div style={{ marginBottom: '10px' }}>
                  <label style={labelStyle}>Color</label>
                  <input type="text" value={newCustomer.color}
                    onChange={e => setNewCustomer({ ...newCustomer, color: e.target.value })}
                    style={inputStyle} placeholder="Vehicle color" />
                </div>
              </>
            )}

            {/* ── Step 4: Loan ─────────────────────── */}
            {addStep === 4 && (() => {
              const calc = calculateEmi();
              return (
                <>
                  <div style={{ marginBottom: '10px' }}>
                    <label style={labelStyle}>Vehicle Price *</label>
                    <input type="number" value={newCustomer.vehicle_price}
                      onChange={e => setNewCustomer({ ...newCustomer, vehicle_price: e.target.value })}
                      style={inputStyle} placeholder="Total vehicle price" />
                  </div>
                  <div style={{ marginBottom: '10px' }}>
                    <label style={labelStyle}>Down Payment *</label>
                    <input type="number" value={newCustomer.down_payment}
                      onChange={e => setNewCustomer({ ...newCustomer, down_payment: e.target.value })}
                      style={inputStyle} placeholder="Amount paid upfront" />
                  </div>
                  <div style={{ marginBottom: '10px' }}>
                    <label style={labelStyle}>Interest Rate (% per annum) *</label>
                    <input type="number" value={newCustomer.interest_rate} step="0.1"
                      onChange={e => setNewCustomer({ ...newCustomer, interest_rate: e.target.value })}
                      style={inputStyle} placeholder="e.g. 18" />
                  </div>
                  <div style={{ marginBottom: '10px' }}>
                    <label style={labelStyle}>Tenure (months) *</label>
                    <select value={newCustomer.tenure_months}
                      onChange={e => setNewCustomer({ ...newCustomer, tenure_months: e.target.value })}
                      style={inputStyle}>
                      {[6, 12, 18, 24, 36, 48].map(m => (
                        <option key={m} value={String(m)}>{m} months</option>
                      ))}
                    </select>
                  </div>
                  <div style={{ marginBottom: '10px' }}>
                    <label style={labelStyle}>Document Charge</label>
                    <input type="number" value={newCustomer.document_charge}
                      onChange={e => setNewCustomer({ ...newCustomer, document_charge: e.target.value })}
                      style={inputStyle} placeholder="0" />
                  </div>
                  <div style={{ marginBottom: '10px' }}>
                    <label style={labelStyle}>Processing Fee</label>
                    <input type="number" value={newCustomer.processing_fee}
                      onChange={e => setNewCustomer({ ...newCustomer, processing_fee: e.target.value })}
                      style={inputStyle} placeholder="0" />
                  </div>

                  {/* ── Live EMI Calculator ─────────────── */}
                  <div style={{
                    background: 'linear-gradient(135deg, #f0fdfa, #ccfbf1)', borderRadius: '12px',
                    padding: '14px', marginTop: '10px', border: '1px solid #99f6e4',
                  }}>
                    <h4 style={{ margin: '0 0 10px', color: '#065f46', fontSize: '13px' }}>\uD83E\uDDEE EMI Calculator</h4>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '13px' }}>
                      <div>
                        <div style={{ color: '#6b7280', fontSize: '10px' }}>Loan Amount</div>
                        <div style={{ fontWeight: 700, color: '#065f46' }}>{formatCurrency(calc.principal)}</div>
                      </div>
                      <div>
                        <div style={{ color: '#6b7280', fontSize: '10px' }}>Total Interest</div>
                        <div style={{ fontWeight: 700, color: '#065f46' }}>{formatCurrency(calc.totalInterest)}</div>
                      </div>
                      <div>
                        <div style={{ color: '#6b7280', fontSize: '10px' }}>Total Payable</div>
                        <div style={{ fontWeight: 700, color: '#065f46' }}>{formatCurrency(calc.totalPayable)}</div>
                      </div>
                      <div>
                        <div style={{ color: '#6b7280', fontSize: '10px' }}>Monthly EMI</div>
                        <div style={{ fontWeight: 700, color: '#0d9488', fontSize: '18px' }}>{formatCurrency(Math.round(calc.emi))}</div>
                      </div>
                    </div>
                  </div>
                </>
              );
            })()}

            {/* ── Step 5: Documents ─────────────────── */}
            {addStep === 5 && (
              <>
                {[
                  { key: 'aadhaar_front', label: 'Aadhaar Front' },
                  { key: 'aadhaar_back', label: 'Aadhaar Back' },
                  { key: 'pan_card', label: 'PAN Card' },
                  { key: 'rc_book', label: 'RC Book' },
                  { key: 'insurance', label: 'Insurance Copy' },
                  { key: 'photo', label: 'Customer Photo' },
                ].map(doc => (
                  <div key={doc.key} style={{ marginBottom: '12px' }}>
                    <label style={labelStyle}>{doc.label}</label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <input type="file" accept="image/*,.pdf"
                        onChange={async (e) => {
                          const file = e.target.files[0];
                          if (!file) return;
                          setDocFiles(prev => ({ ...prev, [doc.key]: file }));
                          // Immediately upload
                          if (newCustomer.phone) {
                            setUploading(true);
                            try {
                              const storageRef = ref(storage, `auto-finance/${newCustomer.phone}/${doc.key}_${Date.now()}`);
                              const snapshot = await uploadBytes(storageRef, file);
                              const url = await getDownloadURL(snapshot.ref);
                              setDocUrls(prev => ({ ...prev, [doc.key]: url }));
                            } catch (err) {
                              console.error('Upload error:', err);
                              alert(`Failed to upload ${doc.label}`);
                            } finally {
                              setUploading(false);
                            }
                          }
                        }}
                        style={{ fontSize: '12px', flex: 1 }} />
                      {docUrls[doc.key] && (
                        <span style={{ color: '#22c55e', fontSize: '16px' }}>\u2705</span>
                      )}
                    </div>
                  </div>
                ))}
                <div style={{ marginBottom: '10px' }}>
                  <label style={labelStyle}>Insurance Expiry Date</label>
                  <input type="date" value={newCustomer.insurance_expiry}
                    onChange={e => setNewCustomer({ ...newCustomer, insurance_expiry: e.target.value })}
                    style={inputStyle} />
                </div>
                {uploading && <div style={{ color: '#f59e0b', fontSize: '12px', marginBottom: '10px' }}>Uploading document...</div>}
                {!newCustomer.phone && (
                  <div style={{ color: '#ef4444', fontSize: '12px', marginBottom: '10px' }}>
                    Please enter phone number in Step 1 first to upload documents.
                  </div>
                )}
              </>
            )}

            {/* ── Step 6: Review & Confirm ─────────── */}
            {addStep === 6 && (() => {
              const calc = calculateEmi();
              return (
                <div style={{ fontSize: '13px', lineHeight: 1.8 }}>
                  <div style={{ background: '#f9fafb', borderRadius: '10px', padding: '12px', marginBottom: '10px' }}>
                    <h5 style={{ margin: '0 0 6px', color: '#0d9488' }}>Personal</h5>
                    <div><strong>Name:</strong> {newCustomer.name}</div>
                    <div><strong>Phone:</strong> {newCustomer.phone}</div>
                    {newCustomer.address && <div><strong>Address:</strong> {newCustomer.address}</div>}
                    {newCustomer.aadhaar && <div><strong>Aadhaar:</strong> {newCustomer.aadhaar}</div>}
                    {newCustomer.pan && <div><strong>PAN:</strong> {newCustomer.pan}</div>}
                  </div>

                  {newCustomer.guarantor_name && (
                    <div style={{ background: '#f9fafb', borderRadius: '10px', padding: '12px', marginBottom: '10px' }}>
                      <h5 style={{ margin: '0 0 6px', color: '#0d9488' }}>Guarantor</h5>
                      <div><strong>Name:</strong> {newCustomer.guarantor_name}</div>
                      {newCustomer.guarantor_phone && <div><strong>Phone:</strong> {newCustomer.guarantor_phone}</div>}
                      {newCustomer.guarantor_aadhaar && <div><strong>Aadhaar:</strong> {newCustomer.guarantor_aadhaar}</div>}
                    </div>
                  )}

                  <div style={{ background: '#f9fafb', borderRadius: '10px', padding: '12px', marginBottom: '10px' }}>
                    <h5 style={{ margin: '0 0 6px', color: '#0d9488' }}>Vehicle</h5>
                    <div>{VEHICLE_ICONS[newCustomer.vehicle_type] || '\uD83D\uDE97'} <strong>{newCustomer.make} {newCustomer.model}</strong></div>
                    {newCustomer.year && <div><strong>Year:</strong> {newCustomer.year}</div>}
                    <div><strong>Reg:</strong> {newCustomer.reg_number}</div>
                    {newCustomer.color && <div><strong>Color:</strong> {newCustomer.color}</div>}
                  </div>

                  <div style={{ background: '#f0fdfa', borderRadius: '10px', padding: '12px', marginBottom: '10px', border: '1px solid #99f6e4' }}>
                    <h5 style={{ margin: '0 0 6px', color: '#065f46' }}>Loan Summary</h5>
                    <div><strong>Vehicle Price:</strong> {formatCurrency(newCustomer.vehicle_price)}</div>
                    <div><strong>Down Payment:</strong> {formatCurrency(newCustomer.down_payment)}</div>
                    <div><strong>Interest Rate:</strong> {newCustomer.interest_rate}%</div>
                    <div><strong>Tenure:</strong> {newCustomer.tenure_months} months</div>
                    {newCustomer.document_charge && <div><strong>Doc Charge:</strong> {formatCurrency(newCustomer.document_charge)}</div>}
                    {newCustomer.processing_fee && <div><strong>Processing Fee:</strong> {formatCurrency(newCustomer.processing_fee)}</div>}
                    <div style={{ borderTop: '1px dashed #99f6e4', margin: '6px 0', paddingTop: '6px' }}>
                      <div><strong>Loan Amount:</strong> {formatCurrency(calc.principal)}</div>
                      <div><strong>Total Interest:</strong> {formatCurrency(calc.totalInterest)}</div>
                      <div><strong>Total Payable:</strong> {formatCurrency(calc.totalPayable)}</div>
                      <div style={{ fontSize: '16px', fontWeight: 700, color: '#0d9488', marginTop: '4px' }}>
                        EMI: {formatCurrency(Math.round(calc.emi))} /month
                      </div>
                    </div>
                  </div>

                  {Object.keys(docUrls).length > 0 && (
                    <div style={{ background: '#f9fafb', borderRadius: '10px', padding: '12px', marginBottom: '10px' }}>
                      <h5 style={{ margin: '0 0 6px', color: '#0d9488' }}>Documents Uploaded</h5>
                      {Object.keys(docUrls).map(k => (
                        <div key={k} style={{ color: '#22c55e', fontSize: '12px' }}>\u2705 {k.replace(/_/g, ' ')}</div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })()}

            {/* ── Navigation Buttons ───────────────── */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '16px' }}>
              {addStep > 1 ? (
                <button onClick={() => setAddStep(addStep - 1)} style={btnSecondary}>Previous</button>
              ) : (
                <button onClick={() => setShowAddModal(false)} style={btnSecondary}>Cancel</button>
              )}

              {addStep < 6 ? (
                <button onClick={() => {
                  // Validate required fields per step
                  if (addStep === 1 && (!newCustomer.name || !newCustomer.phone)) {
                    alert('Name and Phone are required');
                    return;
                  }
                  if (addStep === 3 && (!newCustomer.make || !newCustomer.model || !newCustomer.reg_number)) {
                    alert('Make, Model, and Reg Number are required');
                    return;
                  }
                  if (addStep === 4 && (!newCustomer.vehicle_price || !newCustomer.down_payment || !newCustomer.interest_rate)) {
                    alert('Vehicle Price, Down Payment, and Interest Rate are required');
                    return;
                  }
                  setAddStep(addStep + 1);
                }} style={btnPrimary}>
                  Next
                </button>
              ) : (
                <button onClick={handleAddCustomer} disabled={submitting}
                  style={{ ...btnPrimary, opacity: submitting ? 0.6 : 1 }}>
                  {submitting ? 'Adding...' : '\u2705 Confirm & Add'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AutoFinanceDashboard;
