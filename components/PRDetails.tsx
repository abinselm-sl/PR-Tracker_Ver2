import React, { useRef, useEffect, useState, useMemo } from 'react';
import { PurchaseRequisition, PRItem, UserRole, PRStatus } from '../types';
import { DocumentTextIcon, CheckCircleIcon, ExclamationTriangleIcon, TrashIcon, SearchIcon, ArrowPathIcon } from './icons';

// Helper function for relative time formatting
const formatRelativeTime = (timestamp: number): string => {
    const now = new Date();
    const then = new Date(timestamp);
    const diffInSeconds = Math.floor((now.getTime() - then.getTime()) / 1000);

    if (diffInSeconds < 60) return 'just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} minute${Math.floor(diffInSeconds / 60) > 1 ? 's' : ''} ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hour${Math.floor(diffInSeconds / 3600) > 1 ? 's' : ''} ago`;
    if (diffInSeconds < 2592000) return `${Math.floor(diffInSeconds / 86400)} day${Math.floor(diffInSeconds / 86400) > 1 ? 's' : ''} ago`;

    return then.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const DELAY_THRESHOLD_DAYS = 30;

const calculateDaysSince = (dateString: string): number => {
    const issueDate = new Date(dateString);
    if (isNaN(issueDate.getTime())) return 0; // Invalid date
    const today = new Date();
    // Reset time part to compare dates only
    issueDate.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);
    const diffTime = today.getTime() - issueDate.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
};

const StatusPill: React.FC<{ item: PRItem }> = ({ item }) => {
    if (item.isComplete) {
        return <span className="px-2.5 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">Completed</span>;
    }
    if (item.receivedQuantity > 0) {
        return <span className="px-2.5 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-yellow-100 text-yellow-800">Partial</span>;
    }
    return <span className="px-2.5 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-200 text-gray-800">Pending</span>;
};


interface PRDetailsProps {
  pr: PurchaseRequisition | null;
  onUpdateItem: (prId: string, itemId: string, updatedItem: Partial<PRItem>) => void;
  onDeleteRequest: (prId: string) => void;
  onReceiveAllItems: (prId: string) => void;
  onReopenPr: (prId: string) => void;
  userRole: UserRole;
}

