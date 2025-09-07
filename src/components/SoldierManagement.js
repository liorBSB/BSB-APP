'use client';

import { useState, useEffect } from 'react';
import { getActiveUsers, markUserAsLeft } from '@/lib/database';
import { auth, db } from '@/lib/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import SoldierSearch from './SoldierSearch';
import colors from '../app/colors';

export default function SoldierManagement() {
  const [soldiers, setSoldiers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedSoldier, setSelectedSoldier] = useState(null);
  const [showSoldierDetails, setShowSoldierDetails] = useState(false);
  const [processingId, setProcessingId] = useState(null);
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
  const [soldierToDelete, setSoldierToDelete] = useState(null);
  const [showDelayModal, setShowDelayModal] = useState(false);
  const [delayCountdown, setDelayCountdown] = useState(5);
  const [delayTimer, setDelayTimer] = useState(null);
  const [showOnlyHome, setShowOnlyHome] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [showGenderDropdown, setShowGenderDropdown] = useState(false);
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);


  useEffect(() => {
    loadSoldiers();
  }, []);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (delayTimer) {
        clearInterval(delayTimer);
      }
    };
  }, [delayTimer]);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showGenderDropdown || showStatusDropdown) {
        const target = event.target;
        const isDropdownButton = target.closest('[data-dropdown-trigger]');
        const isDropdownContent = target.closest('[data-dropdown-content]');
        
        if (!isDropdownButton && !isDropdownContent) {
          setShowGenderDropdown(false);
          setShowStatusDropdown(false);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showGenderDropdown, showStatusDropdown]);

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
    setShowSoldierDetails(true);
  };

  const handleOpenEditModal = async (soldier) => {
    try {
      setSelectedSoldier(soldier);
      
      // Helper function to format dates for input fields
      const formatDateForInput = (dateValue) => {
        if (!dateValue) return '';
        if (typeof dateValue === 'string') {
          const parsed = new Date(dateValue);
          return isNaN(parsed.getTime()) ? '' : parsed.toISOString().split('T')[0];
        }
        if (dateValue && dateValue.toDate) {
          return dateValue.toDate().toISOString().split('T')[0];
        }
        if (dateValue && dateValue.seconds) {
          return new Date(dateValue.seconds * 1000).toISOString().split('T')[0];
        }
        if (dateValue instanceof Date) {
          return dateValue.toISOString().split('T')[0];
        }
        return '';
      };

      // Helper function to format numbers
      const formatNumber = (value) => {
        if (value === null || value === undefined || value === '') return '';
        return value.toString();
      };

      setEditForm({
        // Basic info
        fullName: soldier.fullName || '',
        email: soldier.email || '',
        phoneNumber: soldier.phoneNumber || soldier.phone || '',
        roomNumber: soldier.roomNumber || '',
        roomType: soldier.roomType || '',
        roomStatus: soldier.roomStatus || '',
        serviceMonths: formatNumber(soldier.serviceMonths),
        serviceRange: soldier.serviceRange || '',
        monthsUntilRelease: formatNumber(soldier.monthsUntilRelease),
        age: formatNumber(soldier.age),
        calculatedReleaseDate: formatDateForInput(soldier.calculatedReleaseDate),
        
        // Personal info
        gender: soldier.gender || '',
        dateOfBirth: formatDateForInput(soldier.dateOfBirth),
        idNumber: soldier.idNumber || '',
        idType: soldier.idType || '',
        countryOfOrigin: soldier.countryOfOrigin || '',
        arrivalDate: formatDateForInput(soldier.arrivalDate),
        previousAddress: soldier.previousAddress || '',
        education: soldier.education || '',
        license: soldier.license || '',
        
        // Family info
        familyInIsrael: Boolean(soldier.familyInIsrael),
        fatherName: soldier.fatherName || '',
        fatherPhone: soldier.fatherPhone || '',
        motherName: soldier.motherName || '',
        motherPhone: soldier.motherPhone || '',
        parentsStatus: soldier.parentsStatus || '',
        parentsAddress: soldier.parentsAddress || '',
        parentsEmail: soldier.parentsEmail || '',
        contactWithParents: soldier.contactWithParents || '',
        
        // Emergency contact
        emergencyContactName: soldier.emergencyContactName || '',
        emergencyContactPhone: soldier.emergencyContactPhone || '',
        emergencyContactAddress: soldier.emergencyContactAddress || '',
        emergencyContactEmail: soldier.emergencyContactEmail || '',
        
        // Military info
        personalNumber: soldier.personalNumber || '',
        enlistmentDate: formatDateForInput(soldier.enlistmentDate),
        releaseDate: formatDateForInput(soldier.releaseDate),
        unit: soldier.unit || '',
        battalion: soldier.battalion || '',
        mashakitTash: soldier.mashakitTash || '',
        mashakitPhone: soldier.mashakitPhone || '',
        officerName: soldier.officerName || '',
        officerPhone: soldier.officerPhone || '',
        disciplinaryRecord: soldier.disciplinaryRecord || '',
        
        // Medical info
        healthFund: soldier.healthFund || '',
        medicalProblems: soldier.medicalProblems || '',
        allergies: soldier.allergies || '',
        hospitalizations: soldier.hospitalizations || '',
        psychiatricTreatment: soldier.psychiatricTreatment || '',
        regularMedication: soldier.regularMedication || '',
        
        // Additional info
        notes: soldier.notes || '',
        contractDate: formatDateForInput(soldier.contractDate),
        
        // Check-in and status info
        checkInDate: formatDateForInput(soldier.checkInDate || soldier.createdAt),
        status: soldier.status || 'home',
        userType: soldier.userType || 'user',
      });
      
      setShowEditModal(true);
    } catch (error) {
      console.error('Error loading soldier data for edit:', error);
      setError('Failed to load soldier data for editing');
    }
  };

  const handleEditFormChange = (field, value) => {
    setEditForm(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSaveEdit = async () => {
    if (!selectedSoldier) return;
    
    setSaving(true);
    setSuccess('');
    setError('');
    
    try {
      const userRef = doc(db, 'users', selectedSoldier.id);
      
      // Helper function to convert date strings to proper format
      const formatDateForSave = (dateString) => {
        if (!dateString || dateString.trim() === '') return null;
        const date = new Date(dateString);
        return isNaN(date.getTime()) ? null : date.toISOString();
      };

      // Helper function to convert numbers
      const formatNumberForSave = (value) => {
        if (!value || value.toString().trim() === '') return null;
        const num = Number(value);
        return isNaN(num) ? null : num;
      };

      await updateDoc(userRef, {
        // Basic info
        fullName: editForm.fullName || null,
        email: editForm.email || null,
        phoneNumber: editForm.phoneNumber || null,
        roomNumber: editForm.roomNumber || null,
        roomType: editForm.roomType || null,
        roomStatus: editForm.roomStatus || null,
        serviceMonths: formatNumberForSave(editForm.serviceMonths),
        serviceRange: editForm.serviceRange || null,
        monthsUntilRelease: formatNumberForSave(editForm.monthsUntilRelease),
        age: formatNumberForSave(editForm.age),
        calculatedReleaseDate: formatDateForSave(editForm.calculatedReleaseDate),
        
        // Personal info
        gender: editForm.gender || null,
        dateOfBirth: formatDateForSave(editForm.dateOfBirth),
        idNumber: editForm.idNumber || null,
        idType: editForm.idType || null,
        countryOfOrigin: editForm.countryOfOrigin || null,
        arrivalDate: formatDateForSave(editForm.arrivalDate),
        previousAddress: editForm.previousAddress || null,
        education: editForm.education || null,
        license: editForm.license || null,
        
        // Family info
        familyInIsrael: Boolean(editForm.familyInIsrael),
        fatherName: editForm.fatherName || null,
        fatherPhone: editForm.fatherPhone || null,
        motherName: editForm.motherName || null,
        motherPhone: editForm.motherPhone || null,
        parentsStatus: editForm.parentsStatus || null,
        parentsAddress: editForm.parentsAddress || null,
        parentsEmail: editForm.parentsEmail || null,
        contactWithParents: editForm.contactWithParents || null,
        
        // Emergency contact
        emergencyContactName: editForm.emergencyContactName || null,
        emergencyContactPhone: editForm.emergencyContactPhone || null,
        emergencyContactAddress: editForm.emergencyContactAddress || null,
        emergencyContactEmail: editForm.emergencyContactEmail || null,
        
        // Military info
        personalNumber: editForm.personalNumber || null,
        enlistmentDate: formatDateForSave(editForm.enlistmentDate),
        releaseDate: formatDateForSave(editForm.releaseDate),
        unit: editForm.unit || null,
        battalion: editForm.battalion || null,
        mashakitTash: editForm.mashakitTash || null,
        mashakitPhone: editForm.mashakitPhone || null,
        officerName: editForm.officerName || null,
        officerPhone: editForm.officerPhone || null,
        disciplinaryRecord: editForm.disciplinaryRecord || null,
        
        // Medical info
        healthFund: editForm.healthFund || null,
        medicalProblems: editForm.medicalProblems || null,
        allergies: editForm.allergies || null,
        hospitalizations: editForm.hospitalizations || null,
        psychiatricTreatment: editForm.psychiatricTreatment || null,
        regularMedication: editForm.regularMedication || null,
        
        // Additional info
        notes: editForm.notes || null,
        contractDate: formatDateForSave(editForm.contractDate),
        
        // Status info
        status: editForm.status || 'home',
        updatedAt: new Date().toISOString()
      });

      setSuccess('Soldier data updated successfully!');
      
      // Reload soldiers to reflect changes
      await loadSoldiers();
      
      // Close modal after a short delay
      setTimeout(() => {
        setShowEditModal(false);
        setShowSoldierDetails(false);
        setEditForm({});
        setSuccess('');
      }, 1500);
      
    } catch (error) {
      console.error('Error updating soldier:', error);
      setError('Failed to update soldier data. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleCancelEdit = () => {
    setShowEditModal(false);
    setEditForm({});
    setSuccess('');
    setError('');
  };

  const showDeleteConfirmationDialog = (soldier) => {
    setSoldierToDelete(soldier);
    setShowDelayModal(true);
    setDelayCountdown(5);
    
    // Start countdown timer
    const timer = setInterval(() => {
      setDelayCountdown(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    
    setDelayTimer(timer);
  };

  const cancelDelete = () => {
    setShowDelayModal(false);
    setShowDeleteConfirmation(false);
    setSoldierToDelete(null);
    setDelayCountdown(5);
    if (delayTimer) {
      clearInterval(delayTimer);
      setDelayTimer(null);
    }
  };

  const proceedToDelete = () => {
    setShowDelayModal(false);
    setShowDeleteConfirmation(true);
    if (delayTimer) {
      clearInterval(delayTimer);
      setDelayTimer(null);
    }
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



  // Helper function to get filtered soldiers
  const getFilteredSoldiers = () => {
    let filteredSoldiers;
    if (showOnlyHome) {
      filteredSoldiers = soldiers.filter(soldier => soldier.status === 'home');
    } else {
      filteredSoldiers = soldiers;
    }
    
    // Sort by room number
    return filteredSoldiers.sort((a, b) => {
      const roomA = a.roomNumber || '';
      const roomB = b.roomNumber || '';
      return roomA.localeCompare(roomB, undefined, { numeric: true, sensitivity: 'base' });
    });
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
      <div key={soldier.id} className="rounded-2xl p-3 phone-sm:p-4 mb-3 phone-sm:mb-4 shadow-sm" style={{ background: colors.sectionBg, color: colors.white }}>
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 phone-sm:w-12 phone-sm:h-12 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: colors.gold }}>
            <span className="text-lg phone-sm:text-xl" style={{ color: colors.black }}>👤</span>
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-base phone-sm:text-lg mb-1 truncate" style={{ color: colors.white }}>
                  {soldier.fullName || 'No Name'}
                </h3>
                
                <div className="text-xs phone-sm:text-sm space-y-1" style={{ color: colors.white, opacity: 0.9 }}>
                  {soldier.roomNumber && (
                    <div className="truncate">🏠 Room: {soldier.roomNumber}</div>
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
              
              <button
                onClick={() => handleEditSoldier(soldier)}
                className="px-3 py-2 rounded-xl font-semibold transition-all duration-200 hover:scale-105 text-xs phone-sm:text-sm flex-shrink-0"
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
      </div>
    );
  };

  return (
    <div className="space-y-4 p-3 phone-sm:p-4 phone-md:p-6 max-w-full overflow-hidden">
      {/* Header */}
      <div className="flex flex-col phone-sm:flex-row phone-sm:items-center phone-sm:justify-between gap-2">
        <h2 className="text-xl phone-sm:text-2xl font-bold text-gray-800">Soldier Management</h2>
        <div className="text-xs phone-sm:text-sm text-gray-600">
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
      <div className="flex flex-wrap gap-2 phone-sm:gap-3 items-center">
        {/* Home Filter Toggle */}
        <button
          onClick={() => setShowOnlyHome(!showOnlyHome)}
          className={`px-3 phone-sm:px-4 py-2 rounded-xl font-semibold transition-all duration-200 hover:scale-105 flex items-center gap-1 phone-sm:gap-2 text-sm phone-sm:text-base ${
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
          <span className="hidden phone-sm:inline">
            {showOnlyHome ? 'Show All Soldiers' : 'Show Only Home'}
          </span>
          <span className="phone-sm:hidden">
            {showOnlyHome ? 'All' : 'Home'}
          </span>
        </button>
        
        {showOnlyHome && (
          <div className="text-xs phone-sm:text-sm text-gray-600 bg-green-50 px-2 phone-sm:px-3 py-1 rounded-full border border-green-200">
            {getHomeSoldiersCount()} home
          </div>
        )}
      </div>

      {/* Search */}
      <div className="w-full phone-sm:max-w-md">
        <SoldierSearch 
          onSelectSoldier={handleSoldierSelect} 
          onSearchResults={handleSearchResults}
        />
      </div>

      {/* Soldiers List */}
      {loading ? (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <div className="text-gray-600">Loading soldiers...</div>
        </div>
      ) : (
        <div className="space-y-4 max-w-full">
          {/* Show search results if searching, otherwise show all soldiers */}
          {isSearching ? (
            <>
              {/* Search Results Header */}
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold" style={{ color: colors.white }}>Search Results ({searchResults.length})</h3>
                <button
                  onClick={() => {
                    setSearchResults([]);
                    setIsSearching(false);
                    setShowOnlyHome(false);
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
              
              {/* Search Results */}
              {searchResults.length === 0 ? (
                <div className="text-center py-8 rounded-2xl shadow-sm" style={{ background: colors.sectionBg, color: colors.white }}>
                  No soldiers found matching your search.
                </div>
              ) : (
                <div className="space-y-4 max-w-full">
                  {searchResults.map(soldier => renderSoldierCard(soldier))}
                </div>
              )}
            </>
          ) : (
            <>
              {/* All Soldiers */}
              {soldiers.length === 0 ? (
                <div className="text-center py-8 rounded-2xl shadow-sm" style={{ background: colors.sectionBg, color: colors.white }}>
                  No active soldiers found
                </div>
              ) : (
                <>
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
                  <div className="max-w-full">
                    {getFilteredSoldiers().map(soldier => renderSoldierCard(soldier))}
                  </div>
                  
                  {/* No Home Soldiers Message */}
                  {showOnlyHome && getHomeSoldiersCount() === 0 && (
                    <div className="text-center py-8 rounded-2xl shadow-sm" style={{ background: colors.sectionBg, color: colors.white }}>
                      <div className="text-2xl mb-2">🏠</div>
                      <div className="font-semibold text-lg">No soldiers are currently home</div>
                      <div className="text-sm opacity-80">All soldiers are marked as away or not present</div>
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>
      )}

      {/* Soldier Details Modal */}
      {showSoldierDetails && selectedSoldier && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 phone-sm:p-4">
          <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[85vh] phone-sm:max-h-[90vh] overflow-hidden">
            {/* Header */}
            <div className="p-4 phone-sm:p-6" style={{ background: colors.primaryGreen, color: colors.white }}>
              <div className="flex items-center justify-between">
                <h3 className="text-lg phone-sm:text-xl font-bold truncate pr-2">
                  Soldier Details: {selectedSoldier.fullName}
                </h3>
                <button
                  onClick={() => setShowSoldierDetails(false)}
                  className="text-white hover:text-gray-200 text-2xl flex-shrink-0"
                >
                  ×
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="p-4 phone-sm:p-6 overflow-y-auto max-h-[calc(85vh-120px)] phone-sm:max-h-[calc(90vh-140px)]">
              <div className="space-y-6">
                {/* Basic Info */}
                <div className="space-y-4">
                  <h4 className="text-base phone-sm:text-lg font-semibold text-gray-800 border-b pb-2">Basic Information</h4>
                  <div className="space-y-3 text-sm text-gray-600">
                    <div><span className="font-medium">Full Name:</span> {selectedSoldier.fullName}</div>
                    <div><span className="font-medium">Email:</span> {selectedSoldier.email || 'Not specified'}</div>
                    <div><span className="font-medium">Phone:</span> {selectedSoldier.phoneNumber || selectedSoldier.phone || 'Not specified'}</div>
                    <div><span className="font-medium">Room:</span> {selectedSoldier.roomNumber || 'Not specified'}</div>
                    <div><span className="font-medium">Status:</span> {selectedSoldier.status === 'home' ? '🏠 Home' : '🚪 Away'}</div>
                  </div>
                </div>

                {/* Military Info */}
                <div className="space-y-4">
                  <h4 className="text-base phone-sm:text-lg font-semibold text-gray-800 border-b pb-2">Military Information</h4>
                  <div className="space-y-3 text-sm text-gray-600">
                    <div><span className="font-medium">Personal Number:</span> {selectedSoldier.personalNumber || 'Not specified'}</div>
                    <div><span className="font-medium">Unit:</span> {selectedSoldier.unit || 'Not specified'}</div>
                    <div><span className="font-medium">Battalion:</span> {selectedSoldier.battalion || 'Not specified'}</div>
                    <div><span className="font-medium">Mashakit Tash:</span> {selectedSoldier.mashakitTash || 'Not specified'}</div>
                    <div><span className="font-medium">Officer Name:</span> {selectedSoldier.officerName || 'Not specified'}</div>
                  </div>
                </div>

                {/* Emergency Contact */}
                <div className="space-y-4">
                  <h4 className="text-base phone-sm:text-lg font-semibold text-gray-800 border-b pb-2">Emergency Contact</h4>
                  <div className="space-y-3 text-sm text-gray-600">
                    <div><span className="font-medium">Emergency Contact:</span> {selectedSoldier.emergencyContactName || 'Not specified'}</div>
                    <div><span className="font-medium">Emergency Phone:</span> {selectedSoldier.emergencyContactPhone || 'Not specified'}</div>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="mt-6 phone-sm:mt-8 pt-4 phone-sm:pt-6 border-t">
                <div className="flex flex-col gap-2 phone-sm:gap-3">
                  <button
                    onClick={() => handleOpenEditModal(selectedSoldier)}
                    className="px-4 phone-sm:px-6 py-3 rounded-xl font-semibold transition-all duration-200 hover:scale-105 text-sm phone-sm:text-base"
                    style={{ 
                      background: 'transparent', 
                      color: colors.gold,
                      border: `2px solid ${colors.gold}`,
                      boxShadow: '0 4px 12px rgba(237, 195, 129, 0.1)'
                    }}
                  >
                    ✏️ Edit Soldier
                  </button>
                  <button
                    onClick={() => setShowSoldierDetails(false)}
                    className="px-4 phone-sm:px-6 py-3 rounded-xl font-semibold transition-all duration-200 hover:scale-105 text-sm phone-sm:text-base"
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
                    className="px-4 phone-sm:px-6 py-3 rounded-xl font-semibold transition-all duration-200 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed text-sm phone-sm:text-base"
                    style={{ 
                      background: 'transparent', 
                      color: colors.red,
                      border: `2px solid ${colors.red}`,
                      boxShadow: '0 4px 12px rgba(255, 82, 82, 0.1)'
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

      {/* Edit Soldier Modal */}
      {showEditModal && selectedSoldier && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 phone-sm:p-4">
          <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[95vh] phone-sm:max-h-[90vh] overflow-hidden">
            {/* Header */}
            <div className="p-4 phone-sm:p-6" style={{ background: colors.primaryGreen, color: colors.white }}>
              <div className="flex items-center justify-between">
                <h3 className="text-lg phone-sm:text-xl font-bold truncate pr-2">
                  Edit Soldier: {selectedSoldier.fullName}
                </h3>
                <button
                  onClick={handleCancelEdit}
                  className="text-white hover:text-gray-200 text-2xl flex-shrink-0"
                >
                  ×
                </button>
              </div>
            </div>

            {/* Form Content */}
            <div className="p-4 phone-sm:p-6 overflow-y-auto max-h-[calc(95vh-120px)] phone-sm:max-h-[calc(90vh-140px)]">
              {/* Success/Error Messages */}
              {success && (
                <div className="mb-4 p-3 rounded-lg bg-green-100 text-green-800 text-center">
                  {success}
                </div>
              )}
              {error && (
                <div className="mb-4 p-3 rounded-lg bg-red-100 text-red-800 text-center">
                  {error}
                </div>
              )}

              <div className="space-y-6 phone-sm:space-y-8">
                {/* Basic Information */}
                <div className="space-y-3 phone-sm:space-y-4">
                  <h4 className="text-base phone-sm:text-lg font-semibold text-gray-800 border-b pb-2">Basic Information</h4>
                  <div className="grid grid-cols-1 phone-sm:grid-cols-2 gap-3 phone-sm:gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                      <input
                        type="text"
                        value={editForm.fullName || ''}
                        onChange={(e) => handleEditFormChange('fullName', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                      <input
                        type="email"
                        value={editForm.email || ''}
                        onChange={(e) => handleEditFormChange('email', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
                      <input
                        type="tel"
                        value={editForm.phoneNumber || ''}
                        onChange={(e) => handleEditFormChange('phoneNumber', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Gender</label>
                      <div className="relative">
                        <button
                          type="button"
                          data-dropdown-trigger
                          onClick={() => setShowGenderDropdown(!showGenderDropdown)}
                          className="w-full px-3 py-3 phone-sm:py-2 pr-8 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 text-base phone-sm:text-sm bg-white text-left flex items-center justify-between"
                        >
                          <span className={editForm.gender ? 'text-gray-900' : 'text-gray-500'}>
                            {editForm.gender === 'male' ? 'Male' : editForm.gender === 'female' ? 'Female' : 'Select Gender'}
                          </span>
                          <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                        
                        {showGenderDropdown && (
                          <div data-dropdown-content className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg">
                            <button
                              type="button"
                              onClick={() => {
                                handleEditFormChange('gender', 'male');
                                setShowGenderDropdown(false);
                              }}
                              className="w-full px-3 py-2 text-left hover:bg-gray-100 flex items-center justify-between"
                            >
                              <span>Male</span>
                              {editForm.gender === 'male' && (
                                <svg className="w-4 h-4 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                </svg>
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                handleEditFormChange('gender', 'female');
                                setShowGenderDropdown(false);
                              }}
                              className="w-full px-3 py-2 text-left hover:bg-gray-100 flex items-center justify-between"
                            >
                              <span>Female</span>
                              {editForm.gender === 'female' && (
                                <svg className="w-4 h-4 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                </svg>
                              )}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Date of Birth</label>
                      <input
                        type="date"
                        value={editForm.dateOfBirth || ''}
                        onChange={(e) => handleEditFormChange('dateOfBirth', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Age</label>
                      <input
                        type="number"
                        value={editForm.age || ''}
                        onChange={(e) => handleEditFormChange('age', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                      <div className="relative">
                        <button
                          type="button"
                          data-dropdown-trigger
                          onClick={() => setShowStatusDropdown(!showStatusDropdown)}
                          className="w-full px-3 py-3 phone-sm:py-2 pr-8 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 text-base phone-sm:text-sm bg-white text-left flex items-center justify-between"
                        >
                          <span className="text-gray-900">
                            {editForm.status === 'home' ? 'Home' : editForm.status === 'away' ? 'Away' : editForm.status === 'left' ? 'Left' : 'Home'}
                          </span>
                          <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                        
                        {showStatusDropdown && (
                          <div data-dropdown-content className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg">
                            <button
                              type="button"
                              onClick={() => {
                                handleEditFormChange('status', 'home');
                                setShowStatusDropdown(false);
                              }}
                              className="w-full px-3 py-2 text-left hover:bg-gray-100 flex items-center justify-between"
                            >
                              <span>Home</span>
                              {editForm.status === 'home' && (
                                <svg className="w-4 h-4 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                </svg>
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                handleEditFormChange('status', 'away');
                                setShowStatusDropdown(false);
                              }}
                              className="w-full px-3 py-2 text-left hover:bg-gray-100 flex items-center justify-between"
                            >
                              <span>Away</span>
                              {editForm.status === 'away' && (
                                <svg className="w-4 h-4 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                </svg>
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                handleEditFormChange('status', 'left');
                                setShowStatusDropdown(false);
                              }}
                              className="w-full px-3 py-2 text-left hover:bg-gray-100 flex items-center justify-between"
                            >
                              <span>Left</span>
                              {editForm.status === 'left' && (
                                <svg className="w-4 h-4 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                </svg>
                              )}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Check-in Date</label>
                      <input
                        type="date"
                        value={editForm.checkInDate || ''}
                        onChange={(e) => handleEditFormChange('checkInDate', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>
                </div>

                {/* Room Information */}
                <div className="space-y-3 phone-sm:space-y-4">
                  <h4 className="text-base phone-sm:text-lg font-semibold text-gray-800 border-b pb-2">Room Information</h4>
                  <div className="grid grid-cols-1 phone-sm:grid-cols-2 gap-3 phone-sm:gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Room Number</label>
                      <input
                        type="text"
                        value={editForm.roomNumber || ''}
                        onChange={(e) => handleEditFormChange('roomNumber', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Room Type</label>
                      <input
                        type="text"
                        value={editForm.roomType || ''}
                        onChange={(e) => handleEditFormChange('roomType', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Room Status</label>
                      <input
                        type="text"
                        value={editForm.roomStatus || ''}
                        onChange={(e) => handleEditFormChange('roomStatus', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>
                </div>

                {/* Military Information */}
                <div className="space-y-3 phone-sm:space-y-4">
                  <h4 className="text-base phone-sm:text-lg font-semibold text-gray-800 border-b pb-2">Military Information</h4>
                  <div className="grid grid-cols-1 phone-sm:grid-cols-2 gap-3 phone-sm:gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Personal Number</label>
                      <input
                        type="text"
                        value={editForm.personalNumber || ''}
                        onChange={(e) => handleEditFormChange('personalNumber', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Enlistment Date</label>
                      <input
                        type="date"
                        value={editForm.enlistmentDate || ''}
                        onChange={(e) => handleEditFormChange('enlistmentDate', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Release Date</label>
                      <input
                        type="date"
                        value={editForm.releaseDate || ''}
                        onChange={(e) => handleEditFormChange('releaseDate', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Unit</label>
                      <input
                        type="text"
                        value={editForm.unit || ''}
                        onChange={(e) => handleEditFormChange('unit', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Battalion</label>
                      <input
                        type="text"
                        value={editForm.battalion || ''}
                        onChange={(e) => handleEditFormChange('battalion', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Mashakit Tash</label>
                      <input
                        type="text"
                        value={editForm.mashakitTash || ''}
                        onChange={(e) => handleEditFormChange('mashakitTash', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Mashakit Phone</label>
                      <input
                        type="tel"
                        value={editForm.mashakitPhone || ''}
                        onChange={(e) => handleEditFormChange('mashakitPhone', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Officer Name</label>
                      <input
                        type="text"
                        value={editForm.officerName || ''}
                        onChange={(e) => handleEditFormChange('officerName', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Officer Phone</label>
                      <input
                        type="tel"
                        value={editForm.officerPhone || ''}
                        onChange={(e) => handleEditFormChange('officerPhone', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Disciplinary Record</label>
                      <textarea
                        value={editForm.disciplinaryRecord || ''}
                        onChange={(e) => handleEditFormChange('disciplinaryRecord', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                        rows="3"
                      />
                    </div>
                  </div>
                </div>

                {/* Emergency Contact */}
                <div className="space-y-3 phone-sm:space-y-4">
                  <h4 className="text-base phone-sm:text-lg font-semibold text-gray-800 border-b pb-2">Emergency Contact</h4>
                  <div className="grid grid-cols-1 phone-sm:grid-cols-2 gap-3 phone-sm:gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Emergency Contact Name</label>
                      <input
                        type="text"
                        value={editForm.emergencyContactName || ''}
                        onChange={(e) => handleEditFormChange('emergencyContactName', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Emergency Contact Phone</label>
                      <input
                        type="tel"
                        value={editForm.emergencyContactPhone || ''}
                        onChange={(e) => handleEditFormChange('emergencyContactPhone', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Emergency Contact Address</label>
                      <input
                        type="text"
                        value={editForm.emergencyContactAddress || ''}
                        onChange={(e) => handleEditFormChange('emergencyContactAddress', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Emergency Contact Email</label>
                      <input
                        type="email"
                        value={editForm.emergencyContactEmail || ''}
                        onChange={(e) => handleEditFormChange('emergencyContactEmail', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>
                </div>

                {/* Additional Information */}
                <div className="space-y-3 phone-sm:space-y-4">
                  <h4 className="text-base phone-sm:text-lg font-semibold text-gray-800 border-b pb-2">Additional Information</h4>
                  <div className="grid grid-cols-1 phone-sm:grid-cols-2 gap-3 phone-sm:gap-4">
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                      <textarea
                        value={editForm.notes || ''}
                        onChange={(e) => handleEditFormChange('notes', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                        rows="4"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="mt-6 phone-sm:mt-8 pt-4 phone-sm:pt-6 border-t">
                <div className="flex flex-col phone-sm:flex-row gap-2 phone-sm:gap-3 phone-sm:justify-end">
                  <button
                    onClick={handleCancelEdit}
                    className="px-4 phone-sm:px-6 py-3 rounded-xl font-semibold transition-all duration-200 hover:scale-105 text-sm phone-sm:text-base"
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
                    onClick={handleSaveEdit}
                    disabled={saving}
                    className="px-4 phone-sm:px-6 py-3 rounded-xl font-semibold transition-all duration-200 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed text-sm phone-sm:text-base"
                    style={{ 
                      background: 'transparent', 
                      color: colors.primaryGreen,
                      border: `2px solid ${colors.primaryGreen}`,
                      boxShadow: '0 4px 12px rgba(7, 99, 50, 0.1)'
                    }}
                  >
                    {saving ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delay Modal */}
      {showDelayModal && soldierToDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-3 phone-sm:p-4">
          <div className="bg-white rounded-2xl max-w-md w-full">
            {/* Header */}
            <div className="p-4 phone-sm:p-6" style={{ background: colors.red, color: colors.white }}>
              <h3 className="text-lg phone-sm:text-xl font-bold text-center">
                Confirm Soldier Removal
              </h3>
            </div>

            {/* Content */}
            <div className="p-4 phone-sm:p-6 text-center">
              <div className="mb-6">
                <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: colors.red }}>
                  <span className="text-2xl">⚠️</span>
                </div>
                <h4 className="text-lg font-semibold text-gray-800 mb-2">
                  Remove {soldierToDelete.fullName}?
                </h4>
                <p className="text-gray-600 text-sm mb-4">
                  Please wait {delayCountdown} seconds before confirming this action.
                </p>
                <div className="w-full bg-gray-200 rounded-full h-2 mb-4">
                  <div 
                    className="h-2 rounded-full transition-all duration-1000" 
                    style={{ 
                      background: colors.red,
                      width: `${((5 - delayCountdown) / 5) * 100}%`
                    }}
                  ></div>
                </div>
                <p className="text-red-600 text-sm font-medium">
                  This action cannot be undone.
                </p>
              </div>

              {/* Actions */}
              <div className="flex flex-col phone-sm:flex-row gap-2 phone-sm:gap-3 justify-center">
                <button
                  onClick={cancelDelete}
                  className="px-4 phone-sm:px-6 py-3 rounded-xl font-semibold transition-all duration-200 hover:scale-105 text-sm phone-sm:text-base"
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
                  onClick={proceedToDelete}
                  disabled={delayCountdown > 0}
                  className="px-4 phone-sm:px-6 py-3 rounded-xl font-semibold transition-all duration-200 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed text-sm phone-sm:text-base"
                  style={{ 
                    background: 'transparent', 
                    color: colors.red,
                    border: `2px solid ${colors.red}`,
                    boxShadow: '0 4px 12px rgba(255, 82, 82, 0.1)'
                  }}
                >
                  {delayCountdown > 0 ? `Wait ${delayCountdown}s` : 'Confirm Removal'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirmation && soldierToDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-3 phone-sm:p-4">
          <div className="bg-white rounded-2xl max-w-md w-full">
            {/* Header */}
            <div className="p-4 phone-sm:p-6" style={{ background: colors.red, color: colors.white }}>
              <h3 className="text-lg phone-sm:text-xl font-bold text-center">
                Confirm Soldier Removal
              </h3>
            </div>

            {/* Content */}
            <div className="p-4 phone-sm:p-6 text-center">
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
              <div className="flex flex-col phone-sm:flex-row gap-2 phone-sm:gap-3 justify-center">
                <button
                  onClick={cancelDelete}
                  className="px-4 phone-sm:px-6 py-3 rounded-xl font-semibold transition-all duration-200 hover:scale-105 text-sm phone-sm:text-base"
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
                  className="px-4 phone-sm:px-6 py-3 rounded-xl font-semibold transition-all duration-200 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed text-sm phone-sm:text-base"
                  style={{ 
                    background: 'transparent', 
                    color: colors.red,
                    border: `2px solid ${colors.red}`,
                    boxShadow: '0 4px 12px rgba(255, 82, 82, 0.1)'
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
