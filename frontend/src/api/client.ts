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
  return config;
}, error => {
  return Promise.reject(error);
});

client.interceptors.response.use(
  response => response,
  error => {
    if (error.response?.status === 401) {
      const requestUrl = error.config?.url || '';
      if (
        !requestUrl.endsWith('/auth/login') &&
        !requestUrl.endsWith('/auth/register') &&
        !(requestUrl.endsWith('/users/me') && !localStorage.getItem('user'))
      ) {
        console.warn(`401 Unauthorized on ${requestUrl}. Clearing token and user.`);
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        if (window.location.pathname !== '/') {
          window.location.href = '/'; 
        }
      }
    }
    return Promise.reject(error);
  }
);

export default client;