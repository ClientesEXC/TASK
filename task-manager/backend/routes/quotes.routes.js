// task-manager/backend/routes/quotes.routes.js
const express = require('express');
const { authMiddleware, optionalAuth } = require('../middleware/auth');
const ctrl = require('../controllers/quotes.controller');

const router = express.Router();

// Si quieres proteger la creación con PIN/token, usa authMiddleware
router.get('/quotes', optionalAuth, ctrl.list);
router.get('/quotes/:id', optionalAuth, ctrl.getOne);
router.post('/quotes', optionalAuth, ctrl.create);

module.exports = router;
