// task-manager/frontend/src/Rental.jsx
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';
import {
    Plus, Edit2, Trash2, Calendar, DollarSign,
    Package, User, Clock, Search, Filter,
    X, AlertCircle, CheckCircle, ArrowRight,
    Key, Home, Phone, Mail, MapPin, CreditCard,
    FileText, Shield, RotateCcw, AlertTriangle,
    Eye, Archive, TrendingUp, Hash, Camera,
    ChevronLeft, ChevronRight, Download, RefreshCw
} from 'lucide-react';
import './Rental.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

// Configuración de categorías y estados
const CATEGORIES = {
    herramientas: { label: 'Herramientas', icon: '🔨' },
    construccion: { label: 'Construcción', icon: '🏗️' },
    jardineria: { label: 'Jardinería', icon: '🌱' },
    limpieza: { label: 'Limpieza', icon: '🧹' },
    eventos: { label: 'Eventos', icon: '🎉' },
    vehiculos: { label: 'Vehículos', icon: '🚗' },
    electronica: { label: 'Electrónica', icon: '📱' },
    deportes: { label: 'Deportes', icon: '⚽' },
    otros: { label: 'Otros', icon: '📦' }
};

const STATUS_CONFIG = {
    disponible: { label: 'Disponible', color: '#10b981', bgColor: '#d1fae5' },
    agotado: { label: 'Agotado', color: '#ef4444', bgColor: '#fee2e2' },
    alquilado: { label: 'Alquilado', color: '#f59e0b', bgColor: '#fef3c7' },
    mantenimiento: { label: 'Mantenimiento', color: '#6b7280', bgColor: '#f3f4f6' }
};

// Componente de Notificación
const Notification = ({ message, type = 'success', onClose }) => {
    useEffect(() => {
        const timer = setTimeout(onClose, 3000);
        return () => clearTimeout(timer);
    }, [onClose]);

    const colors = {
        success: '#10b981',
        error: '#ef4444',
        warning: '#f59e0b',
        info: '#3b82f6'
    };

    return (
        <div className="notification" style={{ background: colors[type] }}>
            <span>{message}</span>
            <button onClick={onClose} className="notification-close">
                <X size={16} />
            </button>
        </div>
    );
};

