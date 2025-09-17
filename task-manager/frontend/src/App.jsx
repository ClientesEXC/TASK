import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Calendar from 'react-calendar';
import { Plus, Edit2, Trash2, Calendar as CalendarIcon, Layout } from 'lucide-react';
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
    const [view, setView] = useState('kanban');
    const [showModal, setShowModal] = useState(false);
    const [editingTask, setEditingTask] = useState(null);
    const [formData, setFormData] = useState({
        title: '',
        client_name: '',
        price: 0,
        advance_payment: 0,
        status: 'cotizacion',
        description: '',
        due_date: ''
    });

    useEffect(() => {
        fetchTasks();
    }, []);

    const fetchTasks = async () => {
        try {
            const response = await axios.get(`${API_URL}/tasks`);
            setTasks(response.data);
        } catch (error) {
            console.error('Error fetching tasks:', error);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (editingTask) {
                await axios.put(`${API_URL}/tasks/${editingTask.id}`, formData);
            } else {
                await axios.post(`${API_URL}/tasks`, formData);
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

    const openModal = (task = null) => {
        if (task) {
            setEditingTask(task);
            setFormData({
                ...task,
                due_date: task.due_date ? task.due_date.split('T')[0] : ''
            });
        } else {
            setEditingTask(null);
            setFormData({
                title: '',
                client_name: '',
                price: 0,
                advance_payment: 0,
                status: 'cotizacion',
                description: '',
                due_date: ''
            });
        }
        setShowModal(true);
    };

    const closeModal = () => {
        setShowModal(false);
        setEditingTask(null);
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
        return tasks.filter(task => task.status === status);
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
                <span>Abono: ${parseFloat(task.advance_payment).toFixed(2)}</span>
            </div>
            {task.due_date && (
                <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '5px' }}>
                    Fecha: {new Date(task.due_date).toLocaleDateString()}
                </div>
            )}
            <div className="task-actions">
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
            const dayTasks = tasks.filter(task => {
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
                <div style={{ marginTop: '20px' }}>
                    <h3>Tareas del día seleccionado:</h3>
                    {/* Aquí podrías mostrar las tareas del día seleccionado */}
                </div>
            </div>
        );
    };

    return (
        <div className="container">
            <div className="header">
                <h1>Gestor de Tareas</h1>
                <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
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
                    </div>
                    <button className="add-task-btn" onClick={() => openModal()}>
                        <Plus size={20} />
                        Nueva Tarea
                    </button>
                </div>
            </div>

            {view === 'kanban' ? <KanbanView /> : <CalendarView />}

            {showModal && (
                <div className="modal-overlay">
                    <div className="modal">
                        <h2>{editingTask ? 'Editar Tarea' : 'Nueva Tarea'}</h2>
                        <form onSubmit={handleSubmit}>
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
                                <label>Abono</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    value={formData.advance_payment}
                                    onChange={(e) => setFormData({...formData, advance_payment: parseFloat(e.target.value)})}
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
        </div>
    );
}

export default App;