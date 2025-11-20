# 🏦 OM SAI MURUGAN FINANCE

A comprehensive finance tracking application for managing Weekly (10 weeks) and Monthly (5 months) loans with WhatsApp integration and cloud sync.

**Version 4.0.0** | **Last Updated: January 2025**

## ⚡ Quick Start

```bash
# 1. Install dependencies
cd server && npm install
cd ../client && npm install

# 2. Setup Firestore (see SETUP.md)

# 3. Start application
cd server && npm run dev    # Terminal 1
cd client && npm run dev     # Terminal 2

# 4. Open http://localhost:5173
# Login: santhosh123
```

**📖 Full Setup Guide**: See [SETUP.md](./SETUP.md)

---

## ✨ Features

### 📊 Dashboard
- Real-time loan statistics
- Active loans counter
- Outstanding balance tracking
- Payments this week
- Total customers count
- **🖼️ Dashboard Image Upload** (NEW!) - Upload family/god photos that sync across all devices

### 👥 Customer Management
- Add/Edit/Delete customers
- Multiple loans per customer
- Search by name or phone
- View customer loan details
- Track "Loan Given" amount (NEW!)
- Export customer data as CSV

### 💰 Loan Management
#### Weekly Finance (10 weeks)
- Sunday payments only
- Auto-calculate weekly amount (Loan ÷ 10)
- Track weeks paid/remaining
- Progress bars

#### Monthly Finance (5 months) (NEW!)
- Any date payments
- Auto-calculate monthly amount (Loan ÷ 5)
- Calendar month calculation (accurate dates)
- Track months paid/remaining

#### Common Features
- **Friend Name** - Identify loans when customer has multiple
- Multiple loans per customer
- Top-up existing loans
- Close completed loans
- View payment history

### 💳 Payment Tracking
- Record payments with date
- Offline + Online amount split
- Auto-update loan balance
- Payment receipts
- WhatsApp integration
- Payment history with CSV export

### 📅 Views
- **Dashboard** - Overview & statistics
- **Sunday Collections** - Who pays this Sunday? (download sheet)
- **Weekly Finance** (NEW!) - All weekly loans
- **Monthly Finance** (NEW!) - All monthly loans
- **Overdue Payments** - Track late payments
- **Vaddi List** - Interest tracking
- **Payment Tracker** - Check payment status by date
- **Customers** - Complete customer list

### 📱 WhatsApp Integration
- One-click payment receipts
- Loan confirmation messages
- Professional formatted messages
- Direct WhatsApp links (wa.me)

## Tech Stack

### Frontend
- **React** - UI framework
- **Vite** - Build tool and dev server
- **CSS3** - Styling (mobile-first responsive design)

### Backend
- **Node.js** - Runtime environment
- **Express** - Web framework
- **Firebase Firestore** - Cloud NoSQL database

## Project Structure

```
Financeapplication/
├── client/                 # Frontend React application
│   ├── src/
│   │   ├── components/    # React components
│   │   │   ├── Dashboard.jsx
│   │   │   ├── Customers.jsx
│   │   │   ├── LoanDetails.jsx
│   │   │   ├── AddPaymentModal.jsx
│   │   │   ├── AddLoanModal.jsx
│   │   │   ├── AddCustomerModal.jsx
│   │   │   └── TopUpModal.jsx
│   │   ├── App.jsx
│   │   ├── App.css
│   │   └── index.css
│   └── package.json
├── server/                # Backend API
│   ├── firestore.js      # Firebase Firestore initialization
│   ├── index.js          # Express server and API routes
│   ├── seed.js           # Sample data seeder
│   ├── serviceAccountKey.json  # Firebase credentials (gitignored)
│   ├── FIREBASE_SETUP.md # Detailed Firebase setup guide
│   └── package.json
└── README.md
```

## Installation & Setup

### Prerequisites
- Node.js (v14 or higher)
- npm or yarn
- Firebase Account (free tier works)

### 1. Firebase Setup

**IMPORTANT: You must set up Firebase before running the application!**

#### Step 1: Create Firebase Project
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click **"Add project"** or select an existing project
3. Follow the setup wizard

#### Step 2: Enable Firestore
1. In your Firebase project, click **"Firestore Database"**
2. Click **"Create database"**
3. Choose **"Start in test mode"** (for development)
4. Select your preferred location
5. Click **"Enable"**

#### Step 3: Get Service Account Key
1. Click the **gear icon** ⚙️ next to "Project Overview"
2. Go to **"Project settings"** > **"Service accounts"**
3. Click **"Generate new private key"**
4. Save the downloaded JSON file as `serviceAccountKey.json`
5. Move it to the `server` folder

```
server/
└── serviceAccountKey.json  ← Place your Firebase key here
```

**⚠️ NEVER commit this file to git!** (Already in .gitignore)

For detailed Firebase setup instructions, see [server/FIREBASE_SETUP.md](server/FIREBASE_SETUP.md)

### 2. Install Dependencies

**Backend:**
```bash
cd server
npm install
```

**Frontend:**
```bash
cd client
npm install
```

### 3. Seed Firestore (Optional)

To populate Firestore with sample data:
```bash
cd server
node seed.js
```

This will create 5 customers, 4 loans, and 8 payments in your Firestore database.

### 4. Start the Application

