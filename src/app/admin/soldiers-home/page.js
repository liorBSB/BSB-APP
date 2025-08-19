"use client";

import { useState, useEffect } from 'react';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import colors from '../../colors';
import AdminBottomNavBar from '@/components/AdminBottomNavBar';
import PencilIcon from '@/components/PencilIcon';
import { doc, updateDoc } from 'firebase/firestore';
import { getActiveSoldiers, updateSoldierStatus } from '@/lib/database';

export default function SoldiersHomePage() {
  const [search, setSearch] = useState("");
  const [soldiers, setSoldiers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState(null);
  const [editModal, setEditModal] = useState({ open: false, soldier: null, form: { fullName: '', room: '', status: '', email: '' } });

  useEffect(() => {
    const fetchSoldiers = async () => {
      try {
        const activeSoldiers = await getActiveSoldiers();
        setSoldiers(activeSoldiers);
        setLoading(false);
      } catch (error) {
        console.error('Error fetching soldiers:', error);
        setLoading(false);
      }
    };
    fetchSoldiers();
  }, []);

  const handleEditClick = (soldier) => {
    setEditModal({
      open: true,
      soldier,
      form: {
        fullName: soldier.basicInfo?.fullName || '',
        room: soldier.currentStatus?.roomNumber || '',
        status: soldier.currentStatus?.isPresent ? 'home' : 'away',
        email: soldier.basicInfo?.email || '',
      }
    });
  };

  const handleEditChange = (e) => {
    setEditModal(modal => ({
      ...modal,
      form: { ...modal.form, [e.target.name]: e.target.value }
    }));
  };

  const handleEditSave = async () => {
    const { soldier, form } = editModal;
    try {
      await updateSoldierStatus(soldier.id, {
        'basicInfo.fullName': form.fullName,
        'currentStatus.roomNumber': form.room,
        'currentStatus.isPresent': form.status === 'home',
        'basicInfo.email': form.email
      });
      
      setSoldiers(soldiers => soldiers.map(s => s.id === soldier.id ? { 
        ...s, 
        basicInfo: { ...s.basicInfo, fullName: form.fullName, email: form.email },
        currentStatus: { ...s.currentStatus, roomNumber: form.room, isPresent: form.status === 'home' }
      } : s));
      
      setEditModal({ open: false, soldier: null, form: { fullName: '', room: '', status: '', email: '' } });
    } catch (error) {
      console.error('Error updating soldier:', error);
      alert('Failed to update soldier');
    }
  };

  const handleEditCancel = () => {
    setEditModal({ open: false, soldier: null, form: { fullName: '', room: '', status: '', email: '' } });
  };

  const filteredSoldiers = soldiers.filter(soldier =>
    soldier.basicInfo?.fullName?.toLowerCase().includes(search.toLowerCase()) ||
    soldier.currentStatus?.roomNumber?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-200/60 to-green-100/60 font-body flex flex-col items-center pt-6 pb-32 px-4">
      <div className="w-full max-w-md">
        {/* Search Bar */}
        <div className="mb-6">
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search soldiers by name or room..."
            className="w-full px-5 py-4 rounded-2xl text-lg border-none shadow-lg focus:outline-none"
            style={{ background: colors.white, fontSize: '1.4rem' }}
          />
        </div>
        {/* Soldiers List */}
        {loading ? (
          <div className="text-center text-muted py-2">Loading...</div>
        ) : filteredSoldiers.length === 0 ? (
          <div className="text-center text-muted py-2">No soldiers found</div>
        ) : (
          filteredSoldiers.map(soldier => {
            const isOpen = openId === soldier.id;
            return (
              <div key={soldier.id} className="mb-4">
                <div
                  onClick={() => setOpenId(isOpen ? null : soldier.id)}
                  className="cursor-pointer px-4 py-2 rounded-t-lg shadow-sm mb-0 flex items-center gap-3"
                  style={{ background: 'rgba(0,0,0,0.28)' }}
                >
                  <span className="text-2xl">🪖</span>
                  <div className="flex-1">
                    <div className="font-bold text-lg text-white">{soldier.basicInfo?.fullName || 'ללא שם'}</div>
                    {soldier.currentStatus?.roomNumber && (
                      <div className="text-sm text-white/80">
                        Room: {soldier.currentStatus.roomNumber}{soldier.currentStatus.roomLetter || ''}
                      </div>
                    )}
                  </div>
                  <button
                    className="ml-2 p-2 rounded-full hover:bg-gray-100"
                    style={{ background: 'none' }}
                    onClick={e => { e.stopPropagation(); handleEditClick(soldier); }}
                  >
                    <PencilIcon />
                  </button>
                </div>
                {isOpen && (
                  <div className="rounded-b-lg shadow px-6 py-4 mb-3" style={{ background: 'rgba(0,0,0,0.18)' }}>
                    <ul className="space-y-2">
                      <li className="text-white text-base">Full name: {soldier.basicInfo?.fullName || '-'}</li>
                      <li className="text-white text-base">Room number: {soldier.currentStatus?.roomNumber || '-'}{soldier.currentStatus?.roomLetter || ''}</li>
                      <li className="text-white text-base">Status: {soldier.currentStatus?.isPresent ? 'נוכח' : 'לא נוכח'}</li>
                      <li className="text-white text-base">Email: {soldier.basicInfo?.email || '-'}</li>
                      <li className="text-white text-base">Profile Complete: {soldier.profileComplete ? 'כן' : 'לא'}</li>
                      <li className="text-white text-base">Questions: {soldier.answeredQuestions || 0}/{soldier.totalQuestions || 0}</li>
                    </ul>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
      {/* Edit Modal */}
      {editModal.open && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 shadow-lg w-full max-w-xs mx-4">
            <h2 className="text-xl font-bold mb-4">Edit Soldier</h2>
            <div className="mb-4">
              <label className="block text-gray-700 font-semibold mb-2">Full name</label>
              <input
                type="text"
                name="fullName"
                value={editModal.form.fullName}
                onChange={handleEditChange}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:border-primaryGreen"
              />
            </div>
            <div className="mb-4">
              <label className="block text-gray-700 font-semibold mb-2">Room number</label>
              <input
                type="text"
                name="room"
                value={editModal.form.room}
                onChange={handleEditChange}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:border-primaryGreen"
              />
            </div>
            <div className="mb-4">
              <label className="block text-gray-700 font-semibold mb-2">Status</label>
              <input
                type="text"
                name="status"
                value={editModal.form.status}
                onChange={handleEditChange}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:border-primaryGreen"
              />
            </div>
            <div className="mb-4">
              <label className="block text-gray-700 font-semibold mb-2">Email</label>
              <input
                type="email"
                name="email"
                value={editModal.form.email}
                onChange={handleEditChange}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:border-primaryGreen"
              />
            </div>
            <div className="flex gap-4">
              <button
                onClick={handleEditSave}
                className="flex-1 px-4 py-2 rounded-lg text-white font-semibold"
                style={{ background: colors.gold }}
              >
                Save
              </button>
              <button
                onClick={handleEditCancel}
                className="flex-1 px-4 py-2 rounded-lg border-2 font-semibold"
                style={{ borderColor: colors.primaryGreen, color: colors.primaryGreen }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
      <AdminBottomNavBar active="soldiers" />
    </main>
  );
} 