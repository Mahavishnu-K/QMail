import React, { createContext, useState, useEffect, useContext } from 'react';
import { getAuthToken, removeAuthToken, setAuthToken as setTokenInStorage } from '../utils/auth';
import { apiClient } from '../services/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [token, setToken] = useState(getAuthToken());
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchUser = async () => {
            if (!token) {
                setUser(null);
                setIsLoading(false);
                return;
            }

            try {
                apiClient.defaults.headers.common['Authorization'] = `Bearer ${token}`;
                const response = await apiClient.get('/auth/me');
                setUser(response.data);
            } catch (err) {
                console.error('Failed to fetch user, token may be invalid:', err);
                setUser(null);
                removeAuthToken();
                setToken(null);
            } finally {
                setIsLoading(false);
            }
        };

        fetchUser();
    }, [token]);

    const login = (newToken) => {
        setTokenInStorage(newToken);
        setToken(newToken);
        setIsLoading(true);
    };

    const logout = () => {
        setUser(null);
        setToken(null);
        removeAuthToken();
    };

    const value = { user, token, login, logout, isLoading, isAuthenticated: !!token };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    return useContext(AuthContext);
};