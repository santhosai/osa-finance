# OM SAI MURUGAN FINANCE - Complete Setup Guide

## 📋 Prerequisites

Before you start, make sure you have:
- **Node.js** (v16 or higher) - [Download here](https://nodejs.org/)
- **Git** - [Download here](https://git-scm.com/)
- **Firebase/Firestore account** - [Create here](https://console.firebase.google.com/)

---

## 🚀 Quick Start (Local Development)

### Step 1: Clone the Repository
```bash
cd Desktop
git clone <your-repository-url> Financeapplication
cd Financeapplication
```

### Step 2: Setup Firestore Database

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create a new project (or use existing)
3. Enable **Firestore Database**
4. Create a service account:
   - Go to Project Settings → Service Accounts
   - Click "Generate New Private Key"
   - Save the JSON file as `serviceAccountKey.json` in the `server/` folder

**⚠️ IMPORTANT**: Add this to `.gitignore` to keep it secret!

### Step 3: Install Dependencies

#### Install Server Dependencies
```bash
cd server
npm install
```

#### Install Client Dependencies
```bash
cd ../client
npm install
```

### Step 4: Configure Environment Variables

Create `.env` file in `server/` folder (if not exists):
```env
PORT=3000
NODE_ENV=development
```

### Step 5: Run the Application

#### Option A: Run Both (Server + Client)

**Terminal 1 - Start Server:**
```bash
cd server
npm run dev
```
Server will run on: http://localhost:3000

**Terminal 2 - Start Client:**
```bash
cd client
npm run dev
```
Client will run on: http://localhost:5173

#### Option B: Run Separately

**Server only:**
```bash
cd server
node index.js
```

**Client only:**
```bash
cd client
npm run dev
```

---

## 🌐 Production Deployment (Vercel)

### Deploy to Vercel (Recommended)

#### 1. Install Vercel CLI
```bash
npm install -g vercel
```

#### 2. Login to Vercel
```bash
vercel login
```

#### 3. Deploy Server
```bash
cd server
vercel
```

Follow the prompts:
- Link to existing project? **N**
- Project name: **finance-app-backend**
- Directory: **./server**

#### 4. Deploy Client
```bash
cd ../client
vercel
```

Follow the prompts:
- Link to existing project? **N**
- Project name: **finance-app-frontend**
- Directory: **./client**

#### 5. Configure Client API URL

After deployment, update `client/src/config.js`:
```javascript
export const API_URL = 'https://your-backend-url.vercel.app/api';
```

Then redeploy client:
```bash
cd client
vercel --prod
```

---

## 📦 What's Included

### Backend (Server)
- **Express.js** server
- **Firestore** database integration
- **REST API** endpoints for:
  - Customers management
  - Loans (Weekly & Monthly)
  - Payments tracking
  - Dashboard statistics
  - Settings (Dashboard image storage)

### Frontend (Client)
- **React** + **Vite**
- **SWR** for data fetching & caching
- **Responsive design** for mobile & desktop

### Features
✅ Customer management (add, edit, delete)
✅ Weekly Finance (10 weeks, Sunday payments)
✅ Monthly Finance (5 months, any date)
✅ Multiple loans per customer
✅ Payment tracking
✅ Sunday Collections view
✅ Overdue payments tracking
✅ Vaddi List
✅ Payment Tracker
✅ WhatsApp integration
✅ Dashboard image upload (syncs across devices)
✅ CSV export for all data

---

## 🔐 Default Login

**Password**: `santhosh123`

To change password, edit `client/src/components/Login.jsx`

---

## 📁 Project Structure

```
Financeapplication/
├── client/                 # Frontend (React + Vite)
│   ├── src/
│   │   ├── components/     # React components
│   │   ├── config.js       # API configuration
│   │   ├── App.jsx         # Main app component
│   │   └── main.jsx        # Entry point
│   ├── package.json
│   └── vite.config.js
│
├── server/                 # Backend (Express + Firestore)
│   ├── index.js            # Main server file
│   ├── firestore.js        # Firestore configuration
│   ├── serviceAccountKey.json  # Firebase credentials (DO NOT COMMIT!)
│   ├── package.json
│   └── vercel.json         # Vercel deployment config
│
└── SETUP.md               # This file
```

---

## 🛠️ Common Commands

### Development
```bash
# Start server (development mode with auto-reload)
cd server && npm run dev

# Start client (development mode)
cd client && npm run dev

# Build client for production
cd client && npm run build

# Preview production build
cd client && npm run preview
```

### Deployment
```bash
# Deploy server to Vercel
cd server && vercel --prod

# Deploy client to Vercel
cd client && vercel --prod

# Check deployment status
vercel ls
```

### Database
```bash
# No commands needed - Firestore is cloud-based!
# Access Firestore Console: https://console.firebase.google.com/
```

---

## 🐛 Troubleshooting

### Issue: "Cannot connect to server"
**Solution**: Check if server is running on correct port (default 3000)
```bash
cd server
node index.js
```

### Issue: "Firestore authentication error"
**Solution**: Verify `serviceAccountKey.json` is in `server/` folder and is valid

### Issue: "Port already in use"
**Solution**: Kill the process using the port
```bash
# Windows
netstat -ano | findstr :3000
taskkill /PID <process-id> /F

# Mac/Linux
lsof -ti:3000 | xargs kill -9
```

### Issue: "Dashboard image not showing"
**Solution**:
1. Clear browser cache (Ctrl+Shift+R or Cmd+Shift+R)
2. Check browser console for errors
3. Verify image is less than 2MB
4. Check Firestore permissions

### Issue: "CORS error"
**Solution**: Server already configured for CORS. If still happening:
- Check `server/index.js` line 16-19
- Ensure `CLIENT_URL` environment variable is set correctly

---

## 📊 Database Collections

Firestore collections used:
- **customers** - Customer information
- **loans** - Loan records (Weekly & Monthly)
- **payments** - Payment history
- **settings** - App settings (dashboard image, etc.)

---

## 🔄 Updating the Application

When someone sends you updates:

```bash
# Pull latest changes
git pull origin main

# Update server dependencies
cd server
npm install

# Update client dependencies
cd ../client
npm install

# Restart both servers
# Server: cd server && npm run dev
# Client: cd client && npm run dev
```

---

## 📱 Dashboard Image Feature

### How to Upload Image:
1. Login to application
2. Go to **Dashboard**
3. Scroll down below "Total Customers" card
4. Click **"📸 Upload Image"** button
5. Select image (max 2MB)
6. Image uploads to Firestore
7. **It will sync across all devices automatically!**

### Supported Formats:
- JPG/JPEG
- PNG
- GIF
- WebP
- Max size: 2MB

### To Change Image:
1. Click **"Change Image"** button
2. Select new image
3. Old image is automatically replaced

---

## 🎯 Next Steps After Setup

1. ✅ Change default password in `Login.jsx`
2. ✅ Add your customers
3. ✅ Create first loan
4. ✅ Upload dashboard image (family/god photo)
5. ✅ Test on mobile device
6. ✅ Share the deployed URL with your brother

---

## 💡 Tips

- **Backup regularly**: Export data as CSV from "Export Data" menu
- **Mobile friendly**: Works on all screen sizes
- **Offline first**: Data cached locally with SWR
- **Sunday Collections**: Perfect for weekly collection workflow
- **WhatsApp integration**: One-click payment receipts

---

## 📞 Support

If you have issues, check:
1. Browser console (F12) for errors
2. Server terminal for error messages
3. Firestore Console for database issues

---

## 🎉 You're All Set!

Your finance application is ready to use!

**Local Development URLs:**
- Frontend: http://localhost:5173
- Backend: http://localhost:3000

**Production URLs:**
- After deploying to Vercel, you'll get:
  - Frontend: https://your-app.vercel.app
  - Backend: https://your-api.vercel.app

---

Generated with ❤️ by Claude Code
