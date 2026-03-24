"use client";

import '@/i18n';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { collection, addDoc, getDocs, query, orderBy, doc, getDoc, updateDoc, where, deleteDoc } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import { getActiveUsers, adminWipeUserData, promoteUserToAdmin } from '@/lib/database';
import { simpleScheduler } from '@/lib/simpleSyncService';
import { normalizeStatus } from '@/lib/receptionSync';
import colors from '../../colors';
import CollapsibleSection from '@/components/home/CollapsibleSection';
import ListItem from '@/components/home/ListItem';
import AdminBottomNavBar from '@/components/AdminBottomNavBar';
import { onAuthStateChanged } from 'firebase/auth';
import EditFieldModal from '@/components/EditFieldModal';
import PencilIcon from '@/components/PencilIcon';
import AddItemModal from '@/components/AddItemModal';
import { StyledDateTimeInput } from '@/components/StyledDateInput';


export default function AdminHomePage() {
  const router = useRouter();
  const { t } = useTranslation('admin');
  const [events, setEvents] = useState([]);
  const [surveys, setSurveys] = useState([]);
  const [messages, setMessages] = useState([]);
  const [approvalRequests, setApprovalRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [modalType, setModalType] = useState('');
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    dueDate: '',
    startDate: '',
  });
  const [isCheckingProfile, setIsCheckingProfile] = useState(true);
  const [adminData, setAdminData] = useState(null);
  
  // Dashboard data states
  const [soldierStats, setSoldierStats] = useState({ total: 0, home: 0 });
  const [refundRequestsCount, setRefundRequestsCount] = useState(0);
  const [pendingProblemsCount, setPendingProblemsCount] = useState(0);
  // Collapsible state for each section
  const [openEvents, setOpenEvents] = useState(false);
  const [openSurveys, setOpenSurveys] = useState(false);
  const [openMessages, setOpenMessages] = useState(false);
  const [openApprovalRequests, setOpenApprovalRequests] = useState(false);
  const [showYesModal, setShowYesModal] = useState(false);
  const [editModal, setEditModal] = useState({ open: false, type: '', item: null, form: {} });
  const [addLoading, setAddLoading] = useState(false);
  const [processingApproval, setProcessingApproval] = useState(false);
  const [responseListModal, setResponseListModal] = useState({ open: false, event: null });

  useEffect(() => {
    simpleScheduler.start();
    return () => simpleScheduler.stop();
  }, []);

  const fetchData = async () => {
    try {
      const now = new Date();
      
      // Only fetch events that haven't ended yet
      const eventsQuery = query(collection(db, 'events'), where('endTime', '>=', now), orderBy('endTime', 'asc'));
      const eventsSnapshot = await getDocs(eventsQuery);
      setEvents(eventsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));

      // Only fetch surveys that haven't ended yet
      const surveysQuery = query(collection(db, 'surveys'), where('endTime', '>=', now), orderBy('endTime', 'asc'));
      const surveysSnapshot = await getDocs(surveysQuery);
      setSurveys(surveysSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));

      // Only fetch messages that haven't ended yet
      const messagesQuery = query(collection(db, 'messages'), where('endTime', '>=', now), orderBy('endTime', 'asc'));
      const messagesSnapshot = await getDocs(messagesQuery);
      setMessages(messagesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));

      // Fetch approval requests
      const approvalQuery = query(
        collection(db, 'approvalRequests'),
        where('status', '==', 'pending')
      );
      const approvalSnapshot = await getDocs(approvalQuery);
      setApprovalRequests(approvalSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));

      setLoading(false);
    } catch (error) {
      console.error('Error fetching data:', error);
      setLoading(false);
    }
  };

  const fetchDashboardData = async () => {
    try {
      // Fetch soldier data using the existing getActiveUsers function
      const allSoldiers = await getActiveUsers();
      
      const totalSoldiers = allSoldiers.length;
      // Check for presence using different possible field names
      const homeSoldiers = allSoldiers.filter(soldier => {
        // Try different possible field structures for presence
        return soldier.currentStatus?.isPresent === true || 
               normalizeStatus(soldier.status) === 'Home' || 
               soldier.isPresent === true ||
               (soldier.currentStatus && soldier.currentStatus.isPresent === true);
      }).length;
      
      setSoldierStats({ total: totalSoldiers, home: homeSoldiers });

      // Fetch refund requests
      const refundQuery = query(collection(db, 'refundRequests'), where('status', '==', 'waiting'));
      const refundSnapshot = await getDocs(refundQuery);
      setRefundRequestsCount(refundSnapshot.docs.length);

      setPendingProblemsCount(0);

    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    }
  };

  const handleApprove = async (requestId, userId) => {
    setProcessingApproval(true);
    try {
      await promoteUserToAdmin(userId, auth.currentUser.uid);
      await deleteDoc(doc(db, 'approvalRequests', requestId));
      await fetchData();
    } catch (error) {
      console.error('Error approving request:', error);
      alert(t('approval_error', 'Failed to process request. Please try again.'));
    } finally {
      setProcessingApproval(false);
    }
  };

  const handleReject = async (requestId, userId) => {
    setProcessingApproval(true);
    try {
      await adminWipeUserData(userId);
      await fetchData();
    } catch (error) {
      console.error('Error rejecting request:', error);
      alert(t('approval_error', 'Failed to process request. Please try again.'));
    } finally {
      setProcessingApproval(false);
    }
  };

  // Check if admin profile is complete
  const checkAdminProfileComplete = (userData) => {
    if (!userData) return false;
    return !!(userData.firstName && userData.lastName && userData.jobTitle);
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.push('/');
        return;
      }
      
      // Sync scheduler starts automatically from simpleSyncService.js
      
      // Check admin profile completeness
      const userRef = doc(db, 'users', user.uid);
      const userDoc = await getDoc(userRef);
      
      if (userDoc.exists()) {
        const data = userDoc.data();
        setAdminData(data);
        
        // Check if admin profile is complete
        if (!checkAdminProfileComplete(data)) {
          router.push('/admin/profile-setup');
          return;
        }
      } else {
        router.push('/admin/profile-setup');
        return;
      }
      
      await fetchData();
      await fetchDashboardData();
      setIsCheckingProfile(false);
    });
    return () => unsubscribe();
  }, [router]);

  // Show loading state while checking profile
  if (isCheckingProfile) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-blue-200/60 to-green-100/60 font-body flex items-center justify-center">
        <div className="text-center text-muted">{t('loading', 'Loading...')}</div>
      </main>
    );
  }

  const thinGoldWrap = {
    border: `1px solid ${colors.gold}`,
  };

  const handleAddSave = async (form) => {
    setAddLoading(true);
    try {
      const collectionName = modalType === 'event' ? 'events' : modalType === 'survey' ? 'surveys' : 'messages';
      const data = {
        title: form.title,
        body: form.body,
        startTime: form.startTime ? new Date(form.startTime) : null,
        endTime: form.endTime ? new Date(form.endTime) : null,
        createdAt: new Date(),
      };
      
      // Add link field for surveys
      if (modalType === 'survey') {
        data.link = form.link || '';
      }
      
      await addDoc(collection(db, collectionName), data);
      setShowAddModal(false);
      setAddLoading(false);
      fetchData();
    } catch (error) {
      setAddLoading(false);
      alert('Failed to add item');
    }
  };

  const openAddModal = (type) => {
    setModalType(type);
    setShowAddModal(true);
  };

  const handleEditClick = (type, item) => {
    setEditModal({
      open: true,
      type,
      item,
      form: { ...item, dueDate: item.dueDate?.seconds ? new Date(item.dueDate.seconds * 1000).toISOString().slice(0, 16) : '', startDate: item.startDate?.seconds ? new Date(item.startDate.seconds * 1000).toISOString().slice(0, 16) : '' }
    });
  };

  const handleEditChange = (e) => {
    setEditModal(modal => ({
      ...modal,
      form: { ...modal.form, [e.target.name]: e.target.value }
    }));
  };

  const handleEditSave = async () => {
    const { type, item, form } = editModal;
    if (form.startTime && form.endTime) {
      const s = form.startTime.seconds ? new Date(form.startTime.seconds * 1000) : new Date(form.startTime);
      const e = form.endTime.seconds ? new Date(form.endTime.seconds * 1000) : new Date(form.endTime);
      if (e <= s) { alert('End time must be after start time'); return; }
    }
    const collectionName = type === 'event' ? 'events' : type === 'survey' ? 'surveys' : 'messages';
    const updateData = { ...form };
    if (updateData.dueDate) updateData.dueDate = new Date(updateData.dueDate);
    if (updateData.startDate) updateData.startDate = new Date(updateData.startDate);
    try {
      const ref = doc(db, collectionName, item.id);
      await updateDoc(ref, updateData);
      if (type === 'event') setEvents(events => events.map(ev => ev.id === item.id ? { ...ev, ...updateData } : ev));
      if (type === 'survey') setSurveys(surveys => surveys.map(su => su.id === item.id ? { ...su, ...updateData } : su));
      if (type === 'message') setMessages(messages => messages.map(ms => ms.id === item.id ? { ...ms, ...updateData } : ms));
      setEditModal({ open: false, type: '', item: null, form: {} });
    } catch (error) {
      alert('Failed to update');
    }
  };

  const handleEditCancel = () => {
    setEditModal({ open: false, type: '', item: null, form: {} });
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-200/60 to-green-100/60 font-body flex flex-col items-center pt-6 pb-40 px-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div
          className="w-full max-w-md rounded-2xl px-5 pt-6 pb-4 mb-6 bg-white/10 backdrop-blur-md shadow-sm"
          style={{ border: `1px solid ${colors.gold}` }}
        >
          <h1 className="text-xl font-bold text-text">
            {t('welcome', 'Welcome')}, {adminData?.firstName && adminData?.lastName ? `${adminData.firstName} ${adminData.lastName}` : ''}
          </h1>
          <p className="text-sm text-muted">
            {adminData?.jobTitle || ''}
          </p>
        </div>
        {/* Top 3 Cards Section */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          {/* Soldiers Home Card */}
          <button
            onClick={() => router.push('/admin/soldiers?filter=home')}
            className="group relative rounded-3xl transition-all duration-300 transform hover:scale-105 active:scale-95 border-4"
            style={{ 
              minWidth: 0, 
              background: 'transparent',
              borderColor: colors.gold,
              minHeight: '120px'
            }}
          >
            <div className="flex flex-col items-center justify-center h-full p-4">
              <div className="text-4xl font-black mb-2" style={{ color: colors.primaryGreen }}>
                {soldierStats.home}
              </div>
              <div className="text-sm font-bold text-center leading-tight mb-1" style={{ color: colors.primaryGreen }}>
                {t('soldiers_home', 'Soldiers Home')}
              </div>
              <div className="text-xs text-center" style={{ color: colors.primaryGreen, opacity: 0.8 }}>
                of {soldierStats.total} total
              </div>
            </div>
          </button>

          {/* Refund Requests Card */}
          <button
            onClick={() => router.push('/admin/expenses')}
            className="group relative rounded-3xl transition-all duration-300 transform hover:scale-105 active:scale-95 border-4"
            style={{ 
              minWidth: 0, 
              background: 'transparent',
              borderColor: colors.gold,
              minHeight: '120px'
            }}
          >
            <div className="flex flex-col items-center justify-center h-full p-4">
              <div className="text-4xl font-black mb-2" style={{ color: colors.primaryGreen }}>
                {refundRequestsCount}
              </div>
              <div className="text-sm font-bold text-center leading-tight" style={{ color: colors.primaryGreen }}>
                {t('refund_requests', 'Refund Requests')}
              </div>
            </div>
          </button>

          {/* Pending Problems Card */}
          <button
            onClick={() => router.push('/admin/report')}
            className="group relative rounded-3xl transition-all duration-300 transform hover:scale-105 active:scale-95 border-4"
            style={{ 
              minWidth: 0, 
              background: 'transparent',
              borderColor: colors.gold,
              minHeight: '120px'
            }}
          >
            <div className="flex flex-col items-center justify-center h-full p-4">
              <div className="text-4xl font-black mb-2" style={{ color: colors.primaryGreen }}>
                {pendingProblemsCount}
              </div>
              <div className="text-sm font-bold text-center leading-tight" style={{ color: colors.primaryGreen }}>
                {t('pending_problems', 'Pending Problems')}
              </div>
            </div>
          </button>
        </div>



        {/* Events Section */}
        <div className="mb-8 rounded-xl overflow-hidden" style={thinGoldWrap}>
          <div className="flex items-center px-4 py-3 shadow-sm select-none" style={{ background: colors.sectionBg, color: colors.white }}>
            <span className="font-semibold text-lg flex-1" style={{ color: colors.white, textAlign: 'start' }}>
              {t('events', 'Events')}
            </span>
            <button
              onClick={() => openAddModal('event')}
              className="px-3 py-1 rounded-lg font-semibold transition focus:outline-none"
              style={{ color: colors.primaryGreen, background: 'none', boxShadow: 'none' }}
            >
+ {t('add_event', 'Add Event')}
            </button>
          </div>
          <div className="p-5" style={{ background: 'rgba(0,0,0,0.18)' }}>
            {loading ? (
              <div className="text-center text-muted py-3">{t('loading', 'Loading...')}</div>
            ) : events.length === 0 ? (
              <div className="text-center text-muted py-3">{t('no_events', 'No upcoming events')}</div>
            ) : (<>
              {(openEvents ? events : events.slice(0, 1)).map(event => (
                <div key={event.id} className="relative mb-5 bg-blue-50 rounded-xl shadow-md p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 pr-4">
                      <div className="font-bold text-xl text-[#076332] mb-3 leading-tight line-clamp-2">{event.title}</div>
                      {event.body && <div className="text-base font-medium text-gray-700 mb-4 leading-relaxed line-clamp-2">{event.body}</div>}
                      {(event.startTime || event.endTime) && (() => {
                        const fmt = (ts) => {
                          const d = new Date(ts.seconds ? ts.seconds * 1000 : ts);
                          const date = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
                          const time = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
                          return `${date}, ${time}`;
                        };
                        const s = event.startTime ? fmt(event.startTime) : null;
                        const e = event.endTime ? fmt(event.endTime) : null;
                        return (
                          <div className="text-sm font-medium mt-1" style={{ color: colors.muted }}>
                            {s}{e && ' → '}{e}
                          </div>
                        );
                      })()}
                    </div>
                    <div className="flex-shrink-0 flex items-center gap-2">
                      <button 
                        onClick={() => setResponseListModal({ open: true, event })}
                        className="px-3 py-1.5 rounded-xl font-semibold text-xs transition-all duration-150 active:scale-95"
                        style={{ backgroundColor: colors.gold, color: '#fff' }}
                      >
                        {t('responses', 'Responses')}
                      </button>
                      <button onClick={() => handleEditClick('event', event)} className="p-2 rounded-full hover:bg-gray-100">
                        <PencilIcon />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
              {events.length > 1 && (
                <button
                  className="w-full text-center py-2 text-sm font-semibold rounded-lg transition-colors"
                  style={{ color: colors.gold }}
                  onClick={() => setOpenEvents(prev => !prev)}
                >
                  {openEvents ? t('show_less', 'Show Less') : t('see_more', { defaultValue: 'See More ({{count}})', count: events.length - 1 })}
                </button>
              )}
            </>)}
          </div>
        </div>

        {/* Surveys Section */}
        <div className="mb-8 rounded-xl overflow-hidden" style={thinGoldWrap}>
          <div className="flex items-center px-4 py-3 shadow-sm select-none" style={{ background: colors.sectionBg, color: colors.white }}>
            <span className="font-semibold text-lg flex-1" style={{ color: colors.white, textAlign: 'start' }}>
              {t('surveys', 'Surveys')}
            </span>
            <button
              onClick={() => openAddModal('survey')}
              className="px-3 py-1 rounded-lg font-semibold transition focus:outline-none"
              style={{ color: colors.primaryGreen, background: 'none', boxShadow: 'none' }}
            >
+ {t('add_survey', 'Add Survey')}
            </button>
          </div>
          <div className="p-5" style={{ background: 'rgba(0,0,0,0.18)' }}>
            {loading ? (
              <div className="text-center text-muted py-3">{t('loading', 'Loading...')}</div>
            ) : surveys.length === 0 ? (
              <div className="text-center text-muted py-3">{t('no_surveys', 'No surveys to fill')}</div>
            ) : (<>
              {(openSurveys ? surveys : surveys.slice(0, 1)).map(survey => (
                <div key={survey.id} className="relative mb-5 bg-blue-50 rounded-xl shadow-md p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 pr-4">
                      <div className="font-bold text-xl text-[#076332] mb-3 leading-tight line-clamp-2">{survey.title}</div>
                      {survey.body && <div className="text-base font-medium text-gray-700 mb-4 leading-relaxed line-clamp-2">{survey.body}</div>}
                      {survey.endTime && (
                        <div className="text-sm font-semibold text-gray-600 mb-1">
                          Due Date: {new Date(survey.endTime.seconds ? survey.endTime.seconds * 1000 : survey.endTime).toLocaleDateString('en-US', { 
                            weekday: 'short', 
                            month: 'short', 
                            day: 'numeric'
                          })}
                        </div>
                      )}
                    </div>
                    <button onClick={() => handleEditClick('survey', survey)} className="flex-shrink-0 p-2 rounded-full hover:bg-gray-100">
                      <PencilIcon />
                    </button>
                  </div>
                </div>
              ))}
              {surveys.length > 1 && (
                <button
                  className="w-full text-center py-2 text-sm font-semibold rounded-lg transition-colors"
                  style={{ color: colors.gold }}
                  onClick={() => setOpenSurveys(prev => !prev)}
                >
                  {openSurveys ? t('show_less', 'Show Less') : t('see_more', { defaultValue: 'See More ({{count}})', count: surveys.length - 1 })}
                </button>
              )}
            </>)}
          </div>
        </div>

        {/* Messages Section */}
        <div className="mb-8 rounded-xl overflow-hidden" style={thinGoldWrap}>
          <div className="flex items-center px-4 py-3 shadow-sm select-none" style={{ background: colors.sectionBg, color: colors.white }}>
            <span className="font-semibold text-lg flex-1" style={{ color: colors.white, textAlign: 'start' }}>
              {t('messages', 'Messages')}
            </span>
            <button
              onClick={() => openAddModal('message')}
              className="px-3 py-1 rounded-lg font-semibold transition focus:outline-none"
              style={{ color: colors.primaryGreen, background: 'none', boxShadow: 'none' }}
            >
+ {t('add_message', 'Add Message')}
            </button>
          </div>
          <div className="p-5" style={{ background: 'rgba(0,0,0,0.18)' }}>
            {loading ? (
              <div className="text-center text-muted py-3">{t('loading', 'Loading...')}</div>
            ) : messages.length === 0 ? (
              <div className="text-center text-muted py-3">{t('no_messages', 'No important messages')}</div>
            ) : (<>
              {(openMessages ? messages : messages.slice(0, 1)).map(message => (
                <div key={message.id} className="relative mb-5 bg-blue-50 rounded-xl shadow-md p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 pr-4">
                      <div className="font-bold text-xl text-[#076332] mb-3 leading-tight line-clamp-2">{message.title}</div>
                      {message.body && <div className="text-base font-medium text-gray-700 mb-4 leading-relaxed line-clamp-2">{message.body}</div>}
                      {(message.startTime || message.endTime) && (() => {
                        const fmt = (ts) => {
                          const d = new Date(ts.seconds ? ts.seconds * 1000 : ts);
                          const date = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
                          const time = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
                          return `${date}, ${time}`;
                        };
                        const s = message.startTime ? fmt(message.startTime) : null;
                        const e = message.endTime ? fmt(message.endTime) : null;
                        return (
                          <div className="text-sm font-medium mt-1" style={{ color: colors.muted }}>
                            {s}{e && ' → '}{e}
                          </div>
                        );
                      })()}
                    </div>
                    <button onClick={() => handleEditClick('message', message)} className="flex-shrink-0 p-2 rounded-full hover:bg-gray-100">
                      <PencilIcon />
                    </button>
                  </div>
                </div>
              ))}
              {messages.length > 1 && (
                <button
                  className="w-full text-center py-2 text-sm font-semibold rounded-lg transition-colors"
                  style={{ color: colors.gold }}
                  onClick={() => setOpenMessages(prev => !prev)}
                >
                  {openMessages ? t('show_less', 'Show Less') : t('see_more', { defaultValue: 'See More ({{count}})', count: messages.length - 1 })}
                </button>
              )}
            </>)}
          </div>
        </div>

        {/* Approval Requests Section */}
        <div className="mb-8 rounded-xl overflow-hidden" style={thinGoldWrap}>
          <div className="flex items-center px-4 py-3 shadow-sm select-none" style={{ background: colors.sectionBg, color: colors.white }}>
            <button
              className="font-semibold text-lg flex-1 focus:outline-none bg-transparent border-none"
              onClick={() => setOpenApprovalRequests((prev) => !prev)}
              style={{ color: colors.white, textAlign: 'start' }}
            >
              {t('approval_requests', 'Approval Requests')}
            </button>
            <div className="text-sm text-white/80">
              {approvalRequests.length} pending
            </div>
          </div>
          <div className="p-5" style={{ background: 'rgba(0,0,0,0.18)' }}>
            {loading ? (
              <div className="text-center text-muted py-3">{t('loading', 'Loading...')}</div>
            ) : approvalRequests.length === 0 ? (
              <div className="text-center text-muted py-3">{t('no_pending_approvals', 'No pending approval requests')}</div>
            ) : openApprovalRequests ? (
              approvalRequests.map(request => (
                <div key={request.id} className="relative mb-5 bg-blue-50 rounded-xl shadow-md p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 pr-4">
                      <div className="flex items-start gap-3 mb-3">
                        <span className="text-2xl">👤</span>
                        <div className="flex-1">
                          <div className="font-bold text-xl text-[#076332] mb-2">{request.userName}</div>
                          <div className="text-base font-medium text-gray-700 mb-2">{request.userEmail}</div>
                          {request.jobTitle && (
                            <div className="text-base font-medium text-gray-700 mb-2">Job: {request.jobTitle}</div>
                          )}
                          <div className="text-sm font-semibold" style={{ color: '#fff', background: '#076332', borderRadius: 6, padding: '4px 10px', display: 'inline-block' }}>
                            Requested: {request.createdAt?.toDate?.()?.toLocaleDateString() || 'Unknown date'}
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2 mt-4">
                        <button
                          onClick={() => handleApprove(request.id, request.userId)}
                          disabled={processingApproval}
                          className="flex-1 px-3 py-2 rounded-lg text-white font-semibold disabled:opacity-50"
                          style={{ background: colors.primaryGreen }}
                        >
                          {processingApproval ? t('processing', 'Processing...') : t('approve', 'Approve')}
                        </button>
                        <button
                          onClick={() => handleReject(request.id, request.userId)}
                          disabled={processingApproval}
                          className="flex-1 px-3 py-2 rounded-lg border-2 font-semibold disabled:opacity-50"
                          style={{ borderColor: colors.primaryGreen, color: colors.primaryGreen }}
                        >
                          {processingApproval ? t('processing', 'Processing...') : t('reject', 'Reject')}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              approvalRequests.length > 0 && (
                <div className="relative mb-5 bg-blue-50 rounded-xl shadow-md p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 pr-4">
                      <div className="flex items-start gap-3 mb-3">
                        <span className="text-2xl">👤</span>
                        <div className="flex-1">
                          <div className="font-bold text-xl text-[#076332] mb-2">{approvalRequests[0].userName}</div>
                          <div className="text-base font-medium text-gray-700 mb-2">{approvalRequests[0].userEmail}</div>
                          {approvalRequests[0].jobTitle && (
                            <div className="text-base font-medium text-gray-700 mb-2">Job: {approvalRequests[0].jobTitle}</div>
                          )}
                          <div className="text-sm font-semibold" style={{ color: '#fff', background: '#076332', borderRadius: 6, padding: '4px 10px', display: 'inline-block' }}>
                            Requested: {approvalRequests[0].createdAt?.toDate?.()?.toLocaleDateString() || 'Unknown date'}
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2 mt-4">
                        <button
                          onClick={() => handleApprove(approvalRequests[0].id, approvalRequests[0].userId)}
                          disabled={processingApproval}
                          className="flex-1 px-3 py-2 rounded-lg text-white font-semibold disabled:opacity-50"
                          style={{ background: colors.primaryGreen }}
                        >
                          {processingApproval ? t('processing', 'Processing...') : t('approve', 'Approve')}
                        </button>
                        <button
                          onClick={() => handleReject(approvalRequests[0].id, approvalRequests[0].userId)}
                          disabled={processingApproval}
                          className="flex-1 px-3 py-2 rounded-lg border-2 font-semibold disabled:opacity-50"
                          style={{ borderColor: colors.primaryGreen, color: colors.primaryGreen }}
                        >
                          {processingApproval ? t('processing', 'Processing...') : t('reject', 'Reject')}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )
            )}
          </div>
        </div>

        {/* Yes Modal */}
        {showYesModal && (
          <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 shadow-lg w-full max-w-xs mx-4 text-center">
              <div className="text-2xl font-bold mb-4">yes</div>
              <button
                className="mt-2 px-6 py-2 rounded-lg text-white font-semibold"
                style={{ background: colors.primaryGreen }}
                onClick={() => setShowYesModal(false)}
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Add Item Modal */}
      <AddItemModal
        open={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSave={handleAddSave}
        type={modalType}
        loading={addLoading}
      />

      {/* Response List Modal */}
      {responseListModal.open && (() => {
        const sections = [
          { key: 'coming', label: t('coming', 'Coming'), data: responseListModal.event?.coming, color: colors.primaryGreen, bg: 'rgba(7,99,50,0.08)', icon: '✓' },
          { key: 'maybe', label: t('maybe', 'Maybe'), data: responseListModal.event?.maybe, color: colors.gold, bg: 'rgba(237,195,129,0.15)', icon: '?' },
          { key: 'notComing', label: t('not_coming', 'Not Coming'), data: responseListModal.event?.notComing, color: colors.red, bg: 'rgba(255,82,82,0.08)', icon: '✕' },
        ];
        return (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div
              className="w-full max-w-lg max-h-[85vh] overflow-hidden rounded-3xl shadow-2xl"
              style={{ backgroundColor: colors.surface }}
            >

              <div className="px-6 pt-5 pb-4">
                <div className="flex justify-between items-start">
                  <div>
                    <h2 className="text-xl font-bold" style={{ color: colors.primaryGreen }}>
                      {t('event_responses', 'Event Responses')}
                    </h2>
                    <h3 className="text-base font-medium mt-1" style={{ color: colors.text }}>
                      {responseListModal.event?.title}
                    </h3>
                  </div>
                  <button
                    onClick={() => setResponseListModal({ open: false, event: null })}
                    className="w-8 h-8 flex items-center justify-center rounded-full transition-colors"
                    style={{ backgroundColor: colors.gray400 + '33' }}
                  >
                    <span className="text-gray-500 text-lg leading-none">✕</span>
                  </button>
                </div>
              </div>

              <div className="px-5 pb-6 overflow-y-auto max-h-[calc(85vh-120px)]">
                <div className="space-y-4">
                  {sections.map(({ key, label, data, color, bg, icon }) => (
                    <div key={key} className="rounded-2xl overflow-hidden" style={{ backgroundColor: bg }}>
                      <div className="flex items-center gap-2 px-4 py-3">
                        <span
                          className="w-7 h-7 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
                          style={{ backgroundColor: color }}
                        >
                          {icon}
                        </span>
                        <span className="font-bold text-base flex-1" style={{ color }}>
                          {label}
                        </span>
                        <span
                          className="text-sm font-bold px-2.5 py-0.5 rounded-full"
                          style={{ backgroundColor: color + '18', color }}
                        >
                          {data?.length || 0}
                        </span>
                      </div>
                      <div className="px-4 pb-3 max-h-44 overflow-y-auto">
                        {data?.length > 0 ? (
                          <div className="space-y-2">
                            {data.map((person, index) => (
                              <div
                                key={index}
                                className="flex justify-between items-center py-2.5 px-4 rounded-xl"
                                style={{ backgroundColor: 'rgba(255,255,255,0.85)' }}
                              >
                                <span className="font-semibold text-sm" style={{ color: colors.text }}>{person.fullName}</span>
                                <span className="text-xs font-medium px-2 py-1 rounded-lg" style={{ backgroundColor: color + '12', color }}>
                                  Room {person.roomNumber}
                                </span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-center py-3 text-sm" style={{ color: colors.muted }}>
                            {t('no_responses_yet', 'No responses yet')}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Edit Modal */}
      {editModal.open && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 shadow-lg w-full max-w-xs">
            <h2 className="text-xl font-bold mb-4">Edit {editModal.type.charAt(0).toUpperCase() + editModal.type.slice(1)}</h2>
            <form onSubmit={(e) => { e.preventDefault(); handleEditSave(); }}>
            
            {/* Title field for all types */}
            <div className="mb-4">
              <label className="block text-gray-700 font-semibold mb-2">Title</label>
              <input
                type="text"
                name="title"
                value={editModal.form.title || ''}
                onChange={handleEditChange}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:border-primaryGreen"
              />
            </div>

            {/* Body field for all types */}
            <div className="mb-4">
              <label className="block text-gray-700 font-semibold mb-2">Body</label>
              <textarea
                name="body"
                value={editModal.form.body || ''}
                onChange={handleEditChange}
                rows="3"
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:border-primaryGreen resize-none"
              />
            </div>

            {/* Date fields based on type */}
            {editModal.type === 'event' && (
              <>
                <div className="mb-4">
                  <label className="block text-gray-700 font-semibold mb-2">Start Date</label>
                  <StyledDateTimeInput
                    name="startTime"
                    value={editModal.form.startTime?.seconds ? new Date(editModal.form.startTime.seconds * 1000).toISOString().slice(0, 16) : (editModal.form.startTime ? new Date(editModal.form.startTime).toISOString().slice(0, 16) : '')}
                    onChange={handleEditChange}
                  />
                </div>
                <div className="mb-4">
                  <label className="block text-gray-700 font-semibold mb-2">End Date</label>
                  <StyledDateTimeInput
                    name="endTime"
                    value={editModal.form.endTime?.seconds ? new Date(editModal.form.endTime.seconds * 1000).toISOString().slice(0, 16) : (editModal.form.endTime ? new Date(editModal.form.endTime).toISOString().slice(0, 16) : '')}
                    onChange={handleEditChange}
                  />
                </div>
              </>
            )}

            {editModal.type === 'survey' && (
              <>
                <div className="mb-4">
                  <label className="block text-gray-700 font-semibold mb-2">Due Date</label>
                  <StyledDateTimeInput
                    name="endTime"
                    value={editModal.form.endTime?.seconds ? new Date(editModal.form.endTime.seconds * 1000).toISOString().slice(0, 16) : (editModal.form.endTime ? new Date(editModal.form.endTime).toISOString().slice(0, 16) : '')}
                    onChange={handleEditChange}
                  />
                </div>
                <div className="mb-4">
                  <label className="block text-gray-700 font-semibold mb-2">Link <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    name="link"
                    value={editModal.form.link || ''}
                    onChange={handleEditChange}
                    placeholder="https://example.com"
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:border-primaryGreen"
                    required
                  />
                </div>
              </>
            )}

            {editModal.type === 'message' && (
              <>
                <div className="mb-4">
                  <label className="block text-gray-700 font-semibold mb-2">Start Date</label>
                  <StyledDateTimeInput
                    name="startTime"
                    value={editModal.form.startTime?.seconds ? new Date(editModal.form.startTime.seconds * 1000).toISOString().slice(0, 16) : (editModal.form.startTime ? new Date(editModal.form.startTime).toISOString().slice(0, 16) : '')}
                    onChange={handleEditChange}
                  />
                </div>
                <div className="mb-4">
                  <label className="block text-gray-700 font-semibold mb-2">End Date</label>
                  <StyledDateTimeInput
                    name="endTime"
                    value={editModal.form.endTime?.seconds ? new Date(editModal.form.endTime.seconds * 1000).toISOString().slice(0, 16) : (editModal.form.endTime ? new Date(editModal.form.endTime).toISOString().slice(0, 16) : '')}
                    onChange={handleEditChange}
                  />
                </div>
              </>
            )}

            <div className="flex gap-4">
              <button
                type="submit"
                className="flex-1 px-4 py-2 rounded-lg text-white font-semibold"
                style={{ background: colors.gold }}
              >
                Save
              </button>
              <button
                type="button"
                onClick={handleEditCancel}
                className="flex-1 px-4 py-2 rounded-lg border-2 font-semibold"
                style={{ borderColor: colors.primaryGreen, color: colors.primaryGreen }}
              >
                Cancel
              </button>
            </div>
            </form>
          </div>
        </div>
      )}

      <AdminBottomNavBar active="home" />
    </main>
  );
} 