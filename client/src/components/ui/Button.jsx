import React from 'react';

const Button = ({ children, onClick, type = 'button', className = '' }) => {
    return (
        <button
            type={type}
            onClick={onClick}
            className={`font-bold py-2 px-4 rounded-lg focus:outline-none focus:shadow-outline transition-all duration-200 ${className}`}
        >
            {children}
        </button>
    );
};

export default Button;