import React, { createContext, useContext, useState, useEffect } from 'react';

// Tamil translations
const translations = {
  en: {
    // Dashboard
    dashboard: 'Dashboard',
    weeklyFinance: 'Weekly Finance',
    monthlyFinance: 'Monthly Finance',
    dailyFinance: 'Daily Finance',
    vaddiList: 'Vaddi List',
    customers: 'Customers',
    adminProfit: 'Admin Profit',
    investments: 'Investments',
    archivedLoans: 'Archived Loans',
    userManagement: 'User Management',
    logout: 'Logout',
    sundayCollections: 'Sunday Collections',
    overduePayments: 'Overdue Payments',
    paymentTracker: 'Payment Tracker',

    // Stats
    totalGiven: 'Total Given',
    totalBalance: 'Total Balance',
    collected: 'Collected',
    outstanding: 'Outstanding',
    activeLoans: 'Active Loans',
    profit: 'Profit',
    totalOutstanding: 'Total Outstanding',
    weekly: 'Weekly',
    daily: 'Daily',
    monthly: 'Monthly',
    balance: 'Balance',
    given: 'Given',
    myProfit: 'My Profit',
    friend: 'Friend',

    // Actions
    addCustomer: 'Add Customer',
    addPayment: 'Add Payment',
    search: 'Search',
    save: 'Save',
    cancel: 'Cancel',
    delete: 'Delete',
    edit: 'Edit',
    back: 'Back',
    quickRef: 'Quick Ref',
    downloadNow: 'Download Now',
    refresh: 'Refresh',

    // Status
    paid: 'Paid',
    unpaid: 'Unpaid',
    active: 'Active',
    closed: 'Closed',
    pending: 'Pending',

    // Time
    today: 'Today',
    thisWeek: 'This Week',
    thisMonth: 'This Month',
    week: 'Week',
    month: 'Month',

    // Messages
    noData: 'No data available',
    loading: 'Loading...',
    success: 'Success',
    error: 'Error',
    noPaymentsDue: 'No payments due for this Sunday',
    selectSunday: 'Please select a Sunday. Collections are only on Sundays.',
    backupReminder: 'Monthly Backup Reminder',
    backupDesc: 'Download your data backup to keep your records safe',

    // Charts
    collectionsOverTime: 'Collections Over Time',
    loanDistribution: 'Loan Distribution Chart',

    // Weekly Section
    weeklyPayments: 'Weekly Payments',
    weeklyFinanceOverview: 'Weekly Finance Overview',
    totalDue: 'Total Due',
    weeksLeft: 'weeks left',

    // Settings
    settings: 'Settings',
    darkMode: 'Dark Mode',
    light: 'Light',
    dark: 'Dark',
    language: 'Language',
    english: 'English',
    tamil: 'Tamil'
  },
  ta: {
    // Dashboard
    dashboard: 'டாஷ்போர்டு',
    weeklyFinance: 'வாராந்திர நிதி',
    monthlyFinance: 'மாதாந்திர நிதி',
    dailyFinance: 'தினசரி நிதி',
    vaddiList: 'வட்டி பட்டியல்',
    customers: 'வாடிக்கையாளர்கள்',
    adminProfit: 'நிர்வாக லாபம்',
    investments: 'முதலீடுகள்',
    archivedLoans: 'காப்பக கடன்கள்',
    userManagement: 'பயனர் மேலாண்மை',
    logout: 'வெளியேறு',
    sundayCollections: 'ஞாயிறு வசூல்',
    overduePayments: 'தாமத பணம்',
    paymentTracker: 'பணம் கண்காணிப்பு',

    // Stats
    totalGiven: 'மொத்தம் கொடுத்தது',
    totalBalance: 'மொத்த இருப்பு',
    collected: 'வசூல்',
    outstanding: 'நிலுவை',
    activeLoans: 'செயலில் கடன்கள்',
    profit: 'லாபம்',
    totalOutstanding: 'மொத்த நிலுவை',
    weekly: 'வாராந்திர',
    daily: 'தினசரி',
    monthly: 'மாதாந்திர',
    balance: 'இருப்பு',
    given: 'கொடுத்தது',
    myProfit: 'என் லாபம்',
    friend: 'நண்பர்',

    // Actions
    addCustomer: 'வாடிக்கையாளர் சேர்',
    addPayment: 'பணம் சேர்',
    search: 'தேடு',
    save: 'சேமி',
    cancel: 'ரத்து',
    delete: 'நீக்கு',
    edit: 'திருத்து',
    back: 'பின்',
    quickRef: 'விரைவு குறிப்பு',
    downloadNow: 'இப்போது பதிவிறக்கு',
    refresh: 'புதுப்பி',

    // Status
    paid: 'செலுத்தியது',
    unpaid: 'செலுத்தவில்லை',
    active: 'செயலில்',
    closed: 'மூடப்பட்டது',
    pending: 'நிலுவையில்',

    // Time
    today: 'இன்று',
    thisWeek: 'இந்த வாரம்',
    thisMonth: 'இந்த மாதம்',
    week: 'வாரம்',
    month: 'மாதம்',

    // Messages
    noData: 'தரவு இல்லை',
    loading: 'ஏற்றுகிறது...',
    success: 'வெற்றி',
    error: 'பிழை',
    noPaymentsDue: 'இந்த ஞாயிறு பணம் இல்லை',
    selectSunday: 'ஞாயிறு தேர்வு செய்யவும். வசூல் ஞாயிறு மட்டும்.',
    backupReminder: 'மாத காப்பு நினைவூட்டல்',
    backupDesc: 'உங்கள் தரவை பாதுகாப்பாக வைக்க பதிவிறக்கவும்',

    // Charts
    collectionsOverTime: 'காலப்போக்கில் வசூல்',
    loanDistribution: 'கடன் விநியோகம்',

    // Weekly Section
    weeklyPayments: 'வாராந்திர பணம்',
    weeklyFinanceOverview: 'வாராந்திர நிதி கண்ணோட்டம்',
    totalDue: 'மொத்த நிலுவை',
    weeksLeft: 'வாரங்கள் மீதம்',

    // Settings
    settings: 'அமைப்புகள்',
    darkMode: 'இருண்ட பயன்முறை',
    light: 'வெளிச்சம்',
    dark: 'இருள்',
    language: 'மொழி',
    english: 'ஆங்கிலம்',
    tamil: 'தமிழ்'
  }
};

const LanguageContext = createContext();

export function LanguageProvider({ children }) {
  const [language, setLanguage] = useState(() => {
    return localStorage.getItem('app_language') || 'en';
  });

  useEffect(() => {
    localStorage.setItem('app_language', language);
  }, [language]);

  const t = (key) => {
    return translations[language][key] || key;
  };

  const toggleLanguage = () => {
    setLanguage(prev => prev === 'en' ? 'ta' : 'en');
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t, toggleLanguage }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}

export default LanguageContext;
