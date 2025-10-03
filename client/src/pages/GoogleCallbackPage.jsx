// src/pages/GoogleCallbackPage.jsx
import React, { useEffect, useState, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { apiClient } from '../services/api'; // Use the API service

const handleGoogleSignIn = (code) => {
    return apiClient.post('/auth/google/login', { code });
};


const GoogleCallbackPage = () => {
    const [error, setError] = useState('');
    const [status, setStatus] = useState('Authenticating with Google, please wait...');
    const location = useLocation();
    const navigate = useNavigate();
    const { login } = useAuth(); 
    const processing = useRef(false);

    useEffect(() => {
        if (processing.current) return;

        const processCallback = async () => {
            processing.current = true;
            const params = new URLSearchParams(location.search);
            const code = params.get('code');

            if (!code) {
                setError('Authentication failed: No authorization code provided by Google.');
                setStatus('Authentication Failed');
                return;
            }

            try {
                // Send the one-time code to YOUR backend server
                const response = await handleGoogleSignIn(code);

                // This logic needs to differentiate between SIGNING IN and LINKING ACCOUNT
                // For a hackathon, we can assume it's for SIGNING IN.
                const { access_token } = response.data;
                if (access_token) {
                    setStatus('Successfully authenticated! Redirecting...');
                    login(access_token); // Update auth state
                    navigate('/'); // Go to the dashboard
                } else {
                    throw new Error('No access token received from server.');
                }
            } catch (err) {
                setError('An error occurred during authentication with our server. Please try again.');
                setStatus('Authentication Failed');
                console.error(err);
            }
        };

        processCallback();
    }, [location, navigate, login]);

    return (
        <div className="h-screen flex flex-col items-center justify-center">
            <p>{status}</p>
            {error && (
                <>
                    <p className="text-red-500 mt-2">{error}</p>
                    <button onClick={() => navigate('/login')} className="mt-4 text-blue-500">
                        Return to Login
                    </button>
                </>
            )}
        </div>
    );
};

export default GoogleCallbackPage;