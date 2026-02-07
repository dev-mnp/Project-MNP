import ExcelJS from 'exceljs';
import { supabase } from '../lib/supabase';
import { fetchFundRequestById, fetchPreviousFundRequestTotal, type FundRequestWithDetails } from './fundRequestService';

/**
 * Generate Fund Request document for Aid or Article
 */
export const generateFundRequestDocument = async (
  fundRequestId: string,
  type: 'Aid' | 'Article'
): Promise<Blob> => {
  try {
    const fundRequest = await fetchFundRequestById(fundRequestId);
    if (!fundRequest) {
      throw new Error('Fund request not found');
    }

    let workbook: ExcelJS.Workbook;

    if (type === 'Aid') {
      // Load template for Aid
      try {
        const response = await fetch('/model-docs/Fund Request - 6 Aid.xlsx');
        if (!response.ok) {
          throw new Error('Template file not found');
        }
        const arrayBuffer = await response.arrayBuffer();
        workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(arrayBuffer);
        
        // Get the first worksheet (template)
        const worksheet = workbook.worksheets[0];
        await populateAidFundRequestTemplate(worksheet, fundRequest);
      } catch (templateError) {
        console.warn('Failed to load template, creating new document:', templateError);
        // Fallback to creating new document
        workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Fund Request');
        await createAidFundRequestSheet(worksheet, fundRequest);
      }
    } else {
      workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Fund Request');
      await createArticleFundRequestSheet(worksheet, fundRequest);
    }

    // Generate buffer
    const buffer = await workbook.xlsx.writeBuffer();
    return new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  } catch (error) {
    console.error('Error generating fund request document:', error);
    throw error;
  }
};

/**
 * Populate Aid Fund Request template with data
 */
async function populateAidFundRequestTemplate(
  worksheet: ExcelJS.Worksheet,
  fundRequest: FundRequestWithDetails
): Promise<void> {
  // Find and populate fund request number (usually in row 2 or 3, column B)
  // Search for cells containing "Fund Request Number" or similar
  let fundRequestNumberCell: ExcelJS.Cell | null = null;
  let dataStartRow = 0;
  
  // Search for header row and data start row
  worksheet.eachRow((row, rowNumber) => {
    row.eachCell((cell, colNumber) => {
      const cellValue = cell.value?.toString().toLowerCase() || '';
      if (cellValue.includes('fund request number') || cellValue.includes('fr no')) {
        // The value is usually in the next column
        fundRequestNumberCell = worksheet.getCell(rowNumber, colNumber + 1);
      }
      // Look for table headers to find data start row
      if (cellValue.includes('sl no') || cellValue.includes('beneficiary')) {
        if (dataStartRow === 0) {
          dataStartRow = rowNumber + 1; // Data starts after header row
        }
      }
    });
  });

  // Update fund request number if found
  if (fundRequestNumberCell) {
    fundRequestNumberCell.value = fundRequest.fund_request_number;
  }

  // If we couldn't find the header row, try a different approach
  // Look for the first row with "SL No" or similar
  if (dataStartRow === 0) {
    worksheet.eachRow((row, rowNumber) => {
      const rowText = row.values?.toString().toLowerCase() || '';
      if (rowText.includes('sl no') || rowText.includes('beneficiary')) {
        dataStartRow = rowNumber + 1;
        return false; // Stop iteration
      }
    });
  }

  // Clear existing data rows (keep header and structure)
  // Find the last row with data before signature section
  let lastDataRow = dataStartRow;
  let foundSignature = false;
  
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber >= dataStartRow) {
      const rowText = row.values?.toString().toLowerCase() || '';
      if (rowText.includes('prepared by') || rowText.includes('signature') || rowText.includes('approved by')) {
        foundSignature = true;
        lastDataRow = rowNumber - 1;
        return false; // Stop iteration
      }
      if (!foundSignature) {
        lastDataRow = rowNumber;
      }
    }
  });

  // Clear data rows (keep header)
  if (dataStartRow > 0 && lastDataRow >= dataStartRow) {
    for (let i = dataStartRow; i <= lastDataRow; i++) {
      const row = worksheet.getRow(i);
      row.eachCell((cell) => {
        cell.value = null;
      });
    }
  }

  // Insert recipient data
  if (fundRequest.recipients && fundRequest.recipients.length > 0) {
    const insertRow = dataStartRow > 0 ? dataStartRow : 5; // Default to row 5 if not found
    
    fundRequest.recipients.forEach((recipient, index) => {
      const row = worksheet.getRow(insertRow + index);
      if (row) {
        row.getCell(1).value = index + 1; // SL No
        row.getCell(2).value = recipient.beneficiary || ''; // Beneficiary
        row.getCell(3).value = recipient.name_of_beneficiary || recipient.recipient_name || ''; // Name of beneficiary
        row.getCell(4).value = recipient.name_of_institution || ''; // Name of Institution
        row.getCell(5).value = recipient.details || ''; // Details
        row.getCell(6).value = recipient.fund_requested || 0; // Fund Requested
        row.getCell(7).value = recipient.aadhar_number || ''; // AAdhar No
        row.getCell(8).value = recipient.cheque_in_favour || ''; // Cheque in Favour
        row.getCell(9).value = recipient.cheque_sl_no || ''; // Cheque Sl No
      }
    });

    // Update total row (usually after recipient data)
    const totalRowNumber = insertRow + fundRequest.recipients.length;
    const totalRow = worksheet.getRow(totalRowNumber);
    if (totalRow) {
      const totalAmount = fundRequest.recipients.reduce((sum, r) => sum + (r.fund_requested || 0), 0);
      
      // Find the "Total" cell (usually in column 5 or 6)
      totalRow.eachCell((cell, colNumber) => {
        const cellValue = cell.value?.toString().toLowerCase() || '';
        if (cellValue.includes('total')) {
          // Set total in the next column (Fund Requested column)
          const totalCell = totalRow.getCell(colNumber + 1);
          if (totalCell) {
            totalCell.value = totalAmount;
            totalCell.numFmt = '#,##0.00';
          }
        }
      });
    }
  }

  // Add cumulative totals after signature section
  if (fundRequest.created_at) {
    const previousTotal = await fetchPreviousFundRequestTotal(fundRequest.id!, fundRequest.created_at);
    const currentTotal = fundRequest.total_amount || 0;
    const grandTotal = previousTotal + currentTotal;

    // Find the last row and add cumulative section
    let lastRow = worksheet.lastRow?.number || 0;
    
    // Add spacing
    worksheet.addRow([]);
    lastRow = worksheet.lastRow?.number || lastRow + 1;
    
    // Add cumulative totals
    const prevCumRow = worksheet.addRow(['PREVIOUS CUMULATIVE', '', '', '', '', previousTotal, '', '', '']);
    prevCumRow.getCell(6).numFmt = '#,##0.00';
    prevCumRow.font = { bold: true };
    
    const currentRow = worksheet.addRow(['FUND REQUEST (current)', '', '', '', '', currentTotal, '', '', '']);
    currentRow.getCell(6).numFmt = '#,##0.00';
    currentRow.font = { bold: true };
    
    const totalRow = worksheet.addRow(['TOTAL', '', '', '', '', grandTotal, '', '', '']);
    totalRow.getCell(6).numFmt = '#,##0.00';
    totalRow.font = { bold: true };
    totalRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' },
    };
  }
}

