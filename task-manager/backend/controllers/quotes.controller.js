// task-manager/backend/controllers/quotes.controller.js
const svc = require('../services/quotes.service');

async function create(req, res, next) {
    try {
        const created = await svc.createQuote(req.body);
        res.status(201).json(created);
    } catch (err) {
        next(err);
    }
}

async function list(req, res, next) {
    try {
        const rows = await svc.listQuotes();
        res.json(rows);
    } catch (err) {
        next(err);
    }
}

async function getOne(req, res, next) {
    try {
        const quote = await svc.getQuoteById(req.params.id);
        if (!quote) return res.status(404).json({ error: 'Cotización no encontrada' });
        res.json(quote);
    } catch (err) {
        next(err);
    }
}

module.exports = { create, list, getOne };
