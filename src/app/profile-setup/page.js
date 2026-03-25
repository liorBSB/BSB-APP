'use client';
import '@/i18n';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { auth, db } from '../../lib/firebase';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { useTranslation } from 'react-i18next';

import SoldierNameSearch from '@/components/SoldierNameSearch';
import HouseLoader from '@/components/HouseLoader';
import { mapSoldierData } from '@/lib/soldierDataService';
import { FIELD_MAP, PRIMARY_KEY_APP } from '@/lib/sheetFieldMap';
import { resetSoldierAccount } from '@/lib/database';
import { resetUserToPreSelection } from '@/lib/database';
import { fetchStatusFromSheet } from '@/lib/receptionSync';
import { authedFetch } from '@/lib/authFetch';
import { getStableAuthUser } from '@/lib/authState';
import useAuthRedirect from '@/hooks/useAuthRedirect';
import colors from '../colors';

export default function ProfileSetup() {
  const router = useRouter();
  const isReady = useAuthRedirect();
  const { t, i18n } = useTranslation('profilesetup');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [roomNumber, setRoomNumber] = useState('');
  const [error, setError] = useState('');
  const [selectedSoldier, setSelectedSoldier] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showReclaimModal, setShowReclaimModal] = useState(false);
  const [verifyPersonalNumber, setVerifyPersonalNumber] = useState('');
  const [claimedDocId, setClaimedDocId] = useState(null);
  const [reclaimError, setReclaimError] = useState('');
  const [isReclaiming, setIsReclaiming] = useState(false);
  const [isStartingOver, setIsStartingOver] = useState(false);


  // Handle soldier selection from Google Sheets
  const handleSoldierSelect = (soldierData) => {
    if (soldierData) {
      const mappedData = mapSoldierData(soldierData);
      setSelectedSoldier(mappedData);
      setFirstName(mappedData.firstName || '');
      setLastName(mappedData.lastName || '');
      setRoomNumber(mappedData.roomNumber || '');
      setError('');
      setClaimedDocId(null);
      setShowReclaimModal(false);
      setVerifyPersonalNumber('');
      setReclaimError('');
    } else {
      setSelectedSoldier(null);
      setFirstName('');
      setLastName('');
      setRoomNumber('');
      setError('');
      setClaimedDocId(null);
      setShowReclaimModal(false);
      setVerifyPersonalNumber('');
      setReclaimError('');
    }
  };


  const handleReclaim = async () => {
    if (!claimedDocId || !verifyPersonalNumber.trim()) return;

    setIsReclaiming(true);
    setReclaimError('');

    try {
      const existingDoc = await getDoc(doc(db, 'users', claimedDocId));
      if (!existingDoc.exists()) {
        setReclaimError(t('reclaim_failed'));
        setIsReclaiming(false);
        return;
      }

      const existingData = existingDoc.data();
      if (
        !existingData.personalNumber ||
        String(existingData.personalNumber).trim() !== verifyPersonalNumber.trim()
      ) {
        setReclaimError(t('reclaim_failed'));
        setIsReclaiming(false);
        return;
      }

      await resetSoldierAccount(claimedDocId);

      setShowReclaimModal(false);
      setVerifyPersonalNumber('');
      setClaimedDocId(null);
      setError('');
      setReclaimError('');

      const fakeEvent = { preventDefault: () => {} };
      handleSave(fakeEvent);
    } catch (err) {
      console.error('Reclaim error:', err);
      setReclaimError(t('reclaim_failed'));
    } finally {
      setIsReclaiming(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    setClaimedDocId(null);

    const currentUser = auth.currentUser || await getStableAuthUser(auth);
    const uid = currentUser?.uid;
    if (!uid) {
      setError(t('no_auth_error'));
      setIsLoading(false);
      router.push('/');
      return;
    }

    // Validate required fields
    if (!selectedSoldier) {
      setError(t('select_name_error'));
      setIsLoading(false);
      return;
    }

    try {
      const normalizedIdNumber = String(selectedSoldier.idNumber ?? '').trim();
      const selectedSoldierNormalized = {
        ...selectedSoldier,
        ...(normalizedIdNumber ? { idNumber: normalizedIdNumber } : {}),
      };

      const roomNumber = selectedSoldierNormalized.roomNumber || '';
      const statusPromise = fetchStatusFromSheet(roomNumber);

      if (normalizedIdNumber) {
        try {
          const res = await authedFetch('/api/soldiers/check-id', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ idNumber: normalizedIdNumber }),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || 'Server error');
          if (data.taken) {
            setError(t('already_claimed'));
            setIsLoading(false);
            return;
          }
        } catch (err) {
          console.warn('Duplicate check failed:', err);
          setError(
            t(
              'cannot_verify_uniqueness',
              'We could not verify if this profile is already claimed. Please contact staff.'
            )
          );
          setIsLoading(false);
          return;
        }
      }

      const currentStatus = await statusPromise;

      const userData = {
        uid,
        userType: 'user',
        status: currentStatus,
        email: selectedSoldierNormalized.email || currentUser.email,
        lastUpdated: serverTimestamp(),
        dataSource: 'google_sheets',
        profileComplete: true,
      };

      for (const field of FIELD_MAP) {
        const val = selectedSoldierNormalized[field.app];
        if (val !== undefined && val !== null && val !== '') {
          userData[field.app] = val;
        }
      }

      await setDoc(doc(db, 'users', uid), userData, { merge: true });

      router.push('/home');
    } catch (err) {
      console.error('Profile setup error:', err);
      setError(t('save_failed'));
      setIsLoading(false);
    }
  };

  const handleStartOver = async () => {
    setIsStartingOver(true);
    try {
      await resetUserToPreSelection(auth.currentUser);
      router.push('/register/selection');
    } catch (err) {
      console.error('Start over error:', err);
      setError(t('start_over_failed', 'Failed to go back. Please try again.'));
    } finally {
      setIsStartingOver(false);
    }
  };

  if (isLoading) {
    return (
      <main className="min-h-screen flex items-center justify-center font-body bg-gradient-to-br from-blue-200/60 to-green-100/60">
        <HouseLoader size={100} />
      </main>
    );
  }

  if (!isReady) return (
    <main className="min-h-screen flex items-center justify-center font-body bg-gradient-to-br from-blue-200/60 to-green-100/60">
      <HouseLoader size={100} />
    </main>
  );

  const isRTL = i18n.language?.startsWith('he');

  return (
    <main className="min-h-screen flex items-center justify-center font-body px-4 pb-8 bg-gradient-to-br from-blue-200/60 to-green-100/60">
      <div
        className="w-full max-w-md mx-auto 
          bg-white rounded-2xl shadow-lg p-6 phone-lg:p-8"
      >
        <h2
          style={{ fontWeight: 700, fontSize: '2.5rem', textAlign: 'center', marginBottom: '2.8rem', color: colors.text }}
          dir={isRTL ? 'rtl' : 'ltr'}
        >
          {t('completeProfile')}
        </h2>
        <form onSubmit={handleSave}>
          <div style={{ marginBottom: '2.2rem' }}>
            <label
              style={{ display: 'block', color: colors.muted, fontWeight: 600, marginBottom: 12, fontSize: 18 }}
              dir={isRTL ? 'rtl' : 'ltr'}
            >
              {t('search_name')}
            </label>
            <SoldierNameSearch
              onSoldierSelect={handleSoldierSelect}
              placeholder={t('search_placeholder')}
              error={error}
            />
            
            {/* Display selected soldier info */}
            {selectedSoldier && (
              <div style={{ 
                marginTop: '1.5rem', 
                padding: '1.5rem', 
                backgroundColor: colors.surface, 
                borderRadius: '16px',
                border: `2px solid ${colors.primaryGreen}`,
                position: 'relative',
                boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
              }}>
                <button
                  type="button"
                  onClick={() => handleSoldierSelect(null)}
                  aria-label={t('clear_selection')}
                  style={{
                    position: 'absolute',
                    top: '0.5rem',
                    left: '0.5rem',
                    width: '1.75rem',
                    height: '1.75rem',
                    borderRadius: '999px',
                    border: 'none',
                    background: 'rgba(0,0,0,0.06)',
                    color: colors.muted,
                    cursor: 'pointer',
                    fontWeight: 700,
                    lineHeight: 1
                  }}
                >
                  ✕
                </button>
                <div style={{ textAlign: 'start', fontSize: '1rem' }} dir={isRTL ? 'rtl' : 'ltr'}>
                  <div
                    style={{
                      fontWeight: 700,
                      marginBottom: '0.75rem',
                      color: colors.text,
                      fontSize: '1.1rem',
                      display: 'flex',
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'flex-start',
                      gap: '0.5rem',
                      minWidth: 0,
                    }}
                    dir={isRTL ? 'rtl' : 'ltr'}
                  >
                    <span className="min-w-0 truncate">{selectedSoldier.fullName}</span>
                    {selectedSoldier.idNumber != null && (
                      <span style={{ fontSize: '0.8rem', color: colors.muted, fontWeight: 400, flexShrink: 0 }} dir="ltr">
                        (ת.ז ...{String(selectedSoldier.idNumber).slice(-4)})
                      </span>
                    )}
                  </div>
                  <div style={{ color: colors.muted, fontSize: '0.95rem', lineHeight: '1.4', textAlign: 'start' }}>
                    <div>חדר: {selectedSoldier.roomNumber}</div>
                  </div>
                </div>
              </div>
            )}
          </div>
          
          {error && (
            <div style={{ marginBottom: '1.5rem' }}>
              <div style={{ 
                padding: '1rem', 
                backgroundColor: '#FEF2F2', 
                border: `1px solid ${colors.red}`, 
                borderRadius: '12px',
                color: colors.red,
                fontSize: '0.95rem',
                textAlign: 'center'
              }}>
                {error}
              </div>
              {claimedDocId && (
                <button
                  type="button"
                  onClick={() => {
                    setShowReclaimModal(true);
                    setReclaimError('');
                    setVerifyPersonalNumber('');
                  }}
                  style={{
                    display: 'block',
                    width: '100%',
                    marginTop: '0.75rem',
                    background: 'none',
                    border: 'none',
                    color: '#2563eb',
                    fontSize: '0.9rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    textDecoration: 'underline',
                    textAlign: 'center'
                  }}
                >
                  {t('lost_access_link')}
                </button>
              )}
            </div>
          )}
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <button 
              type="submit" 
              disabled={isLoading || !selectedSoldier}
              style={{ 
                width: '100%', 
                background: isLoading || !selectedSoldier ? colors.gray400 : colors.gold, 
                color: colors.black, 
                fontWeight: 700, 
                fontSize: '1.35rem', 
                border: 'none', 
                borderRadius: 999, 
                padding: '1rem 0', 
                cursor: isLoading || !selectedSoldier ? 'not-allowed' : 'pointer',
                opacity: isLoading || !selectedSoldier ? 0.6 : 1,
                transition: 'all 0.2s ease',
                boxShadow: isLoading || !selectedSoldier ? 'none' : '0 2px 8px rgba(0,0,0,0.1)'
              }}
              onMouseEnter={(e) => {
                if (!isLoading && selectedSoldier) {
                  e.target.style.transform = 'translateY(-1px)';
                  e.target.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
                }
              }}
              onMouseLeave={(e) => {
                if (!isLoading && selectedSoldier) {
                  e.target.style.transform = 'translateY(0)';
                  e.target.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)';
                }
              }}
            >
              {isLoading ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                  <HouseLoader size={20} />
                  {t('loading')}
                </div>
              ) : (
                t('complete_registration')
              )}
            </button>
            
            <button
              type="button"
              onClick={handleStartOver}
              disabled={isStartingOver || isLoading}
              style={{ 
                width: '100%', 
                background: 'transparent', 
                color: colors.primaryGreen, 
                fontWeight: 600, 
                border: `2px solid ${colors.primaryGreen}`, 
                borderRadius: 999, 
                padding: '0.8rem 0', 
                fontSize: '1rem',
                cursor: isStartingOver || isLoading ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s ease',
                opacity: isStartingOver || isLoading ? 0.7 : 1
              }}
              onMouseEnter={(e) => {
                if (isStartingOver || isLoading) return;
                e.target.style.backgroundColor = colors.primaryGreen;
                e.target.style.color = colors.white;
              }}
              onMouseLeave={(e) => {
                if (isStartingOver || isLoading) return;
                e.target.style.backgroundColor = 'transparent';
                e.target.style.color = colors.primaryGreen;
              }}
            >
              {isStartingOver ? t('loading', 'Loading...') : t('go_back', 'Go back')}
            </button>
          </div>
        </form>
      </div>

      {showReclaimModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 50,
          padding: '1rem'
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '1.5rem',
            maxWidth: '24rem',
            width: '100%',
            overflow: 'hidden'
          }}>
            <div style={{ padding: '1.25rem 1.5rem', background: '#2563eb', color: 'white' }}>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700, textAlign: 'center', margin: 0 }}>
                {t('reclaim_title')}
              </h3>
            </div>

            <div style={{ padding: '1.5rem' }}>
              <p style={{ color: '#4b5563', fontSize: '0.9rem', textAlign: 'center', marginBottom: '1.25rem' }}>
                {t('reclaim_description')}
              </p>

              <input
                type="text"
                value={verifyPersonalNumber}
                onChange={(e) => setVerifyPersonalNumber(e.target.value)}
                placeholder={t('personal_number_placeholder')}
                dir="ltr"
                style={{
                  width: '100%',
                  padding: '0.75rem 1rem',
                  border: `2px solid ${reclaimError ? colors.red : '#d1d5db'}`,
                  borderRadius: '0.75rem',
                  fontSize: '1rem',
                  textAlign: 'center',
                  outline: 'none',
                  boxSizing: 'border-box',
                  marginBottom: '0.75rem'
                }}
                onFocus={(e) => {
                  if (!reclaimError) e.target.style.borderColor = '#2563eb';
                }}
                onBlur={(e) => {
                  if (!reclaimError) e.target.style.borderColor = '#d1d5db';
                }}
              />

              {reclaimError && (
                <p style={{ color: colors.red, fontSize: '0.85rem', textAlign: 'center', marginBottom: '0.75rem' }}>
                  {reclaimError}
                </p>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.5rem' }}>
                <button
                  onClick={handleReclaim}
                  disabled={isReclaiming || !verifyPersonalNumber.trim()}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    borderRadius: '0.75rem',
                    fontWeight: 600,
                    fontSize: '1rem',
                    border: 'none',
                    background: isReclaiming || !verifyPersonalNumber.trim() ? '#9ca3af' : '#2563eb',
                    color: 'white',
                    cursor: isReclaiming || !verifyPersonalNumber.trim() ? 'not-allowed' : 'pointer',
                    opacity: isReclaiming || !verifyPersonalNumber.trim() ? 0.6 : 1,
                    transition: 'all 0.2s ease'
                  }}
                >
                  {isReclaiming ? t('loading') : t('reclaim_submit')}
                </button>
                <button
                  onClick={() => {
                    setShowReclaimModal(false);
                    setVerifyPersonalNumber('');
                    setReclaimError('');
                  }}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    borderRadius: '0.75rem',
                    fontWeight: 600,
                    fontSize: '0.95rem',
                    border: `2px solid ${colors.primaryGreen}`,
                    background: 'transparent',
                    color: colors.primaryGreen,
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                >
                  {t('reclaim_cancel')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}