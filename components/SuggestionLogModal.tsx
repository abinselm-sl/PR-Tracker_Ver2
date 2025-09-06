import React, { useState, useMemo } from 'react';
import { SuggestionLogEntry, UserSession, UserRole, SuggestionStatus } from '../types';
import { XMarkIcon, TrashIcon } from './icons';

interface LogEntryRowProps {
    entry: SuggestionLogEntry;
    isEditable: boolean;
    onUpdate: (id: string, updates: Partial<SuggestionLogEntry>) => void;
    onDelete: (id: string) => void;
}

const LogEntryRow: React.FC<LogEntryRowProps> = ({ entry, isEditable, onUpdate, onDelete }) => {
    const [status, setStatus] = useState(entry.status);
    const [comments, setComments] = useState(entry.adminComments);

    const handleSave = () => {
        onUpdate(entry.id, { status, adminComments: comments });
    };

    const getStatusColor = (status: SuggestionStatus) => {
        switch (status) {
            case SuggestionStatus.Pending: return 'bg-yellow-100 text-yellow-800';
            case SuggestionStatus.Reviewed: return 'bg-blue-100 text-blue-800';
            case SuggestionStatus.Done: return 'bg-green-100 text-green-800';
            default: return 'bg-gray-100 text-gray-800';
        }
    };
    
    return (
        <tr className="border-b last:border-b-0">
            <td className="p-3 align-top">
                <p className="font-semibold">{entry.userName}</p>
                <p className="text-xs text-gray-500">{new Date(entry.timestamp).toLocaleString()}</p>
            </td>
            <td className="p-3 align-top whitespace-pre-wrap text-sm">{entry.note}</td>
            <td className="p-3 align-top">
                {isEditable ? (
                    <select
                        value={status}
                        onChange={(e) => setStatus(e.target.value as SuggestionStatus)}
                        className={`w-full p-1.5 rounded-md border-gray-300 text-sm ${getStatusColor(status)}`}
                    >
                        {Object.values(SuggestionStatus).map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                ) : (
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(entry.status)}`}>
                        {entry.status}
                    </span>
                )}
            </td>
            <td className="p-3 align-top">
                {isEditable ? (
                    <textarea
                        value={comments}
                        onChange={(e) => setComments(e.target.value)}
                        rows={2}
                        className="w-full p-2 border rounded-md text-sm"
                        placeholder="Add comments..."
                    />
                ) : (
                    <p className="text-sm text-gray-700">{entry.adminComments || '—'}</p>
                )}
            </td>
            {isEditable && (
                <td className="p-3 align-top">
                    <div className="flex flex-col space-y-2">
                        <button
                            onClick={handleSave}
                            className="bg-blue-600 text-white px-3 py-1 text-sm rounded hover:bg-blue-700"
                        >
                            Save
                        </button>
                        <button
                            onClick={() => onDelete(entry.id)}
                            className="bg-red-100 text-red-700 px-3 py-1 text-sm rounded hover:bg-red-200 flex items-center justify-center"
                        >
                           <TrashIcon className="w-4 h-4 mr-1"/> Delete
                        </button>
                    </div>
                </td>
            )}
        </tr>
    );
};


interface SuggestionLogModalProps {
    isOpen: boolean;
    onClose: () => void;
    log: SuggestionLogEntry[];
    currentUser: UserSession;
    onUpdateLogEntry: (id: string, updates: Partial<SuggestionLogEntry>) => void;
    onDeleteLogEntry: (id: string) => void;
}

const SuggestionLogModal: React.FC<SuggestionLogModalProps> = ({ isOpen, onClose, log, currentUser, onUpdateLogEntry, onDeleteLogEntry }) => {
    if (!isOpen) return null;

    const isAdmin = currentUser.role === UserRole.Admin;
    const displayedLog = useMemo(() => {
        return isAdmin ? log : log.filter(entry => entry.userName === currentUser.userName);
    }, [log, isAdmin, currentUser.userName]);

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center p-4" aria-modal="true" role="dialog">
            <div className="bg-white rounded-lg shadow-2xl w-full max-w-6xl h-full max-h-[90vh] flex flex-col">
                <div className="flex justify-between items-center p-4 border-b">
                    <h2 className="text-xl font-bold text-gray-900">Suggestion Log</h2>
                    <button
                        type="button"
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600 transition-colors"
                        aria-label="Close modal"
                    >
                        <XMarkIcon className="w-7 h-7" />
                    </button>
                </div>

                <div className="overflow-y-auto flex-1">
                    {displayedLog.length === 0 ? (
                        <p className="p-6 text-center text-gray-500 italic">
                            {isAdmin ? 'No suggestions have been submitted yet.' : 'You have not submitted any suggestions.'}
                        </p>
                    ) : (
                        <table className="min-w-full text-left text-sm">
                            <thead className="border-b bg-gray-50 sticky top-0">
                                <tr>
                                    <th className="p-3 w-1/6">From</th>
                                    <th className="p-3 w-2/5">Suggestion Note</th>
                                    <th className="p-3 w-1/6">Status</th>
                                    <th className="p-3 w-1/4">Admin Comments</th>
                                    {isAdmin && <th className="p-3 w-[120px]">Actions</th>}
                                </tr>
                            </thead>
                            <tbody>
                                {displayedLog.map(entry => (
                                    <LogEntryRow 
                                        key={entry.id}
                                        entry={entry}
                                        isEditable={isAdmin}
                                        onUpdate={onUpdateLogEntry}
                                        onDelete={onDeleteLogEntry}
                                    />
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        </div>
    );
};

export default SuggestionLogModal;