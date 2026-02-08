import ExcelJS from 'exceljs';
import { supabase } from '../lib/supabase';
import { fetchFundRequestById, fetchPreviousFundRequestTotal, type FundRequestWithDetails } from './fundRequestService';
import { aidFundRequestConfig } from '../config/excelTemplateConfig';
import { pdf } from '@react-pdf/renderer';
import React from 'react';
import FundRequestPDFDocument from '../components/FundRequestPDFDocument';

// Flag to enable/disable XLSX generation (currently disabled)
const ENABLE_XLSX_GENERATION = true;

/**
 * Generate Fund Request PDF document
 */
export const generateFundRequestPDF = async (
  fundRequestId: string,
  _type: 'Aid' | 'Article'
): Promise<Blob> => {
  try {
    const fundRequest = await fetchFundRequestById(fundRequestId);
    if (!fundRequest) {
      throw new Error('Fund request not found');
    }

    // Calculate previous cumulative total
    let previousCumulative = 0;
    if (fundRequest.created_at && fundRequest.id) {
      previousCumulative = await fetchPreviousFundRequestTotal(fundRequest.id, fundRequest.created_at);
    }

    // Generate PDF using React PDF
    const pdfDoc = React.createElement(FundRequestPDFDocument, {
      fundRequest,
      previousCumulative,
    }) as React.ReactElement;

    // Generate PDF blob
    const pdfBlob = await pdf(pdfDoc).toBlob();
    return pdfBlob;
  } catch (error) {
    console.error('Error generating fund request PDF:', error);
    throw error;
  }
};

/**
 * Generate Fund Request XLSX document (disabled by default)
 */
export const generateFundRequestXLSX = async (
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
    console.error('Error generating fund request XLSX:', error);
    throw error;
  }
};

/**
 * Generate Fund Request document for Aid or Article
 * Defaults to PDF generation (XLSX is disabled)
 */
export const generateFundRequestDocument = async (
  fundRequestId: string,
  type: 'Aid' | 'Article'
): Promise<Blob> => {
  // Use PDF by default, XLSX is disabled
  if (ENABLE_XLSX_GENERATION) {
    return generateFundRequestXLSX(fundRequestId, type);
  } else {
    return generateFundRequestPDF(fundRequestId, type);
  }
};

/**
 * Populate Aid Fund Request template with data using config-based approach
 */
