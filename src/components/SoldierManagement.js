'use client';

import { useState, useEffect } from 'react';
import { getActiveSoldiers, markSoldierAsLeft, getSoldierProfile } from '@/lib/database';
import { auth } from '@/lib/firebase';
import SoldierSearch from './SoldierSearch';
import PencilIcon from './PencilIcon';

export default function SoldierManagement() {
  const [soldiers, setSoldiers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedSoldier, setSelectedSoldier] = useState(null);
  const [showSoldierDetails, setShowSoldierDetails] = useState(false);
  const [processingId, setProcessingId] = useState(null);

  useEffect(() => {
    loadSoldiers();
  }, []);

  const loadSoldiers = async () => {
    try {
      setLoading(true);
      const activeSoldiers = await getActiveSoldiers();
      setSoldiers(activeSoldiers);
    } catch (error) {
      console.error('Error loading soldiers:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSoldierSelect = async (soldier) => {
    try {
      // Load profile data if available
      const profile = await getSoldierProfile(soldier.id);
      setSelectedSoldier({ ...soldier, profile });
      setShowSoldierDetails(true);
    } catch (error) {
      console.error('Error loading soldier profile:', error);
      setSelectedSoldier(soldier);
      setShowSoldierDetails(true);
    }
  };

  const handleMarkAsLeft = async (soldierId) => {
    if (!auth.currentUser) return;
    
    try {
      setProcessingId(soldierId);
      await markSoldierAsLeft(soldierId, auth.currentUser.uid);
      
      // Remove from list
      setSoldiers(prev => prev.filter(s => s.id !== soldierId));
      
      // Close details if this soldier was selected
      if (selectedSoldier?.id === soldierId) {
        setShowSoldierDetails(false);
        setSelectedSoldier(null);
      }
    } catch (error) {
      console.error('Error marking soldier as left:', error);
      alert('שגיאה בסימון החייל כעוזב');
    } finally {
      setProcessingId(null);
    }
  };

  const renderSoldierCard = (soldier) => {
    const isProcessing = processingId === soldier.id;
    
    return (
      <div key={soldier.id} className="bg-white rounded-xl border p-4 shadow-sm hover:shadow-md transition-shadow">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3 flex-1">
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
              <span className="text-blue-600 text-xl">👤</span>
            </div>
            
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-lg text-gray-800 mb-1">
                {soldier.basicInfo?.fullName || 'ללא שם'}
              </h3>
              
              <div className="text-sm text-gray-600 space-y-1">
                {soldier.basicInfo?.email && (
                  <div>📧 {soldier.basicInfo.email}</div>
                )}
                {soldier.currentStatus?.roomNumber && (
                  <div>🏠 חדר: {soldier.currentStatus.roomNumber}{soldier.currentStatus.roomLetter}</div>
                )}
                {soldier.currentStatus?.bedNumber && (
                  <div>🛏️ מיטה: {soldier.currentStatus.bedNumber}</div>
                )}
                <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs ${
                  soldier.currentStatus?.isPresent 
                    ? 'bg-green-100 text-green-700' 
                    : 'bg-red-100 text-red-700'
                }`}>
                  <span className="w-2 h-2 rounded-full bg-current"></span>
                  {soldier.currentStatus?.isPresent ? 'נוכח' : 'לא נוכח'}
                </div>
              </div>
              
              {/* Profile Completion Status */}
              <div className="mt-3">
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="text-gray-600">השלמת פרופיל:</span>
                  <span className="font-medium">
                    {soldier.answeredQuestions || 0}/{soldier.totalQuestions || 0}
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ 
                      width: `${soldier.totalQuestions ? Math.round((soldier.answeredQuestions / soldier.totalQuestions) * 100) : 0}%` 
                    }}
                  ></div>
                </div>
              </div>
            </div>
          </div>
          
          <div className="flex flex-col gap-2 ml-4">
            <button
              onClick={() => handleSoldierSelect(soldier)}
              className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
              title="צפה בפרטים"
            >
              <PencilIcon className="w-5 h-5" />
            </button>
            
            <button
              onClick={() => handleMarkAsLeft(soldier.id)}
              disabled={isProcessing}
              className="px-3 py-2 text-sm text-red-600 border border-red-300 rounded-lg hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isProcessing ? 'מעבד...' : 'עזב'}
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-800">ניהול חיילים</h2>
        <div className="text-sm text-gray-600">
          סה&quot;כ חיילים: {soldiers.length}
        </div>
      </div>

      {/* Search */}
      <div className="max-w-md">
        <SoldierSearch onSelectSoldier={handleSoldierSelect} />
      </div>

      {/* Soldiers List */}
      {loading ? (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          טוען חיילים...
        </div>
      ) : soldiers.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          לא נמצאו חיילים פעילים
        </div>
      ) : (
        <div className="grid gap-4">
          {soldiers.map(renderSoldierCard)}
        </div>
      )}

      {/* Soldier Details Modal */}
      {showSoldierDetails && selectedSoldier && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
            {/* Header */}
            <div className="bg-blue-600 text-white p-6">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold">
                  פרטי חייל: {selectedSoldier.basicInfo?.fullName}
                </h3>
                <button
                  onClick={() => setShowSoldierDetails(false)}
                  className="text-white hover:text-gray-200 text-2xl"
                >
                  ×
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Basic Info */}
                <div className="space-y-4">
                  <h4 className="text-lg font-semibold text-gray-800 border-b pb-2">מידע בסיסי</h4>
                  <div className="space-y-2 text-sm">
                    <div><span className="font-medium">שם מלא:</span> {selectedSoldier.basicInfo?.fullName}</div>
                    <div><span className="font-medium">אימייל:</span> {selectedSoldier.basicInfo?.email}</div>
                    <div><span className="font-medium">טלפון:</span> {selectedSoldier.basicInfo?.phone}</div>
                    <div><span className="font-medium">חדר:</span> {selectedSoldier.currentStatus?.roomNumber}{selectedSoldier.currentStatus?.roomLetter}</div>
                    <div><span className="font-medium">מיטה:</span> {selectedSoldier.currentStatus?.bedNumber}</div>
                    <div><span className="font-medium">סטטוס:</span> {selectedSoldier.currentStatus?.isPresent ? 'נוכח' : 'לא נוכח'}</div>
                  </div>
                </div>

                {/* Profile Info */}
                {selectedSoldier.profile && (
                  <div className="space-y-4">
                    <h4 className="text-lg font-semibold text-gray-800 border-b pb-2">מידע מפורט</h4>
                    <div className="space-y-2 text-sm">
                      <div><span className="font-medium">ת.ז:</span> {selectedSoldier.profile.personalInfo?.idNumber}</div>
                      <div><span className="font-medium">יחידה:</span> {selectedSoldier.profile.militaryInfo?.unit}</div>
                      <div><span className="font-medium">גדוד:</span> {selectedSoldier.profile.militaryInfo?.battalion}</div>
                      <div><span className="font-medium">משקית תש:</span> {selectedSoldier.profile.militaryInfo?.mashakitTash}</div>
                      <div><span className="font-medium">איש קשר:</span> {selectedSoldier.profile.emergencyContact?.name}</div>
                    </div>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="mt-8 pt-6 border-t">
                <div className="flex justify-end gap-3">
                  <button
                    onClick={() => setShowSoldierDetails(false)}
                    className="px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    סגור
                  </button>
                  <button
                    onClick={() => handleMarkAsLeft(selectedSoldier.id)}
                    disabled={processingId === selectedSoldier.id}
                    className="px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {processingId === selectedSoldier.id ? 'מעבד...' : 'סמן כעוזב'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
