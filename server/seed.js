import db from './firestore.js';

// Helper function to get a Sunday date
function getSunday(weeksAgo = 0) {
  const today = new Date();
  const dayOfWeek = today.getDay();
  const daysToSunday = dayOfWeek === 0 ? 0 : -dayOfWeek;
  const lastSunday = new Date(today);
  lastSunday.setDate(today.getDate() + daysToSunday - (weeksAgo * 7));
  return lastSunday.toISOString().split('T')[0];
}

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
    console.log('🗑️  Clearing existing data...');
    await clearCollection('payments');
    await clearCollection('loans');
    await clearCollection('customers');
    console.log('✅ Cleared existing data\n');

    console.log('🌱 Seeding 20 customers with Sunday-based loans...\n');

    // Insert sample customers (20 customers)
    const customers = [
      { name: 'Rajesh Kumar', phone: '9876543210' },
      { name: 'Priya Sharma', phone: '9876543211' },
      { name: 'Amit Patel', phone: '9876543212' },
      { name: 'Venkat Reddy', phone: '9876543213' },
      { name: 'Suresh Kumar', phone: '9876543214' },
      { name: 'Lakshmi Devi', phone: '9876543215' },
      { name: 'Ramesh Babu', phone: '9876543216' },
      { name: 'Kavitha Rani', phone: '9876543217' },
      { name: 'Ganesh Murthy', phone: '9876543218' },
      { name: 'Divya Lakshmi', phone: '9876543219' },
      { name: 'Srinivas Rao', phone: '9876543220' },
      { name: 'Meena Kumari', phone: '9876543221' },
      { name: 'Karthik Raja', phone: '9876543222' },
      { name: 'Sangeetha Devi', phone: '9876543223' },
      { name: 'Vijay Kumar', phone: '9876543224' },
      { name: 'Anitha Reddy', phone: '9876543225' },
      { name: 'Prakash Babu', phone: '9876543226' },
      { name: 'Deepa Lakshmi', phone: '9876543227' },
      { name: 'Murali Krishna', phone: '9876543228' },
      { name: 'Padma Priya', phone: '9876543229' }
    ];

    // Loan configurations (varied amounts)
    const loanConfigs = [
      { loanAmount: 10000, weeklyAmount: 1000 },
      { loanAmount: 7000, weeklyAmount: 700 },
      { loanAmount: 15000, weeklyAmount: 1500 },
      { loanAmount: 5000, weeklyAmount: 500 },
      { loanAmount: 12000, weeklyAmount: 1200 },
      { loanAmount: 8000, weeklyAmount: 800 },
      { loanAmount: 9000, weeklyAmount: 900 },
      { loanAmount: 6000, weeklyAmount: 600 },
      { loanAmount: 11000, weeklyAmount: 1100 },
      { loanAmount: 13000, weeklyAmount: 1300 },
      { loanAmount: 7500, weeklyAmount: 750 },
      { loanAmount: 10500, weeklyAmount: 1050 },
      { loanAmount: 8500, weeklyAmount: 850 },
      { loanAmount: 9500, weeklyAmount: 950 },
      { loanAmount: 6500, weeklyAmount: 650 },
      { loanAmount: 14000, weeklyAmount: 1400 },
      { loanAmount: 5500, weeklyAmount: 550 },
      { loanAmount: 12500, weeklyAmount: 1250 },
      { loanAmount: 7200, weeklyAmount: 720 },
      { loanAmount: 10800, weeklyAmount: 1080 }
    ];

    const customerIds = [];

    for (const customer of customers) {
      const docRef = await db.collection('customers').add(customer);
      customerIds.push(docRef.id);
    }

    console.log('✅ Inserted sample customers');

    // Insert loans with Sunday-based start dates
    const loanIds = [];
    const paymentModes = ['cash', 'upi', 'bank_transfer', 'cheque', 'mixed'];

    console.log('🏦 Creating loans with Sunday start dates...\n');

    for (let i = 0; i < customers.length; i++) {
      // Create loans with varying start dates (1-8 weeks ago on Sundays)
      const weeksAgo = Math.floor(Math.random() * 8) + 1;
      const startDate = getSunday(weeksAgo);
      const config = loanConfigs[i];

      const loanData = {
        customer_id: customerIds[i],
        loan_amount: config.loanAmount,
        weekly_amount: config.weeklyAmount,
        balance: config.loanAmount, // Will be updated as we add payments
        start_date: startDate,
        status: 'active',
        created_at: new Date().toISOString()
      };

      const loanRef = await db.collection('loans').add(loanData);
      loanIds.push({ id: loanRef.id, ...config, startDate, weeksAgo });
    }

    console.log('✅ Inserted 20 loans');

    // Insert realistic payment histories with skip patterns
    console.log('💰 Creating payment histories with skip patterns...\n');

    let totalPayments = 0;

    for (let i = 0; i < loanIds.length; i++) {
      const loan = loanIds[i];
      const maxWeeksForPayments = Math.min(loan.weeksAgo, 10); // Can't pay more weeks than loan has existed

      // Determine how many payments this customer made (7-10 payments out of available weeks)
      const numPayments = Math.min(
        Math.floor(Math.random() * 4) + 7, // 7-10 payments
        maxWeeksForPayments
      );

      let currentBalance = loan.loanAmount;
      let weekNumber = 0;

      // Generate skip pattern: array of week numbers where payment was made
      const paymentWeeks = [];
      const availableWeeks = [];
      for (let w = 0; w < maxWeeksForPayments; w++) {
        availableWeeks.push(w);
      }

      // Randomly select weeks for payments
      for (let p = 0; p < numPayments; p++) {
        const randomIndex = Math.floor(Math.random() * availableWeeks.length);
        paymentWeeks.push(availableWeeks[randomIndex]);
        availableWeeks.splice(randomIndex, 1);
      }

      // Sort payment weeks in chronological order
      paymentWeeks.sort((a, b) => a - b);

      // Create payments for selected weeks
      for (const weekOffset of paymentWeeks) {
        weekNumber++;

        // Calculate payment amount (mostly full weekly amount, sometimes partial)
        const isPartialPayment = Math.random() < 0.2; // 20% chance of partial payment
        const paymentAmount = isPartialPayment
          ? Math.floor(loan.weeklyAmount * (0.5 + Math.random() * 0.5))
          : loan.weeklyAmount;

        // Split into offline and online amounts
        const offlinePercent = Math.random();
        const offlineAmount = Math.floor(paymentAmount * offlinePercent);
        const onlineAmount = paymentAmount - offlineAmount;

        // Select random payment mode
        const paymentMode = paymentModes[Math.floor(Math.random() * paymentModes.length)];

        const weeksCovered = paymentAmount / loan.weeklyAmount;
        currentBalance = Math.max(0, currentBalance - paymentAmount);

        const paymentDate = getSunday(loan.weeksAgo - weekOffset - 1);

        const paymentData = {
          loan_id: loan.id,
          amount: paymentAmount,
          payment_date: paymentDate,
          payment_mode: paymentMode,
          offline_amount: offlineAmount,
          online_amount: onlineAmount,
          weeks_covered: weeksCovered,
          week_number: weekNumber,
          balance_after: currentBalance,
          created_at: new Date().toISOString()
        };

        await db.collection('payments').add(paymentData);
        totalPayments++;
      }

      // Update loan balance
      const finalStatus = currentBalance === 0 ? 'closed' : 'active';
      await db.collection('loans').doc(loan.id).update({
        balance: currentBalance,
        status: finalStatus
      });
    }

    console.log('✅ Inserted payment histories');
    console.log('✅ Database seeded successfully!');
    console.log(`\n📊 Summary:`);
    console.log(`   - ${customers.length} customers`);
    console.log(`   - ${loanIds.length} loans`);
    console.log(`   - ${totalPayments} payments with skip patterns`);

  } catch (error) {
    console.error('❌ Error seeding database:', error);
    process.exit(1);
  }

  process.exit(0);
}

// Run the seeding function
seedDatabase();
