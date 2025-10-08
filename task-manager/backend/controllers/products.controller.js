const svc = require('../services/products.service');
const { parsePagination, buildSort } = require('../utils/pagination');

function asMeta({ page, perPage, total }) {
    const totalPages = Math.ceil(total / perPage);
    return { page, per_page: perPage, total, total_pages: totalPages };
}

async function list(req, res, next) {
    try {
        const { page, per_page, sort, dir, q, is_active, min_stock, include_deleted } = req.query;
        const { page: p, perPage, offset } = parsePagination({ page, per_page });
        const { field, direction } = buildSort({ sort, dir }, [
            'id', 'name', 'price', 'stock_available', 'created_at', 'updated_at',
        ]);

        const { rows, total } = await svc.listProducts({
            q,
            is_active,
            min_stock,
            include_deleted,
            sort: field,
            dir: direction,
            offset,
            limit: perPage,
        });

        res.json({ data: rows, meta: asMeta({ page: p, perPage, total }) });
    } catch (e) { next(e); }
}

async function getOne(req, res, next) {
    try {
        const product = await svc.getProduct(req.params.id, { includeDeleted: !!req.query.include_deleted });
        res.set('ETag', `"v${product.version}"`);
        res.json({ data: product });
    } catch (e) { next(e); }
}

async function create(req, res, next) {
    try {
        const created = await svc.createProduct(req.body);
        res.status(201).json({ data: created });
    } catch (e) { next(e); }
}

async function update(req, res, next) {
    try {
        const expected_version =
            req.headers['if-match']?.replace(/"/g, '').replace(/^v/, '') || req.body.expected_version;

        const updated = await svc.updateProduct(req.params.id, { ...req.body, expected_version });
        res.set('ETag', `"v${updated.version}"`);
        res.json({ data: updated });
    } catch (e) { next(e); }
}

async function remove(req, res, next) {
    try {
        const deleted = await svc.deleteProduct(req.params.id);
        res.json({ data: deleted });
    } catch (e) { next(e); }
}

async function restore(req, res, next) {
    try {
        const restored = await svc.restoreProduct(req.params.id);
        res.json({ data: restored });
    } catch (e) { next(e); }
}

module.exports = { list, getOne, create, update, remove, restore };
