const Joi = require('joi');

const idParam = Joi.object({
    id: Joi.number().integer().positive().required(),
});

const listQuery = Joi.object({
    q: Joi.string().max(120).allow(''),
    is_active: Joi.boolean().truthy('true').falsy('false'),
    min_stock: Joi.number().integer().min(0),
    page: Joi.number().integer().min(1).default(1),
    per_page: Joi.number().integer().min(1).max(100).default(10),
    sort: Joi.string().valid('id', 'name', 'price', 'stock_available', 'created_at', 'updated_at').default('created_at'),
    dir: Joi.string().valid('asc', 'desc').default('desc'),
    include_deleted: Joi.boolean().truthy('true').falsy('false').default(false),
});

const createBody = Joi.object({
    name: Joi.string().max(120).required(),
    description: Joi.string().allow('', null),
    price: Joi.number().precision(2).min(0).required(),
    stock_total: Joi.number().integer().min(0).required(),
    image_url: Joi.string().uri().allow(null, ''),
    is_active: Joi.boolean().default(true),
});

const updateBody = Joi.object({
    name: Joi.string().max(120),
    description: Joi.string().allow('', null),
    price: Joi.number().precision(2).min(0),
    stock_total: Joi.number().integer().min(0),
    image_url: Joi.string().uri().allow(null, ''),
    is_active: Joi.boolean(),
    // para optimistic locking
    expected_version: Joi.number().integer().min(1),
}).min(1);

module.exports = { idParam, listQuery, createBody, updateBody };
