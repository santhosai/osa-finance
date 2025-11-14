# Firebase Setup Instructions

## Step 1: Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click **"Add project"** or select an existing project
3. Follow the prompts to create your project

## Step 2: Enable Firestore Database

1. In your Firebase project, click **"Firestore Database"** in the left menu
2. Click **"Create database"**
3. Choose **"Start in production mode"** or **"Start in test mode"** (for development)
4. Select your preferred location
5. Click **"Enable"**

## Step 3: Get Service Account Key

1. Click the **gear icon** ⚙️ next to "Project Overview"
2. Select **"Project settings"**
3. Go to the **"Service accounts"** tab
4. Click **"Generate new private key"**
5. Click **"Generate key"** in the confirmation dialog
6. A JSON file will be downloaded

## Step 4: Add Service Account to Server

1. Rename the downloaded JSON file to `serviceAccountKey.json`
2. Move it to the `server` folder of this project
3. **IMPORTANT**: Never commit this file to git (it's already in .gitignore)

## Step 5: Set Firestore Rules (Optional for Development)

For development/testing, you can use these permissive rules:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true;
    }
  }
}
```

⚠️ **WARNING**: For production, implement proper security rules!

## Step 6: Start the Server

```bash
cd server
npm start
```

You should see: ✅ Firestore initialized successfully!

## Collections Structure

The application uses these Firestore collections:

- **customers**: Customer information
  - id (auto-generated)
  - name
  - phone
  - created_at

- **loans**: Loan records
  - id (auto-generated)
  - customer_id (reference to customer)
  - loan_amount
  - weekly_amount
  - balance
  - start_date
  - status (active/closed/defaulted)
  - created_at

- **payments**: Payment records
  - id (auto-generated)
  - loan_id (reference to loan)
  - amount
  - payment_date
  - weeks_covered
  - week_number
  - balance_after
  - created_at
