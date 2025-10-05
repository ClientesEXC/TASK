// task-manager/frontend/src/App.jsx
// Actualización para integrar el sistema de alquileres mejorado

import React, { useState } from 'react';
import TaskManager from './TaskManager';
//import Rental from './Rental';
import RentalManagementSystem from './features/rentals/RentalManagementSystem.jsx';

import './App.css';
//import './Rental.css';

function App() {
    const [activeTab, setActiveTab] = useState('tasks');
    const [tabData, setTabData] = useState({
        tasks: { notification: null },
        rentals: { notification: null }
    });

    const updateTabData = (tab) => (data) => {
        setTabData(prev => ({
            ...prev,
            [tab]: data
        }));
    };

    return (
        <div className="app-container">
            <header className="app-header">
                <h1>Sistema de Gestión</h1>
                <nav className="tab-navigation">
                    <button
                        className={`tab-button ${activeTab === 'tasks' ? 'active' : ''}`}
                        onClick={() => setActiveTab('tasks')}
                    >
                        <span>Gestión de Tareas</span>
                        {tabData.tasks.notification && (
                            <span className="notification-badge">
                                {tabData.tasks.notification}
                            </span>
                        )}
                    </button>
                    <button
                        className={`tab-button ${activeTab === 'rentals' ? 'active' : ''}`}
                        onClick={() => setActiveTab('rentals')}
                    >
                        <span>Gestión de Alquileres</span>
                        {tabData.rentals.notification && (
                            <span className="notification-badge notification-urgent">
                                {tabData.rentals.notification}
                            </span>
                        )}
                    </button>
                </nav>
            </header>

            <main className="app-content">
                {activeTab === 'tasks' && (
                    <TaskManager updateTabData={updateTabData('tasks')} />
                )}
                {activeTab === 'rentals' && (
                    <RentalManagementSystem />
                )}
            </main>
        </div>
    );
}

export default App;