/**
 * Create Aid Fund Request sheet (fallback when template not available)
 */
async function createAidFundRequestSheet(
  worksheet: ExcelJS.Worksheet,
  fundRequest: FundRequestWithDetails
): Promise<void> {
  // Header row
  worksheet.addRow(['FUND REQUEST']);
  worksheet.mergeCells('A1:I1');
  worksheet.getCell('A1').font = { size: 16, bold: true };
  worksheet.getCell('A1').alignment = { horizontal: 'center', vertical: 'middle' };

  // Fund request details
  worksheet.addRow([]);
  worksheet.addRow(['Fund Request Number:', fundRequest.fund_request_number]);

  // Recipients table
  if (fundRequest.recipients && fundRequest.recipients.length > 0) {
    worksheet.addRow([]);
    
    const headers = [
      'SL No',
      'Beneficiary',
      'Name of beneficiary',
      'Name of Institution',
      'Details',
      'Fund Requested',
      'AAdhar No',
      'Cheque in Favour',
      'Cheque Sl No',
    ];

    worksheet.addRow(headers);
    const headerRow = worksheet.lastRow;
    if (headerRow) {
      headerRow.font = { bold: true };
      headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0E0E0' },
      };
      headerRow.alignment = { horizontal: 'center', vertical: 'middle' };
    }

    // Add recipient data
    fundRequest.recipients.forEach((recipient, index) => {
      worksheet.addRow([
        index + 1,
        recipient.beneficiary || '',
        recipient.name_of_beneficiary || recipient.recipient_name || '',
        recipient.name_of_institution || '',
        recipient.details || '',
        recipient.fund_requested || 0,
        recipient.aadhar_number || '',
        recipient.cheque_in_favour || '',
        recipient.cheque_sl_no || '',
      ]);
    });

    // Add total row
    const totalRow = worksheet.addRow([
      '',
      '',
      '',
      '',
      'Total:',
      fundRequest.recipients.reduce((sum, r) => sum + (r.fund_requested || 0), 0),
      '',
      '',
      '',
    ]);
    totalRow.font = { bold: true };
    totalRow.getCell(6).alignment = { horizontal: 'right' };

    // Auto-fit columns
    worksheet.columns.forEach((column) => {
      if (column) {
        column.width = 20;
      }
    });
  }

  // Add signature section
  worksheet.addRow([]);
  worksheet.addRow([]);
  worksheet.addRow(['Prepared by:', '', '', '', '', 'Approved by:', '']);
  worksheet.addRow(['', '', '', '', '', '', '']);
  worksheet.addRow(['Signature:', '', '', '', '', 'Signature:', '']);
  worksheet.addRow(['Date:', '', '', '', '', 'Date:', '']);

  // Add cumulative totals
  if (fundRequest.created_at && fundRequest.id) {
    const previousTotal = await fetchPreviousFundRequestTotal(fundRequest.id, fundRequest.created_at);
    const currentTotal = fundRequest.total_amount || 0;
    const grandTotal = previousTotal + currentTotal;

    // Add spacing
    worksheet.addRow([]);
    
    // Add cumulative totals
    const prevCumRow = worksheet.addRow(['PREVIOUS CUMULATIVE', '', '', '', '', previousTotal, '', '', '']);
    prevCumRow.getCell(6).numFmt = '#,##0.00';
    prevCumRow.font = { bold: true };
    
    const currentRow = worksheet.addRow(['FUND REQUEST (current)', '', '', '', '', currentTotal, '', '', '']);
    currentRow.getCell(6).numFmt = '#,##0.00';
    currentRow.font = { bold: true };
    
    const totalRow = worksheet.addRow(['TOTAL', '', '', '', '', grandTotal, '', '', '']);
    totalRow.getCell(6).numFmt = '#,##0.00';
    totalRow.font = { bold: true };
    totalRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' },
    };
  }

  // Notes
  if (fundRequest.notes) {
    worksheet.addRow([]);
    worksheet.addRow(['Notes:', fundRequest.notes]);
  }
}

