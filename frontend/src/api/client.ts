import axios, { AxiosInstance, AxiosError } from 'axios';

const API_BASE_URL = (import.meta as any).env?.VITE_API_URL || '/api';

// Create axios instance with defaults
export const axiosClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true, // Important for httpOnly cookies
});

// Response interceptor for error handling
axiosClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.response) {
      // Server responded with error
      const status = error.response.status;
      
      if (status === 403) {
        console.error('Access forbidden');
      } else if (status >= 500) {
        console.error('Server error:', error.response.data);
      }
      // Don't redirect on 401 - let the app handle it
    } else if (error.request) {
      // Request made but no response
      console.error('Network error - no response received');
    } else {
      console.error('Request setup error:', error.message);
    }
    
    return Promise.reject(error);
  }
);
