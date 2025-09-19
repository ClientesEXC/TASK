import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Calendar from 'react-calendar';
import { Plus, Edit2, Trash2, Calendar as CalendarIcon, Layout, X, DollarSign, Clock, Search } from 'lucide-react';
import 'react-calendar/dist/Calendar.css';

const API_URL = 'http://localhost:3001/api';

const statusLabels = {
    cotizacion: 'Cotización',
    en_proceso: 'En Proceso',
    terminado: 'Terminado',
    entregado: 'Entregado'
};

function App() {
    const [tasks, setTasks] = useState([]);
    const [filteredTasks, setFilteredTasks] = useState([]); // NUEVO: Estado para tareas filtradas
    const [searchTerm, setSearchTerm] = useState(''); // NUEVO: Estado para término de búsqueda
    const [view, setView] = useState('kanban');
    const [showModal, setShowModal] = useState(false);
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [editingTask, setEditingTask] = useState(null);
    const [selectedTaskForPayment, setSelectedTaskForPayment] = useState(null);
    const [payments, setPayments] = useState([]);
    const [formData, setFormData] = useState({
        title: '',
        client_name: '',
        price: 0,
        status: 'cotizacion',
        description: '',
        due_date: ''
    });
    const [tempPayments, setTempPayments] = useState([]);
    const [newPayment, setNewPayment] = useState({
        amount: '',
        payment_date: new Date().toISOString().split('T')[0],
        notes: ''
    });

    useEffect(() => {
        fetchTasks();
        // Actualizar cada día a medianoche
        const now = new Date();
        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(0, 0, 0, 0);

        const timeout = setTimeout(() => {
            fetchTasks();
            // Configurar intervalo diario después del primer timeout
            const interval = setInterval(fetchTasks, 24 * 60 * 60 * 1000);
            return () => clearInterval(interval);
        }, tomorrow.getTime() - now.getTime());

        return () => clearTimeout(timeout);
    }, []);

    // NUEVO: Efecto para filtrar tareas cuando cambia el término de búsqueda o las tareas
    useEffect(() => {
        filterTasks();
    }, [searchTerm, tasks]);

    // NUEVA FUNCIÓN: Filtrar tareas por título o nombre del cliente
    const filterTasks = () => {
        if (!searchTerm.trim()) {
            setFilteredTasks(tasks);
            return;
        }

        const term = searchTerm.toLowerCase().trim();
        const filtered = tasks.filter(task => {
            const titleMatch = task.title?.toLowerCase().includes(term);
            const clientMatch = task.client_name?.toLowerCase().includes(term);
            const descriptionMatch = task.description?.toLowerCase().includes(term); // Bonus: también busca en descripción
            return titleMatch || clientMatch || descriptionMatch;
        });

        setFilteredTasks(filtered);
    };

    // NUEVA FUNCIÓN: Limpiar búsqueda
    const clearSearch = () => {
        setSearchTerm('');
        setFilteredTasks(tasks);
    };

    const fetchTasks = async () => {
        try {
            const response = await axios.get(`${API_URL}/tasks`);
            setTasks(response.data);
            // También actualizar las tareas filtradas si no hay búsqueda activa
            if (!searchTerm.trim()) {
                setFilteredTasks(response.data);
            }
        } catch (error) {
            console.error('Error fetching tasks:', error);
        }
    };

    const fetchPayments = async (taskId) => {
        try {
            const response = await axios.get(`${API_URL}/tasks/${taskId}/payments`);
            setPayments(response.data);
        } catch (error) {
            console.error('Error fetching payments:', error);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (editingTask) {
                // Actualizar tarea existente
                await axios.put(`${API_URL}/tasks/${editingTask.id}`, formData);

                // Agregar nuevos abonos si hay
                for (const payment of tempPayments) {
                    await axios.post(`${API_URL}/tasks/${editingTask.id}/payments`, payment);
                }
            } else {
                // Crear nueva tarea con abono inicial si existe
                const taskData = { ...formData };
                if (tempPayments.length > 0) {
                    taskData.initial_payment = tempPayments[0];
                }
                const response = await axios.post(`${API_URL}/tasks`, taskData);

                // Agregar abonos adicionales si hay más de uno
                for (let i = 1; i < tempPayments.length; i++) {
                    await axios.post(`${API_URL}/tasks/${response.data.id}/payments`, tempPayments[i]);
                }
            }
            fetchTasks();
            closeModal();
        } catch (error) {
            console.error('Error saving task:', error);
        }
    };

    const handleDelete = async (id) => {
        if (window.confirm('¿Estás seguro de eliminar esta tarea?')) {
            try {
                await axios.delete(`${API_URL}/tasks/${id}`);
                fetchTasks();
            } catch (error) {
                console.error('Error deleting task:', error);
            }
        }
    };

    const openModal = async (task = null) => {
        if (task) {
            setEditingTask(task);
            setFormData({
                title: task.title,
                client_name: task.client_name,
                price: task.price,
                status: task.status,
                description: task.description || '',
                due_date: task.due_date ? task.due_date.split('T')[0] : ''
            });
            // Cargar abonos existentes
            await fetchPayments(task.id);
            setTempPayments([]);
        } else {
            setEditingTask(null);
            setFormData({
                title: '',
                client_name: '',
                price: 0,
                status: 'cotizacion',
                description: '',
                due_date: ''
            });
            setPayments([]);
            setTempPayments([]);
        }
        setShowModal(true);
    };

    const closeModal = () => {
        setShowModal(false);
        setEditingTask(null);
        setTempPayments([]);
        setPayments([]);
    };

    const addTempPayment = () => {
        if (newPayment.amount && newPayment.amount > 0) {
            setTempPayments([...tempPayments, { ...newPayment, amount: parseFloat(newPayment.amount) }]);
            setNewPayment({
                amount: '',
                payment_date: new Date().toISOString().split('T')[0],
                notes: ''
            });
        }
    };

    const removeTempPayment = (index) => {
        setTempPayments(tempPayments.filter((_, i) => i !== index));
    };

    const deleteExistingPayment = async (paymentId) => {
        if (window.confirm('¿Estás seguro de eliminar este abono?')) {
            try {
                await axios.delete(`${API_URL}/payments/${paymentId}`);
                await fetchPayments(editingTask.id);
                fetchTasks();
            } catch (error) {
                console.error('Error deleting payment:', error);
            }
        }
    };

    const openPaymentModal = async (task) => {
        setSelectedTaskForPayment(task);
        await fetchPayments(task.id);
        setShowPaymentModal(true);
    };

    const addPaymentToExistingTask = async () => {
        if (newPayment.amount && newPayment.amount > 0) {
            try {
                await axios.post(`${API_URL}/tasks/${selectedTaskForPayment.id}/payments`, {
                    ...newPayment,
                    amount: parseFloat(newPayment.amount)
                });
                await fetchPayments(selectedTaskForPayment.id);
                fetchTasks();
                setNewPayment({
                    amount: '',
                    payment_date: new Date().toISOString().split('T')[0],
                    notes: ''
                });
            } catch (error) {
                console.error('Error adding payment:', error);
            }
        }
    };

    const handleDragStart = (e, task) => {
        e.dataTransfer.setData('taskId', task.id);
    };

    const handleDragOver = (e) => {
        e.preventDefault();
    };

    const handleDrop = async (e, newStatus) => {
        e.preventDefault();
        const taskId = e.dataTransfer.getData('taskId');

        try {
            await axios.patch(`${API_URL}/tasks/${taskId}/status`, { status: newStatus });
            fetchTasks();
        } catch (error) {
            console.error('Error updating task status:', error);
        }
    };

    // MODIFICADO: Usar filteredTasks en lugar de tasks
    const getTasksByStatus = (status) => {
        return filteredTasks.filter(task => task.status === status);
    };

    const calculateRemaining = (task) => {
        const total = parseFloat(task.price || 0);
        const paid = parseFloat(task.total_advance_payment || 0);
        return total - paid;
    };

    // Función para calcular días restantes
    const calculateDaysRemaining = (dueDate) => {
        if (!dueDate) return null;

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const due = new Date(dueDate);
        due.setHours(0, 0, 0, 0);

        const diffTime = due - today;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        return diffDays;
    };

    // Función para determinar el color de urgencia
    const getUrgencyColor = (days) => {
        if (days === null) return '#9ca3af'; // gris para sin fecha
        if (days < 0) return '#991b1b'; // rojo oscuro para vencidas
        if (days <= 7) return '#dc2626'; // rojo para muy urgente
        if (days <= 14) return '#f97316'; // naranja para urgente
        return '#16a34a'; // verde para con tiempo
    };

    // Función para obtener el estilo de la barra de progreso
    const getProgressBarStyle = (days, totalDays) => {
        if (days === null || totalDays === null || totalDays <= 0) return { width: '100%', background: '#e5e7eb' };

        const percentage = Math.max(0, Math.min(100, ((totalDays - days) / totalDays) * 100));
        const color = getUrgencyColor(days);

        return {
            width: `${percentage}%`,
            background: color,
            transition: 'all 0.3s ease'
        };
    };

    // MODIFICADO: Usar filteredTasks
    const getPendingTasksSortedByDeadline = () => {
        return filteredTasks
            .filter(task => task.status !== 'terminado' && task.status !== 'entregado')
            .map(task => ({
                ...task,
                daysRemaining: calculateDaysRemaining(task.due_date),
                totalDays: task.due_date ? calculateDaysRemaining(task.created_at) + calculateDaysRemaining(task.due_date) : null
            }))
            .sort((a, b) => {
                if (a.daysRemaining === null) return 1;
                if (b.daysRemaining === null) return -1;
                return a.daysRemaining - b.daysRemaining;
            });
    };

    const TaskCard = ({ task }) => (
        <div
            className="task-card"
            draggable
            onDragStart={(e) => handleDragStart(e, task)}
        >
            <div className="task-title">{task.title}</div>
            <div className="task-client">Cliente: {task.client_name}</div>
            <div className="task-price">
                <span>Total: ${parseFloat(task.price).toFixed(2)}</span>
            </div>
            <div className="task-payments-info">
                <span className="payment-badge">
                    Abonado: ${parseFloat(task.total_advance_payment || 0).toFixed(2)}
                </span>
                <span className={`payment-badge ${calculateRemaining(task) <= 0 ? 'paid' : 'pending'}`}>
                    Saldo: ${calculateRemaining(task).toFixed(2)}
                </span>
            </div>
            {task.payment_count > 0 && (
                <div className="payment-count">
                    {task.payment_count} abono{task.payment_count > 1 ? 's' : ''}
                </div>
            )}
            {task.due_date && (
                <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '5px' }}>
                    Fecha: {new Date(task.due_date).toLocaleDateString()}
                </div>
            )}
            <div className="task-actions">
                <button className="payment-btn" onClick={(e) => {
                    e.stopPropagation();
                    openPaymentModal(task);
                }}>
                    <DollarSign size={14} />
                </button>
                <button className="edit-btn" onClick={() => openModal(task)}>
                    <Edit2 size={14} />
                </button>
                <button className="delete-btn" onClick={() => handleDelete(task.id)}>
                    <Trash2 size={14} />
                </button>
            </div>
        </div>
    );

    const KanbanView = () => (
        <div className="kanban-board">
            {Object.keys(statusLabels).map(status => (
                <div
                    key={status}
                    className="kanban-column"
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, status)}
                >
                    <div className={`column-header ${status}`}>
                        {statusLabels[status]} ({getTasksByStatus(status).length})
                    </div>
                    {getTasksByStatus(status).map(task => (
                        <TaskCard key={task.id} task={task} />
                    ))}
                </div>
            ))}
        </div>
    );

    const CalendarView = () => {
        const tileContent = ({ date }) => {
            // MODIFICADO: Usar filteredTasks
            const dayTasks = filteredTasks.filter(task => {
                if (!task.due_date) return false;
                const taskDate = new Date(task.due_date);
                return taskDate.toDateString() === date.toDateString();
            });

            return dayTasks.length > 0 ? (
                <div>
                    {dayTasks.map(task => (
                        <div key={task.id} className="task-calendar-item">
                            {task.title}
                        </div>
                    ))}
                </div>
            ) : null;
        };

        return (
            <div className="calendar-view">
                <div className="calendar-container">
                    <Calendar
                        tileContent={tileContent}
                        value={new Date()}
                    />
                </div>
            </div>
        );
    };

    const DeadlineView = () => {
        const pendingTasks = getPendingTasksSortedByDeadline();

        return (
            <div className="deadline-view">
                <div className="deadline-container">
                    <div className="deadline-list">
                        <h2>Tareas Pendientes por Plazo de Entrega</h2>
                        {pendingTasks.length === 0 ? (
                            <div className="no-tasks">
                                {searchTerm ?
                                    'No se encontraron tareas pendientes con los criterios de búsqueda' :
                                    'No hay tareas pendientes con fecha de entrega'
                                }
                            </div>
                        ) : (
                            pendingTasks.map(task => {
                                const daysRemaining = task.daysRemaining;
                                const urgencyColor = getUrgencyColor(daysRemaining);
                                const isOverdue = daysRemaining !== null && daysRemaining < 0;

                                return (
                                    <div key={task.id} className="deadline-item">
                                        <div className="deadline-task-info">
                                            <div className="deadline-task-header">
                                                <h3>{task.title}</h3>
                                                <span className={`status-badge ${task.status}`}>
                                                    {statusLabels[task.status]}
                                                </span>
                                            </div>
                                            <div className="deadline-task-details">
                                                <span className="client-name">{task.client_name}</span>
                                                {task.due_date && (
                                                    <span className="due-date">
                                                        Entrega: {new Date(task.due_date).toLocaleDateString()}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="progress-bar-container">
                                                <div
                                                    className="progress-bar-fill"
                                                    style={getProgressBarStyle(daysRemaining, task.totalDays)}
                                                />
                                            </div>
                                        </div>
                                        <div className="deadline-days-remaining">
                                            <div
                                                className="days-display"
                                                style={{
                                                    backgroundColor: urgencyColor,
                                                    color: 'white'
                                                }}
                                            >
                                                <div className="days-number">
                                                    {daysRemaining === null ?
                                                        'Sin fecha' :
                                                        isOverdue ?
                                                            `${Math.abs(daysRemaining)}` :
                                                            daysRemaining
                                                    }
                                                </div>
                                                <div className="days-label">
                                                    {daysRemaining === null ?
                                                        '' :
                                                        isOverdue ?
                                                            'días vencido' :
                                                            daysRemaining === 1 ?
                                                                'día' :
                                                                'días'
                                                    }
                                                </div>
                                            </div>
                                            <div className="deadline-actions">
                                                <button
                                                    className="icon-btn"
                                                    onClick={() => openModal(task)}
                                                    title="Editar tarea"
                                                >
                                                    <Edit2 size={16} />
                                                </button>
                                                <button
                                                    className="icon-btn payment"
                                                    onClick={() => openPaymentModal(task)}
                                                    title="Gestionar abonos"
                                                >
                                                    <DollarSign size={16} />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                    <div className="deadline-legend">
                        <h3>Leyenda de Colores</h3>
                        <div className="legend-item">
                            <div className="legend-color" style={{ backgroundColor: '#991b1b' }}></div>
                            <span>Vencido</span>
                        </div>
                        <div className="legend-item">
                            <div className="legend-color" style={{ backgroundColor: '#dc2626' }}></div>
                            <span>Urgente (≤ 7 días)</span>
                        </div>
                        <div className="legend-item">
                            <div className="legend-color" style={{ backgroundColor: '#f97316' }}></div>
                            <span>Pronto (8-14 días)</span>
                        </div>
                        <div className="legend-item">
                            <div className="legend-color" style={{ backgroundColor: '#16a34a' }}></div>
                            <span>Con tiempo (> 14 días)</span>
                        </div>
                        <div className="legend-item">
                            <div className="legend-color" style={{ backgroundColor: '#9ca3af' }}></div>
                            <span>Sin fecha definida</span>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    // NUEVO: Componente del Buscador
    const SearchBar = () => (
        <div className="search-container">
            <div className="search-wrapper">
                <Search className="search-icon" size={20} />
                <input
                    type="text"
                    className="search-input"
                    placeholder="Buscar por título o cliente..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
                {searchTerm && (
                    <button className="search-clear" onClick={clearSearch}>
                        <X size={18} />
                    </button>
                )}
            </div>
            {searchTerm && (
                <div className="search-results-info">
                    Encontradas: {filteredTasks.length} de {tasks.length} tareas
                </div>
            )}
        </div>
    );

    return (
        <div className="container">
            <div className="header">
                <h1>Gestor de Tareas</h1>

                {/* NUEVO: Buscador integrado */}
                <SearchBar />

                <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginTop: '15px' }}>
                    <div className="view-toggles">
                        <button
                            className={view === 'kanban' ? 'active' : ''}
                            onClick={() => setView('kanban')}
                        >
                            <Layout size={16} style={{ display: 'inline', marginRight: '5px' }} />
                            Tablero
                        </button>
                        <button
                            className={view === 'calendar' ? 'active' : ''}
                            onClick={() => setView('calendar')}
                        >
                            <CalendarIcon size={16} style={{ display: 'inline', marginRight: '5px' }} />
                            Calendario
                        </button>
                        <button
                            className={view === 'deadlines' ? 'active' : ''}
                            onClick={() => setView('deadlines')}
                        >
                            <Clock size={16} style={{ display: 'inline', marginRight: '5px' }} />
                            Plazos
                        </button>
                    </div>
                    <button className="add-task-btn" onClick={() => openModal()}>
                        <Plus size={20} />
                        Nueva Tarea
                    </button>
                </div>
            </div>

            {view === 'kanban' && <KanbanView />}
            {view === 'calendar' && <CalendarView />}
            {view === 'deadlines' && <DeadlineView />}

            {/* Modal de Tarea */}
            {showModal && (
                <div className="modal-overlay">
                    <div className="modal modal-large">
                        <h2>{editingTask ? 'Editar Tarea' : 'Nueva Tarea'}</h2>
                        <form onSubmit={handleSubmit}>
                            <div className="form-row">
                                <div className="form-group">
                                    <label>Título *</label>
                                    <input
                                        type="text"
                                        value={formData.title}
                                        onChange={(e) => setFormData({...formData, title: e.target.value})}
                                        required
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Nombre del Cliente *</label>
                                    <input
                                        type="text"
                                        value={formData.client_name}
                                        onChange={(e) => setFormData({...formData, client_name: e.target.value})}
                                        required
                                    />
                                </div>
                            </div>
                            <div className="form-row">
                                <div className="form-group">
                                    <label>Precio Total</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={formData.price}
                                        onChange={(e) => setFormData({...formData, price: parseFloat(e.target.value)})}
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Estado</label>
                                    <select
                                        value={formData.status}
                                        onChange={(e) => setFormData({...formData, status: e.target.value})}
                                    >
                                        {Object.entries(statusLabels).map(([value, label]) => (
                                            <option key={value} value={value}>{label}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label>Fecha de Entrega</label>
                                    <input
                                        type="date"
                                        value={formData.due_date}
                                        onChange={(e) => setFormData({...formData, due_date: e.target.value})}
                                    />
                                </div>
                            </div>

                            {/* Sección de Abonos */}
                            <div className="payments-section">
                                <h3>Registro de Abonos</h3>

                                {/* Abonos existentes (solo en modo edición) */}
                                {editingTask && payments.length > 0 && (
                                    <div className="existing-payments">
                                        <h4>Abonos Registrados</h4>
                                        {payments.map((payment, index) => (
                                            <div key={payment.id} className="payment-item">
                                                <span>${parseFloat(payment.amount).toFixed(2)}</span>
                                                <span>{new Date(payment.payment_date).toLocaleDateString()}</span>
                                                <span>{payment.notes || 'Sin notas'}</span>
                                                <button
                                                    type="button"
                                                    className="remove-btn"
                                                    onClick={() => deleteExistingPayment(payment.id)}
                                                >
                                                    <X size={14} />
                                                </button>
                                            </div>
                                        ))}
                                        <div className="payment-summary">
                                            Total Abonado: ${payments.reduce((sum, p) => sum + parseFloat(p.amount), 0).toFixed(2)}
                                        </div>
                                    </div>
                                )}

                                {/* Formulario para nuevo abono */}
                                <div className="new-payment-form">
                                    <h4>Agregar Nuevo Abono</h4>
                                    <div className="payment-input-group">
                                        <input
                                            type="number"
                                            step="0.01"
                                            placeholder="Monto"
                                            value={newPayment.amount}
                                            onChange={(e) => setNewPayment({...newPayment, amount: e.target.value})}
                                        />
                                        <input
                                            type="date"
                                            value={newPayment.payment_date}
                                            onChange={(e) => setNewPayment({...newPayment, payment_date: e.target.value})}
                                        />
                                        <input
                                            type="text"
                                            placeholder="Notas (opcional)"
                                            value={newPayment.notes}
                                            onChange={(e) => setNewPayment({...newPayment, notes: e.target.value})}
                                        />
                                        <button type="button" className="add-payment-btn" onClick={addTempPayment}>
                                            <Plus size={16} />
                                        </button>
                                    </div>
                                </div>

                                {/* Abonos temporales (pendientes de guardar) */}
                                {tempPayments.length > 0 && (
                                    <div className="temp-payments">
                                        <h4>Abonos por Agregar</h4>
                                        {tempPayments.map((payment, index) => (
                                            <div key={index} className="payment-item temp">
                                                <span>${parseFloat(payment.amount).toFixed(2)}</span>
                                                <span>{new Date(payment.payment_date).toLocaleDateString()}</span>
                                                <span>{payment.notes || 'Sin notas'}</span>
                                                <button
                                                    type="button"
                                                    className="remove-btn"
                                                    onClick={() => removeTempPayment(index)}
                                                >
                                                    <X size={14} />
                                                </button>
                                            </div>
                                        ))}
                                        <div className="payment-summary">
                                            Total a Agregar: ${tempPayments.reduce((sum, p) => sum + p.amount, 0).toFixed(2)}
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="form-group">
                                <label>Descripción</label>
                                <textarea
                                    value={formData.description}
                                    onChange={(e) => setFormData({...formData, description: e.target.value})}
                                />
                            </div>
                            <div className="modal-actions">
                                <button type="button" className="cancel-btn" onClick={closeModal}>
                                    Cancelar
                                </button>
                                <button type="submit" className="save-btn">
                                    {editingTask ? 'Actualizar' : 'Guardar'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal de Gestión de Abonos Rápida */}
            {showPaymentModal && selectedTaskForPayment && (
                <div className="modal-overlay">
                    <div className="modal">
                        <h2>Gestión de Abonos - {selectedTaskForPayment.title}</h2>
                        <div className="payment-modal-info">
                            <p>Cliente: {selectedTaskForPayment.client_name}</p>
                            <p>Total: ${parseFloat(selectedTaskForPayment.price).toFixed(2)}</p>
                            <p>Saldo: ${calculateRemaining(selectedTaskForPayment).toFixed(2)}</p>
                        </div>

                        {/* Lista de abonos existentes */}
                        {payments.length > 0 && (
                            <div className="existing-payments">
                                <h4>Historial de Abonos</h4>
                                {payments.map((payment) => (
                                    <div key={payment.id} className="payment-item">
                                        <span>${parseFloat(payment.amount).toFixed(2)}</span>
                                        <span>{new Date(payment.payment_date).toLocaleDateString()}</span>
                                        <span>{payment.notes || 'Sin notas'}</span>
                                        <button
                                            type="button"
                                            className="remove-btn"
                                            onClick={() => deleteExistingPayment(payment.id)}
                                        >
                                            <X size={14} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Agregar nuevo abono */}
                        <div className="new-payment-form">
                            <h4>Registrar Nuevo Abono</h4>
                            <div className="form-group">
                                <input
                                    type="number"
                                    step="0.01"
                                    placeholder="Monto"
                                    value={newPayment.amount}
                                    onChange={(e) => setNewPayment({...newPayment, amount: e.target.value})}
                                />
                            </div>
                            <div className="form-group">
                                <input
                                    type="date"
                                    value={newPayment.payment_date}
                                    onChange={(e) => setNewPayment({...newPayment, payment_date: e.target.value})}
                                />
                            </div>
                            <div className="form-group">
                                <input
                                    type="text"
                                    placeholder="Notas (opcional)"
                                    value={newPayment.notes}
                                    onChange={(e) => setNewPayment({...newPayment, notes: e.target.value})}
                                />
                            </div>
                            <button
                                type="button"
                                className="save-btn"
                                onClick={addPaymentToExistingTask}
                            >
                                Agregar Abono
                            </button>
                        </div>

                        <div className="modal-actions">
                            <button
                                type="button"
                                className="cancel-btn"
                                onClick={() => {
                                    setShowPaymentModal(false);
                                    setSelectedTaskForPayment(null);
                                    setNewPayment({
                                        amount: '',
                                        payment_date: new Date().toISOString().split('T')[0],
                                        notes: ''
                                    });
                                }}
                            >
                                Cerrar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default App;