// task-manager/frontend/src/Rental.jsx
import { API_URL } from './config/api';
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



// Configuración de categorías y estados
const CATEGORIES = {
    herramientas: { label: 'Mesas'},
    construccion: { label: 'Números'},
    jardineria: { label: 'Sillas' },
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
        notes: '',
        items: [{ item_id: '', quantity_rented: 1 }]
    });

    const addItem = () => {
        setRentalForm(f => ({
            ...f,
            items: [...f.items, { item_id: '', quantity_rented: 1 }]
        }));
    };

    const updateItem = (index, field, value) => {
        const items = [...rentalForm.items];
        items[index][field] = value;
        setRentalForm({ ...rentalForm, items });
    };

    const removeItem = (index) => {
        setRentalForm(f => ({
            ...f,
            items: f.items.filter((_, i) => i !== index)
        }));
    };


    const handleSubmit = async () => {
        try {
            await axios.post(`${API_URL}/rentals/enhanced`, rentalForm);
            alert("✅ Alquiler creado correctamente");
            // Reset
            setRentalForm({
                customer_name: '',
                customer_id_number: '',
                customer_address: '',
                customer_phone: '',
                customer_email: '',
                rental_start: '',
                rental_end: '',
                deposit: 0,
                has_collateral: false,
                collateral_description: '',
                notes: '',
                items: [{ item_id: '', quantity_rented: 1 }]
            });
        } catch (error) {
            console.error(error);
            alert("❌ Error al crear alquiler");
        }
    };


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
    // Estados de subida de imagen
    const [imageFile, setImageFile] = useState(null);
    const [imagePreview, setImagePreview] = useState('');
    const [uploadingImage, setUploadingImage] = useState(false);
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
    }, [stats.overdueRentals]);

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
        if (!rentalId) {
            console.error('No rental ID provided');
            setPayments([]); // Establecer array vacío si no hay ID
            return;
        }

        try {
            const response = await axios.get(`${API_URL}/rentals/${rentalId}/payments`);
            // Asegurar que siempre sea un array
            setPayments(Array.isArray(response.data) ? response.data : []);
        } catch (error) {
            console.error('Error fetching payments:', error);
            setPayments([]); // En caso de error, establecer array vacío
            showNotification('Error al cargar los abonos', 'error');
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

    // Función para subir la imagen al servidor
    const handleImageUpload = async (file) => {
        if (!file) return;

        // Validar que sea PNG
        if (!file.type.includes('png')) {
            showNotification('Solo se permiten imágenes PNG', 'error');
            return;
        }

        // Validar tamaño (máximo 2MB)
        if (file.size > 2 * 1024 * 1024) {
            showNotification('La imagen no debe superar 2MB', 'error');
            return;
        }

        setUploadingImage(true);

        try {
            const formData = new FormData();
            formData.append('image', file);

            const response = await axios.post(
                `${API_URL.replace('/api', '')}/api/upload/image`,
                formData,
                {
                    headers: {
                        'Content-Type': 'multipart/form-data'
                    }
                }
            );

            const imageUrl = response.data.url;
            setItemForm({ ...itemForm, image_url: imageUrl });
            setImagePreview(imageUrl);
            showNotification('Imagen subida exitosamente', 'success');
        } catch (error) {
            console.error('Error al subir imagen:', error);
            showNotification('Error al subir la imagen', 'error');
        } finally {
            setUploadingImage(false);
        }
    };

// Función para eliminar la imagen
    const handleRemoveImage = () => {
        setImageFile(null);
        setImagePreview('');
        setItemForm({ ...itemForm, image_url: '' });
    };

    // Manejadores de modales
    const openModal = (modalName, data = null) => {
        setModals(prev => ({ ...prev, [modalName]: true }));

        if (modalName === 'item') {
            if (data) {
                setEditingItem(data);
                setItemForm({
                    name: data.name || '',
                    description: data.description || '',
                    category: data.category || 'herramientas',
                    quantity: data.quantity_total || 1,
                    rental_price: data.daily_rate || 0,
                    image_url: data.image_url || ''
                });
                // Establecer preview si hay imagen existente
                setImagePreview(data.image_url || '');
            } else {
                setEditingItem(null);
                setItemForm({
                    name: '',
                    description: '',
                    category: 'herramientas',
                    quantity: 1,
                    rental_price: 0,
                    image_url: ''
                });
                setImagePreview('');
                setImageFile(null);
            }


        } else if (modalName === 'rental' && data) {
            setSelectedItem(data);
            setRentalForm(prev => ({
                ...prev,
                items: [{ item_id: data.id, quantity_rented: 1 }]
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
            setImagePreview('');
            setImageFile(null);
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
            // Preparar los datos con la estructura correcta que espera el backend
            const itemData = {
                name: itemForm.name,
                description: itemForm.description || '',
                category: itemForm.category,
                daily_rate: parseFloat(itemForm.rental_price) || 0,
                weekly_rate: (parseFloat(itemForm.rental_price) || 0) * 6,
                monthly_rate: (parseFloat(itemForm.rental_price) || 0) * 25,
                quantity_total: parseInt(itemForm.quantity) || 1,
                quantity_available: parseInt(itemForm.quantity) || 1,
                status: 'disponible',
                image_url: itemForm.image_url || ''
            };

            if (editingItem) {
                // Al editar, mantener la cantidad disponible actual
                const currentItem = items.find(item => item.id === editingItem.id);
                if (currentItem) {
                    // Calcular la diferencia para mantener la proporción correcta
                    const rentedQuantity = currentItem.quantity_total - currentItem.quantity_available;
                    itemData.quantity_available = Math.max(0, itemData.quantity_total - rentedQuantity);
                }

                await axios.put(`${API_URL}/rental-items/${editingItem.id}`, itemData);
                showNotification('Artículo actualizado exitosamente');
            } else {
                // Crear nuevo artículo
                await axios.post(`${API_URL}/rental-items`, itemData);
                showNotification('Artículo creado exitosamente');
            }

            await fetchItems();
            closeModal('item');
        } catch (error) {
            console.error('Error:', error);
            const errorMessage = error.response?.data?.error || 'Error al guardar el artículo';
            showNotification(errorMessage, 'error');
        } finally {
            setLoading(false);
        }
    };

    // Busca la función handleRentalSubmit en tu Rental.jsx y reemplázala con esta versión corregida:

    const handleRentalSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);

        try {
            // Validar artículos (que haya al menos 1 y que cada uno tenga item_id y cantidad > 0)
            if (
                !rentalForm.items ||
                rentalForm.items.length === 0 ||
                rentalForm.items.some(it => !it.item_id || it.quantity_rented <= 0)
            ) {
                showNotification('Seleccione al menos un artículo válido y cantidad mayor a cero', 'error');
                setLoading(false);
                return;
            }

            // Validar datos de cliente y fechas
            if (!rentalForm.customer_name.trim() || !rentalForm.customer_id_number.trim() || !rentalForm.customer_phone.trim()) {
                showNotification('Complete los datos obligatorios del cliente', 'error');
                setLoading(false);
                return;
            }
            if (!rentalForm.rental_start || !rentalForm.rental_end) {
                showNotification('Seleccione las fechas de inicio y fin del alquiler', 'error');
                setLoading(false);
                return;
            }
            if (new Date(rentalForm.rental_end) <= new Date(rentalForm.rental_start)) {
                showNotification('La fecha de devolución debe ser posterior a la fecha de alquiler', 'error');
                setLoading(false);
                return;
            }

            // Preparar payload para enviar al backend
            const payload = {
                items: rentalForm.items.map(it => ({
                    item_id: Number(it.item_id),
                    quantity_rented: Number(it.quantity_rented)
                })),
                customer_name: rentalForm.customer_name.trim(),
                customer_id_number: rentalForm.customer_id_number.trim(),
                customer_phone: rentalForm.customer_phone.trim(),
                customer_address: rentalForm.customer_address?.trim() || '',
                customer_email: rentalForm.customer_email?.trim() || '',
                rental_start: rentalForm.rental_start,
                rental_end: rentalForm.rental_end,
                deposit: Number(rentalForm.deposit) || 0,
                has_collateral: rentalForm.has_collateral,
                collateral_description: rentalForm.collateral_description || '',
                notes: rentalForm.notes || ''
            };

            // Enviar a la ruta múltiple
            const response = await axios.post(`${API_URL}/rentals/enhanced`, payload);

            // Éxito
            showNotification('Alquiler creado exitosamente', 'success');
            await fetchItems();
            await fetchRentals();

            // Reset del formulario
            setRentalForm({
                customer_name: '',
                customer_id_number: '',
                customer_address: '',
                customer_phone: '',
                customer_email: '',
                rental_start: new Date().toISOString().split('T')[0],
                rental_end: '',
                deposit: 0,
                has_collateral: false,
                collateral_description: '',
                notes: '',
                items: [{ item_id: '', quantity_rented: 1 }]
            });
            closeModal('rental');

        } catch (error) {
            console.error('Error al crear alquiler:', error);
            const message =
                error.response?.data?.error ||
                error.response?.data?.message ||
                'Error al crear alquiler múltiple';
            showNotification(message, 'error');
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

        if (!selectedRental || !selectedRental.id) {
            showNotification('Error: No se ha seleccionado un alquiler', 'error');
            return;
        }

        setLoading(true);

        try {
            const response = await axios.post(
                `${API_URL}/rentals/${selectedRental.id}/payments`,
                paymentForm
            );

            showNotification('Abono registrado exitosamente', 'success');

            // Recargar los pagos
            await fetchPayments(selectedRental.id);

            // Limpiar el formulario
            setPaymentForm({
                amount: 0,
                payment_method: 'efectivo',
                notes: ''
            });

            // Actualizar la lista de alquileres
            await fetchRentals();

        } catch (error) {
            console.error('Error:', error);
            const errorMessage = error.response?.data?.error || 'Error al registrar abono';
            showNotification(errorMessage, 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteItem = async (id) => {
        // Buscar el artículo para mostrar su nombre en la confirmación
        const item = items.find(i => i.id === id);
        const itemName = item ? item.name : 'este artículo';

        if (!window.confirm(`¿Está seguro de eliminar "${itemName}"?\n\nEsta acción no se puede deshacer.`)) {
            return;
        }

        setLoading(true);

        try {
            const response = await axios.delete(`${API_URL}/rental-items/${id}`);

            // Mostrar mensaje de éxito con detalles si están disponibles
            if (response.data && response.data.stats) {
                const { payments_deleted, rentals_deleted } = response.data.stats;
                let message = 'Artículo eliminado exitosamente';

                if (rentals_deleted > 0 || payments_deleted > 0) {
                    message += `. Se eliminaron ${rentals_deleted} alquiler(es) histórico(s) y ${payments_deleted} pago(s) asociado(s).`;
                }

                showNotification(message, 'success');
            } else {
                showNotification('Artículo eliminado exitosamente', 'success');
            }

            // Recargar la lista de artículos
            await fetchItems();

        } catch (error) {
            console.error('Error al eliminar:', error);

            // Manejar diferentes tipos de errores
            let errorMessage = 'Error al eliminar el artículo';

            if (error.response) {
                if (error.response.status === 400) {
                    // Error de validación (artículo tiene alquileres activos)
                    errorMessage = error.response.data.error || 'No se puede eliminar: El artículo está en uso';
                } else if (error.response.status === 404) {
                    errorMessage = 'El artículo no fue encontrado';
                } else if (error.response.status === 500) {
                    // Error del servidor
                    errorMessage = error.response.data.error || 'Error interno del servidor';

                    // Si hay detalles adicionales en desarrollo
                    if (error.response.data.details) {
                        console.error('Detalles del error:', error.response.data.details);
                    }
                }
            } else if (error.request) {
                errorMessage = 'No se pudo conectar con el servidor';
            }

            // Mostrar notificación de error
            showNotification(errorMessage, 'error');

            // Si el error indica que hay alquileres activos, ofrecer más información
            if (errorMessage.includes('alquiler') && errorMessage.includes('activo')) {
                // Opcionalmente, mostrar una lista de los alquileres activos
                const activeRentalsForItem = rentals.filter(
                    r => r.item_id === id && r.status === 'activo'
                );

                if (activeRentalsForItem.length > 0) {
                    console.log('Alquileres activos que impiden la eliminación:');
                    activeRentalsForItem.forEach(rental => {
                        console.log(`- Cliente: ${rental.customer_name}, Fecha fin: ${formatDate(rental.rental_end)}`);
                    });
                }
            }
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
                                <label>Imagen del artículo (PNG)</label>

                                {/* Preview de la imagen */}
                                {(imagePreview || itemForm.image_url) && (
                                    <div className="image-preview-container">
                                        <img
                                            src={imagePreview || itemForm.image_url}
                                            alt="Preview"
                                            className="image-preview"
                                        />
                                        <button
                                            type="button"
                                            className="remove-image-btn"
                                            onClick={handleRemoveImage}
                                            title="Eliminar imagen"
                                        >
                                            <X size={20} />
                                        </button>
                                    </div>
                                )}

                                {/* Input de archivo oculto */}
                                <input
                                    type="file"
                                    id="image-upload"
                                    accept="image/png"
                                    onChange={(e) => {
                                        const file = e.target.files[0];
                                        if (file) {
                                            setImageFile(file);
                                            handleImageUpload(file);
                                        }
                                    }}
                                    style={{ display: 'none' }}
                                />

                                {/* Botón personalizado para subir imagen */}
                                <label
                                    htmlFor="image-upload"
                                    className={`upload-image-btn ${uploadingImage ? 'uploading' : ''}`}
                                >
                                    {uploadingImage ? (
                                        <>
                                            <div className="spinner-small"></div>
                                            <span>Subiendo...</span>
                                        </>
                                    ) : (
                                        <>
                                            <Camera size={20} />
                                            <span>
                    {imagePreview || itemForm.image_url
                        ? 'Cambiar imagen'
                        : 'Subir imagen PNG'}
                </span>
                                        </>
                                    )}
                                </label>

                                <small className="form-help">
                                    Solo archivos PNG. Tamaño máximo: 2MB
                                </small>
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
                            {/* Bloque dinámico de artículos */}
                            <div className="form-group">
                                <h3>Artículos a alquilar</h3>
                                {rentalForm.items?.map((it, idx) => (
                                    <div key={idx} className="item-row">
                                        {/* Selector de artículo */}
                                        <select
                                            value={it.item_id || ''}
                                            onChange={(e) => updateItem(idx, 'item_id', parseInt(e.target.value))}
                                            required
                                        >
                                            <option value="">Seleccione un artículo</option>
                                            {(items || []).map(opt => (
                                                <option key={opt.id} value={opt.id}>
                                                    {opt.name} (disp: {opt.quantity_available})
                                                </option>
                                            ))}
                                        </select>

                                        {/* Cantidad */}
                                        <input
                                            type="number"
                                            min="1"
                                            value={it.quantity_rented}
                                            onChange={(e) => updateItem(idx, 'quantity_rented', parseInt(e.target.value))}
                                            required
                                        />

                                        {/* Botón eliminar fila */}
                                        <button type="button" onClick={() => removeItem(idx)}>
                                            Eliminar
                                        </button>
                                    </div>
                                ))}

                                <button type="button" onClick={addItem}>+ Agregar artículo</button>
                            </div>

                            {/* Información del Cliente */}
                            <div className="form-section">
                                <h3>Información del Cliente</h3>
                                <div className="form-group">
                                    <label>Nombre completo *</label>
                                    <input
                                        type="text"
                                        className="form-control"
                                        value={rentalForm.customer_name}
                                        onChange={e => setRentalForm({...rentalForm, customer_name: e.target.value})}
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
                                            onChange={e => setRentalForm({...rentalForm, customer_id_number: e.target.value})}
                                            required
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label>Teléfono *</label>
                                        <input
                                            type="tel"
                                            className="form-control"
                                            value={rentalForm.customer_phone}
                                            onChange={e => setRentalForm({...rentalForm, customer_phone: e.target.value})}
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
                                        onChange={e => setRentalForm({...rentalForm, customer_address: e.target.value})}
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Email</label>
                                    <input
                                        type="email"
                                        className="form-control"
                                        value={rentalForm.customer_email}
                                        onChange={e => setRentalForm({...rentalForm, customer_email: e.target.value})}
                                    />
                                </div>
                            </div>

                            {/* Detalles del Alquiler */}
                            <div className="form-section">
                                <h3>Detalles del Alquiler</h3>
                                <div className="form-row">
                                    <div className="form-group">
                                        <label>Fecha de alquiler *</label>
                                        <input
                                            type="date"
                                            className="form-control"
                                            value={rentalForm.rental_start}
                                            onChange={e => setRentalForm({...rentalForm, rental_start: e.target.value})}
                                            required
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label>Fecha de devolución *</label>
                                        <input
                                            type="date"
                                            className="form-control"
                                            value={rentalForm.rental_end}
                                            onChange={e => setRentalForm({...rentalForm, rental_end: e.target.value})}
                                            min={rentalForm.rental_start}
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
                                            onChange={e => setRentalForm({...rentalForm, has_collateral: e.target.checked})}
                                        />
                                        <label htmlFor="has_collateral">¿Dejó prenda?</label>
                                    </div>
                                    {rentalForm.has_collateral && (
                                        <input
                                            type="text"
                                            className="form-control mt-2"
                                            placeholder="Descripción de la prenda"
                                            value={rentalForm.collateral_description}
                                            onChange={e => setRentalForm({...rentalForm, collateral_description: e.target.value})}
                                        />
                                    )}
                                </div>
                                <div className="form-group">
                                    <label>Depósito inicial</label>
                                    <input
                                        type="number"
                                        className="form-control"
                                        value={rentalForm.deposit}
                                        onChange={e => setRentalForm({...rentalForm, deposit: parseFloat(e.target.value) || 0})}
                                        step="0.01"
                                        min="0"
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Notas adicionales</label>
                                    <textarea
                                        className="form-control"
                                        value={rentalForm.notes}
                                        onChange={e => setRentalForm({...rentalForm, notes: e.target.value})}
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

                        <div className="rental-info">
                            <h3>{selectedRental.item_name}</h3>
                            <p>Cliente: {selectedRental.customer_name}</p>
                            <p>Total del alquiler: ${selectedRental.total_amount || 0}</p>
                        </div>

                        {/* Lista de abonos existentes - CON VALIDACIÓN */}
                        <div className="payments-list">
                            <h4>Abonos realizados</h4>
                            {Array.isArray(payments) && payments.length > 0 ? (
                                <table className="payments-table">
                                    <thead>
                                    <tr>
                                        <th>Fecha</th>
                                        <th>Monto</th>
                                        <th>Método</th>
                                        <th>Notas</th>
                                    </tr>
                                    </thead>
                                    <tbody>
                                    {payments.map(payment => (
                                        <tr key={payment.id}>
                                            <td>{formatDate(payment.payment_date)}</td>
                                            <td>${payment.amount}</td>
                                            <td>{payment.payment_method}</td>
                                            <td>{payment.notes || '-'}</td>
                                        </tr>
                                    ))}
                                    </tbody>
                                </table>
                            ) : (
                                <p className="text-muted">No hay abonos registrados</p>
                            )}
                        </div>

                        {/* Resumen de pagos - CON VALIDACIÓN */}
                        <div className="payment-summary">
                            <div className="summary-item">
                                <span>Total del alquiler:</span>
                                <span className="amount">${selectedRental.total_amount || 0}</span>
                            </div>
                            <div className="summary-item">
                                <span>Total abonado:</span>
                                <span className="amount">
                        ${Array.isArray(payments)
                                    ? payments.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0).toFixed(2)
                                    : '0.00'
                                }
                    </span>
                            </div>
                            <div className="summary-item total">
                                <span>Saldo pendiente:</span>
                                <span className="amount">
                        ${(
                                    (parseFloat(selectedRental.total_amount) || 0) -
                                    (Array.isArray(payments)
                                        ? payments.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0)
                                        : 0)
                                ).toFixed(2)}
                    </span>
                            </div>
                        </div>

                        {/* Formulario para nuevo abono */}
                        <form onSubmit={handlePaymentSubmit} className="payment-form">
                            <h4>Registrar nuevo abono</h4>

                            <div className="form-group">
                                <label>Monto del abono</label>
                                <input
                                    type="number"
                                    className="form-control"
                                    value={paymentForm.amount}
                                    onChange={(e) => setPaymentForm({
                                        ...paymentForm,
                                        amount: parseFloat(e.target.value) || 0
                                    })}
                                    step="0.01"
                                    min="0.01"
                                    max={(parseFloat(selectedRental.total_amount) || 0) -
                                        (Array.isArray(payments)
                                            ? payments.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0)
                                            : 0)}
                                    required
                                />
                            </div>

                            <div className="form-group">
                                <label>Método de pago</label>
                                <select
                                    className="form-control"
                                    value={paymentForm.payment_method}
                                    onChange={(e) => setPaymentForm({
                                        ...paymentForm,
                                        payment_method: e.target.value
                                    })}
                                >
                                    <option value="efectivo">Efectivo</option>
                                    <option value="transferencia">Transferencia</option>
                                    <option value="tarjeta">Tarjeta</option>
                                    <option value="otro">Otro</option>
                                </select>
                            </div>

                            <div className="form-group">
                                <label>Notas (opcional)</label>
                                <textarea
                                    className="form-control"
                                    value={paymentForm.notes}
                                    onChange={(e) => setPaymentForm({
                                        ...paymentForm,
                                        notes: e.target.value
                                    })}
                                    rows="2"
                                />
                            </div>

                            <div className="form-actions">
                                <button
                                    type="button"
                                    className="btn btn-secondary"
                                    onClick={() => closeModal('payment')}
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    className="btn btn-primary"
                                    disabled={loading || !paymentForm.amount}
                                >
                                    {loading ? 'Registrando...' : 'Registrar Abono'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

export default Rental;