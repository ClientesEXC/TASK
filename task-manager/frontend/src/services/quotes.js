// task-manager/frontend/src/services/quotes.js
import api from '../config/api'; // ya apunta a /api

export async function listQuotes() {
    const { data } = await api.get('/quotes');
    return data;
}

export async function getQuote(id) {
    const { data } = await api.get(`/quotes/${id}`);
    return data;
}

export async function createQuote(payload) {
    const { data } = await api.post('/quotes', payload);
    return data;
}
