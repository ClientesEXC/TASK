// Detectar automáticamente la URL del API
const getApiUrl = () => {
    // En producción o red local
    if (process.env.REACT_APP_API_URL) {
        return process.env.REACT_APP_API_URL;
    }

    // Detectar si estamos en localhost o en red
    const hostname = window.location.hostname;

    if (hostname === 'localhost' || hostname === '127.0.0.1') {
        return 'http://localhost:3001/api';
    }

    // Si accedemos por IP, usar esa misma IP para el API
    return `http://${hostname}:3001/api`;
};

export const API_URL = getApiUrl();

console.log('🔗 API URL configurada:', API_URL);