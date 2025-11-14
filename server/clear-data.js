import db from './firestore.js';

async function clearCollection(collectionName) {
  console.log(`🗑️  Clearing ${collectionName}...`);
  const snapshot = await db.collection(collectionName).get();
  const batch = db.batch();
  snapshot.docs.forEach(doc => {
    batch.delete(doc.ref);
  });
  await batch.commit();
  console.log(`✅ Cleared ${snapshot.size} documents from ${collectionName}`);
}

async function clearDatabase() {
  try {
    console.log('🗑️  Deleting all data from Firebase...\n');
    
    await clearCollection('payments');
    await clearCollection('loans');
    await clearCollection('customers');
    
    console.log('\n✅ All data deleted successfully!');
    console.log('📊 Your database is now empty and ready for production data.');
    
  } catch (error) {
    console.error('❌ Error clearing database:', error);
    process.exit(1);
  }
  
  process.exit(0);
}

clearDatabase();
