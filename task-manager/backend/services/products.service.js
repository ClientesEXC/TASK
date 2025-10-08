const repo = require('../repos/products.repo');

async function listProducts(query) {
    return repo.list(query);
}

async function getProduct(id, opts) {
    const p = await repo.getById(id, opts);
    if (!p) {
        const err = new Error('Producto no encontrado');
        err.status = 404;
        throw err;
    }
    return p;
}

async function createProduct(body) {
    return repo.createOne(body);
}

async function updateProduct(id, body) {
    return repo.updateOne(id, body);
}

async function deleteProduct(id) {
    const p = await repo.softDelete(id);
    if (!p) {
        const err = new Error('Producto no encontrado o ya eliminado');
        err.status = 404;
        throw err;
    }
    return p;
}

async function restoreProduct(id) {
    const p = await repo.restore(id);
    if (!p) {
        const err = new Error('Producto no restaurable');
        err.status = 404;
        throw err;
    }
    return p;
}

module.exports = {
    listProducts,
    getProduct,
    createProduct,
    updateProduct,
    deleteProduct,
    restoreProduct,
};
