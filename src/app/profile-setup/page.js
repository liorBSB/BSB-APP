'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { auth, db } from '../../lib/firebase';
import { doc, setDoc } from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import { useTranslation } from 'react-i18next';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import SoldierNameSearch from '@/components/SoldierNameSearch';
import { mapSoldierData, getAllSoldiers } from '@/lib/soldierDataService';
import colors from '../colors';

export default function ProfileSetup() {
  const router = useRouter();
  const { t, i18n } = useTranslation('profilesetup');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [roomNumber, setRoomNumber] = useState('');
  const [roomLetter, setRoomLetter] = useState('');
  const [error, setError] = useState('');
  const [selectedSoldier, setSelectedSoldier] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingSoldierData, setIsLoadingSoldierData] = useState(false);

  const changeLanguage = (lng) => {
    i18n.changeLanguage(lng);
  };

  // Handle soldier selection from Google Sheets
  const handleSoldierSelect = (soldierData) => {
    if (soldierData) {
      setIsLoadingSoldierData(true);
      const mappedData = mapSoldierData(soldierData);
      setSelectedSoldier(mappedData);
      setFirstName(mappedData.firstName || '');
      setLastName(mappedData.lastName || '');
      setRoomNumber(mappedData.roomNumber || '');
      setRoomLetter(mappedData.roomLetter || '');
      setError('');
      
      // Simulate a small delay to show loading state
      setTimeout(() => {
        setIsLoadingSoldierData(false);
      }, 500);
    } else {
      setSelectedSoldier(null);
      setFirstName('');
      setLastName('');
      setRoomNumber('');
      setRoomLetter('');
      setIsLoadingSoldierData(false);
    }
  };


  const handleSave = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    const uid = auth.currentUser?.uid;
    if (!uid) {
      setError('No authenticated user. Please sign in again.');
      router.push('/');
      return;
    }

    // Validate required fields
    if (!selectedSoldier) {
      setError('Please select your name from the list.');
      setIsLoading(false);
      return;
    }

    try {
      // Prepare user data with all information from Google Sheets
      const userData = {
        // Basic info
        fullName: selectedSoldier.fullName,
        firstName: selectedSoldier.firstName,
        lastName: selectedSoldier.lastName,
        email: selectedSoldier.email || auth.currentUser.email,
        userType: 'user',
        createdAt: new Date(),
        
        // Room info (from Google Sheets)
        roomNumber: selectedSoldier.roomNumber,
        floor: selectedSoldier.floor,
        roomType: selectedSoldier.roomType,
        roomStatus: selectedSoldier.roomStatus,
        serviceMonths: selectedSoldier.serviceMonths,
        serviceRange: selectedSoldier.serviceRange,
        monthsUntilRelease: selectedSoldier.monthsUntilRelease,
        age: selectedSoldier.age,
        calculatedReleaseDate: selectedSoldier.calculatedReleaseDate,
        roomGender: selectedSoldier.roomGender,
        
        // Personal info (from Google Sheets)
        gender: selectedSoldier.gender,
        dateOfBirth: selectedSoldier.dateOfBirth,
        idNumber: selectedSoldier.idNumber,
        idType: selectedSoldier.idType,
        countryOfOrigin: selectedSoldier.countryOfOrigin,
        phone: selectedSoldier.phone,
        previousAddress: selectedSoldier.previousAddress,
        education: selectedSoldier.education,
        license: selectedSoldier.license,
        
        // Family info (from Google Sheets)
        familyInIsrael: selectedSoldier.familyInIsrael,
        fatherName: selectedSoldier.fatherName,
        fatherPhone: selectedSoldier.fatherPhone,
        motherName: selectedSoldier.motherName,
        motherPhone: selectedSoldier.motherPhone,
        parentsStatus: selectedSoldier.parentsStatus,
        parentsAddress: selectedSoldier.parentsAddress,
        parentsEmail: selectedSoldier.parentsEmail,
        contactWithParents: selectedSoldier.contactWithParents,
        
        // Emergency contact (from Google Sheets)
        emergencyContactName: selectedSoldier.emergencyContactName,
        emergencyContactPhone: selectedSoldier.emergencyContactPhone,
        emergencyContactAddress: selectedSoldier.emergencyContactAddress,
        emergencyContactEmail: selectedSoldier.emergencyContactEmail,
        
        // Military info (from Google Sheets)
        personalNumber: selectedSoldier.personalNumber,
        enlistmentDate: selectedSoldier.enlistmentDate,
        releaseDate: selectedSoldier.releaseDate,
        unit: selectedSoldier.unit,
        battalion: selectedSoldier.battalion,
        mashakitTash: selectedSoldier.mashakitTash,
        mashakitPhone: selectedSoldier.mashakitPhone,
        officerName: selectedSoldier.officerName,
        officerPhone: selectedSoldier.officerPhone,
        disciplinaryRecord: selectedSoldier.disciplinaryRecord,
        
        // Medical info (from Google Sheets)
        healthFund: selectedSoldier.healthFund,
        
        // Additional info (from Google Sheets)
        cleanlinessLevel: selectedSoldier.cleanlinessLevel,
        contractDate: selectedSoldier.contractDate,
        
        // Metadata
        lastUpdated: new Date(),
        dataSource: 'google_sheets',
        profileComplete: true // Mark as complete since all data comes from sheets
      };

      // Update user document with all profile information
      await setDoc(doc(db, 'users', uid), userData);


      // After profile setup, go to consent step 1 for soldiers
      router.push('/register/consent/1?role=soldier');
    } catch (err) {
      console.error('Profile setup error:', err);
      setError('Failed to save profile. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center font-body px-4 phone-lg:px-0" style={{ background: colors.white }}>
      <LanguageSwitcher className="absolute top-4 right-4 bg-surface p-2 rounded-full text-white text-xl hover:text-text" />
      <div
        className="w-full max-w-xs phone-md:max-w-sm phone-lg:max-w-md mx-auto 
          bg-transparent rounded-none shadow-none p-0
          phone-lg:bg-white phone-lg:rounded-[2.5rem] phone-lg:shadow-lg phone-lg:p-[3.5rem_2.2rem]"
      >
        <h2 style={{ fontWeight: 700, fontSize: '2.5rem', textAlign: 'center', marginBottom: '2.8rem' }}>Complete Your Profile</h2>
        <form onSubmit={handleSave}>
          <div style={{ marginBottom: '2.2rem' }}>
            <label style={{ display: 'block', color: colors.muted, fontWeight: 600, marginBottom: 8, fontSize: 18 }}>Search Your Name</label>
            <SoldierNameSearch
              onSoldierSelect={handleSoldierSelect}
              placeholder="חיפוש לפי שם מלא..."
              error={error}
            />
            
            {/* Display selected soldier info */}
            {selectedSoldier && (
              <div style={{ 
                marginTop: '1rem', 
                padding: '1rem', 
                backgroundColor: colors.lightGray || '#f8f9fa', 
                borderRadius: '8px',
                border: `1px solid ${colors.primaryGreen}`,
                position: 'relative'
              }}>
                {isLoadingSoldierData && (
                  <div style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    color: colors.primaryGreen,
                    fontWeight: 600
                  }}>
                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-green-500 border-t-transparent"></div>
                    טוען פרטים...
                  </div>
                )}
                <div style={{ textAlign: 'right', fontSize: '1rem', opacity: isLoadingSoldierData ? 0.5 : 1 }}>
                  <div style={{ fontWeight: 600, marginBottom: '0.5rem' }}>
                    {selectedSoldier.fullName}
                  </div>
                  <div style={{ color: colors.muted, fontSize: '0.9rem' }}>
                    חדר: {selectedSoldier.roomNumber}
                    {selectedSoldier.building && `, בניין: ${selectedSoldier.building}`}
                    {selectedSoldier.floor && `, קומה: ${selectedSoldier.floor}`}
                  </div>
                </div>
              </div>
            )}
          </div>
          
          {error && <p style={{ color: colors.red, fontSize: 16, marginBottom: 16 }}>{error}</p>}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
            <button 
              type="submit" 
              disabled={isLoading || !selectedSoldier}
              style={{ 
                width: '100%', 
                background: isLoading || !selectedSoldier ? colors.muted : colors.gold, 
                color: colors.black, 
                fontWeight: 700, 
                fontSize: '1.35rem', 
                border: 'none', 
                borderRadius: 999, 
                padding: '0.8rem 0', 
                cursor: isLoading || !selectedSoldier ? 'not-allowed' : 'pointer',
                opacity: isLoading || !selectedSoldier ? 0.6 : 1
              }}
            >
              {isLoading ? 'Loading...' : 'Register'}
            </button>
            <button
              type="button"
              onClick={() => signOut(auth).then(() => router.push('/'))}
              style={{ width: '100%', background: 'transparent', color: colors.primaryGreen, fontWeight: 600, border: `2px solid ${colors.primaryGreen}`, borderRadius: 999, padding: '0.8rem 0', fontSize: 18, boxShadow: '0 1px 4px rgba(0,0,0,0.03)' }}
            >
              Log Out
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}