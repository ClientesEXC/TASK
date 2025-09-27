// services/api.js
import axios from 'axios';

// Lee la variable de entorno o usa localhost como fallback
const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

// Instancia global de axios con la URL base
const apiClient = axios.create({
    baseURL: API_BASE,
    withCredentials: true, // si usas cookies/sesiones
});

export const api = {
    rentals: {
        getAll: () => apiClient.get('/rentals'),
        create: (data) => apiClient.post('/rentals', data),
        delete: (id) => apiClient.delete(`/rentals/${id}`),
        getStats: () => apiClient.get('/rentals/stats')
    },
    items: {
        getAll: () => apiClient.get('/rental-items'),
        create: (data) => apiClient.post('/rental-items', data),
        delete: (id) => apiClient.delete(`/rental-items/${id}`)
    }
};
