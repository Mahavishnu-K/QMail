/* START OF MODIFIED FILE: FolderList.jsx */

import React, { useState } from 'react';
import {
    InboxIcon,
    StarIcon,
    ClockIcon,
    PaperAirplaneIcon,
    DocumentDuplicateIcon,
    TagIcon,
    CalendarDaysIcon,
    ArchiveBoxIcon,
    ExclamationCircleIcon,
    TrashIcon
} from '@heroicons/react/24/outline';

const staticFolders = [
    { id: 'inbox', name: 'Inbox', icon: InboxIcon },
    { id: 'starred', name: 'Starred', icon: StarIcon },
    { id: 'snoozed', name: 'Snoozed', icon: ClockIcon },
    { id: 'sent', name: 'Sent', icon: PaperAirplaneIcon },
    { id: 'drafts', name: 'Drafts', icon: DocumentDuplicateIcon },
    { id: 'important', name: 'Important', icon: TagIcon },
    { id: 'scheduled', name: 'Scheduled', icon: CalendarDaysIcon },
    { id: 'archive', name: 'Archive', icon: ArchiveBoxIcon },
    { id: 'spam', name: 'Spam', icon: ExclamationCircleIcon },
    { id: 'trash', name: 'Trash', icon: TrashIcon },
];

const FolderList = ({ onSelectFolder, collapsed, unreadCounts }) => {
    const [activeFolder, setActiveFolder] = useState('inbox');

    const handleFolderClick = (folderId) => {
        setActiveFolder(folderId);
        onSelectFolder(folderId);
    };

    return (
        <nav className="px-3 py-2">
            <ul>
                {staticFolders.map(folder => {
                    const Icon = folder.icon;
                    const count = unreadCounts ? unreadCounts[folder.id] : 0;

                    return (
                        <li key={folder.id} className="mb-1 relative group">
                            <a 
                                href="#" 
                                onClick={(e) => { e.preventDefault(); handleFolderClick(folder.id); }}
                                className={`flex items-center px-3 py-2 rounded-md transition-all duration-200 ease-in-out ${ 
                                    activeFolder === folder.id 
                                    ? 'bg-[#007aff25] text-gray-700 shadow-sm' 
                                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                                } ${collapsed ? 'justify-center' : ''}`}
                            >
                                {Icon && <Icon className={`h-5 w-5 shrink-0 ${!collapsed ? 'mr-3' : ''}`} />}
                                {!collapsed && (
                                    <>
                                        <span className="truncate text-sm font-medium flex-1">{folder.name}</span>
                                        {count > 0 && (
                                            <span className="ml-2 text-xs font-bold text-blue-600 rounded-full px-2 py-0.5">
                                                {count}
                                            </span>
                                        )}
                                    </>
                                )}
                            </a>
                            {collapsed && (
                                <div className="absolute left-full top-1/2 -translate-y-1/2 ml-3 px-2 py-1 bg-gray-800 text-white text-xs rounded-md opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-20">
                                    {folder.name}
                                </div>
                            )}
                        </li>
                    );
                })}
            </ul>
        </nav>
    );
};

export default FolderList;