/**
 * Create Article Fund Request sheet
 */
async function createArticleFundRequestSheet(
  worksheet: ExcelJS.Worksheet,
  fundRequest: FundRequestWithDetails
): Promise<void> {
  // Header row
  worksheet.addRow(['FUND REQUEST - ARTICLE']);
  worksheet.mergeCells('A1:J1');
  worksheet.getCell('A1').font = { size: 16, bold: true };
  worksheet.getCell('A1').alignment = { horizontal: 'center', vertical: 'middle' };

  // Fund request details
  worksheet.addRow([]);
  worksheet.addRow(['Fund Request Number:', fundRequest.fund_request_number]);
  worksheet.addRow(['Cheque in Favour:', fundRequest.cheque_in_favour || '']);

  // Articles table
  if (fundRequest.articles && fundRequest.articles.length > 0) {
    worksheet.addRow([]);
    
    const headers = [
      'SL.NO',
      'BENIFICIARY',
      'ARTICLE NAME',
      'GST NO.',
      'QTY',
      'PRICE INCLUDING GST',
      'VALUE',
      'CUMULATIVE',
      'GRAND TOTAL',
      'CHEQUE IN FAVOUR',
    ];

    worksheet.addRow(headers);
    const headerRow = worksheet.lastRow;
    if (headerRow) {
      headerRow.font = { bold: true };
      headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0E0E0' },
      };
      headerRow.alignment = { horizontal: 'center', vertical: 'middle' };
    }

    // Add article data
    fundRequest.articles.forEach((article) => {
      worksheet.addRow([
        article.sl_no || '',
        article.beneficiary || '',
        article.article_name,
        article.gst_no || '',
        article.quantity,
        article.price_including_gst,
        article.value,
        article.cumulative,
        fundRequest.total_amount,
        fundRequest.cheque_in_favour || '',
      ]);
    });

    // Add total row
    const totalRow = worksheet.addRow([
      '',
      '',
      'Total:',
      '',
      '',
      '',
      fundRequest.articles.reduce((sum, a) => sum + a.value, 0),
      '',
      fundRequest.total_amount,
      '',
    ]);
    totalRow.font = { bold: true };
    totalRow.getCell(7).alignment = { horizontal: 'right' };
    totalRow.getCell(9).alignment = { horizontal: 'right' };

    // Auto-fit columns
    worksheet.columns.forEach((column) => {
      if (column) {
        column.width = 20;
      }
    });
  }

  // Add signature section
  worksheet.addRow([]);
  worksheet.addRow([]);
  worksheet.addRow(['Prepared by:', '', '', '', '', 'Approved by:', '']);
  worksheet.addRow(['', '', '', '', '', '', '']);
  worksheet.addRow(['Signature:', '', '', '', '', 'Signature:', '']);
  worksheet.addRow(['Date:', '', '', '', '', 'Date:', '']);

  // Notes
  if (fundRequest.notes) {
    worksheet.addRow([]);
    worksheet.addRow(['Notes:', fundRequest.notes]);
  }
}

/**
 * Store document metadata
 */
export const storeDocumentMetadata = async (
  fundRequestId: string,
  documentType: 'fund_request' | 'purchase_order',
  fileName: string,
  filePath?: string
): Promise<void> => {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const userId = session?.user?.id || null;

    const { error } = await supabase
      .from('fund_request_documents')
      .insert([{
        fund_request_id: fundRequestId,
        document_type: documentType,
        file_name: fileName,
        file_path: filePath,
        generated_by: userId,
      }]);

    if (error) {
      console.error('Error storing document metadata:', error);
      throw error;
    }
  } catch (error) {
    console.error('Failed to store document metadata:', error);
    throw error;
  }
};

/**
 * Generate Purchase Order document (on hold - placeholder)
 */
export const generatePurchaseOrderDocument = async (fundRequestId: string): Promise<Blob> => {
  // TODO: Implement when template is provided
  throw new Error('Purchase Order document generation is not yet implemented');
};
