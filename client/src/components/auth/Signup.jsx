import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { registerUser, loginUser } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext'; 
import Button from '../ui/Button';
import Input from '../ui/Input';
import { ArrowPathIcon, ExclamationCircleIcon } from '@heroicons/react/24/outline';

const Signup = () => {
    const [name, setName] = useState('');
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
            // Step 1: Create the new user account.
            await registerUser({ name, email, password });

            // Step 2: Automatically log the new user in.
            const loginResponse = await loginUser(email, password);
            const { access_token } = loginResponse.data;

            // Step 3: Update the auth context with the new token.
            login(access_token);

            // Step 4: Navigate to the main dashboard.
            navigate('/');
            
        } catch (err) {
            if (err.response && err.response.data && err.response.data.detail) {
                setError(err.response.data.detail);
            } else {
                setError('An unexpected error occurred. Please try again.');
            }
            console.error("Signup failed:", err);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div>
            <form onSubmit={handleSubmit}>
                {error && (
                    <div className="flex items-center p-3 mb-4 bg-red-50 text-red-800 rounded-lg">
                        <ExclamationCircleIcon className="h-5 w-5 mr-3" />
                        <p className="text-sm">{error}</p>
                    </div>
                )}
                {/* Your input fields JSX is perfect */}
                <div className="mb-4">
                    <Input type="text" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} required />
                </div>
                <div className="mb-4">
                    <Input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
                </div>
                <div className="mb-6">
                    <Input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required />
                </div>

                <Button type="submit" className="w-full ..." disabled={isLoading}>
                    {isLoading ? <><ArrowPathIcon className="h-5 w-5 animate-spin mr-2" /> Creating Account...</> : 'Sign Up'}
                </Button>
            </form>
            <p className="mt-8 text-center text-sm text-gray-600">
                Already have an account?{' '}
                <Link to="/login" className="font-medium text-blue-600 hover:text-blue-500">Log in</Link>
            </p>
        </div>
    );
};

export default Signup;