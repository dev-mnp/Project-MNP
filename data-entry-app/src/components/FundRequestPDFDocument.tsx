import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import type { FundRequestWithDetails } from '../services/fundRequestService';

// Define styles
const styles = StyleSheet.create({
  page: {
    padding: 30,
    fontSize: 10,
    fontFamily: 'Helvetica',
  },
  header: {
    marginBottom: 20,
    textAlign: 'center',
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  infoRow: {
    marginBottom: 5,
    flexDirection: 'row',
  },
  infoLabel: {
    fontWeight: 'bold',
    width: 150,
  },
  infoValue: {
    flex: 1,
  },
  table: {
    marginTop: 20,
    marginBottom: 20,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    paddingVertical: 5,
  },
  tableHeader: {
    backgroundColor: '#f0f0f0',
    fontWeight: 'bold',
    paddingVertical: 8,
  },
  tableCell: {
    paddingHorizontal: 5,
    fontSize: 9,
  },
  colSlNo: { width: '5%' },
  colBeneficiary: { width: '12%' },
  colName: { width: '15%' },
  colInstitution: { width: '15%' },
  colDetails: { width: '18%' },
  colFundRequested: { width: '12%', textAlign: 'right' },
  colAadhar: { width: '10%' },
  colChequeFavour: { width: '8%' },
  colChequeSl: { width: '5%' },
  totalRow: {
    fontWeight: 'bold',
    backgroundColor: '#f5f5f5',
    paddingVertical: 8,
  },
  signatureSection: {
    marginTop: 30,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  signatureBlock: {
    width: '45%',
  },
  signatureLabel: {
    marginBottom: 30,
    fontSize: 9,
  },
  signatureLine: {
    borderBottomWidth: 1,
    borderBottomColor: '#000',
    marginBottom: 5,
    height: 20,
  },
  cumulativeSection: {
    marginTop: 30,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    paddingTop: 10,
  },
  cumulativeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 5,
    paddingVertical: 3,
  },
  cumulativeLabel: {
    fontWeight: 'bold',
    width: '60%',
  },
  cumulativeValue: {
    width: '40%',
    textAlign: 'right',
  },
  cumulativeTotal: {
    backgroundColor: '#e0e0e0',
    paddingVertical: 5,
    fontWeight: 'bold',
  },
});

interface FundRequestPDFDocumentProps {
  fundRequest: FundRequestWithDetails;
  previousCumulative: number;
}

const FundRequestPDFDocument: React.FC<FundRequestPDFDocumentProps> = ({ 
  fundRequest, 
  previousCumulative 
}) => {
  const currentTotal = fundRequest.total_amount || 0;
  const grandTotal = previousCumulative + currentTotal;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>FUND REQUEST</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Fund Request Number:</Text>
            <Text style={styles.infoValue}>{fundRequest.fund_request_number}</Text>
          </View>
          {fundRequest.aid_type && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Aid Type:</Text>
              <Text style={styles.infoValue}>{fundRequest.aid_type}</Text>
            </View>
          )}
        </View>

        {/* Table */}
        {fundRequest.recipients && fundRequest.recipients.length > 0 && (
          <View style={styles.table}>
            {/* Table Header */}
            <View style={[styles.tableRow, styles.tableHeader]}>
              <Text style={[styles.tableCell, styles.colSlNo]}>SL No</Text>
              <Text style={[styles.tableCell, styles.colBeneficiary]}>Beneficiary</Text>
              <Text style={[styles.tableCell, styles.colName]}>Name of beneficiary</Text>
              <Text style={[styles.tableCell, styles.colInstitution]}>Name of Institution</Text>
              <Text style={[styles.tableCell, styles.colDetails]}>Details</Text>
              <Text style={[styles.tableCell, styles.colFundRequested]}>Fund Requested</Text>
              <Text style={[styles.tableCell, styles.colAadhar]}>AAdhar No</Text>
              <Text style={[styles.tableCell, styles.colChequeFavour]}>Cheque in Favour</Text>
              <Text style={[styles.tableCell, styles.colChequeSl]}>Cheque Sl No</Text>
            </View>

            {/* Table Rows */}
            {fundRequest.recipients.map((recipient, index) => (
              <View key={index} style={styles.tableRow}>
                <Text style={[styles.tableCell, styles.colSlNo]}>{index + 1}</Text>
                <Text style={[styles.tableCell, styles.colBeneficiary]}>
                  {recipient.beneficiary || ''}
                </Text>
                <Text style={[styles.tableCell, styles.colName]}>
                  {recipient.name_of_beneficiary || recipient.recipient_name || ''}
                </Text>
                <Text style={[styles.tableCell, styles.colInstitution]}>
                  {recipient.name_of_institution || ''}
                </Text>
                <Text style={[styles.tableCell, styles.colDetails]}>
                  {recipient.details || ''}
                </Text>
                <Text style={[styles.tableCell, styles.colFundRequested]}>
                  {recipient.fund_requested?.toLocaleString('en-IN', { 
                    minimumFractionDigits: 2, 
                    maximumFractionDigits: 2 
                  }) || '0.00'}
                </Text>
                <Text style={[styles.tableCell, styles.colAadhar]}>
                  {recipient.aadhar_number || ''}
                </Text>
                <Text style={[styles.tableCell, styles.colChequeFavour]}>
                  {recipient.cheque_in_favour || ''}
                </Text>
                <Text style={[styles.tableCell, styles.colChequeSl]}>
                  {recipient.cheque_sl_no || ''}
                </Text>
              </View>
            ))}

            {/* Total Row */}
            <View style={[styles.tableRow, styles.totalRow]}>
              <Text style={[styles.tableCell, styles.colSlNo]}></Text>
              <Text style={[styles.tableCell, styles.colBeneficiary]}></Text>
              <Text style={[styles.tableCell, styles.colName]}></Text>
              <Text style={[styles.tableCell, styles.colInstitution]}></Text>
              <Text style={[styles.tableCell, styles.colDetails]}>Total:</Text>
              <Text style={[styles.tableCell, styles.colFundRequested]}>
                {fundRequest.recipients.reduce((sum, r) => sum + (r.fund_requested || 0), 0)
                  .toLocaleString('en-IN', { 
                    minimumFractionDigits: 2, 
                    maximumFractionDigits: 2 
                  })}
              </Text>
              <Text style={[styles.tableCell, styles.colAadhar]}></Text>
              <Text style={[styles.tableCell, styles.colChequeFavour]}></Text>
              <Text style={[styles.tableCell, styles.colChequeSl]}></Text>
            </View>
          </View>
        )}

        {/* Signature Section */}
        <View style={styles.signatureSection}>
          <View style={styles.signatureBlock}>
            <Text style={styles.signatureLabel}>Prepared by:</Text>
            <View style={styles.signatureLine}></View>
            <Text style={styles.signatureLabel}>Signature:</Text>
            <View style={styles.signatureLine}></View>
            <Text style={styles.signatureLabel}>Date:</Text>
            <View style={styles.signatureLine}></View>
          </View>
          <View style={styles.signatureBlock}>
            <Text style={styles.signatureLabel}>Approved by:</Text>
            <View style={styles.signatureLine}></View>
            <Text style={styles.signatureLabel}>Signature:</Text>
            <View style={styles.signatureLine}></View>
            <Text style={styles.signatureLabel}>Date:</Text>
            <View style={styles.signatureLine}></View>
          </View>
        </View>

        {/* Cumulative Totals Section */}
        <View style={styles.cumulativeSection}>
          <View style={styles.cumulativeRow}>
            <Text style={styles.cumulativeLabel}>PREVIOUS CUMULATIVE</Text>
            <Text style={styles.cumulativeValue}>
              {previousCumulative.toLocaleString('en-IN', { 
                minimumFractionDigits: 2, 
                maximumFractionDigits: 2 
              })}
            </Text>
          </View>
          <View style={styles.cumulativeRow}>
            <Text style={styles.cumulativeLabel}>FUND REQUEST (current)</Text>
            <Text style={styles.cumulativeValue}>
              {currentTotal.toLocaleString('en-IN', { 
                minimumFractionDigits: 2, 
                maximumFractionDigits: 2 
              })}
            </Text>
          </View>
          <View style={[styles.cumulativeRow, styles.cumulativeTotal]}>
            <Text style={styles.cumulativeLabel}>TOTAL</Text>
            <Text style={styles.cumulativeValue}>
              {grandTotal.toLocaleString('en-IN', { 
                minimumFractionDigits: 2, 
                maximumFractionDigits: 2 
              })}
            </Text>
          </View>
        </View>
      </Page>
    </Document>
  );
};

export default FundRequestPDFDocument;

