'use client';
import { useRouter } from 'next/navigation';
import colors from '../../colors';

export default function SelectionPage() {
  const router = useRouter();

  const handleWorkHere = () => {
    router.push('/admin/profile-setup');
  };

  const handleLiveHere = () => {
    router.push('/profile-setup');
  };

  const handleBackToHome = () => {
    router.push('/');
  };

  return (
    <main className="min-h-screen flex items-center justify-center font-body px-4 phone-lg:px-0" style={{ background: colors.white }}>
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
            onClick={handleBackToHome}
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
            Back to Home
          </button>
        </div>
      </div>
    </main>
  );
} 