import express from 'express';
import cors from 'cors';
import db from './firestore.js';

const app = express();
const PORT = process.env.PORT || 3000;

// ⚡ DEPLOYMENT v3.3.0 - Jan 19, 2025 23:50 - FORCE REBUILD
// CONFIRMED: NO phone uniqueness check - Duplicate phones ARE ALLOWED
// Using Firestore (NOT SQLite) - NO UNIQUE constraint on phone field
const VERSION = '3.3.0';
console.log(`🚀 Backend v${VERSION} - DUPLICATE PHONES ALLOWED`);

// CORS configuration for production
const corsOptions = {
  origin: process.env.CLIENT_URL || '*',
  credentials: true
};

app.use(cors(corsOptions));
app.use(express.json());

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

      // Get active loan for this customer
      const loansSnapshot = await db.collection('loans')
        .where('customer_id', '==', doc.id)
        .where('status', '==', 'active')
        .limit(1)
        .get();

      if (!loansSnapshot.empty) {
        const loanDoc = loansSnapshot.docs[0];
        const loanData = loanDoc.data();

        // Get last payment date
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

        customers.push({
          ...customerData,
          loan_id: loanDoc.id,
          loan_amount: loanData.loan_amount,
          balance: loanData.balance,
          weekly_amount: loanData.weekly_amount,
          status: loanData.status,
          last_payment_date: lastPaymentDate
        });
      } else {
        customers.push(customerData);
      }
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
    const totalWeeks = Math.ceil(loanData.loan_amount / loanData.weekly_amount);
    const weeksRemaining = Math.ceil(loanData.balance / loanData.weekly_amount);

    res.json({
      id: loanDoc.id,
      ...loanData,
      customer_name: customerData.name,
      customer_phone: customerData.phone,
      payments,
      totalPaid,
      progressPercent,
      totalWeeks,
      weeksRemaining
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create new loan
app.post('/api/loans', async (req, res) => {
  try {
    const { customer_id, loan_amount, weekly_amount, loan_given_date, start_date } = req.body;

    if (!customer_id || !loan_amount || !weekly_amount || !loan_given_date || !start_date) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    // Validate that start_date is a Sunday
    const startDate = new Date(start_date);
    if (startDate.getDay() !== 0) {
      return res.status(400).json({ error: 'Loans can only start on Sundays' });
    }

    // Check if customer has an active loan
    const existingLoansSnapshot = await db.collection('loans')
      .where('customer_id', '==', customer_id)
      .where('status', '==', 'active')
      .limit(1)
      .get();

    if (!existingLoansSnapshot.empty) {
      return res.status(400).json({ error: 'Customer already has an active loan' });
    }

    const loanData = {
      customer_id,
      loan_amount,
      weekly_amount,
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

    // Validate that payment_date is a Sunday
    const paymentDate = new Date(payment_date);
    if (paymentDate.getDay() !== 0) {
      return res.status(400).json({ error: 'Payments can only be made on Sundays' });
    }

    // Get loan details
    const loanDoc = await db.collection('loans').doc(loan_id).get();

    if (!loanDoc.exists) {
      return res.status(404).json({ error: 'Loan not found' });
    }

    const loanData = loanDoc.data();

    if (loanData.status !== 'active') {
      return res.status(400).json({ error: 'Loan is not active' });
    }

    if (amount > loanData.balance) {
      return res.status(400).json({ error: 'Payment amount exceeds loan balance' });
    }

    // Calculate payment details
    const weeksCovered = amount / loanData.weekly_amount;
    const newBalance = loanData.balance - amount;

    // Get current week number (count existing payments + 1)
    const paymentsSnapshot = await db.collection('payments')
      .where('loan_id', '==', loan_id)
      .get();
    const weekNumber = paymentsSnapshot.size + 1;

    // Create payment data
    const paymentData = {
      loan_id,
      amount,
      payment_date,
      payment_mode: payment_mode || 'cash',
      offline_amount: offline_amount || 0,
      online_amount: online_amount || 0,
      weeks_covered: weeksCovered,
      week_number: weekNumber,
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
      customer_phone: customerData.phone
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

    res.json({ message: 'Payment deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============ DASHBOARD STATS ============

app.get('/api/stats', async (req, res) => {
  try {
    // Active loans count
    const activeLoansSnapshot = await db.collection('loans')
      .where('status', '==', 'active')
      .get();
    const activeLoans = activeLoansSnapshot.size;

    // Outstanding balance (sum of all active loan balances)
    let outstanding = 0;
    activeLoansSnapshot.forEach(doc => {
      outstanding += doc.data().balance;
    });

    // Total customers count
    const customersSnapshot = await db.collection('customers').get();
    const totalCustomers = customersSnapshot.size;

    // Payments this week
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const weekAgoStr = weekAgo.toISOString().split('T')[0];

    const paymentsSnapshot = await db.collection('payments')
      .where('payment_date', '>=', weekAgoStr)
      .get();
    const paymentsThisWeek = paymentsSnapshot.size;

    res.json({
      activeLoans,
      outstanding,
      totalCustomers,
      paymentsThisWeek
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

// Start server (only in local development)
if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

// Export for Vercel serverless deployment
export default app;
