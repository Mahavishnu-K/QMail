// src/pages/SettingsPage.jsx

import React, { useState, useEffect } from 'react';
import { apiClient } from '../services/api';
import { PlusCircleIcon, TrashIcon } from '@heroicons/react/24/outline';

const SettingsPage = ({ onClose }) => {
    const [linkedAccounts, setLinkedAccounts] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        const fetchAccounts = async () => {
            try {
                const response = await apiClient.get('/accounts/linked');
                setLinkedAccounts(response.data);
            } catch (err) {
                setError('Failed to load linked accounts.');
            } finally {
                setIsLoading(false);
            }
        };
        fetchAccounts();
    }, []);

    const handleLinkGoogleAccount = async () => {
        try {
            const response = await apiClient.get('/auth/google/link-url');
            const { authorization_url } = response.data;
            window.location.href = authorization_url;
        } catch (err) {
            setError('Could not initiate Google account link. Please try again.');
        }
    };

    const handleRemoveLinkedAccount = async (accountId) => {
        const originalAccounts = [...linkedAccounts];
        setLinkedAccounts(prevAccounts => prevAccounts.filter(acc => acc.id != accountId));
        setError('');
        try{
            await apiClient.delete(`/accounts/${accountId}`);
        } catch (err) {
            setError('Failed to remove linked account');
            setLinkedAccounts(originalAccounts);
        }
    };

    return (
        <div className="flex-1 p-8 bg-gray-50">
            <div className="max-w-4xl mx-auto">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-bold text-gray-800">Account Settings</h2>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-800">&times;</button>
                </div>

                <div className="bg-white p-6 rounded-lg shadow-sm">
                    <h3 className="text-lg font-semibold text-gray-900 border-b pb-3 mb-4">Linked Mailboxes</h3>
                    {isLoading && <p>Loading accounts...</p>}
                    {error && <p className="text-red-500">{error}</p>}
                    
                    <ul className="space-y-3 mb-6">
                        {linkedAccounts.map(account => (
                            <li key={account.id} className="p-3 bg-gray-100 rounded-md flex items-center justify-between">
                                <span className="font-medium text-gray-700">{account.email_address}</span>
                                <div className="flex gap-2">
                                    <span className="text-base text-gray-500 capitalize">{account.provider}</span>
                                    <button onClick={() => handleRemoveLinkedAccount(account.id)} title="Remove this account">
                                        <TrashIcon className="w-5 h-auto text-gray-500"/>
                                    </button>
                                </div>
                            </li>
                        ))}
                    </ul>

                    <button
                        onClick={handleLinkGoogleAccount}
                        className="w-full flex items-center justify-center p-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition"
                    >
                        <PlusCircleIcon className="h-5 w-5 mr-2" />
                        Link a New Google Account
                    </button>
                     
                </div>
            </div>
        </div>
    );
};

export default SettingsPage;