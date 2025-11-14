import admin from 'firebase-admin';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Initialize Firebase Admin
let db;

try {
  let credential;

  // Check if running on Vercel (environment variables available)
  if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_PRIVATE_KEY && process.env.FIREBASE_CLIENT_EMAIL) {
    console.log('🔧 Using Firebase credentials from environment variables...');

    credential = admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL
    });
  } else {
    // Try to load service account from file (local development)
    console.log('🔧 Using Firebase credentials from serviceAccountKey.json...');
    const serviceAccountPath = join(__dirname, 'serviceAccountKey.json');
    const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));
    credential = admin.credential.cert(serviceAccount);
  }

  admin.initializeApp({ credential });
  db = admin.firestore();
  console.log('✅ Firestore initialized successfully!');
} catch (error) {
  console.error('❌ Error initializing Firestore:', error.message);
  console.log('\n📋 To set up Firebase:');
  console.log('1. Go to Firebase Console: https://console.firebase.google.com/');
  console.log('2. Create a new project or select existing project');
  console.log('3. Go to Project Settings > Service Accounts');
  console.log('4. Click "Generate New Private Key"');
  console.log('5. Save the JSON file as "serviceAccountKey.json" in the server folder');
  console.log('6. Or set environment variables: FIREBASE_PROJECT_ID, FIREBASE_PRIVATE_KEY, FIREBASE_CLIENT_EMAIL');
  console.log('7. Restart the server\n');
  process.exit(1);
}

export default db;
