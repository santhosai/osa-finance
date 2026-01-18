import { useRef } from 'react';

// Reusable Print Receipt Component
function PrintReceipt({
  type, // 'payment', 'loan_given', 'loan_statement', 'chit_payment', 'chit_auction'
  data,
  onClose
}) {
  const printRef = useRef();

  const formatCurrency = (amount) => `₹${(Number(amount) || 0).toLocaleString('en-IN')}`;
  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const handlePrint = () => {
    const printContent = printRef.current.innerHTML;
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Receipt - Om Sai Murugan Finance</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            font-family: 'Courier New', monospace;
            padding: 10px;
            max-width: 300px;
            margin: 0 auto;
          }
          .receipt {
            border: 2px solid #000;
            padding: 15px;
            background: #fff;
          }
          .header {
            text-align: center;
            border-bottom: 2px dashed #000;
            padding-bottom: 10px;
            margin-bottom: 10px;
          }
          .company-name {
            font-size: 16px;
            font-weight: bold;
            text-transform: uppercase;
          }
          .tagline { font-size: 10px; margin-top: 5px; }
          .receipt-type {
            font-size: 12px;
            background: #000;
            color: #fff;
            padding: 3px 8px;
            margin-top: 8px;
            display: inline-block;
          }
          .details { margin: 10px 0; }
          .row {
            display: flex;
            justify-content: space-between;
            padding: 4px 0;
            font-size: 12px;
          }
          .row.highlight {
            background: #f0f0f0;
            padding: 6px 4px;
            font-weight: bold;
            margin: 5px -4px;
          }
          .divider {
            border-top: 1px dashed #000;
            margin: 10px 0;
          }
          .total-section {
            border-top: 2px solid #000;
            border-bottom: 2px solid #000;
            padding: 8px 0;
            margin: 10px 0;
          }
          .total-row {
            display: flex;
            justify-content: space-between;
            font-size: 14px;
            font-weight: bold;
          }
          .footer {
            text-align: center;
            font-size: 10px;
            margin-top: 15px;
            padding-top: 10px;
            border-top: 1px dashed #000;
          }
          .signature {
            margin-top: 30px;
            border-top: 1px solid #000;
            padding-top: 5px;
            font-size: 10px;
          }
          .contact { margin-top: 10px; font-size: 11px; }
          @media print {
            body { padding: 0; }
            .receipt { border: none; }
          }
        </style>
      </head>
      <body>
        ${printContent}
        <script>
          window.onload = function() {
            window.print();
            window.onafterprint = function() { window.close(); }
          }
        </script>
      </body>
      </html>
    `);
    printWindow.document.close();
  };

  // Payment Receipt (Daily/Weekly/Monthly/Vaddi)
  const PaymentReceipt = () => (
    <div className="receipt">
      <div className="header">
        <div className="company-name">Om Sai Murugan Finance</div>
        <div className="tagline">Your Trusted Finance Partner</div>
        <div className="receipt-type">PAYMENT RECEIPT</div>
      </div>

      <div className="details">
        <div className="row">
          <span>Date:</span>
          <span>{formatDate(data.date || new Date())}</span>
        </div>
        <div className="row">
          <span>Receipt No:</span>
          <span>#{data.receiptNo || Date.now().toString().slice(-8)}</span>
        </div>
      </div>

      <div className="divider"></div>

      <div className="details">
        <div className="row">
          <span>Customer:</span>
          <span>{data.customerName}</span>
        </div>
        {data.phone && (
          <div className="row">
            <span>Phone:</span>
            <span>{data.phone}</span>
          </div>
        )}
        <div className="row">
          <span>Loan Type:</span>
          <span>{data.loanType}</span>
        </div>
        {data.loanName && (
          <div className="row">
            <span>Loan:</span>
            <span>{data.loanName}</span>
          </div>
        )}
      </div>

      <div className="total-section">
        <div className="total-row">
          <span>Amount Paid:</span>
          <span>{formatCurrency(data.amountPaid)}</span>
        </div>
      </div>

      <div className="details">
        {data.loanAmount && (
          <div className="row">
            <span>Loan Amount:</span>
            <span>{formatCurrency(data.loanAmount)}</span>
          </div>
        )}
        {data.totalPaid !== undefined && (
          <div className="row">
            <span>Total Paid:</span>
            <span>{formatCurrency(data.totalPaid)}</span>
          </div>
        )}
        {data.balance !== undefined && (
          <div className="row highlight">
            <span>Balance:</span>
            <span>{formatCurrency(data.balance)}</span>
          </div>
        )}
        {data.weekNumber && (
          <div className="row">
            <span>Week No:</span>
            <span>{data.weekNumber}</span>
          </div>
        )}
      </div>

      <div className="footer">
        <div className="signature">Authorized Signature</div>
        <div className="contact">
          <div>📞 8667510724</div>
          <div>Thank you for your payment!</div>
        </div>
      </div>
    </div>
  );

  // Loan Given Receipt
  const LoanGivenReceipt = () => (
    <div className="receipt">
      <div className="header">
        <div className="company-name">Om Sai Murugan Finance</div>
        <div className="tagline">Your Trusted Finance Partner</div>
        <div className="receipt-type">LOAN DISBURSEMENT</div>
      </div>

      <div className="details">
        <div className="row">
          <span>Date:</span>
          <span>{formatDate(data.date || new Date())}</span>
        </div>
        <div className="row">
          <span>Loan ID:</span>
          <span>#{data.loanId?.slice(-8) || Date.now().toString().slice(-8)}</span>
        </div>
      </div>

      <div className="divider"></div>

      <div className="details">
        <div className="row">
          <span>Customer:</span>
          <span>{data.customerName}</span>
        </div>
        {data.phone && (
          <div className="row">
            <span>Phone:</span>
            <span>{data.phone}</span>
          </div>
        )}
        <div className="row">
          <span>Loan Type:</span>
          <span>{data.loanType}</span>
        </div>
      </div>

      <div className="total-section">
        <div className="total-row">
          <span>Amount Given:</span>
          <span>{formatCurrency(data.loanAmount)}</span>
        </div>
      </div>

      <div className="details">
        {data.loanType === 'Weekly' && (
          <div className="row">
            <span>Weekly EMI:</span>
            <span>{formatCurrency(data.weeklyAmount)}</span>
          </div>
        )}
        {data.loanType === 'Monthly' && (
          <div className="row">
            <span>Monthly EMI:</span>
            <span>{formatCurrency(data.monthlyAmount)}</span>
          </div>
        )}
        {data.loanType === 'Daily' && (
          <>
            <div className="row">
              <span>Daily Amount:</span>
              <span>{formatCurrency(data.dailyAmount)}</span>
            </div>
            <div className="row">
              <span>Asked Amount:</span>
              <span>{formatCurrency(data.askedAmount)}</span>
            </div>
          </>
        )}
        {data.loanType === 'Vaddi' && (
          <div className="row">
            <span>Interest Rate:</span>
            <span>{data.interestRate || 3}% per month</span>
          </div>
        )}
      </div>

      <div className="footer">
        <div style={{ marginBottom: '20px' }}>
          <div>Customer Signature: ____________</div>
        </div>
        <div className="signature">Authorized Signature</div>
        <div className="contact">
          <div>📞 8667510724</div>
        </div>
      </div>
    </div>
  );

  // Chit Payment Receipt
  const ChitPaymentReceipt = () => (
    <div className="receipt">
      <div className="header">
        <div className="company-name">Om Sai Murugan Finance</div>
        <div className="tagline">Chit Fund Division</div>
        <div className="receipt-type">CHIT PAYMENT</div>
      </div>

      <div className="details">
        <div className="row">
          <span>Date:</span>
          <span>{formatDate(data.date || new Date())}</span>
        </div>
        <div className="row">
          <span>Receipt No:</span>
          <span>#{Date.now().toString().slice(-8)}</span>
        </div>
      </div>

      <div className="divider"></div>

      <div className="details">
        <div className="row">
          <span>Chit Group:</span>
          <span>{data.chitName}</span>
        </div>
        <div className="row">
          <span>Member:</span>
          <span>{data.memberName}</span>
        </div>
        <div className="row">
          <span>Month:</span>
          <span>{data.month}</span>
        </div>
      </div>

      <div className="total-section">
        <div className="total-row">
          <span>Amount Paid:</span>
          <span>{formatCurrency(data.amountPaid)}</span>
        </div>
      </div>

      <div className="footer">
        <div className="signature">Authorized Signature</div>
        <div className="contact">
          <div>📞 8667510724</div>
          <div>Thank you!</div>
        </div>
      </div>
    </div>
  );

  // Chit Auction Receipt
  const ChitAuctionReceipt = () => (
    <div className="receipt">
      <div className="header">
        <div className="company-name">Om Sai Murugan Finance</div>
        <div className="tagline">Chit Fund Division</div>
        <div className="receipt-type">AUCTION WINNER</div>
      </div>

      <div className="details">
        <div className="row">
          <span>Date:</span>
          <span>{formatDate(data.auctionDate || new Date())}</span>
        </div>
        <div className="row">
          <span>Chit Group:</span>
          <span>{data.chitName}</span>
        </div>
        <div className="row">
          <span>Month:</span>
          <span>{data.month}</span>
        </div>
      </div>

      <div className="divider"></div>

      <div className="details">
        <div className="row highlight">
          <span>Winner:</span>
          <span>{data.winnerName}</span>
        </div>
        <div className="row">
          <span>Bid Amount:</span>
          <span>{formatCurrency(data.bidAmount)}</span>
        </div>
        <div className="row">
          <span>Commission:</span>
          <span>{formatCurrency(data.commission)}</span>
        </div>
        <div className="row">
          <span>Total Collected:</span>
          <span>{formatCurrency(data.totalCollected)}</span>
        </div>
      </div>

      <div className="total-section">
        <div className="total-row">
          <span>Amount to Winner:</span>
          <span>{formatCurrency(data.amountToWinner)}</span>
        </div>
      </div>

      <div className="footer">
        <div style={{ marginBottom: '20px' }}>
          <div>Winner Signature: ____________</div>
        </div>
        <div className="signature">Authorized Signature</div>
        <div className="contact">
          <div>📞 8667510724</div>
        </div>
      </div>
    </div>
  );

  const getReceiptComponent = () => {
    switch (type) {
      case 'payment': return <PaymentReceipt />;
      case 'loan_given': return <LoanGivenReceipt />;
      case 'chit_payment': return <ChitPaymentReceipt />;
      case 'chit_auction': return <ChitAuctionReceipt />;
      default: return <PaymentReceipt />;
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 2000,
      padding: '20px'
    }}>
      <div style={{
        backgroundColor: 'white',
        borderRadius: '12px',
        maxWidth: '350px',
        width: '100%',
        maxHeight: '90vh',
        overflow: 'auto'
      }}>
        {/* Preview */}
        <div ref={printRef} style={{ padding: '15px' }}>
          {getReceiptComponent()}
        </div>

        {/* Action Buttons */}
        <div style={{
          display: 'flex',
          gap: '10px',
          padding: '15px',
          borderTop: '1px solid #e5e7eb',
          background: '#f9fafb'
        }}>
          <button
            onClick={onClose}
            style={{
              flex: 1,
              padding: '12px',
              background: '#6b7280',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            Close
          </button>
          <button
            onClick={handlePrint}
            style={{
              flex: 2,
              padding: '12px',
              background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px'
            }}
          >
            🖨️ Print Receipt
          </button>
        </div>
      </div>
    </div>
  );
}

export default PrintReceipt;
