/**
 * PDF Receipt Generator for UK-compliant receipts
 * Generates PDF receipts with VAT breakdown for insurance/employer reimbursement
 */

// Simple PDF generation using text-based format
// In production, you'd use a library like pdfkit or puppeteer

export interface ReceiptLineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  vatRate: number; // e.g., 20 for 20%
  total: number;
}

export interface ReceiptData {
  receiptNumber: string;
  date: Date;
  customerName: string;
  customerEmail: string;
  trainerName: string;
  bundleName: string;
  lineItems: ReceiptLineItem[];
  subtotal: number;
  vatAmount: number;
  totalAmount: number;
  paymentMethod: string;
  companyDetails: {
    name: string;
    address: string;
    vatNumber: string;
    companyNumber: string;
  };
}

/**
 * Calculate VAT breakdown from line items
 */
export function calculateVATBreakdown(lineItems: ReceiptLineItem[]): {
  standardRate: { net: number; vat: number };
  reducedRate: { net: number; vat: number };
  zeroRate: { net: number };
} {
  const breakdown = {
    standardRate: { net: 0, vat: 0 }, // 20%
    reducedRate: { net: 0, vat: 0 },  // 5%
    zeroRate: { net: 0 },              // 0%
  };

  for (const item of lineItems) {
    const netAmount = item.total / (1 + item.vatRate / 100);
    const vatAmount = item.total - netAmount;

    if (item.vatRate === 20) {
      breakdown.standardRate.net += netAmount;
      breakdown.standardRate.vat += vatAmount;
    } else if (item.vatRate === 5) {
      breakdown.reducedRate.net += netAmount;
      breakdown.reducedRate.vat += vatAmount;
    } else {
      breakdown.zeroRate.net += item.total;
    }
  }

  return breakdown;
}

/**
 * Format currency for UK receipts
 */
function formatCurrency(amount: number): string {
  return `£${amount.toFixed(2)}`;
}

/**
 * Format date for UK receipts
 */
