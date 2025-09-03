'use client';
import { useRouter } from 'next/navigation';
import { auth, db } from '@/lib/firebase';
import { doc, deleteDoc, updateDoc } from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import colors from '../../colors';

export default function SelectionPage() {
  const router = useRouter();

  const handleWorkHere = async () => {
    try {
      const user = auth.currentUser;
      if (user) {
        // Update user type to indicate they chose to work here
        await updateDoc(doc(db, 'users', user.uid), {
          userType: 'pending_approval',
          roleChoice: 'work_here'
        });
      }
      router.push('/admin/profile-setup');
    } catch (error) {
      console.error('Error updating user choice:', error);
      // Still redirect even if update fails
      router.push('/admin/profile-setup');
    }
  };

  const handleLiveHere = async () => {
    try {
      const user = auth.currentUser;
      if (user) {
        // Update user type to indicate they chose to live here
        await updateDoc(doc(db, 'users', user.uid), {
          userType: 'user',
          roleChoice: 'live_here'
        });
      }
      router.push('/profile-setup');
    } catch (error) {
      console.error('Error updating user choice:', error);
      // Still redirect even if update fails
      router.push('/profile-setup');
    }
  };

  const handleCancel = async () => {
    try {
      const user = auth.currentUser;
      if (user) {
        // Delete the user document from Firestore
        const userRef = doc(db, 'users', user.uid);
        await deleteDoc(userRef);
        
        // Sign out the user
        await signOut(auth);
      }
      
      // Redirect to home page
      router.push('/');
    } catch (error) {
      console.error('Error during cancel:', error);
      // Even if there's an error, try to sign out and redirect
      try {
        await signOut(auth);
        router.push('/');
      } catch (signOutError) {
        console.error('Error signing out:', signOutError);
        router.push('/');
      }
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
        <h2 style={{ fontWeight: 700, fontSize: '2.5rem', textAlign: 'center', marginBottom: '2.8rem' }}>Do you...</h2>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <button
            onClick={handleWorkHere}
            style={{ 
              width: '100%', 
              background: colors.gold, 
              color: colors.black, 
              fontWeight: 700, 
              fontSize: '1.35rem', 
              border: 'none', 
              borderRadius: 999, 
              padding: '1rem 0', 
              cursor: 'pointer',
              marginBottom: '1rem'
            }}
          >
            Work Here
          </button>
          
          <button
            onClick={handleLiveHere}
            style={{ 
              width: '100%', 
              background: colors.primaryGreen, 
              color: colors.white, 
              fontWeight: 700, 
              fontSize: '1.35rem', 
              border: 'none', 
              borderRadius: 999, 
              padding: '1rem 0', 
              cursor: 'pointer',
              marginBottom: '2rem'
            }}
          >
            Live Here
          </button>

          <button
            onClick={handleCancel}
            style={{ 
              width: '100%', 
              background: 'transparent', 
              color: colors.primaryGreen, 
              fontWeight: 600, 
              fontSize: '1rem', 
              border: `2px solid ${colors.primaryGreen}`, 
              borderRadius: 999, 
              padding: '0.8rem 0', 
              cursor: 'pointer'
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    </main>
  );
} 