import XLSX from 'xlsx';
import RNFS from 'react-native-fs';
import {PurchaseRequisition, PRItem, PRStatus} from '../types';

class FileParserService {
  async parseExcelFile(file: any): Promise<PurchaseRequisition> {
    try {
      // Read file content
      const fileContent = await RNFS.readFile(file.uri, 'base64');
      const workbook = XLSX.read(fileContent, {type: 'base64', cellDates: true});
      
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json(worksheet, {header: 1}) as any[][];

      // Find header row
      let headerRowIndex = -1;
      let descColIndex = -1;
      let qtyColIndex = -1;

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        if (!Array.isArray(row)) continue;
        
        const dIndex = row.findIndex(cell => 
          typeof cell === 'string' && 
          cell.toLowerCase().includes('description')
        );
        const qIndex = row.findIndex(cell => 
          typeof cell === 'string' && 
          cell.toLowerCase().trim() === 'qty'
        );
        
        if (dIndex !== -1 && qIndex !== -1) {
          headerRowIndex = i;
          descColIndex = dIndex;
          qtyColIndex = qIndex;
          break;
        }
      }

      if (headerRowIndex === -1) {
        throw new Error('Could not find header row with Description and Qty columns');
      }

      // Extract metadata
      const metadata = this.extractMetadata(rows.slice(0, 20));
      
      // Extract items
      const items = this.extractItems(rows, worksheet, headerRowIndex, descColIndex, qtyColIndex, file.name);

      const pr: PurchaseRequisition = {
        id: `${Date.now()}-${file.name}`,
        name: file.name.replace(/\.(xlsx|xls)$/, ''),
        issueDate: metadata.issueDate || new Date().toLocaleDateString(),
        status: PRStatus.InProgress,
        items,
        requisitionBy: metadata.requisitionBy || 'N/A',
        approvedBy: metadata.approvedBy || 'N/A',
        lastModifiedBy: {
          userName: 'System',
          timestamp: Date.now(),
        },
      };

      return pr;
    } catch (error) {
      console.error('File parsing error:', error);
      throw new Error('Failed to parse Excel file');
    }
  }

  private extractMetadata(searchArea: any[][]) {
    let issueDate: Date | null = null;
    let requisitionBy = 'N/A';
    let approvedBy = 'N/A';

    const findValueInRow = (row: any[], label: string): string | Date | null => {
      const labelIndex = row.findIndex(cell => 
        typeof cell === 'string' && 
        cell.toLowerCase().trim().includes(label)
      );
      
      if (labelIndex !== -1) {
        for (let i = labelIndex + 1; i < row.length; i++) {
          const value = row[i];
          if (value) {
            if (value instanceof Date && !isNaN(value.getTime())) {
              return value;
            }
            const strValue = String(value).trim();
            if (strValue) return strValue;
          }
        }
      }
      return null;
    };

    for (const row of searchArea) {
      if (!Array.isArray(row)) continue;
      
      if (!issueDate) {
        const foundDate = findValueInRow(row, 'date');
        if (foundDate instanceof Date) {
          issueDate = foundDate;
        } else if (typeof foundDate === 'string') {
          const parsedDate = new Date(foundDate);
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

    return {
      issueDate: issueDate?.toLocaleDateString(),
      requisitionBy,
      approvedBy,
    };
  }

  private extractItems(
    rows: any[][],
    worksheet: any,
    headerRowIndex: number,
    descColIndex: number,
    qtyColIndex: number,
    fileName: string
  ): PRItem[] {
    const items: PRItem[] = [];
    let currentItemDescParts: string[] = [];
    const itemsDataStartRow = headerRowIndex + 1;
    const merges = worksheet['!merges'] || [];
    let processedMergeRangesForCurrentItem: {s: {r: number, c: number}}[] = [];

    for (let i = itemsDataStartRow; i < rows.length; i++) {
      const row = rows[i];
      if (!Array.isArray(row)) continue;
      const rowIndexInSheet = i;

      // Get description from this row's description column
      let rowDesc = '';
      const mergedRange = merges.find((merge: any) => 
        rowIndexInSheet >= merge.s.r && rowIndexInSheet <= merge.e.r &&
        descColIndex >= merge.s.c && descColIndex <= merge.e.c
      );

      if (mergedRange) {
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
        const cellValue = row[descColIndex];
        if (cellValue) {
          rowDesc = String(cellValue).trim();
        }
      }

      // Accumulate description parts
      if (rowDesc) {
        currentItemDescParts.push(rowDesc);
      }
      
      // Check for quantity to finalize item
      const qtyVal = row[qtyColIndex];
      const numQty = Number(qtyVal);
      const hasValidQty = !isNaN(numQty) && isFinite(numQty) && numQty > 0;

      if (hasValidQty) {
        const fullDescription = currentItemDescParts.join('\n').trim();
        if (fullDescription) {
          items.push({
            id: `${Date.now()}-${fileName}-${items.length}`,
            description: fullDescription,
            originalQuantity: numQty,
            receivedQuantity: 0,
            comment: '',
            isComplete: false,
          });
        }
        
        // Reset for next item
        currentItemDescParts = [];
        processedMergeRangesForCurrentItem = [];
      }
    }

    // Handle remaining description without quantity
    const remainingDescription = currentItemDescParts.join('\n').trim();
    if (remainingDescription) {
      items.push({
        id: `${Date.now()}-${fileName}-${items.length}`,
        description: remainingDescription,
        originalQuantity: 0,
        receivedQuantity: 0,
        comment: 'Note: No quantity specified in PR',
        isComplete: false,
      });
    }

    return items;
  }
}

export default new FileParserService();