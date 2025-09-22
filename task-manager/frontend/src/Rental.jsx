import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
    Plus, Edit2, Trash2, Calendar, DollarSign,
    Package, User, Clock, Search, Filter,
    X, AlertCircle, CheckCircle, ArrowRight,
    Key, Home, Phone, Mail, MapPin
} from 'lucide-react';
import './Rental.css';

const API_URL = 'http://localhost:3001/api';

const statusLabels = {
    disponible: 'Disponible',
    alquilado: 'Alquilado',
    reservado: 'Reservado',
    mantenimiento: 'Mantenimiento'
};

const categoryLabels = {
    herramientas: 'Herramientas',
    equipos: 'Equipos',
    vehiculos: 'Vehículos',
    espacios: 'Espacios',
    otros: 'Otros'
};

function Rental({ updateTabData }) {
    const [items, setItems] = useState([]);
    const [rentals, setRentals] = useState([]);
    const [filteredItems, setFilteredItems] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState('all');
    const [filterCategory, setFilterCategory] = useState('all');
    const [showItemModal, setShowItemModal] = useState(false);
    const [showRentalModal, setShowRentalModal] = useState(false);
    const [editingItem, setEditingItem] = useState(null);
    const [selectedItem, setSelectedItem] = useState(null);
    const [view, setView] = useState('grid'); // grid, list, rentals

    const [itemForm, setItemForm] = useState({
        name: '',
        description: '',
        category: 'herramientas',
        daily_rate: 0,
        weekly_rate: 0,
        monthly_rate: 0,
        status: 'disponible',
        quantity: 1,
        image_url: ''
    });

    const [rentalForm, setRentalForm] = useState({
        item_id: '',
        customer_name: '',
        customer_phone: '',
        customer_email: '',
        customer_address: '',
        rental_start: new Date().toISOString().split('T')[0],
        rental_end: '',
        total_amount: 0,
        deposit: 0,
        notes: ''
    });

    useEffect(() => {
        fetchItems();
        fetchRentals();
    }, []);

    useEffect(() => {
        filterItems();
    }, [items, searchTerm, filterStatus, filterCategory]);

    useEffect(() => {
        // Actualizar datos del tab para notificaciones
        const activeRentals = rentals.filter(r => r.status === 'activo').length;
        const overdueRentals = rentals.filter(r => {
            const endDate = new Date(r.rental_end);
            return endDate < new Date() && r.status === 'activo';
        }).length;

        updateTabData({
            notification: overdueRentals > 0 ? overdueRentals : null,
            activeRentals,
            overdueRentals
        });
    }, [rentals, updateTabData]);

    const fetchItems = async () => {
        try {
            const response = await axios.get(`${API_URL}/rental-items`);
            setItems(response.data);
        } catch (error) {
            console.error('Error fetching items:', error);
        }
    };

    const fetchRentals = async () => {
        try {
            const response = await axios.get(`${API_URL}/rentals`);
            setRentals(response.data);
        } catch (error) {
            console.error('Error fetching rentals:', error);
        }
    };

    const filterItems = () => {
        let filtered = [...items];

        // Filtro por búsqueda
        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            filtered = filtered.filter(item =>
                item.name.toLowerCase().includes(term) ||
                item.description?.toLowerCase().includes(term)
            );
        }

        // Filtro por estado
        if (filterStatus !== 'all') {
            filtered = filtered.filter(item => item.status === filterStatus);
        }

        // Filtro por categoría
        if (filterCategory !== 'all') {
            filtered = filtered.filter(item => item.category === filterCategory);
        }

        setFilteredItems(filtered);
    };

    const calculateRentalPrice = () => {
        if (!selectedItem || !rentalForm.rental_start || !rentalForm.rental_end) {
            return 0;
        }

        const start = new Date(rentalForm.rental_start);
        const end = new Date(rentalForm.rental_end);
        const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;

        let price = 0;
        if (days >= 30) {
            const months = Math.floor(days / 30);
            const remainingDays = days % 30;
            price = (months * selectedItem.monthly_rate) + (remainingDays * selectedItem.daily_rate);
        } else if (days >= 7) {
            const weeks = Math.floor(days / 7);
            const remainingDays = days % 7;
            price = (weeks * selectedItem.weekly_rate) + (remainingDays * selectedItem.daily_rate);
        } else {
            price = days * selectedItem.daily_rate;
        }

        return price;
    };

    const handleItemSubmit = async () => {
        try {
            if (editingItem) {
                await axios.put(`${API_URL}/rental-items/${editingItem.id}`, itemForm);
            } else {
                await axios.post(`${API_URL}/rental-items`, itemForm);
            }
            fetchItems();
            closeItemModal();
        } catch (error) {
            console.error('Error saving item:', error);
        }
    };

    const handleRentalSubmit = async () => {
        try {
            const rentalData = {
                ...rentalForm,
                item_id: selectedItem.id,
                total_amount: calculateRentalPrice()
            };
            await axios.post(`${API_URL}/rentals`, rentalData);

            // Actualizar estado del item a alquilado
            await axios.patch(`${API_URL}/rental-items/${selectedItem.id}/status`, {
                status: 'alquilado'
            });

            fetchItems();
            fetchRentals();
            closeRentalModal();
        } catch (error) {
            console.error('Error creating rental:', error);
        }
    };

    const handleDeleteItem = async (id) => {
        if (window.confirm('¿Estás seguro de eliminar este artículo?')) {
            try {
                await axios.delete(`${API_URL}/rental-items/${id}`);
                fetchItems();
            } catch (error) {
                console.error('Error deleting item:', error);
            }
        }
    };

    const handleReturnRental = async (rentalId, itemId) => {
        if (window.confirm('¿Confirmar devolución del artículo?')) {
            try {
                await axios.patch(`${API_URL}/rentals/${rentalId}/return`, {
                    return_date: new Date().toISOString()
                });
                await axios.patch(`${API_URL}/rental-items/${itemId}/status`, {
                    status: 'disponible'
                });
                fetchItems();
                fetchRentals();
            } catch (error) {
                console.error('Error returning rental:', error);
            }
        }
    };

    const openItemModal = (item = null) => {
        if (item) {
            setEditingItem(item);
            setItemForm({
                name: item.name,
                description: item.description || '',
                category: item.category,
                daily_rate: item.daily_rate,
                weekly_rate: item.weekly_rate,
                monthly_rate: item.monthly_rate,
                status: item.status,
                quantity: item.quantity,
                image_url: item.image_url || ''
            });
        } else {
            setEditingItem(null);
            setItemForm({
                name: '',
                description: '',
                category: 'herramientas',
                daily_rate: 0,
                weekly_rate: 0,
                monthly_rate: 0,
                status: 'disponible',
                quantity: 1,
                image_url: ''
            });
        }
        setShowItemModal(true);
    };

    const openRentalModal = (item) => {
        setSelectedItem(item);
        setRentalForm({
            ...rentalForm,
            item_id: item.id
        });
        setShowRentalModal(true);
    };

    const closeItemModal = () => {
        setShowItemModal(false);
        setEditingItem(null);
    };

    const closeRentalModal = () => {
        setShowRentalModal(false);
        setSelectedItem(null);
        setRentalForm({
            item_id: '',
            customer_name: '',
            customer_phone: '',
            customer_email: '',
            customer_address: '',
            rental_start: new Date().toISOString().split('T')[0],
            rental_end: '',
            total_amount: 0,
            deposit: 0,
            notes: ''
        });
    };

    const getStatusColor = (status) => {
        const colors = {
            disponible: '#10b981',
            alquilado: '#ef4444',
            reservado: '#f59e0b',
            mantenimiento: '#6b7280'
        };
        return colors[status] || '#6b7280';
    };

    const getDaysRemaining = (endDate) => {
        const end = new Date(endDate);
        const today = new Date();
        const days = Math.ceil((end - today) / (1000 * 60 * 60 * 24));
        return days;
    };

    const ItemCard = ({ item }) => (
        <div className="rental-item-card">
            {item.image_url && (
                <div className="item-image">
                    <img src={item.image_url} alt={item.name} />
                </div>
            )}
            <div className="item-content">
                <h3 className="item-name">{item.name}</h3>
                <p className="item-category">{categoryLabels[item.category]}</p>

                <div className="item-pricing">
                    <div className="price-item">
                        <span className="price-label">Día</span>
                        <span className="price-value">${item.daily_rate}</span>
                    </div>
                    <div className="price-item">
                        <span className="price-label">Semana</span>
                        <span className="price-value">${item.weekly_rate}</span>
                    </div>
                    <div className="price-item">
                        <span className="price-label">Mes</span>
                        <span className="price-value">${item.monthly_rate}</span>
                    </div>
                </div>

                <div
                    className={`item-status ${item.status}`}
                    style={{ '--status-color': getStatusColor(item.status) }}
                >
                    {statusLabels[item.status]}
                </div>

                <div className="item-actions">
                    {item.status === 'disponible' && (
                        <button
                            className="rent-btn"
                            onClick={() => openRentalModal(item)}
                        >
                            <Key size={16} />
                            Alquilar
                        </button>
                    )}
                    <button
                        className="edit-btn"
                        onClick={() => openItemModal(item)}
                    >
                        <Edit2 size={16} />
                    </button>
                    <button
                        className="delete-btn"
                        onClick={() => handleDeleteItem(item.id)}
                    >
                        <Trash2 size={16} />
                    </button>
                </div>
            </div>
        </div>
    );

    const RentalCard = ({ rental }) => {
        const daysRemaining = getDaysRemaining(rental.rental_end);
        const isOverdue = daysRemaining < 0 && rental.status === 'activo';

        return (
            <div className={`rental-card ${isOverdue ? 'overdue' : ''}`}>
                <div className="rental-header">
                    <h4>{rental.item_name}</h4>
                    <span className={`rental-status ${rental.status}`}>
                        {rental.status === 'activo' ? 'Activo' : 'Finalizado'}
                    </span>
                </div>

                <div className="rental-customer">
                    <User size={16} />
                    <span>{rental.customer_name}</span>
                </div>

                <div className="rental-dates">
                    <div className="date-item">
                        <Clock size={14} />
                        <span>Inicio: {new Date(rental.rental_start).toLocaleDateString()}</span>
                    </div>
                    <div className="date-item">
                        <Calendar size={14} />
                        <span>Fin: {new Date(rental.rental_end).toLocaleDateString()}</span>
                    </div>
                </div>

                {rental.status === 'activo' && (
                    <div className={`days-remaining ${isOverdue ? 'overdue' : ''}`}>
                        {isOverdue ? (
                            <>
                                <AlertCircle size={16} />
                                <span>Vencido hace {Math.abs(daysRemaining)} días</span>
                            </>
                        ) : (
                            <>
                                <Clock size={16} />
                                <span>Quedan {daysRemaining} días</span>
                            </>
                        )}
                    </div>
                )}

                <div className="rental-amount">
                    <DollarSign size={16} />
                    <span>Total: ${rental.total_amount}</span>
                </div>

                {rental.status === 'activo' && (
                    <button
                        className="return-btn"
                        onClick={() => handleReturnRental(rental.id, rental.item_id)}
                    >
                        <CheckCircle size={16} />
                        Marcar como devuelto
                    </button>
                )}
            </div>
        );
    };

    return (
        <div className="rental-container">
            {/* Header */}
            <div className="rental-header">
                <h1>Gestión de Alquileres</h1>
                <div className="header-controls">
                    {/* Búsqueda */}
                    <div className="search-box">
                        <Search size={20} />
                        <input
                            type="text"
                            placeholder="Buscar artículos..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                        {searchTerm && (
                            <button onClick={() => setSearchTerm('')}>
                                <X size={18} />
                            </button>
                        )}
                    </div>

                    {/* Filtros */}
                    <div className="filter-controls">
                        <select
                            value={filterCategory}
                            onChange={(e) => setFilterCategory(e.target.value)}
                        >
                            <option value="all">Todas las categorías</option>
                            {Object.entries(categoryLabels).map(([key, label]) => (
                                <option key={key} value={key}>{label}</option>
                            ))}
                        </select>

                        <select
                            value={filterStatus}
                            onChange={(e) => setFilterStatus(e.target.value)}
                        >
                            <option value="all">Todos los estados</option>
                            {Object.entries(statusLabels).map(([key, label]) => (
                                <option key={key} value={key}>{label}</option>
                            ))}
                        </select>
                    </div>

                    {/* View Toggles */}
                    <div className="view-toggles">
                        <button
                            className={view === 'grid' ? 'active' : ''}
                            onClick={() => setView('grid')}
                        >
                            <Package size={16} />
                            Artículos
                        </button>
                        <button
                            className={view === 'rentals' ? 'active' : ''}
                            onClick={() => setView('rentals')}
                        >
                            <Key size={16} />
                            Alquileres
                        </button>
                    </div>

                    <button className="add-item-btn" onClick={() => openItemModal()}>
                        <Plus size={20} />
                        Nuevo Artículo
                    </button>
                </div>
            </div>

            {/* Stats */}
            <div className="rental-stats">
                <div className="stat">
                    <Package size={20} />
                    <div>
                        <span className="stat-value">{items.length}</span>
                        <span className="stat-label">Total Artículos</span>
                    </div>
                </div>
                <div className="stat">
                    <CheckCircle size={20} />
                    <div>
                        <span className="stat-value">
                            {items.filter(i => i.status === 'disponible').length}
                        </span>
                        <span className="stat-label">Disponibles</span>
                    </div>
                </div>
                <div className="stat">
                    <Key size={20} />
                    <div>
                        <span className="stat-value">
                            {rentals.filter(r => r.status === 'activo').length}
                        </span>
                        <span className="stat-label">Alquilados</span>
                    </div>
                </div>
                <div className="stat">
                    <AlertCircle size={20} />
                    <div>
                        <span className="stat-value">
                            {rentals.filter(r => {
                                const days = getDaysRemaining(r.rental_end);
                                return days < 0 && r.status === 'activo';
                            }).length}
                        </span>
                        <span className="stat-label">Vencidos</span>
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="rental-content">
                {view === 'grid' ? (
                    <div className="items-grid">
                        {filteredItems.length > 0 ? (
                            filteredItems.map(item => (
                                <ItemCard key={item.id} item={item} />
                            ))
                        ) : (
                            <div className="no-items">
                                <Package size={48} />
                                <p>No se encontraron artículos</p>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="rentals-list">
                        {rentals.length > 0 ? (
                            rentals.map(rental => (
                                <RentalCard key={rental.id} rental={rental} />
                            ))
                        ) : (
                            <div className="no-items">
                                <Key size={48} />
                                <p>No hay alquileres registrados</p>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Modal de Artículo */}
            {showItemModal && (
                <div className="modal-overlay">
                    <div className="modal">
                        <h2>{editingItem ? 'Editar Artículo' : 'Nuevo Artículo'}</h2>

                        <div className="form-group">
                            <label>Nombre *</label>
                            <input
                                type="text"
                                value={itemForm.name}
                                onChange={(e) => setItemForm({...itemForm, name: e.target.value})}
                                required
                            />
                        </div>

                        <div className="form-row">
                            <div className="form-group">
                                <label>Categoría</label>
                                <select
                                    value={itemForm.category}
                                    onChange={(e) => setItemForm({...itemForm, category: e.target.value})}
                                >
                                    {Object.entries(categoryLabels).map(([key, label]) => (
                                        <option key={key} value={key}>{label}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="form-group">
                                <label>Estado</label>
                                <select
                                    value={itemForm.status}
                                    onChange={(e) => setItemForm({...itemForm, status: e.target.value})}
                                >
                                    {Object.entries(statusLabels).map(([key, label]) => (
                                        <option key={key} value={key}>{label}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className="form-row">
                            <div className="form-group">
                                <label>Precio por Día</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    value={itemForm.daily_rate}
                                    onChange={(e) => setItemForm({...itemForm, daily_rate: parseFloat(e.target.value)})}
                                />
                            </div>
                            <div className="form-group">
                                <label>Precio por Semana</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    value={itemForm.weekly_rate}
                                    onChange={(e) => setItemForm({...itemForm, weekly_rate: parseFloat(e.target.value)})}
                                />
                            </div>
                            <div className="form-group">
                                <label>Precio por Mes</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    value={itemForm.monthly_rate}
                                    onChange={(e) => setItemForm({...itemForm, monthly_rate: parseFloat(e.target.value)})}
                                />
                            </div>
                        </div>

                        <div className="form-group">
                            <label>Descripción</label>
                            <textarea
                                value={itemForm.description}
                                onChange={(e) => setItemForm({...itemForm, description: e.target.value})}
                                rows="3"
                            />
                        </div>

                        <div className="form-group">
                            <label>URL de Imagen (opcional)</label>
                            <input
                                type="text"
                                value={itemForm.image_url}
                                onChange={(e) => setItemForm({...itemForm, image_url: e.target.value})}
                                placeholder="https://ejemplo.com/imagen.jpg"
                            />
                        </div>

                        <div className="modal-actions">
                            <button className="cancel-btn" onClick={closeItemModal}>
                                Cancelar
                            </button>
                            <button className="save-btn" onClick={handleItemSubmit}>
                                {editingItem ? 'Actualizar' : 'Guardar'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal de Alquiler */}
            {showRentalModal && selectedItem && (
                <div className="modal-overlay">
                    <div className="modal">
                        <h2>Alquilar: {selectedItem.name}</h2>

                        <div className="rental-item-info">
                            <p>Categoría: {categoryLabels[selectedItem.category]}</p>
                            <div className="pricing-info">
                                <span>Día: ${selectedItem.daily_rate}</span>
                                <span>Semana: ${selectedItem.weekly_rate}</span>
                                <span>Mes: ${selectedItem.monthly_rate}</span>
                            </div>
                        </div>

                        <div className="form-group">
                            <label>Nombre del Cliente *</label>
                            <input
                                type="text"
                                value={rentalForm.customer_name}
                                onChange={(e) => setRentalForm({...rentalForm, customer_name: e.target.value})}
                                required
                            />
                        </div>

                        <div className="form-row">
                            <div className="form-group">
                                <label>Teléfono *</label>
                                <input
                                    type="tel"
                                    value={rentalForm.customer_phone}
                                    onChange={(e) => setRentalForm({...rentalForm, customer_phone: e.target.value})}
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <label>Email</label>
                                <input
                                    type="email"
                                    value={rentalForm.customer_email}
                                    onChange={(e) => setRentalForm({...rentalForm, customer_email: e.target.value})}
                                />
                            </div>
                        </div>

                        <div className="form-group">
                            <label>Dirección</label>
                            <input
                                type="text"
                                value={rentalForm.customer_address}
                                onChange={(e) => setRentalForm({...rentalForm, customer_address: e.target.value})}
                            />
                        </div>

                        <div className="form-row">
                            <div className="form-group">
                                <label>Fecha Inicio *</label>
                                <input
                                    type="date"
                                    value={rentalForm.rental_start}
                                    onChange={(e) => setRentalForm({...rentalForm, rental_start: e.target.value})}
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <label>Fecha Fin *</label>
                                <input
                                    type="date"
                                    value={rentalForm.rental_end}
                                    onChange={(e) => setRentalForm({...rentalForm, rental_end: e.target.value})}
                                    min={rentalForm.rental_start}
                                    required
                                />
                            </div>
                        </div>

                        <div className="form-row">
                            <div className="form-group">
                                <label>Depósito</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    value={rentalForm.deposit}
                                    onChange={(e) => setRentalForm({...rentalForm, deposit: parseFloat(e.target.value)})}
                                />
                            </div>
                            <div className="form-group">
                                <label>Total Calculado</label>
                                <div className="calculated-total">
                                    ${calculateRentalPrice().toFixed(2)}
                                </div>
                            </div>
                        </div>

                        <div className="form-group">
                            <label>Notas</label>
                            <textarea
                                value={rentalForm.notes}
                                onChange={(e) => setRentalForm({...rentalForm, notes: e.target.value})}
                                rows="3"
                            />
                        </div>

                        <div className="modal-actions">
                            <button className="cancel-btn" onClick={closeRentalModal}>
                                Cancelar
                            </button>
                            <button className="save-btn" onClick={handleRentalSubmit}>
                                Confirmar Alquiler
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default Rental;