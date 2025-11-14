// Dynamic API URL configuration
// Automatically uses the correct hostname for both laptop and mobile
const getApiUrl = () => {
  const hostname = window.location.hostname;
  // If accessing from network IP, use that IP for API calls
  // If accessing from localhost, use localhost
  return `http://${hostname}:3000/api`;
};

export const API_URL = getApiUrl();
