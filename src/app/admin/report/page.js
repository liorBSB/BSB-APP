"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import colors from '../../colors';
import AdminBottomNavBar from '@/components/AdminBottomNavBar';

export default function AdminReportPage() {
  const router = useRouter();
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchReports();
  }, []);

  const fetchReports = async () => {
    try {
      const reportsQuery = query(collection(db, 'reports'), orderBy('createdAt', 'desc'));
      const reportsSnapshot = await getDocs(reportsQuery);
      const reportsData = reportsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setReports(reportsData);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching reports:', error);
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-200/60 to-green-100/60 font-body flex flex-col items-center pt-6 pb-32 px-4">
      <div className="w-full max-w-md">
        <div className="w-full max-w-md rounded-2xl px-5 pt-6 pb-4 mb-6 bg-white/10 backdrop-blur-md shadow-sm">
          <h1 className="text-2xl font-bold text-text">Reports</h1>
          <p className="text-sm text-muted">View all submitted reports</p>
        </div>

        <div className="w-full max-w-md rounded-2xl p-4 mb-6" style={{ background: colors.sectionBg }}>
          {loading ? (
            <div className="text-center text-white py-4">Loading...</div>
          ) : reports.length === 0 ? (
            <div className="text-center text-white py-4">No reports found</div>
          ) : (
            reports.map(report => (
              <div key={report.id} className="bg-white/10 rounded-lg p-4 mb-4">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h3 className="text-lg font-semibold text-white">{report.title}</h3>
                    <p className="text-sm text-white/80">{report.description}</p>
                  </div>
                  <span className="text-xs text-white/60">
                    {report.createdAt?.toDate().toLocaleDateString()}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm text-white/80">
                  <span>Room: {report.roomNumber}</span>
                  <span>•</span>
                  <span>Status: {report.status}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
      <AdminBottomNavBar active="report" />
    </main>
  );
} 