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

// Get all customers with their active loans
app.get('/api/customers', async (req, res) => {
  try {
    const { search } = req.query;
    let customersQuery = db.collection('customers');

    // Get all customers
    const customersSnapshot = await customersQuery.get();
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

      // Get ALL active loans for this customer (grouped approach)
      const loansSnapshot = await db.collection('loans')
        .where('customer_id', '==', doc.id)
        .where('status', '==', 'active')
        .get();

      const loans = [];
      let totalBalance = 0;

      if (!loansSnapshot.empty) {
        // Build array of all loans for this customer
        for (const loanDoc of loansSnapshot.docs) {
          const loanData = loanDoc.data();

          // Get last payment date for this specific loan
          let lastPaymentDate = null;
          try {
            const paymentsSnapshot = await db.collection('payments')
              .where('loan_id', '==', loanDoc.id)
              .get();

            if (!paymentsSnapshot.empty) {
              // Sort by payment_date in memory to avoid needing a Firestore index
              const payments = paymentsSnapshot.docs.map(doc => doc.data());
              payments.sort((a, b) => new Date(b.payment_date) - new Date(a.payment_date));
              lastPaymentDate = payments[0].payment_date;
            }
          } catch (error) {
            // If payments query fails, just set to null
            lastPaymentDate = null;
          }

          loans.push({
            loan_id: loanDoc.id,
            loan_name: loanData.loan_name || 'General Loan', // Include loan name
            loan_type: loanData.loan_type || 'Weekly', // Default to Weekly for old loans
            loan_amount: loanData.loan_amount,
            balance: loanData.balance,
            weekly_amount: loanData.weekly_amount || 0,
            monthly_amount: loanData.monthly_amount || 0,
            status: loanData.status,
            start_date: loanData.start_date,
            loan_given_date: loanData.loan_given_date,
            last_payment_date: lastPaymentDate,
            created_at: loanData.created_at
          });

          totalBalance += loanData.balance;
        }
      }

      // Add customer with all their loans grouped together
      customers.push({
        ...customerData,
        loans: loans,
        total_active_loans: loans.length,
        total_balance: totalBalance
      });
    }

    // Sort by name
    customers.sort((a, b) => a.name.localeCompare(b.name));

    res.json(customers);
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
    const customerData = customerDoc.data();

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

// Update loan (for editing loan details like loan_name)
app.put('/api/loans/:id', async (req, res) => {
  try {
    const { loan_name, status } = req.body;
    const updateData = {};

    // Only update fields that are provided
    if (loan_name !== undefined) updateData.loan_name = loan_name;
    if (status !== undefined) updateData.status = status;

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

// ============ PAYMENT ROUTES ============

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
    const { loan_id, amount, payment_date, payment_mode, offline_amount, online_amount } = req.body;

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

    // Update each payment with correct sequential period_number
    const updatePromises = paymentsToUpdate.map((payment, index) => {
      return db.collection('payments').doc(payment.id).update({
        period_number: index + 1
      });
    });

    await Promise.all(updatePromises);

    res.json({ message: 'Payment deleted and week numbers recalculated successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Fix all existing payment week numbers (one-time migration)
app.post('/api/migrate-payment-numbers', async (req, res) => {
  try {
    // Get all loans
    const loansSnapshot = await db.collection('loans').get();
    let totalFixed = 0;

    for (const loanDoc of loansSnapshot.docs) {
      const loanId = loanDoc.id;

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

      // Update each payment with correct sequential period_number
      for (let i = 0; i < payments.length; i++) {
        await db.collection('payments').doc(payments[i].id).update({
          period_number: i + 1
        });
        totalFixed++;
      }
    }

    res.json({
      message: 'All payment week numbers recalculated successfully',
      totalFixed
    });
  } catch (error) {
    console.error('Error migrating payment numbers:', error);
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

// Start server (only in local development)
if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

// Export for Vercel serverless deployment
export default app;
