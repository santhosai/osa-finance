import db from './firestore.js';

// Helper function to clear a collection
async function clearCollection(collectionName) {
  const snapshot = await db.collection(collectionName).get();
  const batch = db.batch();
  snapshot.docs.forEach(doc => {
    batch.delete(doc.ref);
  });
  await batch.commit();
}

// Main seeding function
async function seedDatabase() {
  try {
    console.log('Clearing existing data...');
    await clearCollection('payments');
    await clearCollection('loans');
    await clearCollection('customers');
    console.log('✅ Cleared existing data');

    // Insert sample customers
    const customers = [
      { name: 'Rajesh Kumar', phone: '9876543210', created_at: new Date().toISOString() },
      { name: 'Priya Sharma', phone: '9988776655', created_at: new Date().toISOString() },
      { name: 'Amit Patel', phone: '9123456789', created_at: new Date().toISOString() },
      { name: 'Sneha Reddy', phone: '9876501234', created_at: new Date().toISOString() },
      { name: 'Vikram Singh', phone: '9998887776', created_at: new Date().toISOString() }
    ];

    const customerIds = [];

    for (const customer of customers) {
      const docRef = await db.collection('customers').add(customer);
      customerIds.push(docRef.id);
    }

    console.log('✅ Inserted sample customers');

    // Insert sample loans
    const loans = [
      {
        customer_id: customerIds[0],
        loan_amount: 10000,
        weekly_amount: 1000,
        balance: 7000,
        start_date: '2024-10-16',
        status: 'active',
        created_at: new Date().toISOString()
      },
      {
        customer_id: customerIds[1],
        loan_amount: 15000,
        weekly_amount: 1500,
        balance: 8000,
        start_date: '2024-10-30',
        status: 'active',
        created_at: new Date().toISOString()
      },
      {
        customer_id: customerIds[2],
        loan_amount: 8000,
        weekly_amount: 1000,
        balance: 3500,
        start_date: '2024-10-09',
        status: 'active',
        created_at: new Date().toISOString()
      },
      {
        customer_id: customerIds[3],
        loan_amount: 12000,
        weekly_amount: 1500,
        balance: 12000,
        start_date: '2024-11-13',
        status: 'active',
        created_at: new Date().toISOString()
      }
    ];

    const loanIds = [];

    for (const loan of loans) {
      const docRef = await db.collection('loans').add(loan);
      loanIds.push(docRef.id);
    }

    console.log('✅ Inserted sample loans');

    // Insert sample payments
    const payments = [
      // Rajesh Kumar's payments (Loan 1)
      {
        loan_id: loanIds[0],
        amount: 1000,
        payment_date: '2024-11-13',
        weeks_covered: 1.0,
        week_number: 3,
        balance_after: 7000,
        created_at: new Date().toISOString()
      },
      {
        loan_id: loanIds[0],
        amount: 1000,
        payment_date: '2024-10-30',
        weeks_covered: 1.0,
        week_number: 2,
        balance_after: 8000,
        created_at: new Date().toISOString()
      },
      {
        loan_id: loanIds[0],
        amount: 1000,
        payment_date: '2024-10-23',
        weeks_covered: 1.0,
        week_number: 1,
        balance_after: 9000,
        created_at: new Date().toISOString()
      },
      // Priya Sharma's payments (Loan 2)
      {
        loan_id: loanIds[1],
        amount: 2000,
        payment_date: '2024-11-12',
        weeks_covered: 1.33,
        week_number: 2,
        balance_after: 8000,
        created_at: new Date().toISOString()
      },
      {
        loan_id: loanIds[1],
        amount: 5000,
        payment_date: '2024-11-06',
        weeks_covered: 3.33,
        week_number: 1,
        balance_after: 10000,
        created_at: new Date().toISOString()
      },
      // Amit Patel's payments (Loan 3)
      {
        loan_id: loanIds[2],
        amount: 1500,
        payment_date: '2024-11-11',
        weeks_covered: 1.5,
        week_number: 5,
        balance_after: 3500,
        created_at: new Date().toISOString()
      },
      {
        loan_id: loanIds[2],
        amount: 1000,
        payment_date: '2024-11-04',
        weeks_covered: 1.0,
        week_number: 4,
        balance_after: 5000,
        created_at: new Date().toISOString()
      },
      {
        loan_id: loanIds[2],
        amount: 1000,
        payment_date: '2024-10-28',
        weeks_covered: 1.0,
        week_number: 3,
        balance_after: 6000,
        created_at: new Date().toISOString()
      }
    ];

    for (const payment of payments) {
      await db.collection('payments').add(payment);
    }

    console.log('✅ Inserted sample payments');
    console.log('✅ Database seeded successfully!');
    console.log(`\n📊 Summary:`);
    console.log(`   - ${customers.length} customers`);
    console.log(`   - ${loans.length} loans`);
    console.log(`   - ${payments.length} payments`);

  } catch (error) {
    console.error('❌ Error seeding database:', error);
    process.exit(1);
  }

  process.exit(0);
}

// Run the seeding function
seedDatabase();
