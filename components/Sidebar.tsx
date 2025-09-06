import React, { useState, useMemo } from 'react';
import { ArchiveBoxIcon, ChevronDownIcon, InboxStackIcon, SearchIcon, TrashIcon, CheckCircleIcon, ExclamationTriangleIcon } from './icons';
import { PurchaseRequisition, UserRole } from '../types';

export type InProgressFilterType = 'all' | 'partial' | 'new';
export type SortOrder = 'date-desc' | 'date-asc' | 'name-asc';

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

const FilterButton: React.FC<{
  label: string;
  isActive: boolean;
  value: InProgressFilterType;
  onClick: (value: InProgressFilterType) => void;
}> = ({ label, isActive, value, onClick }) => (
  <button
    onClick={() => onClick(value)}
    className={`px-2.5 py-1 text-xs font-medium rounded-full transition-colors ${
      isActive
        ? 'bg-blue-600 text-white'
        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
    }`}
  >
    {label}
  </button>
);

interface CollapsibleSectionProps {
  icon: React.ReactNode;
  label: string;
  count: number;
  prs: PurchaseRequisition[];
  selectedPrId: string | null;
  onSelectPr: (id: string) => void;
  selection: Set<string>;
  onSelectionToggle: (id: string) => void;
  sectionType: 'in-progress' | 'completed';
  userRole: UserRole;
  filters?: { label: string; value: string }[];
  activeFilter?: string;
  onFilterChange?: (filter: InProgressFilterType) => void;
}

