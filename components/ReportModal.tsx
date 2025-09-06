import React, { useState, useMemo, useEffect } from 'react';
import { PurchaseRequisition, PRStatus } from '../types';
import { PrinterIcon, XMarkIcon, InboxStackIcon, ArchiveBoxIcon, DocumentArrowDownIcon, PencilSquareIcon } from './icons';
import { GoogleGenAI } from "@google/genai";

// Make SheetJS library available from window
declare const XLSX: any;

// Helper to format date to YYYY-MM-DD for input fields
const formatDateForInput = (date: Date): string => {
  return date.toISOString().split('T')[0];
};


const ReportModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  inProgressPrs: PurchaseRequisition[];
  completedPrs: PurchaseRequisition[];
}> = ({ isOpen, onClose, inProgressPrs, completedPrs }) => {
  const today = new Date();
  const thirtyDaysAgo = new Date(new Date().setDate(today.getDate() - 30));

  const [startDate, setStartDate] = useState(formatDateForInput(thirtyDaysAgo));
  const [endDate, setEndDate] = useState(formatDateForInput(today));
  const [statusFilter, setStatusFilter] = useState({
      [PRStatus.InProgress]: true,
      [PRStatus.Completed]: true,
  });
  const [aiSummary, setAiSummary] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState('');

  // Reset state when modal is closed/opened
  useEffect(() => {
    if (isOpen) {
      setStartDate(formatDateForInput(thirtyDaysAgo));
      setEndDate(formatDateForInput(today));
      setStatusFilter({ [PRStatus.InProgress]: true, [PRStatus.Completed]: true });
      setAiSummary('');
      setError('');
      setIsGenerating(false);
    }
  }, [isOpen]);

  const filteredPrs = useMemo(() => {
    const allPrs = [...inProgressPrs, ...completedPrs];
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    return allPrs.filter(pr => {
        const issueDate = new Date(pr.issueDate);
        const isWithinDateRange = issueDate >= start && issueDate <= end;
        const isStatusSelected = statusFilter[pr.status];
        return isWithinDateRange && isStatusSelected;
    });
  }, [startDate, endDate, statusFilter, inProgressPrs, completedPrs]);
  
  const filteredInProgress = useMemo(() => filteredPrs.filter(p => p.status === PRStatus.InProgress), [filteredPrs]);
  const filteredCompleted = useMemo(() => filteredPrs.filter(p => p.status === PRStatus.Completed), [filteredPrs]);

  const generateAISummary = async () => {
    setIsGenerating(true);
    setAiSummary('');
    setError('');

    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        
        const promptData = {
            report_period: `From ${startDate} to ${endDate}`,
            in_progress_prs: filteredInProgress.map(pr => ({
                name: pr.name,
                issue_date: pr.issueDate,
                pending_items_count: pr.items.filter(item => !item.isComplete).length,
                total_items_count: pr.items.length,
            })),
            completed_prs_count: filteredCompleted.length,
        };

        const prompt = `
            Analyze the following Purchase Requisition (PR) report data and provide a concise summary for a logistics manager.
            
            Data: ${JSON.stringify(promptData, null, 2)}

            Summary should include:
            1.  An overview of the total number of PRs reviewed in the period.
            2.  Key statistics: how many are in progress vs. completed.
            3.  Mention any PRs that seem to have a high number of pending items, suggesting they may need attention.
            4.  Conclude with a brief, actionable insight.
            Keep the summary professional, clear, and under 150 words.
        `;
        
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
        });

        setAiSummary(response.text);
    } catch (err) {
        console.error("Gemini API error:", err);
        setError("Failed to generate AI summary. Please check your connection or API key setup.");
    } finally {
        setIsGenerating(false);
    }
  };


  const handlePrint = () => window.print();
  
  const handleExportToExcel = () => {
    const workbook = XLSX.utils.book_new();
    const setColumnWidths = (sheet: any, widths: { wch: number }[]) => { sheet['!cols'] = widths; };

    if (filteredInProgress.length > 0) {
      const data = filteredInProgress.flatMap(pr => pr.items.filter(item => !item.isComplete).map(item => ({
        'PR Name': pr.name, 'Item Description': item.description, 'Original Qty': item.originalQuantity,
        'Received Qty': item.receivedQuantity, 'Pending Qty': item.originalQuantity - item.receivedQuantity, 'Comment': item.comment,
      })));
      const sheet = XLSX.utils.json_to_sheet(data);
      setColumnWidths(sheet, [{ wch: 40 }, { wch: 50 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 40 }]);
      XLSX.utils.book_append_sheet(workbook, sheet, 'In Progress');
    }

    if (filteredCompleted.length > 0) {
        const data = filteredCompleted.map(pr => ({ 'PR Name': pr.name, 'Issue Date': pr.issueDate }));
        const sheet = XLSX.utils.json_to_sheet(data);
        setColumnWidths(sheet, [{ wch: 40 }, { wch: 15 }]);
        XLSX.utils.book_append_sheet(workbook, sheet, 'Completed PRs');
    }

    XLSX.writeFile(workbook, `PR_Status_Report_${startDate}_to_${endDate}.xlsx`);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center p-4" aria-modal="true" role="dialog">
      <div className="bg-white rounded-lg shadow-2xl max-w-6xl w-full h-full max-h-[90vh] flex flex-col">
        {/* Modal Header */}
        <div className="flex justify-between items-center p-4 border-b no-print">
          <h2 className="text-xl font-bold text-gray-900">Generate Status Report</h2>
          <div className="flex items-center space-x-4">
             <button onClick={handleExportToExcel} className="flex items-center bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg transition-colors shadow hover:shadow-lg"><DocumentArrowDownIcon className="w-5 h-5 mr-2" />Export to Excel</button>
             <button onClick={handlePrint} className="flex items-center bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg transition-colors shadow hover:shadow-lg"><PrinterIcon className="w-5 h-5 mr-2" />Print</button>
             <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors" aria-label="Close modal"><XMarkIcon className="w-7 h-7" /></button>
          </div>
        </div>
        
        {/* Configuration Panel */}
        <div className="p-4 border-b bg-gray-50 grid grid-cols-1 md:grid-cols-3 gap-4 items-end no-print">
            <div>
                <label htmlFor="start-date" className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                <input type="date" id="start-date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
                <label htmlFor="end-date" className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                <input type="date" id="end-date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div className="flex items-center space-x-4">
                <span className="text-sm font-medium text-gray-700">Include Status:</span>
                <label className="flex items-center"><input type="checkbox" checked={statusFilter[PRStatus.InProgress]} onChange={e => setStatusFilter(s => ({...s, [PRStatus.InProgress]: e.target.checked}))} className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500" /> <span className="ml-2">In Progress</span></label>
                <label className="flex items-center"><input type="checkbox" checked={statusFilter[PRStatus.Completed]} onChange={e => setStatusFilter(s => ({...s, [PRStatus.Completed]: e.target.checked}))} className="h-4 w-4 text-green-600 border-gray-300 rounded focus:ring-green-500" /> <span className="ml-2">Completed</span></label>
            </div>
        </div>

        {/* Report Content */}
        <div id="report-content" className="overflow-y-auto p-6">
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-gray-800">Purchase Requisition Status Report</h1>
                <p className="text-gray-500">For period: {new Date(startDate).toLocaleDateString()} to {new Date(endDate).toLocaleDateString()}</p>
            </div>
            
            {/* AI Summary Section */}
            <div className="mb-8 p-4 border-2 border-dashed rounded-lg bg-indigo-50/50 no-print">
                <div className="flex justify-between items-center mb-2">
                    <h3 className="text-lg font-bold text-indigo-800">AI Summary & Insights</h3>
                    <button onClick={generateAISummary} disabled={isGenerating || filteredPrs.length === 0} className="flex items-center bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-3 rounded-lg transition-colors shadow disabled:bg-indigo-300 disabled:cursor-wait"><PencilSquareIcon className="w-5 h-5 mr-2" />{isGenerating ? 'Analyzing...' : 'Generate AI Summary'}</button>
                </div>
                {isGenerating && <p className="text-indigo-600 animate-pulse">Generating insights from {filteredPrs.length} PRs...</p>}
                {error && <p className="text-red-600 font-medium">{error}</p>}
                {aiSummary && <p className="text-gray-700 whitespace-pre-wrap">{aiSummary}</p>}
                {filteredPrs.length === 0 && !isGenerating && <p className="text-gray-500 italic">No data in the selected range to summarize.</p>}
            </div>

            {/* In Progress Section */}
            {statusFilter[PRStatus.InProgress] && (
            <div className="mb-8 page-break-before">
                <div className="flex items-center mb-4"><InboxStackIcon className="w-6 h-6 mr-3 text-blue-600" /><h2 className="text-2xl font-semibold text-gray-800">In Progress ({filteredInProgress.length})</h2></div>
                {filteredInProgress.length > 0 ? filteredInProgress.map(pr => {
                    const pendingItems = pr.items.filter(item => !item.isComplete);
                    if (pendingItems.length === 0) return null;
                    return (
                        <div key={pr.id} className="mb-6 p-4 border rounded-lg bg-gray-50"><h3 className="font-bold text-lg text-gray-700">{pr.name}</h3><p className="text-sm text-gray-500 mb-2">Issued: {pr.issueDate}</p><ul className="list-disc list-inside space-y-1 pl-2 text-sm">{pendingItems.map(item => (<li key={item.id} className="text-gray-600"><span className="font-medium">{item.description}</span> - <span className="text-red-600">Pending: {item.originalQuantity - item.receivedQuantity} of {item.originalQuantity}</span></li>))}</ul></div>
                    );
                }) : <p className="text-gray-500 italic">No 'In Progress' requisitions found in this period.</p>}
            </div>
            )}

            {/* Completed Section */}
            {statusFilter[PRStatus.Completed] && (
            <div className="page-break-before">
                 <div className="flex items-center mb-4"><ArchiveBoxIcon className="w-6 h-6 mr-3 text-green-600" /><h2 className="text-2xl font-semibold text-gray-800">Completed ({filteredCompleted.length})</h2></div>
                {filteredCompleted.length > 0 ? (<div className="p-4 border rounded-lg bg-gray-50"><ul className="list-disc list-inside space-y-2 text-sm">{filteredCompleted.map(pr => (<li key={pr.id} className="text-gray-700 font-medium">{pr.name}</li>))}</ul></div>) : <p className="text-gray-500 italic">No 'Completed' requisitions found in this period.</p>}
            </div>
            )}
        </div>
      </div>
    </div>
  );
};

export default ReportModal;