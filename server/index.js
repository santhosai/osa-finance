import express from 'express';
import cors from 'cors';
import db from './firestore.js';

const app = express();
const PORT = process.env.PORT || 3000;

// ⚡ DEPLOYMENT v4.0.0 - Jan 20, 2025 - UNIFIED LOAN SYSTEM (Weekly + Monthly)
// CONFIRMED: NO phone uniqueness check - Duplicate phones ARE ALLOWED
// Using Firestore (NOT SQLite) - NO UNIQUE constraint on phone field
// NEW: Supports both Weekly (10 weeks) and Monthly (5 months) loan types
const VERSION = '4.0.0';
console.log(`🚀 Backend v${VERSION} - UNIFIED LOAN SYSTEM (Weekly + Monthly)`);

// CORS configuration for production
const corsOptions = {
  origin: process.env.CLIENT_URL || '*',
  credentials: true
};

app.use(cors(corsOptions));
app.use(express.json());

// Root health check (no /api prefix for testing)
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    version: VERSION,
    timestamp: new Date().toISOString(),
    message: 'Backend v' + VERSION + ' - DUPLICATE PHONES ALLOWED'
  });
});

// Health check and version endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    version: VERSION,
    timestamp: new Date().toISOString(),
    message: 'Backend is running - DUPLICATE PHONES ALLOWED'
  });
});

// ============ CUSTOMER ROUTES ============

