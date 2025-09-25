// utils/dateHelpers.js
export const formatDate = (date) => {
    if (!date) return '';
    return new Date(date).toLocaleDateString('es-ES', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
    });
};