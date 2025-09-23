// task-manager/frontend/src/Rental.jsx
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
    Plus, Edit2, Trash2, Calendar, DollarSign,
    Package, User, Clock, Search, Filter,
    X, AlertCircle, CheckCircle, ArrowRight,
    Key, Home, Phone, Mail, MapPin, CreditCard,
    FileText, Shield, RotateCcw, AlertTriangle,
    Eye, Archive, TrendingUp, Hash
} from 'lucide-react';
import './Rental.css';

const API_URL = 'http://localhost:3001/api';

const statusLabels = {
    disponible: 'Disponible',
    agotado: 'Agotado',
    alquilado: 'Alquilado',
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
    // Estados principales
    const [items, setItems] = useState([]);
    const [rentals, setRentals] = useState([]);
    const [pendingReturns, setPendingReturns] = useState([]);
    const [filteredItems, setFilteredItems] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState('all');
    const [filterCategory, setFilterCategory] = useState('all');
    const [view, setView] = useState('grid'); // grid, rentals, pending
    const [stats, setStats] = useState({});

    // Estados de modales
    const [showItemModal, setShowItemModal] = useState(false);
    const [showRentalModal, setShowRentalModal] = useState(false);
    const [showReturnModal, setShowReturnModal] = useState(false);
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [editingItem, setEditingItem] = useState(null);
    const [selectedItem, setSelectedItem] = useState(null);
    const [selectedRental, setSelectedRental] = useState(null);
    const [payments, setPayments] = useState([]);

    // Formulario de artículo
    const [itemForm, setItemForm] = useState({
        name: '',
        description: '',
        category: 'herramientas',
        daily_rate: 0,
        weekly_rate: 0,
        monthly_rate: 0,
        quantity_total: 1,
        image_url: ''
    });

    // Formulario de alquiler completo
    const [rentalForm, setRentalForm] = useState({
        item_id: '',
        customer_name: '',
        customer_id_number: '',
        customer_address: '',
        customer_phone: '',
        customer_email: '',
        rental_start: new Date().toISOString().split('T')[0],
        rental_end: '',
        quantity_rented: 1,
        total_amount: 0,
        deposit: 0,
        has_collateral: false,
        collateral_description: '',
        notes: '',
        initial_payment: 0
    });

    // Formulario de devolución
    const [returnForm, setReturnForm] = useState({
        return_date: new Date().toISOString().split('T')[0],
        quantity_returned: 1,
        condition_status: 'bueno',
        damage_notes: '',
        return_notes: '',
        final_payment: 0
    });

    // Formulario de pago/abono
    const [paymentForm, setPaymentForm] = useState({
        amount: '',
        payment_date: new Date().toISOString().split('T')[0],
        payment_method: 'efectivo',
        notes: ''
    });

    // Efectos
    useEffect(() => {
        fetchItems();
        fetchRentals();
        fetchPendingReturns();
        fetchStats();
    }, []);

    useEffect(() => {
        filterItems();
    }, [items, searchTerm, filterStatus, filterCategory]);

    useEffect(() => {
        // Actualizar notificaciones
        const overdueCount = pendingReturns.filter(r => {
            const daysOverdue = parseInt(r.days_overdue);
            return daysOverdue > 0;
        }).length;

        updateTabData({
            notification: overdueCount > 0 ? overdueCount : null,
            activeRentals: rentals.filter(r => r.status === 'activo').length,
            overdueRentals: overdueCount
        });
    }, [rentals, pendingReturns, updateTabData]);

    // Funciones de fetch
    const fetchItems = async () => {
        try {
            const response = await axios.get(`${API_URL}/rental-items/availability`);
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

    const fetchPendingReturns = async () => {
        try {
            const response = await axios.get(`${API_URL}/rentals/pending-returns`);
            setPendingReturns(response.data);
        } catch (error) {
            console.error('Error fetching pending returns:', error);
        }
    };

    const fetchStats = async () => {
        try {
            const response = await axios.get(`${API_URL}/rentals/stats/enhanced`);
            setStats(response.data);
        } catch (error) {
            console.error('Error fetching stats:', error);
        }
    };

    const fetchPayments = async (rentalId) => {
        try {
            const response = await axios.get(`${API_URL}/rentals/${rentalId}/payments`);
            setPayments(response.data);
        } catch (error) {
            console.error('Error fetching payments:', error);
            setPayments([]);
        }
    };

    // Funciones de filtrado
    const filterItems = () => {
        let filtered = [...items];

        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            filtered = filtered.filter(item =>
                item.name.toLowerCase().includes(term) ||
                item.description?.toLowerCase().includes(term)
            );
        }

        if (filterStatus !== 'all') {
            filtered = filtered.filter(item => item.status === filterStatus);
        }

        if (filterCategory !== 'all') {
            filtered = filtered.filter(item => item.category === filterCategory);
        }

        setFilteredItems(filtered);
    };

    // Cálculo de precio de alquiler
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

        return price * rentalForm.quantity_rented;
    };

    // Handlers de artículos
    const handleItemSubmit = async () => {
        try {
            if (editingItem) {
                await axios.put(`${API_URL}/rental-items/${editingItem.id}`, {
                    ...itemForm,
                    status: itemForm.quantity_available > 0 ? 'disponible' : 'agotado'
                });
            } else {
                await axios.post(`${API_URL}/rental-items`, {
                    ...itemForm,
                    quantity: itemForm.quantity_total,
                    quantity_available: itemForm.quantity_total,
                    status: 'disponible'
                });
            }

            fetchItems();
            closeItemModal();
        } catch (error) {
            console.error('Error saving item:', error);
            alert('Error al guardar el artículo');
        }
    };

    const handleDeleteItem = async (id) => {
        if (window.confirm('¿Está seguro de eliminar este artículo?')) {
            try {
                await axios.delete(`${API_URL}/rental-items/${id}`);
                fetchItems();
            } catch (error) {
                console.error('Error deleting item:', error);
                alert('No se puede eliminar un artículo con alquileres activos');
            }
        }
    };

    // Handlers de alquiler
    const handleRentalSubmit = async () => {
        try {
            const rentalData = {
                ...rentalForm,
                item_id: selectedItem.id,
                total_amount: calculateRentalPrice()
            };

            await axios.post(`${API_URL}/rentals/enhanced`, rentalData);

            fetchItems();
            fetchRentals();
            fetchPendingReturns();
            fetchStats();
            closeRentalModal();
            alert('Alquiler registrado exitosamente');
        } catch (error) {
            console.error('Error creating rental:', error);
            alert(error.response?.data?.error || 'Error al crear el alquiler');
        }
    };

    // Handlers de devolución
    const handleReturnSubmit = async () => {
        try {
            await axios.post(`${API_URL}/rentals/${selectedRental.id}/return`, returnForm);

            fetchItems();
            fetchRentals();
            fetchPendingReturns();
            fetchStats();
            closeReturnModal();
            alert('Devolución procesada exitosamente');
        } catch (error) {
            console.error('Error processing return:', error);
            alert('Error al procesar la devolución');
        }
    };

    // Handlers de pagos
    const handlePaymentSubmit = async () => {
        try {
            await axios.post(`${API_URL}/rentals/${selectedRental.id}/payments`, paymentForm);

            await fetchPayments(selectedRental.id);
            setPaymentForm({
                amount: '',
                payment_date: new Date().toISOString().split('T')[0],
                payment_method: 'efectivo',
                notes: ''
            });

            fetchPendingReturns();
            alert('Abono registrado exitosamente');
        } catch (error) {
            console.error('Error adding payment:', error);
            alert('Error al registrar el abono');
        }
    };

    const handleDeletePayment = async (paymentId) => {
        if (window.confirm('¿Está seguro de eliminar este abono?')) {
            try {
                await axios.delete(`${API_URL}/rental-payments/${paymentId}`);
                await fetchPayments(selectedRental.id);
                fetchPendingReturns();
            } catch (error) {
                console.error('Error deleting payment:', error);
                alert('Error al eliminar el abono');
            }
        }
    };

    // Funciones de modal
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
                quantity_total: item.quantity_total || 1,
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
                quantity_total: 1,
                image_url: ''
            });
        }
        setShowItemModal(true);
    };

    const closeItemModal = () => {
        setShowItemModal(false);
        setEditingItem(null);
    };

    const openRentalModal = (item) => {
        setSelectedItem(item);
        setRentalForm({
            ...rentalForm,
            quantity_rented: 1,
            item_id: item.id
        });
        setShowRentalModal(true);
    };

    const closeRentalModal = () => {
        setShowRentalModal(false);
        setSelectedItem(null);
        setRentalForm({
            item_id: '',
            customer_name: '',
            customer_id_number: '',
            customer_address: '',
            customer_phone: '',
            customer_email: '',
            rental_start: new Date().toISOString().split('T')[0],
            rental_end: '',
            quantity_rented: 1,
            total_amount: 0,
            deposit: 0,
            has_collateral: false,
            collateral_description: '',
            notes: '',
            initial_payment: 0
        });
    };

    const openReturnModal = (rental) => {
        setSelectedRental(rental);
        setReturnForm({
            ...returnForm,
            quantity_returned: rental.quantity_rented || 1
        });
        setShowReturnModal(true);
    };

    const closeReturnModal = () => {
        setShowReturnModal(false);
        setSelectedRental(null);
    };

    const openPaymentModal = async (rental) => {
        setSelectedRental(rental);
        await fetchPayments(rental.id);
        setShowPaymentModal(true);
    };

    const closePaymentModal = () => {
        setShowPaymentModal(false);
        setSelectedRental(null);
        setPayments([]);
    };

    // Componente de tarjeta de artículo
    const ItemCard = ({ item }) => (
        <div className="rental-item-card">
            <div className="item-image">
                {item.image_url ? (
                    <img src={item.image_url} alt={item.name} />
                ) : (
                    <div className="no-image">
                        <Package size={48} color="#ccc" />
                    </div>
                )}
                <div className="item-quantity-badge">
                    <Hash size={14} />
                    <span>{item.quantity_available}/{item.quantity_total}</span>
                </div>
            </div>
            <div className="item-content">
                <h3 className="item-name">{item.name}</h3>
                <p className="item-category">{categoryLabels[item.category]}</p>

                <div className="item-availability">
                    <div className={`item-status ${item.status}`}>
                        {item.quantity_available > 0 ? (
                            <>
                                <CheckCircle size={14} />
                                {item.quantity_available} disponibles
                            </>
                        ) : (
                            <>
                                <AlertCircle size={14} />
                                Agotado
                            </>
                        )}
                    </div>
                </div>

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

                <div className="item-actions">
                    <button
                        className="rent-btn"
                        onClick={() => openRentalModal(item)}
                        disabled={item.quantity_available === 0}
                    >
                        <Key size={14} />
                        Alquilar
                    </button>
                    <button
                        className="edit-btn"
                        onClick={() => openItemModal(item)}
                    >
                        <Edit2 size={14} />
                    </button>
                    <button
                        className="delete-btn"
                        onClick={() => handleDeleteItem(item.id)}
                    >
                        <Trash2 size={14} />
                    </button>
                </div>
            </div>
        </div>
    );

    // Componente de tarjeta de alquiler pendiente
    const PendingRentalCard = ({ rental }) => {
        const daysOverdue = parseInt(rental.days_overdue);
        const isOverdue = daysOverdue > 0;
        const balanceDue = parseFloat(rental.balance_due);

        return (
            <div className={`rental-card ${isOverdue ? 'overdue' : ''}`}>
                <div className="rental-header">
                    <h4>{rental.item_name}</h4>
                    {isOverdue && (
                        <span className="overdue-badge">
                            <AlertTriangle size={14} />
                            {daysOverdue} días vencido
                        </span>
                    )}
                </div>

                <div className="rental-customer">
                    <User size={14} />
                    <span>{rental.customer_name}</span>
                </div>

                {rental.customer_id_number && (
                    <div className="rental-info">
                        <CreditCard size={14} />
                        <span>CI: {rental.customer_id_number}</span>
                    </div>
                )}

                <div className="rental-info">
                    <Phone size={14} />
                    <span>{rental.customer_phone}</span>
                </div>

                <div className="rental-dates">
                    <div className="date-row">
                        <Calendar size={14} />
                        <span>Inicio: {new Date(rental.rental_start).toLocaleDateString()}</span>
                    </div>
                    <div className="date-row">
                        <Clock size={14} />
                        <span>Fin: {new Date(rental.rental_end).toLocaleDateString()}</span>
                    </div>
                </div>

                {rental.has_collateral && (
                    <div className="rental-collateral">
                        <Shield size={14} />
                        <span>Prenda: {rental.collateral_description || 'Sí'}</span>
                    </div>
                )}

                <div className="rental-financial">
                    <div className="financial-row">
                        <span>Total:</span>
                        <span className="amount">${parseFloat(rental.total_amount).toFixed(2)}</span>
                    </div>
                    <div className="financial-row">
                        <span>Pagado:</span>
                        <span className="amount paid">${parseFloat(rental.total_paid).toFixed(2)}</span>
                    </div>
                    <div className="financial-row">
                        <span>Saldo:</span>
                        <span className={`amount ${balanceDue > 0 ? 'pending' : 'completed'}`}>
                            ${balanceDue.toFixed(2)}
                        </span>
                    </div>
                </div>

                <div className="rental-actions">
                    <button
                        className="return-btn"
                        onClick={() => openReturnModal(rental)}
                    >
                        <RotateCcw size={14} />
                        Devolver
                    </button>
                    <button
                        className="payment-btn"
                        onClick={() => openPaymentModal(rental)}
                    >
                        <DollarSign size={14} />
                        Abonos
                    </button>
                </div>
            </div>
        );
    };

    return (
        <div className="rental-container">
            {/* Header */}
            <div className="rental-header">
                <h1>Gestión de Alquileres</h1>
                <div className="header-controls">
                    <div className="search-box">
                        <Search size={16} />
                        <input
                            type="text"
                            placeholder="Buscar artículos..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                        {searchTerm && (
                            <button onClick={() => setSearchTerm('')}>
                                <X size={16} />
                            </button>
                        )}
                    </div>

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
                            <option value="disponible">Disponible</option>
                            <option value="agotado">Agotado</option>
                        </select>
                    </div>

                    <div className="view-toggles">
                        <button
                            className={view === 'grid' ? 'active' : ''}
                            onClick={() => setView('grid')}
                        >
                            <Package size={16} />
                            Artículos
                        </button>
                        <button
                            className={view === 'pending' ? 'active' : ''}
                            onClick={() => setView('pending')}
                        >
                            <AlertCircle size={16} />
                            Pendientes
                        </button>
                    </div>

                    <button className="add-item-btn" onClick={() => openItemModal()}>
                        <Plus size={20} />
                        Nuevo Artículo
                    </button>
                </div>
            </div>

            {/* Estadísticas */}
            <div className="rental-stats">
                <div className="stat">
                    <Package size={20} />
                    <div>
                        <span className="stat-value">{stats.total_items || 0}</span>
                        <span className="stat-label">Total Artículos</span>
                    </div>
                </div>
                <div className="stat">
                    <CheckCircle size={20} />
                    <div>
                        <span className="stat-value">{stats.available_inventory || 0}</span>
                        <span className="stat-label">Disponibles</span>
                    </div>
                </div>
                <div className="stat">
                    <Key size={20} />
                    <div>
                        <span className="stat-value">{stats.active_rentals || 0}</span>
                        <span className="stat-label">Alquilados</span>
                    </div>
                </div>
                <div className="stat">
                    <AlertTriangle size={20} />
                    <div>
                        <span className="stat-value">{stats.overdue_rentals || 0}</span>
                        <span className="stat-label">Vencidos</span>
                    </div>
                </div>
            </div>

            {/* Contenido principal */}
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
                ) : view === 'pending' ? (
                    <div className="rentals-list">
                        {pendingReturns.length > 0 ? (
                            pendingReturns.map(rental => (
                                <PendingRentalCard key={rental.id} rental={rental} />
                            ))
                        ) : (
                            <div className="no-items">
                                <CheckCircle size={48} color="#10b981" />
                                <p>No hay alquileres pendientes de devolución</p>
                            </div>
                        )}
                    </div>
                ) : null}
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
                                <label>Cantidad Total</label>
                                <input
                                    type="number"
                                    min="1"
                                    value={itemForm.quantity_total}
                                    onChange={(e) => setItemForm({...itemForm, quantity_total: parseInt(e.target.value) || 1})}
                                />
                            </div>
                        </div>

                        <div className="form-row">
                            <div className="form-group">
                                <label>Precio por Día</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    value={itemForm.daily_rate}
                                    onChange={(e) => setItemForm({...itemForm, daily_rate: parseFloat(e.target.value) || 0})}
                                />
                            </div>
                            <div className="form-group">
                                <label>Precio por Semana</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    value={itemForm.weekly_rate}
                                    onChange={(e) => setItemForm({...itemForm, weekly_rate: parseFloat(e.target.value) || 0})}
                                />
                            </div>
                            <div className="form-group">
                                <label>Precio por Mes</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    value={itemForm.monthly_rate}
                                    onChange={(e) => setItemForm({...itemForm, monthly_rate: parseFloat(e.target.value) || 0})}
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
                    <div className="modal modal-large">
                        <h2>Nuevo Alquiler - {selectedItem.name}</h2>

                        <div className="form-section">
                            <h3>Datos del Cliente</h3>
                            <div className="form-row">
                                <div className="form-group">
                                    <label>Nombre del Cliente *</label>
                                    <input
                                        type="text"
                                        value={rentalForm.customer_name}
                                        onChange={(e) => setRentalForm({...rentalForm, customer_name: e.target.value})}
                                        required
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Cédula de Identidad *</label>
                                    <input
                                        type="text"
                                        value={rentalForm.customer_id_number}
                                        onChange={(e) => setRentalForm({...rentalForm, customer_id_number: e.target.value})}
                                        required
                                    />
                                </div>
                            </div>

                            <div className="form-group">
                                <label>Dirección de Domicilio *</label>
                                <input
                                    type="text"
                                    value={rentalForm.customer_address}
                                    onChange={(e) => setRentalForm({...rentalForm, customer_address: e.target.value})}
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
                        </div>

                        <div className="form-section">
                            <h3>Detalles del Alquiler</h3>
                            <div className="form-row">
                                <div className="form-group">
                                    <label>Fecha de Alquiler *</label>
                                    <input
                                        type="date"
                                        value={rentalForm.rental_start}
                                        onChange={(e) => setRentalForm({...rentalForm, rental_start: e.target.value})}
                                        required
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Fecha de Devolución *</label>
                                    <input
                                        type="date"
                                        value={rentalForm.rental_end}
                                        onChange={(e) => setRentalForm({...rentalForm, rental_end: e.target.value})}
                                        min={rentalForm.rental_start}
                                        required
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Cantidad (Máx: {selectedItem.quantity_available})</label>
                                    <input
                                        type="number"
                                        min="1"
                                        max={selectedItem.quantity_available}
                                        value={rentalForm.quantity_rented}
                                        onChange={(e) => setRentalForm({...rentalForm, quantity_rented: parseInt(e.target.value) || 1})}
                                    />
                                </div>
                            </div>

                            <div className="form-row">
                                <div className="form-group">
                                    <label>
                                        <input
                                            type="checkbox"
                                            checked={rentalForm.has_collateral}
                                            onChange={(e) => setRentalForm({...rentalForm, has_collateral: e.target.checked})}
                                        />
                                        {' '}Deja Prenda
                                    </label>
                                </div>
                                {rentalForm.has_collateral && (
                                    <div className="form-group">
                                        <label>Descripción de la Prenda</label>
                                        <input
                                            type="text"
                                            value={rentalForm.collateral_description}
                                            onChange={(e) => setRentalForm({...rentalForm, collateral_description: e.target.value})}
                                            placeholder="Ej: Documento de identidad, llaves, etc."
                                        />
                                    </div>
                                )}
                            </div>

                            <div className="form-row">
                                <div className="form-group">
                                    <label>Costo Total de Alquiler</label>
                                    <input
                                        type="text"
                                        value={`$${calculateRentalPrice().toFixed(2)}`}
                                        readOnly
                                        className="readonly-field"
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Depósito</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={rentalForm.deposit}
                                        onChange={(e) => setRentalForm({...rentalForm, deposit: parseFloat(e.target.value) || 0})}
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Abono Inicial</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={rentalForm.initial_payment}
                                        onChange={(e) => setRentalForm({...rentalForm, initial_payment: parseFloat(e.target.value) || 0})}
                                    />
                                </div>
                            </div>

                            <div className="form-group">
                                <label>Notas</label>
                                <textarea
                                    value={rentalForm.notes}
                                    onChange={(e) => setRentalForm({...rentalForm, notes: e.target.value})}
                                    rows="2"
                                    placeholder="Observaciones adicionales..."
                                />
                            </div>
                        </div>

                        <div className="modal-actions">
                            <button className="cancel-btn" onClick={closeRentalModal}>
                                Cancelar
                            </button>
                            <button className="save-btn" onClick={handleRentalSubmit}>
                                Registrar Alquiler
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal de Devolución */}
            {showReturnModal && selectedRental && (
                <div className="modal-overlay">
                    <div className="modal">
                        <h2>Procesar Devolución</h2>

                        <div className="return-info">
                            <p><strong>Artículo:</strong> {selectedRental.item_name}</p>
                            <p><strong>Cliente:</strong> {selectedRental.customer_name}</p>
                            <p><strong>Cantidad alquilada:</strong> {selectedRental.quantity_rented || 1}</p>
                        </div>

                        <div className="form-group">
                            <label>Fecha de Devolución</label>
                            <input
                                type="date"
                                value={returnForm.return_date}
                                onChange={(e) => setReturnForm({...returnForm, return_date: e.target.value})}
                            />
                        </div>

                        <div className="form-row">
                            <div className="form-group">
                                <label>Cantidad Devuelta</label>
                                <input
                                    type="number"
                                    min="1"
                                    max={selectedRental.quantity_rented || 1}
                                    value={returnForm.quantity_returned}
                                    onChange={(e) => setReturnForm({...returnForm, quantity_returned: parseInt(e.target.value) || 1})}
                                />
                            </div>
                            <div className="form-group">
                                <label>Estado del Artículo</label>
                                <select
                                    value={returnForm.condition_status}
                                    onChange={(e) => setReturnForm({...returnForm, condition_status: e.target.value})}
                                >
                                    <option value="bueno">Bueno</option>
                                    <option value="regular">Regular</option>
                                    <option value="dañado">Dañado</option>
                                </select>
                            </div>
                        </div>

                        {returnForm.condition_status === 'dañado' && (
                            <div className="form-group">
                                <label>Descripción del Daño</label>
                                <textarea
                                    value={returnForm.damage_notes}
                                    onChange={(e) => setReturnForm({...returnForm, damage_notes: e.target.value})}
                                    rows="2"
                                    placeholder="Describa los daños encontrados..."
                                />
                            </div>
                        )}

                        <div className="form-group">
                            <label>Pago Final (Saldo: ${parseFloat(selectedRental.balance_due).toFixed(2)})</label>
                            <input
                                type="number"
                                step="0.01"
                                value={returnForm.final_payment}
                                onChange={(e) => setReturnForm({...returnForm, final_payment: parseFloat(e.target.value) || 0})}
                            />
                        </div>

                        <div className="form-group">
                            <label>Notas de Devolución</label>
                            <textarea
                                value={returnForm.return_notes}
                                onChange={(e) => setReturnForm({...returnForm, return_notes: e.target.value})}
                                rows="2"
                                placeholder="Observaciones sobre la devolución..."
                            />
                        </div>

                        <div className="modal-actions">
                            <button className="cancel-btn" onClick={closeReturnModal}>
                                Cancelar
                            </button>
                            <button className="save-btn" onClick={handleReturnSubmit}>
                                Procesar Devolución
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal de Gestión de Abonos */}
            {showPaymentModal && selectedRental && (
                <div className="modal-overlay">
                    <div className="modal">
                        <h2>Gestión de Abonos</h2>

                        <div className="payment-info">
                            <p><strong>Cliente:</strong> {selectedRental.customer_name}</p>
                            <p><strong>Total:</strong> ${parseFloat(selectedRental.total_amount).toFixed(2)}</p>
                            <p><strong>Pagado:</strong> ${parseFloat(selectedRental.total_paid).toFixed(2)}</p>
                            <p><strong>Saldo:</strong> ${parseFloat(selectedRental.balance_due).toFixed(2)}</p>
                        </div>

                        {/* Lista de abonos existentes */}
                        {payments.length > 0 && (
                            <div className="payments-list">
                                <h3>Historial de Abonos</h3>
                                {payments.map(payment => (
                                    <div key={payment.id} className="payment-item">
                                        <div>
                                            <span className="payment-amount">${parseFloat(payment.amount).toFixed(2)}</span>
                                            <span className="payment-date">
                                                {new Date(payment.payment_date).toLocaleDateString()}
                                            </span>
                                            <span className="payment-method">{payment.payment_method}</span>
                                        </div>
                                        <div>
                                            {payment.notes && <span className="payment-notes">{payment.notes}</span>}
                                            <button
                                                className="delete-payment-btn"
                                                onClick={() => handleDeletePayment(payment.id)}
                                            >
                                                <X size={14} />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Agregar nuevo abono */}
                        <div className="new-payment-form">
                            <h3>Registrar Nuevo Abono</h3>
                            <div className="form-row">
                                <div className="form-group">
                                    <label>Monto</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={paymentForm.amount}
                                        onChange={(e) => setPaymentForm({...paymentForm, amount: e.target.value})}
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Fecha</label>
                                    <input
                                        type="date"
                                        value={paymentForm.payment_date}
                                        onChange={(e) => setPaymentForm({...paymentForm, payment_date: e.target.value})}
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Método</label>
                                    <select
                                        value={paymentForm.payment_method}
                                        onChange={(e) => setPaymentForm({...paymentForm, payment_method: e.target.value})}
                                    >
                                        <option value="efectivo">Efectivo</option>
                                        <option value="transferencia">Transferencia</option>
                                        <option value="tarjeta">Tarjeta</option>
                                        <option value="cheque">Cheque</option>
                                    </select>
                                </div>
                            </div>
                            <div className="form-group">
                                <label>Notas</label>
                                <input
                                    type="text"
                                    value={paymentForm.notes}
                                    onChange={(e) => setPaymentForm({...paymentForm, notes: e.target.value})}
                                    placeholder="Observaciones del pago..."
                                />
                            </div>
                            <button
                                className="add-payment-btn"
                                onClick={handlePaymentSubmit}
                                disabled={!paymentForm.amount || parseFloat(paymentForm.amount) <= 0}
                            >
                                <Plus size={16} />
                                Agregar Abono
                            </button>
                        </div>

                        <div className="modal-actions">
                            <button className="cancel-btn" onClick={closePaymentModal}>
                                Cerrar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default Rental;