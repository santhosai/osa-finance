// Dynamic API URL configuration
// Automatically uses production or development API based on environment
const getApiUrl = () => {
  // Production: Use deployed backend URL
  if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
    return 'https://server-26v2muykz-santhosais-projects.vercel.app/api';
  }

  // Development: Use local server
  return 'http://localhost:3000/api';
};

export const API_URL = getApiUrl();
