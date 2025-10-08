// task-manager/frontend/src/config/api.js
import axios from 'axios';

// Detectar automáticamente la URL del API
const getApiUrl = () => {
    // 1) Si viene de .env, úsalo (p.ej. http://19.18.1.101:3001/api)
    if (process.env.REACT_APP_API_URL) {
        return process.env.REACT_APP_API_URL;
    }

    // 2) Si estamos en localhost
    const hostname = window.location.hostname;
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
        return 'http://localhost:3001/api';
    }

    // 3) Acceso por IP o dominio: usar esa IP con puerto 3001
    return `http://${hostname}:3001/api`;
};

// Normaliza la base: sin slash final (evita //v1)
const API_BASE = getApiUrl().replace(/\/+$/, '');

// Cliente axios único
const api = axios.create({
    baseURL: API_BASE,              // ej: http://19.18.1.101:3001/api
    timeout: 15000,
    headers: { 'Content-Type': 'application/json' },
});

// Interceptor para exponer mensajes de error amigables
api.interceptors.response.use(
    (res) => res,
    (err) => {
        const msg =
            err?.response?.data?.error?.message ||
            err?.response?.data?.error ||
            err.message ||
            'Error de red';
        err.userMessage = msg;
        return Promise.reject(err);
    }
);

// Para debug
export const API_URL = API_BASE;
console.log('🔗 API URL configurada:', API_URL);

export { api };
export default api;
