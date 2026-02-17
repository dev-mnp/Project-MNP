import React from 'react';
import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer';
import type { FundRequestWithDetails } from '../services/fundRequestService';
import { formatDate, getBeneficiaryDisplayValue } from '../utils/fundRequestUtils';

/**
 * Break long text into chunks that fit within a given width
 * This helps with wrapping text that has no spaces
 * In React PDF, we insert spaces to allow natural wrapping
 */
const breakLongText = (text: string, maxLength: number = 20): string => {
  if (!text || text.length <= maxLength) return text;
  
  // For strings with spaces or hyphens, let React PDF handle wrapping naturally
  if (text.includes(' ') || text.includes('-')) {
    return text;
  }
  
  // For very long strings without spaces, insert spaces at regular intervals
  // This allows React PDF to wrap the text naturally
  const chunks: string[] = [];
  for (let i = 0; i < text.length; i += maxLength) {
    chunks.push(text.slice(i, i + maxLength));
  }
  // Join with spaces instead of newlines - React PDF will wrap on spaces
  return chunks.join(' ');
};

// Define styles
const styles = StyleSheet.create({
  page: {
    padding: 30,
    fontSize: 11,
    fontFamily: 'Helvetica',
  },
  headerSection: {
  flexDirection: 'row',
  marginBottom: 20,
  alignItems: 'flex-start',
},
  logoSection: {
    width: '30%',
    marginRight: 20,
  },
  logo: {
  width: '100%',
  height: 70,
  objectFit: 'contain',
},
  companyInfo: {
    fontSize: 9,
    lineHeight: 1.4,
    marginTop: 5,
  },
  companyInfoLine: {
    marginBottom: 2,
  },
  centerHeader: {
  width: '60%',
  alignItems: 'center',
  paddingTop: 5,
},
  rightHeader: {
  width: '20%',
  alignItems: 'flex-end',
  paddingTop: 5,
},
  leftHeader: {
  width: '20%',
  alignItems: 'flex-start',
  paddingTop: 5,
},
  guruLogo: {
  width: '100%',
  height: 70,
  objectFit: 'contain',
},
  header: {
  textAlign: 'center',
  width: '100%',
},

  omsakthiTitle: {
  fontSize: 14,
  fontWeight: 'bold',
  marginBottom: 6,
  textAlign: 'center',
},
  paymentDetails: {
    fontSize: 13,
    marginBottom: 5,
    textAlign: 'left',
  },
  celebrations: {
    fontSize: 13,
    marginBottom: 8,
    textAlign: 'center',
  },
  fundRequestTitle: {
  fontSize: 15,
  fontWeight: 'bold',
  marginTop: 5,
  textAlign: 'center',
},

  table: {
    marginTop: 15,
    marginBottom: 15,
    width: '100%',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    paddingVertical: 3,
    minHeight: 20,
    width: '100%',
    flexWrap: 'nowrap',
  },
  tableHeader: {
    backgroundColor: '#f0f0f0',
    fontWeight: 'bold',
    paddingVertical: 6,
  },
  tableHeaderText: {
      fontSize: 11,
      fontWeight: 'bold',
      lineHeight: 1.3,
},

  tableCell: {
    paddingHorizontal: 3,
    paddingVertical: 2,
    minHeight: 15,
    justifyContent: 'flex-start',
    alignItems: 'flex-start',
    // flexShrink: 1,
    // flexGrow: 0,
  },
  tableCellText: {
    fontSize: 10,
    lineHeight: 1.3,
  },
  colSlNo: { flex: 0.04 },
  colBeneficiary: { flex: 0.12 },
  colName: { flex: 0.14 },
  colInstitution: { flex: 0.14 },
  colDetails: { flex: 0.06 }, // Reduced further for QTY (max 3 digits)
  colFundRequested: { flex: 0.12 },
  colAadhar: { flex: 0.12 },
  colChequeFavour: { width: '16%' },
  colChequeSl: {
    width: '10%', // Increased to give more space for CHEQUE NO.
    paddingRight: 6,
  },
  totalRow: {
    fontWeight: 'bold',
    backgroundColor: '#f5f5f5',
    paddingVertical: 6,
  },
  signatureSection: {
    marginTop: 20,
    alignItems: 'flex-end',
  },
  signatureBlock: {
    width: '45%',
  },
  signatureLabel: {
    marginBottom: 25,
    fontSize: 9,
  },
  signatureLine: {
    borderBottomWidth: 1,
    borderBottomColor: '#000',
    marginBottom: 5,
    height: 20,
  },
  footerSection: {
    marginTop: 20,
  },
  footerSpacing: {
    height: 15,
  },
  footerText: {
    fontSize: 9,
    marginBottom: 3,
  },
  cumulativeTable: {
    marginTop: 10,
  },
  cumulativeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
    paddingVertical: 2,
  },
  cumulativeLabel: {
    fontWeight: 'bold',
    fontSize: 9,
    width: '65%',
  },
  cumulativeValue: {
    fontSize: 9,
    width: '35%',
    textAlign: 'right',
  },
  cumulativeTotal: {
    backgroundColor: '#e0e0e0',
    paddingVertical: 4,
    fontWeight: 'bold',
  },
  forMasSection: {
    marginTop: 10,
    alignItems: 'flex-end',
    paddingRight: '10%', // Align to column H (Cheque in Favour column)
  },
  forMasText: {
    fontSize: 9,
    fontWeight: 'bold',
  },
  signatureText: {
    fontSize: 9,
    marginBottom: 2,
  },
  footerAddressSection: {
    marginTop: 20,
    marginBottom: 10,
    fontSize: 9,
    lineHeight: 1.4,
  },
  footerAddressLine: {
    marginBottom: 2,
  },
});

