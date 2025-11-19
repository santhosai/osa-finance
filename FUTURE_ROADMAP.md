# Om Sai Murugan Finance - Future Roadmap & Development Guide

**Last Updated**: January 2025
**Purpose**: Comprehensive guide for future development without AI assistance

---

## Table of Contents
1. [Feature Roadmap](#feature-roadmap)
2. [Performance Optimization Guide](#performance-optimization-guide)
3. [Scalability Improvements](#scalability-improvements)
4. [Security Enhancements](#security-enhancements)
5. [Code Patterns & Best Practices](#code-patterns--best-practices)
6. [Common Issues & Solutions](#common-issues--solutions)
7. [Database Schema Reference](#database-schema-reference)
8. [API Endpoints Reference](#api-endpoints-reference)

---

## Feature Roadmap

### Priority 1: Essential Features (Implement Next)

#### 1. Edit Payment
**Why**: Users currently have to delete and re-add payments to fix mistakes
**Impact**: High - improves user experience significantly

**Implementation Steps**:
1. Add "Edit" button next to "Delete" button in `LoanDetails.jsx`
2. Create `EditPaymentModal.jsx` component (copy `AddPaymentModal.jsx` as template)
3. Pre-fill form with existing payment data
4. On save, calculate difference and update loan balance
5. Use PUT endpoint: `/api/payments/:id`

**Backend Code** (add to `server/index.js`):
```javascript
app.put('/api/payments/:id', async (req, res) => {
  try {
    const { amount, date } = req.body;
    const paymentDoc = await db.collection('payments').doc(req.params.id).get();

    if (!paymentDoc.exists) {
      return res.status(404).json({ error: 'Payment not found' });
    }

    const oldPaymentData = paymentDoc.data();
    const loanDoc = await db.collection('loans').doc(oldPaymentData.loan_id).get();
    const loanData = loanDoc.data();

    // Calculate balance adjustment
    const difference = amount - oldPaymentData.amount;
    const newBalance = loanData.balance - difference;

    // Update payment
    await db.collection('payments').doc(req.params.id).update({
      amount: parseFloat(amount),
      date: date || oldPaymentData.date
    });

    // Update loan balance
    await db.collection('loans').doc(oldPaymentData.loan_id).update({
      balance: newBalance
    });

    res.json({ message: 'Payment updated successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

**Frontend Code** (in `LoanDetails.jsx`):
```javascript
const [editPayment, setEditPayment] = useState(null);

const handleEditPayment = async (paymentId, newAmount, newDate) => {
  try {
    const response = await fetch(`${API_URL}/payments/${paymentId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: newAmount, date: newDate })
    });

    if (response.ok) {
      fetchLoanDetails(); // Refresh data
      setEditPayment(null);
    }
  } catch (error) {
    console.error('Error updating payment:', error);
    alert('Failed to update payment');
  }
};
```

---

#### 2. Bulk Sunday Collection Payment
**Why**: Currently have to click each customer individually - very time consuming
**Impact**: High - saves 15-20 minutes every Sunday

**Implementation Steps**:
1. In `SundayCollections.jsx`, add checkbox column
2. Add "Mark Selected as Paid" button at top
3. Show total amount to be collected
4. On confirm, loop through and create payment for each selected customer
5. Show success count (e.g., "15 payments recorded successfully")

**Frontend Code** (add to `SundayCollections.jsx`):
```javascript
const [selectedCustomers, setSelectedCustomers] = useState([]);

const handleSelectCustomer = (customerId) => {
  if (selectedCustomers.includes(customerId)) {
    setSelectedCustomers(selectedCustomers.filter(id => id !== customerId));
  } else {
    setSelectedCustomers([...selectedCustomers, customerId]);
  }
};

const handleBulkPayment = async () => {
  const totalAmount = customers
    .filter(c => selectedCustomers.includes(c.id))
    .reduce((sum, c) => sum + c.weekly_amount, 0);

  const confirmed = window.confirm(
    `Record payments for ${selectedCustomers.length} customers?\n\n` +
    `Total amount: ₹${totalAmount.toLocaleString('en-IN')}`
  );

  if (!confirmed) return;

  let successCount = 0;
  for (const customerId of selectedCustomers) {
    const customer = customers.find(c => c.id === customerId);
    try {
      const response = await fetch(`${API_URL}/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          loan_id: customer.loan_id,
          customer_id: customerId,
          amount: customer.weekly_amount,
          date: new Date().toISOString().split('T')[0]
        })
      });
      if (response.ok) successCount++;
    } catch (error) {
      console.error('Error recording payment for customer:', customerId);
    }
  }

  alert(`${successCount} payments recorded successfully!`);
  setSelectedCustomers([]);
  fetchCustomers(); // Refresh list
};
```

**Add this UI**:
```javascript
// Add checkbox in customer row
<input
  type="checkbox"
  checked={selectedCustomers.includes(customer.id)}
  onChange={() => handleSelectCustomer(customer.id)}
/>

// Add bulk payment button at top
{selectedCustomers.length > 0 && (
  <button onClick={handleBulkPayment} className="btn-primary">
    Mark {selectedCustomers.length} as Paid
  </button>
)}
```

---

#### 3. Search in Overdue Payments
**Why**: When list gets long, hard to find specific customer
**Impact**: Medium - improves usability

**Implementation**:
```javascript
const [searchTerm, setSearchTerm] = useState('');

const filteredCustomers = customers.filter(customer =>
  customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
  customer.phone.includes(searchTerm)
);

// Add search box
<input
  type="text"
  placeholder="Search by name or phone..."
  value={searchTerm}
  onChange={(e) => setSearchTerm(e.target.value)}
  style={{
    padding: '12px',
    borderRadius: '8px',
    border: '1px solid #e5e7eb',
    width: '100%',
    marginBottom: '16px'
  }}
/>
```

---

#### 4. Customer Payment History (All Loans)
**Why**: Can only see current loan payments, not past closed loans
**Impact**: Medium - helpful for customer disputes or reference

**Implementation**:
1. Add "Payment History" button in customer row on Customers page
2. Create `CustomerPaymentHistory.jsx` modal
3. Fetch all loans for customer (including closed ones)
4. Show each loan with its payments in timeline format

**Backend Endpoint** (add to `server/index.js`):
```javascript
app.get('/api/customers/:id/full-history', async (req, res) => {
  try {
    // Get all loans for this customer (active + closed)
    const loansSnapshot = await db.collection('loans')
      .where('customer_id', '==', req.params.id)
      .get();

    const loans = [];
    for (const doc of loansSnapshot.docs) {
      const loanData = { id: doc.id, ...doc.data() };

      // Get payments for this loan
      const paymentsSnapshot = await db.collection('payments')
        .where('loan_id', '==', doc.id)
        .orderBy('date', 'desc')
        .get();

      loanData.payments = paymentsSnapshot.docs.map(p => ({
        id: p.id,
        ...p.data()
      }));

      loans.push(loanData);
    }

    res.json(loans);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

---

### Priority 2: Nice-to-Have Features

#### 5. Reopen Closed Loan
**Why**: Sometimes accidentally close loan or customer wants to continue
**Implementation**: Add "Reopen Loan" button in LoanDetails for closed loans

```javascript
const reopenLoan = async () => {
  const confirmed = window.confirm('Reopen this closed loan?');
  if (!confirmed) return;

  const response = await fetch(`${API_URL}/loans/${loan.id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'active' })
  });

  if (response.ok) {
    alert('Loan reopened successfully!');
    fetchLoanDetails();
  }
};
```

---

#### 6. Customer Notes/Comments
**Why**: Remember specific details about customer (e.g., "Pays on Mondays instead of Sundays")
**Implementation**: Add `notes` field to customers table, show in CustomerDetails

```javascript
// Add to CustomerDetails.jsx
<div className="form-group">
  <label className="form-label">Notes</label>
  <textarea
    value={notes}
    onChange={(e) => setNotes(e.target.value)}
    placeholder="Any special notes about this customer..."
    rows="3"
    style={{ width: '100%', padding: '8px' }}
  />
</div>
```

---

#### 7. Weekly/Monthly Reports
**Why**: Track business performance over time
**Show**:
- Total loans given this week/month
- Total payments collected
- Total vaddi earned
- Number of new customers
- Number of closed loans

**Implementation**: Create `Reports.jsx` component with date range picker

---

#### 8. Payment Receipt Download
**Why**: Give customers proof of payment
**Implementation**: Use browser print or generate PDF with payment details

---

#### 9. Backup & Restore
**Why**: Safety net in case of data loss
**Implementation**:
- Export all data to JSON file
- Import JSON file to restore
- Could also export to CSV for Excel

---

#### 10. Multiple User Accounts
**Why**: Multiple people managing the business
**Implementation**: Firebase Authentication, user roles (admin, collector, viewer)

---

## Performance Optimization Guide

### Problem: APIs are slow (2-5 second delays)

**Root Causes**:
1. **Vercel Cold Starts**: Free tier backend sleeps after 10 minutes of inactivity
2. **Multiple Sequential API Calls**: Dashboard makes 5-6 calls one after another
3. **No Caching**: Same data fetched repeatedly
4. **Firestore Query Time**: Some queries scan many documents

### Solution 1: Implement Caching (EASY - 1 hour work)

**Add to each component that fetches data**:

```javascript
// Cache helper functions
const CACHE_DURATION = 30000; // 30 seconds

const getCachedData = (key) => {
  const cached = localStorage.getItem(key);
  if (!cached) return null;

  const { data, timestamp } = JSON.parse(cached);
  if (Date.now() - timestamp > CACHE_DURATION) {
    localStorage.removeItem(key);
    return null;
  }

  return data;
};

const setCachedData = (key, data) => {
  localStorage.setItem(key, JSON.stringify({
    data,
    timestamp: Date.now()
  }));
};

// Use in fetch functions
const fetchCustomers = async () => {
  // Check cache first
  const cached = getCachedData('customers');
  if (cached) {
    setCustomers(cached);
    return;
  }

  const response = await fetch(`${API_URL}/customers`);
  const data = await response.json();

  setCachedData('customers', data);
  setCustomers(data);
};
```

**Impact**: Reduces load time from 3-5 seconds to instant for repeated views

---

### Solution 2: Keep Backend Warm (EASY - 30 minutes)

**Create ping endpoint** (add to `server/index.js`):
```javascript
app.get('/api/ping', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});
```

**Add to Dashboard.jsx**:
```javascript
useEffect(() => {
  // Ping every 5 minutes to keep backend warm
  const interval = setInterval(() => {
    fetch(`${API_URL}/ping`).catch(() => {});
  }, 5 * 60 * 1000);

  return () => clearInterval(interval);
}, []);
```

**Impact**: Eliminates 2-5 second cold start delay

---

### Solution 3: Parallel API Calls (MEDIUM - 2 hours)

**Instead of**:
```javascript
const fetchDashboardData = async () => {
  const customers = await fetch('/api/customers').then(r => r.json());
  const loans = await fetch('/api/loans').then(r => r.json());
  const payments = await fetch('/api/payments').then(r => r.json());
};
```

**Do this**:
```javascript
const fetchDashboardData = async () => {
  const [customers, loans, payments] = await Promise.all([
    fetch('/api/customers').then(r => r.json()),
    fetch('/api/loans').then(r => r.json()),
    fetch('/api/payments').then(r => r.json())
  ]);
};
```

**Impact**: Reduces load time by 50-70%

---

### Solution 4: Loading Skeletons (EASY - 1 hour)

**Instead of blank screen, show placeholder**:

```javascript
const LoadingSkeleton = () => (
  <div style={{
    background: '#f3f4f6',
    borderRadius: '8px',
    padding: '16px',
    marginBottom: '12px',
    animation: 'pulse 1.5s infinite'
  }}>
    <div style={{ height: '20px', background: '#e5e7eb', borderRadius: '4px', width: '60%' }} />
    <div style={{ height: '16px', background: '#e5e7eb', borderRadius: '4px', width: '80%', marginTop: '8px' }} />
  </div>
);

// Use it
{loading ? <LoadingSkeleton /> : <CustomerCard />}
```

**Impact**: App feels faster even if actual speed is same

---

### Solution 5: Pagination on Overdue Payments (MEDIUM - 1 hour)

Currently loads ALL overdue customers at once. With 500+ customers this will be slow.

**Copy the pagination pattern from SundayCollections.jsx**:
```javascript
const ITEMS_PER_PAGE = 20;
const [currentPage, setCurrentPage] = useState(1);

const paginatedCustomers = filteredCustomers.slice(
  (currentPage - 1) * ITEMS_PER_PAGE,
  currentPage * ITEMS_PER_PAGE
);
```

---

## Scalability Improvements

### When to Implement: At 500+ customers

#### 1. Database Indexing

**Add to Firestore Console** (Firebase Console → Firestore → Indexes):

1. **Composite Index for Sunday Collections**:
   - Collection: `customers`
   - Fields: `sunday_day` (Ascending), `name` (Ascending)

2. **Composite Index for Overdue Payments**:
   - Collection: `loans`
   - Fields: `status` (Ascending), `balance` (Descending)

3. **Index for Customer Payments**:
   - Collection: `payments`
   - Fields: `customer_id` (Ascending), `date` (Descending)

**Impact**: Query time drops from 2-3 seconds to 200-300ms

---

#### 2. Backend Aggregation Endpoints

**Instead of fetching all data and filtering in frontend, filter in backend**:

```javascript
// Add to server/index.js
app.get('/api/dashboard-summary', async (req, res) => {
  try {
    const customersSnapshot = await db.collection('customers').get();
    const loansSnapshot = await db.collection('loans').where('status', '==', 'active').get();
    const paymentsSnapshot = await db.collection('payments')
      .where('date', '>=', getStartOfWeek())
      .get();

    res.json({
      totalCustomers: customersSnapshot.size,
      activeLoans: loansSnapshot.size,
      totalBalance: loansSnapshot.docs.reduce((sum, doc) => sum + doc.data().balance, 0),
      paymentsThisWeek: paymentsSnapshot.size,
      collectedThisWeek: paymentsSnapshot.docs.reduce((sum, doc) => sum + doc.data().amount, 0)
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

**Impact**: One API call instead of 5-6, response size reduced from 500KB to 2KB

---

#### 3. Virtual Scrolling for Long Lists

When you have 1000+ customers, rendering all at once freezes UI.

**Use React Virtual Library**:

```bash
npm install react-virtual
```

```javascript
import { useVirtual } from 'react-virtual';

const parentRef = React.useRef();

const rowVirtualizer = useVirtual({
  size: customers.length,
  parentRef,
  estimateSize: React.useCallback(() => 80, [])
});

<div ref={parentRef} style={{ height: '600px', overflow: 'auto' }}>
  <div style={{ height: `${rowVirtualizer.totalSize}px` }}>
    {rowVirtualizer.virtualItems.map(virtualRow => (
      <CustomerCard key={virtualRow.index} customer={customers[virtualRow.index]} />
    ))}
  </div>
</div>
```

**Impact**: Can handle 10,000+ items smoothly

---

## Security Enhancements

### Current Security Issues

1. **No Authentication**: Anyone with URL can access app
2. **No API Protection**: Anyone can call backend endpoints
3. **Passwords in Plain Text**: "vimala" stored as plain text in code
4. **No Audit Trail**: Can't see who made changes

### Solution: Implement Firebase Authentication

**Step 1: Install Firebase Auth**:
```bash
npm install firebase
```

**Step 2: Setup Firebase** (create `client/src/firebase.js`):
```javascript
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
```

**Step 3: Create Login Component**:
```javascript
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from './firebase';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = async () => {
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
      alert('Invalid credentials');
    }
  };

  return (
    <div>
      <input value={email} onChange={(e) => setEmail(e.target.value)} />
      <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
      <button onClick={handleLogin}>Login</button>
    </div>
  );
};
```

**Step 4: Protect Routes**:
```javascript
const ProtectedRoute = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      setUser(user);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  if (loading) return <div>Loading...</div>;
  if (!user) return <Login />;
  return children;
};
```

**Step 5: Protect Backend**:
```javascript
const admin = require('firebase-admin');
admin.initializeApp();

const verifyToken = async (req, res, next) => {
  const token = req.headers.authorization?.split('Bearer ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const decodedToken = await admin.auth().verifyIdToken(token);
    req.user = decodedToken;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

// Use on all endpoints
app.get('/api/customers', verifyToken, async (req, res) => {
  // ... existing code
});
```

---

## Code Patterns & Best Practices

### Pattern 1: Consistent Error Handling

**Always use this pattern for API calls**:

```javascript
const fetchData = async () => {
  setLoading(true);
  setError(null);

  try {
    const response = await fetch(`${API_URL}/endpoint`);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    setData(data);
  } catch (error) {
    console.error('Error fetching data:', error);
    setError(error.message);
    alert('Failed to load data. Please try again.');
  } finally {
    setLoading(false);
  }
};
```

---

### Pattern 2: Reusable Modal Component

**Create** `client/src/components/Modal.jsx`:
```javascript
function Modal({ isOpen, onClose, title, children }) {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">{title}</h3>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}
```

**Use it**:
```javascript
<Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Add Customer">
  <CustomerForm onSubmit={handleSubmit} />
</Modal>
```

---

### Pattern 3: Custom Hooks for Data Fetching

**Create** `client/src/hooks/useCustomers.js`:
```javascript
import { useState, useEffect } from 'react';

export const useCustomers = () => {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchCustomers = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/customers`);
      const data = await response.json();
      setCustomers(data);
    } catch (error) {
      setError(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, []);

  return { customers, loading, error, refetch: fetchCustomers };
};
```

**Use it**:
```javascript
const { customers, loading, error, refetch } = useCustomers();
```

---

### Pattern 4: Currency Formatting Helper

**Create** `client/src/utils/formatters.js`:
```javascript
export const formatCurrency = (amount) => {
  return `₹${parseFloat(amount).toLocaleString('en-IN')}`;
};

export const formatDate = (dateString) => {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
};

export const formatPhone = (phone) => {
  // Format: +91 98765 43210
  return `+91 ${phone.slice(0, 5)} ${phone.slice(5)}`;
};
```

---

## Common Issues & Solutions

### Issue 1: Date Timezone Problems

**Problem**: Dates showing one day off (e.g., Jan 5 shows as Jan 4)

**Cause**: JavaScript Date converts to local timezone

**Solution**:
```javascript
// When sending to backend
const dateForBackend = new Date(dateInput).toISOString().split('T')[0];

// When displaying
const dateForDisplay = new Date(dateString + 'T00:00:00').toLocaleDateString('en-IN');
```

---

### Issue 2: Firebase "Missing or insufficient permissions"

**Problem**: Firestore queries fail with permission error

**Cause**: Firestore security rules are too restrictive

**Solution**: Update Firestore Rules in Firebase Console:
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true; // WARNING: Only for development
      // For production, add proper authentication:
      // allow read, write: if request.auth != null;
    }
  }
}
```

---

### Issue 3: Vercel Deployment Fails

**Common Causes**:
1. Build fails due to warnings
2. Environment variables missing
3. Wrong build command

**Solution**:
```bash
# Test build locally first
cd client
npm run build

# If warnings cause failure, add to vite.config.js:
export default defineConfig({
  build: {
    rollupOptions: {
      onwarn(warning, warn) {
        if (warning.code === 'UNUSED_EXTERNAL_IMPORT') return;
        warn(warning);
      }
    }
  }
});

# Check environment variables in Vercel dashboard
# Should have: VITE_API_URL
```

---

### Issue 4: WhatsApp Auto-fill Not Working on Some Phones

**Problem**: WhatsApp link opens but doesn't fill message

**Cause**: Some WhatsApp versions don't support `text` parameter

**Solution**: Already implemented - user copies message and pastes manually

**Alternative**: Use WhatsApp Business API (requires paid plan)

---

### Issue 5: Large Images Slow Down App

**Problem**: Customer photos causing slow load times

**Solution**: Compress images before storing

```javascript
const compressImage = async (file) => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        // Resize to max 800px width
        const maxWidth = 800;
        const ratio = maxWidth / img.width;
        canvas.width = maxWidth;
        canvas.height = img.height * ratio;

        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((blob) => {
          resolve(blob);
        }, 'image/jpeg', 0.8); // 80% quality
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
};
```

---

## Database Schema Reference

### Collections Structure

#### `customers`
```javascript
{
  id: "auto-generated",
  name: "string",
  phone: "string (10 digits)",
  address: "string",
  sunday_day: "string (Sunday 1, Sunday 2, etc.)",
  created_at: "timestamp",
  updated_at: "timestamp"
}
```

**Indexes**:
- `sunday_day` (for Sunday Collections page)
- `name` (for search)

---

#### `loans`
```javascript
{
  id: "auto-generated",
  customer_id: "string (ref to customers.id)",
  loan_amount: "number",
  balance: "number",
  weekly_amount: "number",
  status: "string (active/closed)",
  start_date: "string (YYYY-MM-DD)",
  created_at: "timestamp",
  updated_at: "timestamp"
}
```

**Indexes**:
- `customer_id` (for customer loan history)
- `status` + `balance` composite (for overdue payments)

---

#### `payments`
```javascript
{
  id: "auto-generated",
  loan_id: "string (ref to loans.id)",
  customer_id: "string (ref to customers.id)",
  amount: "number",
  date: "string (YYYY-MM-DD)",
  created_at: "timestamp"
}
```

**Indexes**:
- `loan_id` + `date` composite (for payment history)
- `customer_id` + `date` composite (for customer history)
- `date` (for weekly reports)

---

## API Endpoints Reference

### Customer Endpoints

**GET** `/api/customers`
Returns: Array of all customers with their active loan info

**GET** `/api/customers/:id`
Returns: Single customer details

**POST** `/api/customers`
Body: `{ name, phone, address, sunday_day }`
Returns: Created customer

**PUT** `/api/customers/:id`
Body: `{ name, phone, address, sunday_day }`
Returns: Updated customer

**DELETE** `/api/customers/:id`
Returns: Success message
**Note**: Deletes all associated loans and payments

---

### Loan Endpoints

**GET** `/api/loans/:id`
Returns: Loan details with payments array

**POST** `/api/loans`
Body: `{ customer_id, loan_amount, weekly_amount, start_date }`
Returns: Created loan

**PUT** `/api/loans/:id`
Body: `{ status: 'closed' }` or other fields
Returns: Updated loan

---

### Payment Endpoints

**GET** `/api/payments/week`
Returns: All payments from current week (Sunday to Saturday)

**POST** `/api/payments`
Body: `{ loan_id, customer_id, amount, date }`
Returns: Created payment
**Side Effect**: Updates loan balance

**DELETE** `/api/payments/:id`
Returns: Success message
**Side Effect**: Restores loan balance, sets status back to 'active'

**PUT** `/api/payments/:id` *(NOT YET IMPLEMENTED)*
Body: `{ amount, date }`
Returns: Updated payment
**Side Effect**: Adjusts loan balance by difference

---

### Sunday Collections Endpoints

**GET** `/api/sunday-collections/:sundayDay?page=1&limit=20`
Returns: Paginated list of customers for that Sunday
Example: `/api/sunday-collections/Sunday%202?page=1&limit=20`

---

## Testing Checklist

### Before Deploying New Features

- [ ] Test on Chrome (desktop)
- [ ] Test on mobile browser
- [ ] Test with slow internet (Chrome DevTools → Network → Slow 3G)
- [ ] Test with 100+ customers (create dummy data)
- [ ] Check console for errors (F12 → Console)
- [ ] Test without internet (should show error, not crash)
- [ ] Verify data updates everywhere (balance, progress bar, history)
- [ ] Test extreme cases:
  - [ ] Payment amount = 0
  - [ ] Payment amount > balance
  - [ ] Negative numbers
  - [ ] Very long customer names
  - [ ] Special characters in names

---

## Deployment Checklist

### Client (Frontend) Deployment to Vercel

1. Make changes in `client/` folder
2. Test locally: `npm run dev`
3. Build locally: `npm run build` (check for errors)
4. Commit: `git add . && git commit -m "Description"`
5. Push: `git push`
6. Vercel auto-deploys from GitHub
7. Check deployment at: https://your-app.vercel.app
8. Test live site thoroughly

### Server (Backend) Deployment to Vercel

1. Make changes in `server/` folder
2. Test locally: `node index.js`
3. Commit and push (same as above)
4. Vercel auto-deploys backend
5. **IMPORTANT**: First API call after deployment takes 5-10 seconds (cold start)

---

## Environment Variables

### Client `.env` file
```
VITE_API_URL=https://your-backend.vercel.app
```

### Server `.env` file (Vercel dashboard)
```
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_PRIVATE_KEY=your-private-key
FIREBASE_CLIENT_EMAIL=your-client-email
```

**How to set in Vercel**:
1. Go to Vercel dashboard
2. Select project → Settings → Environment Variables
3. Add each variable
4. Redeploy

---

## Performance Benchmarks

### Current Performance (as of Jan 2025)

| Page | Load Time | Number of API Calls |
|------|-----------|---------------------|
| Dashboard | 3-5 sec (first load), <1 sec (cached) | 6 |
| Customers | 2-3 sec | 1 |
| Sunday Collections | 1-2 sec | 1 (paginated) |
| Loan Details | 2-3 sec | 2 |
| Overdue Payments | 3-4 sec (100 customers) | 1 |

### Expected Performance with Optimizations

| Optimization | Expected Improvement |
|--------------|---------------------|
| Caching | 70-80% faster repeat views |
| Keep backend warm | Eliminates 2-5 sec cold start |
| Parallel API calls | 50-60% faster initial load |
| Backend aggregation | 80-90% faster dashboard |

---

## Future Technology Upgrades

### When App Grows to 5000+ Customers

1. **Migrate to PostgreSQL**: Better performance for complex queries
2. **Add Redis Cache**: Sub-100ms response times
3. **Implement GraphQL**: Fetch exactly what you need, nothing more
4. **Add CDN**: Faster image/asset loading
5. **Progressive Web App**: Offline support, faster loads
6. **Move to Dedicated Server**: No cold starts, consistent performance

### Cost Estimates

Current setup: **FREE** (Vercel + Firebase free tiers)

At 5000+ customers:
- Vercel Pro: $20/month
- Firebase Blaze: ~$50/month (estimated)
- Total: ~$70/month

---

## Contact & Support

**Developer Notes**:
- This app was built in December 2024 - January 2025
- Built with Claude Code (Anthropic AI assistant)
- All code is custom-written, no external UI libraries
- Firestore queries may need optimization as data grows
- WhatsApp integration is basic (direct links), not business API

**Hiring Developer to Continue**:
Look for developers with these skills:
- React (Vite)
- Node.js / Express
- Firebase Firestore
- Vercel deployment
- REST APIs

**Show them this roadmap document first** - it has all the context needed.

---

## Quick Reference Commands

```bash
# Install dependencies
cd client && npm install
cd server && npm install

# Run locally
cd client && npm run dev          # Frontend on http://localhost:5173
cd server && node index.js        # Backend on http://localhost:3000

# Build for production
cd client && npm run build

# Deploy
git add .
git commit -m "Your changes"
git push

# Check deployed app
curl https://your-backend.vercel.app/api/customers

# View logs
vercel logs [deployment-url]
```

---

## Final Notes

**Your Idea**: Having Claude subscription now and planning for the future without it is SMART! This document should help any developer (or even you) continue building the app.

**Priority Order**:
1. First 100 customers: Focus on features, don't worry about performance
2. 100-500 customers: Add caching and keep backend warm
3. 500-1000 customers: Implement pagination everywhere, backend aggregation
4. 1000+ customers: Consider database migration, dedicated infrastructure

**Remember**:
- Don't optimize prematurely - wait until you actually experience slowness
- Most features in this document are optional - only build what you actually need
- The app works well as-is for 100-200 customers
- Backup your Firebase data regularly (export from Firebase Console)

**Good luck with your finance business!** 🎉

---

*Document Version: 1.0*
*Last Updated: January 2025*
*Total Pages: This comprehensive guide*