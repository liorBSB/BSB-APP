'use client';

import { useState, useEffect } from 'react';
import { getActiveUsers, markUserAsLeft } from '@/lib/database';
import { auth } from '@/lib/firebase';
import SoldierSearch from './SoldierSearch';
import QuestionnaireEditor from './QuestionnaireEditor';
import colors from '../app/colors';

export default function SoldierManagement() {
  const [soldiers, setSoldiers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedSoldier, setSelectedSoldier] = useState(null);
  const [showSoldierDetails, setShowSoldierDetails] = useState(false);
  const [showQuestionnaireEditor, setShowQuestionnaireEditor] = useState(false);
  const [processingId, setProcessingId] = useState(null);
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
  const [soldierToDelete, setSoldierToDelete] = useState(null);
  const [showOnlyHome, setShowOnlyHome] = useState(false);


  useEffect(() => {
    loadSoldiers();
  }, []);

  const loadSoldiers = async () => {
    try {
      setLoading(true);
      console.log('Loading soldiers...');
      
      // Get active users (soldiers)
      const activeSoldiers = await getActiveUsers();
      console.log('Active soldiers loaded:', activeSoldiers);
      console.log('Number of active soldiers:', activeSoldiers.length);
      
      if (activeSoldiers.length === 0) {
        console.log('No soldiers found with userType === "user"');
        console.log('Let\'s check what users exist in the database...');
        
        // Import the necessary Firebase functions
        const { collection, getDocs, query, orderBy } = await import('firebase/firestore');
        const { db } = await import('@/lib/firebase');
        
        // Get all users to see what's in the database
        const allUsersQuery = query(collection(db, 'users'), orderBy('fullName'));
        const allUsersSnap = await getDocs(allUsersQuery);
        const allUsers = allUsersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        console.log('All users in database:', allUsers);
        console.log('User types found:', [...new Set(allUsers.map(u => u.userType))]);
        
        // Show all users for debugging purposes
        setSoldiers(allUsers);
      } else {
        setSoldiers(activeSoldiers);
      }
    } catch (error) {
      console.error('Error loading soldiers:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSoldierSelect = async (soldier) => {
    setSelectedSoldier(soldier);
    setShowSoldierDetails(true);
  };

  const handleEditSoldier = (soldier) => {
    setSelectedSoldier(soldier);
    setShowQuestionnaireEditor(true);
  };

  const showDeleteConfirmationDialog = (soldier) => {
    setSoldierToDelete(soldier);
    setShowDeleteConfirmation(true);
  };

  const handleMarkAsLeft = async (soldierId) => {
    if (!auth.currentUser) return;
    
    try {
      setProcessingId(soldierId);
      await markUserAsLeft(soldierId, auth.currentUser.uid);
      
      // Remove from lists
      setSoldiers(prev => prev.filter(s => s.id !== soldierId));
      setSearchResults(prev => prev.filter(s => s.id !== soldierId));
      
      // Close details if this soldier was selected
      if (selectedSoldier?.id === soldierId) {
        setShowSoldierDetails(false);
        setSelectedSoldier(null);
      }
      
      // Close confirmation dialog
      setShowDeleteConfirmation(false);
      setSoldierToDelete(null);
      
      // Show success message
      alert(`✅ Soldier "${soldierToDelete?.fullName || 'Unknown'}" has been successfully marked as left and archived.`);
      
    } catch (error) {
      console.error('Error marking soldier as left:', error);
      alert('❌ Error marking soldier as left');
    } finally {
      setProcessingId(null);
    }
  };

  const cancelDelete = () => {
    setShowDeleteConfirmation(false);
    setSoldierToDelete(null);
  };

  // Helper function to get filtered soldiers
  const getFilteredSoldiers = () => {
    if (showOnlyHome) {
      return soldiers.filter(soldier => soldier.status === 'home');
    }
    return soldiers;
  };

  // Helper function to get home soldiers count
  const getHomeSoldiersCount = () => {
    return soldiers.filter(soldier => soldier.status === 'home').length;
  };



  const handleSearchResults = (results) => {
    setSearchResults(results);
    setIsSearching(results.length > 0);
    
    // Reset home filter when searching
    if (results.length > 0) {
      setShowOnlyHome(false);
    }
  };

  const renderSoldierCard = (soldier, showMarkAsLeft = false) => {
    const isProcessing = processingId === soldier.id;
    
    return (
      <div key={soldier.id} className="rounded-2xl p-4 mb-4 shadow-sm" style={{ background: colors.sectionBg, color: colors.white }}>
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3 flex-1">
            <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ background: colors.gold }}>
              <span className="text-xl" style={{ color: colors.black }}>👤</span>
            </div>
            
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-lg mb-1" style={{ color: colors.white }}>
                {soldier.fullName || 'No Name'}
              </h3>
              
              <div className="text-sm space-y-1" style={{ color: colors.white, opacity: 0.9 }}>
                {soldier.email && (
                  <div>📧 {soldier.email}</div>
                )}
                {soldier.roomNumber && (
                  <div>🏠 Room: {soldier.roomNumber}</div>
                )}
                <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs ${
                  soldier.status === 'home'
                    ? 'bg-green-100 text-green-700' 
                    : 'bg-red-100 text-red-700'
                }`}>
                  <span className="w-2 h-2 rounded-full bg-current"></span>
                  {soldier.status === 'home' ? '🏠 Home' : '🚪 Away'}
                </div>
              </div>
            </div>
          </div>
          
          <div className="flex flex-col gap-2 ml-4">
            <button
              onClick={() => handleEditSoldier(soldier)}
              className="px-4 py-2 rounded-xl font-semibold transition-all duration-200 hover:scale-105"
              style={{ 
                background: 'transparent', 
                color: colors.white,
                border: `2px solid ${colors.white}`,
                boxShadow: '0 4px 12px rgba(255, 255, 255, 0.1)'
              }}
              title="Edit Soldier"
            >
              Edit
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
        <h2 className="text-2xl font-bold text-gray-800">Soldier Management</h2>
        <div className="text-sm text-gray-600">
          {showOnlyHome ? (
            <span>
              <span className="font-semibold text-green-600">
                {getHomeSoldiersCount()} Home
              </span>
              <span className="text-gray-400"> / {soldiers.length} Total</span>
            </span>
          ) : (
            `Total Soldiers: ${soldiers.length}`
          )}
        </div>
      </div>

      {/* All Buttons Above Search */}
      <div className="flex flex-wrap gap-3 items-center">
        {/* Home Filter Toggle */}
        <button
          onClick={() => setShowOnlyHome(!showOnlyHome)}
          className={`px-4 py-2 rounded-xl font-semibold transition-all duration-200 hover:scale-105 flex items-center gap-2 ${
            showOnlyHome 
              ? 'text-white shadow-lg animate-pulse' 
              : 'border-2'
          }`}
          style={{ 
            background: showOnlyHome ? colors.primaryGreen : 'transparent',
            borderColor: showOnlyHome ? 'transparent' : colors.primaryGreen,
            color: showOnlyHome ? 'white' : colors.primaryGreen
          }}
        >
          <span>🏠</span>
          {showOnlyHome ? 'Show All Soldiers' : 'Show Only Home'}
        </button>
        
        {showOnlyHome && (
          <div className="text-sm text-gray-600 bg-green-50 px-3 py-1 rounded-full border border-green-200">
            {getHomeSoldiersCount()} soldiers home
          </div>
        )}
      </div>

      {/* Search */}
      <div className="max-w-md">
        <SoldierSearch 
          onSelectSoldier={handleSoldierSelect} 
          onSearchResults={handleSearchResults}
        />
      </div>

      {/* Soldiers List - Show After Search */}
      {loading ? (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <div className="text-gray-600">Loading soldiers...</div>
        </div>
      ) : soldiers.length === 0 ? (
        <div className="text-center py-8 rounded-2xl shadow-sm" style={{ background: colors.sectionBg, color: colors.white }}>
          No active soldiers found
        </div>
      ) : (
        <div className="space-y-4">
          {/* Filter Info */}
          {showOnlyHome && (
            <div className="text-center py-3 rounded-xl shadow-sm" style={{ background: colors.gold, color: colors.black }}>
              <div className="font-semibold text-lg">🏠 Showing Only Soldiers Currently Home</div>
              <div className="text-sm opacity-80">
                {getHomeSoldiersCount()} of {soldiers.length} soldiers are home
              </div>
            </div>
          )}
          
          {/* Soldiers List */}
          {getFilteredSoldiers().map(soldier => renderSoldierCard(soldier))}
          
          {/* No Home Soldiers Message */}
          {showOnlyHome && getHomeSoldiersCount() === 0 && (
            <div className="text-center py-8 rounded-2xl shadow-sm" style={{ background: colors.sectionBg, color: colors.white }}>
              <div className="text-2xl mb-2">🏠</div>
              <div className="font-semibold text-lg">No soldiers are currently home</div>
              <div className="text-sm opacity-80">All soldiers are marked as away or not present</div>
            </div>
          )}
        </div>
      )}

      {/* Search Results */}
      {isSearching && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-800">Search Results</h3>
            <button
              onClick={() => {
                setSearchResults([]);
                setIsSearching(false);
                setShowOnlyHome(false); // Reset home filter when clearing search
              }}
              className="px-4 py-2 rounded-xl font-semibold transition-all duration-200 hover:scale-105"
              style={{ 
                background: colors.gold, 
                color: colors.black,
                boxShadow: '0 4px 12px rgba(237, 195, 129, 0.3)'
              }}
            >
              Clear Search
            </button>
          </div>
          {searchResults.length === 0 ? (
            <div className="text-center py-8 rounded-2xl shadow-sm" style={{ background: colors.sectionBg, color: colors.white }}>
              No soldiers found matching your search.
            </div>
          ) : (
            <div className="space-y-4">
              {searchResults.map(soldier => renderSoldierCard(soldier))}
            </div>
          )}
        </div>
      )}

      {/* Soldier Details Modal */}
      {showSoldierDetails && selectedSoldier && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
            {/* Header */}
            <div className="p-6" style={{ background: colors.primaryGreen, color: colors.white }}>
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold">
                  Soldier Details: {selectedSoldier.fullName}
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
                  <h4 className="text-lg font-semibold text-gray-800 border-b pb-2">Basic Information</h4>
                  <div className="space-y-2 text-sm text-gray-600">
                    <div><span className="font-medium">Full Name:</span> {selectedSoldier.fullName}</div>
                    <div><span className="font-medium">Email:</span> {selectedSoldier.email}</div>
                    <div><span className="font-medium">Phone:</span> {selectedSoldier.phoneNumber}</div>
                    <div><span className="font-medium">Room:</span> {selectedSoldier.roomNumber}</div>
                    <div><span className="font-medium">Status:</span> {selectedSoldier.status === 'home' ? '🏠 Home' : '🚪 Away'}</div>
                  </div>
                </div>

                {/* Profile Info */}
                <div className="space-y-4">
                  <h4 className="text-lg font-semibold text-gray-800 border-b pb-2">Detailed Information</h4>
                  <div className="space-y-2 text-sm text-gray-600">
                    <div><span className="font-medium">ID:</span> {selectedSoldier.personalNumber}</div>
                    <div><span className="font-medium">Unit:</span> {selectedSoldier.unit}</div>
                    <div><span className="font-medium">Battalion:</span> {selectedSoldier.battalion}</div>
                    <div><span className="font-medium">Mashakit Tash:</span> {selectedSoldier.mashakitTash}</div>
                    <div><span className="font-medium">Emergency Contact:</span> {selectedSoldier.emergencyContactName}</div>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="mt-8 pt-6 border-t">
                <div className="flex justify-end gap-3">
                  <button
                    onClick={() => setShowSoldierDetails(false)}
                    className="px-6 py-3 rounded-xl font-semibold transition-all duration-200 hover:scale-105"
                    style={{ 
                      background: 'transparent', 
                      color: colors.primaryGreen,
                      border: `2px solid ${colors.primaryGreen}`,
                      boxShadow: '0 4px 12px rgba(7, 99, 50, 0.1)'
                    }}
                  >
                    Close
                  </button>
                  <button
                    onClick={() => showDeleteConfirmationDialog(selectedSoldier)}
                    disabled={processingId === selectedSoldier.id}
                    className="px-6 py-3 rounded-xl font-semibold transition-all duration-200 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{ 
                      background: colors.red, 
                      color: colors.white,
                      boxShadow: '0 4px 12px rgba(255, 82, 82, 0.3)'
                    }}
                  >
                    {processingId === selectedSoldier.id ? 'Processing...' : 'Mark as Left'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Questionnaire Editor Modal */}
      {showQuestionnaireEditor && selectedSoldier && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden">
            {/* Header */}
            <div className="p-6" style={{ background: colors.primaryGreen, color: colors.white }}>
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold">
                  Edit Soldier Profile: {selectedSoldier.fullName}
                </h3>
                <button
                  onClick={() => setShowQuestionnaireEditor(false)}
                  className="text-white hover:text-gray-200 text-2xl"
                >
                  ×
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
              <QuestionnaireEditor 
                isOpen={showQuestionnaireEditor}
                onClose={() => setShowQuestionnaireEditor(false)}
                userData={selectedSoldier}
                onUpdate={() => {
                  setShowQuestionnaireEditor(false);
                  loadSoldiers(); // Refresh the list
                }}
                isAdmin={true}
                soldierId={selectedSoldier.id}
                onMarkAsLeft={() => showDeleteConfirmationDialog(selectedSoldier)}
              />
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirmation && soldierToDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full">
            {/* Header */}
            <div className="p-6" style={{ background: colors.red, color: colors.white }}>
              <h3 className="text-xl font-bold text-center">
                Confirm Soldier Removal
              </h3>
            </div>

            {/* Content */}
            <div className="p-6 text-center">
              <div className="mb-6">
                <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: colors.red }}>
                  <span className="text-2xl">⚠️</span>
                </div>
                <h4 className="text-lg font-semibold text-gray-800 mb-2">
                  Remove {soldierToDelete.fullName}?
                </h4>
                <p className="text-gray-600 text-sm">
                  This action will:
                </p>
                <ul className="text-gray-600 text-sm mt-2 space-y-1">
                  <li>• Export their data to Google Sheets</li>
                  <li>• Archive their profile</li>
                  <li>• Remove them from active soldiers</li>
                </ul>
                <p className="text-red-600 text-sm font-medium mt-3">
                  This action cannot be undone.
                </p>
              </div>

              {/* Actions */}
              <div className="flex gap-3 justify-center">
                <button
                  onClick={cancelDelete}
                  className="px-6 py-3 rounded-xl font-semibold transition-all duration-200 hover:scale-105"
                  style={{ 
                    background: 'transparent', 
                    color: colors.primaryGreen,
                    border: `2px solid ${colors.primaryGreen}`,
                    boxShadow: '0 4px 12px rgba(7, 99, 50, 0.1)'
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleMarkAsLeft(soldierToDelete.id)}
                  disabled={processingId === soldierToDelete.id}
                  className="px-6 py-3 rounded-xl font-semibold transition-all duration-200 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ 
                    background: colors.red, 
                    color: colors.white,
                    boxShadow: '0 4px 12px rgba(255, 82, 82, 0.3)'
                  }}
                >
                  {processingId === soldierToDelete.id ? 'Processing...' : 'Remove Soldier'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}


    </div>
  );
}
