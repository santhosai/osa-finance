// Dynamic API URL configuration
// Automatically uses production or development API based on environment
const getApiUrl = () => {
  const hostname = window.location.hostname;

  // Development: Use local server for localhost, 127.0.0.1, or local network IPs (192.x, 172.x, 10.x)
  if (hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname.startsWith('192.168.') ||
      hostname.startsWith('172.') ||
      hostname.startsWith('10.')) {
    // Use the same host but port 3000 for the API
    return `http://${hostname}:3000/api`;
  }

  // Production: Use deployed backend URL
  return 'https://server-santhosais-projects.vercel.app/api';
};

export const API_URL = getApiUrl();