function formatDate(date: Date): string {
  return new Date(date).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

/**
 * Generate HTML receipt that can be converted to PDF
 */
export function generateReceiptHTML(data: ReceiptData): string {
  const vatBreakdown = calculateVATBreakdown(data.lineItems);

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      font-family: 'Helvetica Neue', Arial, sans-serif; 
      font-size: 12px; 
      line-height: 1.5;
      color: #333;
      padding: 40px;
      max-width: 800px;
      margin: 0 auto;
    }
    .header { 
      display: flex; 
      justify-content: space-between; 
      align-items: flex-start;
      margin-bottom: 40px;
      padding-bottom: 20px;
      border-bottom: 2px solid #e5e5e5;
    }
    .logo { 
      font-size: 24px; 
      font-weight: bold; 
      color: #7c3aed;
    }
    .receipt-title {
      text-align: right;
    }
    .receipt-title h1 { 
      font-size: 28px; 
      color: #333;
      margin-bottom: 5px;
    }
    .receipt-number { 
      font-size: 14px; 
      color: #666; 
    }
    .info-section {
      display: flex;
      justify-content: space-between;
      margin-bottom: 30px;
    }
    .info-block {
      width: 48%;
    }
    .info-block h3 {
      font-size: 11px;
      text-transform: uppercase;
      color: #666;
      margin-bottom: 8px;
      letter-spacing: 0.5px;
    }
    .info-block p {
      margin-bottom: 4px;
    }
    table { 
      width: 100%; 
      border-collapse: collapse; 
      margin-bottom: 30px;
    }
    th { 
      background: #f8f8f8; 
      padding: 12px 10px;
      text-align: left;
      font-size: 11px;
      text-transform: uppercase;
      color: #666;
      border-bottom: 2px solid #e5e5e5;
    }
    th:last-child, td:last-child { text-align: right; }
    td { 
      padding: 12px 10px; 
      border-bottom: 1px solid #eee;
    }
    .totals {
      width: 300px;
      margin-left: auto;
      margin-bottom: 30px;
    }
    .totals-row {
      display: flex;
      justify-content: space-between;
      padding: 8px 0;
      border-bottom: 1px solid #eee;
    }
    .totals-row.total {
      font-size: 16px;
      font-weight: bold;
      border-bottom: 2px solid #333;
      padding: 12px 0;
    }
    .vat-summary {
      background: #f8f8f8;
      padding: 20px;
      border-radius: 8px;
      margin-bottom: 30px;
    }
    .vat-summary h3 {
      font-size: 14px;
      margin-bottom: 15px;
      color: #333;
    }
    .vat-row {
      display: flex;
      justify-content: space-between;
      padding: 6px 0;
      font-size: 11px;
    }
    .footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid #e5e5e5;
      font-size: 10px;
      color: #666;
      text-align: center;
    }
    .footer p { margin-bottom: 4px; }
    .reimbursement-notice {
      background: #f0fdf4;
      border: 1px solid #86efac;
      border-radius: 8px;
      padding: 15px;
      margin-bottom: 30px;
    }
    .reimbursement-notice h4 {
      color: #166534;
      margin-bottom: 8px;
    }
    .reimbursement-notice p {
      color: #166534;
      font-size: 11px;
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="logo">LocoMotivate</div>
    <div class="receipt-title">
      <h1>Tax Receipt</h1>
      <div class="receipt-number">${data.receiptNumber}</div>
    </div>
  </div>

  <div class="info-section">
    <div class="info-block">
      <h3>Bill To</h3>
      <p><strong>${data.customerName}</strong></p>
      <p>${data.customerEmail}</p>
    </div>
    <div class="info-block">
      <h3>Receipt Details</h3>
      <p><strong>Date:</strong> ${formatDate(data.date)}</p>
      <p><strong>Trainer:</strong> ${data.trainerName}</p>
      <p><strong>Bundle:</strong> ${data.bundleName}</p>
      <p><strong>Payment:</strong> ${data.paymentMethod}</p>
    </div>
  </div>

  <div class="reimbursement-notice">
    <h4>For Insurance/Employer Reimbursement</h4>
    <p>This receipt contains all information required for health insurance claims or employer wellness program reimbursements in the United Kingdom.</p>
  </div>

  <table>
    <thead>
      <tr>
        <th>Description</th>
        <th>Qty</th>
        <th>Unit Price</th>
        <th>VAT</th>
        <th>Amount</th>
      </tr>
    </thead>
    <tbody>
      ${data.lineItems.map(item => `
        <tr>
          <td>${item.description}</td>
          <td>${item.quantity}</td>
          <td>${formatCurrency(item.unitPrice)}</td>
          <td>${item.vatRate}%</td>
          <td>${formatCurrency(item.total)}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>

  <div class="totals">
    <div class="totals-row">
      <span>Subtotal (excl. VAT)</span>
      <span>${formatCurrency(data.subtotal - data.vatAmount)}</span>
    </div>
    <div class="totals-row">
      <span>VAT</span>
      <span>${formatCurrency(data.vatAmount)}</span>
    </div>
    <div class="totals-row total">
      <span>Total</span>
      <span>${formatCurrency(data.totalAmount)}</span>
    </div>
  </div>

  <div class="vat-summary">
    <h3>VAT Summary</h3>
    ${vatBreakdown.standardRate.vat > 0 ? `
      <div class="vat-row">
        <span>Standard Rate (20%)</span>
        <span>Net: ${formatCurrency(vatBreakdown.standardRate.net)} | VAT: ${formatCurrency(vatBreakdown.standardRate.vat)}</span>
      </div>
    ` : ''}
    ${vatBreakdown.reducedRate.vat > 0 ? `
      <div class="vat-row">
        <span>Reduced Rate (5%)</span>
        <span>Net: ${formatCurrency(vatBreakdown.reducedRate.net)} | VAT: ${formatCurrency(vatBreakdown.reducedRate.vat)}</span>
      </div>
    ` : ''}
    ${vatBreakdown.zeroRate.net > 0 ? `
      <div class="vat-row">
        <span>Zero Rate (0%)</span>
        <span>Net: ${formatCurrency(vatBreakdown.zeroRate.net)}</span>
      </div>
    ` : ''}
    <div class="vat-row" style="font-weight: bold; border-top: 1px solid #ddd; padding-top: 10px; margin-top: 10px;">
      <span>Total VAT</span>
      <span>${formatCurrency(data.vatAmount)}</span>
    </div>
  </div>

  <div class="footer">
    <p><strong>${data.companyDetails.name}</strong></p>
    <p>${data.companyDetails.address}</p>
    <p>VAT Registration: ${data.companyDetails.vatNumber} | Company No: ${data.companyDetails.companyNumber}</p>
    <p style="margin-top: 15px;">Thank you for your purchase. This receipt is valid for tax purposes.</p>
  </div>
</body>
</html>
  `.trim();
}

/**
 * Generate receipt data from order information
 */
export function buildReceiptData(
  order: {
    id: number;
    totalAmount: string;
    createdAt: Date;
    paymentMethod?: string | null;
  },
  customer: {
    name: string | null;
    email: string | null;
  },
  trainer: {
    name: string | null;
  },
  bundleName: string,
  lineItems: Array<{
    type: string;
    name: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
  }>
): ReceiptData {
  // Default VAT rates for UK
  const getVATRate = (type: string): number => {
    // Services like personal training are typically standard rate
    // Some health-related services may be exempt
    switch (type) {
      case "product":
        return 20; // Standard rate for most products
      case "service":
        return 20; // Personal training services
      case "facility":
        return 20; // Facility fees
      default:
        return 20;
    }
  };

  const receiptLineItems: ReceiptLineItem[] = lineItems.map(item => ({
    description: item.name,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    vatRate: getVATRate(item.type),
    total: item.totalPrice,
  }));

  const totalAmount = parseFloat(order.totalAmount);
  const vatAmount = receiptLineItems.reduce((sum, item) => {
    const netAmount = item.total / (1 + item.vatRate / 100);
    return sum + (item.total - netAmount);
  }, 0);

  return {
    receiptNumber: `LM-${order.id.toString().padStart(6, '0')}`,
    date: order.createdAt,
    customerName: customer.name || "Customer",
    customerEmail: customer.email || "",
    trainerName: trainer.name || "Trainer",
    bundleName: bundleName,
    lineItems: receiptLineItems,
    subtotal: totalAmount,
    vatAmount: vatAmount,
    totalAmount: totalAmount,
    paymentMethod: order.paymentMethod || "Card",
    companyDetails: {
      name: "LocoMotivate Ltd",
      address: "123 Fitness Street, London, EC1A 1BB, United Kingdom",
      vatNumber: "GB123456789",
      companyNumber: "12345678",
    },
  };
}
