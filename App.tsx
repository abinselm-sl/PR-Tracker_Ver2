import React, { useState, useRef, useMemo, useEffect } from 'react';
import useLocalStorage from './hooks/useLocalStorage';
import { PurchaseRequisition, PRItem, PRStatus, LastModifiedInfo, UserRole, SuggestionLogEntry, SuggestionStatus, UserSession } from './types';
import PRDetails from './components/PRDetails';
import { UploadIcon, PrinterIcon, SearchIcon, XMarkIcon, PencilSquareIcon, ArrowRightOnRectangleIcon, ClipboardDocumentListIcon } from './components/icons';
import Sidebar from './components/Sidebar';
import ConfirmationModal from './components/ConfirmationModal';
import ReportModal from './components/ReportModal';
import SearchResults from './components/SearchResults';
import { useUserSession } from './hooks/useUserSession';
import LoginModal from './components/LoginModal';
import ActiveUsers from './components/ActiveUsers';
import SetPasswordModal from './components/SetPasswordModal';
import PasswordRecoveryModal from './components/PasswordRecoveryModal';
import SuggestionModal from './components/SuggestionModal';
import SuggestionLogModal from './components/SuggestionLogModal';
import ManualParseModal from './components/ManualParseModal';

// Define initial value outside the component to ensure a stable reference for useLocalStorage.
const initialPRs: PurchaseRequisition[] = [];
const initialSuggestionLog: SuggestionLogEntry[] = [];

// Make SheetJS library available from window
declare const XLSX: any;