const CollapsibleSection: React.FC<CollapsibleSectionProps> = ({ icon, label, count, prs, selectedPrId, onSelectPr, selection, onSelectionToggle, sectionType, userRole, filters, activeFilter, onFilterChange }) => {
    const [isExpanded, setIsExpanded] = useState(label === 'In Progress'); // Default open for In Progress
    const isViewer = userRole === UserRole.Viewer;

    return (
        <div>
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="w-full flex items-center px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-200 hover:text-gray-900 rounded-md transition-colors"
                aria-expanded={isExpanded}
            >
                {icon}
                <span className="flex-1 truncate text-left font-semibold">{label}</span>
                <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-gray-300 text-gray-700">
                    {count}
                </span>
                <ChevronDownIcon className={`w-5 h-5 ml-2 transform transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
            </button>
            <div className={`overflow-hidden transition-all duration-300 ease-in-out grid ${isExpanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
              <div className="min-h-0">
                  {filters && onFilterChange && (
                      <div className="px-3 pt-3 pb-1 flex items-center space-x-2">
                          {filters.map(filter => (
                              <FilterButton 
                                  key={filter.value}
                                  label={filter.label} 
                                  isActive={activeFilter === filter.value} 
                                  value={filter.value as InProgressFilterType}
                                  onClick={onFilterChange} />
                          ))}
                      </div>
                  )}
                  <div className="pt-2 space-y-1 pb-2">
                      {prs.length > 0 ? prs.map(pr => {
                        const isCompleted = sectionType === 'completed';
                        const isPartial = !isCompleted && pr.items.some(item => item.receivedQuantity > 0);
                        const daysSinceIssue = calculateDaysSince(pr.issueDate);
                        const isDelayed = !isCompleted && daysSinceIssue > DELAY_THRESHOLD_DAYS;

                        const getTitle = () => {
                          const parts = [];
                          if (isDelayed) {
                            parts.push(`Delayed: ${daysSinceIssue} days old.`);
                          }
                          if (pr.lastModifiedBy) {
                            parts.push(`Last updated by ${pr.lastModifiedBy.userName} on ${new Date(pr.lastModifiedBy.timestamp).toLocaleString()}`);
                          }
                          return parts.join(' ');
                        };

                        const getBackgroundColorClass = () => {
                            if (selectedPrId === pr.id) {
                                if (isCompleted) return 'bg-green-100';
                                if (isDelayed) return 'bg-yellow-200';
                                return 'bg-blue-100';
                            }
                            // Not selected
                            if (isCompleted) return 'hover:bg-green-50';
                            if (isDelayed) return 'bg-yellow-50 hover:bg-yellow-100';
                            if (isPartial) return 'bg-sky-50 hover:bg-sky-100';
                            return 'hover:bg-gray-200';
                        };

                        const getTextColorClass = () => {
                            if (selectedPrId === pr.id) {
                                if (isCompleted) return 'text-green-800 font-semibold';
                                if (isDelayed) return 'text-yellow-900 font-semibold';
                                return 'text-blue-800 font-semibold';
                            }
                            // Not selected
                            if (isCompleted) return 'text-gray-600';
                            if (isDelayed) return 'text-yellow-800';
                            if (isPartial) return 'text-sky-800';
                            return 'text-gray-700';
                        };

                        return (
                        <div
                            key={pr.id}
                            onClick={() => onSelectPr(pr.id)}
                            className={`group flex items-center justify-between rounded-md transition-colors cursor-pointer mx-2 ${getBackgroundColorClass()}`}
                            title={getTitle()}
                        >
                            <div className="flex items-center flex-1 truncate pl-2">
                                {!isViewer && (
                                    <input
                                        type="checkbox"
                                        checked={selection.has(pr.id)}
                                        onChange={() => onSelectionToggle(pr.id)}
                                        onClick={(e) => e.stopPropagation()}
                                        className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 cursor-pointer"
                                        aria-label={`Select ${pr.name}`}
                                    />
                                )}
                                {isCompleted && <CheckCircleIcon className="w-4 h-4 text-green-600 ml-3 flex-shrink-0" />}
                                {isDelayed && <ExclamationTriangleIcon className="w-4 h-4 text-yellow-600 ml-3 flex-shrink-0" title={`Delayed: ${daysSinceIssue} days old`}/>}
                                
                                <span className={`flex-1 text-sm truncate py-1.5 ${isCompleted || isDelayed ? 'ml-2' : 'ml-3'} ${getTextColorClass()}`}>
                                    {pr.name}
                                </span>
                            </div>
                             <span className="text-xs text-gray-500 flex-shrink-0 ml-2 pr-2">
                                {pr.issueDate}
                            </span>
                        </div>
                        )
                      }) : (
                          <p className="px-3 py-1.5 text-sm text-gray-500 italic">No requisitions found.</p>
                      )}
                  </div>
              </div>
            </div>
        </div>
    );
};


interface SidebarProps {
  inProgressPrs: PurchaseRequisition[];
  completedPrs: PurchaseRequisition[];
  selectedPrId: string | null;
  onSelectPr: (id: string) => void;
  selection: Set<string>;
  onSelectionToggle: (id: string) => void;
  onRequestDeleteSelection: () => void;
  userRole: UserRole;
}

const Sidebar: React.FC<SidebarProps> = ({ inProgressPrs, completedPrs, selectedPrId, onSelectPr, selection, onSelectionToggle, onRequestDeleteSelection, userRole }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [inProgressFilter, setInProgressFilter] = useState<InProgressFilterType>('all');
  const [sortOrder, setSortOrder] = useState<SortOrder>('date-desc'); // Default to newest first

  const handleFilterChange = (filter: InProgressFilterType) => {
    setInProgressFilter(filter);
  };

  const inProgressFilters = [
    { label: 'All', value: 'all' },
    { label: 'Partial', value: 'partial' },
    { label: 'New', value: 'new' },
  ];

  const sortAndFilter = (prs: PurchaseRequisition[], filterFn: (pr: PurchaseRequisition) => boolean) => {
    // 1. Filter by search query
    let filtered = prs.filter(pr =>
        pr.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    // 2. Apply additional filtering (e.g., in-progress status)
    filtered = filtered.filter(filterFn);

    // 3. Sort the results
    return [...filtered].sort((a, b) => {
        switch (sortOrder) {
            case 'name-asc':
                return a.name.localeCompare(b.name);
            case 'date-asc':
                // The issueDate is MM/DD/YYYY, so new Date() should parse it correctly
                return new Date(a.issueDate).getTime() - new Date(b.issueDate).getTime();
            case 'date-desc':
            default:
                return new Date(b.issueDate).getTime() - new Date(a.issueDate).getTime();
        }
    });
  };

  const sortedInProgressPrs = useMemo(() => {
    return sortAndFilter(inProgressPrs, (pr) => {
        if (inProgressFilter === 'partial') {
            return pr.items.some(item => item.receivedQuantity > 0);
        } else if (inProgressFilter === 'new') {
            return pr.items.every(item => item.receivedQuantity === 0);
        }
        return true; // 'all' filter
    });
  }, [inProgressPrs, searchQuery, inProgressFilter, sortOrder]);

  const sortedCompletedPrs = useMemo(() => {
      // Completed PRs have no extra filters, just search and sort
      return sortAndFilter(completedPrs, () => true);
  }, [completedPrs, searchQuery, sortOrder]);

  return (
    <div className="w-80 bg-gray-100 p-3 flex-shrink-0 h-full overflow-y-auto border-r border-gray-200">
        <div className="relative mb-3">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3">
            <SearchIcon className="w-5 h-5 text-gray-400" />
          </span>
          <input
            type="text"
            placeholder="Search PRs by name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent sm:text-sm"
            aria-label="Search purchase requisitions"
          />
        </div>
        
        <div className="mb-3">
          <label htmlFor="sort-order" className="sr-only">Sort by</label>
          <select
              id="sort-order"
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value as SortOrder)}
              className="w-full pl-3 pr-8 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent sm:text-sm bg-white"
              aria-label="Sort purchase requisitions"
          >
              <option value="date-desc">Sort by: Date (Newest first)</option>
              <option value="date-asc">Sort by: Date (Oldest first)</option>
              <option value="name-asc">Sort by: Name (A-Z)</option>
          </select>
        </div>

        {selection.size > 0 && userRole === UserRole.Admin && (
            <div className="pb-2">
                <button
                    onClick={onRequestDeleteSelection}
                    className="w-full flex items-center justify-center bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-lg transition-colors shadow"
                    aria-label={`Delete ${selection.size} selected items`}
                >
                    <TrashIcon className="w-5 h-5 mr-2" />
                    Delete Selected ({selection.size})
                </button>
            </div>
        )}

        <div className="space-y-2">
            <CollapsibleSection
                icon={<InboxStackIcon className="w-5 h-5 mr-3 flex-shrink-0" />}
                label="In Progress"
                count={sortedInProgressPrs.length}
                prs={sortedInProgressPrs}
                selectedPrId={selectedPrId}
                onSelectPr={onSelectPr}
                selection={selection}
                onSelectionToggle={onSelectionToggle}
                sectionType="in-progress"
                userRole={userRole}
                filters={inProgressFilters}
                activeFilter={inProgressFilter}
                onFilterChange={handleFilterChange}
            />
            <CollapsibleSection
                icon={<ArchiveBoxIcon className="w-5 h-5 mr-3 flex-shrink-0" />}
                label="Completed"
                count={sortedCompletedPrs.length}
                prs={sortedCompletedPrs}
                selectedPrId={selectedPrId}
                onSelectPr={onSelectPr}
                selection={selection}
                onSelectionToggle={onSelectionToggle}
                sectionType="completed"
                userRole={userRole}
            />
        </div>
    </div>
  );
};

export default Sidebar;