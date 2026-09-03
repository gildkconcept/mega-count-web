import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export const authService = {
  login: async (username: string, password: string) => {
    const response = await api.post('/api/auth/login', { username, password });
    return response.data;
  },
  logout: async () => {
    const response = await api.post('/api/auth/logout');
    return response.data;
  },
  me: async () => {
    const response = await api.get('/api/auth/me');
    return response.data;
  },
};

export const assemblyService = {
  getAll: async () => {
    const response = await api.get('/api/assemblies');
    return response.data;
  },
};

export const serviceService = {
  getAll: async () => {
    const response = await api.get('/api/services');
    return response.data;
  },
};

export const entranceService = {
  getAll: async (assembly_id?: string) => {
    const params = assembly_id ? { assembly_id } : {};
    const response = await api.get('/api/entrances', { params });
    return response.data;
  },
};

export const sessionService = {
  getAll: async () => {
    const response = await api.get('/api/sessions');
    return response.data;
  },
  start: async (data: any) => {
    const response = await api.post('/api/sessions/start', data);
    return response.data;
  },
  end: async (id: string, data: any) => {
    const response = await api.put(`/api/sessions/${id}/end`, data);
    return response.data;
  },
};

export const statisticsService = {
  getDashboard: async () => {
    const response = await api.get('/api/statistics/dashboard');
    return response.data;
  },
};