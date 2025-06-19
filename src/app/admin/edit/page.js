"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { collection, getDocs, query, orderBy, doc, updateDoc, addDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import colors from '../../colors';
import ListItem from '@/components/home/ListItem';
import AdminBottomNavBar from '@/components/AdminBottomNavBar';
import EditFieldModal from '@/components/EditFieldModal';
import PencilIcon from '@/components/PencilIcon';
import AddItemModal from '@/components/AddItemModal';

export default function AdminEditPage() {
  const router = useRouter();
  const [events, setEvents] = useState([]);
  const [surveys, setSurveys] = useState([]);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openEvents, setOpenEvents] = useState(false);
  const [openSurveys, setOpenSurveys] = useState(false);
  const [openMessages, setOpenMessages] = useState(false);
  const [editModal, setEditModal] = useState({ open: false, type: '', item: null, form: {} });
  const [showAddModal, setShowAddModal] = useState(false);
  const [modalType, setModalType] = useState('event');
  const [addLoading, setAddLoading] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const eventsQuery = query(collection(db, 'events'), orderBy('endTime', 'desc'));
        const eventsSnapshot = await getDocs(eventsQuery);
        setEvents(eventsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));

        const surveysQuery = query(collection(db, 'surveys'), orderBy('endTime', 'desc'));
        const surveysSnapshot = await getDocs(surveysQuery);
        setSurveys(surveysSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));

        const messagesQuery = query(collection(db, 'messages'), orderBy('endTime', 'desc'));
        const messagesSnapshot = await getDocs(messagesQuery);
        setMessages(messagesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));

        setLoading(false);
      } catch (error) {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

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
      await addDoc(collection(db, collectionName), data);
      setShowAddModal(false);
      setAddLoading(false);
      // refetch data
      const fetchData = async () => {
        const eventsQuery = query(collection(db, 'events'), orderBy('endTime', 'desc'));
        const eventsSnapshot = await getDocs(eventsQuery);
        setEvents(eventsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        const surveysQuery = query(collection(db, 'surveys'), orderBy('endTime', 'desc'));
        const surveysSnapshot = await getDocs(surveysQuery);
        setSurveys(surveysSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        const messagesQuery = query(collection(db, 'messages'), orderBy('endTime', 'desc'));
        const messagesSnapshot = await getDocs(messagesQuery);
        setMessages(messagesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      };
      fetchData();
    } catch (error) {
      setAddLoading(false);
      alert('Failed to add item');
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-200/60 to-green-100/60 font-body flex flex-col items-center pt-6 pb-32 px-4">
      <div className="w-full max-w-md">
        {/* Events Section */}
        <div className="mb-4">
          <div className="flex items-center px-4 py-2 rounded-t-lg shadow-sm select-none" style={{ background: colors.sectionBg, color: colors.white }}>
            <button
              className="font-semibold text-base flex-1 text-left focus:outline-none bg-transparent border-none"
              onClick={() => setOpenEvents((prev) => !prev)}
              style={{ color: colors.white }}
            >
              Events
            </button>
            <button
              onClick={() => { setModalType('event'); setShowAddModal(true); }}
              className="px-3 py-1 rounded-lg font-semibold transition focus:outline-none"
              style={{ color: colors.primaryGreen, background: 'none', boxShadow: 'none' }}
            >
              + Add event
            </button>
          </div>
          {openEvents ? (
            <div className="rounded-b-lg p-4" style={{ background: 'rgba(0,0,0,0.18)' }}>
              {loading ? (
                <div className="text-center text-muted py-2">Loading...</div>
              ) : events.length === 0 ? (
                <div className="text-center text-muted py-2">No events found</div>
              ) : (
                events.map(event => (
                  <div key={event.id} className="relative mb-3 bg-white rounded-lg shadow p-4 flex items-center gap-3">
                    <span className="text-2xl">📅</span>
                    <div className="flex-1">
                      <div className="font-bold text-lg text-[#076332]">{event.title}</div>
                      {event.body && <div className="text-sm text-gray-700">{event.body}</div>}
                      {event.endTime && (
                        <div className="text-sm font-semibold" style={{ color: '#fff', background: '#076332', borderRadius: 6, padding: '2px 8px', display: 'inline-block', marginTop: 4 }}>
                          When: {new Date(event.endTime.seconds ? event.endTime.seconds * 1000 : event.endTime).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit' })} {new Date(event.endTime.seconds ? event.endTime.seconds * 1000 : event.endTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      )}
                    </div>
                    <button onClick={() => handleEditClick('event', event)} className="ml-2 p-2 rounded-full hover:bg-gray-100">
                      <PencilIcon />
                    </button>
                  </div>
                ))
              )}
            </div>
          ) : (
            events.length > 0 && (
              <div className="rounded-b-lg p-4" style={{ background: 'rgba(0,0,0,0.18)' }}>
                <div className="relative mb-3 bg-white rounded-lg shadow p-4 flex items-center gap-3">
                  <span className="text-2xl">📅</span>
                  <div className="flex-1">
                    <div className="font-bold text-lg text-[#076332]">{events[0].title}</div>
                    {events[0].body && <div className="text-sm text-gray-700">{events[0].body}</div>}
                    {events[0].endTime && (
                      <div className="text-sm font-semibold" style={{ color: '#fff', background: '#076332', borderRadius: 6, padding: '2px 8px', display: 'inline-block', marginTop: 4 }}>
                        When: {new Date(events[0].endTime.seconds ? events[0].endTime.seconds * 1000 : events[0].endTime).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit' })} {new Date(events[0].endTime.seconds ? events[0].endTime.seconds * 1000 : events[0].endTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    )}
                  </div>
                  <button onClick={() => handleEditClick('event', events[0])} className="ml-2 p-2 rounded-full hover:bg-gray-100">
                    <PencilIcon />
                  </button>
                </div>
              </div>
            )
          )}
        </div>

        {/* Surveys Section */}
        <div className="mb-4">
          <div className="flex items-center px-4 py-2 rounded-t-lg shadow-sm select-none" style={{ background: colors.sectionBg, color: colors.white }}>
            <button
              className="font-semibold text-base flex-1 text-left focus:outline-none bg-transparent border-none"
              onClick={() => setOpenSurveys((prev) => !prev)}
              style={{ color: colors.white }}
            >
              Surveys
            </button>
            <button
              onClick={() => { setModalType('survey'); setShowAddModal(true); }}
              className="px-3 py-1 rounded-lg font-semibold transition focus:outline-none"
              style={{ color: colors.primaryGreen, background: 'none', boxShadow: 'none' }}
            >
              + Add survey
            </button>
          </div>
          {openSurveys ? (
            <div className="rounded-b-lg p-4" style={{ background: 'rgba(0,0,0,0.18)' }}>
              {loading ? (
                <div className="text-center text-muted py-2">Loading...</div>
              ) : surveys.length === 0 ? (
                <div className="text-center text-muted py-2">No surveys found</div>
              ) : (
                surveys.map(survey => (
                  <div key={survey.id} className="relative mb-3 bg-white rounded-lg shadow p-4 flex items-center gap-3">
                    <span className="text-2xl">📝</span>
                    <div className="flex-1">
                      <div className="font-bold text-lg text-[#076332]">{survey.title}</div>
                      {survey.body && <div className="text-sm text-gray-700">{survey.body}</div>}
                      {survey.endTime && (
                        <div className="text-sm font-semibold" style={{ color: '#fff', background: '#076332', borderRadius: 6, padding: '2px 8px', display: 'inline-block', marginTop: 4 }}>
                          Due Date: {new Date(survey.endTime.seconds ? survey.endTime.seconds * 1000 : survey.endTime).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit' })} {new Date(survey.endTime.seconds ? survey.endTime.seconds * 1000 : survey.endTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      )}
                    </div>
                    <button onClick={() => handleEditClick('survey', survey)} className="ml-2 p-2 rounded-full hover:bg-gray-100">
                      <PencilIcon />
                    </button>
                  </div>
                ))
              )}
            </div>
          ) : (
            surveys.length > 0 && (
              <div className="rounded-b-lg p-4" style={{ background: 'rgba(0,0,0,0.18)' }}>
                <div className="relative mb-3 bg-white rounded-lg shadow p-4 flex items-center gap-3">
                  <span className="text-2xl">📝</span>
                  <div className="flex-1">
                    <div className="font-bold text-lg text-[#076332]">{surveys[0].title}</div>
                    {surveys[0].body && <div className="text-sm text-gray-700">{surveys[0].body}</div>}
                    {surveys[0].endTime && (
                      <div className="text-sm font-semibold" style={{ color: '#fff', background: '#076332', borderRadius: 6, padding: '2px 8px', display: 'inline-block', marginTop: 4 }}>
                        Due Date: {new Date(surveys[0].endTime.seconds ? surveys[0].endTime.seconds * 1000 : surveys[0].endTime).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit' })} {new Date(surveys[0].endTime.seconds ? surveys[0].endTime.seconds * 1000 : surveys[0].endTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    )}
                  </div>
                  <button onClick={() => handleEditClick('survey', surveys[0])} className="ml-2 p-2 rounded-full hover:bg-gray-100">
                    <PencilIcon />
                  </button>
                </div>
              </div>
            )
          )}
        </div>

        {/* Messages Section */}
        <div className="mb-4">
          <div className="flex items-center px-4 py-2 rounded-t-lg shadow-sm select-none" style={{ background: colors.sectionBg, color: colors.white }}>
            <button
              className="font-semibold text-base flex-1 text-left focus:outline-none bg-transparent border-none"
              onClick={() => setOpenMessages((prev) => !prev)}
              style={{ color: colors.white }}
            >
              Messages
            </button>
            <button
              onClick={() => { setModalType('message'); setShowAddModal(true); }}
              className="px-3 py-1 rounded-lg font-semibold transition focus:outline-none"
              style={{ color: colors.primaryGreen, background: 'none', boxShadow: 'none' }}
            >
              + Add message
            </button>
          </div>
          {openMessages ? (
            <div className="rounded-b-lg p-4" style={{ background: 'rgba(0,0,0,0.18)' }}>
              {loading ? (
                <div className="text-center text-muted py-2">Loading...</div>
              ) : messages.length === 0 ? (
                <div className="text-center text-muted py-2">No messages found</div>
              ) : (
                messages.map(message => (
                  <div key={message.id} className="relative mb-3 bg-white rounded-lg shadow p-4 flex items-center gap-3">
                    <span className="text-2xl">📢</span>
                    <div className="flex-1">
                      <div className="font-bold text-lg text-[#076332]">{message.title}</div>
                      {message.body && <div className="text-sm text-gray-700">{message.body}</div>}
                      {message.startTime && (
                        <div className="text-sm font-semibold" style={{ color: '#fff', background: '#076332', borderRadius: 6, padding: '2px 8px', display: 'inline-block', marginTop: 4 }}>
                          Start: {new Date(message.startTime.seconds ? message.startTime.seconds * 1000 : message.startTime).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit' })} {new Date(message.startTime.seconds ? message.startTime.seconds * 1000 : message.startTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      )}
                      {message.endTime && (
                        <div className="text-sm font-semibold" style={{ color: '#fff', background: '#076332', borderRadius: 6, padding: '2px 8px', display: 'inline-block', marginTop: 4, marginLeft: 4 }}>
                          End: {new Date(message.endTime.seconds ? message.endTime.seconds * 1000 : message.endTime).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit' })} {new Date(message.endTime.seconds ? message.endTime.seconds * 1000 : message.endTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      )}
                    </div>
                    <button onClick={() => handleEditClick('message', message)} className="ml-2 p-2 rounded-full hover:bg-gray-100">
                      <PencilIcon />
                    </button>
                  </div>
                ))
              )}
            </div>
          ) : (
            messages.length > 0 && (
              <div className="rounded-b-lg p-4" style={{ background: 'rgba(0,0,0,0.18)' }}>
                <div className="relative mb-3 bg-white rounded-lg shadow p-4 flex items-center gap-3">
                  <span className="text-2xl">📢</span>
                  <div className="flex-1">
                    <div className="font-bold text-lg text-[#076332]">{messages[0].title}</div>
                    {messages[0].body && <div className="text-sm text-gray-700">{messages[0].body}</div>}
                    {messages[0].startTime && (
                      <div className="text-sm font-semibold" style={{ color: '#fff', background: '#076332', borderRadius: 6, padding: '2px 8px', display: 'inline-block', marginTop: 4 }}>
                        Start: {new Date(messages[0].startTime.seconds ? messages[0].startTime.seconds * 1000 : messages[0].startTime).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit' })} {new Date(messages[0].startTime.seconds ? messages[0].startTime.seconds * 1000 : messages[0].startTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    )}
                    {messages[0].endTime && (
                      <div className="text-sm font-semibold" style={{ color: '#fff', background: '#076332', borderRadius: 6, padding: '2px 8px', display: 'inline-block', marginTop: 4, marginLeft: 4 }}>
                        End: {new Date(messages[0].endTime.seconds ? messages[0].endTime.seconds * 1000 : messages[0].endTime).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit' })} {new Date(messages[0].endTime.seconds ? messages[0].endTime.seconds * 1000 : messages[0].endTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    )}
                  </div>
                  <button onClick={() => handleEditClick('message', messages[0])} className="ml-2 p-2 rounded-full hover:bg-gray-100">
                    <PencilIcon />
                  </button>
                </div>
              </div>
            )
          )}
        </div>
      </div>

      {/* Add Item Modal */}
      <AddItemModal
        open={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSave={handleAddSave}
        type={modalType}
        loading={addLoading}
      />

      {/* Edit Modal */}
      {editModal.open && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 shadow-lg w-full max-w-xs mx-4">
            <h2 className="text-xl font-bold mb-4">Edit {editModal.type.charAt(0).toUpperCase() + editModal.type.slice(1)}</h2>
            {Object.entries(editModal.form).map(([key, value]) => (
              key === 'id' ? null : (
                <div className="mb-4" key={key}>
                  <label className="block text-gray-700 font-semibold mb-2">{key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}</label>
                  <input
                    type={key.toLowerCase().includes('date') ? 'datetime-local' : 'text'}
                    name={key}
                    value={typeof value === 'string' ? value : (value?.seconds ? new Date(value.seconds * 1000).toISOString().slice(0, 16) : '')}
                    onChange={handleEditChange}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:border-primaryGreen"
                  />
                </div>
              )
            ))}
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

      <AdminBottomNavBar active="edit" />
    </main>
  );
} 