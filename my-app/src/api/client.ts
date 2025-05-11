import axios from 'axios';

const client = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/v1', // Изменена базовая URL
  headers: { 'Content-Type': 'application/json' },
});

client.interceptors.request.use(config => {
  const token = localStorage.getItem('token');
  if (token) {
    console.log('Request with token:', config.url);
    config.headers['Authorization'] = `Bearer ${token}`;
  } else {
    console.log('Request without token:', config.url);
  }
  return config;
});

client.interceptors.response.use(
  response => {
    console.log('Response success:', response.config.url);
    return response;
  },
  error => {
    console.error('Response error:', error.config?.url, error.response?.status, error.message);
    if (error.response?.status === 401) {
      // Удаляем токен и информацию о пользователе при 401 ошибке
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      
      // Можно добавить редирект на страницу входа, если нужно
      if (window.location.pathname !== '/') {
        window.location.href = '/';
      }
    }
    return Promise.reject(error);
  }
);

export default client;