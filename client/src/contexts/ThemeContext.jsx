import React, { createContext, useContext, useState, useEffect } from 'react';

const ThemeContext = createContext();

// Dark mode color palette
export const darkTheme = {
  background: '#0f172a',
  backgroundSecondary: '#1e293b',
  backgroundCard: '#1e293b',
  text: '#f1f5f9',
  textSecondary: '#94a3b8',
  border: '#334155',
  primary: '#3b82f6',
  success: '#22c55e',
  danger: '#ef4444',
  warning: '#f59e0b',
  gradientPrimary: 'linear-gradient(135deg, #1e40af 0%, #1e3a8a 100%)',
  gradientSuccess: 'linear-gradient(135deg, #166534 0%, #14532d 100%)',
  gradientDanger: 'linear-gradient(135deg, #991b1b 0%, #7f1d1d 100%)',
  gradientCard: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
  shadow: '0 4px 12px rgba(0,0,0,0.4)'
};

// Light mode color palette
export const lightTheme = {
  background: '#f8fafc',
  backgroundSecondary: '#ffffff',
  backgroundCard: '#ffffff',
  text: '#1e293b',
  textSecondary: '#64748b',
  border: '#e2e8f0',
  primary: '#3b82f6',
  success: '#22c55e',
  danger: '#ef4444',
  warning: '#f59e0b',
  gradientPrimary: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
  gradientSuccess: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
  gradientDanger: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
  gradientCard: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
  shadow: '0 4px 12px rgba(0,0,0,0.1)'
};

export function ThemeProvider({ children }) {
  const [isDarkMode, setIsDarkMode] = useState(() => {
    return localStorage.getItem('app_dark_mode') === 'true';
  });

  useEffect(() => {
    localStorage.setItem('app_dark_mode', isDarkMode.toString());

    // Apply to body for global styles
    if (isDarkMode) {
      document.body.style.backgroundColor = darkTheme.background;
      document.body.style.color = darkTheme.text;
    } else {
      document.body.style.backgroundColor = lightTheme.background;
      document.body.style.color = lightTheme.text;
    }
  }, [isDarkMode]);

  const theme = isDarkMode ? darkTheme : lightTheme;

  const toggleDarkMode = () => {
    setIsDarkMode(prev => !prev);
  };

  return (
    <ThemeContext.Provider value={{ isDarkMode, toggleDarkMode, theme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}

export default ThemeContext;
