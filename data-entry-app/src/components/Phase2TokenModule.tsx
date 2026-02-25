import React, { useMemo, useRef, useState } from 'react';
import { Download, FileUp, RefreshCw } from 'lucide-react';
import { useNotifications } from '../contexts/NotificationContext';
import { fetchSeatAllocationRows } from '../services/seatAllocationService';
import { exportToCSV } from '../utils/csvExport';

const DEFAULT_SESSION_NAME = 'default';

type SourceMode = 'db' | 'csv';

type TokenRow = {
  applicationNumber: string;
  district: string;
  beneficiaryType: string;
  beneficiaryName: string;
  requestedItem: string;
  quantity: number;
  waitingHallQuantity: number;
  tokenQuantity: number;
  sequenceNo: number;
  aadharNumber: string;
  notes: string;
};

const normalizeHeader = (header: string) => header.trim().toLowerCase().replace(/\s+/g, ' ');

const findHeaderName = (headers: string[], candidates: string[]): string | null => {
  const byNormalized = new Map(headers.map((h) => [normalizeHeader(h), h]));
  for (const candidate of candidates) {
    const found = byNormalized.get(normalizeHeader(candidate));
    if (found) return found;
  }
  return null;
};

const parseCSVRows = (text: string): string[][] => {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        field += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === ',' && !inQuotes) {
      row.push(field);
      field = '';
      continue;
    }

    if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') i++;
      row.push(field);
      if (row.some((cell) => cell.trim() !== '')) rows.push(row);
      row = [];
      field = '';
      continue;
    }

    field += char;
  }

  row.push(field);
  if (row.some((cell) => cell.trim() !== '')) rows.push(row);
  return rows;
};

const parseNumber = (value: unknown): number => {
  const raw = String(value ?? '').replace(/,/g, '').trim();
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : 0;
};

const beneficiaryTypePriority = (type: string): number => {
  const normalized = type.trim().toLowerCase();
  if (normalized === 'district') return 1;
  if (normalized === 'public') return 2;
  if (normalized === 'institutions') return 3;
  if (normalized === 'others') return 4;
  return 9;
};

const sortTokenRows = (rows: TokenRow[]): TokenRow[] =>
  [...rows].sort((a, b) => {
    if (a.sequenceNo !== b.sequenceNo) return a.sequenceNo - b.sequenceNo;
    const typeDiff = beneficiaryTypePriority(a.beneficiaryType) - beneficiaryTypePriority(b.beneficiaryType);
    if (typeDiff !== 0) return typeDiff;
    const districtDiff = a.district.localeCompare(b.district, undefined, { sensitivity: 'base' });
    if (districtDiff !== 0) return districtDiff;
    return a.applicationNumber.localeCompare(b.applicationNumber, undefined, { sensitivity: 'base' });
  });