const PRDetails: React.FC<PRDetailsProps> = ({ pr, onUpdateItem, onDeleteRequest, onReceiveAllItems, onReopenPr, userRole }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const isViewer = userRole === UserRole.Viewer;
  
  useEffect(() => {
    // Clear search when PR changes
    setSearchQuery('');
  }, [pr?.id]);

  const filteredItems = useMemo(() => {
    if (!pr) return [];
    if (!searchQuery.trim()) {
      return pr.items;
    }
    return pr.items.filter(item =>
      item.description.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [pr, searchQuery]);

  // MOVED AND FIXED: Placed before the conditional return to respect the Rules of Hooks.
  // Added a check for `pr` to prevent runtime errors.
  const areAllItemsComplete = useMemo(() => {
    if (!pr?.items) return false;
    return pr.items.every(item => item.isComplete);
  }, [pr?.items]);

  const daysSinceIssue = pr ? calculateDaysSince(pr.issueDate) : 0;
  const isDelayed = pr && pr.status === PRStatus.InProgress && daysSinceIssue > DELAY_THRESHOLD_DAYS;

  if (!pr) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-500">
        <DocumentTextIcon className="w-24 h-24 text-gray-300 mb-4" />
        <h2 className="text-2xl font-semibold">Select a Purchase Requisition</h2>
        <p>Choose a PR from the left panel to view its items.</p>
      </div>
    );
  }

  const handleQuantityChange = (itemId: string, value: string) => {
    const receivedQuantity = parseInt(value, 10) || 0;
    const originalItem = pr.items.find(item => item.id === itemId);
    if (originalItem) {
        const isComplete = receivedQuantity >= originalItem.originalQuantity;
        onUpdateItem(pr.id, itemId, { receivedQuantity, isComplete });
    }
  };

  const handleReceiveFull = (itemId: string) => {
    const originalItem = pr.items.find(item => item.id === itemId);
    if (originalItem) {
      onUpdateItem(pr.id, itemId, { receivedQuantity: originalItem.originalQuantity, isComplete: true });
    }
  };

  const handleClearReceived = (itemId: string) => {
    onUpdateItem(pr.id, itemId, { receivedQuantity: 0, isComplete: false, comment: '' });
  };


  return (
    <div className="p-6">
      <div className="flex justify-between items-start mb-6">
          <div>
            <h2 className="text-3xl font-bold text-gray-800 mb-2">{pr.name}</h2>
            <div className="space-y-1 text-sm text-gray-500">
                <p>Issued on: {pr.issueDate}</p>
                <p>Requisition by: <span className="font-medium text-gray-600">{pr.requisitionBy}</span></p>
                <p>Approved by: <span className="font-medium text-gray-600">{pr.approvedBy}</span></p>
                {pr.lastModifiedBy && (
                    <p className="text-xs text-gray-400 italic pt-1">
                        Last updated {formatRelativeTime(pr.lastModifiedBy.timestamp)} by {pr.lastModifiedBy.userName}
                    </p>
                )}
            </div>
          </div>
          <div className="flex items-center space-x-3 flex-shrink-0">
            {pr.status === PRStatus.InProgress ? (
              <button
                  onClick={() => onReceiveAllItems(pr.id)}
                  className="flex items-center bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg transition-colors shadow hover:shadow-lg disabled:bg-green-300 disabled:cursor-not-allowed"
                  aria-label={`Mark all items in ${pr.name} as received`}
                  disabled={isViewer || areAllItemsComplete}
              >
                  <CheckCircleIcon className="w-5 h-5 mr-2" />
                  Receive All
              </button>
            ) : (
               <button
                  onClick={() => onReopenPr(pr.id)}
                  className="flex items-center bg-yellow-500 hover:bg-yellow-600 text-white font-bold py-2 px-4 rounded-lg transition-colors shadow hover:shadow-lg disabled:bg-yellow-300 disabled:cursor-not-allowed"
                  aria-label={`Reopen purchase requisition ${pr.name}`}
                  disabled={isViewer}
                >
                  <ArrowPathIcon className="w-5 h-5 mr-2" />
                  Reopen PR
                </button>
            )}
            <button
                onClick={() => onDeleteRequest(pr.id)}
                className="flex items-center bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-lg transition-colors shadow hover:shadow-lg disabled:bg-red-300 disabled:cursor-not-allowed"
                aria-label={`Delete purchase requisition ${pr.name}`}
                disabled={isViewer}
            >
                <TrashIcon className="w-5 h-5 mr-2" />
                Delete PR
            </button>
          </div>
        </div>

      {isDelayed && (
        <div className="p-4 mb-4 text-sm text-yellow-800 rounded-lg bg-yellow-50 border border-yellow-200 flex items-center" role="alert">
            <ExclamationTriangleIcon className="w-5 h-5 mr-3 flex-shrink-0" />
            <div>
                <span className="font-bold">Attention Needed:</span> This PR is overdue. It was issued <span className="font-semibold">{daysSinceIssue} days ago</span> and requires follow-up.
            </div>
        </div>
      )}
      
      <div className="relative mb-4">
        <span className="absolute inset-y-0 left-0 flex items-center pl-3">
          <SearchIcon className="w-5 h-5 text-gray-400" />
        </span>
        <input
          type="text"
          placeholder="Search items by description..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent sm:text-sm"
          aria-label="Search items in this purchase requisition"
        />
      </div>

      <div className="overflow-x-auto bg-white rounded-lg shadow">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[120px]">Status</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-4/12">Item Description</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-3/12">Quantity</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-3/12">Comment</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[200px]">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredItems.length > 0 ? (
                filteredItems.map((item) => {
                const isPartial = !item.isComplete && item.receivedQuantity > 0;
                const progress = item.originalQuantity > 0 ? (item.receivedQuantity / item.originalQuantity) * 100 : 0;
                return (
                <tr 
                    key={item.id} 
                    className={`transition-colors ${
                        item.isComplete 
                            ? 'bg-green-50/70' 
                            : isPartial 
                                ? 'bg-yellow-50/70' 
                                : 'bg-white'
                        }`}
                    title={item.lastModifiedBy ? `Last updated by ${item.lastModifiedBy.userName} on ${new Date(item.lastModifiedBy.timestamp).toLocaleString()}` : ''}
                >
                    <td className="px-6 py-4 whitespace-nowrap">
                        <StatusPill item={item} />
                    </td>
                    <td className="px-6 py-4 whitespace-normal text-sm font-medium text-gray-800">
                        <span className={item.isComplete ? 'text-gray-500 line-through' : ''}>
                        {item.description}
                        </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                      <div className="flex items-center">
                          <input
                              type="number"
                              value={item.receivedQuantity}
                              onChange={(e) => handleQuantityChange(item.id, e.target.value)}
                              min="0"
                              max={item.originalQuantity}
                              disabled={item.isComplete || isViewer}
                              className={`w-20 shadow-sm focus:ring-blue-500 focus:border-blue-500 block sm:text-sm border-gray-300 rounded-md text-center ${(item.isComplete || isViewer) ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                              aria-label={`Received quantity for ${item.description}`}
                          />
                          <span className="mx-2">/</span>
                          <span>{item.originalQuantity}</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                        <div 
                          className={`h-2 rounded-full ${item.isComplete ? 'bg-green-500' : 'bg-blue-500'}`} 
                          style={{ width: `${progress}%` }}
                        ></div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                    <input
                        type="text"
                        value={item.comment}
                        onChange={(e) => onUpdateItem(pr.id, item.id, { comment: e.target.value })}
                        placeholder="Add a comment..."
                        disabled={item.isComplete || isViewer}
                        className={`w-full shadow-sm focus:ring-blue-500 focus:border-blue-500 block sm:text-sm border-gray-300 rounded-md ${(item.isComplete || isViewer) ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                    />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex items-center space-x-2">
                          <button
                            onClick={() => handleReceiveFull(item.id)}
                            disabled={item.isComplete || isViewer}
                            className="flex items-center justify-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 disabled:bg-green-300 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                            title="Mark as fully received"
                          >
                            <CheckCircleIcon className="w-4 h-4 mr-1.5" />
                            Receive Full
                          </button>
                          <button
                            onClick={() => handleClearReceived(item.id)}
                            disabled={item.receivedQuantity === 0 || isViewer}
                            className="flex items-center justify-center p-2 border border-gray-300 text-xs font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50 disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                            title="Clear received quantity"
                          >
                             <ArrowPathIcon className="w-4 h-4" />
                          </button>
                      </div>
                    </td>
                </tr>
                )
              })
            ) : (
                <tr>
                    <td colSpan={5} className="text-center py-10 text-gray-500 italic">
                        {pr.items.length > 0 ? 'No items match your search.' : 'This PR has no items.'}
                    </td>
                </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default PRDetails;