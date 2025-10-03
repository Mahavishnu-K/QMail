// src/components/layout/AppLayout.jsx

import React, { useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import Sidebar from './../core/Sidebar';
import Notification from '../ui/Notification';
import { useAuth } from '../../contexts/AuthContext';
import { EmailProvider } from '../../contexts/EmailContext';
import { WebSocketProvider } from '../../contexts/webSocketContext';

const AppLayout = () => {
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const [notification, setNotification] = useState('');
    const { user } = useAuth();
    const navigate = useNavigate();

    const handleCompose = () => navigate('/compose');
    const handleSettings = () => navigate('/settings');
    const handleSelectFolder = (folderId) => navigate(`/folder/${folderId}`);

    return (
        // Providers are now scoped to the authenticated layout
        <EmailProvider>
            <WebSocketProvider>
                <div className="flex h-screen bg-white font-sans">
                    <Sidebar
                        user={user}
                        onSelectFolder={handleSelectFolder}
                        onCompose={handleCompose}
                        onSettings={handleSettings}
                        collapsed={sidebarCollapsed}
                        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
                    />
                    <div className="flex-1 flex flex-col overflow-hidden">
                        <Outlet context={{ setNotification }} />
                    </div>
                    <Notification message={notification} onClose={() => setNotification('')} />
                </div>
            </WebSocketProvider>
        </EmailProvider>
    );
};

export default AppLayout;