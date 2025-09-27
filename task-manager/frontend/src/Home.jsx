import { API_URL } from './config/api';
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
    TrendingUp, Users, DollarSign, CheckCircle,
    Clock, Package, AlertCircle, Calendar,
    ArrowRight, Activity, Key, Archive
} from 'lucide-react';
import './Home.css';


function Home({ switchToTab }) {
    const [taskStats, setTaskStats] = useState({
        total: 0,
        byStatus: {},
        revenue: 0,
        pendingPayments: 0,
        overdueTasks: 0,
        weekTasks: 0
    });
    const [tasks, setTasks] = useState([]);
    const [rentalStats, setRentalStats] = useState({
        total: 0,
        active: 0,
        revenue: 0,
        nextReturns: 0
    });

    const [recentActivities, setRecentActivities] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchDashboardData();
        const interval = setInterval(fetchDashboardData, 60000); // Actualizar cada minuto
        return () => clearInterval(interval);
    }, []);

    // Fragmento corregido de Home.jsx - Líneas 85-105 aproximadamente
// Reemplazar la sección de fetchDashboardData con este código:

    const fetchDashboardData = async () => {
        try {
            // Fetch tareas
            const tasksResponse = await axios.get(`${API_URL}/tasks`);
            const tasks = tasksResponse.data;
            setTasks(tasks);

            // Calcular estadísticas de tareas
            const stats = {
                total: tasks.length,
                overdueTasks: 0,
                weekTasks: 0,
                pendingPayments: 0,
                revenue: 0,
                byStatus: {}
            };

            const today = new Date();
            const weekFromNow = new Date(today);
            weekFromNow.setDate(today.getDate() + 7);

            const statusCounts = {};

            tasks.forEach(task => {
                // Contar por estado
                statusCounts[task.status] = (statusCounts[task.status] || 0) + 1;

                // Calcular ingresos
                stats.revenue += parseFloat(task.price || 0);

                // Calcular pagos pendientes
                const pending = parseFloat(task.price || 0) - parseFloat(task.total_advance_payment || 0);
                if (pending > 0) {
                    stats.pendingPayments += pending;
                }

                // Tareas vencidas
                if (task.due_date) {
                    const dueDate = new Date(task.due_date);
                    if (dueDate < today && task.status !== 'entregado' && task.status !== 'terminado') {
                        stats.overdueTasks++;
                    }
                    // Tareas de esta semana
                    if (dueDate >= today && dueDate <= weekFromNow) {
                        stats.weekTasks++;
                    }
                }
            });

            stats.byStatus = statusCounts;
            setTaskStats(stats);

            // FIX: Manejo correcto del endpoint de estadísticas de alquileres
            try {
                const rentalsResponse = await axios.get(`${API_URL}/rentals/stats`);
                setRentalStats(rentalsResponse.data);
            } catch (error) {
                // Si el endpoint no existe o hay error, usar valores por defecto
                console.log('Rentals stats endpoint not available, using defaults');
                setRentalStats({
                    active: 0,
                    total: 0,
                    overdue: 0
                });
            }

            // Generar actividades recientes
            generateRecentActivities(tasks);

        } catch (error) {
            console.error('Error fetching dashboard data:', error);
            // Establecer valores por defecto en caso de error
            setTaskStats({
                total: 0,
                overdueTasks: 0,
                weekTasks: 0,
                pendingPayments: 0,
                revenue: 0,
                byStatus: {}
            });
            setRentalStats({
                active: 0,
                total: 0,
                overdue: 0
            });
        } finally {
            setLoading(false);
        }
    };

    const generateRecentActivities = (tasks) => {
        const activities = [];

        // Ordenar tareas por fecha de actualización
        const sortedTasks = [...tasks].sort((a, b) =>
            new Date(b.updated_at) - new Date(a.updated_at)
        );

        // Tomar las 5 más recientes
        sortedTasks.slice(0, 5).forEach(task => {
            activities.push({
                id: task.id,
                type: 'task',
                title: task.title,
                description: `${task.client_name} - ${getStatusLabel(task.status)}`,
                time: formatTimeAgo(new Date(task.updated_at)),
                icon: getActivityIcon(task.status),
                color: getStatusColor(task.status)
            });
        });

        setRecentActivities(activities);
    };

    const getStatusLabel = (status) => {
        const labels = {
            cotizacion: 'Cotización',
            en_proceso: 'En Proceso',
            terminado: 'Terminado',
            entregado: 'Entregado'
        };
        return labels[status] || status;
    };

    const getStatusColor = (status) => {
        const colors = {
            cotizacion: '#f59e0b',
            en_proceso: '#3b82f6',
            terminado: '#10b981',
            entregado: '#8b5cf6'
        };
        return colors[status] || '#6b7280';
    };

    const getActivityIcon = (status) => {
        const icons = {
            cotizacion: AlertCircle,
            en_proceso: Clock,
            terminado: CheckCircle,
            entregado: Package
        };
        return icons[status] || Activity;
    };

    const formatTimeAgo = (date) => {
        const seconds = Math.floor((new Date() - date) / 1000);
        const intervals = {
            año: 31536000,
            mes: 2592000,
            semana: 604800,
            día: 86400,
            hora: 3600,
            minuto: 60
        };

        for (const [unit, secondsInUnit] of Object.entries(intervals)) {
            const interval = Math.floor(seconds / secondsInUnit);
            if (interval >= 1) {
                return `hace ${interval} ${unit}${interval > 1 ? 's' : ''}`;
            }
        }
        return 'hace un momento';
    };

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('es-EC', {
            style: 'currency',
            currency: 'USD'
        }).format(amount);
    };

    if (loading) {
        return (
            <div className="home-loading">
                <div className="loading-spinner"></div>
                <p>Cargando dashboard...</p>
            </div>
        );
    }

    return (
        <div className="home-container">
            {/* Header del Dashboard */}
            <div className="dashboard-header">
                <div className="welcome-section">
                    <h1>¡Bienvenido al Sistema de Gestión!</h1>
                    <p>Aquí tienes un resumen de tu actividad actual</p>
                </div>
                <div className="date-section">
                    <Calendar size={20} />
                    <span>{new Date().toLocaleDateString('es-EC', {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                    })}</span>
                </div>
            </div>

            {/* Estadísticas Principales */}
            <div className="stats-grid">
                {/* Tarjetas de Tareas */}
                <div className="stat-card tasks-total">
                    <div className="stat-icon">
                        <CheckCircle size={24} />
                    </div>
                    <div className="stat-content">
                        <h3>Total Tareas</h3>
                        <p className="stat-value">{taskStats.total}</p>
                        <div className="stat-detail">
                            {taskStats.weekTasks > 0 && (
                                <span className="badge warning">
                                    {taskStats.weekTasks} esta semana
                                </span>
                            )}
                        </div>
                    </div>
                    <button
                        className="stat-action"
                        onClick={() => switchToTab('tasks')}
                    >
                        <ArrowRight size={20} />
                    </button>
                </div>

                <div className="stat-card revenue">
                    <div className="stat-icon">
                        <DollarSign size={24} />
                    </div>
                    <div className="stat-content">
                        <h3>Ingresos Totales</h3>
                        <p className="stat-value">{formatCurrency(taskStats.revenue)}</p>
                        <div className="stat-detail">
                            <span className="badge success">
                                Por cobrar: {formatCurrency(taskStats.pendingPayments)}
                            </span>
                        </div>
                    </div>
                </div>

                <div className="stat-card urgent">
                    <div className="stat-icon">
                        <AlertCircle size={24} />
                    </div>
                    <div className="stat-content">
                        <h3>Tareas Urgentes</h3>
                        <p className="stat-value">{taskStats.overdueTasks}</p>
                        <div className="stat-detail">
                            {taskStats.overdueTasks > 0 ? (
                                <span className="badge danger">Requieren atención</span>
                            ) : (
                                <span className="badge success">Todo al día</span>
                            )}
                        </div>
                    </div>
                </div>

                <div className="stat-card rentals">
                    <div className="stat-icon">
                        <Key size={24} />
                    </div>
                    <div className="stat-content">
                        <h3>Alquileres Activos</h3>
                        <p className="stat-value">{rentalStats.active || 0}</p>
                        <div className="stat-detail">
                            <span className="badge info">
                                Total: {rentalStats.total || 0}
                            </span>
                        </div>
                    </div>
                    <button
                        className="stat-action"
                        onClick={() => switchToTab('rental')}
                    >
                        <ArrowRight size={20} />
                    </button>
                </div>
            </div>

            {/* Sección de contenido principal */}
            <div className="dashboard-content">
                {/* Estado de Tareas */}
                <div className="content-card task-status-card">
                    <div className="card-header">
                        <h2>Estado de Tareas</h2>
                        <button
                            className="view-all-btn"
                            onClick={() => switchToTab('tasks')}
                        >
                            Ver todas
                            <ArrowRight size={16} />
                        </button>
                    </div>
                    <div className="status-grid">
                        {Object.entries(taskStats.byStatus).map(([status, count]) => (
                            <div
                                key={status}
                                className={`status-item ${status}`}
                                style={{ '--status-color': getStatusColor(status) }}
                            >
                                <div className="status-header">
                                    <span className="status-label">{getStatusLabel(status)}</span>
                                    <span className="status-count">{count}</span>
                                </div>
                                <div className="status-bar">
                                    <div
                                        className="status-fill"
                                        style={{
                                            width: `${(count / taskStats.total) * 100}%`,
                                            background: getStatusColor(status)
                                        }}
                                    />
                                </div>
                                <span className="status-percentage">
                                    {taskStats.total > 0 ?
                                        `${Math.round((count / taskStats.total) * 100)}%` :
                                        '0%'
                                    }
                                </span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Actividades Recientes */}
                <div className="content-card activities-card">
                    <div className="card-header">
                        <h2>Actividad Reciente</h2>
                        <Activity size={20} />
                    </div>
                    <div className="activities-list">
                        {recentActivities.length > 0 ? (
                            recentActivities.map((activity) => {
                                const Icon = activity.icon;
                                return (
                                    <div key={activity.id} className="activity-item">
                                        <div
                                            className="activity-icon"
                                            style={{ background: `${activity.color}20`, color: activity.color }}
                                        >
                                            <Icon size={16} />
                                        </div>
                                        <div className="activity-content">
                                            <p className="activity-title">{activity.title}</p>
                                            <p className="activity-description">{activity.description}</p>
                                        </div>
                                        <span className="activity-time">{activity.time}</span>
                                    </div>
                                );
                            })
                        ) : (
                            <div className="no-activities">
                                <Archive size={40} />
                                <p>No hay actividades recientes</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Panel de Acceso Rápido */}
                <div className="content-card quick-access-card">
                    <div className="card-header">
                        <h2>Acceso Rápido</h2>
                        <TrendingUp size={20} />
                    </div>
                    <div className="quick-actions">
                        <button
                            className="quick-action-btn tasks"
                            onClick={() => switchToTab('tasks')}
                        >
                            <CheckCircle size={32} />
                            <span>Nueva Tarea</span>
                        </button>
                        <button
                            className="quick-action-btn rental"
                            onClick={() => switchToTab('rental')}
                        >
                            <Key size={32} />
                            <span>Nuevo Alquiler</span>
                        </button>
                        <button
                            className="quick-action-btn calendar"
                            onClick={() => switchToTab('tasks')}
                        >
                            <Calendar size={32} />
                            <span>Ver Calendario</span>
                        </button>
                        <button
                            className="quick-action-btn reports"
                            onClick={() => alert('Reportes en desarrollo')}
                        >
                            <Activity size={32} />
                            <span>Reportes</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* Resumen del Mes */}
            <div className="month-summary">
                <h2>Resumen del Mes</h2>
                <div className="summary-grid">
                    <div className="summary-item">
                        <Users size={20} />
                        <div>
                            <p className="summary-label">Clientes Activos</p>
                            <p className="summary-value">
                                {new Set(recentActivities.map(a => a.description?.split(' - ')[0])).size}
                            </p>
                        </div>
                    </div>
                    <div className="summary-item">
                        <TrendingUp size={20} />
                        <div>
                            <p className="summary-label">Tasa de Completado</p>
                            <p className="summary-value">
                                {taskStats.total > 0 ?
                                    `${Math.round(((taskStats.byStatus.terminado || 0) + (taskStats.byStatus.entregado || 0)) / taskStats.total * 100)}%` :
                                    '0%'
                                }
                            </p>
                        </div>
                    </div>
                    <div className="summary-item">
                        <Clock size={20} />
                        <div>
                            <p className="summary-label">En Proceso</p>
                            <p className="summary-value">{taskStats.byStatus.en_proceso || 0}</p>
                        </div>
                    </div>
                    <div className="summary-item">
                        <DollarSign size={20} />
                        <div>
                            <p className="summary-label">Proyección Mensual</p>
                            <p className="summary-value">
                                {formatCurrency(taskStats.revenue * 1.2)}
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default Home;