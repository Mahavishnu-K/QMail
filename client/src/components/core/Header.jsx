/* START OF MODIFIED FILE: src/components/core/Header.jsx */

import React from 'react';
import { MagnifyingGlassIcon, AdjustmentsHorizontalIcon } from '@heroicons/react/24/outline';

const Header = () => {
    return (
        <header className="bg-white px-4 py-2 flex items-center border-b border-gray-200 h-16 shrink-0 gap-4">
            
            <div className="relative flex-1">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
                </div>
                <input 
                    type="text"
                    placeholder="Search mail..."
                    className="w-full bg-gray-100 border-transparent rounded-lg py-2 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white text-sm"
                />
            </div>

            <button className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500">
                <AdjustmentsHorizontalIcon className="h-5 w-5" />
            </button>
            
        </header>
    );
};

export default Header;