import axios from 'axios';

const fallbackBaseUrl = process.env.NODE_ENV === 'development'
  ? 'http://localhost:8000/api'
  : '/api';

export const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_BASE_URL || fallbackBaseUrl,
});
