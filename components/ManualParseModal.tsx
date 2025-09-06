import React, { useState, useEffect, useMemo } from 'react';
import { XMarkIcon } from './icons';

interface ManualParseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (config: { headerRow: number; descCol: string; qtyCol: string }) => void;
  rowsPreview: any[][];
}

const ManualParseModal: React.FC<ManualParseModalProps> = ({ isOpen, onClose, onSubmit, rowsPreview }) => {
  const [headerRowInput, setHeaderRowInput] = useState<string>('');
  const [descColIndex, setDescColIndex] = useState<string>('');
  const [qtyColIndex, setQtyColIndex] = useState<string>('');

  // Reset state when modal is reopened
  useEffect(() => {
    if (isOpen) {
      setHeaderRowInput('');
      setDescColIndex('');
      setQtyColIndex('');
    }
  }, [isOpen]);

  const headerRowNumber = useMemo(() => {
    const num = parseInt(headerRowInput, 10);
    return isNaN(num) || num < 1 || num > rowsPreview.length ? null : num;
  }, [headerRowInput, rowsPreview.length]);

  const headerRowData = useMemo(() => {
    if (headerRowNumber === null) return [];
    return rowsPreview[headerRowNumber - 1] || [];
  }, [headerRowNumber, rowsPreview]);

  // Effect to reset column selections if the header row becomes invalid or changes
  useEffect(() => {
      setDescColIndex('');
      setQtyColIndex('');
  }, [headerRowNumber]);


  if (!isOpen) return null;
  
  const handleSubmit = () => {
    if (headerRowNumber && descColIndex && qtyColIndex) {
      const descCol = String.fromCharCode(65 + parseInt(descColIndex, 10));
      const qtyCol = String.fromCharCode(65 + parseInt(qtyColIndex, 10));
      onSubmit({ headerRow: headerRowNumber, descCol, qtyCol });
    }
  };

  const renderCell = (cellData: any): string => {
    if (cellData instanceof Date) {
        return cellData.toLocaleDateString();
    }
    return cellData != null ? String(cellData) : '';
  };

  const isFormComplete = !!headerRowNumber && descColIndex !== '' && qtyColIndex !== '' && descColIndex !== qtyColIndex;
  
  const maxCols = useMemo(() => rowsPreview.reduce((max, row) => Math.max(max, row.length), 0), [rowsPreview]);
  const colLetters = useMemo(() => Array.from({ length: Math.min(maxCols, 26) }, (_, i) => String.fromCharCode(65 + i)), [maxCols]);


  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center p-4" aria-modal="true" role="dialog">
      <div className="bg-white rounded-lg shadow-2xl max-w-7xl w-full h-full max-h-[90vh] flex flex-col font-sans">
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b">
          <h2 className="text-xl font-bold text-gray-900">Manual Spreadsheet Configuration</h2>
           <button onClick={onClose} className="text-gray-400 hover:text-gray-600" aria-label="Close modal">
                <XMarkIcon className="w-7 h-7" />
            </button>
        </div>

        {/* Configuration Panel */}
        <div className="p-4 border-b bg-gray-50 grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
             <div>
                <label htmlFor="header-row" className="block text-sm font-medium text-gray-700 mb-1">
                    1. Enter Header Row Number
                </label>
                <input
                    id="header-row"
                    type="number"
                    value={headerRowInput}
                    onChange={(e) => setHeaderRowInput(e.target.value)}
                    placeholder="e.g., 10"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    min="1"
                    max={rowsPreview.length}
                />
             </div>
             <div>
                <label htmlFor="desc-col" className="block text-sm font-medium text-gray-700 mb-1">
                    2. Select Description Column
                </label>
                <select
                    id="desc-col"
                    value={descColIndex}
                    onChange={(e) => setDescColIndex(e.target.value)}
                    disabled={!headerRowNumber}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                >
                    <option value="" disabled>Select a column...</option>
                    {headerRowData.map((cell, index) => (
                        <option key={index} value={index} disabled={qtyColIndex === String(index)}>
                           Col {colLetters[index]}: {renderCell(cell).substring(0, 50)}
                        </option>
                    ))}
                </select>
             </div>
             <div>
                <label htmlFor="qty-col" className="block text-sm font-medium text-gray-700 mb-1">
                    3. Select Quantity Column
                </label>
                <select
                    id="qty-col"
                    value={qtyColIndex}
                    onChange={(e) => setQtyColIndex(e.target.value)}
                    disabled={!headerRowNumber}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                >
                    <option value="" disabled>Select a column...</option>
                     {headerRowData.map((cell, index) => (
                        <option key={index} value={index} disabled={descColIndex === String(index)}>
                           Col {colLetters[index]}: {renderCell(cell).substring(0, 50)}
                        </option>
                    ))}
                </select>
             </div>
        </div>

        {/* Spreadsheet Preview */}
        <div className="flex-1 overflow-auto p-4">
            <p className="text-sm text-gray-500 mb-2">A preview of your file is shown below. The selected header row will be highlighted in blue.</p>
          <table className="min-w-full text-xs border-collapse table-fixed">
            <thead className="sticky top-0 z-10">
              <tr className="bg-gray-200">
                <th className="border p-1 text-center font-mono w-12 sticky left-0 z-20 bg-gray-200">#</th>
                {colLetters.map(letter => <th key={letter} className="border p-1 text-center font-mono w-40">{letter}</th>)}
              </tr>
            </thead>
            <tbody>
              {rowsPreview.map((row, rowIndex) => {
                const isHeaderRow = (rowIndex + 1) === headerRowNumber;
                return (
                  <tr key={rowIndex} className={`${isHeaderRow ? 'bg-blue-200' : ''}`}>
                    <td className="border p-1 text-center font-mono bg-gray-100 sticky left-0 z-10">
                        {rowIndex + 1}
                    </td>
                    {colLetters.map((_, colIndex) => (
                        <td 
                            key={colIndex} 
                            className="border p-1 truncate"
                            title={renderCell(row[colIndex])}
                        >
                            {renderCell(row[colIndex])}
                        </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Footer with actions */}
        <div className="p-4 border-t bg-gray-50 flex justify-end items-center space-x-4">
            {descColIndex && descColIndex === qtyColIndex && (
                <p className="text-red-600 text-sm font-medium mr-auto">Description and Quantity cannot be the same column.</p>
            )}
             <button 
                onClick={onClose} 
                className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold py-2 px-4 rounded-md transition-colors"
            >
                Cancel
            </button>
            <button 
                onClick={handleSubmit} 
                disabled={!isFormComplete}
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-md transition-colors shadow disabled:bg-blue-300 disabled:cursor-not-allowed"
            >
                Import File
            </button>
        </div>
      </div>
    </div>
  );
};

export default ManualParseModal;
