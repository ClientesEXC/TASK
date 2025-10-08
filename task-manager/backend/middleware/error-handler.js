const createError = require('http-errors');

function notFound(req, res, next) {
    next(createError(404, 'Recurso no encontrado'));
}

function errorHandler(err, req, res, next) { // eslint-disable-line
    const status = err.status || err.statusCode || 500;
    const payload = {
        error: {
            message: err.message || 'Error interno',
            code: err.code || undefined,
            details: err.details || undefined,
        },
    };
    if (process.env.NODE_ENV !== 'production') {
        payload.error.stack = err.stack;
    }
    res.status(status).json(payload);
}

module.exports = { notFound, errorHandler };
