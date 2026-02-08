import React from 'react';
import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer';
import type { FundRequestWithDetails } from '../services/fundRequestService';

/**
 * Format date to DD-MM-YY format for Purchase Order
 */
const formatPODate = (): string => {
  const date = new Date();
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = date.getFullYear().toString().slice(-2);
  return `${day}-${month}-${year}`;
};

// Define styles
const styles = StyleSheet.create({
  page: {
    padding: 30,
    fontSize: 10,
    fontFamily: 'Helvetica',
  },
  headerSection: {
    flexDirection: 'row',
    marginBottom: 15,
    position: 'relative',
  },
  logoSection: {
    width: '30%',
    marginRight: 20,
  },
  logo: {
    width: 80,
    height: 70,
    marginBottom: 5,
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
    flex: 1,
    alignItems: 'center',
    paddingTop: 5,
    position: 'relative',
  },
  rightHeader: {
    width: '20%',
    alignItems: 'flex-end',
    paddingTop: 5,
  },
  poTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#008000',
    marginBottom: 5,
    textAlign: 'center',
  },
  poDateContainer: {
    position: 'absolute',
    right: 0,
    top: 50,
  },
  poDate: {
    fontSize: 10,
    textAlign: 'right',
  },
  vendorShipSection: {
    flexDirection: 'row',
    marginTop: 15,
    marginBottom: 15,
  },
  vendorSection: {
    width: '45%',
    marginRight: '5%',
  },
  shipToSection: {
    width: '45%',
  },
  sectionHeader: {
    backgroundColor: '#008000',
    color: '#FFFFFF',
    padding: 5,
    fontSize: 10,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  sectionContent: {
    fontSize: 9,
    lineHeight: 1.5,
  },
  sectionLine: {
    marginBottom: 3,
  },
  table: {
    marginTop: 20,
    marginBottom: 15,
    width: '100%',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    paddingVertical: 5,
    minHeight: 25,
  },
  tableHeader: {
    backgroundColor: '#008000',
    color: '#FFFFFF',
    fontWeight: 'bold',
    paddingVertical: 6,
  },
  tableCell: {
    paddingHorizontal: 5,
    fontSize: 9,
    justifyContent: 'center',
    alignItems: 'center',
  },
  colItemName: { 
    width: '25%',
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  colDescription: { width: '25%' },
  colQty: { width: '10%' },
  colUnitPrice: { width: '20%' },
  colTotal: { width: '20%' },
  tableCellText: {
    fontSize: 9,
  },
  totalRow: {
    backgroundColor: '#f5f5f5',
    fontWeight: 'bold',
    paddingVertical: 6,
  },
  commentsSection: {
    marginTop: 20,
    marginBottom: 15,
  },
  commentsHeader: {
    backgroundColor: '#008000',
    color: '#FFFFFF',
    padding: 5,
    fontSize: 10,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  commentsSpace: {
    minHeight: 80,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderStyle: 'dashed',
  },
  footer: {
    marginTop: 20,
    textAlign: 'center',
    fontSize: 9,
    lineHeight: 1.5,
  },
  footerLine: {
    marginBottom: 3,
  },
});

interface PurchaseOrderPDFDocumentProps {
  fundRequest: FundRequestWithDetails;
  logoDataUri?: string | null;
}

const PurchaseOrderPDFDocument: React.FC<PurchaseOrderPDFDocumentProps> = ({ 
  fundRequest,
  logoDataUri 
}) => {
  const currentDate = formatPODate();
  const totalAmount = fundRequest.articles?.reduce((sum, article) => sum + (article.value || 0), 0) || 0;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header Section with Logo and Company Info */}
        <View style={styles.headerSection}>
          <View style={styles.logoSection}>
            {logoDataUri && (
              <Image 
                src={logoDataUri} 
                style={styles.logo}
              />
            )}
            <View style={styles.companyInfo}>
              <Text style={styles.companyInfoLine}>Melmaruvathur Adhiparasakthi Spiritual Movement</Text>
              <Text style={styles.companyInfoLine}>GST Road, Melmaruvathur 603319</Text>
              <Text style={styles.companyInfoLine}>Chengalpet District, Tamilnadu</Text>
              <Text style={styles.companyInfoLine}>GST NO: 33AACTM0073D1Z5.</Text>
              <Text style={styles.companyInfoLine}>Website: maruvoorhelp@gmail.com</Text>
            </View>
          </View>
          <View style={styles.centerHeader}>
            <Text style={styles.poTitle}>PURCHASE ORDER</Text>
            <View style={styles.poDateContainer}>
              <Text style={styles.poDate}>DATE {currentDate}</Text>
            </View>
          </View>
        </View>

        {/* Vendor and Ship To Section */}
        <View style={styles.vendorShipSection}>
          <View style={styles.vendorSection}>
            <Text style={styles.sectionHeader}>VENDOR</Text>
            <View style={styles.sectionContent}>
              <Text style={styles.sectionLine}>{fundRequest.supplier_name || ''}</Text>
              <Text style={styles.sectionLine}>{fundRequest.gst_number || ''}</Text>
              <Text style={styles.sectionLine}>{fundRequest.supplier_address || ''}</Text>
              <Text style={styles.sectionLine}>
                {[fundRequest.supplier_city, fundRequest.supplier_state, fundRequest.supplier_pincode]
                  .filter(Boolean)
                  .join(', ')}
              </Text>
            </View>
          </View>
          <View style={styles.shipToSection}>
            <Text style={styles.sectionHeader}>SHIP TO</Text>
            <View style={styles.sectionContent}>
              <Text style={styles.sectionLine}>Melmaruvathur Adhiparasakthi Spiritual Movement</Text>
              <Text style={styles.sectionLine}>GST Road, Melmaruvathur 603319</Text>
              <Text style={styles.sectionLine}>Chengalpet District, Tamilnadu</Text>
            </View>
          </View>
        </View>

        {/* Item Table */}
        <View style={styles.table}>
          {/* Table Header */}
          <View style={[styles.tableRow, styles.tableHeader]}>
            <View style={[styles.tableCell, styles.colItemName]}>
              <Text style={[styles.tableCellText, { color: '#FFFFFF' }]}>ITEM NAME</Text>
            </View>
            <View style={[styles.tableCell, styles.colDescription]}>
              <Text style={[styles.tableCellText, { color: '#FFFFFF' }]}>DESCRIPTION</Text>
            </View>
            <View style={[styles.tableCell, styles.colQty]}>
              <Text style={[styles.tableCellText, { color: '#FFFFFF' }]}>QTY</Text>
            </View>
            <View style={[styles.tableCell, styles.colUnitPrice]}>
              <Text style={[styles.tableCellText, { color: '#FFFFFF' }]}>UNIT PRICE</Text>
            </View>
            <View style={[styles.tableCell, styles.colTotal]}>
              <Text style={[styles.tableCellText, { color: '#FFFFFF' }]}>TOTAL</Text>
            </View>
          </View>

          {/* Table Rows */}
          {fundRequest.articles?.map((article, index) => (
            <View key={index} style={styles.tableRow}>
              <View style={[styles.tableCell, styles.colItemName]}>
                <Text style={[styles.tableCellText, { textAlign: 'left' }]}>
                  {article.supplier_article_name || article.article_name || ''}
                </Text>
              </View>
              <View style={[styles.tableCell, styles.colDescription]}>
                <Text style={styles.tableCellText}></Text>
              </View>
              <View style={[styles.tableCell, styles.colQty]}>
                <Text style={styles.tableCellText}>{article.quantity || 0}</Text>
              </View>
              <View style={[styles.tableCell, styles.colUnitPrice]}>
                <Text style={[styles.tableCellText, { textAlign: 'right' }]}>
                  {article.price_including_gst?.toLocaleString('en-IN', { 
                    minimumFractionDigits: 2, 
                    maximumFractionDigits: 2 
                  }) || '0.00'}
                </Text>
              </View>
              <View style={[styles.tableCell, styles.colTotal]}>
                <Text style={[styles.tableCellText, { textAlign: 'right' }]}>
                  {article.value?.toLocaleString('en-IN', { 
                    minimumFractionDigits: 2, 
                    maximumFractionDigits: 2 
                  }) || '0.00'}
                </Text>
              </View>
            </View>
          ))}

          {/* Total Row */}
          <View style={[styles.tableRow, styles.totalRow]}>
            <View style={[styles.tableCell, styles.colItemName]}></View>
            <View style={[styles.tableCell, styles.colDescription]}></View>
            <View style={[styles.tableCell, styles.colQty]}></View>
            <View style={[styles.tableCell, styles.colUnitPrice]}>
              <Text style={[styles.tableCellText, { fontWeight: 'bold' }]}>TOTAL</Text>
            </View>
            <View style={[styles.tableCell, styles.colTotal]}>
              <Text style={[styles.tableCellText, { fontWeight: 'bold', textAlign: 'right' }]}>
                ₹ {totalAmount.toLocaleString('en-IN', { 
                  minimumFractionDigits: 2, 
                  maximumFractionDigits: 2 
                })}
              </Text>
            </View>
          </View>
        </View>

        {/* Comments Section */}
        <View style={styles.commentsSection}>
          <Text style={styles.commentsHeader}>Comments or Special Instructions</Text>
          <View style={styles.commentsSpace}></View>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerLine}>
            If you have any questions about this purchase order, please contact
          </Text>
          <Text style={styles.footerLine}>
            R.Surendranath, +91 98400 46263, maruvoorhelp@gmail.com
          </Text>
        </View>
      </Page>
    </Document>
  );
};

export default PurchaseOrderPDFDocument;

