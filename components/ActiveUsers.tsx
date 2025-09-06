import React, { useState, useRef, useEffect } from 'react';
import { UserSession } from '../types';

interface ActiveUsersProps {
  currentUser: UserSession;
  sessions: UserSession[];
}

// Helper to get initials and a color
const getUserAvatarProps = (userName: string) => {
    const names = userName.split(' ');
    const initials = names.length > 1
        ? `${names[0][0]}${names[names.length - 1][0]}`
        : userName.substring(0, 2);
        
    let hash = 0;
    if (userName.length === 0) return { initials: '??', color: '#ccc' };
    for (let i = 0; i < userName.length; i++) {
        hash = userName.charCodeAt(i) + ((hash << 5) - hash);
    }
    const color = `hsl(${hash % 360}, 70%, 40%)`;
    
    return { initials: initials.toUpperCase(), color };
};

// Helper to determine user status based on last seen time
const getUserStatus = (lastSeen: number) => {
    const diff = Date.now() - lastSeen;
    const AWAY_THRESHOLD = 10000; // 10 seconds

    if (diff < AWAY_THRESHOLD) {
        return { text: 'Online', colorClass: 'bg-green-500' };
    }
    return { text: 'Away', colorClass: 'bg-yellow-500' };
};


const ActiveUsers: React.FC<ActiveUsersProps> = ({ currentUser, sessions }) => {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const [, setForceUpdate] = useState(0);
    
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);
    
    // Effect to periodically re-render for status updates when the popover is open
    useEffect(() => {
        if (!isOpen) return;

        const intervalId = setInterval(() => {
            setForceUpdate(Date.now());
        }, 5000); // Re-check status every 5 seconds

        return () => clearInterval(intervalId);
    }, [isOpen]);

    // Sort so the current user is first, then alphabetically
    const sortedSessions = [...sessions].sort((a, b) => {
        if (a.sessionId === currentUser.sessionId) return -1;
        if (b.sessionId === currentUser.sessionId) return 1;
        return a.userName.localeCompare(b.userName);
    });

    return (
        <div className="relative" ref={containerRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center space-x-2 rounded-full p-1 pr-3 bg-gray-200 hover:bg-gray-300 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                aria-haspopup="true"
                aria-expanded={isOpen}
            >
                <div className="flex -space-x-2">
                    {sortedSessions.slice(0, 3).map(session => {
                         const { initials, color } = getUserAvatarProps(session.userName);
                         return (
                            <div key={session.sessionId} className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold border-2 border-white" style={{ backgroundColor: color }} title={session.userName}>
                                {initials}
                            </div>
                         );
                    })}
                </div>
                <span className="text-sm font-medium text-gray-700">{sessions.length}</span>
            </button>
            
            {isOpen && (
                <div className="absolute right-0 mt-2 w-72 bg-white rounded-lg shadow-xl z-20" role="menu">
                    <div className="p-3 border-b">
                        <h3 className="text-sm font-semibold text-gray-800">Active Sessions ({sessions.length})</h3>
                    </div>
                    <ul className="py-1 max-h-60 overflow-y-auto" role="none">
                        {sortedSessions.map(session => {
                            const { initials, color } = getUserAvatarProps(session.userName);
                            const status = getUserStatus(session.lastSeen);
                            const isCurrentUser = session.sessionId === currentUser.sessionId;
                            return (
                                <li key={session.sessionId} className="flex items-center px-3 py-2 text-sm text-gray-700" role="menuitem">
                                    <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold mr-3 flex-shrink-0" style={{ backgroundColor: color }}>
                                        {initials}
                                    </div>
                                    <div className="flex-grow truncate">
                                        <span>{session.userName}</span>
                                        {isCurrentUser && <span className="text-xs font-bold text-blue-600 ml-2">You</span>}
                                    </div>
                                    <div className="flex items-center flex-shrink-0 ml-2">
                                        <div className={`w-2.5 h-2.5 rounded-full mr-1.5 ${status.colorClass}`} title={status.text}></div>
                                        <span className="text-xs text-gray-500">{status.text}</span>
                                    </div>
                                </li>
                            );
                        })}
                    </ul>
                </div>
            )}
        </div>
    );
};

export default ActiveUsers;