// Componente principal
function Rental({ updateTabData }) {
    // Estados principales
    const [items, setItems] = useState([]);
    const [rentals, setRentals] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [notification, setNotification] = useState(null);

    // Estados de vista y filtros
    const [currentView, setCurrentView] = useState('items');
    const [searchTerm, setSearchTerm] = useState('');
    const [filterCategory, setFilterCategory] = useState('all');
    const [filterStatus, setFilterStatus] = useState('all');
    const [sortBy, setSortBy] = useState('name');
    const [sortOrder, setSortOrder] = useState('asc');

    // Estados de modales
    const [modals, setModals] = useState({
        item: false,
        rental: false,
        return: false,
        payment: false,
        details: false
    });

    // Estados de formularios
    const [editingItem, setEditingItem] = useState(null);
    const [selectedItem, setSelectedItem] = useState(null);
    const [selectedRental, setSelectedRental] = useState(null);
    const [payments, setPayments] = useState([]);

    // Estado del formulario de artículo
    const [itemForm, setItemForm] = useState({
        name: '',
        description: '',
        category: 'herramientas',
        quantity: 1,
        rental_price: 0,
        image_url: ''
    });

    // Estado del formulario de alquiler
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
        has_collateral: false,
        collateral_description: '',
        total_amount: 0,
        initial_deposit: 0,
        notes: ''
    });

    // Estado del formulario de devolución
    const [returnForm, setReturnForm] = useState({
        condition: 'bueno',
        notes: '',
        final_payment: 0
    });

    // Estado del formulario de pago
    const [paymentForm, setPaymentForm] = useState({
        amount: 0,
        payment_method: 'efectivo',
        notes: ''
    });

    // Estadísticas computadas
    const stats = useMemo(() => {
        // Calcular totales de items
        const totalItems = items.length;
        const totalUnits = items.reduce((sum, item) => {
            return sum + (parseInt(item.quantity_total) || 0);
        }, 0);
        const availableUnits = items.reduce((sum, item) => {
            return sum + (parseInt(item.quantity_available) || 0);
        }, 0);

        // Calcular unidades alquiladas correctamente
        const rentedUnits = Math.max(0, totalUnits - availableUnits);

        // Calcular alquileres activos
        const activeRentals = rentals.filter(r => r.status === 'activo');
        const today = new Date();
        const overdueRentals = activeRentals.filter(r => {
            const endDate = new Date(r.rental_end);
            return endDate < today;
        });

        return {
            totalItems,
            totalUnits,
            availableUnits,
            rentedUnits, // Siempre será >= 0
            activeRentals: activeRentals.length,
            overdueRentals: overdueRentals.length
        };
    }, [items, rentals]);
    // Cargar datos iniciales
    useEffect(() => {
        loadInitialData();
    }, []);

    // Actualizar badge de pendientes
    useEffect(() => {
        if (updateTabData) {
            updateTabData({
                notification: stats.overdueRentals > 0 ? stats.overdueRentals : null
            });
        }
    }, [stats.overdueRentals, updateTabData]);

    // Funciones de carga de datos
    const loadInitialData = async () => {
        setLoading(true);
        try {
            await Promise.all([
                fetchItems(),
                fetchRentals()
            ]);
        } catch (error) {
            showNotification('Error al cargar datos', 'error');
        } finally {
            setLoading(false);
        }
    };

    const fetchItems = async () => {
        try {
            const response = await axios.get(`${API_URL}/rental-items/enhanced`);
            setItems(response.data);
        } catch (error) {
            console.error('Error fetching items:', error);
            setError('Error al cargar artículos');
        }
    };

    const fetchRentals = async () => {
        try {
            const response = await axios.get(`${API_URL}/rentals/enhanced`);
            setRentals(response.data);
        } catch (error) {
            console.error('Error fetching rentals:', error);
            setError('Error al cargar alquileres');
        }
    };

    const fetchPayments = async (rentalId) => {
        try {
            const response = await axios.get(`${API_URL}/rentals/${rentalId}/payments`);
            setPayments(response.data || []);
        } catch (error) {
            console.error('Error fetching payments:', error);
            setPayments([]);
        }
    };

    // Funciones de filtrado y ordenamiento
    const getFilteredItems = useCallback(() => {
        let filtered = [...items];

        // Búsqueda
        if (searchTerm) {
            const search = searchTerm.toLowerCase();
            filtered = filtered.filter(item =>
                item.name?.toLowerCase().includes(search) ||
                item.description?.toLowerCase().includes(search)
            );
        }

        // Filtro por categoría
        if (filterCategory !== 'all') {
            filtered = filtered.filter(item => item.category === filterCategory);
        }

        // Filtro por estado
        if (filterStatus !== 'all') {
            if (filterStatus === 'disponible') {
                filtered = filtered.filter(item => item.quantity_available > 0);
            } else if (filterStatus === 'agotado') {
                filtered = filtered.filter(item => item.quantity_available === 0);
            }
        }

        // Ordenamiento
        filtered.sort((a, b) => {
            let valueA = a[sortBy];
            let valueB = b[sortBy];

            if (typeof valueA === 'string') {
                valueA = valueA.toLowerCase();
                valueB = valueB?.toLowerCase() || '';
            }

            if (sortOrder === 'asc') {
                return valueA > valueB ? 1 : -1;
            } else {
                return valueA < valueB ? 1 : -1;
            }
        });

        return filtered;
    }, [items, searchTerm, filterCategory, filterStatus, sortBy, sortOrder]);

    const getActiveRentals = useCallback(() => {
        return rentals.filter(r => r.status === 'activo');
    }, [rentals]);

    const getPendingReturns = useCallback(() => {
        const today = new Date();
        return rentals.filter(r => {
            if (r.status !== 'activo') return false;
            const endDate = new Date(r.rental_end);
            return endDate <= today;
        });
    }, [rentals]);

    // Cálculo de precio de alquiler
    const calculateRentalPrice = useCallback(() => {
        if (!selectedItem || !rentalForm.rental_start || !rentalForm.rental_end) {
            return 0;
        }

        const start = new Date(rentalForm.rental_start);
        const end = new Date(rentalForm.rental_end);
        const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;

        const price = selectedItem.rental_price || selectedItem.daily_rate || 0;
        const quantity = rentalForm.quantity_rented || 1;

        return price * days * quantity;
    }, [selectedItem, rentalForm.rental_start, rentalForm.rental_end, rentalForm.quantity_rented]);

    // Actualizar precio automáticamente
    useEffect(() => {
        if (selectedItem) {
            const price = calculateRentalPrice();
            setRentalForm(prev => ({ ...prev, total_amount: price }));
        }
    }, [selectedItem, calculateRentalPrice]);

    // Manejadores de modales
    const openModal = (modalName, data = null) => {
        setModals(prev => ({ ...prev, [modalName]: true }));

        if (modalName === 'item' && data) {
            setEditingItem(data);
            setItemForm({
                name: data.name,
                description: data.description || '',
                category: data.category,
                quantity: data.quantity_total || 1,
                rental_price: data.daily_rate || 0,
                image_url: data.image_url || ''
            });
        } else if (modalName === 'rental' && data) {
            setSelectedItem(data);
            setRentalForm(prev => ({
                ...prev,
                item_id: data.id,
                quantity_rented: 1
            }));
        } else if (modalName === 'return' && data) {
            setSelectedRental(data);
        } else if (modalName === 'payment' && data) {
            setSelectedRental(data);
            fetchPayments(data.id);
        }
    };

    const closeModal = (modalName) => {
        setModals(prev => ({ ...prev, [modalName]: false }));

        if (modalName === 'item') {
            setEditingItem(null);
            setItemForm({
                name: '',
                description: '',
                category: 'herramientas',
                quantity: 1,
                rental_price: 0,
                image_url: ''
            });
        } else if (modalName === 'rental') {
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
                has_collateral: false,
                collateral_description: '',
                total_amount: 0,
                initial_deposit: 0,
                notes: ''
            });
        }
    };

    // Manejadores de formularios
    const handleItemSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);

        try {
            if (editingItem) {
                await axios.put(`${API_URL}/rental-items/${editingItem.id}`, {
                    ...itemForm,
                    daily_rate: itemForm.rental_price,
                    weekly_rate: itemForm.rental_price * 6,
                    monthly_rate: itemForm.rental_price * 25,
                    quantity_total: itemForm.quantity,
                    quantity_available: itemForm.quantity
                });
                showNotification('Artículo actualizado exitosamente');
            } else {
                await axios.post(`${API_URL}/rental-items`, {
                    ...itemForm,
                    daily_rate: itemForm.rental_price,
                    weekly_rate: itemForm.rental_price * 6,
                    monthly_rate: itemForm.rental_price * 25,
                    quantity: itemForm.quantity,
                    quantity_total: itemForm.quantity,
                    quantity_available: itemForm.quantity,
                    status: 'disponible'
                });
                showNotification('Artículo creado exitosamente');
            }

            await fetchItems();
            closeModal('item');
        } catch (error) {
            console.error('Error:', error);
            showNotification('Error al guardar el artículo', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleRentalSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);

        try {
            const rentalData = {
                ...rentalForm,
                initial_payment: rentalForm.initial_deposit
            };

            await axios.post(`${API_URL}/rentals/complete`, rentalData);

            showNotification('Alquiler creado exitosamente');
            await Promise.all([fetchItems(), fetchRentals()]);
            closeModal('rental');
        } catch (error) {
            console.error('Error:', error);
            showNotification('Error al crear alquiler', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleReturnSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);

        try {
            await axios.patch(`${API_URL}/rentals/${selectedRental.id}/return`, {
                condition_notes: returnForm.notes,
                return_condition: returnForm.condition
            });

            // Si hay pago final, registrarlo
            if (returnForm.final_payment > 0) {
                await axios.post(`${API_URL}/rentals/${selectedRental.id}/payments`, {
                    amount: returnForm.final_payment,
                    payment_method: 'efectivo',
                    notes: 'Pago al devolver'
                });
            }

            showNotification('Devolución registrada exitosamente');
            await Promise.all([fetchItems(), fetchRentals()]);
            closeModal('return');
        } catch (error) {
            console.error('Error:', error);
            showNotification('Error al registrar devolución', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handlePaymentSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);

        try {
            await axios.post(`${API_URL}/rentals/${selectedRental.id}/payments`, paymentForm);

            showNotification('Abono registrado exitosamente');
            await fetchPayments(selectedRental.id);
            setPaymentForm({ amount: 0, payment_method: 'efectivo', notes: '' });
        } catch (error) {
            console.error('Error:', error);
            showNotification('Error al registrar abono', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteItem = async (id) => {
        if (!window.confirm('¿Está seguro de eliminar este artículo?')) return;

        setLoading(true);
        try {
            await axios.delete(`${API_URL}/rental-items/${id}`);
            showNotification('Artículo eliminado exitosamente');
            await fetchItems();
        } catch (error) {
            console.error('Error:', error);
            showNotification('Error al eliminar artículo', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleDeletePayment = async (paymentId) => {
        if (!window.confirm('¿Está seguro de eliminar este abono?')) return;

        try {
            await axios.delete(`${API_URL}/rental-payments/${paymentId}`);
            showNotification('Abono eliminado');
            await fetchPayments(selectedRental.id);
        } catch (error) {
            showNotification('Error al eliminar abono', 'error');
        }
    };

    // Función para mostrar notificaciones
    const showNotification = (message, type = 'success') => {
        setNotification({ message, type });
    };

    // Función para formatear fecha
    const formatDate = (date) => {
        if (!date) return '';
        const options = { day: '2-digit', month: 'short', year: 'numeric' };
        return new Date(date).toLocaleDateString('es-ES', options);
    };

    // Función para calcular días vencidos
    const getDaysOverdue = (endDate) => {
        const today = new Date();
        const end = new Date(endDate);
        const diff = Math.floor((today - end) / (1000 * 60 * 60 * 24));
        return diff > 0 ? diff : 0;
    };

    // Renderizado del componente
    return (
        <div className="rental-container">
            {/* Notificaciones */}
            {notification && (
                <Notification
                    message={notification.message}
                    type={notification.type}
                    onClose={() => setNotification(null)}
                />
            )}

            {/* Header Principal */}
            <div className="rental-header">
                <div className="header-top">
                    <h1 className="header-title">Gestión de Alquileres</h1>
                    <div className="header-actions">
                        <button
                            className="btn btn-primary"
                            onClick={() => openModal('item')}
                        >
                            <Plus size={20} />
                            Nuevo Artículo
                        </button>
                        <button
                            className="btn btn-warning"
                            onClick={() => {
                                setSelectedItem(null);
                                openModal('rental');
                            }}
                        >
                            <Key size={20} />
                            Nuevo Alquiler
                        </button>
                        <button
                            className="btn btn-secondary"
                            onClick={loadInitialData}
                            disabled={loading}
                        >
                            <RefreshCw size={20} className={loading ? 'spinning' : ''} />
                        </button>
                    </div>
                </div>

                {/* Controles de búsqueda y filtros */}
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
                            <button
                                className="clear-search"
                                onClick={() => setSearchTerm('')}
                            >
                                <X size={16} />
                            </button>
                        )}
                    </div>

                    <select
                        className="filter-select"
                        value={filterCategory}
                        onChange={(e) => setFilterCategory(e.target.value)}
                    >
                        <option value="all">Todas las categorías</option>
                        {Object.entries(CATEGORIES).map(([key, cat]) => (
                            <option key={key} value={key}>
                                {cat.icon} {cat.label}
                            </option>
                        ))}
                    </select>

                    <select
                        className="filter-select"
                        value={filterStatus}
                        onChange={(e) => setFilterStatus(e.target.value)}
                    >
                        <option value="all">Todos los estados</option>
                        <option value="disponible">✅ Disponibles</option>
                        <option value="agotado">❌ Agotados</option>
                    </select>
                </div>

                {/* Tabs de navegación */}
                <div className="view-tabs">
                    <button
                        className={`tab-button ${currentView === 'items' ? 'active' : ''}`}
                        onClick={() => setCurrentView('items')}
                    >
                        <Package size={16} />
                        Artículos
                    </button>
                    <button
                        className={`tab-button ${currentView === 'rentals' ? 'active' : ''}`}
                        onClick={() => setCurrentView('rentals')}
                    >
                        <Key size={16} />
                        Alquilados
                        {stats.activeRentals > 0 && (
                            <span className="badge">{stats.activeRentals}</span>
                        )}
                    </button>
                    <button
                        className={`tab-button ${currentView === 'pending' ? 'active' : ''}`}
                        onClick={() => setCurrentView('pending')}
                    >
                        <AlertCircle size={16} />
                        Pendientes
                        {stats.overdueRentals > 0 && (
                            <span className="badge badge-danger">{stats.overdueRentals}</span>
                        )}
                    </button>
                </div>
            </div>

            {/* Estadísticas */}
            <div className="stats-grid">
                <div className="stat-card">
                    <div className="stat-icon yellow">
                        <Package size={24} />
                    </div>
                    <div className="stat-info">
                        <div className="stat-value">{stats.totalItems}</div>
                        <div className="stat-label">Total Artículos</div>
                    </div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon green">
                        <CheckCircle size={24} />
                    </div>
                    <div className="stat-info">
                        <div className="stat-value">{stats.availableUnits}</div>
                        <div className="stat-label">Disponibles</div>
                    </div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon blue">
                        <Key size={24} />
                    </div>
                    <div className="stat-info">
                        <div className="stat-value">{stats.rentedUnits}</div>
                        <div className="stat-label">Alquilados</div>
                    </div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon red">
                        <AlertTriangle size={24} />
                    </div>
                    <div className="stat-info">
                        <div className="stat-value">{stats.overdueRentals}</div>
                        <div className="stat-label">Vencidos</div>
                    </div>
                </div>
            </div>

            {/* Contenido Principal */}
            <div className="rental-content">
                {loading && (
                    <div className="loading-overlay">
                        <div className="spinner"></div>
                        <p>Cargando...</p>
                    </div>
                )}

                {/* Vista de Artículos */}
                {currentView === 'items' && (
                    <div className="items-grid">
                        {getFilteredItems().length > 0 ? (
                            getFilteredItems().map(item => (
                                <div key={item.id} className="item-card">
                                    <div className="item-image">
                                        {item.image_url ? (
                                            <img src={item.image_url} alt={item.name} />
                                        ) : (
                                            <div className="no-image">
                                                <Package size={48} />
                                            </div>
                                        )}
                                        <div className="item-quantity-badge">
                                            <Hash size={14} />
                                            {item.quantity_available || 0}/{item.quantity_total || 0}
                                        </div>
                                        <div className="item-category-badge">
                                            {CATEGORIES[item.category]?.icon}
                                        </div>
                                    </div>
                                    <div className="item-content">
                                        <h3 className="item-name">{item.name}</h3>
                                        <p className="item-description">{item.description}</p>

                                        <div className="item-price">
                                            <DollarSign size={16} />
                                            ${item.daily_rate || 0}/día
                                        </div>

                                        <div
                                            className="item-status"
                                            style={{
                                                background: item.quantity_available > 0
                                                    ? STATUS_CONFIG.disponible.bgColor
                                                    : STATUS_CONFIG.agotado.bgColor,
                                                color: item.quantity_available > 0
                                                    ? STATUS_CONFIG.disponible.color
                                                    : STATUS_CONFIG.agotado.color
                                            }}
                                        >
                                            {item.quantity_available > 0
                                                ? `${item.quantity_available} disponibles`
                                                : 'Agotado'}
                                        </div>

                                        <div className="item-actions">
                                            <button
                                                className="btn btn-rent"
                                                onClick={() => openModal('rental', item)}
                                                disabled={item.quantity_available === 0}
                                            >
                                                <Key size={14} />
                                                Alquilar
                                            </button>
                                            <button
                                                className="btn btn-edit"
                                                onClick={() => openModal('item', item)}
                                            >
                                                <Edit2 size={14} />
                                            </button>
                                            <button
                                                className="btn btn-delete"
                                                onClick={() => handleDeleteItem(item.id)}
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="empty-state">
                                <Package size={64} />
                                <h3>No se encontraron artículos</h3>
                                <p>Comienza agregando tu primer artículo</p>
                                <button
                                    className="btn btn-primary"
                                    onClick={() => openModal('item')}
                                >
                                    <Plus size={20} />
                                    Agregar Artículo
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {/* Vista de Alquilados */}
                {currentView === 'rentals' && (
                    <div className="rentals-list">
                        {getActiveRentals().length > 0 ? (
                            getActiveRentals().map(rental => (
                                <div key={rental.id} className="rental-card">
                                    <div className="rental-header">
                                        <div className="rental-customer">
                                            <User size={20} />
                                            <div>
                                                <h4>{rental.customer_name}</h4>
                                                <span className="customer-details">
                                                    {rental.customer_id_number} • {rental.customer_phone}
                                                </span>
                                            </div>
                                        </div>
                                        {rental.has_collateral && (
                                            <div className="collateral-badge">
                                                <Shield size={14} />
                                                Con Prenda
                                            </div>
                                        )}
                                    </div>

                                    <div className="rental-item-info">
                                        <Package size={16} />
                                        <span>{rental.item_name}</span>
                                        <span className="quantity">x{rental.quantity_rented}</span>
                                    </div>

                                    <div className="rental-dates">
                                        <div className="date-item">
                                            <Calendar size={14} />
                                            <div>
                                                <span className="date-label">Inicio</span>
                                                <span className="date-value">{formatDate(rental.rental_start)}</span>
                                            </div>
                                        </div>
                                        <ArrowRight size={16} />
                                        <div className="date-item">
                                            <Calendar size={14} />
                                            <div>
                                                <span className="date-label">Devolución</span>
                                                <span className="date-value">{formatDate(rental.rental_end)}</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="rental-payment-info">
                                        <div className="payment-stat">
                                            <span className="payment-label">Total</span>
                                            <span className="payment-value">${rental.total_amount}</span>
                                        </div>
                                        <div className="payment-stat">
                                            <span className="payment-label">Abonado</span>
                                            <span className="payment-value text-green">
                                                ${rental.total_paid || 0}
                                            </span>
                                        </div>
                                        <div className="payment-stat">
                                            <span className="payment-label">Saldo</span>
                                            <span className="payment-value text-orange">
                                                ${(rental.total_amount - (rental.total_paid || 0)).toFixed(2)}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="rental-actions">
                                        <button
                                            className="btn btn-success"
                                            onClick={() => openModal('return', rental)}
                                        >
                                            <RotateCcw size={14} />
                                            Devolver
                                        </button>
                                        <button
                                            className="btn btn-warning"
                                            onClick={() => openModal('payment', rental)}
                                        >
                                            <DollarSign size={14} />
                                            Abonos
                                        </button>
                                        <button
                                            className="btn btn-secondary"
                                            onClick={() => {
                                                setSelectedRental(rental);
                                                openModal('details');
                                            }}
                                        >
                                            <Eye size={14} />
                                            Detalles
                                        </button>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="empty-state">
                                <Key size={64} />
                                <h3>No hay artículos alquilados</h3>
                                <p>Los alquileres activos aparecerán aquí</p>
                            </div>
                        )}
                    </div>
                )}

                {/* Vista de Pendientes */}
                {currentView === 'pending' && (
                    <div className="rentals-list">
                        {getPendingReturns().length > 0 ? (
                            getPendingReturns().map(rental => {
                                const daysOverdue = getDaysOverdue(rental.rental_end);

                                return (
                                    <div key={rental.id} className="rental-card overdue">
                                        <div className="overdue-indicator">
                                            <AlertTriangle size={16} />
                                            {daysOverdue} días vencido
                                        </div>

                                        <div className="rental-header">
                                            <div className="rental-customer">
                                                <User size={20} />
                                                <div>
                                                    <h4>{rental.customer_name}</h4>
                                                    <span className="customer-details">
                                                        📱 {rental.customer_phone}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="rental-item-info">
                                            <Package size={16} />
                                            <span>{rental.item_name}</span>
                                        </div>

                                        <div className="overdue-info">
                                            <div className="info-item">
                                                <span className="info-label">Debió devolver:</span>
                                                <span className="info-value">{formatDate(rental.rental_end)}</span>
                                            </div>
                                            <div className="info-item">
                                                <span className="info-label">Saldo pendiente:</span>
                                                <span className="info-value text-orange">
                                                    ${(rental.total_amount - (rental.total_paid || 0)).toFixed(2)}
                                                </span>
                                            </div>
                                        </div>

                                        <div className="rental-actions">
                                            <button
                                                className="btn btn-success"
                                                onClick={() => openModal('return', rental)}
                                            >
                                                <RotateCcw size={14} />
                                                Registrar Devolución
                                            </button>
                                            <button
                                                className="btn btn-primary"
                                                onClick={() => window.location.href = `tel:${rental.customer_phone}`}
                                            >
                                                <Phone size={14} />
                                                Contactar
                                            </button>
                                        </div>
                                    </div>
                                );
                            })
                        ) : (
                            <div className="empty-state">
                                <CheckCircle size={64} color="#10b981" />
                                <h3>No hay devoluciones pendientes</h3>
                                <p>¡Todos los alquileres están al día!</p>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Modal de Artículo */}
            {modals.item && (
                <div className="modal-overlay" onClick={() => closeModal('item')}>
                    <div className="modal-content" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>{editingItem ? 'Editar Artículo' : 'Nuevo Artículo'}</h2>
                            <button className="close-btn" onClick={() => closeModal('item')}>
                                <X size={24} />
                            </button>
                        </div>

                        <form onSubmit={handleItemSubmit}>
                            <div className="form-group">
                                <label>Nombre del artículo *</label>
                                <input
                                    type="text"
                                    className="form-control"
                                    value={itemForm.name}
                                    onChange={(e) => setItemForm({...itemForm, name: e.target.value})}
                                    required
                                />
                            </div>

                            <div className="form-row">
                                <div className="form-group">
                                    <label>Categoría</label>
                                    <select
                                        className="form-control"
                                        value={itemForm.category}
                                        onChange={(e) => setItemForm({...itemForm, category: e.target.value})}
                                    >
                                        {Object.entries(CATEGORIES).map(([key, cat]) => (
                                            <option key={key} value={key}>
                                                {cat.icon} {cat.label}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div className="form-group">
                                    <label>Cantidad</label>
                                    <input
                                        type="number"
                                        className="form-control"
                                        value={itemForm.quantity}
                                        onChange={(e) => setItemForm({...itemForm, quantity: parseInt(e.target.value)})}
                                        min="1"
                                        required
                                    />
                                </div>
                            </div>

                            <div className="form-group">
                                <label>Precio de alquiler (por día)</label>
                                <input
                                    type="number"
                                    className="form-control"
                                    value={itemForm.rental_price}
                                    onChange={(e) => setItemForm({...itemForm, rental_price: parseFloat(e.target.value)})}
                                    step="0.01"
                                    min="0"
                                    required
                                />
                            </div>

                            <div className="form-group">
                                <label>Descripción</label>
                                <textarea
                                    className="form-control"
                                    value={itemForm.description}
                                    onChange={(e) => setItemForm({...itemForm, description: e.target.value})}
                                    rows="3"
                                />
                            </div>

                            <div className="form-group">
                                <label>URL de imagen (PNG)</label>
                                <input
                                    type="url"
                                    className="form-control"
                                    value={itemForm.image_url}
                                    onChange={(e) => setItemForm({...itemForm, image_url: e.target.value})}
                                    placeholder="https://ejemplo.com/imagen.png"
                                />
                            </div>

                            <div className="form-actions">
                                <button
                                    type="button"
                                    className="btn btn-secondary"
                                    onClick={() => closeModal('item')}
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    className="btn btn-primary"
                                    disabled={loading}
                                >
                                    {loading ? 'Guardando...' : 'Guardar'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal de Alquiler */}
            {modals.rental && (
                <div className="modal-overlay" onClick={() => closeModal('rental')}>
                    <div className="modal-content large" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>Nuevo Alquiler</h2>
                            <button className="close-btn" onClick={() => closeModal('rental')}>
                                <X size={24} />
                            </button>
                        </div>

                        <form onSubmit={handleRentalSubmit}>
                            <div className="form-group">
                                <label>Artículo a alquilar *</label>
                                <select
                                    className="form-control"
                                    value={rentalForm.item_id}
                                    onChange={(e) => {
                                        const item = items.find(i => i.id === parseInt(e.target.value));
                                        setSelectedItem(item);
                                        setRentalForm({...rentalForm, item_id: e.target.value});
                                    }}
                                    required
                                >
                                    <option value="">Seleccione un artículo...</option>
                                    {items.filter(item => item.quantity_available > 0).map(item => (
                                        <option key={item.id} value={item.id}>
                                            {item.name} ({item.quantity_available} disponibles)
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="form-section">
                                <h3>Información del Cliente</h3>

                                <div className="form-group">
                                    <label>Nombre completo *</label>
                                    <input
                                        type="text"
                                        className="form-control"
                                        value={rentalForm.customer_name}
                                        onChange={(e) => setRentalForm({...rentalForm, customer_name: e.target.value})}
                                        required
                                    />
                                </div>

                                <div className="form-row">
                                    <div className="form-group">
                                        <label>Cédula de identidad *</label>
                                        <input
                                            type="text"
                                            className="form-control"
                                            value={rentalForm.customer_id_number}
                                            onChange={(e) => setRentalForm({...rentalForm, customer_id_number: e.target.value})}
                                            required
                                        />
                                    </div>

                                    <div className="form-group">
                                        <label>Teléfono *</label>
                                        <input
                                            type="tel"
                                            className="form-control"
                                            value={rentalForm.customer_phone}
                                            onChange={(e) => setRentalForm({...rentalForm, customer_phone: e.target.value})}
                                            required
                                        />
                                    </div>
                                </div>

                                <div className="form-group">
                                    <label>Dirección de domicilio</label>
                                    <input
                                        type="text"
                                        className="form-control"
                                        value={rentalForm.customer_address}
                                        onChange={(e) => setRentalForm({...rentalForm, customer_address: e.target.value})}
                                    />
                                </div>

                                <div className="form-group">
                                    <label>Email</label>
                                    <input
                                        type="email"
                                        className="form-control"
                                        value={rentalForm.customer_email}
                                        onChange={(e) => setRentalForm({...rentalForm, customer_email: e.target.value})}
                                    />
                                </div>
                            </div>

                            <div className="form-section">
                                <h3>Detalles del Alquiler</h3>

                                <div className="form-row">
                                    <div className="form-group">
                                        <label>Fecha de alquiler *</label>
                                        <input
                                            type="date"
                                            className="form-control"
                                            value={rentalForm.rental_start}
                                            onChange={(e) => setRentalForm({...rentalForm, rental_start: e.target.value})}
                                            required
                                        />
                                    </div>

                                    <div className="form-group">
                                        <label>Fecha de devolución *</label>
                                        <input
                                            type="date"
                                            className="form-control"
                                            value={rentalForm.rental_end}
                                            onChange={(e) => setRentalForm({...rentalForm, rental_end: e.target.value})}
                                            min={rentalForm.rental_start}
                                            required
                                        />
                                    </div>
                                </div>

                                <div className="form-row">
                                    <div className="form-group">
                                        <label>Cantidad</label>
                                        <input
                                            type="number"
                                            className="form-control"
                                            value={rentalForm.quantity_rented}
                                            onChange={(e) => setRentalForm({...rentalForm, quantity_rented: parseInt(e.target.value)})}
                                            min="1"
                                            max={selectedItem?.quantity_available || 1}
                                            required
                                        />
                                    </div>

                                    <div className="form-group">
                                        <label>Costo total</label>
                                        <input
                                            type="number"
                                            className="form-control"
                                            value={rentalForm.total_amount}
                                            onChange={(e) => setRentalForm({...rentalForm, total_amount: parseFloat(e.target.value)})}
                                            step="0.01"
                                            min="0"
                                            required
                                        />
                                    </div>
                                </div>

                                <div className="form-group">
                                    <div className="checkbox-group">
                                        <input
                                            type="checkbox"
                                            id="has_collateral"
                                            checked={rentalForm.has_collateral}
                                            onChange={(e) => setRentalForm({...rentalForm, has_collateral: e.target.checked})}
                                        />
                                        <label htmlFor="has_collateral">¿Dejó prenda?</label>
                                    </div>
                                    {rentalForm.has_collateral && (
                                        <input
                                            type="text"
                                            className="form-control mt-2"
                                            placeholder="Descripción de la prenda"
                                            value={rentalForm.collateral_description}
                                            onChange={(e) => setRentalForm({...rentalForm, collateral_description: e.target.value})}
                                        />
                                    )}
                                </div>

                                <div className="form-group">
                                    <label>Depósito inicial</label>
                                    <input
                                        type="number"
                                        className="form-control"
                                        value={rentalForm.initial_deposit}
                                        onChange={(e) => setRentalForm({...rentalForm, initial_deposit: parseFloat(e.target.value)})}
                                        step="0.01"
                                        min="0"
                                    />
                                </div>

                                <div className="form-group">
                                    <label>Notas adicionales</label>
                                    <textarea
                                        className="form-control"
                                        value={rentalForm.notes}
                                        onChange={(e) => setRentalForm({...rentalForm, notes: e.target.value})}
                                        rows="3"
                                    />
                                </div>
                            </div>

                            <div className="form-actions">
                                <button
                                    type="button"
                                    className="btn btn-secondary"
                                    onClick={() => closeModal('rental')}
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    className="btn btn-primary"
                                    disabled={loading}
                                >
                                    {loading ? 'Creando...' : 'Crear Alquiler'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal de Devolución */}
            {modals.return && selectedRental && (
                <div className="modal-overlay" onClick={() => closeModal('return')}>
                    <div className="modal-content" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>Registrar Devolución</h2>
                            <button className="close-btn" onClick={() => closeModal('return')}>
                                <X size={24} />
                            </button>
                        </div>

                        <form onSubmit={handleReturnSubmit}>
                            <div className="rental-summary">
                                <h3>{selectedRental.item_name}</h3>
                                <p>Cliente: {selectedRental.customer_name}</p>
                                <p>Período: {formatDate(selectedRental.rental_start)} - {formatDate(selectedRental.rental_end)}</p>
                            </div>

                            <div className="form-group">
                                <label>Estado del artículo</label>
                                <select
                                    className="form-control"
                                    value={returnForm.condition}
                                    onChange={(e) => setReturnForm({...returnForm, condition: e.target.value})}
                                >
                                    <option value="bueno">Bueno</option>
                                    <option value="regular">Regular</option>
                                    <option value="dañado">Dañado</option>
                                </select>
                            </div>

                            <div className="form-group">
                                <label>Notas sobre el estado</label>
                                <textarea
                                    className="form-control"
                                    value={returnForm.notes}
                                    onChange={(e) => setReturnForm({...returnForm, notes: e.target.value})}
                                    rows="3"
                                />
                            </div>

                            <div className="payment-summary">
                                <div className="summary-item">
                                    <span>Total del alquiler:</span>
                                    <span className="amount">${selectedRental.total_amount}</span>
                                </div>
                                <div className="summary-item">
                                    <span>Abonado:</span>
                                    <span className="amount text-green">${selectedRental.total_paid || 0}</span>
                                </div>
                                <div className="summary-item total">
                                    <span>Saldo pendiente:</span>
                                    <span className="amount text-orange">
                                        ${(selectedRental.total_amount - (selectedRental.total_paid || 0)).toFixed(2)}
                                    </span>
                                </div>
                            </div>

                            {(selectedRental.total_amount - (selectedRental.total_paid || 0)) > 0 && (
                                <div className="form-group">
                                    <label>Pago final</label>
                                    <input
                                        type="number"
                                        className="form-control"
                                        value={returnForm.final_payment}
                                        onChange={(e) => setReturnForm({...returnForm, final_payment: parseFloat(e.target.value)})}
                                        step="0.01"
                                        min="0"
                                        max={selectedRental.total_amount - (selectedRental.total_paid || 0)}
                                    />
                                </div>
                            )}

                            <div className="form-actions">
                                <button
                                    type="button"
                                    className="btn btn-secondary"
                                    onClick={() => closeModal('return')}
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    className="btn btn-primary"
                                    disabled={loading}
                                >
                                    {loading ? 'Procesando...' : 'Confirmar Devolución'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal de Pagos */}
            {modals.payment && selectedRental && (
                <div className="modal-overlay" onClick={() => closeModal('payment')}>
                    <div className="modal-content" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>Gestión de Abonos</h2>
                            <button className="close-btn" onClick={() => closeModal('payment')}>
                                <X size={24} />
                            </button>
                        </div>

                        <div className="rental-summary">
                            <h3>{selectedRental.item_name}</h3>
                            <p>Cliente: {selectedRental.customer_name}</p>
                        </div>

                        <form onSubmit={handlePaymentSubmit}>
                            <h3>Registrar nuevo abono</h3>
                            <div className="form-row">
                                <div className="form-group">
                                    <label>Monto</label>
                                    <input
                                        type="number"
                                        className="form-control"
                                        value={paymentForm.amount}
                                        onChange={(e) => setPaymentForm({...paymentForm, amount: parseFloat(e.target.value)})}
                                        step="0.01"
                                        min="0.01"
                                        required
                                    />
                                </div>

                                <div className="form-group">
                                    <label>Método de pago</label>
                                    <select
                                        className="form-control"
                                        value={paymentForm.payment_method}
                                        onChange={(e) => setPaymentForm({...paymentForm, payment_method: e.target.value})}
                                    >
                                        <option value="efectivo">Efectivo</option>
                                        <option value="transferencia">Transferencia</option>
                                        <option value="tarjeta">Tarjeta</option>
                                    </select>
                                </div>
                            </div>

                            <button type="submit" className="btn btn-primary" disabled={loading}>
                                {loading ? 'Registrando...' : 'Agregar Abono'}
                            </button>
                        </form>

                        <div className="payments-history">
                            <h3>Historial de abonos</h3>
                            {payments.length > 0 ? (
                                <div className="payments-list">
                                    {payments.map(payment => (
                                        <div key={payment.id} className="payment-item">
                                            <div>
                                                <div className="payment-date">{formatDate(payment.payment_date)}</div>
                                                <div className="payment-method">{payment.payment_method}</div>
                                            </div>
                                            <div className="payment-amount">
                                                ${payment.amount}
                                                <button
                                                    className="btn-icon"
                                                    onClick={() => handleDeletePayment(payment.id)}
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="no-payments">No hay abonos registrados</p>
                            )}

                            <div className="payment-summary">
                                <div className="summary-item">
                                    <span>Total:</span>
                                    <span className="amount">${selectedRental.total_amount}</span>
                                </div>
                                <div className="summary-item">
                                    <span>Abonado:</span>
                                    <span className="amount text-green">
                                        ${payments.reduce((sum, p) => sum + p.amount, 0).toFixed(2)}
                                    </span>
                                </div>
                                <div className="summary-item total">
                                    <span>Saldo:</span>
                                    <span className="amount text-orange">
                                        ${(selectedRental.total_amount - payments.reduce((sum, p) => sum + p.amount, 0)).toFixed(2)}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default Rental;