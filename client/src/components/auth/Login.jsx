import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { loginUser } from '../../services/api'; 
import { useAuth } from '../../contexts/AuthContext';
import Button from '../ui/Button'; 
import Input from '../ui/Input';
import { ArrowPathIcon, ExclamationCircleIcon, LockClosedIcon, EnvelopeIcon } from '@heroicons/react/24/outline';

const Login = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const navigate = useNavigate();
    const { login } = useAuth();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        setError('');

        try {
            const response = await loginUser(email, password); // Correct API call
            const { access_token } = response.data;
            login(access_token); // Update the AuthContext
            
            navigate('/'); // Navigate to dashboard on success

        } catch (err) {
            if (err.response && (err.response.status === 401 || err.response.status === 400)) {
                setError('Invalid credentials. Please check your email and password.');
            } else {
                setError('An unexpected error occurred. Please try again.');
                console.error("Login failed:", err);
            }
        } finally {
            setIsLoading(false);
        }
    };
    
    // **CRITICAL FIX**: This function now correctly constructs the Google OAuth URL.
    const handleGoogleLogin = () => {
        const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
        const redirectUri = import.meta.env.VITE_GOOGLE_REDIRECT_URI_CLIENT;

        if (!googleClientId || !redirectUri) {
            setError("Google login is not configured correctly.");
            console.error("Missing Google OAuth environment variables on the client.");
            return;
        }

        // Define the permissions you need. `https://mail.google.com/` is for sending/reading mail.
        // `openid`, `email`, `profile` are for getting the user's identity.
        const scope = "openid profile email https://mail.google.com/";
        
        const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
        authUrl.searchParams.append('client_id', googleClientId);
        authUrl.searchParams.append('redirect_uri', redirectUri);
        authUrl.searchParams.append('response_type', 'code');
        authUrl.searchParams.append('scope', scope);
        authUrl.searchParams.append('access_type', 'offline'); 
        authUrl.searchParams.append('prompt', 'consent'); 

        window.location.href = authUrl.toString();
    };

    const handleYahooLogin = () => {
        const yahooClientId = import.meta.env.VITE_YAHOO_CLIENT_ID;
        const redirectYahooUri = import.meta.env.VITE_YAHOO_REDIRECT_URI_CLIENT;

        if (!yahooClientId || !redirectYahooUri) {
            setError("Google login is not configured correctly.");
            console.error("Missing Google OAuth environment variables on the client.");
            return;
        }

        // Define the permissions you need. `https://mail.google.com/` is for sending/reading mail.
        // `openid`, `email`, `profile` are for getting the user's identity.
        const scope = "openid profile email https://mail.yahoo.com/";
        
        const authUrl = new URL('https://accounts.yahoo.com/o/oauth2/v2/auth');
        authUrl.searchParams.append('client_id', yahooClientId);
        authUrl.searchParams.append('redirect_uri', redirectYahooUri);
        authUrl.searchParams.append('response_type', 'code');
        authUrl.searchParams.append('scope', scope);
        authUrl.searchParams.append('access_type', 'offline'); // CRITICAL: Ask for a refresh token
        authUrl.searchParams.append('prompt', 'consent'); // Recommended to ensure refresh token is always sent

        window.location.href = authUrl.toString();
    };

    return (
        <div className="max-w-md w-full">
            <div>
                <form onSubmit={handleSubmit} className="space-y-3">
                    {error && (
                        <div className="flex items-start p-4 bg-red-50 border border-red-200 rounded-lg">
                            <ExclamationCircleIcon className="h-5 w-5 text-red-500 mr-3 mt-0.5 flex-shrink-0" />
                            <div className="flex-1">
                                <h3 className="text-sm font-medium text-red-800">Authentication Error</h3>
                                <p className="text-sm text-red-700 mt-1">{error}</p>
                            </div>
                        </div>
                    )}

                    {/* Email and Password Fields (Your JSX is perfect here) */}
                    <div>
                        <label htmlFor="email" className="block text-sm font-semibold text-gray-700 mb-2">Email Address</label>
                        <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><EnvelopeIcon className="h-5 w-5 text-gray-400" /></div>
                            <Input id="email" type="email" placeholder="Enter your email" value={email} onChange={(e) => setEmail(e.target.value)} required />
                        </div>
                    </div>
                    <div>
                        <label htmlFor="password" className="block text-sm font-semibold text-gray-700 mb-2">Password</label>
                        <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><LockClosedIcon className="h-5 w-5 text-gray-400" /></div>
                            <Input id="password" type="password" placeholder="Enter your password" value={password} onChange={(e) => setPassword(e.target.value)} required />
                        </div>
                    </div>
                    
                    <div className="flex items-center justify-end">
                        <Link to="/forgot-password" className="text-sm font-medium text-blue-600 hover:text-blue-500">Forgot your password?</Link>
                    </div>

                    <Button type="submit" className="w-full ..." disabled={isLoading}>
                        {isLoading ? <><ArrowPathIcon className="h-5 w-5 animate-spin mr-2" /> Signing In...</> : 'Sign In'}
                    </Button>
                </form>

                {/* Divider and Google Login Button (Your JSX is perfect here) */}
                <div className="mt-8 relative">
                    <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-200"></div></div>
                    <div className="relative flex justify-center text-xs uppercase"><span className="px-4 bg-white text-gray-500">Or continue with</span></div>
                </div>
                <div className="mt-8">
                    <Button onClick={handleGoogleLogin} className="w-full ...">
                        <svg className="w-5 h-5 mr-3 ..." viewBox="0 0 24 24">{/* SVG paths */}</svg>
                        Continue with Google
                    </Button>
                </div>
                <div className="mt-8">
                    <Button onClick={handleYahooLogin} className="w-full ...">
                        <svg className="w-5 h-5 mr-3 ..." viewBox="0 0 24 24">{/* SVG paths */}</svg>
                        Continue with Yahoo
                    </Button>
                </div>
            </div>

            <div className="text-center mt-6">
                <p className="text-sm text-gray-600">
                    Don't have an account?{' '}
                    <Link to="/signup" className="font-semibold text-blue-600 hover:text-blue-500">Create an account</Link>
                </p>
            </div>
        </div>
    );
};

export default Login;