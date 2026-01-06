import { useState, useEffect, useRef } from 'react';
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
  const [showAuctionModal, setShowAuctionModal] = useState(false);
  const [showAuctionHistoryModal, setShowAuctionHistoryModal] = useState(false);
  const [showSlotsDashboard, setShowSlotsDashboard] = useState(false);
  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false);
  const [pendingWhatsApp, setPendingWhatsApp] = useState(null);
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  // Fetch all chit groups - 5 second refresh
  const { data: chitGroups = [], mutate: mutateChits } = useSWR(`${API_URL}/chit-groups`, fetcher, {
    refreshInterval: 5000,
    revalidateOnFocus: true,
  });

  // Fetch members and payments for selected chit - 5 second refresh
  const { data: chitDetails, mutate: mutateDetails } = useSWR(
    selectedChit ? `${API_URL}/chit-groups/${selectedChit.id}?month=${selectedMonth}` : null,
    fetcher,
    { refreshInterval: 5000, revalidateOnFocus: true }
  );

  // Fetch chit settings for selected chit and month
  const { data: chitSettings = { chit_number: '', custom_note: '' }, mutate: mutateSettings } = useSWR(
    selectedChit ? `${API_URL}/chit-settings/${selectedChit.id}/${selectedMonth}` : null,
    fetcher,
    { refreshInterval: 5000, revalidateOnFocus: true }
  );

  // Fetch auction data for selected chit and month
  const { data: auctionData = {}, mutate: mutateAuction } = useSWR(
    selectedChit ? `${API_URL}/chit-auctions/${selectedChit.id}/${selectedMonth}` : null,
    fetcher,
    { refreshInterval: 5000, revalidateOnFocus: true }
  );

  // Fetch auction history (all slots) - always fetch for selected chit
  const { data: auctionHistory = [], mutate: mutateAuctionHistory } = useSWR(
    selectedChit ? `${API_URL}/chit-auctions/${selectedChit.id}` : null,
    fetcher,
    { refreshInterval: 5000, revalidateOnFocus: true }
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
            <>
              <button
                onClick={() => { setShowSidebar(false); setShowAuctionModal(true); }}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  background: 'transparent',
                  color: '#f59e0b',
                  border: 'none',
                  textAlign: 'left',
                  cursor: 'pointer',
                  fontSize: '13px',
                  fontWeight: 600
                }}
              >
                🏆 Monthly Auction
              </button>
              <button
                onClick={() => { setShowSidebar(false); setShowSlotsDashboard(true); }}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  background: 'transparent',
                  color: '#10b981',
                  border: 'none',
                  textAlign: 'left',
                  cursor: 'pointer',
                  fontSize: '13px',
                  fontWeight: 600
                }}
              >
                🎰 Slots Dashboard
              </button>
              <button
                onClick={() => { setShowSidebar(false); setShowAuctionHistoryModal(true); }}
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
                📊 Auction History
              </button>
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
            </>
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
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
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

              {/* Auction Info */}
              {auctionData?.winner_name && (
                <div style={{
                  borderTop: '1px solid rgba(255,255,255,0.2)',
                  paddingTop: '12px',
                  marginTop: '8px'
                }}>
                  <div style={{ fontSize: '11px', opacity: 0.7, marginBottom: '6px' }}>This Month's Auction</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: 600, color: '#fbbf24' }}>
                        🏆 {auctionData.winner_name}
                      </div>
                      <div style={{ fontSize: '11px', opacity: 0.7 }}>
                        Bid: {formatCurrency(auctionData.bid_amount)} | Commission: {formatCurrency(auctionData.commission)}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '16px', fontWeight: 700, color: '#86efac' }}>
                        {formatCurrency(auctionData.amount_to_winner)}
                      </div>
                      <div style={{ fontSize: '10px', opacity: 0.7 }}>Given to Winner</div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Quick Auction Button */}
            <button
              onClick={() => setShowAuctionModal(true)}
              style={{
                width: '100%',
                background: auctionData?.winner_name ? 'rgba(251, 191, 36, 0.2)' : 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                border: auctionData?.winner_name ? '1px solid #f59e0b' : 'none',
                borderRadius: '8px',
                padding: '12px',
                color: 'white',
                cursor: 'pointer',
                marginBottom: '15px',
                fontSize: '13px',
                fontWeight: 600
              }}
            >
              🏆 {auctionData?.winner_name ? 'Edit Auction Details' : 'Record Monthly Auction'}
            </button>

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
                        <div style={{ textAlign: 'right' }}>
                          <span style={{ color: '#10b981', fontSize: '12px', fontWeight: 600, display: 'block' }}>
                            ✅ Paid
                          </span>
                          {member.payment_date && (
                            <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '10px' }}>
                              {new Date(member.payment_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                            </span>
                          )}
                        </div>
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

      {/* Auction Modal */}
      {showAuctionModal && selectedChit && (
        <AuctionModal
          chitId={selectedChit.id}
          chitName={selectedChit.name}
          month={selectedMonth}
          chitAmount={selectedChit.chit_amount}
          monthlyAmount={selectedChit.monthly_amount}
          memberCount={selectedChit.member_count}
          members={chitDetails?.members || []}
          currentAuction={auctionData}
          auctionHistory={auctionHistory}
          onClose={() => setShowAuctionModal(false)}
          onSuccess={() => { mutateAuction(); mutateAuctionHistory(); setShowAuctionModal(false); }}
        />
      )}

      {/* Auction History Modal */}
      {showAuctionHistoryModal && selectedChit && (
        <AuctionHistoryModal
          chitName={selectedChit.name}
          auctions={auctionHistory}
          onClose={() => setShowAuctionHistoryModal(false)}
        />
      )}

      {/* Slots Dashboard Modal */}
      {showSlotsDashboard && selectedChit && (
        <SlotsDashboardModal
          chitName={selectedChit.name}
          memberCount={selectedChit.member_count}
          chitAmount={selectedChit.chit_amount}
          auctions={auctionHistory}
          onClose={() => setShowSlotsDashboard(false)}
        />
      )}
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

