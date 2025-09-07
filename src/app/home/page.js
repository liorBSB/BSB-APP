'use client';

import '@/i18n';
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import i18n from '@/i18n';
import { doc, updateDoc, collection, getDoc, getDocs, query, where, orderBy, onSnapshot, arrayUnion, arrayRemove } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import WelcomeHeader from '@/components/home/WelcomeHeader';
import CollapsibleSection from '@/components/home/CollapsibleSection';
import ListItem from '@/components/home/ListItem';
import { onAuthStateChanged } from 'firebase/auth';
import EventResponseModal from '@/components/home/EventResponseModal';
import BottomNavBar from '@/components/BottomNavBar';
import colors from '../colors';
import useAuthRedirect from '@/hooks/useAuthRedirect';
import { useRouter } from 'next/navigation';


export default function HomePage() {
  const router = useRouter();
  const [isCheckingProfile, setIsCheckingProfile] = useState(true);
  const [profileComplete, setProfileComplete] = useState(false);
  useAuthRedirect(true);
  const { t } = useTranslation('home');
  const [status, setStatus] = useState('home');
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
  const isRTL = i18n.language === 'he';

  // Check if user profile is complete
  const checkUserProfileComplete = (userData) => {
    if (!userData) return false;
    return !!(userData.fullName && userData.roomNumber);
  };



  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      let unsubscribeUser = null;
      if (user) {
        const userRef = doc(db, 'users', user.uid);

        // Initial fetch (optional)
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          const data = userSnap.data();
          setUserData(data);
          const isComplete = checkUserProfileComplete(data);
          setProfileComplete(isComplete);
          if (!isComplete) {
            router.push('/profile-setup');
            setLoadingUser(false);
            setIsCheckingProfile(false);
            return;
          }
        } else {
          router.push('/profile-setup');
          setLoadingUser(false);
          setIsCheckingProfile(false);
          return;
        }

        // Live updates for user data (progress bar updates in real-time)
        unsubscribeUser = onSnapshot(
          userRef,
          (snap) => {
            if (snap.exists()) {
              setUserData(snap.data());
            }
          },
          (error) => {
            // Handle permission errors gracefully and keep page functional
            console.error('User onSnapshot error:', error);
          }
        );
      }
      setLoadingUser(false);
      setIsCheckingProfile(false);

      // Cleanup previous user listener when auth changes
      return () => {
        if (unsubscribeUser) unsubscribeUser();
      };
    });
    return () => {
      if (typeof unsubscribeAuth === 'function') unsubscribeAuth();
    };
  }, [router]);

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
    // Only fetch data if profile is complete
    if (!profileComplete) return;

    // Temporarily disabled until new system is ready
    // const fetchSoldierData = async () => {
    //   try {
    //     const user = auth.currentUser;
    //     if (user) {
    //       const soldier = await getSoldier(user.uid);
    //       const profile = await getSoldierProfile(user.uid);
    //       
    //       setSoldierData(soldier);
    //       setProfileData(profile);
    //       
    //       if (profile?.answers) {
    //         setAnsweredQuestions(Object.keys(profile.answers));
    //       }
    //     }
    //   } catch (error) {
    //     console.error('Error loading soldier data:', error);
    //   }
    // };

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

    // fetchSoldierData(); // Temporarily disabled
    fetchEvents();
    fetchSurveys();
    fetchMessages();
  }, [profileComplete]);

  const handleStatusToggle = async (newStatus) => {
    setStatus(newStatus);
    const uid = auth.currentUser?.uid;
    if (uid) {
      const userRef = doc(db, 'users', uid);
      await updateDoc(userRef, { status: newStatus });
    }
  };

  const handleLanguageSwitch = () => {
    const nextLang = i18n.language === 'en' ? 'he' : 'en';
    i18n.changeLanguage(nextLang);
    document.documentElement.dir = nextLang === 'he' ? 'rtl' : 'ltr';
  };

  const handleEventResponse = async (response) => {
    if (!selectedEvent || !auth.currentUser) return;
    
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
      }, 2000);
    } catch (error) {
      console.error('Error saving event response:', error);
      // Still show feedback even if save fails
      setEventResponse(response);
      setTimeout(() => {
        setModalOpen(false);
        setEventResponse(null);
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

  // Show loading state while checking profile
  if (isCheckingProfile) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-blue-200/60 to-green-100/60 font-body flex items-center justify-center">
        <div className="text-center text-muted">Loading...</div>
      </main>
    );
  }

  // Show profile incomplete message
  if (!profileComplete) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-blue-200/60 to-green-100/60 font-body flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <div className="text-2xl font-bold text-red-600 mb-4">⚠️ Profile Incomplete</div>
          <div className="text-muted mb-6">
            Your profile needs to be completed before you can use the app. 
            Please set up your profile with your name and room number.
          </div>
          <button
            onClick={() => router.push('/profile-setup')}
            style={{
              background: colors.primaryGreen,
              color: colors.white,
              padding: '12px 24px',
              borderRadius: '999px',
              border: 'none',
              fontSize: '16px',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            Complete Profile Setup
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-200/60 to-green-100/60 font-body flex flex-col items-center pt-6 pb-32 px-4">
      <div className="w-full max-w-md">
        {loadingUser ? (
          <div className="text-center text-muted py-4">Loading...</div>
        ) : (
          <WelcomeHeader status={status} userData={userData} />
        )}

        

        {/* Status Switcher */}
        <div className="rounded-2xl p-4 flex flex-col items-center mb-6 shadow-sm" style={{ background: colors.sectionBg, color: colors.primaryGreen }}>
          <div className="grid grid-cols-2 gap-4 w-full mb-4">
            <button
              className={`flex flex-col items-center focus:outline-none`}
              onClick={() => handleStatusToggle('home')}
            >
              <div className={`w-12 h-12 flex items-center justify-center rounded-full transition-all duration-200`}
                style={{ background: status === 'home' ? colors.primaryGreen : colors.white, boxShadow: status === 'home' ? '0 2px 8px rgba(7,99,50,0.15)' : 'none' }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M3 10.5L12 4L21 10.5" stroke={status === 'home' ? colors.white : colors.primaryGreen} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M5 10V19C5 19.5523 5.44772 20 6 20H18C18.5523 20 19 19.5523 19 19V10" stroke={status === 'home' ? colors.white : colors.primaryGreen} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <span className={`mt-2 text-sm font-semibold ${status === 'home' ? 'text-white' : 'text-[#076332] opacity-70'}`}>{t('home')}</span>
            </button>
            <button
              className={`flex flex-col items-center focus:outline-none`}
              onClick={() => handleStatusToggle('away')}
            >
              <div className={`w-12 h-12 flex items-center justify-center rounded-full transition-all duration-200`}
                style={{ background: status === 'away' ? colors.primaryGreen : colors.white, boxShadow: status === 'away' ? '0 2px 8px rgba(7,99,50,0.15)' : 'none' }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="12" cy="6" r="2.2" fill={status === 'away' ? colors.white : colors.primaryGreen} />
                  <path d="M12 8.5V13.5" stroke={status === 'away' ? colors.white : colors.primaryGreen} strokeWidth="2" strokeLinecap="round" />
                  <path d="M12 13.5L9.5 19" stroke={status === 'away' ? colors.white : colors.primaryGreen} strokeWidth="2" strokeLinecap="round" />
                  <path d="M12 13.5L14.5 19" stroke={status === 'away' ? colors.white : colors.primaryGreen} strokeWidth="2" strokeLinecap="round" />
                  <path d="M12 10.5L15 12.5" stroke={status === 'away' ? colors.white : colors.primaryGreen} strokeWidth="2" strokeLinecap="round" />
                  <path d="M12 10.5L10 12.5" stroke={status === 'away' ? colors.white : colors.primaryGreen} strokeWidth="2" strokeLinecap="round" />
                  <path d="M14.5 19C14.5 19 15 20 16 20" stroke={status === 'away' ? colors.white : colors.primaryGreen} strokeWidth="2" strokeLinecap="round" />
                  <path d="M9.5 19C9.5 19 9 20 8 20" stroke={status === 'away' ? colors.white : colors.primaryGreen} strokeWidth="2" strokeLinecap="round" />
                </svg>
              </div>
              <span className={`mt-2 text-sm font-semibold ${status === 'away' ? 'text-white' : 'text-[#076332] opacity-70'}`}>{t('away')}</span>
            </button>
            <button
              className={`flex flex-col items-center focus:outline-none`}
              onClick={() => handleStatusToggle('in base')}
            >
              <div className={`w-12 h-12 flex items-center justify-center rounded-full transition-all duration-200`}
                style={{ background: status === 'in base' ? colors.primaryGreen : colors.white, boxShadow: status === 'in base' ? '0 2px 8px rgba(7,99,50,0.15)' : 'none' }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 2C8 2 5 5 5 9V12C5 13.1 5.9 14 7 14H17C18.1 14 19 13.1 19 12V9C19 5 16 2 12 2Z" fill={status === 'in base' ? colors.white : colors.primaryGreen}/>
                  <path d="M8 14V16C8 17.1 8.9 18 10 18H14C15.1 18 16 17.1 16 16V14" stroke={status === 'in base' ? colors.white : colors.primaryGreen} strokeWidth="2" strokeLinecap="round"/>
                  <path d="M10 8H14" stroke={status === 'in base' ? colors.white : colors.primaryGreen} strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </div>
              <span className={`mt-2 text-sm font-semibold ${status === 'in base' ? 'text-white' : 'text-[#076332] opacity-70'}`}>{t('in_base', 'In Base')}</span>
            </button>
            <button
              className={`flex flex-col items-center focus:outline-none`}
              onClick={() => handleStatusToggle('abroad')}
            >
              <div className={`w-12 h-12 flex items-center justify-center rounded-full transition-all duration-200`}
                style={{ background: status === 'abroad' ? colors.primaryGreen : colors.white, boxShadow: status === 'abroad' ? '0 2px 8px rgba(7,99,50,0.15)' : 'none' }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M21 16V14L13 9V3.5C13 2.67 12.33 2 11.5 2S10 2.67 10 3.5V9L2 14V16L10 13.5V19L8 20.5V22L11.5 21L15 22V20.5L13 19V13.5L21 16Z" fill={status === 'abroad' ? colors.white : colors.primaryGreen}/>
                </svg>
              </div>
              <span className={`mt-2 text-sm font-semibold ${status === 'abroad' ? 'text-white' : 'text-[#076332] opacity-70'}`}>{t('abroad', 'Abroad')}</span>
            </button>
          </div>
          {/* Gold Banner */}
          <button
            className="w-full rounded-lg px-4 py-2 text-center font-medium flex items-center justify-center gap-2"
            style={{ background: colors.gold, color: colors.white }}
            onClick={() => setLeftForBaseModalOpen(true)}
          >
            <svg width="20" height="20" fill="none" viewBox="0 0 24 24"><path d="M3 21V7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v14" stroke={colors.white} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><rect x="7" y="10" width="3" height="7" rx="1" fill={colors.white}/><rect x="14" y="10" width="3" height="7" rx="1" fill={colors.white}/></svg>
            {t('cleanMyRoom', 'Clean My Room')}
          </button>
        </div>

        {/* Events Section */}
        <div className="mb-8">
          <div className="flex items-center px-4 py-3 rounded-t-lg shadow-sm select-none" style={{ background: colors.sectionBg, color: colors.white }}>
            <span className="font-semibold text-lg flex-1 text-left" style={{ color: colors.white }}>
              {t('upcomingEvents')}
            </span>
          </div>
          <div className="rounded-b-lg p-5" style={{ background: 'rgba(0,0,0,0.18)' }}>
            {loadingEvents ? (
              <div className="text-center text-muted py-3">{t('loading')}</div>
            ) : futureEvents.length === 0 ? (
              <div className="text-center text-muted py-3">{t('noUpcomingEvents')}</div>
            ) : (
              futureEvents.map(event => (
                <div key={event.id} className="relative mb-5 bg-blue-50 rounded-xl shadow-md p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
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
                      {(() => {
                        const userResponse = event.coming?.find(r => r.userId === auth.currentUser?.uid) ||
                                           event.maybe?.find(r => r.userId === auth.currentUser?.uid) ||
                                           event.notComing?.find(r => r.userId === auth.currentUser?.uid);
                        
                        if (userResponse) {
                          const responseType = event.coming?.find(r => r.userId === auth.currentUser?.uid) ? 'coming' :
                                             event.maybe?.find(r => r.userId === auth.currentUser?.uid) ? 'maybe' : 'notComing';
                          return (
                            <div className="mt-3 flex items-center gap-2">
                              <span className="text-sm font-medium text-gray-700">Your response:</span>
                              <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                                responseType === 'coming' ? 'bg-green-100 text-green-800' :
                                responseType === 'maybe' ? 'bg-yellow-100 text-yellow-800' :
                                'bg-red-100 text-red-800'
                              }`}>
                                {responseType === 'coming' && '✅ Coming'}
                                {responseType === 'maybe' && '🤔 Maybe'}
                                {responseType === 'notComing' && '❌ Not Coming'}
                              </span>
                            </div>
                          );
                        }
                        return null;
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
              ))
            )}
          </div>
        </div>

        {/* Surveys Section */}
        <div className="mb-8">
          <div className="flex items-center px-4 py-3 rounded-t-lg shadow-sm select-none" style={{ background: colors.sectionBg, color: colors.white }}>
            <span className="font-semibold text-lg flex-1 text-left" style={{ color: colors.white }}>
              {t('surveysToFill')}
            </span>
          </div>
          <div className="rounded-b-lg p-5" style={{ background: 'rgba(0,0,0,0.18)' }}>
            {loadingSurveys ? (
              <div className="text-center text-muted py-3">{t('loading')}</div>
            ) : futureSurveys.length === 0 ? (
              <div className="text-center text-muted py-3">{t('noSurveys')}</div>
            ) : (
              futureSurveys.map(survey => (
                <div key={survey.id} className="relative mb-5 bg-blue-50 rounded-xl shadow-md p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-xl text-[#076332] mb-3 leading-tight line-clamp-2">{survey.title}</div>
                      {survey.body && <div className="text-base font-medium text-gray-700 mb-4 leading-relaxed line-clamp-2">{survey.body}</div>}
                      {survey.endTime && (
                        <div className="text-sm font-semibold text-gray-600">
                          Due Date: {new Date(survey.endTime.seconds ? survey.endTime.seconds * 1000 : survey.endTime).toLocaleDateString('en-US', { 
                            weekday: 'short', 
                            month: 'short', 
                            day: 'numeric'
                          })}
                        </div>
                      )}
                    </div>
                    <div className="flex-shrink-0 flex items-center">
                      <button
                        className="px-4 py-2 rounded-lg bg-[#EDC381] text-white font-semibold text-sm shadow-md hover:bg-[#D4A574] transition-colors"
                        onClick={() => {
                          if (survey.link && survey.link.trim() !== '') {
                            // Ensure the link has a protocol
                            let linkUrl = survey.link.trim();
                            if (!linkUrl.startsWith('http://') && !linkUrl.startsWith('https://')) {
                              linkUrl = 'https://' + linkUrl;
                            }
                            window.open(linkUrl, '_blank', 'noopener,noreferrer');
                          } else {
                            setSelectedSurvey(survey);
                            setSurveyModalOpen(true);
                          }
                        }}
                      >
                        {t('fillNow')}
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Messages Section */}
        <div className="mb-8">
          <div className="flex items-center px-4 py-3 rounded-t-lg shadow-sm select-none" style={{ background: colors.sectionBg, color: colors.white }}>
            <span className="font-semibold text-lg flex-1 text-left" style={{ color: colors.white }}>
              {t('importantMessages')}
            </span>
          </div>
          <div className="rounded-b-lg p-5" style={{ background: 'rgba(0,0,0,0.18)' }}>
            {loadingMessages ? (
              <div className="text-center text-muted py-3">{t('loading')}</div>
            ) : futureMessages.length === 0 ? (
              <div className="text-center text-muted py-3">{t('no_important_messages')}</div>
            ) : (
              futureMessages.map(message => (
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
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Language Switch */}
      <button
        onClick={handleLanguageSwitch}
        className="absolute top-4 right-4 bg-surface p-2 rounded-full text-muted hover:text-text"
      >
        {i18n.language === 'en' ? 'עברית' : 'EN'}
      </button>

      {/* Render the modal at the root of the page */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-xl font-bold text-[#076332] text-center">{selectedEvent?.title}</h2>
            </div>
            
            {/* Content */}
            <div className="p-6">
              {eventResponse ? (
                <div className="text-center">
                  <div className="mb-6">
                    <div className={`inline-flex items-center justify-center w-16 h-16 rounded-full mb-4 ${
                      eventResponse === 'coming' ? 'bg-green-100' :
                      eventResponse === 'maybe' ? 'bg-yellow-100' :
                      'bg-red-100'
                    }`}>
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                        eventResponse === 'coming' ? 'bg-green-500' :
                        eventResponse === 'maybe' ? 'bg-yellow-500' :
                        'bg-red-500'
                      }`}>
                        <div className={`w-4 h-4 rounded-full ${
                          eventResponse === 'coming' ? 'bg-white' :
                          eventResponse === 'maybe' ? 'bg-white' :
                          'bg-white'
                        }`}></div>
                      </div>
                    </div>
                    <h3 className="text-lg font-semibold text-gray-800 mb-2">
                      {eventResponse === 'coming' && t('coming')}
                      {eventResponse === 'maybe' && t('maybe')}
                      {eventResponse === 'notComing' && t('notComing')}
                    </h3>
                    <p className="text-sm text-gray-600">
                      {eventResponse === 'coming' && 'Your response has been recorded. We look forward to seeing you!'}
                      {eventResponse === 'maybe' && 'Thank you for your response. We will keep you updated.'}
                      {eventResponse === 'notComing' && 'Thank you for letting us know. We hope to see you at future events.'}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-gray-700 text-center mb-6">Please let us know if you will be attending this event:</p>
                  
                  <button
                    className="w-full py-3 px-4 rounded-lg font-semibold text-white transition-all duration-200 hover:opacity-90 shadow-md"
                    style={{ background: colors.primaryGreen }}
                    onClick={() => handleEventResponse('coming')}
                  >
                    {t('coming')}
                  </button>
                  
                  <button
                    className="w-full py-3 px-4 rounded-lg font-semibold transition-all duration-200 hover:opacity-90 border-2"
                    style={{ 
                      background: 'transparent', 
                      color: colors.gold, 
                      borderColor: colors.gold 
                    }}
                    onClick={() => handleEventResponse('maybe')}
                  >
                    {t('maybe')}
                  </button>
                  
                  <button
                    className="w-full py-3 px-4 rounded-lg font-semibold transition-all duration-200 hover:opacity-90 border-2"
                    style={{ 
                      background: 'transparent', 
                      color: colors.red, 
                      borderColor: colors.red 
                    }}
                    onClick={() => handleEventResponse('notComing')}
                  >
                    {t('notComing')}
                  </button>
                </div>
              )}
            </div>
            
            {/* Footer */}
            <div className="px-6 py-4 border-t border-gray-200">
              <button
                className="w-full py-2 text-gray-500 hover:text-gray-700 transition-colors text-sm font-medium"
                onClick={() => setModalOpen(false)}
              >
                {t('close')}
              </button>
            </div>
          </div>
        </div>
      )}
      <BottomNavBar active="home" />

      {surveyModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 shadow-lg min-w-[280px]">
            <h2 className="text-lg font-bold mb-4 text-center">{selectedSurvey?.title}</h2>
            <div className="flex flex-col gap-3">
              <button
                className="font-semibold rounded px-4 py-2"
                style={{ background: colors.primaryGreen, color: colors.white }}
                onClick={() => setSurveyModalOpen(false)}
              >
                {t('coming')}
              </button>
              <button
                className="font-semibold rounded px-4 py-2"
                style={{ background: 'transparent', color: colors.black, border: `2px solid ${colors.yellow}` }}
                onClick={() => setSurveyModalOpen(false)}
              >
                {t('maybe')}
              </button>
              <button
                className="font-semibold rounded px-4 py-2"
                style={{ background: 'transparent', color: colors.black, border: `2px solid ${colors.red}` }}
                onClick={() => setSurveyModalOpen(false)}
              >
                {t('notComing')}
              </button>
              <button
                className="mt-2 text-gray-500 underline"
                onClick={() => setSurveyModalOpen(false)}
              >
                {t('close')}
              </button>
            </div>
          </div>
        </div>
      )}

      {leftForBaseModalOpen && (
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
