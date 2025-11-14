// Dynamic API URL configuration
// Automatically uses production or development API based on environment
const getApiUrl = () => {
  // Production: Use deployed backend URL
  if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
    return 'https://your-backend.vercel.app/api';
  }

  // Development: Use local server
  const hostname = window.location.hostname;
  return `http://${hostname}:3000/api`;
};

export const API_URL = getApiUrl();
