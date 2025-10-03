import { useEffect, useState } from 'react';
import { Navigate, Route, BrowserRouter as Router, Routes } from 'react-router-dom';
import { Outlet, useNavigate } from 'react-router-dom';
import AppLayout from './components/layout/AppLayout';

import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import GoogleCallbackPage from './pages/GoogleCallbackPage';
import DashboardPage from './pages/Dashboard';
import ComposePage from './pages/ComposePage';
import SettingsPage from './pages/SettingsPage';
import { AuthProvider, useAuth } from './contexts/AuthContext';


const ProtectedRoute = ({ children }) => {
    const { isAuthenticated, isLoading } = useAuth();
    if (isLoading) {
        return <div className="h-screen flex items-center justify-center">Loading...</div>;
    }
    return isAuthenticated ? children : <Navigate to="/login" />;
};

const AppRoutes = () => {
    const { isAuthenticated, isLoading } = useAuth();

    // Show a global loading screen while the app is verifying the auth token.
    if (isLoading) {
        return <div className="h-screen flex items-center justify-center">Loading Application...</div>;
    }

    return (
        <Routes>
            <Route path="/login" element={!isAuthenticated ? <LoginPage /> : <Navigate to="/" />} />
            <Route path="/signup" element={!isAuthenticated ? <SignupPage /> : <Navigate to="/" />} />
            <Route path="/auth/google/callback" element={<GoogleCallbackPage />} />

            {/* All protected routes are nested here */}
            <Route 
                path="/*"
                element={
                    <ProtectedRoute>
                        <AppLayout />
                    </ProtectedRoute>
                }
            >
                {/* The default route inside the layout will be the inbox */}
                <Route index element={<Navigate to="/folder/inbox" replace />} />
                <Route path="folder/:folderId" element={<DashboardPage />} />
                <Route path="compose" element={<ComposePage />} />
                <Route path="settings" element={<SettingsPage />} />
            </Route>
        </Routes>
    );
};

const App = () => {
    return (
        <Router>
            <AuthProvider>
                <AppRoutes />
            </AuthProvider>
        </Router>
    );
};

export default App;