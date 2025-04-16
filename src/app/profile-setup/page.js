'use client';
import useAuthRedirect from '@/hooks/useAuthRedirect';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { auth, db } from '../../lib/firebase';
import { doc, setDoc } from 'firebase/firestore';
import { signOut } from 'firebase/auth';

export default function ProfileSetup() {
    useAuthRedirect(); // Only checks login (not profile)
}
export default function ProfileSetup() {
  const router = useRouter();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [roomNumber, setRoomNumber] = useState('');
  const [roomLetter, setRoomLetter] = useState('');
  const [error, setError] = useState('');

  const handleSave = async (e) => {
    e.preventDefault();

    const uid = auth.currentUser?.uid;
    if (!uid) {
      setError('No authenticated user');
      return;
    }

    try {
      await setDoc(doc(db, 'users', uid), {
        fullName: `${firstName} ${lastName}`,
        firstName,
        lastName,
        roomNumber: `${roomNumber}${roomLetter}`,
        roomNumberOnly: roomNumber,
        roomLetter,
        email: auth.currentUser.email,
        status: 'home', // default status
      });

      router.push('/home');
    } catch (err) {
      setError('Failed to save profile: ' + err.message);
    }
  };

  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-gray-100 px-4">
      <form
        onSubmit={handleSave}
        className="bg-white shadow-md rounded-xl p-6 w-full max-w-md space-y-4"
      >
        <h2 className="text-2xl font-bold text-center text-green-700">Complete Your Profile</h2>
        <p className="text-center text-sm text-gray-500">Please fill in your details to continue</p>

        <input
          type="text"
          placeholder="First Name"
          className="border rounded w-full p-2"
          value={firstName}
          onChange={(e) => setFirstName(e.target.value)}
          required
        />

        <input
          type="text"
          placeholder="Last Name"
          className="border rounded w-full p-2"
          value={lastName}
          onChange={(e) => setLastName(e.target.value)}
          required
        />

        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Room Number"
            className="border rounded w-full p-2"
            value={roomNumber}
            onChange={(e) => setRoomNumber(e.target.value)}
            required
          />
          <select
            className="border rounded p-2"
            value={roomLetter}
            onChange={(e) => setRoomLetter(e.target.value)}
            required
          >
            <option value="">Select</option>
            <option value="א">א</option>
            <option value="ב">ב</option>
            <option value="ג">ג</option>
          </select>
        </div>

        {error && <p className="text-red-500 text-sm">{error}</p>}

        <button
          type="submit"
          className="bg-green-600 hover:bg-green-700 text-white w-full py-2 rounded"
        >
          Continue
        </button>
      </form>

      <button
        onClick={() => signOut(auth).then(() => router.push('/'))}
        className="mt-6 text-brown-700 border border-brown-700 px-4 py-2 rounded"
      >
        Logout
      </button>
    </main>
  );
}
