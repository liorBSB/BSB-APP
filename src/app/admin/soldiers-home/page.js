"use client";

import '@/i18n';
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import colors from '../../colors';
import AdminBottomNavBar from '@/components/AdminBottomNavBar';
import PencilIcon from '@/components/PencilIcon';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import { doc, updateDoc } from 'firebase/firestore';
import { getActiveUsers, updateUserStatus } from '@/lib/database';

export default function SoldiersHomePage() {
  const { t } = useTranslation('admin');
  const [search, setSearch] = useState("");
  const [soldiers, setSoldiers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState(null);
  const [editModal, setEditModal] = useState({ open: false, soldier: null, form: { fullName: '', room: '', status: '', email: '' } });

  useEffect(() => {
    const fetchSoldiers = async () => {
      try {
        const activeSoldiers = await getActiveUsers();
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
        fullName: soldier.fullName || '',
        room: soldier.roomNumber || '',
        status: soldier.status || 'home',
        email: soldier.email || '',
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
      await updateUserStatus(soldier.id, {
        fullName: form.fullName,
        roomNumber: form.room,
        status: form.status,
        email: form.email
      });
        
        setSoldiers(soldiers => soldiers.map(s => s.id === soldier.id ? { 
          ...s, 
          fullName: form.fullName,
          roomNumber: form.room,
          status: form.status,
          email: form.email
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
    soldier.fullName?.toLowerCase().includes(search.toLowerCase()) ||
    soldier.roomNumber?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-200/60 to-green-100/60 font-body flex flex-col items-center pt-6 pb-40 px-4">
      <LanguageSwitcher />
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="w-full max-w-md px-5 pt-6 pb-4 mb-2">
          <h1 className="text-2xl font-bold text-black mb-1">
{t('soldiers_home', 'Soldiers Home')}
          </h1>
          <p className="text-lg text-black font-medium">
{t('manage_soldier_status', 'Manage soldier status and information')}
          </p>
        </div>

        {/* Search Bar */}
        <div className="mb-8">
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={t('search_soldiers_placeholder', 'Search soldiers by name or room...')}
            className="w-full px-5 py-4 rounded-2xl text-lg border-none shadow-lg focus:outline-none"
            style={{ background: colors.white, fontSize: '1.4rem' }}
          />
        </div>
        {/* Soldiers List */}
        <div className="mb-8">
          <div className="flex items-center px-4 py-3 rounded-t-lg shadow-sm select-none" style={{ background: colors.sectionBg, color: colors.white }}>
            <div className="font-semibold text-lg flex-1" style={{ textAlign: 'start' }}>
              {t('soldiers', 'Soldiers')}
            </div>
            <div className="text-sm text-white/80">
{t('found_count', '{{count}} found', { count: filteredSoldiers.length })}
            </div>
          </div>
          <div className="rounded-b-lg p-5" style={{ background: 'rgba(0,0,0,0.18)' }}>
            {loading ? (
              <div className="text-center text-muted py-3">{t('loading', 'Loading...')}</div>
            ) : filteredSoldiers.length === 0 ? (
              <div className="text-center text-muted py-3">{t('no_soldiers_found', 'No soldiers found')}</div>
            ) : (
              filteredSoldiers.map(soldier => {
                const isOpen = openId === soldier.id;
                return (
                  <div key={soldier.id} className="relative mb-5 bg-blue-50 rounded-xl shadow-md p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 pr-4">
                        <div className="flex items-start gap-3 mb-3">
                          <span className="text-2xl">🪖</span>
                          <div className="flex-1">
                            <div className="font-bold text-xl text-[#076332] mb-2">{soldier.fullName || t('no_name', 'No name')}</div>
                            {soldier.roomNumber && (
                              <div className="text-base font-medium text-gray-700 mb-2">
{t('room', 'Room')}: {soldier.roomNumber}
                              </div>
                            )}
                            <div className="text-sm font-semibold" style={{ color: '#fff', background: '#076332', borderRadius: 6, padding: '4px 10px', display: 'inline-block' }}>
{t(soldier.status || 'home', soldier.status || 'Home')}
                            </div>
                          </div>
                        </div>
                        {isOpen && (
                          <div className="mt-4 pt-4 border-t border-gray-200">
                            <div className="grid grid-cols-2 gap-4 text-sm text-gray-600">
                              <div>
                                <span className="font-semibold">{t('email', 'Email')}:</span> {soldier.email || '-'}
                              </div>
                              <div>
                                <span className="font-semibold">{t('profile', 'Profile')}:</span> {soldier.profileComplete ? t('complete', 'Complete') : t('incomplete', 'Incomplete')}
                              </div>
                              <div>
                                <span className="font-semibold">{t('questions', 'Questions')}:</span> {soldier.answeredQuestions || 0}/{soldier.totalQuestions || 0}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col gap-2">
                        <button
                          className="p-2 rounded-full hover:bg-gray-100"
                          onClick={e => { e.stopPropagation(); handleEditClick(soldier); }}
                        >
                          <PencilIcon />
                        </button>
                        <button
                          onClick={() => setOpenId(isOpen ? null : soldier.id)}
                          className="px-3 py-1 rounded-lg text-xs font-semibold transition"
                          style={{ color: colors.primaryGreen, background: 'none' }}
                        >
{isOpen ? t('hide', 'Hide') : t('show', 'Show')}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
      {/* Edit Modal */}
      {editModal.open && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 shadow-lg w-full max-w-xs">
            <h2 className="text-xl font-bold mb-4">{t('edit_soldier', 'Edit Soldier')}</h2>
            
            <div className="mb-4">
              <label className="block text-gray-700 font-semibold mb-2">{t('full_name', 'Full Name')}</label>
              <input
                type="text"
                name="fullName"
                value={editModal.form.fullName}
                onChange={handleEditChange}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:border-primaryGreen"
              />
            </div>
            
            <div className="mb-4">
              <label className="block text-gray-700 font-semibold mb-2">{t('room_number', 'Room Number')}</label>
              <input
                type="text"
                name="room"
                value={editModal.form.room}
                onChange={handleEditChange}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:border-primaryGreen"
              />
            </div>
            
            <div className="mb-4">
              <label className="block text-gray-700 font-semibold mb-2">{t('status', 'Status')}</label>
              <select
                name="status"
                value={editModal.form.status}
                onChange={handleEditChange}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:border-primaryGreen"
              >
                <option value="home">{t('home', 'Home')}</option>
                <option value="away">{t('away', 'Away')}</option>
                <option value="in base">{t('in_base', 'In Base')}</option>
                <option value="abroad">{t('abroad', 'Abroad')}</option>
              </select>
            </div>
            
            <div className="mb-4">
              <label className="block text-gray-700 font-semibold mb-2">{t('email', 'Email')}</label>
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
{t('save', 'Save')}
              </button>
              <button
                onClick={handleEditCancel}
                className="flex-1 px-4 py-2 rounded-lg border-2 font-semibold"
                style={{ borderColor: colors.primaryGreen, color: colors.primaryGreen }}
              >
{t('cancel', 'Cancel')}
              </button>
            </div>
          </div>
        </div>
      )}
      <AdminBottomNavBar active="soldiers" />
    </main>
  );
} 