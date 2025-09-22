import React, { useState, useEffect } from 'react';
import TaskManager from './TaskManager';
import Home from './Home';
import Rental from './Rental';
import {
    Home as HomeIcon,
    CheckSquare,
    Key,
    Plus,
    Menu,
    X
} from 'lucide-react';
import './MainApp.css';

// Configuración de pestañas - Fácilmente extensible
const TABS_CONFIG = [
    {
        id: 'home',
        label: 'Home',
        icon: HomeIcon,
        component: Home,
        color: '#667eea'
    },
    {
        id: 'tasks',
        label: 'Gestor de Tareas',
        icon: CheckSquare,
        component: TaskManager,
        color: '#48bb78'
    },
    {
        id: 'rental',
        label: 'Alquiler',
        icon: Key,
        component: Rental,
        color: '#f6ad55'
    }
    // Aquí puedes agregar más pestañas fácilmente
];

function MainApp() {
    const [activeTab, setActiveTab] = useState('home');
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [tabData, setTabData] = useState({});

    useEffect(() => {
        // Cargar la pestaña guardada en localStorage
        const savedTab = localStorage.getItem('activeTab');
        if (savedTab && TABS_CONFIG.find(tab => tab.id === savedTab)) {
            setActiveTab(savedTab);
        }
    }, []);

    const handleTabChange = (tabId) => {
        setActiveTab(tabId);
        setMobileMenuOpen(false);
        localStorage.setItem('activeTab', tabId);
    };

    const updateTabData = (tabId, data) => {
        setTabData(prev => ({
            ...prev,
            [tabId]: data
        }));
    };

    const ActiveComponent = TABS_CONFIG.find(tab => tab.id === activeTab)?.component || Home;
    const activeTabConfig = TABS_CONFIG.find(tab => tab.id === activeTab);

    return (
        <div className="main-app">
            {/* Header con navegación */}
            <header className="main-header">
                <div className="header-container">
                    <div className="header-content">
                        <div className="logo-section">
                            <h1 className="app-title">Sistema de Gestión</h1>
                            <span className="app-subtitle">Panel de Control</span>
                        </div>

                        {/* Navegación Desktop */}
                        <nav className="desktop-nav">
                            {TABS_CONFIG.map((tab) => {
                                const Icon = tab.icon;
                                return (
                                    <button
                                        key={tab.id}
                                        className={`tab-button ${activeTab === tab.id ? 'active' : ''}`}
                                        onClick={() => handleTabChange(tab.id)}
                                        style={{
                                            '--tab-color': tab.color,
                                            borderColor: activeTab === tab.id ? tab.color : 'transparent'
                                        }}
                                    >
                                        <Icon size={20} />
                                        <span>{tab.label}</span>
                                        {tabData[tab.id]?.notification && (
                                            <span className="notification-badge">
                                                {tabData[tab.id].notification}
                                            </span>
                                        )}
                                    </button>
                                );
                            })}
                        </nav>

                        {/* Botón menú móvil */}
                        <button
                            className="mobile-menu-toggle"
                            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                        >
                            {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
                        </button>
                    </div>

                    {/* Navegación Móvil */}
                    {mobileMenuOpen && (
                        <nav className="mobile-nav">
                            {TABS_CONFIG.map((tab) => {
                                const Icon = tab.icon;
                                return (
                                    <button
                                        key={tab.id}
                                        className={`mobile-tab-button ${activeTab === tab.id ? 'active' : ''}`}
                                        onClick={() => handleTabChange(tab.id)}
                                        style={{
                                            '--tab-color': tab.color
                                        }}
                                    >
                                        <Icon size={20} />
                                        <span>{tab.label}</span>
                                        {tabData[tab.id]?.notification && (
                                            <span className="notification-badge">
                                                {tabData[tab.id].notification}
                                            </span>
                                        )}
                                    </button>
                                );
                            })}
                        </nav>
                    )}
                </div>
            </header>

            {/* Breadcrumb */}
            <div className="breadcrumb">
                <div className="breadcrumb-container">
                    <span className="breadcrumb-item">Sistema</span>
                    <span className="breadcrumb-separator">/</span>
                    <span
                        className="breadcrumb-current"
                        style={{ color: activeTabConfig?.color }}
                    >
                        {activeTabConfig?.label}
                    </span>
                </div>
            </div>

            {/* Contenido principal */}
            <main className="main-content">
                <ActiveComponent
                    updateTabData={(data) => updateTabData(activeTab, data)}
                    allTabsData={tabData}
                    switchToTab={handleTabChange}
                />
            </main>

            {/* Footer */}
            <footer className="main-footer">
                <div className="footer-container">
                    <p>&copy; 2024 Sistema de Gestión - Todos los derechos reservados</p>
                </div>
            </footer>
        </div>
    );
}

export default MainApp;