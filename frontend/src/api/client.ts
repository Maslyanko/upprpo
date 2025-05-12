import axios from 'axios';

// Create API client with correct base URL
const client = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/v1', // Make sure this matches your backend
  headers: { 'Content-Type': 'application/json' },
});

// Add request interceptor to include auth token
client.interceptors.request.use(config => {
  // Get token from localStorage
  const token = localStorage.getItem('token');
  
  if (token) {
    // Set Authorization header for every request if token exists
    config.headers['Authorization'] = `Bearer ${token}`;
    console.log('Request with token:', config.url);
  } else {
    console.log('Request without token:', config.url);
  }
  
  return config;
}, error => {
  console.error('Request error:', error);
  return Promise.reject(error);
});

// Add response interceptor for error handling
client.interceptors.response.use(
  response => {
    console.log('Response success:', response.config.url);
    return response;
  },
  error => {
    console.error('Response error:', error.config?.url, error.response?.status, error.message);
    
    // Handle authentication errors
    if (error.response?.status === 401) {
      console.log('Authentication error - clearing credentials');
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      
      // Redirect to home page
      window.location.href = '/';
    }
    
    return Promise.reject(error);
  }
);

export default client;