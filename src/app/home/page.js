'use client';

import '@/i18n';
import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import i18n from '@/i18n';
import { doc, updateDoc, collection, getDoc, getDocs, query, where, orderBy, onSnapshot, arrayUnion, arrayRemove } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import { syncStatusToReceptionSheet, normalizeStatus, fetchStatusFromSheet } from '@/lib/receptionSync';
import HouseLoader from '@/components/HouseLoader';
import WelcomeHeader from '@/components/home/WelcomeHeader';
import CollapsibleSection from '@/components/home/CollapsibleSection';
import ListItem from '@/components/home/ListItem';
import EventResponseModal from '@/components/home/EventResponseModal';
import BottomNavBar from '@/components/BottomNavBar';
import colors from '../colors';
import useAuthRedirect from '@/hooks/useAuthRedirect';

import { useRouter } from 'next/navigation';


export default function HomePage() {
  const router = useRouter();
  const CLEAN_ROOM_FEATURE_ENABLED = false;
  const { isReady, user: authUser, userData: initialUserData } = useAuthRedirect({ redirectIfIncomplete: true, fetchUserData: true });
  const { t } = useTranslation('home');
  const [status, setStatus] = useState('Home');
  const [syncingStatus, setSyncingStatus] = useState(true);
  const [userData, setUserData] = useState(null);
  const [events, setEvents] = useState([]);
  const [surveys, setSurveys] = useState([]);
  const [messages, setMessages] = useState([]);
  const [loadingUser, setLoadingUser] = useState(true);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [loadingSurveys, setLoadingSurveys] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [eventResponse, setEventResponse] = useState(null);
  const [leftForBaseModalOpen, setLeftForBaseModalOpen] = useState(false);
  const [cleanRoom, setCleanRoom] = useState(null);
  const [changeSheets, setChangeSheets] = useState(null);
  const [surveyModalOpen, setSurveyModalOpen] = useState(false);
  const [selectedSurvey, setSelectedSurvey] = useState(null);
  const [surveyLinkCopied, setSurveyLinkCopied] = useState(false);
  const [showAllEvents, setShowAllEvents] = useState(false);
  const [showAllSurveys, setShowAllSurveys] = useState(false);
  const [showAllMessages, setShowAllMessages] = useState(false);
  const [isSavingStatus, setIsSavingStatus] = useState(false);
  const [isSavingEventResponse, setIsSavingEventResponse] = useState(false);
  const statusRef = useRef('Home');
  const isSavingStatusRef = useRef(false);
  const queuedStatusRef = useRef(null);
  const isRTL = i18n.language?.startsWith('he');
  const dateLocale = isRTL ? 'he-IL' : 'en-US';

  useEffect(() => {
    if (!isReady || !authUser || !initialUserData) return;

    setUserData(initialUserData);
    setLoadingUser(false);

    const userRef = doc(db, 'users', authUser.uid);

    if (initialUserData.roomNumber) {
      fetchStatusFromSheet(initialUserData.roomNumber).then((sheetStatus) => {
        const currentStatus = normalizeStatus(initialUserData.status);
        if (sheetStatus && sheetStatus !== currentStatus) {
          updateDoc(userRef, { status: sheetStatus }).catch(() => {});
        }
      }).catch(() => {}).finally(() => setSyncingStatus(false));
    } else {
      setSyncingStatus(false);
    }

    const unsubscribeUser = onSnapshot(
      userRef,
      (snap) => {
        if (snap.exists()) {
          setUserData(snap.data());
        }
      },
      (error) => {
        console.error('User onSnapshot error:', error);
      }
    );

    return () => unsubscribeUser();
  }, [isReady, authUser, initialUserData]);

  const fetchEvents = async () => {
    setLoadingEvents(true);
    const now = new Date();
    const eventsRef = collection(db, 'events');
    const q = query(eventsRef, where('endTime', '>=', now), orderBy('endTime', 'asc'));
    const querySnapshot = await getDocs(q);
    const eventsData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    setEvents(eventsData);
    setLoadingEvents(false);
  };

  useEffect(() => {
    if (!isReady) return;

    const fetchSurveys = async () => {
      setLoadingSurveys(true);
      const now = new Date();
      const surveysRef = collection(db, 'surveys');
      const q = query(surveysRef, where('endTime', '>=', now), orderBy('endTime', 'asc'));
      const querySnapshot = await getDocs(q);
      setSurveys(querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoadingSurveys(false);
    };

    const fetchMessages = async () => {
      setLoadingMessages(true);
      const now = new Date();
      const messagesRef = collection(db, 'messages');
      const q = query(messagesRef, where('endTime', '>=', now), orderBy('endTime', 'asc'));
      const querySnapshot = await getDocs(q);
      setMessages(querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoadingMessages(false);
    };

    fetchEvents();
    fetchSurveys();
    fetchMessages();
  }, [isReady]);

  useEffect(() => {
    if (userData?.status) {
      setStatus(normalizeStatus(userData.status));
    }
  }, [userData?.status]);

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  const persistStatus = async (newStatus) => {
    if (newStatus === statusRef.current) return;

    setIsSavingStatus(true);
    isSavingStatusRef.current = true;
    const uid = auth.currentUser?.uid;

    setStatus(newStatus);
    if (uid) {
      const userRef = doc(db, 'users', uid);
      try {
        await updateDoc(userRef, { status: newStatus });
        syncStatusToReceptionSheet(userData?.roomNumber, newStatus).catch(() => {});
      } finally {
        setIsSavingStatus(false);
        isSavingStatusRef.current = false;
      }
      return;
    }

    setIsSavingStatus(false);
    isSavingStatusRef.current = false;
  };

  const handleStatusToggle = async (newStatus) => {
    if (newStatus === statusRef.current) {
      queuedStatusRef.current = null;
      return;
    }

    // If a save is in-flight, keep only the latest choice.
    if (isSavingStatusRef.current) {
      queuedStatusRef.current = newStatus;
      setStatus(newStatus);
      return;
    }

    let nextStatus = newStatus;
    while (nextStatus && nextStatus !== statusRef.current) {
      queuedStatusRef.current = null;
      await persistStatus(nextStatus);
      nextStatus = queuedStatusRef.current;
    }
  };


  const handleEventResponse = async (response) => {
    if (!selectedEvent || !auth.currentUser || isSavingEventResponse) return;
    setIsSavingEventResponse(true);
    
    try {
      const eventRef = doc(db, 'events', selectedEvent.id);
      const userResponseData = {
        userId: auth.currentUser.uid,
        fullName: userData?.fullName || 'Unknown',
        roomNumber: userData?.roomNumber || 'Unknown'
      };
      
      // First, get the current event document to check if arrays exist
      const eventDoc = await getDoc(eventRef);
      const eventData = eventDoc.data();
      
      // Initialize arrays if they don't exist
      const currentComing = eventData?.coming || [];
      const currentMaybe = eventData?.maybe || [];
      const currentNotComing = eventData?.notComing || [];
      
      // Remove user from all arrays (if they exist)
      const updatedComing = currentComing.filter(r => r.userId !== auth.currentUser.uid);
      const updatedMaybe = currentMaybe.filter(r => r.userId !== auth.currentUser.uid);
      const updatedNotComing = currentNotComing.filter(r => r.userId !== auth.currentUser.uid);
      
      // Add user to the selected response array
      if (response === 'coming') {
        updatedComing.push(userResponseData);
      } else if (response === 'maybe') {
        updatedMaybe.push(userResponseData);
      } else if (response === 'notComing') {
        updatedNotComing.push(userResponseData);
      }
      
      // Update the document with all arrays
      await updateDoc(eventRef, {
        coming: updatedComing,
        maybe: updatedMaybe,
        notComing: updatedNotComing
      });
      
      // Refresh events data to show updated response
      await fetchEvents();
      
      setEventResponse(response);
      // Close modal after a short delay to show the response
      setTimeout(() => {
        setModalOpen(false);
        setEventResponse(null);
        setIsSavingEventResponse(false);
      }, 2000);
    } catch (error) {
      console.error('Error saving event response:', error);
      // Still show feedback even if save fails
      setEventResponse(response);
      setTimeout(() => {
        setModalOpen(false);
        setEventResponse(null);
        setIsSavingEventResponse(false);
      }, 2000);
    }
  };


  // Filter and sort events to only show future events, sorted by endTime ascending
  const now = new Date();
  const futureEvents = events
    .filter(event => event.endTime && new Date(event.endTime.seconds ? event.endTime.seconds * 1000 : event.endTime) > now)
    .sort((a, b) => new Date((a.endTime.seconds ? a.endTime.seconds * 1000 : a.endTime)) - new Date((b.endTime.seconds ? b.endTime.seconds * 1000 : b.endTime)));

  // Filter and sort surveys to only show future surveys, sorted by endTime ascending
  const futureSurveys = surveys
    .filter(survey => survey.endTime && new Date(survey.endTime.seconds ? survey.endTime.seconds * 1000 : survey.endTime) > now)
    .sort((a, b) => new Date((a.endTime.seconds ? a.endTime.seconds * 1000 : a.endTime)) - new Date((b.endTime.seconds ? b.endTime.seconds * 1000 : b.endTime)));

  // Filter and sort messages to only show those with future endTime, sorted ascending
  const futureMessages = messages
    .filter(msg => msg.endTime && new Date(msg.endTime.seconds ? msg.endTime.seconds * 1000 : msg.endTime) > now)
    .sort((a, b) => new Date((a.endTime.seconds ? a.endTime.seconds * 1000 : a.endTime)) - new Date((b.endTime.seconds ? b.endTime.seconds * 1000 : b.endTime)));

  const thinGoldWrap = {
    border: `1px solid ${colors.gold}`,
  };

  if (!isReady) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-blue-200/60 to-green-100/60 font-body flex items-center justify-center">
        <HouseLoader />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-200/60 to-green-100/60 font-body flex flex-col items-center pt-6 pb-32 px-4">
      <div className="w-full max-w-md">
        {loadingUser ? (
          <div className="flex justify-center py-4"><HouseLoader size={60} /></div>
        ) : (
          <WelcomeHeader status={status} userData={userData} isRTL={isRTL} />
        )}

        

        {/* Status Switcher */}
        <div
          className="rounded-2xl p-4 flex flex-col items-center mb-6 shadow-sm"
          style={{ background: colors.sectionBg, color: colors.primaryGreen, ...thinGoldWrap }}
        >
          {syncingStatus ? (
            <div className="flex justify-center py-4"><HouseLoader size={50} /></div>
          ) : (<>
          <div className="grid grid-cols-2 gap-4 w-full mb-4">
            <button
              className={`flex flex-col items-center focus:outline-none`}
              onClick={() => handleStatusToggle('Home')}
              disabled={isSavingStatus}
            >
              <div className={`w-12 h-12 flex items-center justify-center rounded-full transition-all duration-200`}
                style={{ background: status === 'Home' ? colors.primaryGreen : colors.white, boxShadow: status === 'Home' ? '0 2px 8px rgba(7,99,50,0.15)' : 'none' }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M3 10.5L12 4L21 10.5" stroke={status === 'Home' ? colors.white : colors.primaryGreen} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M5 10V19C5 19.5523 5.44772 20 6 20H18C18.5523 20 19 19.5523 19 19V10" stroke={status === 'Home' ? colors.white : colors.primaryGreen} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <span className={`mt-2 text-sm font-semibold ${status === 'Home' ? 'text-white' : 'text-[#076332] opacity-70'}`}>{t('Home')}</span>
            </button>
            <button
              className={`flex flex-col items-center focus:outline-none`}
              onClick={() => handleStatusToggle('Out')}
              disabled={isSavingStatus}
            >
              <div className={`w-12 h-12 flex items-center justify-center rounded-full transition-all duration-200`}
                style={{ background: status === 'Out' ? colors.primaryGreen : colors.white, boxShadow: status === 'Out' ? '0 2px 8px rgba(7,99,50,0.15)' : 'none' }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="12" cy="6" r="2.2" fill={status === 'Out' ? colors.white : colors.primaryGreen} />
                  <path d="M12 8.5V13.5" stroke={status === 'Out' ? colors.white : colors.primaryGreen} strokeWidth="2" strokeLinecap="round" />
                  <path d="M12 13.5L9.5 19" stroke={status === 'Out' ? colors.white : colors.primaryGreen} strokeWidth="2" strokeLinecap="round" />
                  <path d="M12 13.5L14.5 19" stroke={status === 'Out' ? colors.white : colors.primaryGreen} strokeWidth="2" strokeLinecap="round" />
                  <path d="M12 10.5L15 12.5" stroke={status === 'Out' ? colors.white : colors.primaryGreen} strokeWidth="2" strokeLinecap="round" />
                  <path d="M12 10.5L10 12.5" stroke={status === 'Out' ? colors.white : colors.primaryGreen} strokeWidth="2" strokeLinecap="round" />
                  <path d="M14.5 19C14.5 19 15 20 16 20" stroke={status === 'Out' ? colors.white : colors.primaryGreen} strokeWidth="2" strokeLinecap="round" />
                  <path d="M9.5 19C9.5 19 9 20 8 20" stroke={status === 'Out' ? colors.white : colors.primaryGreen} strokeWidth="2" strokeLinecap="round" />
                </svg>
              </div>
              <span className={`mt-2 text-sm font-semibold ${status === 'Out' ? 'text-white' : 'text-[#076332] opacity-70'}`}>{t('Out')}</span>
            </button>
            <button
              className={`flex flex-col items-center focus:outline-none`}
              onClick={() => handleStatusToggle('In base')}
              disabled={isSavingStatus}
            >
              <div className={`w-12 h-12 flex items-center justify-center rounded-full transition-all duration-200`}
                style={{ background: status === 'In base' ? colors.primaryGreen : colors.white, boxShadow: status === 'In base' ? '0 2px 8px rgba(7,99,50,0.15)' : 'none' }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 2C8 2 5 5 5 9V12C5 13.1 5.9 14 7 14H17C18.1 14 19 13.1 19 12V9C19 5 16 2 12 2Z" fill={status === 'In base' ? colors.white : colors.primaryGreen}/>
                  <path d="M8 14V16C8 17.1 8.9 18 10 18H14C15.1 18 16 17.1 16 16V14" stroke={status === 'In base' ? colors.white : colors.primaryGreen} strokeWidth="2" strokeLinecap="round"/>
                  <path d="M10 8H14" stroke={status === 'In base' ? colors.white : colors.primaryGreen} strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </div>
              <span className={`mt-2 text-sm font-semibold ${status === 'In base' ? 'text-white' : 'text-[#076332] opacity-70'}`}>{t('In base')}</span>
            </button>
            <button
              className={`flex flex-col items-center focus:outline-none`}
              onClick={() => handleStatusToggle('Abroad')}
              disabled={isSavingStatus}
            >
              <div className={`w-12 h-12 flex items-center justify-center rounded-full transition-all duration-200`}
                style={{ background: status === 'Abroad' ? colors.primaryGreen : colors.white, boxShadow: status === 'Abroad' ? '0 2px 8px rgba(7,99,50,0.15)' : 'none' }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M21 16V14L13 9V3.5C13 2.67 12.33 2 11.5 2S10 2.67 10 3.5V9L2 14V16L10 13.5V19L8 20.5V22L11.5 21L15 22V20.5L13 19V13.5L21 16Z" fill={status === 'Abroad' ? colors.white : colors.primaryGreen}/>
                </svg>
              </div>
              <span className={`mt-2 text-sm font-semibold ${status === 'Abroad' ? 'text-white' : 'text-[#076332] opacity-70'}`}>{t('Abroad')}</span>
            </button>
          </div>
          {/* Clean My Room feature temporarily disabled */}
          {CLEAN_ROOM_FEATURE_ENABLED && (
            <button
              className="w-full rounded-lg px-4 py-2 text-center font-medium flex items-center justify-center gap-2"
              style={{ background: colors.gold, color: colors.white }}
              onClick={() => setLeftForBaseModalOpen(true)}
            >
              <svg width="20" height="20" fill="none" viewBox="0 0 24 24"><path d="M3 21V7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v14" stroke={colors.white} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><rect x="7" y="10" width="3" height="7" rx="1" fill={colors.white}/><rect x="14" y="10" width="3" height="7" rx="1" fill={colors.white}/></svg>
              {t('cleanMyRoom', 'Clean My Room')}
            </button>
          )}
          </>)}
        </div>

        {/* Events Section */}
        <div className="mb-8 rounded-xl overflow-hidden" style={thinGoldWrap}>
          <div className="flex items-center px-4 py-3 shadow-sm select-none" style={{ background: colors.sectionBg, color: colors.white }}>
            <span className="font-semibold text-lg flex-1 text-start" style={{ color: colors.white }} dir={isRTL ? 'rtl' : 'ltr'}>
              {t('upcomingEvents')}
            </span>
          </div>
          <div className="p-5" style={{ background: 'rgba(0,0,0,0.18)' }}>
            {loadingEvents ? (
              <div className="flex justify-center py-3">
                <HouseLoader size={48} text={t('loading')} />
              </div>
            ) : futureEvents.length === 0 ? (
              <div className="text-center text-muted py-3">{t('noUpcomingEvents')}</div>
            ) : (<>
              {(showAllEvents ? futureEvents : futureEvents.slice(0, 1)).map(event => (
                <div key={event.id} className="relative mb-5 bg-blue-50 rounded-xl shadow-md p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-xl text-[#076332] mb-3 leading-tight line-clamp-2">{event.title}</div>
                      {event.body && <div className="text-base font-medium text-gray-700 mb-4 leading-relaxed line-clamp-2">{event.body}</div>}
                      {(event.startTime || event.endTime) && (() => {
                        const fmt = (ts) => {
                          const d = new Date(ts.seconds ? ts.seconds * 1000 : ts);
                          const date = d.toLocaleDateString(dateLocale, { weekday: 'short', month: 'short', day: 'numeric' });
                          const time = d.toLocaleTimeString(dateLocale, { hour: '2-digit', minute: '2-digit', hour12: false });
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
                      {(() => {
                        const uid = auth.currentUser?.uid;
                        const responseType = event.coming?.find(r => r.userId === uid) ? 'coming' :
                                             event.maybe?.find(r => r.userId === uid) ? 'maybe' :
                                             event.notComing?.find(r => r.userId === uid) ? 'notComing' : null;
                        if (!responseType) return null;

                        const cfg = {
                          coming:    { icon: '✓', color: colors.primaryGreen, label: t('coming') },
                          maybe:     { icon: '?', color: colors.gold, label: t('maybe') },
                          notComing: { icon: '✕', color: colors.red, label: t('notComing') },
                        }[responseType];

                        return (
                          <div
                            className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-xl"
                            style={{ backgroundColor: cfg.color + '14' }}
                          >
                            <span
                              className="w-5 h-5 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                              style={{ backgroundColor: cfg.color }}
                            >
                              {cfg.icon}
                            </span>
                            <span className="text-sm font-semibold" style={{ color: cfg.color }}>
                              {cfg.label}
                            </span>
                          </div>
                        );
                      })()}
                    </div>
                    <div className="flex-shrink-0 flex items-center">
                      <button
                        className="px-4 py-2 rounded-lg bg-[#EDC381] text-white font-semibold text-sm shadow-md hover:bg-[#D4A574] transition-colors"
                        onClick={() => { setSelectedEvent(event); setModalOpen(true); }}
                      >
                        {t('respond')}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
              {futureEvents.length > 1 && (
                <button
                  className="w-full text-center py-2 text-sm font-semibold rounded-lg transition-colors"
                  style={{ color: colors.gold }}
                  onClick={() => setShowAllEvents(prev => !prev)}
                >
                  {showAllEvents ? t('showLess') : t('seeMore', { count: futureEvents.length - 1 })}
                </button>
              )}
            </>)}
          </div>
        </div>

        {/* Surveys Section */}
        <div className="mb-8 rounded-xl overflow-hidden" style={thinGoldWrap}>
          <div className="flex items-center px-4 py-3 shadow-sm select-none" style={{ background: colors.sectionBg, color: colors.white }}>
            <span className="font-semibold text-lg flex-1 text-start" style={{ color: colors.white }} dir={isRTL ? 'rtl' : 'ltr'}>
              {t('surveysToFill')}
            </span>
          </div>
          <div className="p-5" style={{ background: 'rgba(0,0,0,0.18)' }}>
            {loadingSurveys ? (
              <div className="flex justify-center py-3">
                <HouseLoader size={48} text={t('loading')} />
              </div>
            ) : futureSurveys.length === 0 ? (
              <div className="text-center text-muted py-3">{t('noSurveys')}</div>
            ) : (<>
              {(showAllSurveys ? futureSurveys : futureSurveys.slice(0, 1)).map(survey => (
                <div key={survey.id} className="relative mb-5 bg-blue-50 rounded-xl shadow-md p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-xl text-[#076332] mb-3 leading-tight line-clamp-2">{survey.title}</div>
                      {survey.body && <div className="text-base font-medium text-gray-700 mb-4 leading-relaxed line-clamp-2">{survey.body}</div>}
                      {survey.endTime && (
                        <div className="text-sm font-semibold text-gray-600" dir="auto">
                          {t('due_date_label')}{' '}
                          {new Date(survey.endTime.seconds ? survey.endTime.seconds * 1000 : survey.endTime).toLocaleDateString(dateLocale, {
                            weekday: 'short',
                            month: 'short',
                            day: 'numeric',
                          })}
                        </div>
                      )}
                    </div>
                    <div className="flex-shrink-0 flex items-center gap-2">
                      <button
                        className="px-4 py-2 rounded-lg bg-[#EDC381] text-white font-semibold text-sm shadow-md hover:bg-[#D4A574] transition-colors"
                        onClick={() => {
                          if (!survey.link || survey.link.trim() === '') {
                            setSelectedSurvey(survey);
                            setSurveyModalOpen(true);
                            setSurveyLinkCopied(false);
                            return;
                          }
                          let linkUrl = survey.link.trim();
                          if (!linkUrl.startsWith('http://') && !linkUrl.startsWith('https://')) {
                            linkUrl = 'https://' + linkUrl;
                          }
                          window.open(linkUrl, '_blank', 'noopener,noreferrer');
                        }}
                      >
                        {t('fillNow')}
                      </button>
                      {survey.link && survey.link.trim() !== '' && (
                        <button
                          className="p-2 rounded-lg hover:bg-gray-200 transition-colors"
                          title={t('copyLink')}
                          onClick={() => {
                            let linkUrl = survey.link.trim();
                            if (!linkUrl.startsWith('http://') && !linkUrl.startsWith('https://')) {
                              linkUrl = 'https://' + linkUrl;
                            }
                            setSelectedSurvey({ ...survey, resolvedLink: linkUrl });
                            setSurveyModalOpen(true);
                            setSurveyLinkCopied(false);
                          }}
                        >
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" stroke="#6B7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" stroke="#6B7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              {futureSurveys.length > 1 && (
                <button
                  className="w-full text-center py-2 text-sm font-semibold rounded-lg transition-colors"
                  style={{ color: colors.gold }}
                  onClick={() => setShowAllSurveys(prev => !prev)}
                >
                  {showAllSurveys ? t('showLess') : t('seeMore', { count: futureSurveys.length - 1 })}
                </button>
              )}
            </>)}
          </div>
        </div>

        {/* Messages Section */}
        <div className="mb-8 rounded-xl overflow-hidden" style={thinGoldWrap}>
          <div className="flex items-center px-4 py-3 shadow-sm select-none" style={{ background: colors.sectionBg, color: colors.white }}>
            <span className="font-semibold text-lg flex-1 text-start" style={{ color: colors.white }} dir={isRTL ? 'rtl' : 'ltr'}>
              {t('importantMessages')}
            </span>
          </div>
          <div className="p-5" style={{ background: 'rgba(0,0,0,0.18)' }}>
            {loadingMessages ? (
              <div className="flex justify-center py-3">
                <HouseLoader size={48} text={t('loading')} />
              </div>
            ) : futureMessages.length === 0 ? (
              <div className="text-center text-muted py-3">{t('no_important_messages')}</div>
            ) : (<>
              {(showAllMessages ? futureMessages : futureMessages.slice(0, 1)).map(message => (
                <div key={message.id} className="relative mb-5 bg-blue-50 rounded-xl shadow-md p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 pr-4">
                      <div className="font-bold text-xl text-[#076332] mb-3 leading-tight line-clamp-2">{message.title}</div>
                      {message.body && <div className="text-base font-medium text-gray-700 mb-4 leading-relaxed line-clamp-2">{message.body}</div>}
                      {(message.startTime || message.endTime) && (() => {
                        const fmt = (ts) => {
                          const d = new Date(ts.seconds ? ts.seconds * 1000 : ts);
                          const date = d.toLocaleDateString(dateLocale, { weekday: 'short', month: 'short', day: 'numeric' });
                          const time = d.toLocaleTimeString(dateLocale, { hour: '2-digit', minute: '2-digit', hour12: false });
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
                  </div>
                </div>
              ))}
              {futureMessages.length > 1 && (
                <button
                  className="w-full text-center py-2 text-sm font-semibold rounded-lg transition-colors"
                  style={{ color: colors.gold }}
                  onClick={() => setShowAllMessages(prev => !prev)}
                >
                  {showAllMessages ? t('showLess') : t('seeMore', { count: futureMessages.length - 1 })}
                </button>
              )}
            </>)}
          </div>
        </div>
      </div>


      {/* Event Response Modal */}
      {modalOpen && (() => {
        const responseOptions = [
          { key: 'coming', icon: '✓', bg: colors.primaryGreen, label: t('coming') },
          { key: 'maybe', icon: '?', bg: colors.gold, label: t('maybe') },
          { key: 'notComing', icon: '✕', bg: colors.red, label: t('notComing') },
        ];
        const confirmMessages = {
          coming: t('response_confirmed_coming'),
          maybe: t('response_confirmed_maybe'),
          notComing: t('response_confirmed_not_coming'),
        };
        const activeOption = responseOptions.find(o => o.key === eventResponse);

        return (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div
              className="w-full max-w-sm rounded-3xl shadow-2xl relative overflow-hidden"
              style={{ backgroundColor: colors.surface }}
            >
              <button
                className={`absolute top-4 w-8 h-8 flex items-center justify-center rounded-full transition-colors z-10 ${isRTL ? 'left-4' : 'right-4'}`}
                style={{ backgroundColor: colors.gray400 + '33' }}
                onClick={() => setModalOpen(false)}
              >
                <span className="text-gray-500 text-lg leading-none">✕</span>
              </button>

              <div className="px-6 pt-6 pb-2">
                <h2 className={`text-xl font-bold ${isRTL ? 'pl-8' : 'pr-8'}`} style={{ color: colors.primaryGreen }} dir="auto">
                  {selectedEvent?.title}
                </h2>
              </div>

              <div className="px-6 pb-6 pt-2">
                {eventResponse ? (
                  <div className="text-center py-4">
                    <div
                      className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
                      style={{ backgroundColor: activeOption?.bg }}
                    >
                      <span className="text-white text-2xl font-bold">{activeOption?.icon}</span>
                    </div>
                    <h3 className="text-lg font-bold mb-2" style={{ color: activeOption?.bg }}>
                      {activeOption?.label}
                    </h3>
                    <p className="text-sm" style={{ color: colors.muted }} dir="auto">
                      {confirmMessages[eventResponse]}
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-3 mt-2">
                    <p className="text-sm text-center mb-1" style={{ color: colors.muted }} dir="auto">
                      {t('respond_prompt')}
                    </p>
                    {responseOptions.map(({ key, icon, bg, label }) => (
                      <button
                        key={key}
                        className="w-full py-3.5 rounded-2xl font-semibold text-base flex items-center justify-center gap-2 text-white transition-all duration-150 active:scale-[0.97] shadow-sm hover:shadow-md"
                        style={{ backgroundColor: bg, flexDirection: isRTL ? 'row-reverse' : 'row' }}
                        onClick={() => handleEventResponse(key)}
                        disabled={isSavingEventResponse}
                      >
                        <span className="text-lg leading-none">{icon}</span>
                        {label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}
      <BottomNavBar active="home" />

      {surveyModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 shadow-xl w-full max-w-sm">
            <h2 className="text-lg font-bold mb-4 text-center" style={{ color: colors.primaryGreen }} dir="auto">{selectedSurvey?.title}</h2>
            {(!selectedSurvey?.link || selectedSurvey.link.trim() === '') && !selectedSurvey?.resolvedLink ? (
              <p className="text-center text-gray-600 mb-4">{t('noSurveyLink')}</p>
            ) : (
              <div className="mb-4">
                <p className="text-sm text-gray-600 mb-2 text-center">{t('surveyLinkBlocked')}</p>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={selectedSurvey?.resolvedLink || selectedSurvey?.link || ''}
                    className="flex-1 px-3 py-2 border rounded-lg bg-gray-50 text-sm text-gray-700 truncate"
                  />
                  <button
                    className="px-3 py-2 rounded-lg text-white font-semibold text-sm shrink-0"
                    style={{ background: surveyLinkCopied ? colors.primaryGreen : colors.gold }}
                    onClick={() => {
                      navigator.clipboard.writeText(selectedSurvey?.resolvedLink || selectedSurvey?.link || '');
                      setSurveyLinkCopied(true);
                      setTimeout(() => setSurveyLinkCopied(false), 2000);
                    }}
                  >
                    {surveyLinkCopied ? t('copied') : t('copyLink')}
                  </button>
                </div>
              </div>
            )}
            <button
              className="w-full mt-2 py-2 text-gray-500 hover:text-gray-700 transition-colors text-sm font-medium"
              onClick={() => setSurveyModalOpen(false)}
            >
              {t('close')}
            </button>
          </div>
        </div>
      )}

      {CLEAN_ROOM_FEATURE_ENABLED && leftForBaseModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="rounded-3xl p-8 shadow-lg min-w-[320px] w-full max-w-md" style={{ background: '#fff' }}>
            <div className="rounded-xl mb-6 px-4 py-3" style={{ background: '#fff' }}>
              <h2 className="text-2xl font-bold text-black text-center">{t('cleanMyRoom', 'Clean My Room')}</h2>
            </div>
            <div className="flex flex-col gap-8">
              <div className="flex items-center justify-between">
                <span className="font-medium text-black">{t('cleanRoom')}</span>
                <button
                  className={`w-14 h-8 rounded-full flex items-center transition-colors duration-200`}
                  onClick={() => setCleanRoom(val => !val)}
                  style={{ background: cleanRoom ? colors.gold : '#4B5563', padding: 0 }}
                >
                  <span
                    className={`w-7 h-7 bg-white rounded-full shadow-md transform transition-transform duration-200 ${cleanRoom ? 'translate-x-6' : 'translate-x-1'}`}
                    style={{ display: 'inline-block' }}
                  />
                </button>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-medium text-black">{t('changeSheets')}</span>
                <button
                  className={`w-14 h-8 rounded-full flex items-center transition-colors duration-200`}
                  onClick={() => setChangeSheets(val => !val)}
                  style={{ background: changeSheets ? colors.gold : '#4B5563', padding: 0 }}
                >
                  <span
                    className={`w-7 h-7 bg-white rounded-full shadow-md transform transition-transform duration-200 ${changeSheets ? 'translate-x-6' : 'translate-x-1'}`}
                    style={{ display: 'inline-block' }}
                  />
                </button>
              </div>
              <button
                className="mt-2 underline text-lg text-black"
                onClick={() => setLeftForBaseModalOpen(false)}
              >
                {t('close')}
              </button>
            </div>
          </div>
        </div>
      )}
      
    </main>
  );
}