// Get all customers with their active loans (with optional pagination)
app.get('/api/customers', async (req, res) => {
  try {
    const { search, limit, page } = req.query;
    const pageSize = limit ? parseInt(limit) : null; // null = no pagination (fetch all)
    const pageNum = page ? parseInt(page) : 1;

    // OPTIMIZED: Fetch all data in parallel (3 queries instead of N+1)
    const [customersSnapshot, loansSnapshot, paymentsSnapshot] = await Promise.all([
      db.collection('customers').get(),
      db.collection('loans').where('status', '==', 'active').get(),
      db.collection('payments').get()
    ]);

    // Build payments lookup: loan_id -> last payment date
    const lastPaymentByLoan = {};
    paymentsSnapshot.docs.forEach(doc => {
      const payment = doc.data();
      const loanId = payment.loan_id;
      const paymentDate = payment.payment_date;
      if (!lastPaymentByLoan[loanId] || paymentDate > lastPaymentByLoan[loanId]) {
        lastPaymentByLoan[loanId] = paymentDate;
      }
    });

    // Build loans lookup: customer_id -> array of loans
    const loansByCustomer = {};
    loansSnapshot.docs.forEach(loanDoc => {
      const loanData = loanDoc.data();
      const customerId = loanData.customer_id;
      if (!loansByCustomer[customerId]) {
        loansByCustomer[customerId] = [];
      }
      loansByCustomer[customerId].push({
        loan_id: loanDoc.id,
        loan_name: loanData.loan_name || 'General Loan',
        loan_type: loanData.loan_type || 'Weekly',
        loan_amount: loanData.loan_amount,
        balance: loanData.balance,
        weekly_amount: loanData.weekly_amount || 0,
        monthly_amount: loanData.monthly_amount || 0,
        status: loanData.status,
        start_date: loanData.start_date,
        loan_given_date: loanData.loan_given_date,
        last_payment_date: lastPaymentByLoan[loanDoc.id] || null,
        created_at: loanData.created_at
      });
    });

    // Build customers array
    const customers = [];
    for (const doc of customersSnapshot.docs) {
      const customerData = { id: doc.id, ...doc.data() };

      // Filter by search term if provided
      if (search) {
        const searchLower = search.toLowerCase();
        if (!customerData.name.toLowerCase().includes(searchLower) &&
            !customerData.phone.toLowerCase().includes(searchLower)) {
          continue;
        }
      }

      const loans = loansByCustomer[doc.id] || [];
      const totalBalance = loans.reduce((sum, loan) => sum + loan.balance, 0);

      customers.push({
        ...customerData,
        loans: loans,
        total_active_loans: loans.length,
        total_balance: totalBalance
      });
    }

    // Sort by name
    customers.sort((a, b) => a.name.localeCompare(b.name));

    // Apply pagination if limit is specified
    if (pageSize) {
      const totalCustomers = customers.length;
      const totalPages = Math.ceil(totalCustomers / pageSize);
      const startIndex = (pageNum - 1) * pageSize;
      const paginatedCustomers = customers.slice(startIndex, startIndex + pageSize);

      res.json({
        customers: paginatedCustomers,
        pagination: {
          page: pageNum,
          limit: pageSize,
          totalCustomers,
          totalPages,
          hasMore: pageNum < totalPages
        }
      });
    } else {
      // No pagination - return all (for backward compatibility)
      res.json(customers);
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get customer by ID
app.get('/api/customers/:id', async (req, res) => {
  try {
    const doc = await db.collection('customers').doc(req.params.id).get();
    if (!doc.exists) {
      return res.status(404).json({ error: 'Customer not found' });
    }
    res.json({ id: doc.id, ...doc.data() });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create new customer - v3.3.0 NO DUPLICATE CHECK
app.post('/api/customers', async (req, res) => {
  try {
    console.log(`🎯 CREATE CUSTOMER v${VERSION} - DUPLICATE PHONES ALLOWED:`, req.body);
    const { name, phone } = req.body;

    if (!name || !phone) {
      return res.status(400).json({ error: 'Name and phone are required' });
    }

    // NO DUPLICATE PHONE CHECK - Multiple customers can have same phone!
    const customerData = {
      name,
      phone,
      created_at: new Date().toISOString()
    };

    const docRef = await db.collection('customers').add(customerData);
    const newDoc = await docRef.get();

    console.log('✅ Customer created successfully:', newDoc.id);
    res.status(201).json({ id: newDoc.id, ...newDoc.data() });
  } catch (error) {
    console.error('❌ Error creating customer:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update customer
app.put('/api/customers/:id', async (req, res) => {
  try {
    const { name, phone } = req.body;
    await db.collection('customers').doc(req.params.id).update({ name, phone });
    const doc = await db.collection('customers').doc(req.params.id).get();
    res.json({ id: doc.id, ...doc.data() });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete customer
app.delete('/api/customers/:id', async (req, res) => {
  try {
    // Delete associated loans and payments
    const loansSnapshot = await db.collection('loans')
      .where('customer_id', '==', req.params.id)
      .get();

    for (const loanDoc of loansSnapshot.docs) {
      // Delete payments for this loan
      const paymentsSnapshot = await db.collection('payments')
        .where('loan_id', '==', loanDoc.id)
        .get();

      for (const paymentDoc of paymentsSnapshot.docs) {
        await paymentDoc.ref.delete();
      }

      // Delete loan
      await loanDoc.ref.delete();
    }

    // Delete customer
    await db.collection('customers').doc(req.params.id).delete();
    res.json({ message: 'Customer deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============ LOAN ROUTES ============

// Get all loans for a customer
app.get('/api/customers/:customerId/loans', async (req, res) => {
  try {
    const loansSnapshot = await db.collection('loans')
      .where('customer_id', '==', req.params.customerId)
      .orderBy('created_at', 'desc')
      .get();

    const customerDoc = await db.collection('customers').doc(req.params.customerId).get();
    const customerData = customerDoc.data();

    const loans = loansSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      customer_name: customerData.name,
      customer_phone: customerData.phone
    }));

    res.json(loans);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get loan by ID with full details
app.get('/api/loans/:id', async (req, res) => {
  try {
    const loanDoc = await db.collection('loans').doc(req.params.id).get();

    if (!loanDoc.exists) {
      return res.status(404).json({ error: 'Loan not found' });
    }

    const loanData = loanDoc.data();

    // Get customer data
    const customerDoc = await db.collection('customers').doc(loanData.customer_id).get();
    const customerData = customerDoc.exists ? customerDoc.data() : { name: 'Unknown', phone: 'N/A' };

    // Get payments for this loan
    const paymentsSnapshot = await db.collection('payments')
      .where('loan_id', '==', req.params.id)
      .get();

    // Sort payments in memory to avoid Firestore index requirement
    const payments = paymentsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })).sort((a, b) => new Date(b.payment_date) - new Date(a.payment_date));

    // Calculate additional statistics
    const totalPaid = loanData.loan_amount - loanData.balance;
    const progressPercent = (totalPaid / loanData.loan_amount) * 100;

    // Calculate periods based on loan type
    const loanType = loanData.loan_type || 'Weekly';
    let totalPeriods, periodsRemaining;

    if (loanType === 'Weekly') {
      totalPeriods = Math.ceil(loanData.loan_amount / loanData.weekly_amount);
      periodsRemaining = Math.ceil(loanData.balance / loanData.weekly_amount);
    } else if (loanType === 'Monthly') {
      totalPeriods = Math.ceil(loanData.loan_amount / loanData.monthly_amount);
      periodsRemaining = Math.ceil(loanData.balance / loanData.monthly_amount);
    }

    res.json({
      id: loanDoc.id,
      ...loanData,
      customer_name: customerData.name,
      customer_phone: customerData.phone,
      payments,
      totalPaid,
      progressPercent,
      totalPeriods, // Can be weeks or months
      periodsRemaining, // Can be weeks or months
      // Keep old field names for backward compatibility
      totalWeeks: totalPeriods,
      weeksRemaining: periodsRemaining
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create new loan
app.post('/api/loans', async (req, res) => {
  try {
    const { customer_id, loan_name, loan_type, loan_amount, weekly_amount, monthly_amount, loan_given_date, start_date } = req.body;

    if (!customer_id || !loan_amount || !loan_given_date || !start_date) {
      return res.status(400).json({ error: 'Customer ID, loan amount, loan given date, and start date are required' });
    }

    const loanTypeValue = loan_type || 'Weekly'; // Default to Weekly

    // Validate based on loan type
    if (loanTypeValue === 'Weekly') {
      if (!weekly_amount) {
        return res.status(400).json({ error: 'Weekly amount is required for Weekly loans' });
      }
      // Validate that start_date is a Sunday for Weekly loans
      const startDate = new Date(start_date);
      if (startDate.getDay() !== 0) {
        return res.status(400).json({ error: 'Weekly loans can only start on Sundays' });
      }
    } else if (loanTypeValue === 'Monthly') {
      if (!monthly_amount) {
        return res.status(400).json({ error: 'Monthly amount is required for Monthly loans' });
      }
      // Monthly loans can start on any date (no Sunday restriction)
    }

    // ALLOW MULTIPLE LOANS: Customer can have multiple active loans
    // Each loan is tracked separately with its own loan_id
    console.log(`✅ Creating new ${loanTypeValue} loan "${loan_name || 'General Loan'}" for customer ${customer_id} (multiple loans allowed)`);

    const loanData = {
      customer_id,
      loan_name: loan_name || 'General Loan', // Default name if not provided
      loan_type: loanTypeValue,
      loan_amount,
      weekly_amount: weekly_amount || 0,
      monthly_amount: monthly_amount || 0,
      balance: loan_amount,
      loan_given_date,
      start_date,
      status: 'active',
      created_at: new Date().toISOString()
    };

    const docRef = await db.collection('loans').add(loanData);
    const newDoc = await docRef.get();

    res.status(201).json({ id: newDoc.id, ...newDoc.data() });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Top-up loan (add to existing balance)
app.post('/api/loans/:id/topup', async (req, res) => {
  try {
    const { amount } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'Valid amount is required' });
    }

    const loanDoc = await db.collection('loans').doc(req.params.id).get();

    if (!loanDoc.exists) {
      return res.status(404).json({ error: 'Loan not found' });
    }

    const loanData = loanDoc.data();
    const newBalance = loanData.balance + amount;
    const newLoanAmount = loanData.loan_amount + amount;

    await db.collection('loans').doc(req.params.id).update({
      balance: newBalance,
      loan_amount: newLoanAmount
    });

    const updatedDoc = await db.collection('loans').doc(req.params.id).get();
    res.json({ id: updatedDoc.id, ...updatedDoc.data() });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update loan (for editing loan details)
app.put('/api/loans/:id', async (req, res) => {
  try {
    const { loan_name, status, loan_given_date, start_date, loan_amount, weekly_amount, monthly_amount, balance } = req.body;
    const updateData = {};

    // Only update fields that are provided
    if (loan_name !== undefined) updateData.loan_name = loan_name;
    if (status !== undefined) updateData.status = status;
    if (loan_given_date !== undefined) updateData.loan_given_date = loan_given_date;
    if (start_date !== undefined) updateData.start_date = start_date;
    if (loan_amount !== undefined) updateData.loan_amount = Number(loan_amount);
    if (weekly_amount !== undefined) updateData.weekly_amount = Number(weekly_amount);
    if (monthly_amount !== undefined) updateData.monthly_amount = Number(monthly_amount);
    if (balance !== undefined) updateData.balance = Number(balance);

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    await db.collection('loans').doc(req.params.id).update(updateData);
    const doc = await db.collection('loans').doc(req.params.id).get();

    console.log(`✅ Updated loan ${req.params.id}:`, updateData);
    res.json({ id: doc.id, ...doc.data() });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Close loan
app.put('/api/loans/:id/close', async (req, res) => {
  try {
    await db.collection('loans').doc(req.params.id).update({ status: 'closed' });
    const doc = await db.collection('loans').doc(req.params.id).get();
    res.json({ id: doc.id, ...doc.data() });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Recalculate loan balance based on actual payments
app.post('/api/loans/:id/recalculate-balance', async (req, res) => {
  try {
    const loanDoc = await db.collection('loans').doc(req.params.id).get();
    if (!loanDoc.exists) {
      return res.status(404).json({ error: 'Loan not found' });
    }

    const loanData = loanDoc.data();

    // Get all payments for this loan
    const paymentsSnapshot = await db.collection('payments')
      .where('loan_id', '==', req.params.id)
      .get();

    // Calculate total paid
    let totalPaid = 0;
    paymentsSnapshot.docs.forEach(doc => {
      totalPaid += doc.data().amount || 0;
    });

    // Calculate correct balance
    const correctBalance = loanData.loan_amount - totalPaid;

    // Update loan balance
    await db.collection('loans').doc(req.params.id).update({
      balance: correctBalance
    });

    // Also recalculate balance_after for each payment
    const payments = paymentsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })).sort((a, b) => new Date(a.payment_date) - new Date(b.payment_date));

    let runningBalance = loanData.loan_amount;
    for (let i = 0; i < payments.length; i++) {
      runningBalance = runningBalance - payments[i].amount;
      await db.collection('payments').doc(payments[i].id).update({
        period_number: i + 1,
        balance_after: runningBalance
      });
    }

    console.log(`✅ Recalculated balance for loan ${req.params.id}: loan_amount=${loanData.loan_amount}, totalPaid=${totalPaid}, newBalance=${correctBalance}`);

    res.json({
      message: 'Balance recalculated successfully',
      loan_amount: loanData.loan_amount,
      total_paid: totalPaid,
      new_balance: correctBalance,
      payments_count: payments.length
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============ PAYMENT ROUTES ============

// Get all payments for a specific date (optimized batch query)
app.get('/api/payments-by-date', async (req, res) => {
  try {
    const { date } = req.query;
    if (!date) {
      return res.status(400).json({ error: 'Date parameter is required' });
    }

    // Query payments where payment_date matches the given date
    const paymentsSnapshot = await db.collection('payments')
      .where('payment_date', '>=', date)
      .where('payment_date', '<', date + 'T23:59:59')
      .get();

    const payments = paymentsSnapshot.docs.map(doc => ({
      id: doc.id,
      loan_id: doc.data().loan_id,
      amount: doc.data().amount,
      payment_date: doc.data().payment_date,
      balance_after: doc.data().balance_after,
      week_number: doc.data().period_number || doc.data().week_number,
      whatsapp_sent: doc.data().whatsapp_sent || false,
      whatsapp_sent_by: doc.data().whatsapp_sent_by || null
    }));

    res.json(payments);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Mark payment as WhatsApp sent
app.put('/api/payments/:id/whatsapp-sent', async (req, res) => {
  try {
    const { sent_by } = req.body;

    await db.collection('payments').doc(req.params.id).update({
      whatsapp_sent: true,
      whatsapp_sent_by: sent_by || 'Unknown',
      whatsapp_sent_at: new Date().toISOString()
    });

    res.json({ success: true, message: 'WhatsApp status updated' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get loans given on a specific date (by loan_given_date - when money was given)
app.get('/api/loans-by-date', async (req, res) => {
  try {
    const { date } = req.query;

    if (!date) {
      return res.status(400).json({ error: 'Date is required' });
    }

    const loans = [];

    // Get Weekly/Monthly loans with this loan_given_date
    const loansSnapshot = await db.collection('loans')
      .where('loan_given_date', '==', date)
      .get();

    for (const loanDoc of loansSnapshot.docs) {
      const loanData = loanDoc.data();

      // Get customer details
      const customerDoc = await db.collection('customers').doc(loanData.customer_id).get();
      const customerData = customerDoc.exists ? customerDoc.data() : { name: 'Unknown', phone: '' };

      loans.push({
        id: loanDoc.id,
        customer_id: loanData.customer_id,
        customer_name: customerData.name,
        customer_phone: customerData.phone,
        loan_name: loanData.loan_name || '',
        loan_type: loanData.loan_type || 'Weekly',
        loan_amount: loanData.loan_amount,
        weekly_amount: loanData.weekly_amount,
        monthly_amount: loanData.monthly_amount,
        loan_given_date: loanData.loan_given_date,
        status: loanData.status
      });
    }

    // Get Daily Finance loans with this loan_given_date
    const dailyLoansSnapshot = await db.collection('daily_loans')
      .where('loan_given_date', '==', date)
      .get();

    for (const loanDoc of dailyLoansSnapshot.docs) {
      const loanData = loanDoc.data();

      // Get customer details from daily_customers
      const customerDoc = await db.collection('daily_customers').doc(loanData.customer_id).get();
      const customerData = customerDoc.exists ? customerDoc.data() : { name: 'Unknown', phone: '' };

      loans.push({
        id: loanDoc.id,
        customer_id: loanData.customer_id,
        customer_name: customerData.name,
        customer_phone: customerData.phone,
        loan_name: `Daily - ${customerData.name}`,
        loan_type: 'Daily',
        loan_amount: loanData.given_amount, // Amount actually given (90%)
        asked_amount: loanData.asked_amount,
        daily_amount: loanData.daily_amount,
        loan_given_date: loanData.loan_given_date,
        status: loanData.status
      });
    }

    // Calculate total
    const totalAmount = loans.reduce((sum, loan) => sum + (loan.loan_amount || 0), 0);

    res.json({
      loans,
      total: totalAmount,
      count: loans.length
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get all payments
app.get('/api/payments', async (req, res) => {
  try {
    const { limit = 10 } = req.query;
    const paymentsSnapshot = await db.collection('payments')
      .orderBy('created_at', 'desc')
      .limit(parseInt(limit))
      .get();

    const payments = [];

    for (const paymentDoc of paymentsSnapshot.docs) {
      const paymentData = paymentDoc.data();

      // Get loan data
      const loanDoc = await db.collection('loans').doc(paymentData.loan_id).get();
      const loanData = loanDoc.data();

      // Get customer data
      const customerDoc = await db.collection('customers').doc(loanData.customer_id).get();
      const customerData = customerDoc.data();

      payments.push({
        id: paymentDoc.id,
        ...paymentData,
        customer_id: loanData.customer_id,
        customer_name: customerData.name,
        current_balance: loanData.balance
      });
    }

    res.json(payments);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create payment
app.post('/api/payments', async (req, res) => {
  try {
    const { loan_id, amount, payment_date, payment_mode, offline_amount, online_amount, collected_by, collected_by_name } = req.body;

    if (!loan_id || !amount || !payment_date) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    // Get loan details
    const loanDoc = await db.collection('loans').doc(loan_id).get();

    if (!loanDoc.exists) {
      return res.status(404).json({ error: 'Loan not found' });
    }

    const loanData = loanDoc.data();
    const loanType = loanData.loan_type || 'Weekly';

    // Validate payment date based on loan type
    const paymentDate = new Date(payment_date);
    if (loanType === 'Weekly') {
      // Weekly loans: Payments must be on Sundays
      if (paymentDate.getDay() !== 0) {
        return res.status(400).json({ error: 'Weekly loan payments can only be made on Sundays' });
      }
    }
    // Monthly loans: Payments can be on any date (no restriction)

    if (loanData.status !== 'active') {
      return res.status(400).json({ error: 'Loan is not active' });
    }

    if (amount > loanData.balance) {
      return res.status(400).json({ error: 'Payment amount exceeds loan balance' });
    }

    // Calculate payment details based on loan type
    let periodsCovered = 0;
    if (loanType === 'Weekly') {
      periodsCovered = amount / loanData.weekly_amount;
    } else if (loanType === 'Monthly') {
      periodsCovered = amount / loanData.monthly_amount;
    }

    const newBalance = loanData.balance - amount;

    // Get current period number (count existing payments + 1)
    const paymentsSnapshot = await db.collection('payments')
      .where('loan_id', '==', loan_id)
      .get();
    const periodNumber = paymentsSnapshot.size + 1;

    // Create payment data
    const paymentData = {
      loan_id,
      amount,
      payment_date,
      payment_mode: payment_mode || 'cash',
      offline_amount: offline_amount || 0,
      online_amount: online_amount || 0,
      periods_covered: periodsCovered, // Can be weeks or months depending on loan type
      period_number: periodNumber,
      balance_after: newBalance,
      collected_by: collected_by || '',
      collected_by_name: collected_by_name || '',
      created_at: new Date().toISOString()
    };

    // Add payment
    const paymentRef = await db.collection('payments').add(paymentData);

    // Update loan balance
    const updateData = { balance: newBalance };
    if (newBalance === 0) {
      updateData.status = 'closed';
    }
    await db.collection('loans').doc(loan_id).update(updateData);

    // Get customer data for response
    const customerDoc = await db.collection('customers').doc(loanData.customer_id).get();
    const customerData = customerDoc.data();

    const newPaymentDoc = await paymentRef.get();

    res.status(201).json({
      id: newPaymentDoc.id,
      ...newPaymentDoc.data(),
      customer_name: customerData.name,
      customer_phone: customerData.phone,
      week_number: periodNumber // Alias for period_number for WhatsApp message compatibility
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete payment (if needed to correct mistakes)
app.delete('/api/payments/:id', async (req, res) => {
  try {
    const paymentDoc = await db.collection('payments').doc(req.params.id).get();

    if (!paymentDoc.exists) {
      return res.status(404).json({ error: 'Payment not found' });
    }

    const paymentData = paymentDoc.data();

    const loanDoc = await db.collection('loans').doc(paymentData.loan_id).get();
    const loanData = loanDoc.data();
    const newBalance = loanData.balance + paymentData.amount;

    // Delete payment
    await db.collection('payments').doc(req.params.id).delete();

    // Update loan
    await db.collection('loans').doc(paymentData.loan_id).update({
      balance: newBalance,
      status: 'active'
    });

    // RECALCULATE week numbers for remaining payments
    const remainingPaymentsSnapshot = await db.collection('payments')
      .where('loan_id', '==', paymentData.loan_id)
      .get();

    // Sort payments by date
    const paymentsToUpdate = [];
    remainingPaymentsSnapshot.forEach(doc => {
      paymentsToUpdate.push({
        id: doc.id,
        ...doc.data()
      });
    });

    paymentsToUpdate.sort((a, b) => new Date(a.payment_date) - new Date(b.payment_date));

    // Recalculate both period_number AND balance_after for each payment
    let runningBalance = loanData.loan_amount; // Start from original loan amount

    for (let i = 0; i < paymentsToUpdate.length; i++) {
      runningBalance = runningBalance - paymentsToUpdate[i].amount;
      await db.collection('payments').doc(paymentsToUpdate[i].id).update({
        period_number: i + 1,
        balance_after: runningBalance
      });
    }

    res.json({ message: 'Payment deleted and all payment data recalculated successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Fix all existing payment week numbers AND balance_after (one-time migration)
app.post('/api/migrate-payment-numbers', async (req, res) => {
  try {
    // Get all loans
    const loansSnapshot = await db.collection('loans').get();
    let totalFixed = 0;

    for (const loanDoc of loansSnapshot.docs) {
      const loanId = loanDoc.id;
      const loanData = loanDoc.data();

      // Get all payments for this loan
      const paymentsSnapshot = await db.collection('payments')
        .where('loan_id', '==', loanId)
        .get();

      if (paymentsSnapshot.empty) continue;

      // Sort payments by date
      const payments = [];
      paymentsSnapshot.forEach(doc => {
        payments.push({
          id: doc.id,
          ...doc.data()
        });
      });

      payments.sort((a, b) => new Date(a.payment_date) - new Date(b.payment_date));

      // Recalculate both period_number AND balance_after for each payment
      let runningBalance = loanData.loan_amount; // Start from original loan amount

      for (let i = 0; i < payments.length; i++) {
        runningBalance = runningBalance - payments[i].amount;
        await db.collection('payments').doc(payments[i].id).update({
          period_number: i + 1,
          balance_after: runningBalance
        });
        totalFixed++;
      }

      // ALSO update the loan's actual balance to match final payment balance
      const updateData = { balance: runningBalance };
      if (runningBalance === 0) {
        updateData.status = 'closed';
      } else if (loanData.status === 'closed' && runningBalance > 0) {
        updateData.status = 'active';
      }
      await db.collection('loans').doc(loanId).update(updateData);
    }

    res.json({
      message: 'All payment data (week numbers and balances) recalculated successfully',
      totalFixed
    });
  } catch (error) {
    console.error('Error migrating payment data:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============ MONTHLY FINANCE ROUTES (SEPARATE COLLECTION) ============

// Get all Monthly Finance customers
app.get('/api/monthly-finance/customers', async (req, res) => {
  try {
    const customersSnapshot = await db.collection('monthly_finance_customers')
      .where('status', '==', 'active')
      .get();

    const customers = [];

    for (const doc of customersSnapshot.docs) {
      const customerData = doc.data();

      // Get payments for this customer
      const paymentsSnapshot = await db.collection('monthly_finance_payments')
        .where('customer_id', '==', doc.id)
        .get();

      const payments = paymentsSnapshot.docs.map(paymentDoc => ({
        id: paymentDoc.id,
        ...paymentDoc.data()
      })).sort((a, b) => new Date(b.payment_date) - new Date(a.payment_date));

      customers.push({
        id: doc.id,
        ...customerData,
        payments
      });
    }

    // Sort by name
    customers.sort((a, b) => a.name.localeCompare(b.name));

    res.json(customers);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create Monthly Finance customer
app.post('/api/monthly-finance/customers', async (req, res) => {
  try {
    console.log('🎯 CREATE MONTHLY FINANCE CUSTOMER:', req.body);
    const { name, phone, loan_amount, monthly_amount, total_months, start_date } = req.body;

    if (!name || !phone || !loan_amount || !monthly_amount || !total_months || !start_date) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    const customerData = {
      name,
      phone,
      loan_amount: parseFloat(loan_amount),
      balance: parseFloat(loan_amount),
      monthly_amount: parseFloat(monthly_amount),
      total_months: parseInt(total_months),
      start_date,
      status: 'active',
      created_at: new Date().toISOString()
    };

    const docRef = await db.collection('monthly_finance_customers').add(customerData);
    const newDoc = await docRef.get();

    console.log('✅ Monthly Finance customer created successfully:', newDoc.id);
    res.status(201).json({ id: newDoc.id, ...newDoc.data() });
  } catch (error) {
    console.error('❌ Error creating Monthly Finance customer:', error);
    res.status(500).json({ error: error.message });
  }
});

// Add payment to Monthly Finance customer
app.post('/api/monthly-finance/customers/:id/payments', async (req, res) => {
  try {
    const { amount, payment_date, payment_mode } = req.body;

    if (!amount || !payment_date) {
      return res.status(400).json({ error: 'Amount and payment date are required' });
    }

    // Get customer data
    const customerDoc = await db.collection('monthly_finance_customers').doc(req.params.id).get();

    if (!customerDoc.exists) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    const customerData = customerDoc.data();

    if (customerData.status !== 'active') {
      return res.status(400).json({ error: 'Customer loan is not active' });
    }

    if (amount > customerData.balance) {
      return res.status(400).json({ error: 'Payment amount exceeds balance' });
    }

    const newBalance = customerData.balance - amount;

    // Create payment record
    const paymentData = {
      customer_id: req.params.id,
      amount: parseFloat(amount),
      payment_date,
      payment_mode: payment_mode || 'cash',
      balance_after: newBalance,
      created_at: new Date().toISOString()
    };

    await db.collection('monthly_finance_payments').add(paymentData);

    // Update customer balance
    const updateData = { balance: newBalance };
    if (newBalance === 0) {
      updateData.status = 'closed';
    }
    await db.collection('monthly_finance_customers').doc(req.params.id).update(updateData);

    // Get updated customer data
    const updatedDoc = await db.collection('monthly_finance_customers').doc(req.params.id).get();

    res.status(201).json({ id: updatedDoc.id, ...updatedDoc.data() });
  } catch (error) {
    console.error('Error adding Monthly Finance payment:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete Monthly Finance customer
app.delete('/api/monthly-finance/customers/:id', async (req, res) => {
  try {
    // Delete associated payments
    const paymentsSnapshot = await db.collection('monthly_finance_payments')
      .where('customer_id', '==', req.params.id)
      .get();

    for (const paymentDoc of paymentsSnapshot.docs) {
      await paymentDoc.ref.delete();
    }

    // Delete customer
    await db.collection('monthly_finance_customers').doc(req.params.id).delete();

    res.json({ message: 'Monthly Finance customer deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Undo last payment for Monthly Finance customer
app.delete('/api/monthly-finance/customers/:id/undo-payment', async (req, res) => {
  try {
    const customerId = req.params.id;

    // Get customer data
    const customerDoc = await db.collection('monthly_finance_customers').doc(customerId).get();
    if (!customerDoc.exists) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    const customerData = customerDoc.data();

    // Get all payments for this customer (no orderBy to avoid index requirement)
    const paymentsSnapshot = await db.collection('monthly_finance_payments')
      .where('customer_id', '==', customerId)
      .get();

    if (paymentsSnapshot.empty) {
      return res.status(400).json({ error: 'No payments to undo' });
    }

    // Sort payments by created_at in JavaScript to find the most recent
    const payments = paymentsSnapshot.docs.map(doc => ({
      ref: doc.ref,
      data: doc.data()
    }));

    payments.sort((a, b) => {
      const dateA = a.data.created_at?.toDate?.() || new Date(a.data.created_at) || new Date(0);
      const dateB = b.data.created_at?.toDate?.() || new Date(b.data.created_at) || new Date(0);
      return dateB - dateA; // Descending order (most recent first)
    });

    const lastPayment = payments[0];
    const paymentData = lastPayment.data;

    // Restore the balance by adding back the payment amount
    const newBalance = customerData.balance + paymentData.amount;

    // Update customer balance and status
    const updateData = {
      balance: newBalance,
      status: 'active' // Reactivate if it was closed
    };

    await db.collection('monthly_finance_customers').doc(customerId).update(updateData);

    // Delete the payment record
    await lastPayment.ref.delete();

    // Get updated customer data
    const updatedDoc = await db.collection('monthly_finance_customers').doc(customerId).get();

    res.json({
      message: 'Payment undone successfully',
      deletedPayment: paymentData,
      customer: { id: updatedDoc.id, ...updatedDoc.data() }
    });
  } catch (error) {
    console.error('Error undoing Monthly Finance payment:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete Monthly Finance customer and all their payments
app.delete('/api/monthly-finance/customers/:id', async (req, res) => {
  try {
    const customerId = req.params.id;

    // Get customer data first to confirm it exists
    const customerDoc = await db.collection('monthly_finance_customers').doc(customerId).get();
    if (!customerDoc.exists) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    const customerData = customerDoc.data();

    // Delete all payments for this customer
    const paymentsSnapshot = await db.collection('monthly_finance_payments')
      .where('customer_id', '==', customerId)
      .get();

    const batch = db.batch();
    paymentsSnapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
    });

    // Delete the customer document
    batch.delete(customerDoc.ref);

    await batch.commit();

    res.json({
      message: 'Customer deleted successfully',
      deletedCustomer: customerData,
      deletedPaymentsCount: paymentsSnapshot.size
    });
  } catch (error) {
    console.error('Error deleting Monthly Finance customer:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============ DASHBOARD STATS ============

app.get('/api/stats', async (req, res) => {
  try {
    // Active Weekly loans count
    const activeLoansSnapshot = await db.collection('loans')
      .where('status', '==', 'active')
      .get();

    // Active Monthly Finance customers count
    const monthlyFinanceSnapshot = await db.collection('monthly_finance_customers')
      .where('status', '==', 'active')
      .get();

    const activeLoans = activeLoansSnapshot.size + monthlyFinanceSnapshot.size;

    // Outstanding balance (sum of all active loan balances)
    let outstanding = 0;
    let weeklyOutstanding = 0;
    let monthlyOutstanding = 0;

    // Calculate Weekly outstanding
    activeLoansSnapshot.forEach(doc => {
      const loan = doc.data();
      const balance = loan.balance || 0;
      outstanding += balance;

      // Categorize by loan type (default to Weekly for old loans)
      const loanType = loan.loan_type || 'Weekly';
      if (loanType === 'Monthly') {
        monthlyOutstanding += balance;
      } else {
        weeklyOutstanding += balance;
      }
    });

    // Calculate Monthly Finance outstanding (from separate collection)
    monthlyFinanceSnapshot.forEach(doc => {
      const customer = doc.data();
      const balance = customer.balance || 0;
      outstanding += balance;
      monthlyOutstanding += balance;
    });

    // Total customers count (Weekly + Monthly Finance)
    const customersSnapshot = await db.collection('customers').get();
    const totalCustomers = customersSnapshot.size + monthlyFinanceSnapshot.size;

    // Payments this week
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const weekAgoStr = weekAgo.toISOString().split('T')[0];

    const paymentsSnapshot = await db.collection('payments')
      .where('payment_date', '>=', weekAgoStr)
      .get();

    const monthlyPaymentsSnapshot = await db.collection('monthly_finance_payments')
      .where('payment_date', '>=', weekAgoStr)
      .get();

    const paymentsThisWeek = paymentsSnapshot.size + monthlyPaymentsSnapshot.size;

    // Database size statistics
    // Count total documents across all collections
    const loansCount = await db.collection('loans').get().then(snap => snap.size);
    const allPaymentsCount = await db.collection('payments').get().then(snap => snap.size);
    const monthlyPaymentsCount = await db.collection('monthly_finance_payments').get().then(snap => snap.size);

    const totalDocuments = customersSnapshot.size +
                          monthlyFinanceSnapshot.size +
                          loansCount +
                          allPaymentsCount +
                          monthlyPaymentsCount;

    // Estimate database size (rough calculation: ~0.5KB per document average)
    // This is an approximation for Firestore
    const estimatedSizeMB = (totalDocuments * 0.5) / 1024; // Convert KB to MB
    const limitMB = 500; // Free tier limit
    const usagePercent = (estimatedSizeMB / limitMB) * 100;

    res.json({
      activeLoans,
      outstanding,
      weeklyOutstanding,
      monthlyOutstanding,
      totalCustomers,
      paymentsThisWeek,
      // Database statistics
      database: {
        totalDocuments,
        estimatedSizeMB: Math.round(estimatedSizeMB * 100) / 100, // Round to 2 decimals
        limitMB,
        usagePercent: Math.round(usagePercent * 100) / 100, // Round to 2 decimals
        collections: {
          customers: customersSnapshot.size,
          monthlyFinanceCustomers: monthlyFinanceSnapshot.size,
          loans: loansCount,
          payments: allPaymentsCount,
          monthlyFinancePayments: monthlyPaymentsCount
        }
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============ WEEKLY LOAN DIAGNOSTIC ============
// Analyze weekly loan totals to find discrepancies
app.get('/api/weekly-diagnostic', async (req, res) => {
  try {
    // Get all active loans (filter balance > 0 in code to avoid composite index)
    const loansSnapshot = await db.collection('loans')
      .where('status', '==', 'active')
      .get();

    const weeklyLoans = [];
    let totalLoanAmount = 0;
    let totalWeeklyAmount = 0;
    let totalExpectedWeekly = 0; // loan_amount / 10
    const discrepancies = [];

    loansSnapshot.forEach(doc => {
      const loan = doc.data();
      const loanType = loan.loan_type || 'Weekly';
      const balance = loan.balance || 0;

      // Only include Weekly loans with balance > 0
      if (loanType === 'Weekly' && balance > 0) {
        const loanAmount = loan.loan_amount || 0;
        const weeklyAmount = loan.weekly_amount || 0;
        const expectedWeekly = loanAmount / 10;

        totalLoanAmount += loanAmount;
        totalWeeklyAmount += weeklyAmount;
        totalExpectedWeekly += expectedWeekly;

        // Check if weekly_amount matches loan_amount / 10
        if (Math.abs(weeklyAmount - expectedWeekly) > 1) { // Allow ₹1 rounding difference
          discrepancies.push({
            loan_id: doc.id,
            loan_name: loan.loan_name || 'General Loan',
            loan_amount: loanAmount,
            weekly_amount: weeklyAmount,
            expected_weekly: expectedWeekly,
            difference: weeklyAmount - expectedWeekly
          });
        }

        weeklyLoans.push({
          loan_id: doc.id,
          loan_name: loan.loan_name || 'General Loan',
          loan_amount: loanAmount,
          weekly_amount: weeklyAmount,
          expected_weekly: expectedWeekly,
          balance: loan.balance
        });
      }
    });

    res.json({
      summary: {
        totalWeeklyLoans: weeklyLoans.length,
        totalLoanAmount,
        totalWeeklyAmount,
        totalExpectedWeekly,
        discrepancyAmount: totalWeeklyAmount - totalExpectedWeekly
      },
      discrepancies,
      allLoans: weeklyLoans
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============ SUNDAY COLLECTIONS (OPTIMIZED) ============

// Get all customers due for payment on a specific Sunday
app.get('/api/sunday-collections', async (req, res) => {
  try {
    const { date } = req.query;

    if (!date) {
      return res.status(400).json({ error: 'Date parameter is required' });
    }

    // Get all active loans
    const loansSnapshot = await db.collection('loans')
      .where('status', '==', 'active')
      .where('balance', '>', 0)
      .get();

    // Get all customers in one batch
    const customerIds = loansSnapshot.docs.map(doc => doc.data().customer_id);
    const customersMap = new Map();

    if (customerIds.length > 0) {
      // Firestore limits 'in' queries to 10 items, so we batch them
      const batches = [];
      for (let i = 0; i < customerIds.length; i += 10) {
        const batch = customerIds.slice(i, i + 10);
        batches.push(
          db.collection('customers')
            .where('__name__', 'in', batch)
            .get()
        );
      }

      const customerSnapshots = await Promise.all(batches);
      customerSnapshots.forEach(snapshot => {
        snapshot.docs.forEach(doc => {
          customersMap.set(doc.id, doc.data());
        });
      });
    }

    // Get all payments for the selected date
    const paymentsSnapshot = await db.collection('payments')
      .where('payment_date', '==', date)
      .get();

    const paymentsMap = new Map();
    paymentsSnapshot.docs.forEach(doc => {
      const payment = doc.data();
      paymentsMap.set(payment.loan_id, payment);
    });

    // Build response with all data
    const sundayCustomers = [];

    for (const loanDoc of loansSnapshot.docs) {
      const loanData = loanDoc.data();
      const customer = customersMap.get(loanData.customer_id);

      if (!customer) continue;

      // Check if loan should have a payment on this Sunday
      const startDate = new Date(loanData.start_date);
      const selectedDate = new Date(date);

      // Calculate week number
      const weeksDiff = Math.floor((selectedDate - startDate) / (7 * 24 * 60 * 60 * 1000));

      // Only include if within 10 weeks (same logic as before)
      if (weeksDiff < 0 || weeksDiff >= 10) continue;

      const weekNumber = weeksDiff + 1;

      // Check if already paid
      const isPaid = paymentsMap.has(loanDoc.id);

      sundayCustomers.push({
        loanId: loanDoc.id,
        name: customer.name,
        phone: customer.phone,
        weeklyAmount: loanData.weekly_amount,
        balance: loanData.balance,
        weekNumber,
        isPaid,
        paymentDetails: isPaid ? paymentsMap.get(loanDoc.id) : null
      });
    }

    // Sort by paid status (unpaid first) then by name
    sundayCustomers.sort((a, b) => {
      if (a.isPaid !== b.isPaid) return a.isPaid ? 1 : -1;
      return a.name.localeCompare(b.name);
    });

    res.json(sundayCustomers);
  } catch (error) {
    console.error('Error fetching Sunday collections:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============ VADDI (INTEREST) LIST ROUTES ============

// Get all vaddi entries
app.get('/api/vaddi-entries', async (req, res) => {
  try {
    const vaddiSnapshot = await db.collection('vaddi_entries')
      .orderBy('day', 'asc')
      .get();

    const entries = [];
    vaddiSnapshot.forEach(doc => {
      entries.push({
        id: doc.id,
        ...doc.data()
      });
    });

    res.json(entries);
  } catch (error) {
    console.error('Error fetching vaddi entries:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create new vaddi entry
app.post('/api/vaddi-entries', async (req, res) => {
  try {
    const { day, name, amount, phone } = req.body;

    // Validate required fields
    if (!day || !name || !amount || !phone) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Validate day (1-31)
    if (day < 1 || day > 31) {
      return res.status(400).json({ error: 'Day must be between 1 and 31' });
    }

    // Validate phone number format
    if (phone.length !== 10) {
      return res.status(400).json({ error: 'Phone number must be 10 digits' });
    }

    const newEntry = {
      day: parseInt(day),
      name,
      amount: parseInt(amount),
      phone,
      createdAt: new Date().toISOString()
    };

    const docRef = await db.collection('vaddi_entries').add(newEntry);

    res.status(201).json({
      id: docRef.id,
      ...newEntry
    });
  } catch (error) {
    console.error('Error creating vaddi entry:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update vaddi entry (mark as paid/unpaid)
app.put('/api/vaddi-entries/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { paid, paidDate } = req.body;

    const entryRef = db.collection('vaddi_entries').doc(id);
    const entryDoc = await entryRef.get();

    if (!entryDoc.exists) {
      return res.status(404).json({ error: 'Vaddi entry not found' });
    }

    const updateData = {
      paid,
      paidDate: paid ? (paidDate || new Date().toISOString().split('T')[0]) : null,
      updatedAt: new Date().toISOString()
    };

    await entryRef.update(updateData);

    res.json({
      id,
      ...entryDoc.data(),
      ...updateData
    });
  } catch (error) {
    console.error('Error updating vaddi entry:', error);
    res.status(500).json({ error: error.message });
  }
});

// Record interest payment
app.post('/api/vaddi-entries/:id/interest-payment', async (req, res) => {
  try {
    const { id } = req.params;
    const { paymentDate, amount } = req.body;

    const entryRef = db.collection('vaddi_entries').doc(id);
    const entryDoc = await entryRef.get();

    if (!entryDoc.exists) {
      return res.status(404).json({ error: 'Vaddi entry not found' });
    }

    const entry = entryDoc.data();
    const interestPayments = entry.interestPayments || [];

    interestPayments.push({
      date: paymentDate || new Date().toISOString().split('T')[0],
      amount: amount || entry.monthlyInterest,
      recordedAt: new Date().toISOString()
    });

    await entryRef.update({
      interestPayments,
      updatedAt: new Date().toISOString()
    });

    res.json({
      id,
      ...entry,
      interestPayments
    });
  } catch (error) {
    console.error('Error recording interest payment:', error);
    res.status(500).json({ error: error.message });
  }
});

// Mark principal as returned
app.put('/api/vaddi-entries/:id/principal-returned', async (req, res) => {
  try {
    const { id } = req.params;
    const { returnDate } = req.body;

    const entryRef = db.collection('vaddi_entries').doc(id);
    const entryDoc = await entryRef.get();

    if (!entryDoc.exists) {
      return res.status(404).json({ error: 'Vaddi entry not found' });
    }

    await entryRef.update({
      principalReturned: true,
      principalReturnedDate: returnDate || new Date().toISOString().split('T')[0],
      updatedAt: new Date().toISOString()
    });

    res.json({
      id,
      ...entryDoc.data(),
      principalReturned: true,
      principalReturnedDate: returnDate || new Date().toISOString().split('T')[0]
    });
  } catch (error) {
    console.error('Error marking principal as returned:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete vaddi entry
app.delete('/api/vaddi-entries/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const entryRef = db.collection('vaddi_entries').doc(id);
    const entryDoc = await entryRef.get();

    if (!entryDoc.exists) {
      return res.status(404).json({ error: 'Vaddi entry not found' });
    }

    await entryRef.delete();

    res.json({ message: 'Vaddi entry deleted successfully' });
  } catch (error) {
    console.error('Error deleting vaddi entry:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============ VADDI MONTHLY INTEREST PAYMENT ROUTES ============

// Record monthly interest payment for a vaddi entry
app.post('/api/vaddi-entries/:id/monthly-payment', async (req, res) => {
  try {
    const { id } = req.params;
    const { month, totalAmount, myShare, friendShare } = req.body;

    // Validate required fields
    if (!month || totalAmount === undefined || myShare === undefined || friendShare === undefined) {
      return res.status(400).json({ error: 'Month, totalAmount, myShare, and friendShare are required' });
    }

    // Validate the entry exists
    const entryRef = db.collection('vaddi_entries').doc(id);
    const entryDoc = await entryRef.get();

    if (!entryDoc.exists) {
      return res.status(404).json({ error: 'Vaddi entry not found' });
    }

    const entryData = entryDoc.data();

    // Check if already paid for this month
    const existingPayment = await db.collection('vaddi_payments')
      .where('entryId', '==', id)
      .where('month', '==', month)
      .get();

    if (!existingPayment.empty) {
      return res.status(400).json({ error: 'Payment already recorded for this month' });
    }

    // Create payment record
    const paymentData = {
      entryId: id,
      customerName: entryData.name,
      month,
      totalAmount: parseInt(totalAmount),
      myShare: parseInt(myShare),
      friendShare: parseInt(friendShare),
      paidDate: new Date().toISOString().split('T')[0],
      createdAt: new Date().toISOString()
    };

    const docRef = await db.collection('vaddi_payments').add(paymentData);

    res.status(201).json({
      id: docRef.id,
      ...paymentData
    });
  } catch (error) {
    console.error('Error recording vaddi monthly payment:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get vaddi payments for a specific month
app.get('/api/vaddi-payments', async (req, res) => {
  try {
    const { month } = req.query;

    if (!month) {
      return res.status(400).json({ error: 'Month parameter is required (e.g., 2025-11)' });
    }

    const paymentsSnapshot = await db.collection('vaddi_payments')
      .where('month', '==', month)
      .get();

    const payments = [];
    paymentsSnapshot.forEach(doc => {
      payments.push({
        id: doc.id,
        ...doc.data()
      });
    });

    res.json(payments);
  } catch (error) {
    console.error('Error fetching vaddi payments:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get all payments for profit analysis (includes vaddi payments with my_profit)
app.get('/api/all-payments', async (req, res) => {
  try {
    const allPayments = [];

    // Get vaddi payments (they have myShare as my_profit)
    const vaddiSnapshot = await db.collection('vaddi_payments').get();
    vaddiSnapshot.forEach(doc => {
      const data = doc.data();
      allPayments.push({
        id: doc.id,
        type: 'vaddi',
        payment_date: data.date || data.paymentDate,
        my_profit: data.myShare || 0,
        amount: data.totalAmount || 0
      });
    });

    // Get regular payments
    const paymentsSnapshot = await db.collection('payments').get();
    paymentsSnapshot.forEach(doc => {
      const data = doc.data();
      allPayments.push({
        id: doc.id,
        type: 'regular',
        payment_date: data.payment_date,
        amount: data.amount || 0,
        loan_id: data.loan_id
      });
    });

    res.json(allPayments);
  } catch (error) {
    console.error('Error fetching all payments:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get vaddi monthly summary (totals for a month)
app.get('/api/vaddi-summary', async (req, res) => {
  try {
    const { month } = req.query;

    if (!month) {
      return res.status(400).json({ error: 'Month parameter is required (e.g., 2025-11)' });
    }

    const paymentsSnapshot = await db.collection('vaddi_payments')
      .where('month', '==', month)
      .get();

    let totalCollected = 0;
    let totalMyShare = 0;
    let totalFriendShare = 0;
    let paymentCount = 0;

    paymentsSnapshot.forEach(doc => {
      const payment = doc.data();
      totalCollected += payment.totalAmount || 0;
      totalMyShare += payment.myShare || 0;
      totalFriendShare += payment.friendShare || 0;
      paymentCount++;
    });

    res.json({
      month,
      totalCollected,
      myProfit: totalMyShare,
      friendShare: totalFriendShare,
      paymentCount
    });
  } catch (error) {
    console.error('Error fetching vaddi summary:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get all months' vaddi payment history
app.get('/api/vaddi-history', async (req, res) => {
  try {
    const paymentsSnapshot = await db.collection('vaddi_payments').get();

    // Group payments by month
    const monthsMap = new Map();

    paymentsSnapshot.forEach(doc => {
      const payment = doc.data();
      const month = payment.month;

      if (!monthsMap.has(month)) {
        monthsMap.set(month, {
          month,
          totalCollected: 0,
          myProfit: 0,
          friendShare: 0,
          paymentCount: 0
        });
      }

      const monthData = monthsMap.get(month);
      monthData.totalCollected += payment.totalAmount || 0;
      monthData.myProfit += payment.myShare || 0;
      monthData.friendShare += payment.friendShare || 0;
      monthData.paymentCount++;
    });

    // Convert to array and sort by month (newest first)
    const history = Array.from(monthsMap.values())
      .sort((a, b) => b.month.localeCompare(a.month));

    res.json(history);
  } catch (error) {
    console.error('Error fetching vaddi history:', error);
    res.status(500).json({ error: error.message });
  }
});

// Mark vaddi entry as fully settled (customer closed account)
app.put('/api/vaddi-entries/:id/settle', async (req, res) => {
  try {
    const { id } = req.params;

    const entryRef = db.collection('vaddi_entries').doc(id);
    const entryDoc = await entryRef.get();

    if (!entryDoc.exists) {
      return res.status(404).json({ error: 'Vaddi entry not found' });
    }

    await entryRef.update({
      status: 'settled',
      settledDate: new Date().toISOString().split('T')[0],
      updatedAt: new Date().toISOString()
    });

    const updatedDoc = await entryRef.get();

    res.json({
      id,
      ...updatedDoc.data()
    });
  } catch (error) {
    console.error('Error settling vaddi entry:', error);
    res.status(500).json({ error: error.message });
  }
});

// Reactivate a settled vaddi entry
app.put('/api/vaddi-entries/:id/reactivate', async (req, res) => {
  try {
    const { id } = req.params;

    const entryRef = db.collection('vaddi_entries').doc(id);
    const entryDoc = await entryRef.get();

    if (!entryDoc.exists) {
      return res.status(404).json({ error: 'Vaddi entry not found' });
    }

    await entryRef.update({
      status: 'active',
      settledDate: null,
      updatedAt: new Date().toISOString()
    });

    const updatedDoc = await entryRef.get();

    res.json({
      id,
      ...updatedDoc.data()
    });
  } catch (error) {
    console.error('Error reactivating vaddi entry:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete a vaddi monthly payment (undo payment)
app.delete('/api/vaddi-payments/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const paymentRef = db.collection('vaddi_payments').doc(id);
    const paymentDoc = await paymentRef.get();

    if (!paymentDoc.exists) {
      return res.status(404).json({ error: 'Payment not found' });
    }

    await paymentRef.delete();

    res.json({ message: 'Payment deleted successfully' });
  } catch (error) {
    console.error('Error deleting vaddi payment:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============ INVESTMENTS TRACKING ROUTES ============

// Get all investments
app.get('/api/investments', async (req, res) => {
  try {
    const investmentsSnapshot = await db.collection('investments')
      .orderBy('investmentDate', 'desc')
      .get();

    const investments = [];
    investmentsSnapshot.forEach(doc => {
      investments.push({
        id: doc.id,
        ...doc.data()
      });
    });

    res.json(investments);
  } catch (error) {
    console.error('Error fetching investments:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create new investment
app.post('/api/investments', async (req, res) => {
  try {
    const {
      investorName,
      phone,
      investmentAmount,
      investmentDate,
      returnAmount,
      expectedReturnDate,
      notes
    } = req.body;

    // Validate required fields
    if (!investorName || !investmentAmount || !investmentDate || !returnAmount || !expectedReturnDate) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Validate phone if provided
    if (phone && phone.length !== 10) {
      return res.status(400).json({ error: 'Phone number must be 10 digits' });
    }

    const newInvestment = {
      investorName,
      phone: phone || '',
      investmentAmount: parseFloat(investmentAmount),
      investmentDate,
      returnAmount: parseFloat(returnAmount),
      expectedReturnDate,
      notes: notes || '',
      status: 'pending',
      returnedDate: null,
      createdAt: new Date().toISOString()
    };

    const docRef = await db.collection('investments').add(newInvestment);

    res.status(201).json({
      id: docRef.id,
      ...newInvestment
    });
  } catch (error) {
    console.error('Error creating investment:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update investment (mark as returned/pending)
app.put('/api/investments/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { status, returnedDate } = req.body;

    const investmentRef = db.collection('investments').doc(id);
    const investmentDoc = await investmentRef.get();

    if (!investmentDoc.exists) {
      return res.status(404).json({ error: 'Investment not found' });
    }

    const updateData = {
      status,
      returnedDate: status === 'returned' ? (returnedDate || new Date().toISOString().split('T')[0]) : null,
      updatedAt: new Date().toISOString()
    };

    await investmentRef.update(updateData);

    res.json({
      id,
      ...investmentDoc.data(),
      ...updateData
    });
  } catch (error) {
    console.error('Error updating investment:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete investment
app.delete('/api/investments/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const investmentRef = db.collection('investments').doc(id);
    const investmentDoc = await investmentRef.get();

    if (!investmentDoc.exists) {
      return res.status(404).json({ error: 'Investment not found' });
    }

    await investmentRef.delete();

    res.json({ message: 'Investment deleted successfully' });
  } catch (error) {
    console.error('Error deleting investment:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============ USER MANAGEMENT ROUTES ============

// ADMIN PASSWORD (same as login) - for admin operations
const ADMIN_PASSWORD = 'Omsaimurugan';

// Get all users (for admin)
app.get('/api/users', async (req, res) => {
  try {
    const usersSnapshot = await db.collection('app_users')
      .orderBy('created_at', 'desc')
      .get();

    const users = [];
    usersSnapshot.forEach(doc => {
      const data = doc.data();
      // Don't send password hash to client
      const { password_hash, ...userData } = data;
      users.push({
        id: doc.id,
        ...userData
      });
    });

    res.json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: error.message });
  }
});

// Register new user (sign up)
app.post('/api/users/register', async (req, res) => {
  try {
    const { name, email, phone, password } = req.body;

    // Validate required fields - need name, password, and at least email OR phone
    if (!name || !password) {
      return res.status(400).json({ error: 'Name and password are required' });
    }

    if (!email && !phone) {
      return res.status(400).json({ error: 'Please provide either email or mobile number' });
    }

    // Validate email format if provided
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (email && !emailRegex.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    // Validate phone format if provided (10 digits)
    if (phone && !/^\d{10}$/.test(phone)) {
      return res.status(400).json({ error: 'Mobile number must be 10 digits' });
    }

    // Check if email already exists (if provided)
    if (email) {
      const existingEmail = await db.collection('app_users')
        .where('email', '==', email.toLowerCase())
        .get();
      if (!existingEmail.empty) {
        return res.status(400).json({ error: 'Email already registered. Please wait for admin approval or use a different email.' });
      }
    }

    // Check if phone already exists (if provided)
    if (phone) {
      const existingPhone = await db.collection('app_users')
        .where('phone', '==', phone)
        .get();
      if (!existingPhone.empty) {
        return res.status(400).json({ error: 'Mobile number already registered. Please wait for admin approval or use a different number.' });
      }
    }

    // Simple password hash (for basic security - in production use bcrypt)
    const password_hash = Buffer.from(password).toString('base64');

    const userData = {
      name,
      email: email ? email.toLowerCase() : '',
      phone: phone || '',
      password_hash,
      status: 'pending', // pending, approved, rejected
      role: 'user', // admin, user
      created_at: new Date().toISOString()
    };

    const docRef = await db.collection('app_users').add(userData);

    console.log(`✅ New user registered: ${email || phone} (pending approval)`);

    res.status(201).json({
      message: 'Registration successful! Please wait for admin approval.',
      user_id: docRef.id
    });
  } catch (error) {
    console.error('Error registering user:', error);
    res.status(500).json({ error: error.message });
  }
});

// User login (supports email or phone)
app.post('/api/users/login', async (req, res) => {
  try {
    const { email, phone, password } = req.body;

    if ((!email && !phone) || !password) {
      return res.status(400).json({ error: 'Email/Mobile and password are required' });
    }

    let usersSnapshot;

    // Find user by email or phone
    if (email) {
      usersSnapshot = await db.collection('app_users')
        .where('email', '==', email.toLowerCase())
        .get();
    } else if (phone) {
      usersSnapshot = await db.collection('app_users')
        .where('phone', '==', phone)
        .get();
    }

    if (!usersSnapshot || usersSnapshot.empty) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const userDoc = usersSnapshot.docs[0];
    const userData = userDoc.data();

    // Check password
    const password_hash = Buffer.from(password).toString('base64');
    if (userData.password_hash !== password_hash) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Check status
    if (userData.status === 'pending') {
      return res.status(403).json({
        error: 'Your account is pending approval. Please wait for admin to approve your access.',
        status: 'pending'
      });
    }

    if (userData.status === 'rejected') {
      return res.status(403).json({
        error: 'Your account has been rejected. Please contact admin.',
        status: 'rejected'
      });
    }

    // Update last login
    await db.collection('app_users').doc(userDoc.id).update({
      last_login: new Date().toISOString()
    });

    // Return user data (without password hash)
    const { password_hash: _, ...userDataWithoutPassword } = userData;

    res.json({
      message: 'Login successful',
      user: {
        id: userDoc.id,
        ...userDataWithoutPassword
      }
    });
  } catch (error) {
    console.error('Error logging in:', error);
    res.status(500).json({ error: error.message });
  }
});

// Approve user (admin only)
app.put('/api/users/:id/approve', async (req, res) => {
  try {
    const { id } = req.params;
    const { admin_password } = req.body;

    // Verify admin password
    if (admin_password !== ADMIN_PASSWORD) {
      return res.status(401).json({ error: 'Invalid admin password' });
    }

    const userRef = db.collection('app_users').doc(id);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      return res.status(404).json({ error: 'User not found' });
    }

    await userRef.update({
      status: 'approved',
      approved_at: new Date().toISOString()
    });

    console.log(`✅ User approved: ${userDoc.data().email}`);

    res.json({ message: 'User approved successfully' });
  } catch (error) {
    console.error('Error approving user:', error);
    res.status(500).json({ error: error.message });
  }
});

// Reject user (admin only)
app.put('/api/users/:id/reject', async (req, res) => {
  try {
    const { id } = req.params;
    const { admin_password } = req.body;

    // Verify admin password
    if (admin_password !== ADMIN_PASSWORD) {
      return res.status(401).json({ error: 'Invalid admin password' });
    }

    const userRef = db.collection('app_users').doc(id);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      return res.status(404).json({ error: 'User not found' });
    }

    await userRef.update({
      status: 'rejected',
      rejected_at: new Date().toISOString()
    });

    console.log(`❌ User rejected: ${userDoc.data().email}`);

    res.json({ message: 'User rejected' });
  } catch (error) {
    console.error('Error rejecting user:', error);
    res.status(500).json({ error: error.message });
  }
});

// Check if phone number exists and get status (for OTP login)
app.post('/api/users/check-phone', async (req, res) => {
  try {
    const { phone } = req.body;

    if (!phone) {
      return res.status(400).json({ error: 'Phone number is required' });
    }

    const usersSnapshot = await db.collection('app_users')
      .where('phone', '==', phone)
      .get();

    if (usersSnapshot.empty) {
      return res.json({ exists: false });
    }

    const userData = usersSnapshot.docs[0].data();

    res.json({
      exists: true,
      status: userData.status,
      name: userData.name
    });
  } catch (error) {
    console.error('Error checking phone:', error);
    res.status(500).json({ error: error.message });
  }
});

// Register new user with OTP (after OTP verification)
app.post('/api/users/register-with-otp', async (req, res) => {
  try {
    const { name, phone } = req.body;

    if (!name || !phone) {
      return res.status(400).json({ error: 'Name and phone are required' });
    }

    // Check if phone already exists
    const existingPhone = await db.collection('app_users')
      .where('phone', '==', phone)
      .get();

    if (!existingPhone.empty) {
      return res.status(400).json({ error: 'Phone number already registered' });
    }

    const userData = {
      name,
      phone,
      email: '',
      status: 'pending', // pending, approved, rejected
      role: 'user',
      created_at: new Date().toISOString(),
      phone_verified: true // OTP verified
    };

    const docRef = await db.collection('app_users').add(userData);

    console.log(`✅ New user registered via OTP: ${phone} (pending approval)`);

    res.status(201).json({
      message: 'Registration successful! Please wait for admin approval.',
      user_id: docRef.id
    });
  } catch (error) {
    console.error('Error registering user with OTP:', error);
    res.status(500).json({ error: error.message });
  }
});

// Login with OTP (after OTP verification)
app.post('/api/users/login-with-otp', async (req, res) => {
  try {
    const { phone } = req.body;

    if (!phone) {
      return res.status(400).json({ error: 'Phone number is required' });
    }

    const usersSnapshot = await db.collection('app_users')
      .where('phone', '==', phone)
      .get();

    if (usersSnapshot.empty) {
      return res.status(401).json({ error: 'User not found' });
    }

    const userDoc = usersSnapshot.docs[0];
    const userData = userDoc.data();

    // Check status
    if (userData.status === 'pending') {
      return res.status(403).json({
        error: 'Your account is pending approval. Please wait for admin to approve your access.',
        status: 'pending'
      });
    }

    if (userData.status === 'rejected') {
      return res.status(403).json({
        error: 'Your account has been rejected. Please contact admin.',
        status: 'rejected'
      });
    }

    // Update last login
    await db.collection('app_users').doc(userDoc.id).update({
      last_login: new Date().toISOString()
    });

    console.log(`✅ User logged in via OTP: ${phone}`);

    res.json({
      message: 'Login successful',
      user: {
        id: userDoc.id,
        name: userData.name,
        phone: userData.phone,
        role: userData.role,
        status: userData.status
      }
    });
  } catch (error) {
    console.error('Error logging in with OTP:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get all pending users (admin only)
app.get('/api/users/pending', async (req, res) => {
  try {
    const { admin_password } = req.query;

    // Verify admin password
    if (admin_password !== ADMIN_PASSWORD) {
      return res.status(401).json({ error: 'Invalid admin password' });
    }

    const pendingSnapshot = await db.collection('app_users')
      .where('status', '==', 'pending')
      .orderBy('created_at', 'desc')
      .get();

    const pendingUsers = [];
    pendingSnapshot.forEach(doc => {
      const data = doc.data();
      pendingUsers.push({
        id: doc.id,
        name: data.name,
        phone: data.phone,
        email: data.email,
        created_at: data.created_at
      });
    });

    res.json({ users: pendingUsers });
  } catch (error) {
    console.error('Error fetching pending users:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete user (admin only)
app.delete('/api/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { admin_password } = req.body;

    // Verify admin password
    if (admin_password !== ADMIN_PASSWORD) {
      return res.status(401).json({ error: 'Invalid admin password' });
    }

    const userRef = db.collection('app_users').doc(id);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      return res.status(404).json({ error: 'User not found' });
    }

    await userRef.delete();

    console.log(`🗑️ User deleted: ${userDoc.data().email}`);

    res.json({ message: 'User deleted' });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============ DATA ARCHIVING ROUTES ============

// Archive a closed loan (move to archived_loans collection)
app.post('/api/loans/:id/archive', async (req, res) => {
  try {
    const { id } = req.params;

    // Get the loan
    const loanDoc = await db.collection('loans').doc(id).get();

    if (!loanDoc.exists) {
      return res.status(404).json({ error: 'Loan not found' });
    }

    const loanData = loanDoc.data();

    // Only allow archiving closed loans
    if (loanData.status !== 'closed') {
      return res.status(400).json({ error: 'Only closed loans can be archived' });
    }

    // Get customer data
    const customerDoc = await db.collection('customers').doc(loanData.customer_id).get();
    const customerData = customerDoc.exists ? customerDoc.data() : { name: 'Unknown', phone: '' };

    // Get all payments for this loan
    const paymentsSnapshot = await db.collection('payments')
      .where('loan_id', '==', id)
      .get();

    const payments = [];
    paymentsSnapshot.forEach(doc => {
      payments.push({
        id: doc.id,
        ...doc.data()
      });
    });

    // Create archived loan document with all data
    const archivedLoanData = {
      ...loanData,
      original_loan_id: id,
      customer_name: customerData.name,
      customer_phone: customerData.phone,
      payments: payments,
      total_payments: payments.length,
      total_paid: loanData.loan_amount - loanData.balance,
      archived_at: new Date().toISOString()
    };

    // Add to archived_loans collection
    const archivedRef = await db.collection('archived_loans').add(archivedLoanData);

    // Delete original payments
    for (const paymentDoc of paymentsSnapshot.docs) {
      await paymentDoc.ref.delete();
    }

    // Delete original loan
    await db.collection('loans').doc(id).delete();

    console.log(`✅ Loan ${id} archived successfully as ${archivedRef.id}`);

    res.json({
      message: 'Loan archived successfully',
      archived_id: archivedRef.id,
      original_loan_id: id
    });
  } catch (error) {
    console.error('Error archiving loan:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get all archived loans
app.get('/api/archived-loans', async (req, res) => {
  try {
    const archivedSnapshot = await db.collection('archived_loans')
      .orderBy('archived_at', 'desc')
      .get();

    const archivedLoans = [];
    archivedSnapshot.forEach(doc => {
      archivedLoans.push({
        id: doc.id,
        ...doc.data()
      });
    });

    res.json(archivedLoans);
  } catch (error) {
    console.error('Error fetching archived loans:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get single archived loan by ID
app.get('/api/archived-loans/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const archivedDoc = await db.collection('archived_loans').doc(id).get();

    if (!archivedDoc.exists) {
      return res.status(404).json({ error: 'Archived loan not found' });
    }

    res.json({
      id: archivedDoc.id,
      ...archivedDoc.data()
    });
  } catch (error) {
    console.error('Error fetching archived loan:', error);
    res.status(500).json({ error: error.message });
  }
});

// Restore an archived loan (move back to active loans collection)
app.post('/api/archived-loans/:id/restore', async (req, res) => {
  try {
    const { id } = req.params;

    // Get the archived loan
    const archivedDoc = await db.collection('archived_loans').doc(id).get();

    if (!archivedDoc.exists) {
      return res.status(404).json({ error: 'Archived loan not found' });
    }

    const archivedData = archivedDoc.data();
    const payments = archivedData.payments || [];

    // Create loan document (without archived fields)
    const loanData = {
      customer_id: archivedData.customer_id,
      loan_name: archivedData.loan_name,
      loan_type: archivedData.loan_type,
      loan_amount: archivedData.loan_amount,
      weekly_amount: archivedData.weekly_amount || 0,
      monthly_amount: archivedData.monthly_amount || 0,
      balance: archivedData.balance,
      loan_given_date: archivedData.loan_given_date,
      start_date: archivedData.start_date,
      status: archivedData.status,
      created_at: archivedData.created_at,
      restored_at: new Date().toISOString()
    };

    // Add loan back to loans collection
    const loanRef = await db.collection('loans').add(loanData);
    const newLoanId = loanRef.id;

    // Restore all payments
    for (const payment of payments) {
      const { id: oldPaymentId, ...paymentData } = payment;
      await db.collection('payments').add({
        ...paymentData,
        loan_id: newLoanId
      });
    }

    // Delete archived loan
    await db.collection('archived_loans').doc(id).delete();

    console.log(`✅ Archived loan ${id} restored as ${newLoanId}`);

    res.json({
      message: 'Loan restored successfully',
      loan_id: newLoanId,
      archived_id: id
    });
  } catch (error) {
    console.error('Error restoring loan:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete archived loan permanently
app.delete('/api/archived-loans/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const archivedDoc = await db.collection('archived_loans').doc(id).get();

    if (!archivedDoc.exists) {
      return res.status(404).json({ error: 'Archived loan not found' });
    }

    await db.collection('archived_loans').doc(id).delete();

    res.json({ message: 'Archived loan deleted permanently' });
  } catch (error) {
    console.error('Error deleting archived loan:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============ DAILY FINANCE ROUTES ============
// Separate system for daily loans (100 days, 1% daily)
// Logic: Customer asks ₹10,000 → Give ₹9,000 → Pay ₹100/day × 100 days

// Get all daily customers with their loans
app.get('/api/daily-customers', async (req, res) => {
  try {
    const customersSnapshot = await db.collection('daily_customers').get();
    const customers = [];

    for (const doc of customersSnapshot.docs) {
      const customerData = { id: doc.id, ...doc.data() };

      // Get active loans for this customer
      const loansSnapshot = await db.collection('daily_loans')
        .where('customer_id', '==', doc.id)
        .where('status', '==', 'active')
        .get();

      const loans = [];
      let totalOutstanding = 0;

      for (const loanDoc of loansSnapshot.docs) {
        const loanData = loanDoc.data();
        loans.push({
          id: loanDoc.id,
          ...loanData
        });
        totalOutstanding += loanData.balance || 0;
      }

      customers.push({
        ...customerData,
        loans,
        total_loans: loans.length,
        total_outstanding: totalOutstanding
      });
    }

    customers.sort((a, b) => a.name.localeCompare(b.name));
    res.json(customers);
  } catch (error) {
    console.error('Error fetching daily customers:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create daily customer
app.post('/api/daily-customers', async (req, res) => {
  try {
    const { name, phone, aadhar, photo, signature } = req.body;

    if (!name || !phone) {
      return res.status(400).json({ error: 'Name and phone are required' });
    }

    const customerData = {
      name,
      phone,
      aadhar: aadhar || '',
      photo: photo || '', // Base64 image
      signature: signature || '', // Base64 image
      created_at: new Date().toISOString()
    };

    const docRef = await db.collection('daily_customers').add(customerData);
    res.status(201).json({ id: docRef.id, ...customerData });
  } catch (error) {
    console.error('Error creating daily customer:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get single daily customer with loans
app.get('/api/daily-customers/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const customerDoc = await db.collection('daily_customers').doc(id).get();

    if (!customerDoc.exists) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    const customerData = { id: customerDoc.id, ...customerDoc.data() };

    // Get all loans for this customer
    const loansSnapshot = await db.collection('daily_loans')
      .where('customer_id', '==', id)
      .get();

    const loans = [];
    for (const loanDoc of loansSnapshot.docs) {
      const loanData = loanDoc.data();

      // Get payments for this loan
      const paymentsSnapshot = await db.collection('daily_payments')
        .where('loan_id', '==', loanDoc.id)
        .get();

      const payments = paymentsSnapshot.docs.map(p => ({ id: p.id, ...p.data() }));
      payments.sort((a, b) => a.day_number - b.day_number);

      loans.push({
        id: loanDoc.id,
        ...loanData,
        payments,
        days_paid: payments.length
      });
    }

    res.json({ ...customerData, loans });
  } catch (error) {
    console.error('Error fetching daily customer:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update daily customer
app.put('/api/daily-customers/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, phone } = req.body;

    await db.collection('daily_customers').doc(id).update({ name, phone });
    const doc = await db.collection('daily_customers').doc(id).get();
    res.json({ id: doc.id, ...doc.data() });
  } catch (error) {
    console.error('Error updating daily customer:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete daily customer
app.delete('/api/daily-customers/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Delete all loans and payments for this customer
    const loansSnapshot = await db.collection('daily_loans')
      .where('customer_id', '==', id)
      .get();

    for (const loanDoc of loansSnapshot.docs) {
      // Delete payments
      const paymentsSnapshot = await db.collection('daily_payments')
        .where('loan_id', '==', loanDoc.id)
        .get();
      for (const paymentDoc of paymentsSnapshot.docs) {
        await paymentDoc.ref.delete();
      }
      // Delete loan
      await loanDoc.ref.delete();
    }

    // Delete customer
    await db.collection('daily_customers').doc(id).delete();
    res.json({ message: 'Daily customer deleted' });
  } catch (error) {
    console.error('Error deleting daily customer:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create daily loan
app.post('/api/daily-loans', async (req, res) => {
  try {
    const { customer_id, asked_amount, start_date, loan_given_date } = req.body;

    if (!customer_id || !asked_amount) {
      return res.status(400).json({ error: 'Customer ID and asked amount are required' });
    }

    // Calculate: Give 90%, daily payment = asked/100
    const given_amount = Math.floor(asked_amount * 0.9);
    const daily_amount = Math.floor(asked_amount / 100);
    const total_days = 100;
    const today = new Date().toISOString().split('T')[0];

    const loanData = {
      customer_id,
      asked_amount: Number(asked_amount),
      given_amount,
      daily_amount,
      total_days,
      balance: Number(asked_amount), // Total to be collected
      loan_given_date: loan_given_date || today, // When money was given
      start_date: start_date || today, // When payments start
      status: 'active',
      created_at: new Date().toISOString()
    };

    const docRef = await db.collection('daily_loans').add(loanData);

    // Get customer name for response
    const customerDoc = await db.collection('daily_customers').doc(customer_id).get();
    const customerName = customerDoc.exists ? customerDoc.data().name : 'Unknown';

    res.status(201).json({
      id: docRef.id,
      ...loanData,
      customer_name: customerName
    });
  } catch (error) {
    console.error('Error creating daily loan:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get single daily loan with payments
app.get('/api/daily-loans/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const loanDoc = await db.collection('daily_loans').doc(id).get();

    if (!loanDoc.exists) {
      return res.status(404).json({ error: 'Loan not found' });
    }

    const loanData = { id: loanDoc.id, ...loanDoc.data() };

    // Get customer info
    const customerDoc = await db.collection('daily_customers').doc(loanData.customer_id).get();
    if (customerDoc.exists) {
      loanData.customer_name = customerDoc.data().name;
      loanData.customer_phone = customerDoc.data().phone;
    }

    // Get payments
    const paymentsSnapshot = await db.collection('daily_payments')
      .where('loan_id', '==', id)
      .get();

    const payments = paymentsSnapshot.docs.map(p => ({ id: p.id, ...p.data() }));
    payments.sort((a, b) => a.day_number - b.day_number);

    loanData.payments = payments;
    loanData.days_paid = payments.length;

    res.json(loanData);
  } catch (error) {
    console.error('Error fetching daily loan:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete daily loan
app.delete('/api/daily-loans/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Delete all payments for this loan
    const paymentsSnapshot = await db.collection('daily_payments')
      .where('loan_id', '==', id)
      .get();

    for (const paymentDoc of paymentsSnapshot.docs) {
      await paymentDoc.ref.delete();
    }

    // Delete the loan
    await db.collection('daily_loans').doc(id).delete();
    res.json({ message: 'Daily loan deleted' });
  } catch (error) {
    console.error('Error deleting daily loan:', error);
    res.status(500).json({ error: error.message });
  }
});

// Record daily payment
app.post('/api/daily-payments', async (req, res) => {
  try {
    const { loan_id, amount, payment_date, latitude, longitude, address } = req.body;

    if (!loan_id) {
      return res.status(400).json({ error: 'Loan ID is required' });
    }

    // Get loan
    const loanRef = db.collection('daily_loans').doc(loan_id);
    const loanDoc = await loanRef.get();

    if (!loanDoc.exists) {
      return res.status(404).json({ error: 'Loan not found' });
    }

    const loanData = loanDoc.data();

    // Count existing payments to determine day number
    const paymentsSnapshot = await db.collection('daily_payments')
      .where('loan_id', '==', loan_id)
      .get();

    const day_number = paymentsSnapshot.size + 1;
    const paymentAmount = amount || loanData.daily_amount;

    const paymentData = {
      loan_id,
      day_number,
      amount: Number(paymentAmount),
      payment_date: payment_date || new Date().toISOString().split('T')[0],
      created_at: new Date().toISOString(),
      // GPS Location data
      latitude: latitude || null,
      longitude: longitude || null,
      address: address || ''
    };

    const paymentRef = await db.collection('daily_payments').add(paymentData);

    // Update loan balance
    const newBalance = loanData.balance - paymentAmount;
    const updateData = { balance: newBalance };

    // Close loan if fully paid
    if (newBalance <= 0 || day_number >= loanData.total_days) {
      updateData.status = 'closed';
      updateData.closed_at = new Date().toISOString();
    }

    await loanRef.update(updateData);

    res.status(201).json({
      id: paymentRef.id,
      ...paymentData,
      new_balance: newBalance,
      loan_status: newBalance <= 0 ? 'closed' : 'active'
    });
  } catch (error) {
    console.error('Error recording daily payment:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete daily payment
app.delete('/api/daily-payments/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const paymentDoc = await db.collection('daily_payments').doc(id).get();
    if (!paymentDoc.exists) {
      return res.status(404).json({ error: 'Payment not found' });
    }

    const paymentData = paymentDoc.data();

    // Update loan balance (add back the payment amount)
    const loanRef = db.collection('daily_loans').doc(paymentData.loan_id);
    const loanDoc = await loanRef.get();

    if (loanDoc.exists) {
      const loanData = loanDoc.data();
      await loanRef.update({
        balance: loanData.balance + paymentData.amount,
        status: 'active' // Reopen if was closed
      });
    }

    // Delete payment
    await db.collection('daily_payments').doc(id).delete();

    res.json({ message: 'Payment deleted' });
  } catch (error) {
    console.error('Error deleting daily payment:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get daily collections for a specific date (who should pay today)
app.get('/api/daily-collections/:date', async (req, res) => {
  try {
    const { date } = req.params; // YYYY-MM-DD format

    // Get all active daily loans
    const loansSnapshot = await db.collection('daily_loans')
      .where('status', '==', 'active')
      .get();

    const collections = [];

    for (const loanDoc of loansSnapshot.docs) {
      const loanData = loanDoc.data();
      const startDate = new Date(loanData.start_date);
      const targetDate = new Date(date);

      // Calculate day number for target date
      const diffTime = targetDate - startDate;
      const dayNumber = Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1;

      // Only include if within the 100 day period
      if (dayNumber >= 1 && dayNumber <= loanData.total_days) {
        // Check if payment already made for this day
        const paymentsSnapshot = await db.collection('daily_payments')
          .where('loan_id', '==', loanDoc.id)
          .where('day_number', '==', dayNumber)
          .get();

        const isPaid = !paymentsSnapshot.empty;

        // Get customer info
        const customerDoc = await db.collection('daily_customers').doc(loanData.customer_id).get();
        const customerData = customerDoc.exists ? customerDoc.data() : {};

        collections.push({
          loan_id: loanDoc.id,
          customer_id: loanData.customer_id,
          customer_name: customerData.name || 'Unknown',
          customer_phone: customerData.phone || '',
          asked_amount: loanData.asked_amount,
          daily_amount: loanData.daily_amount,
          day_number: dayNumber,
          is_paid: isPaid,
          balance: loanData.balance,
          start_date: loanData.start_date
        });
      }
    }

    // Sort by customer name
    collections.sort((a, b) => a.customer_name.localeCompare(b.customer_name));

    res.json(collections);
  } catch (error) {
    console.error('Error fetching daily collections:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get daily finance summary
app.get('/api/daily-summary', async (req, res) => {
  try {
    // Get all daily loans
    const loansSnapshot = await db.collection('daily_loans').get();

    let totalGiven = 0;
    let totalOutstanding = 0;
    let activeLoans = 0;
    let closedLoans = 0;

    loansSnapshot.forEach(doc => {
      const loan = doc.data();
      totalGiven += loan.given_amount || 0;

      if (loan.status === 'active') {
        totalOutstanding += loan.balance || 0;
        activeLoans++;
      } else {
        closedLoans++;
      }
    });

    // Get today's collections
    const today = new Date().toISOString().split('T')[0];
    const activeLoansSnapshot = await db.collection('daily_loans')
      .where('status', '==', 'active')
      .get();

    let todayExpected = 0;
    let todayCollected = 0;

    for (const loanDoc of activeLoansSnapshot.docs) {
      const loanData = loanDoc.data();
      const startDate = new Date(loanData.start_date);
      const todayDate = new Date(today);
      const dayNumber = Math.floor((todayDate - startDate) / (1000 * 60 * 60 * 24)) + 1;

      if (dayNumber >= 1 && dayNumber <= loanData.total_days) {
        todayExpected += loanData.daily_amount;

        // Check if paid today
        const paymentsSnapshot = await db.collection('daily_payments')
          .where('loan_id', '==', loanDoc.id)
          .where('payment_date', '==', today)
          .get();

        paymentsSnapshot.forEach(p => {
          todayCollected += p.data().amount || 0;
        });
      }
    }

    res.json({
      total_given: totalGiven,
      total_outstanding: totalOutstanding,
      active_loans: activeLoans,
      closed_loans: closedLoans,
      today_expected: todayExpected,
      today_collected: todayCollected
    });
  } catch (error) {
    console.error('Error fetching daily summary:', error);
    res.status(500).json({ error: error.message });
  }
});

// Close daily loan manually
app.put('/api/daily-loans/:id/close', async (req, res) => {
  try {
    const { id } = req.params;

    const loanRef = db.collection('daily_loans').doc(id);
    const loanDoc = await loanRef.get();

    if (!loanDoc.exists) {
      return res.status(404).json({ error: 'Loan not found' });
    }

    await loanRef.update({
      status: 'closed',
      closed_at: new Date().toISOString()
    });

    res.json({ message: 'Loan closed successfully' });
  } catch (error) {
    console.error('Error closing daily loan:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==================== USER COLLECTION TRACKING ====================

// Record a transfer from user to admin (user sends collected money to admin's bank)
app.post('/api/user-transfers', async (req, res) => {
  try {
    const { user_id, user_name, amount, transfer_date, transfer_mode, notes } = req.body;

    if (!user_id || !amount || !transfer_date) {
      return res.status(400).json({ error: 'User ID, amount, and transfer date are required' });
    }

    const transferData = {
      user_id,
      user_name: user_name || '',
      amount: Number(amount),
      transfer_date,
      transfer_mode: transfer_mode || 'bank', // bank, cash, upi
      notes: notes || '',
      status: 'pending', // pending, confirmed by admin
      created_at: new Date().toISOString()
    };

    const docRef = await db.collection('user_transfers').add(transferData);

    res.status(201).json({
      id: docRef.id,
      ...transferData,
      message: 'Transfer recorded successfully'
    });
  } catch (error) {
    console.error('Error recording transfer:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get all transfers for a specific user
app.get('/api/user-transfers/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { startDate, endDate } = req.query;

    let query = db.collection('user_transfers').where('user_id', '==', userId);

    const snapshot = await query.orderBy('created_at', 'desc').get();

    const transfers = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    // Filter by date if provided
    let filteredTransfers = transfers;
    if (startDate && endDate) {
      filteredTransfers = transfers.filter(t =>
        t.transfer_date >= startDate && t.transfer_date <= endDate
      );
    }

    // Calculate totals
    const totalTransferred = filteredTransfers.reduce((sum, t) => sum + t.amount, 0);

    res.json({
      transfers: filteredTransfers,
      totalTransferred
    });
  } catch (error) {
    console.error('Error fetching user transfers:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get collections summary for a user (payments they collected)
app.get('/api/user-collections/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { startDate, endDate } = req.query;

    // Get all payments collected by this user
    const paymentsSnapshot = await db.collection('payments')
      .where('collected_by', '==', userId)
      .get();

    let payments = paymentsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    // Filter by date if provided
    if (startDate && endDate) {
      payments = payments.filter(p =>
        p.payment_date >= startDate && p.payment_date <= endDate
      );
    }

    // Get customer and loan details for each payment
    const enrichedPayments = [];
    for (const payment of payments) {
      const loanDoc = await db.collection('loans').doc(payment.loan_id).get();
      if (loanDoc.exists) {
        const loanData = loanDoc.data();
        const customerDoc = await db.collection('customers').doc(loanData.customer_id).get();
        const customerData = customerDoc.exists ? customerDoc.data() : {};

        enrichedPayments.push({
          ...payment,
          customer_name: customerData.name || 'Unknown',
          customer_phone: customerData.phone || ''
        });
      }
    }

    // Calculate totals
    const totalCollected = enrichedPayments.reduce((sum, p) => sum + p.amount, 0);
    const cashCollected = enrichedPayments.filter(p => p.payment_mode === 'cash')
      .reduce((sum, p) => sum + p.amount, 0);
    const onlineCollected = enrichedPayments.filter(p => p.payment_mode !== 'cash')
      .reduce((sum, p) => sum + p.amount, 0);

    // Get transfers for this user
    const transfersSnapshot = await db.collection('user_transfers')
      .where('user_id', '==', userId)
      .get();

    let transfers = transfersSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    if (startDate && endDate) {
      transfers = transfers.filter(t =>
        t.transfer_date >= startDate && t.transfer_date <= endDate
      );
    }

    const totalTransferred = transfers.reduce((sum, t) => sum + t.amount, 0);
    const balanceInHand = totalCollected - totalTransferred;

    res.json({
      payments: enrichedPayments,
      transfers,
      summary: {
        totalCollected,
        cashCollected,
        onlineCollected,
        totalTransferred,
        balanceInHand
      }
    });
  } catch (error) {
    console.error('Error fetching user collections:', error);
    res.status(500).json({ error: error.message });
  }
});

// Admin: Get all users' collection summary
app.get('/api/admin/all-collections', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    // Get all approved users
    const usersSnapshot = await db.collection('app_users')
      .where('status', '==', 'approved')
      .get();

    const usersSummary = [];

    for (const userDoc of usersSnapshot.docs) {
      const userData = userDoc.data();
      const userId = userDoc.id;

      // Get payments collected by this user
      const paymentsSnapshot = await db.collection('payments')
        .where('collected_by', '==', userId)
        .get();

      let payments = paymentsSnapshot.docs.map(doc => doc.data());

      if (startDate && endDate) {
        payments = payments.filter(p =>
          p.payment_date >= startDate && p.payment_date <= endDate
        );
      }

      const totalCollected = payments.reduce((sum, p) => sum + p.amount, 0);

      // Get transfers from this user
      const transfersSnapshot = await db.collection('user_transfers')
        .where('user_id', '==', userId)
        .get();

      let transfers = transfersSnapshot.docs.map(doc => doc.data());

      if (startDate && endDate) {
        transfers = transfers.filter(t =>
          t.transfer_date >= startDate && t.transfer_date <= endDate
        );
      }

      const totalTransferred = transfers.reduce((sum, t) => sum + t.amount, 0);
      const balanceInHand = totalCollected - totalTransferred;

      if (totalCollected > 0 || totalTransferred > 0) {
        usersSummary.push({
          user_id: userId,
          user_name: userData.name,
          user_phone: userData.phone,
          totalCollected,
          totalTransferred,
          balanceInHand,
          paymentsCount: payments.length,
          transfersCount: transfers.length
        });
      }
    }

    // Sort by balance in hand (highest first)
    usersSummary.sort((a, b) => b.balanceInHand - a.balanceInHand);

    // Calculate grand totals
    const grandTotal = {
      totalCollected: usersSummary.reduce((sum, u) => sum + u.totalCollected, 0),
      totalTransferred: usersSummary.reduce((sum, u) => sum + u.totalTransferred, 0),
      totalBalanceInHand: usersSummary.reduce((sum, u) => sum + u.balanceInHand, 0)
    };

    res.json({
      users: usersSummary,
      grandTotal
    });
  } catch (error) {
    console.error('Error fetching all collections:', error);
    res.status(500).json({ error: error.message });
  }
});

// Admin: Confirm a user transfer
app.put('/api/user-transfers/:id/confirm', async (req, res) => {
  try {
    const { id } = req.params;

    await db.collection('user_transfers').doc(id).update({
      status: 'confirmed',
      confirmed_at: new Date().toISOString()
    });

    res.json({ message: 'Transfer confirmed' });
  } catch (error) {
    console.error('Error confirming transfer:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete a user transfer
app.delete('/api/user-transfers/:id', async (req, res) => {
  try {
    const { id } = req.params;

    await db.collection('user_transfers').doc(id).delete();

    res.json({ message: 'Transfer deleted' });
  } catch (error) {
    console.error('Error deleting transfer:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============ COMPLETE BACKUP ENDPOINT ============
// Download ALL data from database for backup
app.get('/api/backup/complete', async (req, res) => {
  try {
    console.log('📦 Starting complete backup...');

    // Fetch ALL collections in parallel
    const [
      customersSnapshot,
      loansSnapshot,
      paymentsSnapshot,
      vaddiEntriesSnapshot,
      vaddiPaymentsSnapshot,
      dailyCustomersSnapshot,
      dailyLoansSnapshot,
      dailyPaymentsSnapshot,
      investmentsSnapshot
    ] = await Promise.all([
      db.collection('customers').get(),
      db.collection('loans').get(),
      db.collection('payments').get(),
      db.collection('vaddi_entries').get(),
      db.collection('vaddi_payments').get(),
      db.collection('daily_customers').get(),
      db.collection('daily_loans').get(),
      db.collection('daily_payments').get(),
      db.collection('investments').get()
    ]);

    // Build backup data object
    const backupData = {
      backup_date: new Date().toISOString(),
      backup_version: '1.0',

      // Weekly Finance - Customers
      customers: customersSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })),

      // Weekly Finance - Loans
      loans: loansSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })),

      // Weekly Finance - Payments
      payments: paymentsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })),

      // Vaddi (Interest) - Entries
      vaddi_entries: vaddiEntriesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })),

      // Vaddi (Interest) - Monthly Payments
      vaddi_payments: vaddiPaymentsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })),

      // Daily Finance (100 Days) - Customers
      daily_customers: dailyCustomersSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })),

      // Daily Finance (100 Days) - Loans
      daily_loans: dailyLoansSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })),

      // Daily Finance (100 Days) - Payments
      daily_payments: dailyPaymentsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })),

      // Investments
      investments: investmentsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })),

      // Summary counts
      summary: {
        customers: customersSnapshot.size,
        loans: loansSnapshot.size,
        payments: paymentsSnapshot.size,
        vaddi_entries: vaddiEntriesSnapshot.size,
        vaddi_payments: vaddiPaymentsSnapshot.size,
        daily_customers: dailyCustomersSnapshot.size,
        daily_loans: dailyLoansSnapshot.size,
        daily_payments: dailyPaymentsSnapshot.size,
        investments: investmentsSnapshot.size
      }
    };

    console.log('✅ Backup complete:', backupData.summary);

    // Set headers for file download
    const filename = `Finance_Complete_Backup_${new Date().toISOString().split('T')[0]}.json`;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    res.json(backupData);
  } catch (error) {
    console.error('Error creating backup:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============ CHIT FUND ENDPOINTS ============

// Get all chit groups with payment summary for current month
app.get('/api/chit-groups', async (req, res) => {
  try {
    const month = req.query.month || `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;

    const groupsSnapshot = await db.collection('chit_groups').orderBy('day_of_month').get();

    const groups = await Promise.all(groupsSnapshot.docs.map(async (doc) => {
      const data = doc.data();

      // Count paid members for this month
      const paymentsSnapshot = await db.collection('chit_payments')
        .where('chit_group_id', '==', doc.id)
        .where('month', '==', month)
        .get();

      return {
        id: doc.id,
        ...data,
        paid_count: paymentsSnapshot.size
      };
    }));

    res.json(groups);
  } catch (error) {
    console.error('Error fetching chit groups:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get single chit group with members and payment status
app.get('/api/chit-groups/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const month = req.query.month || `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;

    const groupDoc = await db.collection('chit_groups').doc(id).get();
    if (!groupDoc.exists) {
      return res.status(404).json({ error: 'Chit group not found' });
    }

    // Get all members (no orderBy to avoid index issues with optional fields)
    const membersSnapshot = await db.collection('chit_members')
      .where('chit_group_id', '==', id)
      .get();

    // Get payments for this month
    const paymentsSnapshot = await db.collection('chit_payments')
      .where('chit_group_id', '==', id)
      .where('month', '==', month)
      .get();

    const paymentsByMember = {};
    paymentsSnapshot.docs.forEach(doc => {
      const data = doc.data();
      paymentsByMember[data.member_id] = { id: doc.id, ...data };
    });

    const members = membersSnapshot.docs.map(doc => {
      const data = doc.data();
      const payment = paymentsByMember[doc.id];
      return {
        id: doc.id,
        ...data,
        is_paid: !!payment,
        payment_id: payment?.id,
        payment_date: payment?.payment_date
      };
    });

    // Sort by member_number (if exists) then by name
    members.sort((a, b) => {
      if (a.member_number && b.member_number) return a.member_number - b.member_number;
      if (a.member_number) return -1;
      if (b.member_number) return 1;
      return (a.name || '').localeCompare(b.name || '');
    });

    res.json({
      id: groupDoc.id,
      ...groupDoc.data(),
      members,
      paid_count: paymentsSnapshot.size
    });
  } catch (error) {
    console.error('Error fetching chit group:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create new chit group
app.post('/api/chit-groups', async (req, res) => {
  try {
    const { name, chit_amount, member_count, day_of_month, duration_months, monthly_amount } = req.body;

    if (!name || !chit_amount || !member_count || !day_of_month) {
      return res.status(400).json({ error: 'Name, chit amount, member count, and day of month are required' });
    }

    const newGroup = {
      name,
      chit_amount: Number(chit_amount),
      member_count: Number(member_count),
      day_of_month: Number(day_of_month),
      duration_months: Number(duration_months) || 20,
      monthly_amount: Number(monthly_amount) || Math.round(chit_amount / member_count),
      status: 'active',
      created_at: new Date().toISOString()
    };

    const docRef = await db.collection('chit_groups').add(newGroup);

    res.json({ id: docRef.id, ...newGroup });
  } catch (error) {
    console.error('Error creating chit group:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update chit group
app.put('/api/chit-groups/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    await db.collection('chit_groups').doc(id).update(updates);

    res.json({ message: 'Chit group updated' });
  } catch (error) {
    console.error('Error updating chit group:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete chit group
app.delete('/api/chit-groups/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Delete all members and payments first
    const membersSnapshot = await db.collection('chit_members').where('chit_group_id', '==', id).get();
    const paymentsSnapshot = await db.collection('chit_payments').where('chit_group_id', '==', id).get();

    const batch = db.batch();
    membersSnapshot.docs.forEach(doc => batch.delete(doc.ref));
    paymentsSnapshot.docs.forEach(doc => batch.delete(doc.ref));
    batch.delete(db.collection('chit_groups').doc(id));

    await batch.commit();

    res.json({ message: 'Chit group deleted' });
  } catch (error) {
    console.error('Error deleting chit group:', error);
    res.status(500).json({ error: error.message });
  }
});

// Add member to chit group
app.post('/api/chit-members', async (req, res) => {
  try {
    const { chit_group_id, name, phone, member_number } = req.body;

    if (!chit_group_id || !name) {
      return res.status(400).json({ error: 'Chit group ID and name are required' });
    }

    // Get next member number if not provided
    let finalMemberNumber = member_number;
    if (!finalMemberNumber) {
      const existingMembers = await db.collection('chit_members')
        .where('chit_group_id', '==', chit_group_id)
        .get();
      finalMemberNumber = existingMembers.size + 1;
    }

    const newMember = {
      chit_group_id,
      name,
      phone: phone || null,
      member_number: Number(finalMemberNumber),
      created_at: new Date().toISOString()
    };

    const docRef = await db.collection('chit_members').add(newMember);

    res.json({ id: docRef.id, ...newMember });
  } catch (error) {
    console.error('Error adding chit member:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update chit member
app.put('/api/chit-members/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    await db.collection('chit_members').doc(id).update(updates);

    res.json({ message: 'Member updated' });
  } catch (error) {
    console.error('Error updating chit member:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete chit member
app.delete('/api/chit-members/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Delete member's payments too
    const paymentsSnapshot = await db.collection('chit_payments').where('member_id', '==', id).get();
    const batch = db.batch();
    paymentsSnapshot.docs.forEach(doc => batch.delete(doc.ref));
    batch.delete(db.collection('chit_members').doc(id));

    await batch.commit();

    res.json({ message: 'Member deleted' });
  } catch (error) {
    console.error('Error deleting chit member:', error);
    res.status(500).json({ error: error.message });
  }
});

// Record chit payment
app.post('/api/chit-payments', async (req, res) => {
  try {
    const { chit_group_id, member_id, month, amount, payment_date } = req.body;

    if (!chit_group_id || !member_id || !month || !amount) {
      return res.status(400).json({ error: 'Chit group ID, member ID, month, and amount are required' });
    }

    // Check if payment already exists for this month
    const existingPayment = await db.collection('chit_payments')
      .where('chit_group_id', '==', chit_group_id)
      .where('member_id', '==', member_id)
      .where('month', '==', month)
      .get();

    if (!existingPayment.empty) {
      return res.status(400).json({ error: 'Payment already recorded for this month' });
    }

    const newPayment = {
      chit_group_id,
      member_id,
      month,
      amount: Number(amount),
      payment_date: payment_date || new Date().toISOString().split('T')[0],
      created_at: new Date().toISOString()
    };

    const docRef = await db.collection('chit_payments').add(newPayment);

    res.json({ id: docRef.id, ...newPayment });
  } catch (error) {
    console.error('Error recording chit payment:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete chit payment (undo)
app.delete('/api/chit-payments/:id', async (req, res) => {
  try {
    const { id } = req.params;

    await db.collection('chit_payments').doc(id).delete();

    res.json({ message: 'Payment deleted' });
  } catch (error) {
    console.error('Error deleting chit payment:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get chit payment history for a member
app.get('/api/chit-members/:id/payments', async (req, res) => {
  try {
    const { id } = req.params;

    const paymentsSnapshot = await db.collection('chit_payments')
      .where('member_id', '==', id)
      .orderBy('month', 'desc')
      .get();

    const payments = paymentsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    res.json(payments);
  } catch (error) {
    console.error('Error fetching member payments:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get chit settings for a group/month
app.get('/api/chit-settings/:groupId/:month', async (req, res) => {
  try {
    const { groupId, month } = req.params;
    const docId = `${groupId}_${month}`;

    const doc = await db.collection('chit_settings').doc(docId).get();

    if (doc.exists) {
      res.json({ id: doc.id, ...doc.data() });
    } else {
      res.json({ chit_number: '', custom_note: '' });
    }
  } catch (error) {
    console.error('Error fetching chit settings:', error);
    res.status(500).json({ error: error.message });
  }
});

// Save chit settings for a group/month
app.put('/api/chit-settings/:groupId/:month', async (req, res) => {
  try {
    const { groupId, month } = req.params;
    const { chit_number, custom_note } = req.body;
    const docId = `${groupId}_${month}`;

    const settings = {
      chit_group_id: groupId,
      month,
      chit_number: chit_number || '',
      custom_note: custom_note || '',
      updated_at: new Date().toISOString()
    };

    await db.collection('chit_settings').doc(docId).set(settings, { merge: true });

    res.json({ id: docId, ...settings });
  } catch (error) {
    console.error('Error saving chit settings:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============ CHIT AUCTION/BIDDING ============

// Get auction for a group/month
app.get('/api/chit-auctions/:groupId/:month', async (req, res) => {
  try {
    const { groupId, month } = req.params;
    const docId = `${groupId}_${month}`;

    const doc = await db.collection('chit_auctions').doc(docId).get();

    if (doc.exists) {
      res.json({ id: doc.id, ...doc.data() });
    } else {
      res.json({
        winner_member_id: '',
        winner_name: '',
        bid_amount: 0,
        commission: 0,
        total_collected: 0,
        amount_to_winner: 0,
        carry_forward: 0,
        auction_date: '',
        disbursement_date: '',
        winner_photo: '',
        winner_signature: '',
        notes: ''
      });
    }
  } catch (error) {
    console.error('Error fetching chit auction:', error);
    res.status(500).json({ error: error.message });
  }
});

// Save auction for a group/month (or group/slot for multiple auctions in same month)
app.put('/api/chit-auctions/:groupId/:month', async (req, res) => {
  try {
    const { groupId, month } = req.params;
    const {
      slot_number,
      winner_member_id,
      winner_name,
      bid_amount,
      commission,
      total_collected,
      amount_to_winner,
      carry_forward,
      auction_date,
      disbursement_date,
      winner_photo,
      winner_signature,
      notes
    } = req.body;

    // Use slot_number in docId if provided, otherwise use month
    const docId = slot_number ? `${groupId}_slot_${slot_number}` : `${groupId}_${month}`;

    const auctionData = {
      chit_group_id: groupId,
      month,
      slot_number: Number(slot_number) || null,
      winner_member_id: winner_member_id || '',
      winner_name: winner_name || '',
      bid_amount: Number(bid_amount) || 0,
      commission: Number(commission) || 0,
      total_collected: Number(total_collected) || 0,
      amount_to_winner: Number(amount_to_winner) || 0,
      carry_forward: Number(carry_forward) || 0,
      auction_date: auction_date || '',
      disbursement_date: disbursement_date || '',
      winner_photo: winner_photo || '',
      winner_signature: winner_signature || '',
      notes: notes || '',
      updated_at: new Date().toISOString()
    };

    await db.collection('chit_auctions').doc(docId).set(auctionData, { merge: true });

    res.json({ id: docId, ...auctionData });
  } catch (error) {
    console.error('Error saving chit auction:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get all auctions for a chit group (history) - sorted by slot_number
app.get('/api/chit-auctions/:groupId', async (req, res) => {
  try {
    const { groupId } = req.params;

    const auctionsSnapshot = await db.collection('chit_auctions')
      .where('chit_group_id', '==', groupId)
      .get();

    let auctions = auctionsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    // Sort by slot_number (ascending), then by month for those without slot_number
    auctions = auctions.sort((a, b) => {
      if (a.slot_number && b.slot_number) {
        return a.slot_number - b.slot_number;
      }
      if (a.slot_number) return -1;
      if (b.slot_number) return 1;
      return (b.month || '').localeCompare(a.month || '');
    });

    res.json(auctions);
  } catch (error) {
    console.error('Error fetching chit auctions:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============ WHATSAPP SETTINGS ============

// Get WhatsApp settings (language, quick note)
app.get('/api/whatsapp-settings', async (req, res) => {
  try {
    const doc = await db.collection('app_settings').doc('whatsapp').get();

    if (doc.exists) {
      res.json({ id: doc.id, ...doc.data() });
    } else {
      res.json({ language: 'english', quick_note: '' });
    }
  } catch (error) {
    console.error('Error fetching whatsapp settings:', error);
    res.status(500).json({ error: error.message });
  }
});

// Save WhatsApp settings
app.put('/api/whatsapp-settings', async (req, res) => {
  try {
    const { language, quick_note } = req.body;

    const settings = {
      language: language || 'english',
      quick_note: quick_note || '',
      updated_at: new Date().toISOString()
    };

    await db.collection('app_settings').doc('whatsapp').set(settings, { merge: true });

    res.json({ id: 'whatsapp', ...settings });
  } catch (error) {
    console.error('Error saving whatsapp settings:', error);
    res.status(500).json({ error: error.message });
  }
});

// Start server (only in local development)
if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

// Export for Vercel serverless deployment
export default app;
