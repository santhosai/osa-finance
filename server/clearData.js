import db from './firestore.js';

async function clearAllData() {
  try {
    console.log('🗑️  Starting to clear all data from Firestore...\n');

    // Clear payments collection
    console.log('Clearing payments...');
    const paymentsSnapshot = await db.collection('payments').get();
    const paymentDeletes = [];
    paymentsSnapshot.forEach(doc => {
      paymentDeletes.push(doc.ref.delete());
    });
    await Promise.all(paymentDeletes);
    console.log(`✅ Deleted ${paymentsSnapshot.size} payments\n`);

    // Clear loans collection
    console.log('Clearing loans...');
    const loansSnapshot = await db.collection('loans').get();
    const loanDeletes = [];
    loansSnapshot.forEach(doc => {
      loanDeletes.push(doc.ref.delete());
    });
    await Promise.all(loanDeletes);
    console.log(`✅ Deleted ${loansSnapshot.size} loans\n`);

    // Clear customers collection
    console.log('Clearing customers...');
    const customersSnapshot = await db.collection('customers').get();
    const customerDeletes = [];
    customersSnapshot.forEach(doc => {
      customerDeletes.push(doc.ref.delete());
    });
    await Promise.all(customerDeletes);
    console.log(`✅ Deleted ${customersSnapshot.size} customers\n`);

    console.log('🎉 All data has been cleared successfully!');
    console.log('📊 Summary:');
    console.log(`   - Customers: ${customersSnapshot.size} deleted`);
    console.log(`   - Loans: ${loansSnapshot.size} deleted`);
    console.log(`   - Payments: ${paymentsSnapshot.size} deleted`);
    console.log('\n✨ Database is now empty and ready for deployment!');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error clearing data:', error);
    process.exit(1);
  }
}

clearAllData();
