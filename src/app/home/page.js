'use client';

import '@/i18n';
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import i18n from '@/i18n';
import { doc, updateDoc, collection, getDoc, getDocs, query, where, orderBy } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import WelcomeHeader from '@/components/home/WelcomeHeader';
import CollapsibleSection from '@/components/home/CollapsibleSection';
import ListItem from '@/components/home/ListItem';
import { onAuthStateChanged } from 'firebase/auth';
import EventResponseModal from '@/components/home/EventResponseModal';
import BottomNavBar from '@/components/BottomNavBar';
import colors from '../colors';
import useAuthRedirect from '@/hooks/useAuthRedirect';

export default function HomePage() {
  const [isCheckingProfile, setIsCheckingProfile] = useState(true);
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
  const [leftForBaseModalOpen, setLeftForBaseModalOpen] = useState(false);
  const [cleanRoom, setCleanRoom] = useState(null);
  const [changeSheets, setChangeSheets] = useState(null);
  const [surveyModalOpen, setSurveyModalOpen] = useState(false);
  const [selectedSurvey, setSelectedSurvey] = useState(null);
  const isRTL = i18n.language === 'he';

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const userRef = doc(db, 'users', user.uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          setUserData(userSnap.data());
        }
      }
      setLoadingUser(false);
      setIsCheckingProfile(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const fetchEvents = async () => {
      setLoadingEvents(true);
      const now = new Date();
      const eventsRef = collection(db, 'events');
      const q = query(eventsRef, where('dueDate', '>=', now), orderBy('dueDate', 'asc'));
      const querySnapshot = await getDocs(q);
      setEvents(querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoadingEvents(false);
    };

    const fetchSurveys = async () => {
      setLoadingSurveys(true);
      const surveysRef = collection(db, 'surveys');
      const querySnapshot = await getDocs(surveysRef);
      setSurveys(querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoadingSurveys(false);
    };

    const fetchMessages = async () => {
      setLoadingMessages(true);
      const messagesRef = collection(db, 'messages');
      const querySnapshot = await getDocs(messagesRef);
      const messagesData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      console.log('Messages data:', messagesData);
      setMessages(messagesData);
      setLoadingMessages(false);
    };

    fetchEvents();
    fetchSurveys();
    fetchMessages();
  }, []);

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

  // Filter and sort events to only show future events, sorted by dueDate ascending
  const now = new Date();
  const futureEvents = events
    .filter(event => event.dueDate && new Date(event.dueDate.seconds * 1000) > now)
    .sort((a, b) => new Date(a.dueDate.seconds * 1000) - new Date(b.dueDate.seconds * 1000));

  // Filter and sort surveys to only show future surveys, sorted by dueDate ascending
  const futureSurveys = surveys
    .filter(survey => survey.dueDate && new Date(survey.dueDate.seconds * 1000) > now)
    .sort((a, b) => new Date(a.dueDate.seconds * 1000) - new Date(b.dueDate.seconds * 1000));

  // Filter and sort messages to only show those with future dueDate, sorted ascending
  const futureMessages = messages
    .filter(msg => msg.dueDate && new Date(msg.dueDate.seconds * 1000) > now)
    .sort((a, b) => new Date(a.dueDate.seconds * 1000) - new Date(b.dueDate.seconds * 1000));

  // Show loading state while checking profile
  if (isCheckingProfile) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-blue-200/60 to-green-100/60 font-body flex items-center justify-center">
        <div className="text-center text-muted">Loading...</div>
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

        {/* Home/Away Switcher */}
        <div className="rounded-2xl p-4 flex flex-col items-center mb-6 shadow-sm" style={{ background: colors.sectionBg, color: colors.primaryGreen }}>
          <div className="flex w-full justify-evenly mb-4">
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
          </div>
          {/* Gold Banner */}
          <button
            className="w-full rounded-lg px-4 py-2 text-center font-medium flex items-center justify-center gap-2"
            style={{ background: colors.gold, color: colors.white }}
            onClick={() => setLeftForBaseModalOpen(true)}
          >
            <svg width="20" height="20" fill="none" viewBox="0 0 24 24"><path d="M3 21V7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v14" stroke={colors.white} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><rect x="7" y="10" width="3" height="7" rx="1" fill={colors.white}/><rect x="14" y="10" width="3" height="7" rx="1" fill={colors.white}/></svg>
            {t('leftForBase')}
          </button>
        </div>

        {/* Upcoming Events */}
        <CollapsibleSection
          title={t('upcomingEvents')}
          headerBg={colors.sectionBg}
          headerText={colors.white}
          contentBg="rgba(0,0,0,0.18)"
          titleClassName="text-xl font-bold"
        >
          {loadingEvents ? (
            <div className="text-center text-muted py-2">{t('loading')}</div>
          ) : futureEvents.length === 0 ? (
            <div className="text-center text-muted py-2">{t('noUpcomingEvents')}</div>
          ) : (
            futureEvents.map((event, idx) => (
              <div key={event.id} className="relative mb-3">
                <ListItem
                  icon="📅"
                  title={event.title}
                  subtitle={event.dueDate && `When: ${new Date(event.dueDate.seconds * 1000).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit' })} ${new Date(event.dueDate.seconds * 1000).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`}
                  statusText={event.status || ''}
                  statusColor="bg-green-700"
                  titleClassName="font-bold text-lg"
                  subtitleClassName="text-white opacity-80"
                />
                <button
                  className={`absolute top-5 ${isRTL ? 'left-8' : 'right-8'} px-3 py-1 rounded-lg bg-[#EDC381] text-white font-semibold text-xs shadow-md`}
                  onClick={() => { setSelectedEvent(event); setModalOpen(true); }}
                  style={{ zIndex: 2 }}
                >
                  {t('respond')}
                </button>
              </div>
            ))
          )}
        </CollapsibleSection>

        {/* Surveys to Fill */}
        <CollapsibleSection
          title={t('surveysToFill')}
          headerBg={colors.sectionBg}
          headerText={colors.white}
          contentBg="rgba(0,0,0,0.18)"
          titleClassName="text-xl font-bold"
        >
          {loadingSurveys ? (
            <div className="text-center text-muted py-2">{t('loading')}</div>
          ) : futureSurveys.length === 0 ? (
            <div className="text-center text-muted py-2">{t('noSurveys')}</div>
          ) : (
            futureSurveys.map((survey, idx) => (
              <div key={survey.id} className="relative mb-3">
                <ListItem
                  icon="📝"
                  title={survey.title}
                  subtitle={survey.dueDate ? `Due Date: ${new Date(survey.dueDate.seconds * 1000).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit' })} ${new Date(survey.dueDate.seconds * 1000).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}` : ''}
                  statusText={''}
                  statusColor="bg-green-700"
                  titleClassName="font-bold text-lg"
                  subtitleClassName="text-white opacity-80"
                />
                <button
                  className={`absolute top-5 ${isRTL ? 'left-8' : 'right-8'} px-3 py-1 rounded-lg bg-[#EDC381] text-white font-semibold text-xs shadow-md`}
                  onClick={() => { setSelectedSurvey(survey); setSurveyModalOpen(true); }}
                  style={{ zIndex: 2 }}
                >
                  {t('fillNow')}
                </button>
              </div>
            ))
          )}
        </CollapsibleSection>

        {/* Important Messages as a horizontal carousel */}
        <div className="mb-4">
          <div className="flex items-center px-4 py-2 rounded-t-lg shadow-sm select-none" style={{ background: colors.sectionBg, color: colors.white }}>
            <span className="font-semibold text-base">{t('importantMessages')}</span>
          </div>
          <div className="rounded-b-lg p-4 overflow-x-auto flex gap-4" style={{ background: 'rgba(0,0,0,0.00)' }}>
            {loadingMessages ? (
              <div className="text-center text-muted py-2">{t('loading')}</div>
            ) : futureMessages.length === 0 ? (
              <div className="text-center text-muted py-2">{t('no_important_messages')}</div>
            ) : (
              futureMessages.map(msg => (
                <div key={msg.id} className="min-w-[220px] max-w-xs p-4 rounded-lg" style={{ background: colors.white, color: colors.primaryGreen, borderColor: colors.gray400 }}>
                  <div className="flex flex-col gap-2">
                    <h3 className="font-bold text-lg" style={{ color: colors.primaryGreen }}>{msg.title}</h3>
                    <p className="text-sm" style={{ color: colors.black }}>{msg.body}</p>
                    <div className="flex flex-col gap-1 text-xs" style={{ color: colors.gray400 }}>
                      {msg.startDate && (
                        <span>Start: {new Date(msg.startDate.seconds * 1000).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit' })} {new Date(msg.startDate.seconds * 1000).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</span>
                      )}
                      {msg.dueDate && (
                        <span>End: {new Date(msg.dueDate.seconds * 1000).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit' })} {new Date(msg.dueDate.seconds * 1000).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</span>
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
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 shadow-lg min-w-[280px]">
            <h2 className="text-lg font-bold mb-4 text-center">{selectedEvent?.title}</h2>
            <div className="flex flex-col gap-3">
              <button
                className="font-semibold rounded px-8 py-2"
                style={{ background: colors.primaryGreen, color: colors.white }}
                onClick={() => setModalOpen(false)}
              >
                {t('coming')}
              </button>
              <button
                className="font-semibold rounded px-8 py-2"
                style={{ background: 'transparent', color: colors.black, border: `1px solid ${colors.gold}` }}
                onClick={() => setModalOpen(false)}
              >
                {t('maybe')}
              </button>
              <button
                className="font-semibold rounded px-8 py-2"
                style={{ background: 'transparent', color: colors.black, border: `1px solid ${colors.red}` }}
                onClick={() => setModalOpen(false)}
              >
                Not Coming
              </button>
              <button
                className="mt-2 text-gray-500 underline"
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
                Not Coming
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
              <h2 className="text-2xl font-bold text-black text-center">{t('leftForBase')}</h2>
            </div>
            <div className="flex flex-col gap-8">
              <div className="flex items-center justify-between">
                <span className="font-medium text-black">Clean your room?</span>
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
                <span className="font-medium text-black">Change your sheets?</span>
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
