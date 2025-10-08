function parsePagination({ page = 1, per_page = 10, maxPerPage = 100 }) {
    const p = Math.max(1, Number(page));
    const pp = Math.min(maxPerPage, Math.max(1, Number(per_page)));
    const offset = (p - 1) * pp;
    return { page: p, perPage: pp, offset };
}

function buildSort({ sort = 'created_at', dir = 'desc' }, allowed = []) {
    const field = allowed.includes(sort) ? sort : allowed[0] || 'created_at';
    const direction = String(dir).toLowerCase() === 'asc' ? 'ASC' : 'DESC';
    return { field, direction };
}

module.exports = { parsePagination, buildSort };