const createPRFromRows = (rows: any[][], worksheet: any, headerRowIndex: number, descColIndex: number, qtyColIndex: number, file: File, userName: string): PurchaseRequisition | string => {
    let issueDate: Date | null = null;
    let requisitionBy = 'N/A';
    let approvedBy = 'N/A';

    const findValueInRow = (row: any[], label: string): string | Date | null => {
        const labelIndex = row.findIndex(cell => typeof cell === 'string' && cell.toLowerCase().trim().includes(label));
        if (labelIndex !== -1) {
            for (let i = labelIndex + 1; i < row.length; i++) {
                const value = row[i];
                if (value) {
                    // Check for native Date objects first, which is best-case
                    if (value instanceof Date && !isNaN(value.getTime())) {
                        return value;
                    }
                    // Fallback for string values
                    const strValue = String(value).trim();
                    if (strValue) return strValue;
                }
            }
        }
        return null;
    };
    
    const searchArea = rows.slice(0, 20);
    for (const row of searchArea) {
        if (!Array.isArray(row)) continue;
        if (!issueDate) {
            const foundDate = findValueInRow(row, 'date');
            if (foundDate instanceof Date) {
                issueDate = foundDate;
            } else if (typeof foundDate === 'string') {
                const parsedDate = new Date(foundDate);
                // Check if parsing was successful before assigning
                if (!isNaN(parsedDate.getTime())) {
                    issueDate = parsedDate;
                }
            }
        }
        if (requisitionBy === 'N/A') {
            const foundReqBy = findValueInRow(row, 'requisition by');
            if (typeof foundReqBy === 'string') requisitionBy = foundReqBy;
        }
        if (approvedBy === 'N/A') {
            const foundAppBy = findValueInRow(row, 'approved by');
            if (typeof foundAppBy === 'string') approvedBy = foundAppBy;
        }
        if (issueDate && requisitionBy !== 'N/A' && approvedBy !== 'N/A') break;
    }


    // REFACTORED ITEM EXTRACTION LOGIC
    const newPRItems: PRItem[] = [];
    let currentItemDescParts: string[] = [];
    const itemsDataStartRow = headerRowIndex + 1;
    const merges = worksheet['!merges'] || [];
    // Keep track of processed merge ranges for the current item being built.
    let processedMergeRangesForCurrentItem: {s: {r: number, c: number}}[] = [];

    for (let i = itemsDataStartRow; i < rows.length; i++) {
        const row = rows[i];
        if (!Array.isArray(row)) continue;
        const rowIndexInSheet = i;

        // 1. Get description from this row's description column.
        let rowDesc = '';
        const mergedRange = merges.find((merge: any) => 
            rowIndexInSheet >= merge.s.r && rowIndexInSheet <= merge.e.r &&
            descColIndex >= merge.s.c && descColIndex <= merge.e.c
        );

        if (mergedRange) {
            // Check if we've already processed this merged cell's text for the current item.
            const isAlreadyProcessed = processedMergeRangesForCurrentItem.some(
                processed => processed.s.r === mergedRange.s.r && processed.s.c === mergedRange.s.c
            );
            if (!isAlreadyProcessed) {
                const startCellAddress = XLSX.utils.encode_cell({ r: mergedRange.s.r, c: mergedRange.s.c });
                const cellValue = worksheet[startCellAddress]?.v;
                if (cellValue) {
                    rowDesc = String(cellValue).trim();
                }
                processedMergeRangesForCurrentItem.push({ s: { r: mergedRange.s.r, c: mergedRange.s.c } });
            }
        } else {
            // It's a regular, non-merged cell.
            const cellValue = row[descColIndex];
            if (cellValue) {
                rowDesc = String(cellValue).trim();
            }
        }

        // 2. Accumulate the description part if it's not empty.
        if (rowDesc) {
            currentItemDescParts.push(rowDesc);
        }
        
        // 3. Check for a quantity on this row to finalize the item.
        const qtyVal = row[qtyColIndex];
        const numQty = Number(qtyVal);
        const hasValidQty = !isNaN(numQty) && isFinite(numQty) && numQty > 0;

        if (hasValidQty) {
            const fullDescription = currentItemDescParts.join('\n').trim();
            if (!fullDescription) continue; // Skip quantity without a preceding description.
            
            newPRItems.push({
                id: `${Date.now()}-${file.name}-${newPRItems.length}`,
                description: fullDescription,
                originalQuantity: numQty,
                receivedQuantity: 0,
                comment: '',
                isComplete: false,
            });
            
            // Reset for the next item
            currentItemDescParts = [];
            processedMergeRangesForCurrentItem = [];
        }
    }

    // Handle any remaining description for an item without a quantity at the end of the list.
    const remainingDescription = currentItemDescParts.join('\n').trim();
    if (remainingDescription) {
        newPRItems.push({
            id: `${Date.now()}-${file.name}-${newPRItems.length}`,
            description: remainingDescription,
            originalQuantity: 0,
            receivedQuantity: 0,
            comment: 'Note: No quantity specified in PR',
            isComplete: false,
        });
    }

    if (newPRItems.length === 0) {
        return 'No valid item rows found. Check column and row settings, and ensure items have quantities greater than 0.';
    }

    const newPR: PurchaseRequisition = {
        id: `${Date.now()}-${file.name}`,
        name: file.name.replace(/\.(xlsx|xls|csv)$/, ''),
        issueDate: (issueDate || new Date()).toLocaleDateString(),
        status: PRStatus.InProgress,
        items: newPRItems,
        requisitionBy,
        approvedBy,
        lastModifiedBy: {
            userName: userName,
            timestamp: Date.now(),
        },
    };
    return newPR;
};