**Start Backend Server:**
```bash
cd server
npm start
```
The backend server will run on `http://localhost:3000`

**Start Frontend Development Server:**
```bash
cd client
npm run dev
```
The frontend will run on `http://localhost:5173`

### 4. Access the Application

Open your browser and navigate to:
```
http://localhost:5173
```

**Default Login**: `santhosh123`

---

## 🖼️ Dashboard Image Feature (NEW!)

### Where to Find It:
1. Login to application
2. Go to **Dashboard** (main screen)
3. **Scroll down** below "Total Customers" card
4. You'll see either:
   - 🖼️ "Add Your Family Photo" button (if no image)
   - Your uploaded image with "Change Image" button

### How to Upload:
1. Click "📸 Upload Image" button
2. Select image from your device
3. Max size: 2MB
4. Supported formats: JPG, PNG, GIF, WebP
5. Image uploads to Firestore
6. **Syncs across all devices automatically!**

### Can't See It?
- Press **Ctrl+Shift+R** (Windows) or **Cmd+Shift+R** (Mac) to hard refresh
- Make sure you're logged in
- Look below the "Total Customers" card in Dashboard
- Check browser console (F12) for errors

## API Endpoints

### Customers
- `GET /api/customers` - Get all customers (with optional search)
- `GET /api/customers/:id` - Get customer by ID
- `POST /api/customers` - Create new customer
- `PUT /api/customers/:id` - Update customer
- `DELETE /api/customers/:id` - Delete customer

### Loans
- `GET /api/customers/:customerId/loans` - Get all loans for a customer
- `GET /api/loans/:id` - Get loan details with payments
- `POST /api/loans` - Create new loan
- `POST /api/loans/:id/topup` - Top-up existing loan
- `PUT /api/loans/:id/close` - Close a loan

### Payments
- `GET /api/payments` - Get recent payments
- `POST /api/payments` - Record new payment
- `DELETE /api/payments/:id` - Delete payment

### Stats
- `GET /api/stats` - Get dashboard statistics

## Firestore Database Structure

### customers (Collection)
- id (Auto-generated Document ID)
- name (string)
- phone (string - unique)
- created_at (timestamp string)

### loans (Collection)
- id (Auto-generated Document ID)
- customer_id (string - reference to customer document)
- loan_amount (number)
- weekly_amount (number)
- balance (number)
- start_date (string)
- status (string: 'active', 'closed', 'defaulted')
- created_at (timestamp string)

### payments (Collection)
- id (Auto-generated Document ID)
- loan_id (string - reference to loan document)
- amount (number)
- payment_date (string)
- weeks_covered (number)
- week_number (number)
- balance_after (number)
- created_at (timestamp string)

**Note**: All data is stored in Firebase Firestore cloud database and accessible from anywhere with internet connection.

## Usage Guide

### Adding a New Customer
1. Go to Customers screen
2. Click the "+" FAB button
3. Enter customer name and 10-digit phone number
4. Click "Add Customer"

### Creating a Loan
1. Go to Dashboard or Customers screen
2. Click "+ Add New Loan" button
3. Select customer (or use pre-selected)
4. Enter loan amount and weekly payment
5. Select start date
6. Review the calculated summary
7. Click "Create Loan"

### Recording a Payment
1. Go to Loan Details screen
2. Click "+ Add Payment" button
3. Select payment date
4. Enter payment amount
5. Review automatic calculations (weeks covered, new balance, etc.)
6. Click "✓ Record Payment"
7. Optionally send WhatsApp message to customer

### Top-up a Loan
1. Go to Loan Details screen
2. Click "⬆ Top-up Loan" button
3. Enter additional loan amount
4. Review updated totals
5. Click "Confirm Top-up"

### Sending WhatsApp Messages
- After recording a payment, click "Send WhatsApp Message"
- Or click the WhatsApp icon next to any payment in history
- The app will open WhatsApp with a pre-formatted payment receipt

## Features in Detail

### Automatic Calculations
- **Weeks Covered**: Automatically calculates how many weeks are covered by a payment
- **New Balance**: Updates loan balance after each payment
- **Progress Percentage**: Visual progress bar showing loan completion
- **Remaining Weeks**: Calculates weeks needed to complete payment

### Payment Tracking
- Track exact payment dates
- Monitor week-by-week payment progress
- View complete payment history
- Calculate running balance after each payment

### WhatsApp Integration
- Format: `wa.me/91XXXXXXXXXX`
- Pre-formatted professional payment receipts
- Customer name, amount, date, week, and balance included
- One-click sending to customer

## Sample Data

The application comes with sample data including:
- 5 customers (Rajesh Kumar, Priya Sharma, Amit Patel, Sneha Reddy, Vikram Singh)
- 4 active loans with varying amounts
- Multiple payment records showing different payment patterns

## Development

### Backend Development
```bash
cd server
npm run dev  # Uses node --watch for auto-restart
```

### Frontend Development
```bash
cd client
npm run dev  # Vite dev server with HMR
```

### Building for Production
```bash
cd client
npm run build  # Creates optimized production build
```

## Mobile-First Design

The application is designed with a mobile-first approach:
- Responsive layouts that work on all screen sizes
- Touch-friendly buttons and interactions
- Optimized for portrait mobile viewing
- Desktop-compatible with centered layout

## License

MIT

## Support

For issues or questions, please check the documentation or contact the development team.