// Auction Modal Component
function AuctionModal({ chitId, chitName, month, chitAmount, monthlyAmount, memberCount, members, currentAuction, auctionHistory, onClose, onSuccess }) {
  // Calculate next available slot number
  const completedSlots = auctionHistory.map(a => a.slot_number).filter(Boolean);
  const nextSlot = completedSlots.length > 0 ? Math.max(...completedSlots) + 1 : 1;

  const [formData, setFormData] = useState({
    slot_number: currentAuction.slot_number || nextSlot,
    winner_member_id: currentAuction.winner_member_id || '',
    winner_name: currentAuction.winner_name || '',
    bid_amount: currentAuction.bid_amount || '',
    commission: currentAuction.commission || '',
    total_collected: currentAuction.total_collected || (monthlyAmount * memberCount),
    amount_to_winner: currentAuction.amount_to_winner || '',
    carry_forward: currentAuction.carry_forward || '',
    auction_date: currentAuction.auction_date || new Date().toISOString().split('T')[0],
    disbursement_date: currentAuction.disbursement_date || '',
    winner_photo: currentAuction.winner_photo || '',
    winner_signature: currentAuction.winner_signature || '',
    notes: currentAuction.notes || ''
  });
  const [loading, setLoading] = useState(false);
  const [isDrawingSignature, setIsDrawingSignature] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const signatureCanvasRef = useRef(null);

  const formatCurrency = (amount) => `₹${(amount || 0).toLocaleString('en-IN')}`;

  // Auto-calculate amounts when inputs change
  useEffect(() => {
    if (formData.bid_amount && formData.commission) {
      const totalCollected = monthlyAmount * memberCount;
      const bidAmount = Number(formData.bid_amount);
      const commission = Number(formData.commission);
      const amountToWinner = totalCollected - bidAmount - commission;
      const carryForward = bidAmount; // Bid goes to pool/carry forward

      setFormData(prev => ({
        ...prev,
        total_collected: totalCollected,
        amount_to_winner: amountToWinner > 0 ? amountToWinner : 0,
        carry_forward: carryForward
      }));
    }
  }, [formData.bid_amount, formData.commission, monthlyAmount, memberCount]);

  // Handle member selection
  const handleMemberSelect = (memberId) => {
    const member = members.find(m => m.id === memberId);
    if (member) {
      setFormData(prev => ({
        ...prev,
        winner_member_id: memberId,
        winner_name: member.name
      }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.winner_name || !formData.bid_amount) {
      alert('Please select winner and enter bid amount');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/chit-auctions/${chitId}/${month}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        onSuccess();
      } else {
        alert('Failed to save auction details');
      }
    } catch (error) {
      console.error('Error:', error);
      alert('Failed to save auction details');
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
      background: 'rgba(0,0,0,0.8)',
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '20px',
      overflow: 'auto'
    }}>
      <div style={{
        background: 'white',
        borderRadius: '16px',
        padding: '24px',
        width: '100%',
        maxWidth: '450px',
        margin: '20px 0'
      }}>
        <h2 style={{ margin: '0 0 5px', fontSize: '18px', color: '#1e293b' }}>
          🏆 Monthly Auction
        </h2>
        <p style={{ margin: '0 0 20px', fontSize: '12px', color: '#64748b' }}>
          {chitName} • {month} • Total: {formatCurrency(chitAmount)}
        </p>

        <form onSubmit={handleSubmit}>
          {/* Slot Number & Winner Selection */}
          <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
            <div style={{ width: '80px' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontSize: '13px', color: '#64748b' }}>
                Slot #
              </label>
              <input
                type="number"
                min="1"
                max={memberCount}
                value={formData.slot_number}
                onChange={(e) => setFormData({ ...formData, slot_number: parseInt(e.target.value) || '' })}
                style={{
                  width: '100%',
                  padding: '12px',
                  borderRadius: '8px',
                  border: '1px solid #e2e8f0',
                  fontSize: '14px',
                  textAlign: 'center',
                  fontWeight: 700,
                  color: '#7c3aed'
                }}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', marginBottom: '5px', fontSize: '13px', color: '#64748b' }}>
                Auction Winner *
              </label>
              <select
                value={formData.winner_member_id}
                onChange={(e) => handleMemberSelect(e.target.value)}
                style={{
                  width: '100%',
                  padding: '12px',
                  borderRadius: '8px',
                  border: '1px solid #e2e8f0',
                  fontSize: '14px'
                }}
              >
                <option value="">Select winner...</option>
                {members.map(m => (
                  <option key={m.id} value={m.id}>{m.member_number || ''} - {m.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Bid Amount & Commission */}
          <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', marginBottom: '5px', fontSize: '13px', color: '#64748b' }}>
                Bid Amount *
              </label>
              <input
                type="number"
                placeholder="e.g., 5000"
                value={formData.bid_amount}
                onChange={(e) => setFormData({ ...formData, bid_amount: e.target.value })}
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
                Commission *
              </label>
              <input
                type="number"
                placeholder="e.g., 2500"
                value={formData.commission}
                onChange={(e) => setFormData({ ...formData, commission: e.target.value })}
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

          {/* Calculated Amounts */}
          <div style={{
            background: '#f0fdf4',
            padding: '15px',
            borderRadius: '8px',
            marginBottom: '15px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ color: '#64748b', fontSize: '12px' }}>Total Collected</span>
              <span style={{ fontWeight: 600, color: '#1e293b' }}>{formatCurrency(formData.total_collected)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ color: '#64748b', fontSize: '12px' }}>(-) Bid Amount</span>
              <span style={{ fontWeight: 600, color: '#ef4444' }}>- {formatCurrency(formData.bid_amount)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ color: '#64748b', fontSize: '12px' }}>(-) Commission</span>
              <span style={{ fontWeight: 600, color: '#ef4444' }}>- {formatCurrency(formData.commission)}</span>
            </div>
            <div style={{ borderTop: '1px solid #d1fae5', paddingTop: '8px', display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#059669', fontSize: '14px', fontWeight: 600 }}>Amount to Winner</span>
              <span style={{ fontWeight: 700, color: '#059669', fontSize: '16px' }}>{formatCurrency(formData.amount_to_winner)}</span>
            </div>
          </div>

          {/* Dates */}
          <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', marginBottom: '5px', fontSize: '13px', color: '#64748b' }}>
                Auction Date
              </label>
              <input
                type="date"
                value={formData.auction_date}
                onChange={(e) => setFormData({ ...formData, auction_date: e.target.value })}
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
                Disbursement Date
              </label>
              <input
                type="date"
                value={formData.disbursement_date}
                onChange={(e) => setFormData({ ...formData, disbursement_date: e.target.value })}
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

          {/* Winner Photo */}
          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontSize: '13px', color: '#64748b' }}>
              Winner Photo (with amount)
            </label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                type="file"
                accept="image/*"
                capture="environment"
                id="winnerPhotoCapture"
                style={{ display: 'none' }}
                onChange={(e) => {
                  const file = e.target.files[0];
                  if (file) {
                    const reader = new FileReader();
                    reader.onloadend = () => {
                      const img = new Image();
                      img.onload = () => {
                        const canvas = document.createElement('canvas');
                        const maxSize = 500;
                        let width = img.width;
                        let height = img.height;
                        if (width > height && width > maxSize) {
                          height = (height * maxSize) / width;
                          width = maxSize;
                        } else if (height > maxSize) {
                          width = (width * maxSize) / height;
                          height = maxSize;
                        }
                        canvas.width = width;
                        canvas.height = height;
                        const ctx = canvas.getContext('2d');
                        ctx.drawImage(img, 0, 0, width, height);
                        setFormData({ ...formData, winner_photo: canvas.toDataURL('image/jpeg', 0.7) });
                      };
                      img.src = reader.result;
                    };
                    reader.readAsDataURL(file);
                  }
                }}
              />
              <button
                type="button"
                onClick={() => document.getElementById('winnerPhotoCapture').click()}
                style={{
                  flex: 1,
                  padding: '10px',
                  borderRadius: '8px',
                  border: 'none',
                  background: '#3b82f6',
                  color: 'white',
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontSize: '13px'
                }}
              >
                📷 Capture Photo
              </button>
              {formData.winner_photo && (
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, winner_photo: '' })}
                  style={{
                    padding: '10px 14px',
                    borderRadius: '8px',
                    border: 'none',
                    background: '#ef4444',
                    color: 'white',
                    cursor: 'pointer'
                  }}
                >
                  ✕
                </button>
              )}
            </div>
            {formData.winner_photo && (
              <img src={formData.winner_photo} alt="Winner" style={{ width: '100%', maxHeight: '150px', objectFit: 'cover', borderRadius: '8px', marginTop: '8px' }} />
            )}
          </div>

          {/* Winner Signature */}
          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontSize: '13px', color: '#64748b' }}>
              Winner Signature
            </label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                onClick={() => setIsDrawingSignature(true)}
                style={{
                  flex: 1,
                  padding: '10px',
                  borderRadius: '8px',
                  border: 'none',
                  background: '#10b981',
                  color: 'white',
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontSize: '13px'
                }}
              >
                ✍️ Draw Signature
              </button>
              <input
                type="file"
                accept="image/*"
                id="winnerSignatureUpload"
                style={{ display: 'none' }}
                onChange={(e) => {
                  const file = e.target.files[0];
                  if (file) {
                    const reader = new FileReader();
                    reader.onloadend = () => {
                      const img = new Image();
                      img.onload = () => {
                        const canvas = document.createElement('canvas');
                        const maxSize = 300;
                        let width = img.width;
                        let height = img.height;
                        if (width > height && width > maxSize) {
                          height = (height * maxSize) / width;
                          width = maxSize;
                        } else if (height > maxSize) {
                          width = (width * maxSize) / height;
                          height = maxSize;
                        }
                        canvas.width = width;
                        canvas.height = height;
                        const ctx = canvas.getContext('2d');
                        ctx.drawImage(img, 0, 0, width, height);
                        setFormData({ ...formData, winner_signature: canvas.toDataURL('image/jpeg', 0.7) });
                      };
                      img.src = reader.result;
                    };
                    reader.readAsDataURL(file);
                  }
                }}
              />
              <button
                type="button"
                onClick={() => document.getElementById('winnerSignatureUpload').click()}
                style={{
                  flex: 1,
                  padding: '10px',
                  borderRadius: '8px',
                  border: 'none',
                  background: '#8b5cf6',
                  color: 'white',
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontSize: '13px'
                }}
              >
                📁 Upload
              </button>
            </div>

            {/* Signature Drawing Canvas */}
            {isDrawingSignature && (
              <div style={{ marginTop: '12px' }}>
                <canvas
                  ref={signatureCanvasRef}
                  width={280}
                  height={120}
                  style={{ background: 'white', borderRadius: '8px', border: '1px solid #e2e8f0', touchAction: 'none', width: '100%' }}
                  onMouseDown={(e) => {
                    setIsDrawing(true);
                    const canvas = signatureCanvasRef.current;
                    const ctx = canvas.getContext('2d');
                    const rect = canvas.getBoundingClientRect();
                    ctx.beginPath();
                    ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
                  }}
                  onMouseMove={(e) => {
                    if (!isDrawing) return;
                    const canvas = signatureCanvasRef.current;
                    const ctx = canvas.getContext('2d');
                    const rect = canvas.getBoundingClientRect();
                    ctx.lineWidth = 2;
                    ctx.lineCap = 'round';
                    ctx.strokeStyle = '#000';
                    ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
                    ctx.stroke();
                  }}
                  onMouseUp={() => setIsDrawing(false)}
                  onMouseLeave={() => setIsDrawing(false)}
                  onTouchStart={(e) => {
                    e.preventDefault();
                    setIsDrawing(true);
                    const canvas = signatureCanvasRef.current;
                    const ctx = canvas.getContext('2d');
                    const rect = canvas.getBoundingClientRect();
                    const touch = e.touches[0];
                    ctx.beginPath();
                    ctx.moveTo(touch.clientX - rect.left, touch.clientY - rect.top);
                  }}
                  onTouchMove={(e) => {
                    e.preventDefault();
                    if (!isDrawing) return;
                    const canvas = signatureCanvasRef.current;
                    const ctx = canvas.getContext('2d');
                    const rect = canvas.getBoundingClientRect();
                    const touch = e.touches[0];
                    ctx.lineWidth = 2;
                    ctx.lineCap = 'round';
                    ctx.strokeStyle = '#000';
                    ctx.lineTo(touch.clientX - rect.left, touch.clientY - rect.top);
                    ctx.stroke();
                  }}
                  onTouchEnd={() => setIsDrawing(false)}
                />
                <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                  <button
                    type="button"
                    onClick={() => {
                      const canvas = signatureCanvasRef.current;
                      const ctx = canvas.getContext('2d');
                      ctx.clearRect(0, 0, canvas.width, canvas.height);
                    }}
                    style={{ flex: 1, padding: '8px', borderRadius: '6px', border: 'none', background: '#64748b', color: 'white', cursor: 'pointer', fontSize: '12px' }}
                  >
                    Clear
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const canvas = signatureCanvasRef.current;
                      setFormData({ ...formData, winner_signature: canvas.toDataURL('image/png') });
                      setIsDrawingSignature(false);
                    }}
                    style={{ flex: 1, padding: '8px', borderRadius: '6px', border: 'none', background: '#10b981', color: 'white', cursor: 'pointer', fontSize: '12px' }}
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsDrawingSignature(false)}
                    style={{ flex: 1, padding: '8px', borderRadius: '6px', border: 'none', background: '#ef4444', color: 'white', cursor: 'pointer', fontSize: '12px' }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {formData.winner_signature && !isDrawingSignature && (
              <div style={{ marginTop: '8px', position: 'relative', display: 'inline-block' }}>
                <img src={formData.winner_signature} alt="Signature" style={{ height: '60px', background: 'white', borderRadius: '8px', padding: '4px' }} />
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, winner_signature: '' })}
                  style={{
                    position: 'absolute',
                    top: '-8px',
                    right: '-8px',
                    width: '22px',
                    height: '22px',
                    borderRadius: '50%',
                    border: 'none',
                    background: '#ef4444',
                    color: 'white',
                    cursor: 'pointer',
                    fontSize: '11px'
                  }}
                >
                  ✕
                </button>
              </div>
            )}
          </div>

          {/* Notes */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontSize: '13px', color: '#64748b' }}>
              Notes
            </label>
            <textarea
              placeholder="Any additional notes..."
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={2}
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: '8px',
                border: '1px solid #e2e8f0',
                fontSize: '14px',
                resize: 'vertical'
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
                background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                color: 'white',
                cursor: 'pointer',
                fontWeight: 600
              }}
            >
              {loading ? 'Saving...' : 'Save Auction'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Auction History Modal Component
function AuctionHistoryModal({ chitName, auctions, onClose }) {
  const formatCurrency = (amount) => `₹${(amount || 0).toLocaleString('en-IN')}`;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0,0,0,0.8)',
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '20px',
      overflow: 'auto'
    }}>
      <div style={{
        background: 'white',
        borderRadius: '16px',
        padding: '24px',
        width: '100%',
        maxWidth: '450px',
        margin: '20px 0'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2 style={{ margin: 0, fontSize: '18px', color: '#1e293b' }}>
            📊 Auction History
          </h2>
          <button
            onClick={onClose}
            style={{
              background: '#f1f5f9',
              border: 'none',
              borderRadius: '8px',
              padding: '8px 12px',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            ✕
          </button>
        </div>

        <p style={{ margin: '0 0 15px', fontSize: '12px', color: '#64748b' }}>{chitName}</p>

        {auctions.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '30px', color: '#64748b' }}>
            No auction history yet
          </div>
        ) : (
          <div style={{ maxHeight: '400px', overflow: 'auto' }}>
            {auctions.map((auction, index) => (
              <div
                key={auction.id || index}
                style={{
                  background: '#f8fafc',
                  borderRadius: '10px',
                  padding: '15px',
                  marginBottom: '12px',
                  borderLeft: '4px solid #f59e0b'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    {auction.slot_number && (
                      <span style={{
                        background: '#7c3aed',
                        color: 'white',
                        padding: '2px 8px',
                        borderRadius: '12px',
                        fontSize: '11px',
                        fontWeight: 700
                      }}>
                        #{auction.slot_number}
                      </span>
                    )}
                    <span style={{ fontWeight: 600, color: '#7c3aed' }}>{auction.month}</span>
                  </div>
                  <div style={{ fontSize: '12px', color: '#64748b' }}>{auction.auction_date}</div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 600, color: '#1e293b' }}>🏆 {auction.winner_name}</div>
                    <div style={{ fontSize: '12px', color: '#64748b' }}>
                      Bid: {formatCurrency(auction.bid_amount)} | Commission: {formatCurrency(auction.commission)}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 700, color: '#059669' }}>
                      {formatCurrency(auction.amount_to_winner)}
                    </div>
                    <div style={{ fontSize: '10px', color: '#64748b' }}>Given</div>
                  </div>
                </div>
                {auction.winner_photo && (
                  <img src={auction.winner_photo} alt="Winner" style={{ width: '100%', maxHeight: '100px', objectFit: 'cover', borderRadius: '6px', marginTop: '10px' }} />
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// Slots Dashboard Modal Component
function SlotsDashboardModal({ chitName, memberCount, chitAmount, auctions, onClose }) {
  const formatCurrency = (amount) => `₹${(amount || 0).toLocaleString('en-IN')}`;

  // Create a map of slot number to auction data
  const slotMap = {};
  auctions.forEach(auction => {
    if (auction.slot_number) {
      slotMap[auction.slot_number] = auction;
    }
  });

  // Generate all slots (1 to memberCount)
  const slots = [];
  for (let i = 1; i <= memberCount; i++) {
    slots.push({
      slotNumber: i,
      auction: slotMap[i] || null,
      isCompleted: !!slotMap[i]
    });
  }

  const completedCount = slots.filter(s => s.isCompleted).length;
  const totalGiven = auctions.reduce((sum, a) => sum + (a.amount_to_winner || 0), 0);
  const totalCommission = auctions.reduce((sum, a) => sum + (a.commission || 0), 0);

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0,0,0,0.8)',
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '20px',
      overflow: 'auto'
    }}>
      <div style={{
        background: 'white',
        borderRadius: '16px',
        padding: '24px',
        width: '100%',
        maxWidth: '500px',
        margin: '20px 0'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
          <h2 style={{ margin: 0, fontSize: '18px', color: '#1e293b' }}>
            🎰 Slots Dashboard
          </h2>
          <button
            onClick={onClose}
            style={{
              background: '#f1f5f9',
              border: 'none',
              borderRadius: '8px',
              padding: '8px 12px',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            ✕
          </button>
        </div>

        <p style={{ margin: '0 0 15px', fontSize: '12px', color: '#64748b' }}>
          {chitName} • {formatCurrency(chitAmount)}
        </p>

        {/* Summary Stats */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '10px',
          marginBottom: '20px'
        }}>
          <div style={{
            background: '#f0fdf4',
            padding: '12px',
            borderRadius: '10px',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '20px', fontWeight: 700, color: '#059669' }}>
              {completedCount}
            </div>
            <div style={{ fontSize: '11px', color: '#64748b' }}>Completed</div>
          </div>
          <div style={{
            background: '#fef3c7',
            padding: '12px',
            borderRadius: '10px',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '20px', fontWeight: 700, color: '#d97706' }}>
              {memberCount - completedCount}
            </div>
            <div style={{ fontSize: '11px', color: '#64748b' }}>Running</div>
          </div>
          <div style={{
            background: '#f0f9ff',
            padding: '12px',
            borderRadius: '10px',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '14px', fontWeight: 700, color: '#0284c7' }}>
              {formatCurrency(totalCommission)}
            </div>
            <div style={{ fontSize: '11px', color: '#64748b' }}>Commission</div>
          </div>
        </div>

        {/* Slots Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: '8px',
          maxHeight: '400px',
          overflow: 'auto'
        }}>
          {slots.map(slot => (
            <div
              key={slot.slotNumber}
              style={{
                background: slot.isCompleted
                  ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
                  : '#f1f5f9',
                borderRadius: '10px',
                padding: '10px 8px',
                textAlign: 'center',
                minHeight: '70px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                position: 'relative'
              }}
            >
              {/* Slot Number Badge */}
              <div style={{
                position: 'absolute',
                top: '4px',
                left: '4px',
                background: slot.isCompleted ? 'rgba(255,255,255,0.3)' : '#7c3aed',
                color: 'white',
                fontSize: '10px',
                fontWeight: 700,
                padding: '2px 6px',
                borderRadius: '8px'
              }}>
                #{slot.slotNumber}
              </div>

              {slot.isCompleted ? (
                <>
                  <div style={{
                    fontSize: '11px',
                    fontWeight: 600,
                    color: 'white',
                    marginTop: '8px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}>
                    {slot.auction.winner_name?.split(' ')[0] || 'Winner'}
                  </div>
                  <div style={{
                    fontSize: '10px',
                    color: 'rgba(255,255,255,0.8)'
                  }}>
                    {slot.auction.month?.slice(5) || ''}
                  </div>
                </>
              ) : (
                <div style={{
                  fontSize: '22px',
                  marginTop: '4px'
                }}>
                  🎯
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Legend */}
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          gap: '20px',
          marginTop: '15px',
          fontSize: '12px',
          color: '#64748b'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{ width: '12px', height: '12px', borderRadius: '3px', background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)' }} />
            Completed
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{ width: '12px', height: '12px', borderRadius: '3px', background: '#f1f5f9' }} />
            Running
          </div>
        </div>

        {/* Completed Slots List */}
        {completedCount > 0 && (
          <div style={{ marginTop: '20px' }}>
            <h4 style={{ margin: '0 0 10px', fontSize: '14px', color: '#1e293b' }}>
              Completed Slots Details
            </h4>
            <div style={{ maxHeight: '200px', overflow: 'auto' }}>
              {slots.filter(s => s.isCompleted).map(slot => (
                <div
                  key={slot.slotNumber}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '10px',
                    background: '#f8fafc',
                    borderRadius: '8px',
                    marginBottom: '6px'
                  }}
                >
                  <div style={{
                    background: '#7c3aed',
                    color: 'white',
                    width: '28px',
                    height: '28px',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '11px',
                    fontWeight: 700
                  }}>
                    {slot.slotNumber}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: '13px', color: '#1e293b' }}>
                      {slot.auction.winner_name}
                    </div>
                    <div style={{ fontSize: '11px', color: '#64748b' }}>
                      {slot.auction.month} • {formatCurrency(slot.auction.amount_to_winner)}
                    </div>
                  </div>
                  {slot.auction.winner_photo && (
                    <img
                      src={slot.auction.winner_photo}
                      alt=""
                      style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '6px',
                        objectFit: 'cover'
                      }}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default ChitDashboard;
