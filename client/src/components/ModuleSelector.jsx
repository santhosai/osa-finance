import { useState } from 'react';
import { downloadFullBackup } from '../utils/fullBackup';

function ModuleSelector({ onSelectModule }) {
  const [hoveredModule, setHoveredModule] = useState(null);
  const [backupStatus, setBackupStatus] = useState(''); // progress / result text
  const [backingUp, setBackingUp] = useState(false);

  const runBackup = async () => {
    setBackingUp(true);
    try {
      const { total, sheets, failed } = await downloadFullBackup(setBackupStatus);
      setBackupStatus(failed.length
        ? `Downloaded ${total} records. Could not get: ${failed.join(', ')}`
        : `✅ Downloaded ${total} records in ${sheets} sheets`);
    } catch (e) {
      setBackupStatus(`❌ Backup failed: ${e.message}. Check internet and try again.`);
    }
    setBackingUp(false);
  };

  const modules = [
    {
      id: 'finance',
      icon: '💰',
      title: 'Finance',
      subtitle: 'Weekly & Monthly Loans',
      color: '#1e40af',
      gradient: 'linear-gradient(135deg, #1e40af 0%, #1e3a8a 100%)'
    },
    {
      id: 'chit',
      icon: '🎯',
      title: 'Chit Fund',
      subtitle: 'Monthly Collections',
      color: '#7c3aed',
      gradient: 'linear-gradient(135deg, #7c3aed 0%, #5b21b6 100%)'
    },
    {
      id: 'auto-finance',
      icon: '🚗',
      title: 'Auto Finance',
      subtitle: 'Vehicle Loans & EMI',
      color: '#0d9488',
      gradient: 'linear-gradient(135deg, #0d9488 0%, #065f46 100%)'
    },
    {
      id: 'festival-fund',
      icon: '🎉',
      title: 'Festival Fund',
      subtitle: '10-Month Savings Scheme',
      color: '#d97706',
      gradient: 'linear-gradient(135deg, #d97706 0%, #b45309 100%)'
    },
    {
      id: 'pongal-fund',
      icon: '🌾',
      title: 'Pongal Scheme',
      subtitle: '12-Month Grocery Savings',
      color: '#c2410c',
      gradient: 'linear-gradient(135deg, #f2a93b 0%, #c2410c 100%)'
    },
    {
      id: 'savings-schemes',
      icon: '🪔',
      title: 'Savings Schemes',
      subtitle: 'Diwali, Pongal & more',
      color: '#7a1424',
      gradient: 'linear-gradient(135deg, #a3263a 0%, #5c0f1b 100%)'
    }
  ];

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px'
    }}>
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: '40px' }}>
        <h1 style={{
          color: '#f59e0b',
          fontSize: '28px',
          fontWeight: 800,
          margin: 0,
          textShadow: '0 2px 10px rgba(245, 158, 11, 0.3)'
        }}>
          OM SAI MURUGAN
        </h1>
        <p style={{
          color: '#94a3b8',
          fontSize: '14px',
          margin: '8px 0 0',
          letterSpacing: '3px'
        }}>
          FINANCE MANAGEMENT
        </p>
      </div>

      {/* Module Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
        gap: '14px',
        width: '100%',
        maxWidth: '520px'
      }}>
        {modules.map((module) => (
          <div
            key={module.id}
            onClick={() => onSelectModule(module.id)}
            onMouseEnter={() => setHoveredModule(module.id)}
            onMouseLeave={() => setHoveredModule(null)}
            style={{
              background: module.gradient,
              borderRadius: '18px',
              padding: '22px 12px',
              cursor: 'pointer',
              textAlign: 'center',
              minWidth: 0,
              boxShadow: hoveredModule === module.id
                ? `0 20px 40px rgba(0,0,0,0.4), 0 0 30px ${module.color}40`
                : '0 10px 30px rgba(0,0,0,0.3)',
              transform: hoveredModule === module.id ? 'translateY(-8px) scale(1.02)' : 'translateY(0)',
              transition: 'all 0.3s ease',
              border: '1px solid rgba(255,255,255,0.1)'
            }}
          >
            <div style={{
              fontSize: '40px',
              marginBottom: '10px',
              filter: hoveredModule === module.id ? 'drop-shadow(0 0 10px rgba(255,255,255,0.5))' : 'none',
              transition: 'filter 0.3s ease'
            }}>
              {module.icon}
            </div>
            <h2 style={{
              color: 'white',
              fontSize: '18px',
              fontWeight: 700,
              margin: '0 0 6px'
            }}>
              {module.title}
            </h2>
            <p style={{
              color: 'rgba(255,255,255,0.7)',
              fontSize: '12px',
              margin: 0
            }}>
              {module.subtitle}
            </p>
          </div>
        ))}
      </div>

      {/* One-click full backup of every module */}
      <div style={{ width: '100%', maxWidth: '520px', marginTop: '22px', textAlign: 'center' }}>
        <button
          onClick={runBackup}
          disabled={backingUp}
          style={{
            width: '100%', padding: '14px', borderRadius: '14px', border: '1px solid #15803d',
            background: backingUp ? '#14532d' : 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)',
            color: 'white', fontSize: '15px', fontWeight: 700, cursor: backingUp ? 'wait' : 'pointer'
          }}
        >
          {backingUp ? '⏳ Taking backup…' : '📥 Download Full Backup (Excel)'}
        </button>
        <p style={{ color: backupStatus.startsWith('❌') ? '#f87171' : '#94a3b8', fontSize: '12px', margin: '8px 0 0', minHeight: '16px' }}>
          {backupStatus || 'All modules, all customers and all payments in one Excel file'}
        </p>
      </div>

      {/* Footer */}
      <p style={{
        color: '#64748b',
        fontSize: '11px',
        marginTop: '16px'
      }}>
        Select a module to continue
      </p>
    </div>
  );
}

export default ModuleSelector;
