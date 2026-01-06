import { useState, useEffect } from 'react';
import useSWR from 'swr';
import { API_URL } from '../config';
import WhatsAppModal from './WhatsAppModal';

const fetcher = (url) => fetch(url).then(res => res.json());

function ChitDashboard({ navigateTo }) {
  const [showSidebar, setShowSidebar] = useState(false);
  const [selectedChit, setSelectedChit] = useState(null);
  const [showAddChitModal, setShowAddChitModal] = useState(false);
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false);
  const [pendingWhatsApp, setPendingWhatsApp] = useState(null);
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  // Fetch all chit groups
  const { data: chitGroups = [], mutate: mutateChits } = useSWR(`${API_URL}/chit-groups`, fetcher, {
    refreshInterval: 30000,
    revalidateOnFocus: true,
  });

  // Fetch members and payments for selected chit
  const { data: chitDetails, mutate: mutateDetails } = useSWR(
    selectedChit ? `${API_URL}/chit-groups/${selectedChit.id}?month=${selectedMonth}` : null,
    fetcher,
    { revalidateOnFocus: true }
  );

  // Fetch chit settings for selected chit and month
  const { data: chitSettings = { chit_number: '', custom_note: '' }, mutate: mutateSettings } = useSWR(
    selectedChit ? `${API_URL}/chit-settings/${selectedChit.id}/${selectedMonth}` : null,
    fetcher,
    { revalidateOnFocus: true }
  );

  const formatCurrency = (amount) => `₹${(amount || 0).toLocaleString('en-IN')}`;

  const handleLogout = () => {
    localStorage.removeItem('isLoggedIn');
    localStorage.removeItem('selectedModule');
    window.location.reload();
  };

  const markAsPaid = async (memberId, memberName, phone) => {
    try {
      const response = await fetch(`${API_URL}/chit-payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chit_group_id: selectedChit.id,
          member_id: memberId,
          month: selectedMonth,
          amount: selectedChit.monthly_amount,
          payment_date: new Date().toISOString().split('T')[0]
        })
      });

      if (response.ok) {
        mutateDetails();
        mutateChits();

        // Show WhatsApp modal if phone exists
        if (phone) {
          setPendingWhatsApp({
            phone,
            messageData: {
              chitName: selectedChit.name,
              chitNumber: chitSettings.chit_number,
              memberName,
              amount: formatCurrency(selectedChit.monthly_amount),
              month: selectedMonth,
              date: new Date().toLocaleDateString('en-IN')
            }
          });
          setShowWhatsAppModal(true);
        }
      }
    } catch (error) {
      console.error('Error marking payment:', error);
      alert('Failed to record payment');
    }
  };

  const undoPayment = async (paymentId) => {
    if (!confirm('Undo this payment?')) return;
    try {
      const response = await fetch(`${API_URL}/chit-payments/${paymentId}`, {
        method: 'DELETE'
      });
      if (response.ok) {
        mutateDetails();
        mutateChits();
      }
    } catch (error) {
      console.error('Error undoing payment:', error);
    }
  };

  const deleteMember = async (memberId, memberName) => {
    if (!confirm(`Delete member "${memberName}"? This cannot be undone.`)) return;
    try {
      const response = await fetch(`${API_URL}/chit-members/${memberId}`, {
        method: 'DELETE'
      });
      if (response.ok) {
        mutateDetails();
        mutateChits();
      } else {
        alert('Failed to delete member');
      }
    } catch (error) {
      console.error('Error deleting member:', error);
      alert('Failed to delete member');
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #7c3aed 0%, #5b21b6 100%)' }}>
      {/* Sidebar */}
      <div
        style={{
          position: 'fixed',
          left: showSidebar ? '0' : '-280px',
          top: 0,
          width: '280px',
          height: '100vh',
          background: 'linear-gradient(180deg, #1e293b 0%, #0f172a 100%)',
          transition: 'left 0.3s ease',
          zIndex: 1000,
          boxShadow: '2px 0 10px rgba(0,0,0,0.3)'
        }}
      >
        <div style={{ padding: '14px', borderBottom: '1px solid #334155' }}>
          <h3 style={{ color: '#a78bfa', margin: 0, fontSize: '16px' }}>🎯 CHIT FUND</h3>
          <p style={{ color: '#94a3b8', margin: '3px 0 0', fontSize: '10px' }}>OM SAI MURUGAN</p>
        </div>

        <div style={{ padding: '6px 0' }}>
          <button
            onClick={() => { setShowSidebar(false); setSelectedChit(null); }}
            style={{
              width: '100%',
              padding: '10px 14px',
              background: 'transparent',
              color: 'white',
              border: 'none',
              textAlign: 'left',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: 600
            }}
          >
            🏠 All Chits
          </button>

          <button
            onClick={() => { setShowSidebar(false); setShowAddChitModal(true); }}
            style={{
              width: '100%',
              padding: '10px 14px',
              background: 'transparent',
              color: 'white',
              border: 'none',
              textAlign: 'left',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: 600
            }}
          >
            ➕ Add New Chit
          </button>

          {selectedChit && (
            <button
              onClick={() => { setShowSidebar(false); setShowSettingsModal(true); }}
              style={{
                width: '100%',
                padding: '10px 14px',
                background: 'transparent',
                color: 'white',
                border: 'none',
                textAlign: 'left',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: 600
              }}
            >
              ⚙️ Month Settings
            </button>
          )}

          <div style={{ borderTop: '1px solid #334155', margin: '10px 0' }} />

          <button
            onClick={handleLogout}
            style={{
              width: '100%',
              padding: '10px 14px',
              background: 'transparent',
              color: '#ef4444',
              border: 'none',
              textAlign: 'left',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: 600
            }}
          >
            🚪 Logout
          </button>
        </div>
      </div>

      {/* Overlay */}
      {showSidebar && (
        <div
          onClick={() => setShowSidebar(false)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.5)',
            zIndex: 999
          }}
        />
      )}

      {/* Main Content */}
      <div style={{ padding: '15px', paddingBottom: '100px' }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '15px'
        }}>
          <button
            onClick={() => setShowSidebar(true)}
            style={{
              background: 'rgba(255,255,255,0.2)',
              border: 'none',
              borderRadius: '8px',
              padding: '10px 14px',
              color: 'white',
              cursor: 'pointer',
              fontSize: '18px'
            }}
          >
            ☰
          </button>

          <h1 style={{ color: 'white', fontSize: '18px', fontWeight: 700, margin: 0 }}>
            🎯 {selectedChit ? selectedChit.name : 'Chit Fund'}
          </h1>

          <input
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            style={{
              padding: '8px',
              borderRadius: '8px',
              border: 'none',
              fontSize: '12px',
              background: 'rgba(255,255,255,0.2)',
              color: 'white'
            }}
          />
        </div>

        {/* Chit List or Member Details */}
        {!selectedChit ? (
          // Show all chit groups
          <div>
            {chitGroups.length === 0 ? (
              <div style={{
                background: 'rgba(255,255,255,0.1)',
                borderRadius: '12px',
                padding: '40px 20px',
                textAlign: 'center',
                color: 'white'
              }}>
                <div style={{ fontSize: '48px', marginBottom: '15px' }}>🎯</div>
                <h3 style={{ margin: '0 0 10px' }}>No Chit Groups Yet</h3>
                <p style={{ opacity: 0.7, fontSize: '14px', margin: '0 0 20px' }}>
                  Create your first chit group to get started
                </p>
                <button
                  onClick={() => setShowAddChitModal(true)}
                  style={{
                    background: 'white',
                    color: '#7c3aed',
                    border: 'none',
                    padding: '12px 24px',
                    borderRadius: '8px',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  ➕ Add Chit Group
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {chitGroups.map((chit) => (
                  <div
                    key={chit.id}
                    onClick={() => setSelectedChit(chit)}
                    style={{
                      background: 'rgba(255,255,255,0.95)',
                      borderRadius: '12px',
                      padding: '15px',
                      cursor: 'pointer',
                      boxShadow: '0 4px 15px rgba(0,0,0,0.2)'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                      <div>
                        <h3 style={{ margin: 0, fontSize: '16px', color: '#1e293b' }}>{chit.name}</h3>
                        <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#64748b' }}>
                          {chit.day_of_month}th of every month • {chit.member_count} members
                        </p>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '18px', fontWeight: 700, color: '#7c3aed' }}>
                          {formatCurrency(chit.chit_amount)}
                        </div>
                        <div style={{ fontSize: '11px', color: '#64748b' }}>
                          {formatCurrency(chit.monthly_amount)}/member
                        </div>
                      </div>
                    </div>

                    {/* Payment Progress */}
                    <div style={{
                      display: 'flex',
                      gap: '10px',
                      alignItems: 'center'
                    }}>
                      <div style={{
                        flex: 1,
                        height: '8px',
                        background: '#e2e8f0',
                        borderRadius: '4px',
                        overflow: 'hidden'
                      }}>
                        <div style={{
                          width: `${((chit.paid_count || 0) / chit.member_count) * 100}%`,
                          height: '100%',
                          background: 'linear-gradient(90deg, #10b981, #059669)',
                          borderRadius: '4px'
                        }} />
                      </div>
                      <div style={{ fontSize: '12px', fontWeight: 600 }}>
                        <span style={{ color: '#10b981' }}>{chit.paid_count || 0}</span>
                        <span style={{ color: '#64748b' }}>/</span>
                        <span style={{ color: '#ef4444' }}>{chit.member_count - (chit.paid_count || 0)}</span>
                      </div>
                    </div>
                  </div>
                ))}

                {/* Add New Chit Button */}
                <button
                  onClick={() => setShowAddChitModal(true)}
                  style={{
                    background: 'rgba(255,255,255,0.2)',
                    border: '2px dashed rgba(255,255,255,0.5)',
                    borderRadius: '12px',
                    padding: '20px',
                    color: 'white',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: 600
                  }}
                >
                  ➕ Add New Chit Group
                </button>
              </div>
            )}
          </div>
        ) : (
          // Show selected chit members
          <div>
            {/* Back button */}
            <button
              onClick={() => setSelectedChit(null)}
              style={{
                background: 'rgba(255,255,255,0.2)',
                border: 'none',
                borderRadius: '8px',
                padding: '8px 16px',
                color: 'white',
                cursor: 'pointer',
                marginBottom: '15px',
                fontSize: '13px'
              }}
            >
              ← Back to All Chits
            </button>

            {/* Summary Card */}
            <div style={{
              background: 'rgba(255,255,255,0.15)',
              borderRadius: '12px',
              padding: '15px',
              marginBottom: '15px',
              color: 'white'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: '12px', opacity: 0.8 }}>Collected</div>
                  <div style={{ fontSize: '20px', fontWeight: 700 }}>
                    {formatCurrency((chitDetails?.paid_count || 0) * selectedChit.monthly_amount)}
                  </div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '12px', opacity: 0.8 }}>Paid</div>
                  <div style={{ fontSize: '20px', fontWeight: 700, color: '#86efac' }}>
                    {chitDetails?.paid_count || 0}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '12px', opacity: 0.8 }}>Pending</div>
                  <div style={{ fontSize: '20px', fontWeight: 700, color: '#fca5a5' }}>
                    {(chitDetails?.members?.length || 0) - (chitDetails?.paid_count || 0)}
                  </div>
                </div>
              </div>
            </div>

            {/* Add Member Button */}
            <button
              onClick={() => setShowAddMemberModal(true)}
              style={{
                width: '100%',
                background: 'rgba(255,255,255,0.2)',
                border: 'none',
                borderRadius: '8px',
                padding: '12px',
                color: 'white',
                cursor: 'pointer',
                marginBottom: '15px',
                fontSize: '13px',
                fontWeight: 600
              }}
            >
              ➕ Add Member
            </button>

            {/* Members List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {chitDetails?.members?.map((member, index) => (
                <div
                  key={member.id}
                  style={{
                    background: member.is_paid ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255,255,255,0.95)',
                    borderRadius: '10px',
                    padding: '12px 15px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    border: member.is_paid ? '1px solid #10b981' : 'none'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '50%',
                      background: member.is_paid ? '#10b981' : '#e2e8f0',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 700,
                      fontSize: '12px',
                      color: member.is_paid ? 'white' : '#64748b'
                    }}>
                      {member.member_number || index + 1}
                    </div>
                    <div>
                      <div style={{
                        fontWeight: 600,
                        fontSize: '14px',
                        color: member.is_paid ? 'white' : '#1e293b'
                      }}>
                        {member.name}
                      </div>
                      {member.phone && (
                        <div style={{
                          fontSize: '11px',
                          color: member.is_paid ? 'rgba(255,255,255,0.7)' : '#64748b'
                        }}>
                          {member.phone}
                        </div>
                      )}
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    {member.is_paid ? (
                      <>
                        <span style={{ color: '#10b981', fontSize: '12px', fontWeight: 600 }}>
                          ✅ Paid
                        </span>
                        <button
                          onClick={() => undoPayment(member.payment_id)}
                          style={{
                            background: 'rgba(239, 68, 68, 0.2)',
                            border: 'none',
                            borderRadius: '6px',
                            padding: '6px 10px',
                            color: '#fca5a5',
                            cursor: 'pointer',
                            fontSize: '11px'
                          }}
                        >
                          Undo
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => markAsPaid(member.id, member.name, member.phone)}
                          style={{
                            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                            border: 'none',
                            borderRadius: '8px',
                            padding: '8px 16px',
                            color: 'white',
                            cursor: 'pointer',
                            fontWeight: 600,
                            fontSize: '12px'
                          }}
                        >
                          Mark Paid
                        </button>
                        <button
                          onClick={() => deleteMember(member.id, member.name)}
                          style={{
                            background: '#fee2e2',
                            border: 'none',
                            borderRadius: '6px',
                            padding: '8px 10px',
                            color: '#dc2626',
                            cursor: 'pointer',
                            fontSize: '12px'
                          }}
                          title="Delete member"
                        >
                          🗑️
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}

              {(!chitDetails?.members || chitDetails.members.length === 0) && (
                <div style={{
                  background: 'rgba(255,255,255,0.1)',
                  borderRadius: '12px',
                  padding: '30px',
                  textAlign: 'center',
                  color: 'white'
                }}>
                  <div style={{ fontSize: '32px', marginBottom: '10px' }}>👥</div>
                  <p style={{ margin: 0 }}>No members yet. Add members to start tracking.</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Add Chit Modal */}
      {showAddChitModal && (
        <AddChitModal
          onClose={() => setShowAddChitModal(false)}
          onSuccess={() => { mutateChits(); setShowAddChitModal(false); }}
        />
      )}

      {/* Add Member Modal */}
      {showAddMemberModal && selectedChit && (
        <AddMemberModal
          chitId={selectedChit.id}
          onClose={() => setShowAddMemberModal(false)}
          onSuccess={() => { mutateDetails(); setShowAddMemberModal(false); }}
        />
      )}

      {/* Chit Settings Modal */}
      {showSettingsModal && selectedChit && (
        <ChitSettingsModal
          chitId={selectedChit.id}
          chitName={selectedChit.name}
          month={selectedMonth}
          currentSettings={chitSettings}
          onClose={() => setShowSettingsModal(false)}
          onSuccess={() => { mutateSettings(); setShowSettingsModal(false); }}
        />
      )}

      {/* WhatsApp Modal */}
      <WhatsAppModal
        isOpen={showWhatsAppModal}
        onClose={() => setShowWhatsAppModal(false)}
        onSend={() => {
          setShowWhatsAppModal(false);
          setPendingWhatsApp(null);
        }}
        phone={pendingWhatsApp?.phone || ''}
        messageType="chit"
        messageData={pendingWhatsApp?.messageData || {}}
      />
    </div>
  );
}

// Add Chit Modal Component
function AddChitModal({ onClose, onSuccess }) {
  const [formData, setFormData] = useState({
    name: '',
    chit_amount: '',
    member_count: '',
    day_of_month: '',
    duration_months: '20'
  });
  const [loading, setLoading] = useState(false);

  const monthlyAmount = formData.chit_amount && formData.member_count
    ? Math.round(parseInt(formData.chit_amount) / parseInt(formData.member_count))
    : 0;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.chit_amount || !formData.member_count || !formData.day_of_month) {
      alert('Please fill all required fields');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/chit-groups`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          chit_amount: parseInt(formData.chit_amount),
          member_count: parseInt(formData.member_count),
          day_of_month: parseInt(formData.day_of_month),
          duration_months: parseInt(formData.duration_months),
          monthly_amount: monthlyAmount
        })
      });

      if (response.ok) {
        onSuccess();
      } else {
        alert('Failed to create chit group');
      }
    } catch (error) {
      console.error('Error:', error);
      alert('Failed to create chit group');
    }
    setLoading(false);
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0,0,0,0.7)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '20px'
    }}>
      <div style={{
        background: 'white',
        borderRadius: '16px',
        padding: '24px',
        width: '100%',
        maxWidth: '400px'
      }}>
        <h2 style={{ margin: '0 0 20px', fontSize: '18px', color: '#1e293b' }}>
          ➕ Add Chit Group
        </h2>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontSize: '13px', color: '#64748b' }}>
              Chit Name *
            </label>
            <input
              type="text"
              placeholder="e.g., 5th - 1 Lakh"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: '8px',
                border: '1px solid #e2e8f0',
                fontSize: '14px'
              }}
            />
          </div>

          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontSize: '13px', color: '#64748b' }}>
              Total Chit Amount *
            </label>
            <input
              type="number"
              placeholder="e.g., 100000"
              value={formData.chit_amount}
              onChange={(e) => setFormData({ ...formData, chit_amount: e.target.value })}
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: '8px',
                border: '1px solid #e2e8f0',
                fontSize: '14px'
              }}
            />
          </div>

          <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', marginBottom: '5px', fontSize: '13px', color: '#64748b' }}>
                Members *
              </label>
              <input
                type="number"
                placeholder="e.g., 20"
                value={formData.member_count}
                onChange={(e) => setFormData({ ...formData, member_count: e.target.value })}
                style={{
                  width: '100%',
                  padding: '12px',
                  borderRadius: '8px',
                  border: '1px solid #e2e8f0',
                  fontSize: '14px'
                }}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', marginBottom: '5px', fontSize: '13px', color: '#64748b' }}>
                Day of Month *
              </label>
              <input
                type="number"
                min="1"
                max="31"
                placeholder="e.g., 5"
                value={formData.day_of_month}
                onChange={(e) => setFormData({ ...formData, day_of_month: e.target.value })}
                style={{
                  width: '100%',
                  padding: '12px',
                  borderRadius: '8px',
                  border: '1px solid #e2e8f0',
                  fontSize: '14px'
                }}
              />
            </div>
          </div>

          {monthlyAmount > 0 && (
            <div style={{
              background: '#f0fdf4',
              padding: '12px',
              borderRadius: '8px',
              marginBottom: '15px',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '12px', color: '#64748b' }}>Monthly per member</div>
              <div style={{ fontSize: '20px', fontWeight: 700, color: '#059669' }}>
                ₹{monthlyAmount.toLocaleString('en-IN')}
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                flex: 1,
                padding: '12px',
                borderRadius: '8px',
                border: '1px solid #e2e8f0',
                background: 'white',
                cursor: 'pointer',
                fontWeight: 600
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              style={{
                flex: 1,
                padding: '12px',
                borderRadius: '8px',
                border: 'none',
                background: 'linear-gradient(135deg, #7c3aed 0%, #5b21b6 100%)',
                color: 'white',
                cursor: 'pointer',
                fontWeight: 600
              }}
            >
              {loading ? 'Creating...' : 'Create Chit'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Add Member Modal Component
function AddMemberModal({ chitId, onClose, onSuccess }) {
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    member_number: ''
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name) {
      alert('Please enter member name');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/chit-members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chit_group_id: chitId,
          name: formData.name,
          phone: formData.phone || null,
          member_number: formData.member_number ? parseInt(formData.member_number) : null
        })
      });

      if (response.ok) {
        onSuccess();
      } else {
        alert('Failed to add member');
      }
    } catch (error) {
      console.error('Error:', error);
      alert('Failed to add member');
    }
    setLoading(false);
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0,0,0,0.7)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '20px'
    }}>
      <div style={{
        background: 'white',
        borderRadius: '16px',
        padding: '24px',
        width: '100%',
        maxWidth: '400px'
      }}>
        <h2 style={{ margin: '0 0 20px', fontSize: '18px', color: '#1e293b' }}>
          ➕ Add Member
        </h2>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontSize: '13px', color: '#64748b' }}>
              Name *
            </label>
            <input
              type="text"
              placeholder="Member name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: '8px',
                border: '1px solid #e2e8f0',
                fontSize: '14px'
              }}
            />
          </div>

          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontSize: '13px', color: '#64748b' }}>
              Phone (Optional)
            </label>
            <input
              type="text"
              placeholder="For WhatsApp receipt"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: '8px',
                border: '1px solid #e2e8f0',
                fontSize: '14px'
              }}
            />
          </div>

          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontSize: '13px', color: '#64748b' }}>
              Member Number (Optional)
            </label>
            <input
              type="number"
              placeholder="e.g., 1, 2, 3..."
              value={formData.member_number}
              onChange={(e) => setFormData({ ...formData, member_number: e.target.value })}
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: '8px',
                border: '1px solid #e2e8f0',
                fontSize: '14px'
              }}
            />
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                flex: 1,
                padding: '12px',
                borderRadius: '8px',
                border: '1px solid #e2e8f0',
                background: 'white',
                cursor: 'pointer',
                fontWeight: 600
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              style={{
                flex: 1,
                padding: '12px',
                borderRadius: '8px',
                border: 'none',
                background: 'linear-gradient(135deg, #7c3aed 0%, #5b21b6 100%)',
                color: 'white',
                cursor: 'pointer',
                fontWeight: 600
              }}
            >
              {loading ? 'Adding...' : 'Add Member'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Chit Settings Modal Component
function ChitSettingsModal({ chitId, chitName, month, currentSettings, onClose, onSuccess }) {
  const [formData, setFormData] = useState({
    chit_number: currentSettings.chit_number || '',
    custom_note: currentSettings.custom_note || ''
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/chit-settings/${chitId}/${month}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        onSuccess();
      } else {
        alert('Failed to save settings');
      }
    } catch (error) {
      console.error('Error:', error);
      alert('Failed to save settings');
    }
    setLoading(false);
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0,0,0,0.7)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '20px'
    }}>
      <div style={{
        background: 'white',
        borderRadius: '16px',
        padding: '24px',
        width: '100%',
        maxWidth: '400px'
      }}>
        <h2 style={{ margin: '0 0 5px', fontSize: '18px', color: '#1e293b' }}>
          ⚙️ Month Settings
        </h2>
        <p style={{ margin: '0 0 20px', fontSize: '12px', color: '#64748b' }}>
          {chitName} • {month}
        </p>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontSize: '13px', color: '#64748b' }}>
              Chit Number (for this month)
            </label>
            <input
              type="text"
              placeholder="e.g., 15"
              value={formData.chit_number}
              onChange={(e) => setFormData({ ...formData, chit_number: e.target.value })}
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: '8px',
                border: '1px solid #e2e8f0',
                fontSize: '14px'
              }}
            />
            <p style={{ margin: '5px 0 0', fontSize: '11px', color: '#94a3b8' }}>
              This will appear in WhatsApp receipt as "Chit No: X"
            </p>
          </div>

          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontSize: '13px', color: '#64748b' }}>
              Custom Note (Optional)
            </label>
            <textarea
              placeholder="Add any note for WhatsApp message..."
              value={formData.custom_note}
              onChange={(e) => setFormData({ ...formData, custom_note: e.target.value })}
              rows={3}
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: '8px',
                border: '1px solid #e2e8f0',
                fontSize: '14px',
                resize: 'vertical'
              }}
            />
            <p style={{ margin: '5px 0 0', fontSize: '11px', color: '#94a3b8' }}>
              This will appear at the bottom of WhatsApp receipt
            </p>
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                flex: 1,
                padding: '12px',
                borderRadius: '8px',
                border: '1px solid #e2e8f0',
                background: 'white',
                cursor: 'pointer',
                fontWeight: 600
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              style={{
                flex: 1,
                padding: '12px',
                borderRadius: '8px',
                border: 'none',
                background: 'linear-gradient(135deg, #7c3aed 0%, #5b21b6 100%)',
                color: 'white',
                cursor: 'pointer',
                fontWeight: 600
              }}
            >
              {loading ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default ChitDashboard;
