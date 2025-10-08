import api from '../config/api';

// Adaptadores entre API <-> UI
export const toUIProduct = (p) => ({
    id: p.id,
    name: p.name,
    description: p.description || '',
    price: Number(p.price),
    stock: Number(p.stock_total),
    availableStock: Number(p.stock_available),
    image: p.image_url || null,
    is_active: !!p.is_active,
    version: Number(p.version),
    created_at: p.created_at,
    updated_at: p.updated_at,
});

const BASE = '/v1/products'; // OJO: api.js ya tiene /api

export async function listProducts({
                                       q = '',
                                       page = 1,
                                       per_page = 12,
                                       sort = 'created_at',
                                       dir = 'desc',
                                       is_active = true,
                                       min_stock,
                                       include_deleted = false,
                                   } = {}) {
    const { data } = await api.get(`${BASE}`, {
        params: { q, page, per_page, sort, dir, is_active, min_stock, include_deleted },
    });
    return {
        items: data.data.map(toUIProduct),
        meta: data.meta,
    };
}

export async function getProduct(id) {
    const res = await api.get(`${BASE}/${id}`);
    const etag = res.headers.etag; // "v{version}"
    return { item: toUIProduct(res.data.data), etag };
}

export async function createProduct(form) {
    const body = {
        name: form.name,
        description: form.description || null,
        price: Number(form.price),
        stock_total: Number(form.stock),
        image_url: form.image || null,
        is_active: true,
    };
    const { data } = await api.post(`${BASE}`, body);
    return toUIProduct(data.data);
}

export async function updateProduct(id, form, expectedVersion) {
    const body = {
        name: form.name,
        description: form.description || null,
        price: form.price !== '' ? Number(form.price) : undefined,
        stock_total: form.stock !== '' ? Number(form.stock) : undefined,
        image_url: form.image || null,
        expected_version: expectedVersion, // optimistic locking
    };
    const res = await api.patch(`${BASE}/${id}`, body);
    const updated = toUIProduct(res.data.data);
    const etag = res.headers.etag; // "v{version}"
    return { updated, etag };
}

export async function deleteProduct(id) {
    const { data } = await api.delete(`${BASE}/${id}`); // soft delete
    return toUIProduct(data.data);
}

export async function restoreProduct(id) {
    const { data } = await api.post(`${BASE}/${id}/restore`);
    return toUIProduct(data.data);
}
