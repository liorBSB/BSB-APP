'use client';

import '@/i18n';
import { useState, useEffect, useRef, useMemo } from 'react';
import { adminWipeUserData, getActiveUsers, markUserAsLeft, updateUserData, getPendingDepartureRequests, dismissDepartureRequest, deleteDepartureRequest } from '@/lib/database';
import { auth, db } from '@/lib/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import SoldierSearch from './SoldierSearch';
import { SOLDIER_EDIT_ENABLED } from '@/lib/sheetFieldMap';
import { syncStatusToReceptionSheet, normalizeStatus } from '@/lib/receptionSync';
import { authedFetch } from '@/lib/authFetch';
import { mapSoldierData } from '@/lib/soldierDataService';
import colors from '../app/colors';
import { useTranslation } from 'react-i18next';
import { StyledDateInput } from '@/components/StyledDateInput';

const STATUS_OPTIONS = ['Home', 'Out', 'In base', 'Abroad'];

const STATUS_COLORS = {
  Home: 'bg-green-100 text-green-700',
  Out: 'bg-red-100 text-red-700',
  'In base': 'bg-blue-100 text-blue-700',
  Abroad: 'bg-purple-100 text-purple-700',
};

export default function SoldierManagement() {
  const { t, i18n } = useTranslation('admin');
  const STATUS_LABELS = useMemo(() => ({
    Home: t('home'),
    Out: t('away'),
    'In base': t('in_base'),
    Abroad: t('abroad'),
  }), [t, i18n.language]);
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
  const [showFamilyDropdown, setShowFamilyDropdown] = useState(false);
  const [showDeleteAccountModal, setShowDeleteAccountModal] = useState(false);
  const [soldierToDeleteAccount, setSoldierToDeleteAccount] = useState(null);
  const [deleteAccountCountdown, setDeleteAccountCountdown] = useState(5);
  const [deleteAccountDelayTimer, setDeleteAccountDelayTimer] = useState(null);
  const [showSaveConfirmation, setShowSaveConfirmation] = useState(false);
  const [departureRequests, setDepartureRequests] = useState([]);
  const [departureProcessingId, setDepartureProcessingId] = useState(null);
  const [selectedSoldierSheetEmail, setSelectedSoldierSheetEmail] = useState('');
  const isAnyModalOpen =
    showSoldierDetails ||
    showEditModal ||
    showDelayModal ||
    showDeleteAccountModal ||
    showSaveConfirmation;

  useEffect(() => {
    loadSoldiers();
    loadDepartureRequests();

    const pollInterval = setInterval(() => {
      reconcileStatusesWithSheet(soldiersRef.current);
    }, 20000);

    // Re-fetch departure requests after sync has had time to run (15s)
    // and then every 60s to pick up new ones
    const departureInitial = setTimeout(() => loadDepartureRequests(), 15000);
    const departurePoll = setInterval(() => loadDepartureRequests(), 60000);

    return () => {
      clearInterval(pollInterval);
      clearTimeout(departureInitial);
      clearInterval(departurePoll);
    };
  }, []);

  const soldiersRef = useRef([]);
  useEffect(() => { soldiersRef.current = soldiers; }, [soldiers]);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (delayTimer) {
        clearInterval(delayTimer);
      }
    };
  }, [delayTimer]);

  useEffect(() => {
    return () => {
      if (deleteAccountDelayTimer) {
        clearInterval(deleteAccountDelayTimer);
      }
    };
  }, [deleteAccountDelayTimer]);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showGenderDropdown || showStatusDropdown || showFamilyDropdown) {
        const target = event.target;
        const isDropdownButton = target.closest('[data-dropdown-trigger]');
        const isDropdownContent = target.closest('[data-dropdown-content]');
        
        if (!isDropdownButton && !isDropdownContent) {
          setShowGenderDropdown(false);
          setShowStatusDropdown(false);
          setShowFamilyDropdown(false);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showGenderDropdown, showStatusDropdown, showFamilyDropdown]);

  useEffect(() => {
    if (!isAnyModalOpen) return undefined;

    const previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousBodyOverflow;
    };
  }, [isAnyModalOpen]);

  const loadSoldiers = async () => {
    try {
      setLoading(true);
      
      const activeSoldiers = await getActiveUsers();
      let soldierList;
      
      if (activeSoldiers.length === 0) {
        const { collection, getDocs, query, orderBy, where } = await import('firebase/firestore');
        const { db } = await import('@/lib/firebase');
        
        const allUsersQuery = query(collection(db, 'users'), where('userType', '==', 'user'), orderBy('fullName'));
        const allUsersSnap = await getDocs(allUsersQuery);
        soldierList = allUsersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      } else {
        soldierList = activeSoldiers;
      }

      setSoldiers(soldierList);

      reconcileStatusesWithSheet(soldierList);
    } catch {
      // Failed to load soldiers
    } finally {
      setLoading(false);
    }
  };

  const reconcileStatusesWithSheet = async (soldierList) => {
    try {
      const res = await authedFetch('/api/reception/all');
      if (!res.ok) return;
      const payload = await res.json();
      const sheetData = payload.rows || [];

      const sheetByRoom = {};
      for (const row of sheetData) {
        if (row.room && row.status && row.status !== 'Empty') {
          sheetByRoom[String(row.room).trim()] = row.status;
        }
      }

      const updates = [];
      for (const soldier of soldierList) {
        if (!soldier.roomNumber) continue;
        const roomKey = String(soldier.roomNumber).trim();
        const sheetStatus = sheetByRoom[roomKey];
        if (sheetStatus && sheetStatus !== normalizeStatus(soldier.status)) {
          updates.push({ ...soldier, status: sheetStatus });
          updateUserData(soldier.id, { status: sheetStatus }, false).catch(() => {});
        }
      }

      if (updates.length > 0) {
        setSoldiers(prev => prev.map(s => {
          const upd = updates.find(u => u.id === s.id);
          return upd ? { ...s, status: upd.status } : s;
        }));
      }
    } catch {
      // Best-effort reconciliation
    }
  };

  const loadDepartureRequests = async () => {
    try {
      const requests = await getPendingDepartureRequests();
      setDepartureRequests(requests);
    } catch {
      // Best-effort load
    }
  };

  const handleDepartureMarkAsLeft = async (request) => {
    if (!auth.currentUser) return;
    setDepartureProcessingId(request.id);
    try {
      await markUserAsLeft(request.userId, auth.currentUser.uid);
      await deleteDepartureRequest(request.id);
      setDepartureRequests(prev => prev.filter(r => r.id !== request.id));
      setSoldiers(prev => prev.filter(s => s.id !== request.userId));
      setSearchResults(prev => prev.filter(s => s.id !== request.userId));
      alert(t('soldier_marked_left_archived', { name: request.soldierName }));
    } catch (err) {
      console.error('Error marking departed soldier as left:', err);
      alert(t('soldier_mark_left_error'));
    } finally {
      setDepartureProcessingId(null);
    }
  };

  const handleDepartureDismiss = async (request) => {
    setDepartureProcessingId(request.id);
    try {
      await dismissDepartureRequest(request.id);
      setDepartureRequests(prev => prev.filter(r => r.id !== request.id));
    } catch (err) {
      console.error('Error dismissing departure request:', err);
      alert(t('soldier_dismiss_request_error'));
    } finally {
      setDepartureProcessingId(null);
    }
  };

  const handleSoldierSelect = async (soldier) => {
    setSelectedSoldier(soldier);
    await loadSoldierSheetEmail(soldier);
    setShowSoldierDetails(true);
  };

  const handleEditSoldier = (soldier) => {
    setSelectedSoldier(soldier);
    loadSoldierSheetEmail(soldier);
    setShowSoldierDetails(true);
  };

  const loadSoldierSheetEmail = async (soldier) => {
    setSelectedSoldierSheetEmail('');
    const searchTerm = (soldier?.fullName || '').trim();
    if (!searchTerm) return;

    try {
      const response = await authedFetch('/api/soldiers/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ searchTerm }),
      });
      if (!response.ok) return;

      const payload = await response.json();
      const candidates = Array.isArray(payload?.soldiers) ? payload.soldiers : [];

      const targetId = String(soldier?.idNumber || '').trim();
      const targetRoom = String(soldier?.roomNumber || '').trim();
      const targetName = String(soldier?.fullName || '').trim();

      const mappedCandidates = candidates
        .map((candidate) => mapSoldierData(candidate?.raw || candidate))
        .filter(Boolean);

      const matched =
        mappedCandidates.find((item) => String(item.idNumber || '').trim() === targetId) ||
        mappedCandidates.find((item) =>
          String(item.fullName || '').trim() === targetName &&
          String(item.roomNumber || '').trim() === targetRoom
        );

      const sheetEmail = String(matched?.email || '').trim();
      if (sheetEmail) {
        setSelectedSoldierSheetEmail(sheetEmail);
      }
    } catch {
      // Best effort: keep fallback to Firestore email when sheet fetch fails.
    }
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
        phone: soldier.phone || '',
        roomNumber: soldier.roomNumber || '',
        age: formatNumber(soldier.age),
        
        // Personal info
        gender: soldier.gender || '',
        dateOfBirth: formatDateForInput(soldier.dateOfBirth),
        
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
        
        // Health & welfare
        healthFund: soldier.healthFund || '',

        // Housing
        contractDate: formatDateForInput(soldier.contractDate),
        
        // Check-in and status info
        checkInDate: formatDateForInput(soldier.checkInDate || soldier.createdAt),
        status: soldier.status || 'Home',
        userType: soldier.userType || 'user',
      });
      
      setShowEditModal(true);
    } catch (error) {
      console.error('Error loading soldier data for edit:', error);
      setError(t('soldier_edit_load_error'));
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

      // Use updateUserData instead of direct updateDoc to trigger sync
      await updateUserData(selectedSoldier.id, {
        // Basic info
        fullName: editForm.fullName || null,
        email: editForm.email || null,
        phone: editForm.phone || null,
        roomNumber: editForm.roomNumber || null,
        age: formatNumberForSave(editForm.age),
        
        // Personal info
        gender: editForm.gender || null,
        dateOfBirth: formatDateForSave(editForm.dateOfBirth),
        
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
        
        // Health & welfare
        healthFund: editForm.healthFund || null,

        // Housing
        contractDate: formatDateForSave(editForm.contractDate),
        
        // Status info
        status: editForm.status || 'Home',
        updatedAt: new Date().toISOString()
      });

      syncStatusToReceptionSheet(editForm.roomNumber, editForm.status || 'Home').catch(() => {});

      setSuccess(t('soldier_updated'));
      await loadSoldiers();

      setTimeout(() => {
        setShowEditModal(false);
        setShowSoldierDetails(false);
        setEditForm({});
      }, 1500);
      
    } catch (error) {
      console.error('Error updating soldier:', error);
      setError(t('soldier_update_failed'));
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
    if (delayTimer) {
      clearInterval(delayTimer);
      setDelayTimer(null);
    }
    if (soldierToDelete) {
      handleMarkAsLeft(soldierToDelete.id);
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
      
      setShowDelayModal(false);
      setShowDeleteConfirmation(false);
      setSoldierToDelete(null);
      
      alert(t('soldier_archived_ok', { name: soldierToDelete?.fullName || t('unknown_soldier') }));
      
    } catch (error) {
      console.error('Error marking soldier as left:', error);
      alert(t('soldier_archived_error'));
    } finally {
      setProcessingId(null);
    }
  };

  const openDeleteAccountModal = (soldier) => {
    if (deleteAccountDelayTimer) {
      clearInterval(deleteAccountDelayTimer);
      setDeleteAccountDelayTimer(null);
    }
    setSoldierToDeleteAccount(soldier);
    setShowDeleteAccountModal(true);
    setDeleteAccountCountdown(5);
    const timer = setInterval(() => {
      setDeleteAccountCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    setDeleteAccountDelayTimer(timer);
  };

  const cancelDeleteAccountModal = () => {
    setShowDeleteAccountModal(false);
    setSoldierToDeleteAccount(null);
    setDeleteAccountCountdown(5);
    if (deleteAccountDelayTimer) {
      clearInterval(deleteAccountDelayTimer);
      setDeleteAccountDelayTimer(null);
    }
  };

  const handleDeleteAccount = async (soldierId) => {
    if (!auth.currentUser) return;

    try {
      setProcessingId(soldierId);
      await adminWipeUserData(soldierId);

      setSoldiers(prev => prev.filter(s => s.id !== soldierId));
      setSearchResults(prev => prev.filter(s => s.id !== soldierId));

      if (selectedSoldier?.id === soldierId) {
        setShowSoldierDetails(false);
        setSelectedSoldier(null);
      }

      if (deleteAccountDelayTimer) {
        clearInterval(deleteAccountDelayTimer);
        setDeleteAccountDelayTimer(null);
      }
      setShowDeleteAccountModal(false);
      setSoldierToDeleteAccount(null);
      setDeleteAccountCountdown(5);

      alert(t('soldier_account_deleted_ok', { name: soldierToDeleteAccount?.fullName || t('unknown_soldier') }));

    } catch (error) {
      console.error('Error deleting soldier account:', error);
      alert(t('soldier_delete_account_error'));
    } finally {
      setProcessingId(null);
    }
  };

  // Helper function to get filtered soldiers
  const getFilteredSoldiers = () => {
    let filteredSoldiers;
    if (showOnlyHome) {
      filteredSoldiers = soldiers.filter(soldier => normalizeStatus(soldier.status) === 'Home');
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
    return soldiers.filter(soldier => normalizeStatus(soldier.status) === 'Home').length;
  };



  const handleSearchResults = (results) => {
    setSearchResults(results);
    setIsSearching(results.length > 0);
    
    // Reset home filter when searching
    if (results.length > 0) {
      setShowOnlyHome(false);
    }
  };

  const handleInlineStatusChange = async (soldier, newStatus) => {
    try {
      await updateUserData(soldier.id, { status: newStatus }, false);
      syncStatusToReceptionSheet(soldier.roomNumber, newStatus).catch(() => {});
      setSoldiers(prev => prev.map(s => s.id === soldier.id ? { ...s, status: newStatus } : s));
      setSearchResults(prev => prev.map(s => s.id === soldier.id ? { ...s, status: newStatus } : s));
    } catch (err) {
      console.error('Failed to update status:', err);
    }
  };

  const renderSoldierCard = (soldier, showMarkAsLeft = false) => {
    const isProcessing = processingId === soldier.id;
    const currentStatus = normalizeStatus(soldier.status);
    const colorClass = STATUS_COLORS[currentStatus] || 'bg-gray-100 text-gray-700';
    
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
                  {soldier.fullName || t('no_name')}
                </h3>
                
                <div className="text-xs phone-sm:text-sm" style={{ color: colors.white, opacity: 0.9 }}>
                  {soldier.roomNumber && (
                    <div className="truncate mb-1">🏠 {t('room_line', { room: soldier.roomNumber })}</div>
                  )}
                </div>
              </div>
              
              <div className="flex items-center gap-2 flex-shrink-0">
                {isAnyModalOpen ? (
                  <span className={`px-2 py-1.5 rounded-full text-xs font-semibold ${colorClass}`}>
                    {STATUS_LABELS[currentStatus] || currentStatus}
                  </span>
                ) : (
                  <select
                    value={currentStatus}
                    onChange={(e) => handleInlineStatusChange(soldier, e.target.value)}
                    className={`px-2 py-1.5 rounded-full text-xs font-semibold cursor-pointer border-0 focus:outline-none focus:ring-2 focus:ring-white/50 ${colorClass}`}
                  >
                    {STATUS_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>{STATUS_LABELS[opt]}</option>
                    ))}
                  </select>
                )}

                <button
                  onClick={() => handleEditSoldier(soldier)}
                  className="px-3 py-2 rounded-xl font-semibold transition-all duration-200 hover:scale-105 text-xs phone-sm:text-sm"
                  style={{ 
                    background: 'transparent', 
                    color: colors.white,
                    border: `2px solid ${colors.white}`,
                    boxShadow: '0 4px 12px rgba(255, 255, 255, 0.1)'
                  }}
                  title={SOLDIER_EDIT_ENABLED ? t('edit_soldier_edit') : t('edit_soldier_view')}
                >
                  {SOLDIER_EDIT_ENABLED ? t('edit') : t('view_short')}
                </button>
              </div>
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
        <h2 className="text-xl phone-sm:text-2xl font-bold text-gray-800">{t('soldier_management')}</h2>
        <div className="text-xs phone-sm:text-sm text-gray-600">
          {showOnlyHome ? (
            <span>{t('home_filter_home_total_line', { home: getHomeSoldiersCount(), total: soldiers.length })}</span>
          ) : (
            t('total_soldiers_count', { count: soldiers.length })
          )}
        </div>
      </div>

      {/* Departure Requests */}
      {departureRequests.map(req => {
        const isProcessing = departureProcessingId === req.id;
        const detected = req.detectedAt?.toDate?.()
          ? req.detectedAt.toDate().toLocaleDateString()
          : '';
        return (
          <div key={req.id} className="rounded-2xl p-3 phone-sm:p-4 shadow-sm" style={{ background: colors.sectionBg, border: `1px solid ${colors.red}` }}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 phone-sm:w-12 phone-sm:h-12 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: colors.red }}>
                <span className="text-lg phone-sm:text-xl font-bold" style={{ color: colors.white }}>!</span>
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-base phone-sm:text-lg truncate" style={{ color: colors.white }}>
                  {req.soldierName || t('unknown_name')}
                </h3>
                <div className="text-xs phone-sm:text-sm" style={{ color: colors.white, opacity: 0.7 }}>
                  {req.roomNumber && <span>{t('response_room_badge', { room: req.roomNumber })}</span>}
                  {req.roomNumber && detected && <span> · </span>}
                  {detected && <span>{t('detected_on', { date: detected })}</span>}
                </div>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <button
                  onClick={() => handleDepartureMarkAsLeft(req)}
                  disabled={isProcessing}
                  className="px-3 py-1.5 rounded-lg text-xs phone-sm:text-sm font-semibold transition-all disabled:opacity-50"
                  style={{ background: colors.red, color: 'white' }}
                >
                  {isProcessing ? t('processing_short') : t('mark_as_left')}
                </button>
                <button
                  onClick={() => handleDepartureDismiss(req)}
                  disabled={isProcessing}
                  className="px-3 py-1.5 rounded-lg text-xs phone-sm:text-sm font-semibold transition-all disabled:opacity-50"
                  style={{ border: `1px solid ${colors.white}`, color: colors.white, background: 'transparent' }}
                >
                  {isProcessing ? t('processing_short') : t('dismiss_30_days')}
                </button>
              </div>
            </div>
          </div>
        );
      })}

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
            {showOnlyHome ? t('show_all_soldiers') : t('show_only_home')}
          </span>
          <span className="phone-sm:hidden">
            {showOnlyHome ? t('filter_short_all') : t('filter_short_home')}
          </span>
        </button>
        
        {showOnlyHome && (
          <div className="text-xs phone-sm:text-sm text-gray-600 bg-green-50 px-2 phone-sm:px-3 py-1 rounded-full border border-green-200">
            {t('home_count_badge', { count: getHomeSoldiersCount() })}
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
          <div className="text-gray-600">{t('loading_soldiers')}</div>
        </div>
      ) : (
        <div className="space-y-4 max-w-full">
          {/* Show search results if searching, otherwise show all soldiers */}
          {isSearching ? (
            <>
              {/* Search Results Header */}
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold" style={{ color: colors.white }}>{t('search_results_title', { count: searchResults.length })}</h3>
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
                  {t('clear_search')}
                </button>
              </div>
              
              {/* Search Results */}
              {searchResults.length === 0 ? (
                <div className="text-center py-8 rounded-2xl shadow-sm" style={{ background: colors.sectionBg, color: colors.white }}>
                  {t('no_soldiers_match_search')}
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
                  {t('no_active_soldiers')}
                </div>
              ) : (
                <>
                  {/* Filter Info */}
                  {showOnlyHome && (
                    <div className="text-center py-3 rounded-xl shadow-sm" style={{ background: colors.gold, color: colors.black }}>
                      <div className="font-semibold text-lg">🏠 {t('banner_only_home_title')}</div>
                      <div className="text-sm opacity-80">
                        {t('banner_home_of_total', { home: getHomeSoldiersCount(), total: soldiers.length })}
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
                      <div className="font-semibold text-lg">{t('no_soldiers_home_title')}</div>
                      <div className="text-sm opacity-80">{t('no_soldiers_home_desc')}</div>
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[90] p-2 phone-sm:p-4">
          <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[85vh] phone-sm:max-h-[90vh] overflow-hidden">
            {/* Header */}
            <div className="p-4 phone-sm:p-6" style={{ background: colors.primaryGreen, color: colors.white }}>
              <div className="flex items-center justify-between">
                <h3 className="text-lg phone-sm:text-xl font-bold truncate pr-2">
                  {t('soldier_details_title', { name: selectedSoldier.fullName })}
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
            <div className="p-4 phone-sm:p-6 overflow-y-auto max-h-[calc(85vh-120px)] phone-sm:max-h-[calc(90vh-140px)] [overscroll-behavior:contain] [-webkit-overflow-scrolling:touch]">
              <div className="space-y-6">
                {/* Photo */}
                <div className="flex justify-center">
                  {(() => {
                    const soldierPhotoUrl = selectedSoldier.profilePhotoUrl || selectedSoldier.photoURL || '';
                    if (!soldierPhotoUrl) {
                      return (
                        <div
                          className="w-32 h-32 phone-sm:w-36 phone-sm:h-36 rounded-2xl flex items-center justify-center shadow-sm"
                          style={{ border: `2px solid ${colors.gold}`, background: '#f3f4f6' }}
                        >
                          <span className="text-4xl">📷</span>
                        </div>
                      );
                    }

                    return (
                      <div
                        className="w-32 h-32 phone-sm:w-36 phone-sm:h-36 rounded-2xl overflow-hidden shadow-sm"
                        style={{ border: `2px solid ${colors.gold}` }}
                      >
                        <img
                          src={soldierPhotoUrl}
                          alt="Soldier photo"
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                          }}
                        />
                      </div>
                    );
                  })()}
                </div>

                {/* Basic Info */}
                <div className="space-y-4">
                  <h4 className="text-base phone-sm:text-lg font-semibold text-gray-800 border-b pb-2">Basic Information</h4>
                  <div className="space-y-3 text-sm text-gray-600">
                    <div><span className="font-medium">Full Name:</span> {selectedSoldier.fullName}</div>
                    <div><span className="font-medium">Email:</span> {selectedSoldierSheetEmail || selectedSoldier.email || 'Not specified'}</div>
                    <div><span className="font-medium">Phone:</span> {selectedSoldier.phone || 'Not specified'}</div>
                    <div><span className="font-medium">Room:</span> {selectedSoldier.roomNumber || 'Not specified'}</div>
                  </div>
                </div>

                {/* Military Info */}
                <div className="space-y-4">
                  <h4 className="text-base phone-sm:text-lg font-semibold text-gray-800 border-b pb-2">Military Section</h4>
                  <div className="space-y-3 text-sm text-gray-600">
                    <div><span className="font-medium">Personal Number:</span> {selectedSoldier.personalNumber || 'Not specified'}</div>
                    <div><span className="font-medium">Unit:</span> {selectedSoldier.unit || 'Not specified'}</div>
                    <div><span className="font-medium">Battalion:</span> {selectedSoldier.battalion || 'Not specified'}</div>
                    <div><span className="font-medium">Mashakit Tash Name:</span> {selectedSoldier.mashakitTash || 'Not specified'}</div>
                    <div><span className="font-medium">Mashakit Tash Number:</span> {selectedSoldier.mashakitPhone || 'Not specified'}</div>
                    <div><span className="font-medium">Officer Name:</span> {selectedSoldier.officerName || 'Not specified'}</div>
                    <div><span className="font-medium">Officer Number:</span> {selectedSoldier.officerPhone || 'Not specified'}</div>
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
                  {SOLDIER_EDIT_ENABLED && (
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
                      ✏️ {t('edit_soldier')}
                    </button>
                  )}
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
                    {t('close')}
                  </button>
                  <button
                    onClick={() => openDeleteAccountModal(selectedSoldier)}
                    disabled={processingId === selectedSoldier.id}
                    className="px-4 phone-sm:px-6 py-3 rounded-xl font-semibold transition-all duration-200 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed text-sm phone-sm:text-base"
                    style={{ 
                      background: 'transparent', 
                      color: '#dc2626',
                      border: '2px solid #dc2626',
                      boxShadow: '0 4px 12px rgba(220, 38, 38, 0.1)'
                    }}
                  >
                    🗑️ {t('admin_delete_account')}
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
                    {processingId === selectedSoldier.id ? t('processing') : t('mark_as_left')}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Soldier Modal */}
      {SOLDIER_EDIT_ENABLED && showEditModal && selectedSoldier && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[100] p-2 phone-sm:p-4">
          <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[95vh] phone-sm:max-h-[90vh] overflow-hidden">
            {/* Header */}
            <div className="p-4 phone-sm:p-6" style={{ background: colors.primaryGreen, color: colors.white }}>
              <div className="flex items-center justify-between">
                <h3 className="text-lg phone-sm:text-xl font-bold truncate pr-2">
                  {t('edit_soldier_modal_title', { name: selectedSoldier.fullName })}
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
            <div className="p-4 phone-sm:p-6 overflow-y-auto max-h-[calc(95vh-120px)] phone-sm:max-h-[calc(90vh-140px)] [overscroll-behavior:contain] [-webkit-overflow-scrolling:touch]">
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
                        value={editForm.phone || ''}
                        onChange={(e) => handleEditFormChange('phone', e.target.value)}
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
                      <StyledDateInput
                        value={editForm.dateOfBirth || ''}
                        onChange={(e) => handleEditFormChange('dateOfBirth', e.target.value)}
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
                      <select
                        value={editForm.status || 'Home'}
                        onChange={(e) => handleEditFormChange('status', e.target.value)}
                        className="w-full px-3 py-3 phone-sm:py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 text-base phone-sm:text-sm bg-white"
                      >
                        {STATUS_OPTIONS.map((opt) => (
                          <option key={opt} value={opt}>{STATUS_LABELS[opt]}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Check-in Date</label>
                      <StyledDateInput
                        value={editForm.checkInDate || ''}
                        onChange={(e) => handleEditFormChange('checkInDate', e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                {/* Family Information */}
                <div className="space-y-3 phone-sm:space-y-4">
                  <h4 className="text-base phone-sm:text-lg font-semibold text-gray-800 border-b pb-2">Family Information</h4>
                  <div className="grid grid-cols-1 phone-sm:grid-cols-2 gap-3 phone-sm:gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Family in Israel</label>
                      <div className="relative">
                        <button
                          type="button"
                          data-dropdown-trigger
                          onClick={() => setShowFamilyDropdown(!showFamilyDropdown)}
                          className="w-full px-3 py-3 phone-sm:py-2 pr-8 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 text-base phone-sm:text-sm bg-white text-left flex items-center justify-between"
                        >
                          <span className={editForm.familyInIsrael !== undefined ? 'text-gray-900' : 'text-gray-500'}>
                            {editForm.familyInIsrael === true ? 'Yes' : editForm.familyInIsrael === false ? 'No' : 'Select Family Status'}
                          </span>
                          <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                        
                        {showFamilyDropdown && (
                          <div data-dropdown-content className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg">
                            <button
                              type="button"
                              onClick={() => {
                                handleEditFormChange('familyInIsrael', true);
                                setShowFamilyDropdown(false);
                              }}
                              className="w-full px-3 py-2 text-left hover:bg-gray-100 flex items-center justify-between"
                            >
                              <span>Yes</span>
                              {editForm.familyInIsrael === true && (
                                <svg className="w-4 h-4 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                </svg>
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                handleEditFormChange('familyInIsrael', false);
                                setShowFamilyDropdown(false);
                              }}
                              className="w-full px-3 py-2 text-left hover:bg-gray-100 flex items-center justify-between"
                            >
                              <span>No</span>
                              {editForm.familyInIsrael === false && (
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
                      <label className="block text-sm font-medium text-gray-700 mb-1">Father Name</label>
                      <input
                        type="text"
                        value={editForm.fatherName || ''}
                        onChange={(e) => handleEditFormChange('fatherName', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Father Phone</label>
                      <input
                        type="tel"
                        value={editForm.fatherPhone || ''}
                        onChange={(e) => handleEditFormChange('fatherPhone', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Mother Name</label>
                      <input
                        type="text"
                        value={editForm.motherName || ''}
                        onChange={(e) => handleEditFormChange('motherName', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Mother Phone</label>
                      <input
                        type="tel"
                        value={editForm.motherPhone || ''}
                        onChange={(e) => handleEditFormChange('motherPhone', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Parents Status</label>
                      <input
                        type="text"
                        value={editForm.parentsStatus || ''}
                        onChange={(e) => handleEditFormChange('parentsStatus', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Parents Address</label>
                      <input
                        type="text"
                        value={editForm.parentsAddress || ''}
                        onChange={(e) => handleEditFormChange('parentsAddress', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Parents Email</label>
                      <input
                        type="email"
                        value={editForm.parentsEmail || ''}
                        onChange={(e) => handleEditFormChange('parentsEmail', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Contact with Parents</label>
                      <input
                        type="text"
                        value={editForm.contactWithParents || ''}
                        onChange={(e) => handleEditFormChange('contactWithParents', e.target.value)}
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
                      <StyledDateInput
                        value={editForm.enlistmentDate || ''}
                        onChange={(e) => handleEditFormChange('enlistmentDate', e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Release Date</label>
                      <StyledDateInput
                        value={editForm.releaseDate || ''}
                        onChange={(e) => handleEditFormChange('releaseDate', e.target.value)}
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
                    {t('cancel')}
                  </button>
                  <button
                    onClick={() => setShowSaveConfirmation(true)}
                    disabled={saving}
                    className="px-4 phone-sm:px-6 py-3 rounded-xl font-semibold transition-all duration-200 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed text-sm phone-sm:text-base"
                    style={{ 
                      background: 'transparent', 
                      color: colors.primaryGreen,
                      border: `2px solid ${colors.primaryGreen}`,
                      boxShadow: '0 4px 12px rgba(7, 99, 50, 0.1)'
                    }}
                  >
                    {t('save_changes')}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delay Modal */}
      {showDelayModal && soldierToDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[100] p-3 phone-sm:p-4">
          <div className="bg-white rounded-2xl max-w-md w-full">
            {/* Header */}
            <div className="p-4 phone-sm:p-6" style={{ background: colors.red, color: colors.white }}>
              <h3 className="text-lg phone-sm:text-xl font-bold text-center">
                {t('soldier_remove_modal_title')}
              </h3>
            </div>

            {/* Content */}
            <div className="p-4 phone-sm:p-6 text-center">
              <div className="mb-6">
                <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: colors.red }}>
                  <span className="text-2xl">⚠️</span>
                </div>
                <h4 className="text-lg font-semibold text-gray-800 mb-2">
                  {t('soldier_remove_confirm', { name: soldierToDelete.fullName })}
                </h4>
                <p className="text-gray-600 text-sm mb-4">
                  {t('soldier_delete_account_wait', { seconds: delayCountdown })}
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
                  {t('soldier_delete_account_irreversible')}
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
                  {t('cancel')}
                </button>
                <button
                  onClick={proceedToDelete}
                  disabled={delayCountdown > 0 || processingId === soldierToDelete.id}
                  className="px-4 phone-sm:px-6 py-3 rounded-xl font-semibold transition-all duration-200 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed text-sm phone-sm:text-base"
                  style={{ 
                    background: 'transparent', 
                    color: colors.red,
                    border: `2px solid ${colors.red}`,
                    boxShadow: '0 4px 12px rgba(255, 82, 82, 0.1)'
                  }}
                >
                  {processingId === soldierToDelete.id ? t('processing') : delayCountdown > 0 ? t('soldier_delete_account_wait_seconds', { count: delayCountdown }) : t('remove_soldier')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}


      {/* Delete Account Confirmation Modal */}
      {showDeleteAccountModal && soldierToDeleteAccount && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[100] p-3 phone-sm:p-4">
          <div className="bg-white rounded-2xl max-w-md w-full">
            <div className="p-4 phone-sm:p-6" style={{ background: '#dc2626', color: 'white' }}>
              <h3 className="text-lg phone-sm:text-xl font-bold text-center">
                {t('soldier_delete_account_modal_title')}
              </h3>
            </div>

            <div className="p-4 phone-sm:p-6">
              <div className="mb-6">
                <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: '#fee2e2' }}>
                  <span className="text-2xl">🗑️</span>
                </div>
                <h4 className="text-lg font-semibold text-gray-800 mb-2 text-center">
                  {t('soldier_delete_account_confirm', { name: soldierToDeleteAccount.fullName })}
                </h4>
                <p className="text-gray-600 text-sm text-center mb-3">
                  {t('soldier_delete_account_intro')}
                </p>
                <p className="text-gray-600 text-sm text-center mb-4">
                  {t('soldier_delete_account_wait', { seconds: deleteAccountCountdown })}
                </p>
                <div className="w-full bg-gray-200 rounded-full h-2 mb-4">
                  <div
                    className="h-2 rounded-full transition-all duration-1000"
                    style={{
                      background: colors.red,
                      width: `${((5 - deleteAccountCountdown) / 5) * 100}%`,
                    }}
                  />
                </div>
                <p className="text-red-500 text-xs text-center font-medium">
                  {t('soldier_delete_account_irreversible')}
                </p>
              </div>

              <div className="flex flex-col phone-sm:flex-row gap-2 phone-sm:gap-3 justify-center">
                <button
                  onClick={cancelDeleteAccountModal}
                  className="px-4 phone-sm:px-6 py-3 rounded-xl font-semibold transition-all duration-200 hover:scale-105 text-sm phone-sm:text-base"
                  style={{
                    background: 'transparent',
                    color: colors.primaryGreen,
                    border: `2px solid ${colors.primaryGreen}`,
                    boxShadow: '0 4px 12px rgba(7, 99, 50, 0.1)'
                  }}
                >
                  {t('cancel')}
                </button>
                <button
                  onClick={() => handleDeleteAccount(soldierToDeleteAccount.id)}
                  disabled={
                    deleteAccountCountdown > 0 || processingId === soldierToDeleteAccount.id
                  }
                  className="px-4 phone-sm:px-6 py-3 rounded-xl font-semibold transition-all duration-200 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed text-sm phone-sm:text-base"
                  style={{
                    background: 'transparent',
                    color: '#dc2626',
                    border: '2px solid #dc2626',
                    boxShadow: '0 4px 12px rgba(220, 38, 38, 0.1)'
                  }}
                >
                  {processingId === soldierToDeleteAccount.id
                    ? t('soldier_delete_account_deleting')
                    : deleteAccountCountdown > 0
                      ? t('soldier_delete_account_wait_seconds', { count: deleteAccountCountdown })
                      : t('soldier_delete_account_button')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Save Confirmation Modal */}
      {SOLDIER_EDIT_ENABLED && showSaveConfirmation && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-3 phone-sm:p-4">
          <div className="bg-white rounded-2xl max-w-md w-full">
            <div className="p-4 phone-sm:p-6" style={{ background: colors.gold, color: colors.black }}>
              <h3 className="text-lg phone-sm:text-xl font-bold text-center">
                {saving ? t('saving_ellipsis') : success ? t('done_exclamation') : t('confirm_changes')}
              </h3>
            </div>

            <div className="p-4 phone-sm:p-6 text-center">
              {saving ? (
                <div className="py-8">
                  <div className="animate-spin rounded-full h-12 w-12 border-4 border-t-transparent mx-auto mb-4" style={{ borderColor: colors.primaryGreen, borderTopColor: 'transparent' }}></div>
                  <p className="text-gray-600 font-medium">{t('updating_soldier_data')}</p>
                </div>
              ) : success ? (
                <div className="py-8">
                  <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: colors.primaryGreen }}>
                    <span className="text-white text-3xl">&#10003;</span>
                  </div>
                  <p className="text-lg font-semibold" style={{ color: colors.primaryGreen }}>
                    {success}
                  </p>
                </div>
              ) : error ? (
                <div className="py-6">
                  <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: colors.red }}>
                    <span className="text-white text-3xl">&#10007;</span>
                  </div>
                  <p className="text-lg font-semibold mb-4" style={{ color: colors.red }}>
                    {error}
                  </p>
                  <button
                    onClick={() => { setShowSaveConfirmation(false); setError(''); }}
                    className="px-6 py-3 rounded-xl font-semibold"
                    style={{ background: colors.primaryGreen, color: 'white' }}
                  >
                    {t('close')}
                  </button>
                </div>
              ) : (
                <>
                  <div className="mb-6">
                    <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: colors.gold }}>
                      <span className="text-2xl">&#9998;</span>
                    </div>
                    <p className="text-gray-800 font-semibold text-lg mb-2">
                      {t('save_changes_confirm')}
                    </p>
                    <p className="text-gray-500 text-sm">
                      {t('save_changes_subtitle', { name: selectedSoldier?.fullName || t('unknown_soldier') })}
                    </p>
                  </div>
                  <div className="flex flex-col phone-sm:flex-row gap-2 phone-sm:gap-3 justify-center">
                    <button
                      onClick={() => setShowSaveConfirmation(false)}
                      className="px-6 py-3 rounded-xl font-semibold transition-all duration-200 hover:scale-105"
                      style={{ background: 'transparent', color: colors.primaryGreen, border: `2px solid ${colors.primaryGreen}` }}
                    >
                      {t('cancel')}
                    </button>
                    <button
                      onClick={async () => {
                        await handleSaveEdit();
                        setTimeout(() => {
                          setShowSaveConfirmation(false);
                          setSuccess('');
                        }, 1500);
                      }}
                      className="px-6 py-3 rounded-xl font-semibold transition-all duration-200 hover:scale-105"
                      style={{ background: colors.primaryGreen, color: 'white' }}
                    >
                      {t('yes_save')}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
