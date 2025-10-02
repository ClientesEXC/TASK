// Archivo: task-manager/backend/middleware/auth.js
// Sistema de autenticación simple con usuario por defecto

const AUTH_TOKEN = process.env.AUTH_TOKEN || 'default-token-123';
const DEFAULT_USER_ID = 1; // ID del usuario por defecto

/**
 * Middleware de autenticación simple
 * En producción, deberías usar JWT o sesiones reales
 */
const authMiddleware = (req, res, next) => {
    // Obtener token del header
    const token = req.headers['authorization']?.replace('Bearer ', '') ||
        req.headers['x-auth-token'] ||
        req.query.token;

    // Para desarrollo: permitir sin token pero usar usuario por defecto
    if (!token) {
        req.user = {
            id: DEFAULT_USER_ID,
            name: 'Usuario Sistema',
            email: 'sistema@taskmanager.com'
        };
        return next();
    }

    // Validar token simple
    if (token === AUTH_TOKEN) {
        req.user = {
            id: DEFAULT_USER_ID,
            name: 'Usuario Autenticado',
            email: 'user@taskmanager.com'
        };
        next();
    } else {
        res.status(401).json({
            error: 'Token inválido'
        });
    }
};

/**
 * Middleware opcional: solo asigna usuario si hay token
 */
const optionalAuth = (req, res, next) => {
    const token = req.headers['authorization']?.replace('Bearer ', '') ||
        req.headers['x-auth-token'];

    if (token && token === AUTH_TOKEN) {
        req.user = {
            id: DEFAULT_USER_ID,
            name: 'Usuario Autenticado',
            email: 'user@taskmanager.com'
        };
    } else {
        // Usuario invitado
        req.user = {
            id: DEFAULT_USER_ID,
            name: 'Invitado',
            email: 'guest@taskmanager.com'
        };
    }

    next();
};

module.exports = {
    authMiddleware,
    optionalAuth,
    DEFAULT_USER_ID
};