const Phase2TokenModule: React.FC = () => {
  const { showError, showSuccess, showWarning } = useNotifications();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [sourceMode, setSourceMode] = useState<SourceMode>('db');
  const [isLoadingDb, setIsLoadingDb] = useState(false);
  const [isLoadingCsv, setIsLoadingCsv] = useState(false);
  const [sourceFileName, setSourceFileName] = useState('');
  const [rows, setRows] = useState<TokenRow[]>([]);

  const usableRows = useMemo(() => sortTokenRows(rows.filter((r) => r.tokenQuantity > 0 || r.waitingHallQuantity > 0)), [rows]);

  const handleLoadFromDb = async () => {
    try {
      setIsLoadingDb(true);
      setSourceMode('db');
      const data = await fetchSeatAllocationRows(DEFAULT_SESSION_NAME);
      if (!data.length) {
        showWarning('No Seat Allocation rows found in DB.');
        setRows([]);
        return;
      }

      const mapped: TokenRow[] = data.map((row) => {
        const master = (row.master_row || {}) as Record<string, any>;
        const sequenceNo = parseNumber(master['Sequence No']);
        return {
          applicationNumber: row.application_number || String(master['Application Number'] || master['App No'] || ''),
          district: row.district || String(master['District'] || ''),
          beneficiaryType: row.beneficiary_type || String(master['Beneficiary Type'] || ''),
          beneficiaryName: row.beneficiary_name || String(master['Beneficiary Name'] || ''),
          requestedItem: row.requested_item || String(master['Requested Item'] || master['Item'] || ''),
          quantity: parseNumber(row.quantity),
          waitingHallQuantity: parseNumber(row.waiting_hall_quantity),
          tokenQuantity: parseNumber(row.token_quantity),
          sequenceNo: sequenceNo > 0 ? sequenceNo : 999999,
          aadharNumber: String(master['Aadhar No'] || master['Aadhaar No'] || ''),
          notes: String(master['Notes'] || master['Comments'] || ''),
        };
      });

      setRows(mapped);
      setSourceFileName(data[0]?.source_file_name || 'seat_allocation_db');
      showSuccess(`Loaded ${mapped.length} row(s) from DB.`);
    } catch (error) {
      console.error('Failed to load token source from DB:', error);
      showError('Failed to load from Seat Allocation DB.');
    } finally {
      setIsLoadingDb(false);
    }
  };

  const handleUploadCsv = async (file: File) => {
    try {
      setIsLoadingCsv(true);
      setSourceMode('csv');
      const text = await file.text();
      const parsed = parseCSVRows(text);
      if (parsed.length < 2) {
        showError('CSV is empty or invalid.');
        return;
      }

      const headers = parsed[0].map((h) => h.trim());
      const idx = new Map(headers.map((h, i) => [h, i]));

      const appHeader = findHeaderName(headers, ['Application Number', 'App No']);
      const districtHeader = findHeaderName(headers, ['District']);
      const typeHeader = findHeaderName(headers, ['Beneficiary Type']);
      const beneficiaryHeader = findHeaderName(headers, ['Beneficiary Name', 'Name of Beneficiary']);
      const itemHeader = findHeaderName(headers, ['Requested Item', 'Item', 'Article', 'Article Name']);
      const quantityHeader = findHeaderName(headers, ['Quantity']);
      const waitingHeader = findHeaderName(headers, ['Waiting Hall Quantity']);
      const tokenHeader = findHeaderName(headers, ['Token Quantity']);
      const sequenceHeader = findHeaderName(headers, ['Sequence No']);
      const aadharHeader = findHeaderName(headers, ['Aadhar No', 'Aadhaar No']);
      const notesHeader = findHeaderName(headers, ['Notes', 'Comments']);

      if (!itemHeader || !tokenHeader || !waitingHeader) {
        showError('Missing required columns: Item, Waiting Hall Quantity, Token Quantity.');
        return;
      }

      const mapped: TokenRow[] = parsed.slice(1).map((cells) => ({
        applicationNumber: appHeader ? String(cells[idx.get(appHeader) || 0] || '').trim() : '',
        district: districtHeader ? String(cells[idx.get(districtHeader) || 0] || '').trim() : '',
        beneficiaryType: typeHeader ? String(cells[idx.get(typeHeader) || 0] || '').trim() : '',
        beneficiaryName: beneficiaryHeader ? String(cells[idx.get(beneficiaryHeader) || 0] || '').trim() : '',
        requestedItem: String(cells[idx.get(itemHeader) || 0] || '').trim(),
        quantity: quantityHeader ? parseNumber(cells[idx.get(quantityHeader) || 0]) : 0,
        waitingHallQuantity: parseNumber(cells[idx.get(waitingHeader) || 0]),
        tokenQuantity: parseNumber(cells[idx.get(tokenHeader) || 0]),
        sequenceNo: sequenceHeader ? parseNumber(cells[idx.get(sequenceHeader) || 0]) || 999999 : 999999,
        aadharNumber: aadharHeader ? String(cells[idx.get(aadharHeader) || 0] || '').trim() : '',
        notes: notesHeader ? String(cells[idx.get(notesHeader) || 0] || '').trim() : '',
      })).filter((r) => r.requestedItem);

      setRows(mapped);
      setSourceFileName(file.name);
      showSuccess(`Loaded ${mapped.length} row(s) from CSV.`);
    } catch (error) {
      console.error('Failed to parse token source CSV:', error);
      showError('Failed to parse CSV.');
    } finally {
      setIsLoadingCsv(false);
    }
  };

  const exportBeneficiaryTokens = () => {
    const tokenRows = sortTokenRows(usableRows.filter((r) => r.tokenQuantity > 0));
    if (!tokenRows.length) {
      showWarning('No token rows found.');
      return;
    }
    const exportRows = tokenRows.map((row, index) => ({
      'Token No': index + 1,
      'Sequence No': row.sequenceNo === 999999 ? '' : row.sequenceNo,
      'Beneficiary Type': row.beneficiaryType,
      District: row.district,
      'Application Number': row.applicationNumber,
      'Beneficiary Name': row.beneficiaryName,
      Item: row.requestedItem,
      'Token Quantity': row.tokenQuantity,
    }));

    exportToCSV(
      exportRows,
      'token-beneficiary-list',
      ['Token No', 'Sequence No', 'Beneficiary Type', 'District', 'Application Number', 'Beneficiary Name', 'Item', 'Token Quantity'],
      showWarning
    );
    showSuccess('Beneficiary token list exported.');
  };

  const exportStickerList = (packSize: 2 | 12) => {
    const tokenRows = sortTokenRows(usableRows.filter((r) => r.tokenQuantity > 0));
    if (!tokenRows.length) {
      showWarning('No token rows found.');
      return;
    }

    const exportRows = tokenRows.map((row) => ({
      'Sequence No': row.sequenceNo === 999999 ? '' : row.sequenceNo,
      Item: row.requestedItem,
      District: row.district,
      'Application Number': row.applicationNumber,
      'Token Quantity': row.tokenQuantity,
      'Sticker Type': `${packSize}L`,
      'Sticker Count': Math.ceil(row.tokenQuantity / packSize),
    }));

    exportToCSV(
      exportRows,
      `token-stickers-${packSize}l`,
      ['Sequence No', 'Item', 'District', 'Application Number', 'Token Quantity', 'Sticker Type', 'Sticker Count'],
      showWarning
    );
    showSuccess(`${packSize}L sticker list exported.`);
  };

  const exportVipChairLabels = () => {
    const tokenRows = sortTokenRows(usableRows.filter((r) => r.tokenQuantity > 0));
    if (!tokenRows.length) {
      showWarning('No token rows found.');
      return;
    }

    const exportRows = tokenRows.map((row, index) => ({
      'Chair No': index + 1,
      VIP: row.notes.toLowerCase().includes('vip') ? 'Yes' : 'No',
      'Beneficiary Type': row.beneficiaryType,
      District: row.district,
      'Application Number': row.applicationNumber,
      'Beneficiary Name': row.beneficiaryName,
      Item: row.requestedItem,
    }));

    exportToCSV(
      exportRows,
      'token-vip-chair-labels',
      ['Chair No', 'VIP', 'Beneficiary Type', 'District', 'Application Number', 'Beneficiary Name', 'Item'],
      showWarning
    );
    showSuccess('VIP/Chair labels exported.');
  };

  const exportPublicAcknowledgment = () => {
    const publicRows = sortTokenRows(
      usableRows.filter((r) => r.beneficiaryType.toLowerCase() === 'public' && r.waitingHallQuantity > 0)
    );
    if (!publicRows.length) {
      showWarning('No public waiting-hall rows found.');
      return;
    }

    const exportRows = publicRows.map((row) => ({
      'Application Number': row.applicationNumber,
      'Name of Beneficiary': row.beneficiaryName,
      'Aadhar No': row.aadharNumber,
      Item: row.requestedItem,
      'Waiting Hall Quantity': row.waitingHallQuantity,
      District: row.district,
      Notes: row.notes,
    }));

    exportToCSV(
      exportRows,
      'public-acknowledgment-autofill',
      ['Application Number', 'Name of Beneficiary', 'Aadhar No', 'Item', 'Waiting Hall Quantity', 'District', 'Notes'],
      showWarning
    );
    showSuccess('Public acknowledgment autofill file exported.');
  };

  return (
    <div className="p-3 sm:p-4">
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-3 sm:p-4 mb-3 shadow-sm">
        <div className="flex flex-col gap-3">
          <div className="border-b border-gray-200 dark:border-gray-700 pb-2">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
              <h1 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white">Token Module</h1>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleLoadFromDb}
                  disabled={isLoadingDb}
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-50"
                >
                  <RefreshCw className={`w-4 h-4 ${isLoadingDb ? 'animate-spin' : ''}`} />
                  Use Sequenced DB
                </button>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isLoadingCsv}
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm disabled:opacity-50"
                >
                  <FileUp className="w-4 h-4" />
                  {isLoadingCsv ? 'Uploading...' : 'Upload Sequenced CSV'}
                </button>
              </div>
            </div>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleUploadCsv(file);
              e.currentTarget.value = '';
            }}
          />

          <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600 dark:text-gray-300">
            <span>Source: <strong>{sourceMode === 'db' ? 'DB' : 'CSV'}</strong></span>
            <span>Rows: <strong>{rows.length}</strong></span>
            <span>Usable Rows: <strong>{usableRows.length}</strong></span>
            {sourceFileName ? <span>File: <strong>{sourceFileName}</strong></span> : null}
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-3 sm:p-4 mb-3 shadow-sm">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Exports</h2>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={exportBeneficiaryTokens} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-green-300 text-green-700 dark:text-green-300 text-sm hover:bg-green-50 dark:hover:bg-green-900/30">
            <Download className="w-4 h-4" />
            Beneficiary Tokens
          </button>
          <button type="button" onClick={() => exportStickerList(2)} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-amber-300 text-amber-700 dark:text-amber-300 text-sm hover:bg-amber-50 dark:hover:bg-amber-900/30">
            <Download className="w-4 h-4" />
            Sticker 2L
          </button>
          <button type="button" onClick={() => exportStickerList(12)} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-amber-300 text-amber-700 dark:text-amber-300 text-sm hover:bg-amber-50 dark:hover:bg-amber-900/30">
            <Download className="w-4 h-4" />
            Sticker 12L
          </button>
          <button type="button" onClick={exportVipChairLabels} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-purple-300 text-purple-700 dark:text-purple-300 text-sm hover:bg-purple-50 dark:hover:bg-purple-900/30">
            <Download className="w-4 h-4" />
            VIP / Chair Labels
          </button>
          <button type="button" onClick={exportPublicAcknowledgment} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-indigo-300 text-indigo-700 dark:text-indigo-300 text-sm hover:bg-indigo-50 dark:hover:bg-indigo-900/30">
            <Download className="w-4 h-4" />
            Public Acknowledgment
          </button>
        </div>
      </div>
    </div>
  );
};

export default Phase2TokenModule;
