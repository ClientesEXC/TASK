// task-manager/backend/services/quotes.service.js
const Joi = require('joi');
const repo = require('../repos/quotes.repo');

const quoteSchema = Joi.object({
    type_service: Joi.string().valid('SOLO_CORTE', 'DISENADO').required(),
    materials: Joi.object().required(),               // dimensiones, materiales seleccionados, etc.
    include_print: Joi.boolean().required(),
    include_design: Joi.boolean().required(),
    design_level: Joi.string().valid('FACIL','MEDIO','DIFICIL').allow(null,''),
    ojales_count: Joi.number().integer().min(0).allow(null),
    include_vinyl_cut: Joi.boolean().required(),
    include_pvc_base: Joi.boolean().required(),
    pricing_snapshot: Joi.any().optional(),           // JSON
    details: Joi.array().items(Joi.object()).required(),
    final_total: Joi.number().precision(2).min(0).required(),
});

async function createQuote(data) {
    const { error, value } = quoteSchema.validate(data, { abortEarly: false });
    if (error) {
        const messages = error.details.map(d => d.message);
        const err = new Error('Validación de cotización fallida');
        err.status = 400;
        err.details = messages;
        throw err;
    }
    return repo.createQuote(value);
}

async function listQuotes() {
    return repo.listQuotes();
}

async function getQuoteById(id) {
    return repo.getQuoteById(id);
}

module.exports = { createQuote, listQuotes, getQuoteById };
