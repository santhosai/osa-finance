import admin from 'firebase-admin';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Initialize Firebase Admin
let db;

try {
  // Try to load service account from file
  const serviceAccountPath = join(__dirname, 'serviceAccountKey.json');
  const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });

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
  console.log('6. Restart the server\n');
  process.exit(1);
}

export default db;