function App() {
  const [
    currentUser, 
    activeSessions, 
    login, 
    logout,
    passwordSetupRequired,
    setPassword,
    recoverPassword,
    sendSuggestion
  ] = useUserSession();

  const [purchaseRequisitions, setPurchaseRequisitions] = useLocalStorage<PurchaseRequisition[]>('purchaseRequisitions', initialPRs);
  const [suggestionLog, setSuggestionLog] = useLocalStorage<SuggestionLogEntry[]>('suggestionLog', initialSuggestionLog);
  const [selectedPrId, setSelectedPrId] = useState<string | null>(null);
  const [prToDelete, setPrToDelete] = useState<PurchaseRequisition | null>(null);
  const [selection, setSelection] = useState<Set<string>>(new Set());
  const [isMultiDeleteModalOpen, setIsMultiDeleteModalOpen] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [isRecoveryModalOpen, setIsRecoveryModalOpen] = useState(false);
  const [isSuggestionModalOpen, setIsSuggestionModalOpen] = useState(false);
  const [isSuggestionLogModalOpen, setIsSuggestionLogModalOpen] = useState(false);
  const [globalItemSearchQuery, setGlobalItemSearchQuery] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [manualParseData, setManualParseData] = useState<{ file: File; rows: any[][]; worksheet: any } | null>(null);

  
  const isViewer = currentUser?.role === UserRole.Viewer;

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const processFile = (file: File, currentUser: UserSession): Promise<{ pr: PurchaseRequisition, file: File } | { file: File, error: string } | { file: File, rows: any[][], worksheet: any, needsManualParse: true }> => {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                // FIX: Corrected typo from UintArray to Uint8Array
                const data = new Uint8Array(e.target?.result as ArrayBuffer);
                const workbook = XLSX.read(data, { type: 'array', cellDates: true });
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
                const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
                
                let headerRowIndex = -1;
                let descColIndex = -1;
                let qtyColIndex = -1;

                for (let i = 0; i < rows.length; i++) {
                    const row = rows[i];
                    if (!Array.isArray(row)) continue;
                    const dIndex = row.findIndex(cell => typeof cell === 'string' && cell.toLowerCase().includes('description'));
                    const qIndex = row.findIndex(cell => typeof cell === 'string' && cell.toLowerCase().trim() === 'qty');
                    if (dIndex !== -1 && qIndex !== -1) {
                        headerRowIndex = i;
                        descColIndex = dIndex;
                        qtyColIndex = qIndex;
                        break;
                    }
                }
                
                if (headerRowIndex === -1) {
                    if (currentUser?.role === UserRole.Admin) {
                        resolve({ file, rows, worksheet, needsManualParse: true });
                    } else {
                        resolve({ file, error: 'Could not automatically find headers. Please ask an admin to upload.' });
                    }
                    return;
                }
                
                const prResult = createPRFromRows(rows, worksheet, headerRowIndex, descColIndex, qtyColIndex, file, currentUser.userName);

                if (typeof prResult === 'string') {
                    resolve({ file, error: prResult });
                } else {
                    resolve({ pr: prResult, file });
                }
            } catch (error) {
                console.error("Error parsing Excel file:", error);
                resolve({ file, error: "Failed to parse. Please ensure it's a valid format." });
            }
        };
        reader.onerror = () => {
            resolve({ file, error: "Failed to read the file." });
        };
        reader.readAsArrayBuffer(file);
    });
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0 || !currentUser) return;

    const filePromises = Array.from(files).map(file => processFile(file, currentUser));

    Promise.all(filePromises).then(results => {
      const newPRs: PurchaseRequisition[] = [];
      const failedFiles: { file: File; error: string }[] = [];
      const existingDuplicates: { file: File; existingPrId: string }[] = [];
      let needsManualParseFile: { file: File; rows: any[][]; worksheet: any } | null = null;
      
      const batchPRNames = new Set<string>();

      for (const res of results) {
        if ('pr' in res) {
          const prName = res.pr.name;
          const existingPr = purchaseRequisitions.find(p => p.name === prName);
          
          if (existingPr) {
            existingDuplicates.push({ file: res.file, existingPrId: existingPr.id });
          } else if (batchPRNames.has(prName)) {
            failedFiles.push({ file: res.file, error: `Duplicate name "${prName}" in the same upload batch.` });
          } else {
            newPRs.push(res.pr);
            batchPRNames.add(prName);
          }
        } else if ('error' in res) {
          failedFiles.push({ file: res.file, error: res.error });
        } else if ('needsManualParse' in res) {
          if (!needsManualParseFile) {
            needsManualParseFile = { file: res.file, rows: res.rows, worksheet: res.worksheet };
          } else {
            failedFiles.push({ file: res.file, error: 'Requires manual header selection. Can only process one at a time.' });
          }
        }
      }

      if (needsManualParseFile) {
        setManualParseData(needsManualParseFile);
        const otherFailures = failedFiles.length + existingDuplicates.length;
        let alertMsg = `File "${needsManualParseFile.file.name}" requires manual configuration.`;
        if (newPRs.length > 0) alertMsg += `\n\n${newPRs.length} other file(s) were imported successfully. You may need to re-upload them after configuring.`;
        if (otherFailures > 0) alertMsg += `\n\n${otherFailures} other file(s) also failed or were duplicates.`;
        alert(alertMsg);
      } else {
        if (newPRs.length > 0) {
          setPurchaseRequisitions(prev => [...newPRs, ...prev]);
          if (existingDuplicates.length === 0) {
            setSelectedPrId(newPRs[0].id);
          }
        }

        if (existingDuplicates.length > 0) {
          setSelectedPrId(existingDuplicates[0].existingPrId);
        }
        
        const alertParts: string[] = [];
        if (newPRs.length > 0) {
          alertParts.push(`Successfully imported ${newPRs.length} PR(s).`);
        }
        if (failedFiles.length > 0) {
            const errorMessages = failedFiles.map(f => `- ${f.file.name}: ${f.error}`).join('\n');
            alertParts.push(`Failed to import ${failedFiles.length} file(s):\n${errorMessages}`);
        }
        if (existingDuplicates.length > 0) {
            const duplicateMessages = existingDuplicates.map(f => `- ${f.file.name}`).join('\n');
            alertParts.push(`The following ${existingDuplicates.length} file(s) already exist and were not re-imported:\n${duplicateMessages}\n\nThe existing PR has been selected for you.`);
        }

        if (alertParts.length > 0) {
          alert(alertParts.join('\n\n'));
        }
      }
    });

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleManualParseSubmit = (config: { headerRow: number; descCol: string; qtyCol: string }) => {
    if (!manualParseData || !currentUser) return;
    
    const { file, rows, worksheet } = manualParseData;
    
    const descColIndex = config.descCol.toUpperCase().charCodeAt(0) - 65;
    const qtyColIndex = config.qtyCol.toUpperCase().charCodeAt(0) - 65;
    const headerRowIndex = config.headerRow - 1;

    if (headerRowIndex < 0 || descColIndex < 0 || qtyColIndex < 0 || descColIndex > 25 || qtyColIndex > 25) {
        alert("Invalid row or column provided. Please provide a valid row number and single-letter columns (A-Z).");
        return;
    }

    const prResult = createPRFromRows(rows, worksheet, headerRowIndex, descColIndex, qtyColIndex, file, currentUser.userName);

    if (typeof prResult === 'string') {
        alert(`Failed to parse with manual settings: ${prResult}`);
    } else {
        const existingPr = purchaseRequisitions.find(pr => pr.name === prResult.name);
        if (existingPr) {
            alert(`PR "${prResult.name}" already exists. Selecting it in the list.`);
            setSelectedPrId(existingPr.id);
        } else {
            setPurchaseRequisitions(prev => [prResult, ...prev]);
            setSelectedPrId(prResult.id);
            alert(`Successfully imported "${file.name}" with manual settings.`);
        }
    }

    setManualParseData(null);
  };
  
  const handleUpdateItem = (prId: string, itemId: string, updatedFields: Partial<PRItem>) => {
    setPurchaseRequisitions(prevPRs => {
      const newPRs = prevPRs.map(pr => {
        if (pr.id === prId) {
          const lastModifiedInfo: LastModifiedInfo = {
            userName: currentUser!.userName,
            timestamp: Date.now(),
          };

          const updatedItems = pr.items.map(item => {
            if (item.id === itemId) {
              const wasComplete = item.isComplete;
              const isNowComplete = updatedFields.isComplete === true;
              const finalUpdatedFields = { ...updatedFields };

              if (isNowComplete && !wasComplete) {
                const today = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD
                const dateComment = `Received on ${today}.`;
                finalUpdatedFields.comment = [dateComment, item.comment].filter(Boolean).join(' ');
              }

              return { ...item, ...finalUpdatedFields, lastModifiedBy: lastModifiedInfo };
            }
            return item;
          });

          const allItemsComplete = updatedItems.every(item => item.isComplete);
          const newStatus = allItemsComplete ? PRStatus.Completed : PRStatus.InProgress;

          // If the PR is now complete, deselect it if it was selected
          if (newStatus === PRStatus.Completed && selectedPrId === prId) {
            setSelectedPrId(null);
          }

          return { ...pr, items: updatedItems, status: newStatus, lastModifiedBy: lastModifiedInfo };
        }
        return pr;
      });
      return newPRs;
    });
  };

  const handleReceiveAllItems = (prId: string) => {
    setPurchaseRequisitions(prevPRs => {
        return prevPRs.map(pr => {
            if (pr.id === prId) {
                const lastModifiedInfo: LastModifiedInfo = {
                    userName: currentUser!.userName,
                    timestamp: Date.now(),
                };
                const today = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD
                const dateComment = `Received on ${today}.`;

                const updatedItems = pr.items.map(item => {
                    if (item.isComplete) return item; // Don't modify already completed items
                    return {
                        ...item,
                        receivedQuantity: item.originalQuantity,
                        isComplete: true,
                        comment: [dateComment, item.comment].filter(Boolean).join(' '),
                        lastModifiedBy: lastModifiedInfo,
                    };
                });
                
                // If PR is completed, deselect it
                if (selectedPrId === prId) {
                    setSelectedPrId(null);
                }

                return {
                    ...pr,
                    items: updatedItems,
                    status: PRStatus.Completed,
                    lastModifiedBy: lastModifiedInfo,
                };
            }
            return pr;
        });
    });
  };

  const handleReopenPr = (prId: string) => {
    setPurchaseRequisitions(prevPRs => {
        return prevPRs.map(pr => {
            if (pr.id === prId) {
                const lastModifiedInfo: LastModifiedInfo = {
                    userName: currentUser!.userName,
                    timestamp: Date.now(),
                };

                const updatedItems = pr.items.map(item => ({
                    ...item,
                    receivedQuantity: 0,
                    isComplete: false,
                    comment: '', // Reset comments
                    lastModifiedBy: lastModifiedInfo,
                }));

                return {
                    ...pr,
                    items: updatedItems,
                    status: PRStatus.InProgress,
                    lastModifiedBy: lastModifiedInfo,
                };
            }
            return pr;
        });
    });
  };

  const handleDeletePr = (prId: string) => {
    setPurchaseRequisitions(prev => prev.filter(pr => pr.id !== prId));
    if (selectedPrId === prId) {
      setSelectedPrId(null);
    }
    setPrToDelete(null); 
  };
  
  const handleSelectionToggle = (prId: string) => {
    setSelection(prev => {
      const newSelection = new Set(prev);
      if (newSelection.has(prId)) {
        newSelection.delete(prId);
      } else {
        newSelection.add(prId);
      }
      return newSelection;
    });
  };
  
  const requestDeleteSelection = () => {
    if (selection.size > 0) {
      setIsMultiDeleteModalOpen(true);
    }
  };

  const confirmDeleteSelection = () => {
    setPurchaseRequisitions(prev => prev.filter(pr => !selection.has(pr.id)));
    if (selectedPrId && selection.has(selectedPrId)) {
      setSelectedPrId(null);
    }
    setSelection(new Set());
    setIsMultiDeleteModalOpen(false);
  };


  const requestDeletePr = (prId: string) => {
    const pr = purchaseRequisitions.find(p => p.id === prId);
    if (pr) {
      setPrToDelete(pr);
    }
  };

  const handleSendSuggestion = (note: string) => {
    if (!currentUser) return;

    const newLogEntry: SuggestionLogEntry = {
      id: `${Date.now()}-${currentUser.userName}`,
      userName: currentUser.userName,
      note: note.trim(),
      timestamp: Date.now(),
      status: SuggestionStatus.Pending,
      adminComments: '',
    };

    setSuggestionLog(prevLog => [newLogEntry, ...prevLog]);
    
    // The note is passed to the email body. Let's pre-format it for the admin.
    const emailBody = `Suggestion from: ${currentUser.userName}\n\n${note.trim()}`;
    sendSuggestion(emailBody);

    setIsSuggestionModalOpen(false);
  };

  const handleUpdateLogEntry = (id: string, updates: Partial<SuggestionLogEntry>) => {
    setSuggestionLog(prevLog => prevLog.map(entry => 
        entry.id === id ? { ...entry, ...updates } : entry
    ));
  };

  const handleDeleteLogEntry = (id: string) => {
    setSuggestionLog(prevLog => prevLog.filter(entry => entry.id !== id));
  };


  const { inProgressPrs, completedPrs } = useMemo(() => {
    const inProgress = purchaseRequisitions.filter(pr => pr.status === PRStatus.InProgress);
    const completed = purchaseRequisitions.filter(pr => pr.status === PRStatus.Completed);
    return { inProgressPrs: inProgress, completedPrs: completed };
  }, [purchaseRequisitions]);

  const selectedPR = useMemo(() => {
    return purchaseRequisitions.find(pr => pr.id === selectedPrId) || null;
  }, [purchaseRequisitions, selectedPrId]);

  const searchResultItems = useMemo(() => {
    if (!globalItemSearchQuery.trim()) {
      return [];
    }
    const results: { item: PRItem; prName: string; prId: string }[] = [];
    purchaseRequisitions.forEach(pr => {
      pr.items.forEach(item => {
        if (item.description.toLowerCase().includes(globalItemSearchQuery.toLowerCase())) {
          results.push({
            item,
            prName: pr.name,
            prId: pr.id,
          });
        }
      });
    });
    return results;
  }, [purchaseRequisitions, globalItemSearchQuery]);

  const handleSelectPrFromSearch = (prId: string) => {
    setSelectedPrId(prId);
    setGlobalItemSearchQuery('');
  };

  if (!currentUser) {
    return <LoginModal onLogin={login} onForgotPassword={() => setIsRecoveryModalOpen(true)} />;
  }

  return (
    <div className="h-screen w-screen flex flex-col font-sans bg-gray-100">
      {passwordSetupRequired && currentUser?.role === UserRole.Admin && (
        <SetPasswordModal
          userName={currentUser.userName}
          onSetPassword={setPassword}
          onCancel={logout}
        />
      )}
      {isRecoveryModalOpen && (
          <PasswordRecoveryModal 
            onClose={() => setIsRecoveryModalOpen(false)}
            onRecover={(userName, phone) => {
                recoverPassword(userName, phone);
                setIsRecoveryModalOpen(false);
            }}
          />
      )}
      <SuggestionModal
        isOpen={isSuggestionModalOpen}
        onClose={() => setIsSuggestionModalOpen(false)}
        onSend={handleSendSuggestion}
      />
      <SuggestionLogModal
        isOpen={isSuggestionLogModalOpen}
        onClose={() => setIsSuggestionLogModalOpen(false)}
        log={suggestionLog}
        currentUser={currentUser}
        onUpdateLogEntry={handleUpdateLogEntry}
        onDeleteLogEntry={handleDeleteLogEntry}
      />
      {prToDelete && (
        <ConfirmationModal
            isOpen={!!prToDelete}
            onClose={() => setPrToDelete(null)}
            onConfirm={() => handleDeletePr(prToDelete.id)}
            title="Delete Purchase Requisition?"
            message={`Are you sure you want to permanently delete "${prToDelete.name}"? This action cannot be undone.`}
        />
      )}
      {isMultiDeleteModalOpen && (
        <ConfirmationModal
            isOpen={isMultiDeleteModalOpen}
            onClose={() => setIsMultiDeleteModalOpen(false)}
            onConfirm={confirmDeleteSelection}
            title={`Delete ${selection.size} Requisitions?`}
            message={`Are you sure you want to permanently delete ${selection.size} selected item(s)? This action cannot be undone.`}
        />
      )}
      <ReportModal
        isOpen={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
        inProgressPrs={inProgressPrs}
        completedPrs={completedPrs}
      />
       {manualParseData && (
        <ManualParseModal
          isOpen={!!manualParseData}
          onClose={() => setManualParseData(null)}
          onSubmit={handleManualParseSubmit}
          rowsPreview={manualParseData.rows.slice(0, 30)}
        />
      )}
      <header className="bg-white shadow-md z-10 flex-shrink-0">
        <div className="container mx-auto px-6 py-3 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-800 flex-shrink-0">Logistics PR Tracker</h1>
          <div className="relative flex-grow max-w-xl mx-4">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3">
              <SearchIcon className="w-5 h-5 text-gray-400" />
            </span>
            <input
              type="text"
              placeholder="Search all items by description..."
              value={globalItemSearchQuery}
              onChange={(e) => setGlobalItemSearchQuery(e.target.value)}
              className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent sm:text-sm"
              aria-label="Search all items across all purchase requisitions"
            />
            {globalItemSearchQuery && (
              <button
                onClick={() => setGlobalItemSearchQuery('')}
                className="absolute inset-y-0 right-0 flex items-center pr-3"
                aria-label="Clear search"
              >
                <XMarkIcon className="w-5 h-5 text-gray-500 hover:text-gray-700" />
              </button>
            )}
          </div>
          <div className="flex items-center space-x-4 flex-shrink-0">
             <ActiveUsers currentUser={currentUser} sessions={activeSessions} />
             <button
                onClick={() => setIsSuggestionLogModalOpen(true)}
                className="flex items-center bg-yellow-500 hover:bg-yellow-600 text-white font-bold py-2 px-4 rounded-lg transition-colors shadow hover:shadow-lg"
                title="View Suggestion Log"
             >
                <ClipboardDocumentListIcon className="w-5 h-5 mr-2" />
                Suggestion Log
             </button>
             <button
              onClick={() => setIsReportModalOpen(true)}
              className="flex items-center bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded-lg transition-colors shadow hover:shadow-lg"
            >
              <PrinterIcon className="w-5 h-5 mr-2" />
              Generate Report
            </button>
            {isViewer ? (
                <button
                    onClick={() => setIsSuggestionModalOpen(true)}
                    className="flex items-center bg-teal-600 hover:bg-teal-700 text-white font-bold py-2 px-4 rounded-lg transition-colors shadow hover:shadow-lg"
                >
                    <PencilSquareIcon className="w-5 h-5 mr-2" />
                    Suggest a Change
                </button>
            ) : (
                <button
                onClick={handleUploadClick}
                className="flex items-center bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg transition-colors shadow hover:shadow-lg"
                >
                <UploadIcon className="w-5 h-5 mr-2" />
                Upload New PR
                </button>
            )}
            <button
                onClick={logout}
                className="flex items-center bg-gray-500 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded-lg transition-colors shadow hover:shadow-lg"
                aria-label="End session and log out"
            >
                <ArrowRightOnRectangleIcon className="w-5 h-5 mr-2" />
                End Session
            </button>
          </div>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            className="hidden"
            accept=".xlsx, .xls"
            multiple
            disabled={isViewer}
          />
        </div>
      </header>
      <main className="flex-1 flex overflow-hidden">
        <Sidebar 
          inProgressPrs={inProgressPrs}
          completedPrs={completedPrs}
          selectedPrId={selectedPrId}
          onSelectPr={setSelectedPrId}
          selection={selection}
          onSelectionToggle={handleSelectionToggle}
          onRequestDeleteSelection={requestDeleteSelection}
          userRole={currentUser.role}
        />
        <div className="flex-1 bg-slate-100 overflow-y-auto">
          {globalItemSearchQuery ? (
            <SearchResults
              results={searchResultItems}
              onSelectPr={handleSelectPrFromSearch}
            />
          ) : (
            <PRDetails 
              pr={selectedPR} 
              onUpdateItem={handleUpdateItem} 
              onDeleteRequest={requestDeletePr}
              onReceiveAllItems={handleReceiveAllItems}
              onReopenPr={handleReopenPr}
              userRole={currentUser.role}
            />
          )}
        </div>
      </main>
    </div>
  );
}

export default App;