import { useRef, useState } from 'react';

// ESC/POS Commands for Thermal Printer
const ESC = '\x1B';
const GS = '\x1D';
const COMMANDS = {
  INIT: ESC + '@',                    // Initialize printer
  ALIGN_CENTER: ESC + 'a' + '\x01',   // Center align
  ALIGN_LEFT: ESC + 'a' + '\x00',     // Left align
  ALIGN_RIGHT: ESC + 'a' + '\x02',    // Right align
  BOLD_ON: ESC + 'E' + '\x01',        // Bold on
  BOLD_OFF: ESC + 'E' + '\x00',       // Bold off
  DOUBLE_HEIGHT: GS + '!' + '\x10',   // Double height
  DOUBLE_WIDTH: GS + '!' + '\x20',    // Double width
  NORMAL_SIZE: GS + '!' + '\x00',     // Normal size
  CUT: GS + 'V' + '\x00',             // Full cut
  PARTIAL_CUT: GS + 'V' + '\x01',     // Partial cut
  FEED: ESC + 'd' + '\x03',           // Feed 3 lines
  LINE: '--------------------------------\n',
  DASHED: '- - - - - - - - - - - - - - - -\n'
};

// Reusable Print Receipt Component
function PrintReceipt({
  type, // 'payment', 'loan_given', 'loan_statement', 'chit_payment', 'chit_auction'
  data,
  onClose
}) {
  const printRef = useRef();
  const [bluetoothDevice, setBluetoothDevice] = useState(null);
  const [bluetoothStatus, setBluetoothStatus] = useState('');
  const [isPrinting, setIsPrinting] = useState(false);

  const formatCurrency = (amount) => `₹${(Number(amount) || 0).toLocaleString('en-IN')}`;
  const formatForThermal = (amount) => {
    if (!amount) return '0';
    return Math.round(Number(amount)).toString();
  };
  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const handlePrint = () => {
    const printContent = printRef.current.innerHTML;

    // Create a hidden iframe for printing (works better on mobile)
    const iframe = document.createElement('iframe');
    iframe.style.position = 'absolute';
    iframe.style.top = '-10000px';
    iframe.style.left = '-10000px';
    iframe.style.width = '58mm'; // Thermal printer width
    iframe.style.height = 'auto';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow.document;
    doc.open();
    doc.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Receipt</title>
        <meta charset="UTF-8">
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          @page {
            size: 58mm auto;
            margin: 0;
          }
          body {
            font-family: 'Courier New', Courier, monospace;
            padding: 5px;
            width: 58mm;
            font-size: 11px;
            line-height: 1.3;
            color: #000;
            background: #fff;
          }
          .receipt {
            padding: 8px;
            background: #fff;
          }
          .header {
            text-align: center;
            border-bottom: 1px dashed #000;
            padding-bottom: 8px;
            margin-bottom: 8px;
          }
          .company-name {
            font-size: 14px;
            font-weight: bold;
            text-transform: uppercase;
          }
          .tagline { font-size: 9px; margin-top: 3px; }
          .receipt-type {
            font-size: 10px;
            background: #000;
            color: #fff;
            padding: 2px 6px;
            margin-top: 6px;
            display: inline-block;
          }
          .details { margin: 8px 0; }
          .row {
            display: flex;
            justify-content: space-between;
            padding: 2px 0;
            font-size: 10px;
          }
          .row span:first-child { font-weight: normal; }
          .row span:last-child { font-weight: bold; text-align: right; }
          .row.highlight {
            background: #eee;
            padding: 4px 2px;
            font-weight: bold;
            margin: 3px -2px;
          }
          .divider {
            border-top: 1px dashed #000;
            margin: 8px 0;
          }
          .total-section {
            border-top: 1px solid #000;
            border-bottom: 1px solid #000;
            padding: 6px 0;
            margin: 8px 0;
          }
          .total-row {
            display: flex;
            justify-content: space-between;
            font-size: 12px;
            font-weight: bold;
          }
          .footer {
            text-align: center;
            font-size: 9px;
            margin-top: 10px;
            padding-top: 8px;
            border-top: 1px dashed #000;
          }
          .signature {
            margin-top: 20px;
            border-top: 1px solid #000;
            padding-top: 3px;
            font-size: 9px;
          }
          .contact { margin-top: 8px; font-size: 10px; }
        </style>
      </head>
      <body>
        ${printContent}
      </body>
      </html>
    `);
    doc.close();

    // Wait for content to load then print
    iframe.onload = function() {
      setTimeout(() => {
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
        // Remove iframe after printing
        setTimeout(() => {
          document.body.removeChild(iframe);
        }, 1000);
      }, 250);
    };
  };

  // Generate ESC/POS formatted text for thermal printer
  const generateThermalReceipt = () => {
    let receipt = COMMANDS.INIT;

    // Header
    receipt += COMMANDS.ALIGN_CENTER;
    receipt += COMMANDS.BOLD_ON;
    receipt += COMMANDS.DOUBLE_HEIGHT;
    receipt += 'OM SAI MURUGAN\n';
    receipt += 'FINANCE\n';
    receipt += COMMANDS.NORMAL_SIZE;
    receipt += COMMANDS.BOLD_OFF;
    receipt += 'Your Trusted Partner\n';
    receipt += COMMANDS.LINE;

    // Receipt Type
    receipt += COMMANDS.BOLD_ON;
    if (type === 'payment') receipt += '** PAYMENT RECEIPT **\n';
    else if (type === 'loan_given') receipt += '** LOAN DISBURSEMENT **\n';
    else if (type === 'chit_payment') receipt += '** CHIT PAYMENT **\n';
    else if (type === 'chit_auction') receipt += '** AUCTION WINNER **\n';
    receipt += COMMANDS.BOLD_OFF;
    receipt += COMMANDS.LINE;

    // Date & Receipt No
    receipt += COMMANDS.ALIGN_LEFT;
    const dateStr = formatDate(data.date || new Date());
    receipt += `Date: ${dateStr}\n`;
    receipt += `Rcpt#: ${data.receiptNo || Date.now().toString().slice(-8)}\n`;
    receipt += COMMANDS.DASHED;

    // Customer Details
    receipt += `Customer: ${data.customerName || data.memberName || data.winnerName || '-'}\n`;
    if (data.phone) receipt += `Phone: ${data.phone}\n`;
    if (data.loanType) receipt += `Type: ${data.loanType}\n`;
    if (data.loanName) receipt += `Loan: ${data.loanName}\n`;
    if (data.chitName) receipt += `Chit: ${data.chitName}\n`;
    if (data.month) receipt += `Month: ${data.month}\n`;

    receipt += COMMANDS.LINE;

    // Amount Section
    receipt += COMMANDS.ALIGN_CENTER;
    receipt += COMMANDS.BOLD_ON;
    receipt += COMMANDS.DOUBLE_HEIGHT;
    if (type === 'payment' || type === 'chit_payment') {
      receipt += `PAID: Rs ${formatForThermal(data.amountPaid)}\n`;
    } else if (type === 'loan_given') {
      receipt += `GIVEN: Rs ${formatForThermal(data.loanAmount)}\n`;
    } else if (type === 'chit_auction') {
      receipt += `WINNER: Rs ${formatForThermal(data.amountToWinner)}\n`;
    }
    receipt += COMMANDS.NORMAL_SIZE;
    receipt += COMMANDS.BOLD_OFF;

    receipt += COMMANDS.LINE;
    receipt += COMMANDS.ALIGN_LEFT;

    // Additional Details
    if (data.loanAmount && type === 'payment') {
      receipt += `Loan Amt: Rs ${formatForThermal(data.loanAmount)}\n`;
    }
    if (data.totalPaid !== undefined) {
      receipt += `Total Paid: Rs ${formatForThermal(data.totalPaid)}\n`;
    }
    if (data.balance !== undefined) {
      receipt += COMMANDS.BOLD_ON;
      receipt += `BALANCE: Rs ${formatForThermal(data.balance)}\n`;
      receipt += COMMANDS.BOLD_OFF;
    }
    if (data.weekNumber) {
      receipt += `Week No: ${data.weekNumber}\n`;
    }
    if (data.weeklyAmount) {
      receipt += `Weekly EMI: Rs ${formatForThermal(data.weeklyAmount)}\n`;
    }
    if (data.monthlyAmount) {
      receipt += `Monthly EMI: Rs ${formatForThermal(data.monthlyAmount)}\n`;
    }
    if (data.interestRate) {
      receipt += `Interest: ${data.interestRate}% per month\n`;
    }
    // Vaddi-specific fields
    if (data.interestMonth) {
      receipt += `Interest Month: ${data.interestMonth}\n`;
    }
    if (data.myShare !== undefined) {
      receipt += `My Share: Rs ${formatForThermal(data.myShare)}\n`;
    }
    if (data.friendShare !== undefined) {
      receipt += `Friend Share: Rs ${formatForThermal(data.friendShare)}\n`;
    }

    // Footer
    receipt += COMMANDS.DASHED;
    receipt += COMMANDS.ALIGN_CENTER;
    receipt += 'Ph: 8667510724\n';
    receipt += 'Thank you!\n';
    receipt += COMMANDS.FEED;
    receipt += COMMANDS.PARTIAL_CUT;

    return receipt;
  };

  // Connect to Bluetooth Printer
  const connectBluetooth = async () => {
    try {
      setBluetoothStatus('Searching for printers...');

      // Check if Web Bluetooth is supported
      if (!navigator.bluetooth) {
        setBluetoothStatus('Bluetooth not supported. Use RawBT app instead.');
        return null;
      }

      // Request device with common thermal printer services
      const device = await navigator.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: [
          '000018f0-0000-1000-8000-00805f9b34fb', // Common printer service
          '49535343-fe7d-4ae5-8fa9-9fafd205e455', // Nordic UART
          'e7810a71-73ae-499d-8c15-faa9aef0c3f2'  // Another common service
        ]
      });

      setBluetoothStatus(`Connecting to ${device.name}...`);

      const server = await device.gatt.connect();
      setBluetoothDevice({ device, server });
      setBluetoothStatus(`Connected: ${device.name}`);

      return { device, server };
    } catch (error) {
      console.error('Bluetooth error:', error);
      if (error.name === 'NotFoundError') {
        setBluetoothStatus('No printer selected. Try again.');
      } else {
        setBluetoothStatus(`Error: ${error.message}`);
      }
      return null;
    }
  };

  // Print via Bluetooth
  const handleBluetoothPrint = async () => {
    setIsPrinting(true);

    try {
      let connection = bluetoothDevice;

      if (!connection || !connection.device.gatt.connected) {
        connection = await connectBluetooth();
        if (!connection) {
          setIsPrinting(false);
          return;
        }
      }

      setBluetoothStatus('Getting printer service...');

      // Try to find the printer service
      const services = await connection.server.getPrimaryServices();
      let characteristic = null;

      for (const service of services) {
        try {
          const characteristics = await service.getCharacteristics();
          for (const char of characteristics) {
            if (char.properties.write || char.properties.writeWithoutResponse) {
              characteristic = char;
              break;
            }
          }
          if (characteristic) break;
        } catch (e) {
          console.log('Service error:', e);
        }
      }

      if (!characteristic) {
        setBluetoothStatus('Printer not compatible. Use RawBT app.');
        setIsPrinting(false);
        return;
      }

      setBluetoothStatus('Printing...');

      // Generate receipt data
      const receiptData = generateThermalReceipt();

      // Convert to bytes and send in chunks
      const encoder = new TextEncoder();
      const bytes = encoder.encode(receiptData);
      const chunkSize = 100; // Send in 100-byte chunks

      for (let i = 0; i < bytes.length; i += chunkSize) {
        const chunk = bytes.slice(i, i + chunkSize);
        if (characteristic.properties.writeWithoutResponse) {
          await characteristic.writeValueWithoutResponse(chunk);
        } else {
          await characteristic.writeValue(chunk);
        }
        // Small delay between chunks
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      setBluetoothStatus('Printed successfully!');
      setTimeout(() => setBluetoothStatus(''), 3000);

    } catch (error) {
      console.error('Print error:', error);
      setBluetoothStatus(`Print failed: ${error.message}`);
    } finally {
      setIsPrinting(false);
    }
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
        {data.interestMonth && (
          <div className="row">
            <span>Interest Month:</span>
            <span>{data.interestMonth}</span>
          </div>
        )}
        {data.myShare !== undefined && (
          <div className="row">
            <span>My Share:</span>
            <span>{formatCurrency(data.myShare)}</span>
          </div>
        )}
        {data.friendShare !== undefined && (
          <div className="row">
            <span>Friend Share:</span>
            <span>{formatCurrency(data.friendShare)}</span>
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
          padding: '15px',
          borderTop: '1px solid #e5e7eb',
          background: '#f9fafb'
        }}>
          {/* Bluetooth Status */}
          {bluetoothStatus && (
            <div style={{
              marginBottom: '10px',
              padding: '8px 12px',
              background: bluetoothStatus.includes('success') ? '#dcfce7' :
                         bluetoothStatus.includes('Error') || bluetoothStatus.includes('failed') ? '#fee2e2' : '#dbeafe',
              color: bluetoothStatus.includes('success') ? '#166534' :
                     bluetoothStatus.includes('Error') || bluetoothStatus.includes('failed') ? '#991b1b' : '#1e40af',
              borderRadius: '6px',
              fontSize: '12px',
              textAlign: 'center'
            }}>
              {bluetoothStatus}
            </div>
          )}

          <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
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
              🖨️ Normal Print
            </button>
          </div>

          {/* Bluetooth Thermal Print Button */}
          <button
            onClick={handleBluetoothPrint}
            disabled={isPrinting}
            style={{
              width: '100%',
              padding: '14px',
              background: isPrinting ? '#9ca3af' : 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '15px',
              fontWeight: 700,
              cursor: isPrinting ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px'
            }}
          >
            {isPrinting ? '⏳ Printing...' : '📱 Bluetooth Thermal Print (58mm)'}
          </button>

          <div style={{
            marginTop: '10px',
            fontSize: '10px',
            color: '#6b7280',
            textAlign: 'center'
          }}>
            For P58E thermal printer via Bluetooth
          </div>
        </div>
      </div>
    </div>
  );
}

export default PrintReceipt;
