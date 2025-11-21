// Dynamic API URL configuration
// Automatically uses production or development API based on environment
const getApiUrl = () => {
  // Production: Use deployed backend URL
  // This permanent Vercel URL never changes - always points to latest production deployment
  if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
    return 'https://server-santhosais-projects.vercel.app/api';
  }

  // Development: Use local server
  return 'http://localhost:3000/api';
};

export const API_URL = getApiUrl();
