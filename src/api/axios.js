// src/api/axios.js
import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:3000/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// REQUEST interceptor — attach token to every API call automatically
api.interceptors.request.use(
  (config) => {
    // Get token from localStorage
    const token = localStorage.getItem('hotel_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

// RESPONSE interceptor — handle errors globally
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // 401 = token expired or account disabled
    // Auto logout and redirect to login
    if (error.response?.status === 401) {
      localStorage.removeItem('hotel_token');
      localStorage.removeItem('hotel_user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  },
);

export default api;