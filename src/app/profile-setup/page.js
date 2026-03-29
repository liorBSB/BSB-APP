'use client';
import '@/i18n';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { auth, db } from '../../lib/firebase';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { useTranslation } from 'react-i18next';

import SoldierNameSearch from '@/components/SoldierNameSearch';
import HouseLoader from '@/components/HouseLoader';
import { mapSoldierData } from '@/lib/soldierDataService';
import { FIELD_MAP } from '@/lib/sheetFieldMap';
import { resetUserToPreSelection } from '@/lib/database';
import { fetchStatusFromSheet } from '@/lib/receptionSync';
import { authedFetch } from '@/lib/authFetch';
import useAuthRedirect from '@/hooks/useAuthRedirect';
import colors from '../colors';

export default function ProfileSetup() {
  const router = useRouter();
  const { isReady } = useAuthRedirect();
  const { t, i18n } = useTranslation('profilesetup');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [roomNumber, setRoomNumber] = useState('');
  const [error, setError] = useState('');
  const [selectedSoldier, setSelectedSoldier] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isStartingOver, setIsStartingOver] = useState(false);
  const [verified, setVerified] = useState(false);
  const [personalNumberInput, setPersonalNumberInput] = useState('');
  const [verifyError, setVerifyError] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);


  // Handle soldier selection from Google Sheets
  const handleSoldierSelect = (soldierData) => {
    if (soldierData) {
      const mappedData = mapSoldierData(soldierData);
      setSelectedSoldier(mappedData);
      setFirstName(mappedData.firstName || '');
      setLastName(mappedData.lastName || '');
      setRoomNumber(mappedData.roomNumber || '');
    } else {
      setSelectedSoldier(null);
      setFirstName('');
      setLastName('');
      setRoomNumber('');
    }
    setError('');
    setVerified(false);
    setPersonalNumberInput('');
    setVerifyError('');
  };


  const handleVerify = async () => {
    if (!selectedSoldier || !personalNumberInput.trim()) return;

    setIsVerifying(true);
    setVerifyError('');

    try {
      const res = await authedFetch('/api/soldiers/verify-identity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          idNumber: String(selectedSoldier.idNumber ?? '').trim(),
          fullName: String(selectedSoldier.fullName ?? '').trim(),
          personalNumber: personalNumberInput.trim(),
        }),
      });

      if (res.status === 429) {
        setVerifyError(t('verify_rate_limit'));
        setIsVerifying(false);
        return;
      }

      const data = await res.json();
      if (!res.ok) {
        setVerifyError(t('verify_service_error'));
        setIsVerifying(false);
        return;
      }

      if (data.verified) {
        setVerified(true);
        setVerifyError('');
      } else {
        setVerifyError(t('verify_failed'));
      }
    } catch (err) {
      console.error('Verification error:', err);
      setVerifyError(t('verify_service_error'));
    } finally {
      setIsVerifying(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    const currentUser = auth.currentUser;
    const uid = currentUser?.uid;

    if (!uid) {
      setError(t('no_auth_error'));
      setIsLoading(false);
      router.push('/');
      return;
    }

    if (!selectedSoldier) {
      setError(t('select_name_error'));
      setIsLoading(false);
      return;
    }

    if (!verified) {
      setError(t('verify_identity_prompt'));
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

            {selectedSoldier && !verified && (
              <div style={{
                marginTop: '1.25rem',
                padding: '1.25rem',
                backgroundColor: '#F0F9FF',
                borderRadius: '16px',
                border: '2px solid #93C5FD',
              }}>
                <label
                  style={{ display: 'block', color: colors.text, fontWeight: 600, marginBottom: 10, fontSize: '0.95rem', textAlign: 'center' }}
                  dir={isRTL ? 'rtl' : 'ltr'}
                >
                  {t('verify_identity_prompt')}
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={personalNumberInput}
                  onChange={(e) => setPersonalNumberInput(e.target.value.replace(/\D/g, ''))}
                  placeholder={t('personal_number_placeholder')}
                  dir="ltr"
                  style={{
                    width: '100%',
                    padding: '0.75rem 1rem',
                    border: `2px solid ${verifyError ? colors.red : '#d1d5db'}`,
                    borderRadius: '0.75rem',
                    fontSize: '1.1rem',
                    textAlign: 'center',
                    outline: 'none',
                    boxSizing: 'border-box',
                    letterSpacing: '0.1em',
                    fontWeight: 600,
                  }}
                  onFocus={(e) => {
                    if (!verifyError) e.target.style.borderColor = '#3B82F6';
                  }}
                  onBlur={(e) => {
                    if (!verifyError) e.target.style.borderColor = '#d1d5db';
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleVerify();
                    }
                  }}
                />
                {verifyError && (
                  <p style={{ color: colors.red, fontSize: '0.85rem', textAlign: 'center', marginTop: '0.5rem', marginBottom: 0 }}>
                    {verifyError}
                  </p>
                )}
                <button
                  type="button"
                  onClick={handleVerify}
                  disabled={isVerifying || !personalNumberInput.trim()}
                  style={{
                    width: '100%',
                    marginTop: '0.75rem',
                    padding: '0.7rem',
                    borderRadius: '0.75rem',
                    fontWeight: 600,
                    fontSize: '1rem',
                    border: 'none',
                    background: isVerifying || !personalNumberInput.trim() ? colors.gray400 : '#3B82F6',
                    color: colors.white,
                    cursor: isVerifying || !personalNumberInput.trim() ? 'not-allowed' : 'pointer',
                    opacity: isVerifying || !personalNumberInput.trim() ? 0.6 : 1,
                    transition: 'all 0.2s ease',
                  }}
                >
                  {isVerifying ? t('verifying') : t('verify_button')}
                </button>
              </div>
            )}

            {verified && (
              <div style={{
                marginTop: '1.25rem',
                padding: '0.75rem 1rem',
                backgroundColor: '#F0FDF4',
                borderRadius: '12px',
                border: `2px solid ${colors.primaryGreen}`,
                textAlign: 'center',
                color: colors.primaryGreen,
                fontWeight: 600,
                fontSize: '0.95rem',
              }}>
                ✓ {t('verify_success')}
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
            </div>
          )}
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <button 
              type="submit" 
              disabled={isLoading || !selectedSoldier || !verified}
              style={{ 
                width: '100%', 
                background: isLoading || !selectedSoldier || !verified ? colors.gray400 : colors.gold, 
                color: colors.black, 
                fontWeight: 700, 
                fontSize: '1.35rem', 
                border: 'none', 
                borderRadius: 999, 
                padding: '1rem 0', 
                cursor: isLoading || !selectedSoldier || !verified ? 'not-allowed' : 'pointer',
                opacity: isLoading || !selectedSoldier || !verified ? 0.6 : 1,
                transition: 'all 0.2s ease',
                boxShadow: isLoading || !selectedSoldier || !verified ? 'none' : '0 2px 8px rgba(0,0,0,0.1)'
              }}
              onMouseEnter={(e) => {
                if (!isLoading && selectedSoldier && verified) {
                  e.target.style.transform = 'translateY(-1px)';
                  e.target.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
                }
              }}
              onMouseLeave={(e) => {
                if (!isLoading && selectedSoldier && verified) {
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

    </main>
  );
}
