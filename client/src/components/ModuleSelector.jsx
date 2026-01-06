import { useState } from 'react';

function ModuleSelector({ onSelectModule }) {
  const [hoveredModule, setHoveredModule] = useState(null);

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
          FINANCE & CHIT FUND
        </p>
      </div>

      {/* Module Cards */}
      <div style={{
        display: 'flex',
        gap: '20px',
        flexWrap: 'wrap',
        justifyContent: 'center',
        maxWidth: '500px'
      }}>
        {modules.map((module) => (
          <div
            key={module.id}
            onClick={() => onSelectModule(module.id)}
            onMouseEnter={() => setHoveredModule(module.id)}
            onMouseLeave={() => setHoveredModule(null)}
            style={{
              background: module.gradient,
              borderRadius: '20px',
              padding: '30px 40px',
              cursor: 'pointer',
              textAlign: 'center',
              minWidth: '180px',
              boxShadow: hoveredModule === module.id
                ? `0 20px 40px rgba(0,0,0,0.4), 0 0 30px ${module.color}40`
                : '0 10px 30px rgba(0,0,0,0.3)',
              transform: hoveredModule === module.id ? 'translateY(-8px) scale(1.02)' : 'translateY(0)',
              transition: 'all 0.3s ease',
              border: '1px solid rgba(255,255,255,0.1)'
            }}
          >
            <div style={{
              fontSize: '48px',
              marginBottom: '15px',
              filter: hoveredModule === module.id ? 'drop-shadow(0 0 10px rgba(255,255,255,0.5))' : 'none',
              transition: 'filter 0.3s ease'
            }}>
              {module.icon}
            </div>
            <h2 style={{
              color: 'white',
              fontSize: '22px',
              fontWeight: 700,
              margin: '0 0 8px'
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

      {/* Footer */}
      <p style={{
        color: '#64748b',
        fontSize: '11px',
        marginTop: '40px'
      }}>
        Select a module to continue
      </p>
    </div>
  );
}

export default ModuleSelector;