interface FundRequestPDFDocumentProps {
  fundRequest: FundRequestWithDetails;
  previousCumulative: number;
  logoDataUri?: string | null;
  guruLogoDataUri?: string | null;
  orientation?: 'portrait' | 'landscape';
}

const FundRequestPDFDocument: React.FC<FundRequestPDFDocumentProps> = ({ 
  fundRequest, 
  previousCumulative,
  logoDataUri,
  guruLogoDataUri,
  orientation = 'portrait'
}) => {
  const currentTotal = fundRequest.total_amount || 0;
  const grandTotal = previousCumulative + currentTotal;
  
  // Format the title based on fund request type
  const formattedDate = formatDate(fundRequest.created_at);
  const titleText = fundRequest.fund_request_type === 'Article'
    ? `Fund Request No: ${fundRequest.fund_request_number}  | Dated ${formattedDate} - Article`
    : fundRequest.aid_type
    ? `Fund Request No: ${fundRequest.fund_request_number}  | Dated ${formattedDate} - ${fundRequest.aid_type}`
    : `Fund Request No: ${fundRequest.fund_request_number}  | Dated ${formattedDate}`;

  return (
    <Document>
      <Page size="A4" orientation={orientation} style={styles.page}>
        {/* Header Section with Logos and Titles */}
        <View style={styles.headerSection}>
          {/* Left: Guru Logo */}
          <View style={styles.leftHeader}>
            {guruLogoDataUri && (
              <Image 
                src={guruLogoDataUri} 
                style={styles.guruLogo}
              />
            )}
          </View>
          {/* Center: Titles */}
          <View style={styles.centerHeader}>
            {/* Header - Matching Excel template format */}
            <View style={styles.header}>
              <Text style={styles.omsakthiTitle}>OMSAKTHI</Text>
              <Text style={styles.paymentDetails}>Payment Request Details for MASM Makkal Nala Pani Programme on the eve
                                                  of 86th Birthday Celebrations of His Holiness AMMA at Melmaruvathur on 03-03-2026</Text>
              {/*<Text style={styles.celebrations}></Text>*/}
              <Text style={styles.fundRequestTitle}wrap={false}>{titleText}</Text>
            </View>
          </View>
          {/* Right: Current Logo */}
          <View style={styles.rightHeader}>
            {logoDataUri && (
              <Image 
                src={logoDataUri} 
                style={styles.logo}
              />
            )}
          </View>
        </View>

        {/* Table - Aid Type */}
        {fundRequest.fund_request_type === 'Aid' && fundRequest.recipients && fundRequest.recipients.length > 0 && (
          <View style={styles.table}>
            {/* Table Header */}
            <View style={[styles.tableRow, styles.tableHeader]}>
              <View style={[styles.tableCell, styles.colSlNo]}>
                <Text style={styles.tableHeaderText}>SL No</Text>
              </View>
              <View style={[styles.tableCell, styles.colBeneficiary]}>
                <Text style={styles.tableHeaderText}>Beneficiary</Text>
              </View>
              <View style={[styles.tableCell, styles.colName]}>
                <Text style={styles.tableHeaderText}>Name of beneficiary</Text>
              </View>
              <View style={[styles.tableCell, styles.colInstitution]}>
                <Text style={styles.tableHeaderText}>Name of Institution</Text>
              </View>
              <View style={[styles.tableCell, styles.colDetails]}>
                <Text style={styles.tableHeaderText}>Details</Text>
              </View>
              <View style={[styles.tableCell, styles.colFundRequested]}>
                <Text style={[styles.tableCellText, { fontWeight: 'bold', textAlign: 'right' }]}>Fund Requested</Text>
              </View>
              <View style={[styles.tableCell, styles.colAadhar]}>
                <Text style={styles.tableHeaderText}>Aadhar No</Text>
              </View>
              <View style={[styles.tableCell, styles.colChequeFavour]}>
                <Text style={styles.tableHeaderText}>Cheque in Favour</Text>
              </View>
              <View style={[styles.tableCell, styles.colChequeSl]}>
                <Text style={styles.tableHeaderText}>Cheque No.</Text>
              </View>
            </View>

            {/* Table Rows */}
            {fundRequest.recipients.map((recipient, index) => (
              <View key={index} style={styles.tableRow}>
                <View style={[styles.tableCell, styles.colSlNo]}>
                  <Text style={styles.tableCellText}>{index + 1}</Text>
                </View>
                <View style={[styles.tableCell, styles.colBeneficiary]}>
                  <Text style={styles.tableCellText} wrap>
                    {getBeneficiaryDisplayValue(recipient)}
                  </Text>
                </View>
                <View style={[styles.tableCell, styles.colName]}>
                  <Text style={styles.tableCellText} wrap>
                    {recipient.name_of_beneficiary || recipient.recipient_name || ''}
                  </Text>
                </View>
                <View style={[styles.tableCell, styles.colInstitution]}>
                  <Text style={styles.tableCellText} wrap>
                    {recipient.name_of_institution || ''}
                  </Text>
                </View>
                <View style={[styles.tableCell, styles.colDetails]}>
                  <Text style={styles.tableCellText} wrap>
                    {breakLongText(recipient.notes || recipient.details || '', 25)}
                  </Text>
                </View>
                <View style={[styles.tableCell, styles.colFundRequested]}>
                  <Text style={[styles.tableCellText, { textAlign: 'right' }]}>
                    {recipient.fund_requested?.toLocaleString('en-IN', { 
                      minimumFractionDigits: 2, 
                      maximumFractionDigits: 2 
                    }) || '0.00'}
                  </Text>
                </View>
                <View style={[styles.tableCell, styles.colAadhar]}>
                  <Text style={styles.tableCellText} wrap>
                    {recipient.aadhar_number || ''}
                  </Text>
                </View>
                <View style={[styles.tableCell, styles.colChequeFavour]}>
                  <Text style={styles.tableCellText} wrap>
                    {recipient.cheque_in_favour || ''}
                  </Text>
                </View>
                <View style={[styles.tableCell, styles.colChequeSl, { alignItems: 'flex-end' }]}>
                  <Text style={[styles.tableCellText, { textAlign: 'right' }]} wrap>
                    {breakLongText(recipient.cheque_no || '', 12)}
                  </Text>
                </View>
              </View>
            ))}

            {/* Total Row */}
            <View style={[styles.tableRow, styles.totalRow]}>
              <View style={[styles.tableCell, styles.colSlNo]}></View>
              <View style={[styles.tableCell, styles.colBeneficiary]}></View>
              <View style={[styles.tableCell, styles.colName]}></View>
              <View style={[styles.tableCell, styles.colInstitution]}></View>
              <View style={[styles.tableCell, styles.colDetails]}>
                <Text style={styles.tableHeaderText}>Total:</Text>
              </View>
              <View style={[styles.tableCell, styles.colFundRequested]}>
                <Text style={[styles.tableCellText, { fontWeight: 'bold', textAlign: 'right' }]}>
                  {fundRequest.recipients.reduce((sum, r) => sum + (r.fund_requested || 0), 0)
                    .toLocaleString('en-IN', { 
                      minimumFractionDigits: 2, 
                      maximumFractionDigits: 2 
                    })}
                </Text>
              </View>
              <View style={[styles.tableCell, styles.colAadhar]}></View>
              <View style={[styles.tableCell, styles.colChequeFavour]}></View>
              <View style={[styles.tableCell, styles.colChequeSl]}></View>
            </View>
          </View>
        )}

        {/* Table - Article Type */}
        {fundRequest.fund_request_type === 'Article' && fundRequest.articles && fundRequest.articles.length > 0 && (
          <View style={styles.table}>
            {/* Table Header */}
            <View style={[styles.tableRow, styles.tableHeader]}>
              <View style={[styles.tableCell, styles.colSlNo]}>
                <Text style={styles.tableHeaderText}>SL.NO</Text>
              </View>
              <View style={[styles.tableCell, styles.colBeneficiary]}>
                <Text style={styles.tableHeaderText}>BENEFICIARY</Text>
              </View>
              <View style={[styles.tableCell, styles.colName]}>
                <Text style={styles.tableHeaderText}>ARTICLE NAME</Text>
              </View>
              <View style={[styles.tableCell, styles.colInstitution]}>
                <Text style={styles.tableHeaderText}>GST NO.</Text>
              </View>
              <View style={[styles.tableCell, styles.colDetails]}>
                <Text style={styles.tableHeaderText}>QTY</Text>
              </View>
              <View style={[styles.tableCell, styles.colFundRequested]}>
                <Text style={styles.tableHeaderText}>PRICE INCLUDING GST</Text>
              </View>
              <View style={[styles.tableCell, styles.colAadhar]}>
                <Text style={[styles.tableCellText, { fontWeight: 'bold', textAlign: 'right' }]}>VALUE</Text>
              </View>
              <View style={[styles.tableCell, styles.colChequeFavour]}>
                <Text style={styles.tableHeaderText}>CHEQUE IN FAVOUR</Text>
              </View>
              <View style={[styles.tableCell, styles.colChequeSl]}>
                <Text style={styles.tableHeaderText}>CHEQUE NO.</Text>
              </View>
            </View>

            {/* Table Rows */}
            {fundRequest.articles.map((article, index) => (
              <View key={index} style={styles.tableRow}>
                <View style={[styles.tableCell, styles.colSlNo]}>
                  <Text style={styles.tableCellText}>{article.sl_no || index + 1}</Text>
                </View>
                <View style={[styles.tableCell, styles.colBeneficiary]}>
                  <Text style={styles.tableCellText} wrap>
                    Dist & Public
                  </Text>
                </View>
                <View style={[styles.tableCell, styles.colName]}>
                  <Text style={styles.tableCellText} wrap>
                    {article.article_name || ''}
                  </Text>
                </View>
                <View style={[styles.tableCell, styles.colInstitution]}>
                  <Text style={styles.tableCellText} wrap>
                    {fundRequest.gst_number || article.gst_no || ''}
                  </Text>
                </View>
                <View style={[styles.tableCell, styles.colDetails]}>
                  <Text style={styles.tableCellText}>
                    {article.quantity || 0}
                  </Text>
                </View>
                <View style={[styles.tableCell, styles.colFundRequested]}>
                  <Text style={[styles.tableCellText, { textAlign: 'right' }]}>
                    {article.price_including_gst?.toLocaleString('en-IN', { 
                      minimumFractionDigits: 2, 
                      maximumFractionDigits: 2 
                    }) || '0.00'}
                  </Text>
                </View>
                <View style={[styles.tableCell, styles.colAadhar]}>
                  <Text style={[styles.tableCellText, { textAlign: 'right' }]}>
                    {article.value?.toLocaleString('en-IN', { 
                      minimumFractionDigits: 2, 
                      maximumFractionDigits: 2 
                    }) || '0.00'}
                  </Text>
                </View>
                <View style={[styles.tableCell, styles.colChequeFavour]}>
                  <Text style={styles.tableCellText} wrap>
                    {breakLongText(article.cheque_in_favour || '', 20)}
                  </Text>
                </View>
                <View style={[styles.tableCell, styles.colChequeSl, { alignItems: 'center', justifyContent: 'center' }]}>
                  <Text style={[styles.tableCellText, { textAlign: 'center' }]} wrap>
                    {breakLongText(article.cheque_no || '', 12)}
                  </Text>
                </View>
              </View>
            ))}

            {/* Total Row */}
            <View style={[styles.tableRow, styles.totalRow]}>
              <View style={[styles.tableCell, styles.colSlNo]}></View>
              <View style={[styles.tableCell, styles.colBeneficiary]}></View>
              <View style={[styles.tableCell, styles.colName]}></View>
              <View style={[styles.tableCell, styles.colInstitution]}></View>
              <View style={[styles.tableCell, styles.colDetails]}>
                <Text style={styles.tableHeaderText}>Total:</Text>
              </View>
              <View style={[styles.tableCell, styles.colFundRequested]}></View>
              <View style={[styles.tableCell, styles.colAadhar]}>
                <Text style={[styles.tableCellText, { fontWeight: 'bold', textAlign: 'right' }]}>
                  {fundRequest.articles.reduce((sum, a) => sum + (a.value || 0), 0)
                    .toLocaleString('en-IN', { 
                      minimumFractionDigits: 2, 
                      maximumFractionDigits: 2 
                    })}
                </Text>
              </View>
              <View style={[styles.tableCell, styles.colChequeFavour]}></View>
              <View style={[styles.tableCell, styles.colChequeSl]}></View>
            </View>
          </View>
        )}

        {/* FOR MASM - in column H position */}
        <View style={styles.forMasSection}>
          <Text style={styles.forMasText}>FOR MASM</Text>
        </View>

        {/*/!* Address Section at Bottom *!/*/}
        {/*<View style={styles.footerAddressSection}>*/}
        {/*  <Text style={styles.footerAddressLine}>Melmaruvathur Adhiparasakthi Spiritual Movement</Text>*/}
        {/*  <Text style={styles.footerAddressLine}>GST Road, Melmaruvathur 603319</Text>*/}
        {/*  <Text style={styles.footerAddressLine}>Chengalpet District, Tamilnadu</Text>*/}
        {/*  <Text style={styles.footerAddressLine}>GST NO: 33AACTM0073D1Z5.</Text>*/}
        {/*  <Text style={styles.footerAddressLine}>Website: maruvoorhelp@gmail.com</Text>*/}
        {/*</View>*/}

        {/* Footer Section */}
        <View style={styles.footerSection}>
          {/* 1 empty row spacing */}
          <View style={styles.footerSpacing}></View>
          
          {/* Approval copies text */}
          <Text style={styles.footerText}>1. MASM PRESIDENT's 2026 APPROVAL COPY</Text>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <Text style={styles.footerText}>2. QUOTATION / BANK / REQUEST COPIES</Text>
            <View style={{ alignItems: 'flex-end', marginRight: '10%' }}>
              <Text style={styles.signatureText}>R.Surendranath,</Text>
              <Text style={styles.signatureText}>JS - Social Welfare Activities</Text>
            </View>
          </View>
          
          {/* 1 empty row spacing */}
          <View style={styles.footerSpacing}></View>
          
          {/* Cumulative Totals */}
          <View style={styles.cumulativeTable}>
            <View style={styles.cumulativeRow}>
              <Text style={styles.cumulativeLabel}>PREVIOUS CUMULATIVE(Rs.)</Text>
              <Text style={styles.cumulativeValue}>
                {previousCumulative.toLocaleString('en-IN', { 
                  minimumFractionDigits: 2, 
                  maximumFractionDigits: 2 
                })}
              </Text>
            </View>
            <View style={styles.cumulativeRow}>
              <Text style={styles.cumulativeLabel}>CURRENT FUND REQUEST(Rs.)</Text>
              <Text style={styles.cumulativeValue}>
                {currentTotal.toLocaleString('en-IN', { 
                  minimumFractionDigits: 2, 
                  maximumFractionDigits: 2 
                })}
              </Text>
            </View>
            <View style={[styles.cumulativeRow, styles.cumulativeTotal]}>
              <Text style={styles.cumulativeLabel}>TOTAL(Rs.)</Text>
              <Text style={styles.cumulativeValue}>
                {grandTotal.toLocaleString('en-IN', { 
                  minimumFractionDigits: 2, 
                  maximumFractionDigits: 2 
                })}
              </Text>
            </View>
          </View>
        </View>
      </Page>
    </Document>
  );
};

export default FundRequestPDFDocument;

