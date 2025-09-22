import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Calendar from 'react-calendar';
import {
    Plus, Edit2, Trash2, Calendar as CalendarIcon,
    Layout, X, DollarSign, Clock, Search, Archive,
    ChevronDown, ChevronUp, Eye, RotateCcw, Filter
} from 'lucide-react';
import 'react-calendar/dist/Calendar.css';

const API_URL = 'http://localhost:3001/api';

const statusLabels = {
    cotizacion: 'Cotización',
    en_proceso: 'En Proceso',
    terminado: 'Terminado',
    entregado: 'Entregado'
};

const months = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

function TaskManager({ updateTabData }) {
    const [tasks, setTasks] = useState([]);
    const [filteredTasks, setFilteredTasks] = useState([]);
    const [archivedTasks, setArchivedTasks] = useState([]);
    const [archivedStats, setArchivedStats] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [view, setView] = useState('kanban');
    const [showModal, setShowModal] = useState(false);
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [showArchivedModal, setShowArchivedModal] = useState(false);
    const [editingTask, setEditingTask] = useState(null);
    const [selectedTaskForPayment, setSelectedTaskForPayment] = useState(null);
    const [payments, setPayments] = useState([]);
    const [expandedArchiveMonths, setExpandedArchiveMonths] = useState({});
    const [selectedArchiveFilter, setSelectedArchiveFilter] = useState({ year: null, month: null });
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
        fetchArchivedStats();

        // Actualizar cada día a medianoche
        const now = new Date();
        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(0, 0, 0, 0);

        const timeout = setTimeout(() => {
            fetchTasks();
            fetchArchivedStats();
            // Configurar intervalo diario después del primer timeout
            const interval = setInterval(() => {
                fetchTasks();
                fetchArchivedStats();
            }, 24 * 60 * 60 * 1000);
            return () => clearInterval(interval);
        }, tomorrow.getTime() - now.getTime());

        return () => clearTimeout(timeout);
    }, []);

    useEffect(() => {
        filterTasks();
    }, [searchTerm, tasks]);

    const filterTasks = () => {
        if (!searchTerm.trim()) {
            setFilteredTasks(tasks);
            return;
        }

        const term = searchTerm.toLowerCase().trim();
        const filtered = tasks.filter(task => {
            const titleMatch = task.title?.toLowerCase().includes(term);
            const clientMatch = task.client_name?.toLowerCase().includes(term);
            const descriptionMatch = task.description?.toLowerCase().includes(term);
            return titleMatch || clientMatch || descriptionMatch;
        });

        setFilteredTasks(filtered);
    };

    const clearSearch = () => {
        setSearchTerm('');
        setFilteredTasks(tasks);
    };

    const fetchTasks = async () => {
        try {
            const response = await axios.get(`${API_URL}/tasks`);
            setTasks(response.data);
            if (!searchTerm.trim()) {
                setFilteredTasks(response.data);
            }
        } catch (error) {
            console.error('Error fetching tasks:', error);
        }
    };

    const fetchArchivedTasks = async (year = null, month = null) => {
        try {
            let url = `${API_URL}/tasks/archived`;
            const params = [];
            if (year) params.push(`year=${year}`);
            if (month) params.push(`month=${month}`);
            if (params.length > 0) url += `?${params.join('&')}`;

            const response = await axios.get(url);
            setArchivedTasks(response.data);
        } catch (error) {
            console.error('Error fetching archived tasks:', error);
        }
    };

    const fetchArchivedStats = async () => {
        try {
            const response = await axios.get(`${API_URL}/tasks/archived/stats`);
            setArchivedStats(response.data);
        } catch (error) {
            console.error('Error fetching archived stats:', error);
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

    const restoreTask = async (taskId) => {
        if (window.confirm('¿Deseas restaurar esta tarea a "En Proceso"?')) {
            try {
                await axios.patch(`${API_URL}/tasks/${taskId}/restore`, {
                    newStatus: 'en_proceso'
                });
                fetchTasks();
                fetchArchivedTasks(selectedArchiveFilter.year, selectedArchiveFilter.month);
                fetchArchivedStats();
            } catch (error) {
                console.error('Error restoring task:', error);
            }
        }
    };

    const toggleArchiveMonth = (yearMonth) => {
        setExpandedArchiveMonths(prev => ({
            ...prev,
            [yearMonth]: !prev[yearMonth]
        }));

        // Cargar tareas archivadas para ese mes si se expande
        if (!expandedArchiveMonths[yearMonth]) {
            const [year, month] = yearMonth.split('-');
            fetchArchivedTasks(year, month);
            setSelectedArchiveFilter({ year, month });
        }
    };

    const openArchivedView = () => {
        setShowArchivedModal(true);
        fetchArchivedTasks();
    };

    const handleSubmit = async () => {
        try {
            if (editingTask) {
                await axios.put(`${API_URL}/tasks/${editingTask.id}`, formData);

                for (const payment of tempPayments) {
                    await axios.post(`${API_URL}/tasks/${editingTask.id}/payments`, payment);
                }
            } else {
                const taskData = { ...formData };
                if (tempPayments.length > 0) {
                    taskData.initial_payment = tempPayments[0];
                }
                const response = await axios.post(`${API_URL}/tasks`, taskData);

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

    const getTasksByStatus = (status) => {
        return filteredTasks.filter(task => task.status === status);
    };

    const calculateRemaining = (task) => {
        const total = parseFloat(task.price || 0);
        const paid = parseFloat(task.total_advance_payment || 0);
        return total - paid;
    };

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

    const getUrgencyColor = (days) => {
        if (days === null) return '#9ca3af';
        if (days < 0) return '#991b1b';
        if (days <= 7) return '#dc2626';
        if (days <= 14) return '#f97316';
        return '#16a34a';
    };

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

    const TaskCard = ({ task, isArchived = false }) => (
        <div
            className={`task-card ${isArchived ? 'archived' : ''}`}
            draggable={!isArchived}
            onDragStart={!isArchived ? (e) => handleDragStart(e, task) : undefined}
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
            {task.delivered_date && (
                <div className="delivered-info">
                    Entregado: {new Date(task.delivered_date).toLocaleDateString()}
                    {task.days_since_delivery && (
                        <span className="days-badge">
                            Hace {Math.floor(task.days_since_delivery)} días
                        </span>
                    )}
                </div>
            )}
            <div className="task-actions">
                {isArchived ? (
                    <>
                        <button className="restore-btn" onClick={() => restoreTask(task.id)}>
                            <RotateCcw size={14} />
                        </button>
                        <button className="view-btn" onClick={() => openModal(task)}>
                            <Eye size={14} />
                        </button>
                    </>
                ) : (
                    <>
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
                    </>
                )}
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
                        {status === 'entregado' && (
                            <span className="header-note">
                                (Visible por 48h)
                            </span>
                        )}
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

    const ArchivedModal = () => {
        // Agrupar tareas archivadas por año y mes
        const groupedArchived = archivedStats.reduce((acc, stat) => {
            const year = stat.year;
            if (!acc[year]) acc[year] = [];
            acc[year].push(stat);
            return acc;
        }, {});

        return (
            <div className="modal-overlay">
                <div className="modal archived-modal">
                    <div className="archived-header">
                        <h2>
                            <Archive size={24} />
                            Tareas Archivadas
                        </h2>
                        <button className="close-btn" onClick={() => setShowArchivedModal(false)}>
                            <X size={20} />
                        </button>
                    </div>

                    <div className="archived-content">
                        {Object.keys(groupedArchived).length === 0 ? (
                            <div className="no-archived">
                                <Archive size={48} />
                                <p>No hay tareas archivadas aún</p>
                                <span>Las tareas entregadas se archivan automáticamente después de 48 horas</span>
                            </div>
                        ) : (
                            Object.entries(groupedArchived).map(([year, yearStats]) => (
                                <div key={year} className="archived-year">
                                    <h3 className="year-header">{year}</h3>
                                    {yearStats.map(stat => {
                                        const monthKey = `${stat.year}-${stat.month}`;
                                        const isExpanded = expandedArchiveMonths[monthKey];
                                        const monthName = months[parseInt(stat.month) - 1];

                                        return (
                                            <div key={monthKey} className="archived-month">
                                                <button
                                                    className="month-header"
                                                    onClick={() => toggleArchiveMonth(monthKey)}
                                                >
                                                    <div className="month-info">
                                                        <span className="month-name">{monthName}</span>
                                                        <div className="month-stats">
                                                            <span className="stat-badge">{stat.count} tareas</span>
                                                            <span className="stat-badge revenue">
                                                                ${parseFloat(stat.total_revenue || 0).toFixed(2)}
                                                            </span>
                                                        </div>
                                                    </div>
                                                    {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                                                </button>

                                                {isExpanded && (
                                                    <div className="archived-tasks-list">
                                                        {archivedTasks
                                                            .filter(task => {
                                                                const taskDate = new Date(task.delivered_date);
                                                                return taskDate.getFullYear() === parseInt(year) &&
                                                                    taskDate.getMonth() + 1 === parseInt(stat.month);
                                                            })
                                                            .map(task => (
                                                                <TaskCard
                                                                    key={task.id}
                                                                    task={task}
                                                                    isArchived={true}
                                                                />
                                                            ))}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="container">
            <div className="header">
                <h1>Gestor de Tareas</h1>

                <SearchBar />

                <div className="header-controls">
                    <div className="view-toggles">
                        <button
                            className={view === 'kanban' ? 'active' : ''}
                            onClick={() => setView('kanban')}
                        >
                            <Layout size={16} />
                            <span className="btn-text">Tablero</span>
                        </button>
                        <button
                            className={view === 'calendar' ? 'active' : ''}
                            onClick={() => setView('calendar')}
                        >
                            <CalendarIcon size={16} />
                            <span className="btn-text">Calendario</span>
                        </button>
                        <button
                            className={view === 'deadlines' ? 'active' : ''}
                            onClick={() => setView('deadlines')}
                        >
                            <Clock size={16} />
                            <span className="btn-text">Plazos</span>
                        </button>
                    </div>

                    <div className="header-actions">
                        <button className="archive-btn" onClick={openArchivedView}>
                            <Archive size={20} />
                            <span className="btn-text">Archivados</span>
                        </button>
                        <button className="add-task-btn" onClick={() => openModal()}>
                            <Plus size={20} />
                            <span className="btn-text">Nueva Tarea</span>
                        </button>
                    </div>
                </div>
            </div>

            {view === 'kanban' && <KanbanView />}
            {view === 'calendar' && <CalendarView />}
            {view === 'deadlines' && <DeadlineView />}

            {/* Modal de Archivados */}
            {showArchivedModal && <ArchivedModal />}

            {/* Modal de Tarea */}
            {showModal && (
                <div className="modal-overlay">
                    <div className="modal modal-large">
                        <h2>{editingTask ? 'Editar Tarea' : 'Nueva Tarea'}</h2>
                        <div className="form-container">
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
                                <button type="button" className="save-btn" onClick={handleSubmit}>
                                    {editingTask ? 'Actualizar' : 'Guardar'}
                                </button>
                            </div>
                        </div>
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

export default TaskManager;