// middleware/errorHandler.js
const errorHandler = (err, req, res, next) => {
    const status = err.status || 500;
    res.status(status).json({
        error: err.message,
        status,
        timestamp: new Date().toISOString()
    });
};