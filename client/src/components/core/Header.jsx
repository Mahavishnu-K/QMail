import React, { useState, useEffect, useRef } from 'react'; 
import { BellIcon } from '@heroicons/react/24/outline';
import { usePendingSession } from '../../contexts/PendingContext';
import PendingRequestNotification from './PendingNotification';

const Header = () => {
    const [isPanelOpen, setIsPanelOpen] = useState(false);
    const { pendingRequests } = usePendingSession();
    const panelRef = useRef(null); 

    // --- ENHANCEMENT: Logic to close the panel when clicking outside ---
    useEffect(() => {
        // Function to handle the click
        const handleClickOutside = (event) => {
            // If the panel is open and the click is outside the panel's ref, close it
            if (panelRef.current && !panelRef.current.contains(event.target)) {
                setIsPanelOpen(false);
            }
        };

        // Add the event listener when the component mounts
        document.addEventListener('mousedown', handleClickOutside);

        // Return a cleanup function to remove the listener when the component unmounts
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []); 

    return (
        // --- FIX #1: Make the header a positioned element with a z-index ---
        <header className="relative z-10 bg-white py-2 px-4 flex items-center justify-end border-b border-gray-200 h-16 shrink-0">
            
            {/* --- FIX #2: Attach the ref to the dropdown container --- */}
            <div className="relative" ref={panelRef}>
                <button
                    onClick={() => setIsPanelOpen(prev => !prev)}
                    className="relative p-2 text-gray-500 rounded-full hover:bg-gray-100 hover:text-gray-700 focus:outline-none"
                >
                    <BellIcon className="h-6 w-6" />
                    {pendingRequests.length > 0 && (
                        <span className="absolute top-1.5 right-1.5 flex h-2.5 w-2.5">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
                        </span>
                    )}
                </button>

                {/* The Dropdown Panel */}
                {isPanelOpen && (
                    <PendingRequestNotification 
                        onClose={() => setIsPanelOpen(false)} 
                    />
                )}
            </div>
        </header>
    );
};

export default Header;