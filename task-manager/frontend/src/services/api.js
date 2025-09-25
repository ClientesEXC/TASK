// services/api.js
const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

export const api = {
    rentals: {
        getAll: () => axios.get(`${API_BASE}/rentals`),
        create: (data) => axios.post(`${API_BASE}/rentals`, data),
        delete: (id) => axios.delete(`${API_BASE}/rentals/${id}`),
        getStats: () => axios.get(`${API_BASE}/rentals/stats`)
    },
    items: {
        getAll: () => axios.get(`${API_BASE}/rental-items`),
        create: (data) => axios.post(`${API_BASE}/rental-items`, data),
        delete: (id) => axios.delete(`${API_BASE}/rental-items/${id}`)
    }
};