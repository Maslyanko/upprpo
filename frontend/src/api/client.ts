// ==== File: frontend/src/api/client.ts ====
import axios from 'axios';

const client = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/v1',
  headers: { 'Content-Type': 'application/json' },
});

client.interceptors.request.use(config => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers['Authorization'] = `Bearer ${token}`;
  }
  // console.log('API Request:', config.method?.toUpperCase(), config.url, config.params || '', config.data || ''); // DEBUG: Log requests
  return config;
}, error => {
  console.error('Request error:', error);
  return Promise.reject(error);
});

client.interceptors.response.use(
  response => {
    // console.log('API Response Success:', response.config.url, response.status); // DEBUG: Log success
    return response;
  },
  error => {
    // console.error('API Response Error:', error.config?.url, error.response?.status, error.message, error.response?.data); // DEBUG: Log full error

    if (error.response?.status === 401) {
      const requestUrl = error.config?.url || '';
      // Avoid clearing credentials and redirecting for login/register failures,
      // or for the initial /users/me call if it fails (useAuth will handle that).
      if (
        !requestUrl.endsWith('/auth/login') &&
        !requestUrl.endsWith('/auth/register') &&
        !(requestUrl.endsWith('/users/me') && !localStorage.getItem('user')) // Don't clear if /me fails & no user was stored yet (initial load scenario)
      ) {
        console.warn(`401 Unauthorized on ${requestUrl}. Clearing token and user.`);
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        // Only redirect if not already on the homepage to avoid loop if homepage itself causes 401
        if (window.location.pathname !== '/') {
          window.location.href = '/'; // Redirect to home page for re-authentication
        }
      } else {
        // console.log(`Auth-related request to ${requestUrl} failed with 401. Error will be handled by the caller.`);
      }
    }
    return Promise.reject(error);
  }
);

export default client;