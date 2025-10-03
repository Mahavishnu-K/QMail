/* START OF MODIFIED FILE: src/components/core/Sidebar.jsx */

import React from 'react';
import FolderList from './FolderList';
import { 
    PencilSquareIcon, 
    ChevronLeftIcon, 
    ArrowLeftOnRectangleIcon,
    Cog6ToothIcon 
} from '@heroicons/react/24/outline';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

const Sidebar = ({ onSelectFolder, onCompose, onSettings, collapsed, onToggleCollapse, unreadCounts }) => {
    const navigate = useNavigate();
    
    const { user, isLoading, logout } = useAuth();

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    const getUserInitial = () => {
        if (isLoading || !user || !user.name) return '?';
        return user.name.charAt(0).toUpperCase();
    };

    return (
        <aside className={`bg-white flex flex-col border-r border-gray-200 transition-all duration-300 ${collapsed ? 'w-20' : 'w-64'}`}>
            {/* --- USER PROFILE SECTION --- */}
            <div className={`p-4 flex items-center h-16 border-b border-gray-200 shrink-0 ${collapsed ? 'justify-center' : 'justify-between'}`}>
                {!collapsed && (
                    <div className="flex items-center min-w-0">
                        {/* Avatar with Initial */}
                        <div className="w-9 h-9 bg-gray-200 rounded-full mr-3 flex-shrink-0 flex items-center justify-center">
                            <span className="text-sm font-bold text-gray-600">
                                {getUserInitial()}
                            </span>
                        </div>
                        {/* Name and Email Section */}
                        <div className="min-w-0">
                            {isLoading ? (
                                // Skeleton loading state
                                <div className="space-y-1.5 animate-pulse">
                                    <div className="h-3.5 bg-gray-200 rounded w-24"></div>
                                    <div className="h-3 bg-gray-200 rounded w-32"></div>
                                </div>
                            ) : (
                                // Actual user data
                                <>
                                    <p className="font-semibold text-sm text-gray-900 truncate" title={user?.name}>
                                        {user?.name || 'User'}
                                    </p>
                                    <p className="text-xs text-gray-500 truncate" title={user?.email}>
                                        {user?.email || 'No email'}
                                    </p>
                                </>
                            )}
                        </div>
                    </div>
                )}
                {/* Collapse/Expand Button */}
                 <button onClick={onToggleCollapse} className="p-1.5 rounded-full hover:bg-gray-100">
                    <ChevronLeftIcon className={`h-5 w-5 text-gray-500 transition-transform duration-300 ${collapsed ? 'rotate-180' : ''}`} />
                </button>
            </div>
            
            <div className={`p-3 shrink-0`}>
                <button 
                    onClick={onCompose}
                    className={`w-full bg-[#007aff] hover:bg-blue-600 text-white font-bold py-2.5 px-4 rounded-lg flex items-center justify-center shadow-sm hover:shadow-md transition-all ${collapsed ? 'h-10' : ''}`}
                >
                    {collapsed ? <PencilSquareIcon className="h-5 w-5" /> : <span className="text-sm">Compose</span>}
                </button>
            </div>

            <div className="flex-1 overflow-y-auto overflow-x-hidden">
                <FolderList 
                    onSelectFolder={onSelectFolder} 
                    collapsed={collapsed} 
                    unreadCounts={unreadCounts}
                />
            </div>

            <div className="p-2 mt-auto border-t space-y-1 shrink-0">
                <button 
                    onClick={onSettings}
                    className={`w-full flex items-center p-2 rounded-lg text-gray-700 hover:bg-gray-100 ${collapsed ? 'justify-center' : ''}`}
                >
                    <Cog6ToothIcon className="h-5 w-5" />
                    {!collapsed && <span className="ml-3 text-sm font-medium">Settings</span>}
                </button>
                <button onClick={handleLogout} className={`w-full flex items-center p-2 rounded-lg text-gray-700 hover:bg-red-50 hover:text-red-600 ${collapsed ? 'justify-center' : ''}`}>
                    <ArrowLeftOnRectangleIcon className="h-5 w-5" />
                    {!collapsed && <span className="ml-3 text-sm font-medium">Logout</span>}
                </button>
            </div>

        </aside>
    );
};

export default Sidebar;