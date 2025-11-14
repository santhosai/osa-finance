# Deployment Guide - Finance Application

## 🎉 FREE Hosting (Yes, it's completely free!)

Both Firebase and Vercel offer **FREE** plans that are perfect for your application:

### Firebase Free Tier (Firestore Database)
- ✅ **1 GB stored data** - More than enough for 100+ customers
- ✅ **50K reads/day** - Around 1,500 customer views per day
- ✅ **20K writes/day** - Around 600 payments per day
- ✅ **10 GB/month network egress**
- ✅ **FREE SSL certificate**

### Vercel Free Tier (Frontend + Backend)
- ✅ **100 GB bandwidth/month**
- ✅ **Unlimited deployments**
- ✅ **Automatic HTTPS**
- ✅ **Global CDN**
- ✅ **Serverless Functions** (for your backend)

**For 50-100 customers, you'll stay well within free limits!** 🎊

---

## 📋 Important Notes About Costs

### You'll Stay FREE If:
- You have less than 100 active users
- Each user checks the app 10-20 times per day
- You record 50-100 payments per day

### Actual Usage for 100 Customers:
- **Reads**: ~500-1000/day (1% of free limit)
- **Writes**: ~50-100/day (0.5% of free limit)
- **Storage**: ~50-100 MB (5% of free limit)

**Bottom line: Everything is FREE for your use case!** ✅

---

## 🚀 Quick Deployment Steps

### Step 1: Prepare Firebase Credentials

1. Open your `server/serviceAccountKey.json` file
2. Copy these 3 values (you'll need them for Vercel):
   - `project_id` → This is your **FIREBASE_PROJECT_ID**
   - `private_key` → This is your **FIREBASE_PRIVATE_KEY** (keep the quotes and \n)
   - `client_email` → This is your **FIREBASE_CLIENT_EMAIL**

### Step 2: Deploy Backend to Vercel

1. Open terminal in your project folder

2. Navigate to server directory:
   ```bash
   cd C:\Users\SanthoshKumarShakkar\Desktop\Financeapplication\server
   ```

3. Deploy to Vercel:
   ```bash
   vercel
   ```

   When prompted:
   - **Set up and deploy?** → Y (Yes)
   - **Which scope?** → Select your account
   - **Link to existing project?** → N (No)
   - **Project name?** → finance-backend (or any name)
   - **Which directory?** → . (just press Enter)
   - **Override settings?** → N (No)

4. Copy the deployment URL (e.g., `https://finance-backend-xxx.vercel.app`)

5. Add environment variables in Vercel Dashboard:
   - Go to https://vercel.com/dashboard
   - Click on your `finance-backend` project
   - Go to **Settings** → **Environment Variables**
   - Add these 3 variables:

     **FIREBASE_PROJECT_ID**
     ```
     your-project-id
     ```

     **FIREBASE_PRIVATE_KEY** (paste the entire private key including quotes)
     ```
     "-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgk...\n-----END PRIVATE KEY-----\n"
     ```

     **FIREBASE_CLIENT_EMAIL**
     ```
     firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com
     ```

6. After adding variables, redeploy:
   ```bash
   vercel --prod
   ```

### Step 3: Deploy Frontend to Vercel

1. Update `client/src/config.js` with your backend URL:

   Replace `'https://your-backend.vercel.app/api'` with your actual backend URL from Step 2:

   ```javascript
   // In client/src/config.js, line 6
   return 'https://finance-backend-xxx.vercel.app/api';  // ← Use YOUR actual URL here
   ```

2. Navigate to client directory:
   ```bash
   cd C:\Users\SanthoshKumarShakkar\Desktop\Financeapplication\client
   ```

3. Deploy to Vercel:
   ```bash
   vercel
   ```

   When prompted:
   - **Set up and deploy?** → Y (Yes)
   - **Which scope?** → Select your account
   - **Link to existing project?** → N (No)
   - **Project name?** → finance-app (or any name)
   - **Which directory?** → . (just press Enter)
   - **Override settings?** → N (No)

4. Deploy to production:
   ```bash
   vercel --prod
   ```

5. Your app is live! 🎉

   You'll get a URL like: `https://finance-app-xxx.vercel.app`

---

## 📱 Example WhatsApp Message

When you send a payment receipt, customer receives:

```
Payment Receipt

Customer: Rajesh Kumar
Amount: ₹1,500
Date: 14/11/2025
Week: 5
Balance Remaining: ₹8,500

Thank you for your payment!
```

---

## ✅ Final Checklist

- [ ] Backend deployed
- [ ] Frontend deployed  
- [ ] Environment variables set
- [ ] Test creating customer
- [ ] Test recording payment
- [ ] Test WhatsApp message

**You're all set! Enjoy your finance app!** 🚀
