# Om Sai Murugan Finance - Deployment Guide

This guide will help you deploy your Finance Application to the cloud for free.

## Prerequisites
- GitHub account (create one at https://github.com/signup if you don't have one)
- Render.com account (sign up at https://render.com - use GitHub to sign in)
- Vercel account (sign up at https://vercel.com - use GitHub to sign in)

## Step 1: Push Code to GitHub

### 1.1 Create a GitHub Repository
1. Go to https://github.com/new
2. Repository name: `om-sai-murugan-finance`
3. Description: `Finance Management System for Om Sai Murugan Finance`
4. Select "Private" (to keep your code secure)
5. DO NOT initialize with README, .gitignore, or license (we already have these)
6. Click "Create repository"

### 1.2 Push Your Code
Open Command Prompt in your project folder and run:

```cmd
cd C:\Users\SanthoshKumarShakkar\Desktop\Financeapplication
git remote add origin https://github.com/YOUR_USERNAME/om-sai-murugan-finance.git
git branch -M main
git push -u origin main
```

Replace `YOUR_USERNAME` with your actual GitHub username.

---

## Step 2: Deploy Backend to Render.com

### 2.1 Create Web Service on Render
1. Go to https://dashboard.render.com
2. Click "New +" button → "Web Service"
3. Click "Connect repository" → Select your GitHub repository
4. Configure the service:
   - **Name**: `omsaimurugan-backend`
   - **Region**: Select closest to you (Singapore for India)
   - **Root Directory**: `server`
   - **Environment**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Instance Type**: `Free`

### 2.2 Add Environment Variables
In the "Environment" section, click "Add Environment Variable":

**Add this variable:**
- Key: `CLIENT_URL`
- Value: `*` (we'll update this after deploying frontend)

### 2.3 Add Firebase Service Account
You need to upload your Firebase service account JSON as an environment variable:

1. Copy the entire content of your `server/firebase-service-account.json` file
2. In Render, add environment variable:
   - Key: `FIREBASE_SERVICE_ACCOUNT`
   - Value: Paste the entire JSON content

3. Update your `server/firestore.js` file to use environment variable (if needed)

### 2.4 Deploy
1. Click "Create Web Service"
2. Wait for deployment (takes 2-5 minutes)
3. Once deployed, you'll get a URL like: `https://omsaimurugan-backend.onrender.com`
4. **Copy this URL** - you'll need it for the frontend!

---

## Step 3: Deploy Frontend to Vercel

### 3.1 Update Frontend Configuration
Before deploying, update the API URL in your frontend:

1. Open `client/src/config.js`
2. Update the API_URL to your Render backend URL:

```javascript
export const API_URL = 'https://omsaimurugan-backend.onrender.com/api';
```

3. Commit this change:
```cmd
cd C:\Users\SanthoshKumarShakkar\Desktop\Financeapplication
git add client/src/config.js
git commit -m "Update API URL for production"
git push
```

### 3.2 Deploy to Vercel
1. Go to https://vercel.com/new
2. Import your GitHub repository
3. Configure project:
   - **Root Directory**: `client`
   - **Framework Preset**: Vite
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
   - Click "Deploy"

4. Wait for deployment (takes 1-2 minutes)
5. You'll get a URL like: `https://om-sai-murugan-finance.vercel.app`

---

## Step 4: Update CORS Configuration

Now that you have your frontend URL, update the backend's CORS settings:

1. Go back to Render dashboard
2. Open your backend service
3. Go to "Environment" tab
4. Update `CLIENT_URL` environment variable:
   - Old value: `*`
   - New value: `https://om-sai-murugan-finance.vercel.app` (your actual Vercel URL)
5. Click "Save Changes"
6. Render will automatically redeploy

---

## Step 5: Test Your Deployed Application

1. Open your Vercel URL in a browser
2. Login with credentials:
   - Username: `omsairam`
   - Password: `omsai123`
3. Test all features:
   - Add a customer
   - Create a loan
   - Record a payment (online and offline)
   - Check dashboard stats
   - Export data

---

## Important Notes

### Firebase Service Account
Make sure your `server/firebase-service-account.json` is properly configured in Render's environment variables. Without this, your backend won't be able to connect to Firestore.

### Free Tier Limitations
- **Render Free Tier**: Backend sleeps after 15 minutes of inactivity. First request may take 30-60 seconds to wake up.
- **Vercel Free Tier**: Unlimited bandwidth for personal use
- **Firebase Free Tier**: 50,000 reads/20,000 writes per day (more than enough for your use case)

### Custom Domain (Optional)
If you want to use your own domain:
- **Vercel**: Go to Project Settings → Domains → Add your domain
- **Render**: Go to Service Settings → Custom Domain → Add your domain

---

## Troubleshooting

### Backend not connecting to Firebase
- Check that FIREBASE_SERVICE_ACCOUNT environment variable is properly set
- Verify the JSON is valid (no extra quotes or escape characters)

### Frontend not connecting to Backend
- Verify the API_URL in `client/src/config.js` matches your Render backend URL
- Check that CORS is configured with your Vercel frontend URL
- Open browser console (F12) to see error messages

### Backend is slow
- Render free tier sleeps after inactivity
- Consider upgrading to paid plan ($7/month) for always-on service
- Or keep a browser tab open to prevent sleep

---

## Your Deployment URLs

Once deployed, save these URLs:

- **Frontend**: https://______.vercel.app
- **Backend**: https://______.onrender.com
- **Login**: Username: `omsairam`, Password: `omsai123`

---

## Security Recommendations

1. **Change Login Credentials**: The current credentials are hardcoded. For production, implement proper authentication.
2. **Environment Variables**: Never commit sensitive data like Firebase credentials to Git.
3. **Firebase Rules**: Set up proper Firestore security rules to protect your data.
4. **HTTPS Only**: Both Render and Vercel provide HTTPS by default - always use secure connections.

---

Your application is now live and accessible to anyone with the URL!