async function populateAidFundRequestTemplate(
  worksheet: ExcelJS.Worksheet,
  fundRequest: FundRequestWithDetails
): Promise<void> {
  const config = aidFundRequestConfig;

  // 1. Populate fund request number
  const frNumberCell = worksheet.getCell(config.fundRequestNumber);
  frNumberCell.value = fundRequest.fund_request_number;

  // 2. Clear existing data rows (from data start row to before signature)
  const dataStartRow = config.dataTable.startRow;
  const columns = config.dataTable.columns;
  
  // Find where signature section starts (look for "Prepared by" or similar)
  let signatureStartRow = 0;
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber >= dataStartRow) {
      const rowText = row.values?.toString().toLowerCase() || '';
      if (rowText.includes('prepared by') || rowText.includes('signature') || rowText.includes('approved by')) {
        signatureStartRow = rowNumber;
        return false; // Stop iteration
      }
    }
  });

  // Clear data rows (keep header row which is dataStartRow - 1)
  const lastDataRow = signatureStartRow > 0 ? signatureStartRow - 1 : dataStartRow + 10; // Fallback
  for (let i = dataStartRow; i <= lastDataRow; i++) {
    const row = worksheet.getRow(i);
    if (row) {
      // Clear only data columns, preserve any formatting
      Object.values(columns).forEach((col) => {
        const cell = row.getCell(col);
        if (cell) {
          cell.value = null;
        }
      });
    }
  }

  // 3. Insert recipient data
  if (fundRequest.recipients && fundRequest.recipients.length > 0) {
    fundRequest.recipients.forEach((recipient, index) => {
      const rowNumber = dataStartRow + index;
      const row = worksheet.getRow(rowNumber);
      
      if (row) {
        row.getCell(columns.slNo).value = index + 1;
        row.getCell(columns.beneficiary).value = recipient.beneficiary || '';
        row.getCell(columns.nameOfBeneficiary).value = recipient.name_of_beneficiary || recipient.recipient_name || '';
        row.getCell(columns.nameOfInstitution).value = recipient.name_of_institution || '';
        row.getCell(columns.details).value = recipient.details || '';
        row.getCell(columns.fundRequested).value = recipient.fund_requested || 0;
        row.getCell(columns.aadharNo).value = recipient.aadhar_number || '';
        row.getCell(columns.chequeInFavour).value = recipient.cheque_in_favour || '';
        row.getCell(columns.chequeSlNo).value = recipient.cheque_sl_no || '';
      }
    });

    // 4. Update total row
    const totalRowNumber = config.totalRow.row > 0 
      ? config.totalRow.row 
      : dataStartRow + fundRequest.recipients.length;
    
    const totalRow = worksheet.getRow(totalRowNumber);
    if (totalRow) {
      const totalAmount = fundRequest.recipients.reduce((sum, r) => sum + (r.fund_requested || 0), 0);
      totalRow.getCell(config.totalRow.totalLabelColumn).value = 'Total:';
      const totalCell = totalRow.getCell(config.totalRow.totalValueColumn);
      totalCell.value = totalAmount;
      totalCell.numFmt = '#,##0.00';
      totalRow.font = { bold: true };
    }
  }

  // 5. Calculate signature section start row (if dynamic)
  let sigStartRow = config.signatureSection.startRow;
  if (sigStartRow === 0) {
    // Calculate: after total row + 2 blank rows
    const totalRowNum = config.totalRow.row > 0 
      ? config.totalRow.row 
      : dataStartRow + (fundRequest.recipients?.length || 0);
    sigStartRow = totalRowNum + 3;
  }

  // 6. Populate signature section (labels are already in template, we just ensure they exist)
  // Signature section is usually already in template, so we don't need to add it

  // 7. Add cumulative totals section
  if (fundRequest.created_at && fundRequest.id) {
    const previousTotal = await fetchPreviousFundRequestTotal(fundRequest.id, fundRequest.created_at);
    const currentTotal = fundRequest.total_amount || 0;
    const grandTotal = previousTotal + currentTotal;

    // Calculate cumulative section start row
    let cumStartRow = config.cumulativeSection.startRow;
    if (cumStartRow === 0) {
      // Find last row with content, then add 2 blank rows
      let lastContentRow = sigStartRow + 5; // Signature section is usually 5-6 rows
      worksheet.eachRow((row, rowNumber) => {
        if (rowNumber > lastContentRow) {
          const values = row.values;
          if (Array.isArray(values)) {
            const hasContent = values.some((val: any) => val !== null && val !== '') || false;
            if (hasContent) {
              lastContentRow = rowNumber;
            }
          }
        }
      });
      cumStartRow = lastContentRow + 2;
    }

    // Add cumulative totals
    const prevCumRow = worksheet.getRow(cumStartRow);
    prevCumRow.getCell(config.cumulativeSection.previousCumulative.labelCell).value = 'PREVIOUS CUMULATIVE';
    prevCumRow.getCell(config.cumulativeSection.previousCumulative.valueCell).value = previousTotal;
    prevCumRow.getCell(config.cumulativeSection.previousCumulative.valueCell).numFmt = '#,##0.00';
    prevCumRow.font = { bold: true };

    const currentRow = worksheet.getRow(cumStartRow + 1);
    currentRow.getCell(config.cumulativeSection.currentRequest.labelCell).value = 'FUND REQUEST (current)';
    currentRow.getCell(config.cumulativeSection.currentRequest.valueCell).value = currentTotal;
    currentRow.getCell(config.cumulativeSection.currentRequest.valueCell).numFmt = '#,##0.00';
    currentRow.font = { bold: true };

    const totalCumRow = worksheet.getRow(cumStartRow + 2);
    totalCumRow.getCell(config.cumulativeSection.total.labelCell).value = 'TOTAL';
    totalCumRow.getCell(config.cumulativeSection.total.valueCell).value = grandTotal;
    totalCumRow.getCell(config.cumulativeSection.total.valueCell).numFmt = '#,##0.00';
    totalCumRow.font = { bold: true };
    totalCumRow.fill = {
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
        '', // cheque_in_favour not available for Article type
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
export const generatePurchaseOrderDocument = async (_fundRequestId: string): Promise<Blob> => {
  // TODO: Implement when template is provided
  throw new Error('Purchase Order document generation is not yet implemented');
};
