import React from 'react';
import Signup from '../components/auth/Signup';

const SignupPage = () => {
    return (
        <div className="min-h-screen bg-gray-50 flex flex-col justify-center items-center p-4">
            <div className="max-w-md w-full mx-auto">
                <div className="text-center mb-8">
                    <h2 className="text-3xl font-extrabold text-gray-900">
                        Create a new account
                    </h2>
                </div>
                <div className="bg-white p-8 rounded-lg shadow-lg w-full">
                    <Signup />
                </div>
            </div>
        </div>
    );
};

export default SignupPage;