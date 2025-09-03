"use client";

import '@/i18n';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { collection, addDoc, getDocs, query, orderBy, doc, getDoc, updateDoc, where, deleteDoc } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import colors from '../../colors';
import CollapsibleSection from '@/components/home/CollapsibleSection';
import ListItem from '@/components/home/ListItem';
import AdminBottomNavBar from '@/components/AdminBottomNavBar';
import { onAuthStateChanged } from 'firebase/auth';
import EditFieldModal from '@/components/EditFieldModal';
import PencilIcon from '@/components/PencilIcon';
import AddItemModal from '@/components/AddItemModal';
import LanguageSwitcher from '@/components/LanguageSwitcher';

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

  const handleApprove = async (requestId, userId) => {
    setProcessingApproval(true);
    try {
      // Update user document to admin
      await updateDoc(doc(db, 'users', userId), {
        userType: 'admin',
        approvedAt: new Date(),
        approvedBy: auth.currentUser.uid
      });

      // Delete the approval request
      await deleteDoc(doc(db, 'approvalRequests', requestId));

      // Refresh the data
      await fetchData();
    } catch (error) {
      console.error('Error approving request:', error);
    } finally {
      setProcessingApproval(false);
    }
  };

  const handleReject = async (requestId, userId) => {
    setProcessingApproval(true);
    try {
      // Update user document to regular user
      await updateDoc(doc(db, 'users', userId), {
        userType: 'user',
        rejectedAt: new Date(),
        rejectedBy: auth.currentUser.uid
      });

      // Delete the approval request
      await deleteDoc(doc(db, 'approvalRequests', requestId));

      // Refresh the data
      await fetchData();
    } catch (error) {
      console.error('Error rejecting request:', error);
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
      <LanguageSwitcher />
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="w-full max-w-md px-5 pt-6 pb-4 mb-2">
          <h1 className="text-2xl font-bold text-black mb-1">
Welcome,
          </h1>
          <p className="text-2xl font-bold text-black">
            {adminData?.firstName && adminData?.lastName ? `${adminData.firstName} ${adminData.lastName}` : ''}
          </p>
          <p className="text-lg text-black font-medium">
            {adminData?.jobTitle || ''}
          </p>
        </div>
        {/* Top 3 Cards Section */}
        <div className="flex justify-between gap-3 mb-8">
          <button
            onClick={() => router.push('/admin/soldiers?filter=home')}
            className="flex-1 flex flex-col items-center justify-center rounded-2xl shadow-lg py-5"
            style={{ minWidth: 0, background: colors.sectionBg }}
          >
            <div className="text-2xl font-extrabold text-white mb-1">75</div>
            <div className="text-xs font-semibold text-white/80">{t('soldiers_home', 'Soldiers Home')}</div>
          </button>
          <button
            onClick={() => router.push('/admin/expenses')}
            className="flex-1 flex flex-col items-center justify-center rounded-2xl shadow-lg py-5"
            style={{ minWidth: 0, background: colors.sectionBg }}
          >
            <div className="text-2xl font-extrabold text-white mb-1">20</div>
            <div className="text-xs font-semibold text-white/80">{t('refund_requests', 'Refund Requests')}</div>
          </button>
          <button
            className="flex-1 flex flex-col items-center justify-center rounded-2xl shadow-lg py-5 cursor-default"
            style={{ minWidth: 0, background: colors.sectionBg }}
          >
            <div className="text-2xl font-extrabold text-white mb-1">5</div>
            <div className="text-xs font-semibold text-white/80">{t('pending_problems', 'Pending Problems')}</div>
          </button>
        </div>



        {/* Events Section */}
        <div className="mb-8">
          <div className="flex items-center px-4 py-3 rounded-t-lg shadow-sm select-none" style={{ background: colors.sectionBg, color: colors.white }}>
            <button
              className="font-semibold text-lg flex-1 focus:outline-none bg-transparent border-none"
              onClick={() => setOpenEvents((prev) => !prev)}
              style={{ color: colors.white, textAlign: 'start' }}
            >
{t('events', 'Events')}
            </button>
            <button
              onClick={() => openAddModal('event')}
              className="px-3 py-1 rounded-lg font-semibold transition focus:outline-none"
              style={{ color: colors.primaryGreen, background: 'none', boxShadow: 'none' }}
            >
+ {t('add_event', 'Add Event')}
            </button>
          </div>
          <div className="rounded-b-lg p-5" style={{ background: 'rgba(0,0,0,0.18)' }}>
            {loading ? (
              <div className="text-center text-muted py-3">{t('loading', 'Loading...')}</div>
            ) : events.length === 0 ? (
              <div className="text-center text-muted py-3">{t('no_events', 'No upcoming events')}</div>
            ) : openEvents ? (
              events.map(event => (
                <div key={event.id} className="relative mb-5 bg-blue-50 rounded-xl shadow-md p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 pr-4">
                      <div className="font-bold text-xl text-[#076332] mb-3 leading-tight line-clamp-2">{event.title}</div>
                      {event.body && <div className="text-base font-medium text-gray-700 mb-4 leading-relaxed line-clamp-2">{event.body}</div>}
                      {event.startTime && (
                        <div className="text-sm font-semibold text-gray-600 mb-1">
                          Start: {new Date(event.startTime.seconds ? event.startTime.seconds * 1000 : event.startTime).toLocaleDateString('en-US', { 
                            weekday: 'short', 
                            month: 'short', 
                            day: 'numeric',
                            hour: '2-digit', 
                            minute: '2-digit' 
                          })}
                        </div>
                      )}
                      {event.endTime && (
                        <div className="text-sm font-semibold text-gray-600">
                          End: {new Date(event.endTime.seconds ? event.endTime.seconds * 1000 : event.endTime).toLocaleDateString('en-US', { 
                            weekday: 'short', 
                            month: 'short', 
                            day: 'numeric',
                            hour: '2-digit', 
                            minute: '2-digit' 
                          })}
                        </div>
                      )}
                    </div>
                    <div className="flex-shrink-0 flex items-center gap-2">
                      <button 
                        onClick={() => setResponseListModal({ open: true, event })}
                        className="px-3 py-1 rounded-lg bg-blue-500 text-white font-semibold text-xs shadow-md hover:bg-blue-600 transition-colors"
                      >
                        Responses
                      </button>
                      <button onClick={() => handleEditClick('event', event)} className="p-2 rounded-full hover:bg-gray-100">
                        <PencilIcon />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              events.length > 0 && (
                <div className="relative mb-5 bg-blue-50 rounded-xl shadow-md p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 pr-4">
                      <div className="font-bold text-xl text-[#076332] mb-3 leading-tight line-clamp-2">{events[0].title}</div>
                      {events[0].body && <div className="text-base font-medium text-gray-700 mb-4 leading-relaxed line-clamp-2">{events[0].body}</div>}
                      {events[0].startTime && (
                        <div className="text-sm font-semibold text-gray-600 mb-1">
                          Start: {new Date(events[0].startTime.seconds ? events[0].startTime.seconds * 1000 : events[0].startTime).toLocaleDateString('en-US', { 
                            weekday: 'short', 
                            month: 'short', 
                            day: 'numeric',
                            hour: '2-digit', 
                            minute: '2-digit' 
                          })}
                        </div>
                      )}
                      {events[0].endTime && (
                        <div className="text-sm font-semibold text-gray-600">
                          End: {new Date(events[0].endTime.seconds ? events[0].endTime.seconds * 1000 : events[0].endTime).toLocaleDateString('en-US', { 
                            weekday: 'short', 
                            month: 'short', 
                            day: 'numeric',
                            hour: '2-digit', 
                            minute: '2-digit' 
                          })}
                        </div>
                      )}
                    </div>
                    <div className="flex-shrink-0 flex items-center gap-2">
                      <button 
                        onClick={() => setResponseListModal({ open: true, event: events[0] })}
                        className="px-3 py-1 rounded-lg bg-blue-500 text-white font-semibold text-xs shadow-md hover:bg-blue-600 transition-colors"
                      >
                        Responses
                      </button>
                      <button onClick={() => handleEditClick('event', events[0])} className="p-2 rounded-full hover:bg-gray-100">
                        <PencilIcon />
                      </button>
                    </div>
                  </div>
                </div>
              )
            )}
          </div>
        </div>

        {/* Surveys Section */}
        <div className="mb-8">
          <div className="flex items-center px-4 py-3 rounded-t-lg shadow-sm select-none" style={{ background: colors.sectionBg, color: colors.white }}>
            <button
              className="font-semibold text-lg flex-1 focus:outline-none bg-transparent border-none"
              onClick={() => setOpenSurveys((prev) => !prev)}
              style={{ color: colors.white, textAlign: 'start' }}
            >
{t('surveys', 'Surveys')}
            </button>
            <button
              onClick={() => openAddModal('survey')}
              className="px-3 py-1 rounded-lg font-semibold transition focus:outline-none"
              style={{ color: colors.primaryGreen, background: 'none', boxShadow: 'none' }}
            >
+ {t('add_survey', 'Add Survey')}
            </button>
          </div>
          <div className="rounded-b-lg p-5" style={{ background: 'rgba(0,0,0,0.18)' }}>
            {loading ? (
              <div className="text-center text-muted py-3">{t('loading', 'Loading...')}</div>
            ) : surveys.length === 0 ? (
              <div className="text-center text-muted py-3">{t('no_surveys', 'No surveys to fill')}</div>
            ) : openSurveys ? (
              surveys.map(survey => (
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
                      {survey.link && (
                        <div className="text-sm font-semibold text-blue-600">
                          Link: <a href={survey.link} target="_blank" rel="noopener noreferrer" className="underline hover:text-blue-800">{survey.link}</a>
                        </div>
                      )}
                    </div>
                    <button onClick={() => handleEditClick('survey', survey)} className="flex-shrink-0 p-2 rounded-full hover:bg-gray-100">
                      <PencilIcon />
                    </button>
                  </div>
                </div>
              ))
            ) : (
              surveys.length > 0 && (
                <div className="relative mb-5 bg-blue-50 rounded-xl shadow-md p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 pr-4">
                      <div className="font-bold text-xl text-[#076332] mb-3 leading-tight line-clamp-2">{surveys[0].title}</div>
                      {surveys[0].body && <div className="text-base font-medium text-gray-700 mb-4 leading-relaxed line-clamp-2">{surveys[0].body}</div>}
                      {surveys[0].endTime && (
                        <div className="text-sm font-semibold text-gray-600 mb-1">
                          Due Date: {new Date(surveys[0].endTime.seconds ? surveys[0].endTime.seconds * 1000 : surveys[0].endTime).toLocaleDateString('en-US', { 
                            weekday: 'short', 
                            month: 'short', 
                            day: 'numeric'
                          })}
                        </div>
                      )}
                      {surveys[0].link && (
                        <div className="text-sm font-semibold text-blue-600">
                          Link: <a href={surveys[0].link} target="_blank" rel="noopener noreferrer" className="underline hover:text-blue-800">{surveys[0].link}</a>
                        </div>
                      )}
                    </div>
                    <button onClick={() => handleEditClick('survey', surveys[0])} className="flex-shrink-0 p-2 rounded-full hover:bg-gray-100">
                      <PencilIcon />
                    </button>
                  </div>
                </div>
              )
            )}
          </div>
        </div>

        {/* Messages Section */}
        <div className="mb-8">
          <div className="flex items-center px-4 py-3 rounded-t-lg shadow-sm select-none" style={{ background: colors.sectionBg, color: colors.white }}>
            <button
              className="font-semibold text-lg flex-1 focus:outline-none bg-transparent border-none"
              onClick={() => setOpenMessages((prev) => !prev)}
              style={{ color: colors.white, textAlign: 'start' }}
            >
{t('messages', 'Messages')}
            </button>
            <button
              onClick={() => openAddModal('message')}
              className="px-3 py-1 rounded-lg font-semibold transition focus:outline-none"
              style={{ color: colors.primaryGreen, background: 'none', boxShadow: 'none' }}
            >
+ {t('add_message', 'Add Message')}
            </button>
          </div>
          <div className="rounded-b-lg p-5" style={{ background: 'rgba(0,0,0,0.18)' }}>
            {loading ? (
              <div className="text-center text-muted py-3">{t('loading', 'Loading...')}</div>
            ) : messages.length === 0 ? (
              <div className="text-center text-muted py-3">{t('no_messages', 'No important messages')}</div>
            ) : openMessages ? (
              messages.map(message => (
                <div key={message.id} className="relative mb-5 bg-blue-50 rounded-xl shadow-md p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 pr-4">
                      <div className="font-bold text-xl text-[#076332] mb-3 leading-tight line-clamp-2">{message.title}</div>
                      {message.body && <div className="text-base font-medium text-gray-700 mb-4 leading-relaxed line-clamp-2">{message.body}</div>}
                      {message.startTime && (
                        <div className="text-sm font-semibold text-gray-600 mb-1">
                          Start: {new Date(message.startTime.seconds ? message.startTime.seconds * 1000 : message.startTime).toLocaleDateString('en-US', { 
                            weekday: 'short', 
                            month: 'short', 
                            day: 'numeric',
                            hour: '2-digit', 
                            minute: '2-digit' 
                          })}
                        </div>
                      )}
                      {message.endTime && (
                        <div className="text-sm font-semibold text-gray-600">
                          End: {new Date(message.endTime.seconds ? message.endTime.seconds * 1000 : message.endTime).toLocaleDateString('en-US', { 
                            weekday: 'short', 
                            month: 'short', 
                            day: 'numeric',
                            hour: '2-digit', 
                            minute: '2-digit' 
                          })}
                        </div>
                      )}
                    </div>
                    <button onClick={() => handleEditClick('message', message)} className="flex-shrink-0 p-2 rounded-full hover:bg-gray-100">
                      <PencilIcon />
                    </button>
                  </div>
                </div>
              ))
            ) : (
              messages.length > 0 && (
                <div className="relative mb-5 bg-blue-50 rounded-xl shadow-md p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 pr-4">
                      <div className="font-bold text-xl text-[#076332] mb-3 leading-tight line-clamp-2">{messages[0].title}</div>
                      {messages[0].body && <div className="text-base font-medium text-gray-700 mb-4 leading-relaxed line-clamp-2">{messages[0].body}</div>}
                      {messages[0].startTime && (
                        <div className="text-sm font-semibold text-gray-600 mb-1">
                          Start: {new Date(messages[0].startTime.seconds ? messages[0].startTime.seconds * 1000 : messages[0].startTime).toLocaleDateString('en-US', { 
                            weekday: 'short', 
                            month: 'short', 
                            day: 'numeric',
                            hour: '2-digit', 
                            minute: '2-digit' 
                          })}
                        </div>
                      )}
                      {messages[0].endTime && (
                        <div className="text-sm font-semibold text-gray-600">
                          End: {new Date(messages[0].endTime.seconds ? messages[0].endTime.seconds * 1000 : messages[0].endTime).toLocaleDateString('en-US', { 
                            weekday: 'short', 
                            month: 'short', 
                            day: 'numeric',
                            hour: '2-digit', 
                            minute: '2-digit' 
                          })}
                        </div>
                      )}
                    </div>
                    <button onClick={() => handleEditClick('message', messages[0])} className="flex-shrink-0 p-2 rounded-full hover:bg-gray-100">
                      <PencilIcon />
                    </button>
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
      {responseListModal.open && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-lg max-h-[85vh] overflow-hidden">
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-200">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold text-[#076332]">Event Responses</h2>
                <button
                  onClick={() => setResponseListModal({ open: false, event: null })}
                  className="text-gray-400 hover:text-gray-600 text-2xl font-bold"
                >
                  ×
                </button>
              </div>
              <h3 className="text-lg font-semibold text-gray-800 mt-2">{responseListModal.event?.title}</h3>
            </div>
            
            {/* Content */}
            <div className="p-6 overflow-y-auto max-h-[calc(85vh-120px)]">
              <div className="space-y-6">
                {/* Coming List */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-lg font-bold text-green-600">COMING</h4>
                    <span className="text-sm font-bold text-gray-600">
                      {responseListModal.event?.coming?.length || 0}
                    </span>
                  </div>
                  <div className="border border-gray-200 rounded-lg p-4 max-h-40 overflow-y-auto">
                    {responseListModal.event?.coming?.length > 0 ? (
                      <div className="space-y-2">
                        {responseListModal.event.coming.map((person, index) => (
                          <div key={index} className="flex justify-between items-center py-2 px-3 bg-gray-50 rounded">
                            <span className="font-semibold text-gray-800">{person.fullName}</span>
                            <span className="text-sm font-medium text-gray-600">Room {person.roomNumber}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-4 text-gray-500 font-medium">No responses yet</div>
                    )}
                  </div>
                </div>

                {/* Maybe List */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-lg font-bold text-yellow-600">MAYBE</h4>
                    <span className="text-sm font-bold text-gray-600">
                      {responseListModal.event?.maybe?.length || 0}
                    </span>
                  </div>
                  <div className="border border-gray-200 rounded-lg p-4 max-h-40 overflow-y-auto">
                    {responseListModal.event?.maybe?.length > 0 ? (
                      <div className="space-y-2">
                        {responseListModal.event.maybe.map((person, index) => (
                          <div key={index} className="flex justify-between items-center py-2 px-3 bg-gray-50 rounded">
                            <span className="font-semibold text-gray-800">{person.fullName}</span>
                            <span className="text-sm font-medium text-gray-600">Room {person.roomNumber}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-4 text-gray-500 font-medium">No responses yet</div>
                    )}
                  </div>
                </div>

                {/* Not Coming List */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-lg font-bold text-red-600">NOT COMING</h4>
                    <span className="text-sm font-bold text-gray-600">
                      {responseListModal.event?.notComing?.length || 0}
                    </span>
                  </div>
                  <div className="border border-gray-200 rounded-lg p-4 max-h-40 overflow-y-auto">
                    {responseListModal.event?.notComing?.length > 0 ? (
                      <div className="space-y-2">
                        {responseListModal.event.notComing.map((person, index) => (
                          <div key={index} className="flex justify-between items-center py-2 px-3 bg-gray-50 rounded">
                            <span className="font-semibold text-gray-800">{person.fullName}</span>
                            <span className="text-sm font-medium text-gray-600">Room {person.roomNumber}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-4 text-gray-500 font-medium">No responses yet</div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editModal.open && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 shadow-lg w-full max-w-xs">
            <h2 className="text-xl font-bold mb-4">Edit {editModal.type.charAt(0).toUpperCase() + editModal.type.slice(1)}</h2>
            
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
                  <input
                    type="datetime-local"
                    name="startTime"
                    value={editModal.form.startTime?.seconds ? new Date(editModal.form.startTime.seconds * 1000).toISOString().slice(0, 16) : (editModal.form.startTime ? new Date(editModal.form.startTime).toISOString().slice(0, 16) : '')}
                    onChange={handleEditChange}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:border-primaryGreen"
                  />
                </div>
                <div className="mb-4">
                  <label className="block text-gray-700 font-semibold mb-2">End Date</label>
                  <input
                    type="datetime-local"
                    name="endTime"
                    value={editModal.form.endTime?.seconds ? new Date(editModal.form.endTime.seconds * 1000).toISOString().slice(0, 16) : (editModal.form.endTime ? new Date(editModal.form.endTime).toISOString().slice(0, 16) : '')}
                    onChange={handleEditChange}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:border-primaryGreen"
                  />
                </div>
              </>
            )}

            {editModal.type === 'survey' && (
              <>
                <div className="mb-4">
                  <label className="block text-gray-700 font-semibold mb-2">Due Date</label>
                  <input
                    type="datetime-local"
                    name="endTime"
                    value={editModal.form.endTime?.seconds ? new Date(editModal.form.endTime.seconds * 1000).toISOString().slice(0, 16) : (editModal.form.endTime ? new Date(editModal.form.endTime).toISOString().slice(0, 16) : '')}
                    onChange={handleEditChange}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:border-primaryGreen"
                  />
                </div>
                <div className="mb-4">
                  <label className="block text-gray-700 font-semibold mb-2">Link (Optional)</label>
                  <input
                    type="url"
                    name="link"
                    value={editModal.form.link || ''}
                    onChange={handleEditChange}
                    placeholder="https://example.com"
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:border-primaryGreen"
                  />
                </div>
              </>
            )}

            {editModal.type === 'message' && (
              <>
                <div className="mb-4">
                  <label className="block text-gray-700 font-semibold mb-2">Start Date</label>
                  <input
                    type="datetime-local"
                    name="startTime"
                    value={editModal.form.startTime?.seconds ? new Date(editModal.form.startTime.seconds * 1000).toISOString().slice(0, 16) : (editModal.form.startTime ? new Date(editModal.form.startTime).toISOString().slice(0, 16) : '')}
                    onChange={handleEditChange}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:border-primaryGreen"
                  />
                </div>
                <div className="mb-4">
                  <label className="block text-gray-700 font-semibold mb-2">End Date</label>
                  <input
                    type="datetime-local"
                    name="endTime"
                    value={editModal.form.endTime?.seconds ? new Date(editModal.form.endTime.seconds * 1000).toISOString().slice(0, 16) : (editModal.form.endTime ? new Date(editModal.form.endTime).toISOString().slice(0, 16) : '')}
                    onChange={handleEditChange}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:border-primaryGreen"
                  />
                </div>
              </>
            )}

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

              {/* Approval Requests Section */}
        <div className="mb-8">
          <div className="flex items-center px-4 py-3 rounded-t-lg shadow-sm select-none" style={{ background: colors.sectionBg, color: colors.white }}>
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
          <div className="rounded-b-lg p-5" style={{ background: 'rgba(0,0,0,0.18)' }}>
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

      <AdminBottomNavBar active="home" />
    </main>
  );
} 