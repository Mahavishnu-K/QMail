import React from 'react';

const securityLevels = [
    { id: 'LEVEL_1_OTP', name: 'Level 1: Quantum Secure (OTP)', desc: 'Unbreakable. For short, critical messages.' },
    { id: 'LEVEL_2_MF_AES', name: 'Level 2: Quantum-Aided (MF-QKD)', desc: 'Gold standard security for any message.' },
    { id: 'LEVEL_3_PQC', name: 'Level 3: Post-Quantum Ready', desc: 'Quantum-resistant for offline users.' },
    { id: 'LEVEL_4_BB84_AES', name: 'Level 4: Standard Quantum (BB84)', desc: 'Provably secure baseline.' },
    { id: 'LEVEL_5_NONE', name: 'Level 5: No Security', desc: 'Standard unencrypted email.' },
];

const SecurityDropdown = ({ selectedLevel, onLevelChange, disabled, isRecipientQuMailUser }) => {
    return (
        <div className="relative">
            <select
                value={selectedLevel}
                onChange={(e) => onLevelChange(e.target.value)}
                disabled={disabled}
                className="w-full p-3 border border-gray-300 rounded-lg appearance-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
            >
                {!isRecipientQuMailUser && <option value="LEVEL_5_NONE">Level 5: No Security</option>}
                {isRecipientQuMailUser && securityLevels.map(level => (
                    <option key={level.id} value={level.id}>
                        {level.name}
                    </option>
                ))}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700">
                <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M5.516 7.548c.436-.446 1.144-.446 1.584 0L10 10.404l2.9-2.856c.44-.446 1.148-.446 1.584 0 .44.446.44 1.152 0 1.596L10.78 12.8l-3.68-3.656c-.44-.446-.44-1.152 0-1.596z"/></svg>
            </div>
        </div>
    );
};

export default SecurityDropdown;