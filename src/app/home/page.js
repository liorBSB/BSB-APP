'use client';
import useAuthRedirect from '@/hooks/useAuthRedirect';
import { useEffect, useState } from 'react';
import { auth, db } from '../../lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import { signOut } from 'firebase/auth';


export default function Home() {
  const router = useRouter();
  const [userData, setUserData] = useState(null);

  useEffect(() => {
    const fetchUserData = async () => {
      const uid = auth.currentUser?.uid;
      if (!uid) {
        router.push('/');
        return;
      }
    
      const docRef = doc(db, 'users', uid);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        setUserData(docSnap.data());
      }
    };

    fetchUserData();
  }, []);

  const handleLogout = async () => {
    await signOut(auth);
    router.push('/');
    };components/GoogleSignInButton.jsx



  const toggleStatus = async () => {
    if (!auth.currentUser) return;
    const newStatus = userData.status === 'home' ? 'away' : 'home';

    await setDoc(
      doc(db, 'users', auth.currentUser.uid),
      { ...userData, status: newStatus },
      { merge: true }
    );

    setUserData((prev) => ({ ...prev, status: newStatus }));
  };


  if (!userData) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gray-100">
        <p className="text-gray-600">Loading...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#C2D8E5] flex flex-col items-center justify-start pt-12 px-4">
      <div className="flex flex-col items-center gap-2 mb-6">
        <div className="text-4xl">🏠</div>
        <h1 className="text-xl font-semibold text-gray-800">
          Hey {userData.fullName}
        </h1>
      </div>

      <div className="bg-white shadow-md rounded-xl p-4 w-full max-w-sm mb-6 text-left">
        <div className="flex justify-between items-center mb-2 text-sm text-gray-500">
          <span>Room Number</span>
          <span>Current Status</span>
        </div>
        <div className="flex justify-between items-center text-lg font-bold text-gray-800 mb-4">
          <span>{userData.roomNumber}</span>
          <span className={`flex items-center gap-1 ${userData.status === 'home' ? 'text-green-600' : 'text-red-600'}`}>
            <span className={`h-2 w-2 rounded-full ${userData.status === 'home' ? 'bg-green-500' : 'bg-red-500'}`} />
            {userData.status}
          </span>
        </div>

        <div className="flex items-center justify-between w-full max-w-sm bg-white p-4 rounded-xl shadow">
  <span className="text-sm font-medium text-gray-800">Status</span>

  <label className="inline-flex items-center cursor-pointer">
    <span className="mr-2 text-sm font-medium text-gray-700">
      {userData?.status === 'home' ? 'Home' : 'Away'}
    </span>
    <input
      type="checkbox"
      className="sr-only"
      checked={userData?.status === 'home'}
      onChange={toggleStatus}
    />
    <div
      className={`w-11 h-6 flex items-center bg-gray-300 rounded-full p-1 duration-300 ease-in-out ${
        userData?.status === 'home' ? 'bg-green-500' : 'bg-red-500'
      }`}
    >
      <div
        className={`bg-white w-4 h-4 rounded-full shadow-md transform duration-300 ease-in-out ${
          userData?.status === 'home' ? 'translate-x-5' : ''
        }`}
      />
    </div>
  </label>
</div>


      </div>

      <div className="w-full max-w-sm space-y-3">
        {[
          { label: "Expected Return Time", icon: "🕒" },
          { label: "Report Room Problems", icon: "⚠️" },
          { label: "Request Room Cleaning", icon: "🧹" },
          { label: "Will You Be Coming For Lunch/Dinner", icon: "💬" },
        ].map((item) => (
          <button
            key={item.label}
            className="w-full bg-white shadow-sm hover:bg-gray-100 flex items-center justify-between px-4 py-3 rounded-md text-gray-800 font-medium"
          >
            <span className="flex items-center gap-2 text-sm">
              {item.icon} {item.label}
            </span>
            <span>›</span>
          </button>
          
        ))}
      </div>

      <p className="text-sm text-gray-700 mt-8">📍 We Are Happy You Are Home</p>

<div className="w-full max-w-sm">
  <button
    onClick={handleLogout}
    className="mt-4 w-full text-red-600 border border-red-600 py-2 rounded-md font-semibold hover:bg-red-100"
  >
    Logout
  </button>
</div>

    </main>
  );
}
