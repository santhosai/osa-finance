import { QRCodeSVG } from 'qrcode.react';

function CustomerQRGenerator({ onClose }) {
  const customerPortalURL = window.location.origin + '/balance-check';

  const handlePrint = () => {
    window.print();
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0,0,0,0.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2000,
        padding: '20px'
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'white',
          borderRadius: '16px',
          maxWidth: '600px',
          width: '100%',
          maxHeight: '90vh',
          overflow: 'auto',
          boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
            color: 'white',
            padding: '20px',
            borderRadius: '16px 16px 0 0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}
        >
          <div>
            <h3 style={{ margin: 0, fontSize: '20px', fontWeight: 700 }}>
              📱 Customer Portal QR Code
            </h3>
            <p style={{ margin: '4px 0 0 0', fontSize: '13px', opacity: 0.9 }}>
              Print and share with customers
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'rgba(255,255,255,0.2)',
              border: 'none',
              color: 'white',
              borderRadius: '8px',
              padding: '8px 16px',
              cursor: 'pointer',
              fontSize: '16px',
              fontWeight: 600
            }}
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: '30px', textAlign: 'center' }}>
          {/* QR Code */}
          <div
            style={{
              background: 'white',
              padding: '30px',
              borderRadius: '16px',
              border: '3px solid #3b82f6',
              display: 'inline-block',
              boxShadow: '0 4px 20px rgba(59,130,246,0.2)'
            }}
          >
            <QRCodeSVG
              value={customerPortalURL}
              size={256}
              level="H"
              includeMargin={true}
            />
          </div>

          {/* Instructions */}
          <div
            style={{
              background: '#eff6ff',
              borderRadius: '12px',
              padding: '20px',
              marginTop: '24px',
              textAlign: 'left'
            }}
          >
            <h4 style={{ margin: '0 0 12px', color: '#1e40af', fontSize: '16px' }}>
              📋 How Customers Use This:
            </h4>
            <ol style={{ margin: 0, paddingLeft: '20px', color: '#1e3a8a', lineHeight: 1.8, fontSize: '14px' }}>
              <li>Scan this QR code with their phone camera</li>
              <li>Opens customer portal automatically</li>
              <li>Enter their 10-digit mobile number</li>
              <li>View all their loans (Finance + Auto Finance)</li>
              <li>See balance, EMI amount, payment history</li>
              <li>Pay via UPI with screenshot upload</li>
            </ol>
          </div>

          {/* URL Display */}
          <div
            style={{
              background: '#f1f5f9',
              borderRadius: '10px',
              padding: '16px',
              marginTop: '16px'
            }}
          >
            <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '6px', fontWeight: 600 }}>
              Customer Portal URL:
            </div>
            <div
              style={{
                fontSize: '14px',
                color: '#3b82f6',
                fontWeight: 700,
                wordBreak: 'break-all',
                fontFamily: 'monospace'
              }}
            >
              {customerPortalURL}
            </div>
          </div>

          {/* What Customers Can See */}
          <div
            style={{
              background: '#fefce8',
              border: '2px solid #fbbf24',
              borderRadius: '12px',
              padding: '20px',
              marginTop: '20px',
              textAlign: 'left'
            }}
          >
            <h4 style={{ margin: '0 0 12px', color: '#92400e', fontSize: '16px' }}>
              ✨ What Customers Can Access:
            </h4>
            <div style={{ display: 'grid', gap: '8px', fontSize: '13px', color: '#713f12' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '16px' }}>💰</span>
                <span><strong>Monthly Finance Loans</strong> - View balance & payment history</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '16px' }}>🚗</span>
                <span><strong>Auto Finance (Vehicle) Loans</strong> - View EMI schedule & pay</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '16px' }}>📊</span>
                <span><strong>Payment History</strong> - See all past payments</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '16px' }}>💳</span>
                <span><strong>UPI Payment</strong> - Pay instantly via UPI</span>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
            <button
              type="button"
              onClick={handlePrint}
              style={{
                flex: 1,
                padding: '14px',
                background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
                color: 'white',
                border: 'none',
                borderRadius: '10px',
                fontSize: '15px',
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(59,130,246,0.3)'
              }}
            >
              🖨️ Print QR Code
            </button>
            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(customerPortalURL);
                alert('✅ URL copied to clipboard!');
              }}
              style={{
                flex: 1,
                padding: '14px',
                background: '#10b981',
                color: 'white',
                border: 'none',
                borderRadius: '10px',
                fontSize: '15px',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              📋 Copy URL
            </button>
          </div>
        </div>

        {/* Print Styles */}
        <style>
          {`
            @media print {
              body * {
                visibility: hidden;
              }
              div[style*="background: white"][style*="borderRadius: 16px"] {
                visibility: visible !important;
                position: absolute;
                left: 0;
                top: 0;
                width: 100%;
              }
              div[style*="background: white"][style*="borderRadius: 16px"] * {
                visibility: visible !important;
              }
              button {
                display: none !important;
              }
            }
          `}
        </style>
      </div>
    </div>
  );
}

export default CustomerQRGenerator;
