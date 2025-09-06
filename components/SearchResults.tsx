import React from 'react';
import { PRItem } from '../types';
import { SearchIcon, DocumentTextIcon, CheckCircleIcon, ExclamationTriangleIcon } from './icons';

interface SearchResult {
    item: PRItem;
    prName: string;
    prId: string;
}

interface SearchResultsProps {
    results: SearchResult[];
    onSelectPr: (prId: string) => void;
}

const SearchResults: React.FC<SearchResultsProps> = ({ results, onSelectPr }) => {
    const getItemStatus = (item: PRItem) => {
        if (item.isComplete) {
            return {
                text: 'Completed',
                icon: <CheckCircleIcon className="w-5 h-5 text-green-500 mr-2" />,
                textColor: 'text-green-600',
            };
        }
        if (item.receivedQuantity > 0) {
            return {
                text: `Partially Received (${item.receivedQuantity}/${item.originalQuantity})`,
                icon: <ExclamationTriangleIcon className="w-5 h-5 text-yellow-500 mr-2" />,
                textColor: 'text-yellow-600',
            };
        }
        return {
            text: `Pending (${item.receivedQuantity}/${item.originalQuantity})`,
            icon: <DocumentTextIcon className="w-5 h-5 text-gray-500 mr-2" />,
            textColor: 'text-gray-600',
        };
    };

    if (results.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-gray-500 p-6">
                <SearchIcon className="w-24 h-24 text-gray-300 mb-4" />
                <h2 className="text-2xl font-semibold">No Matching Items Found</h2>
                <p>Try refining your search terms to find the item you're looking for.</p>
            </div>
        );
    }
    
    return (
        <div className="p-6">
            <h2 className="text-2xl font-bold text-gray-800 mb-4">
                Found {results.length} matching item(s)
            </h2>
            <div className="overflow-x-auto bg-white rounded-lg shadow">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-5/12">Item Description</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-4/12">Purchase Requisition</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-3/12">Status</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {results.map(({ item, prName, prId }) => {
                            const status = getItemStatus(item);
                            return (
                                <tr key={item.id} className="hover:bg-gray-50">
                                    <td className="px-6 py-4 whitespace-normal text-sm font-medium text-gray-800">{item.description}</td>
                                    <td className="px-6 py-4 whitespace-normal text-sm text-gray-600">
                                        <button
                                            onClick={() => onSelectPr(prId)}
                                            className="text-blue-600 hover:text-blue-800 hover:underline font-medium"
                                        >
                                            {prName}
                                        </button>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                                        <div className={`flex items-center ${status.textColor}`}>
                                            {status.icon}
                                            <span className="font-semibold">{status.text}</span>
                                        </div>
                                    </td>
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default SearchResults;