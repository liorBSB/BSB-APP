"use client";
import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { auth, db } from "@/lib/firebase";
import { doc, updateDoc, serverTimestamp } from "firebase/firestore";
import colors from "@/app/colors";

function ConsentStep1Content() {
  const router = useRouter();
  const params = useSearchParams();
  const role = (params.get("role") || "soldier").toLowerCase();
  const [agree, setAgree] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleAgree = async () => {
    if (!agree || !auth.currentUser) return;
    setSaving(true);
    try {
      await updateDoc(doc(db, "users", auth.currentUser.uid), {
        "consents.role": role,
        "consents.doc1": {
          accepted: true,
          acceptedAt: serverTimestamp(),
          userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "",
          lang: typeof window !== "undefined" ? (localStorage.getItem("lang") || "he") : "he",
          statementVersion: "v1"
        }
      });
      router.push(`/register/consent/2?role=${role}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center font-body px-4 phone-lg:px-0" style={{ background: colors.white }}>
      <div className="w-full max-w-xs phone-md:max-w-sm phone-lg:max-w-md mx-auto 
        bg-transparent rounded-none shadow-none p-0
        phone-lg:bg-white phone-lg:rounded-[2.5rem] phone-lg:shadow-lg phone-lg:p-[3.5rem_2.2rem]">
        <h1 style={{ fontWeight: 700, fontSize: '2rem', textAlign: 'center', marginBottom: '1.5rem' }}>Consent document 1</h1>
        <div className="h-56 overflow-auto border rounded-lg p-3 text-sm text-gray-700 mb-4">
          {/* Document text placeholder (later move to i18n) */}
          I confirm that I have read and understood the terms of this document...
        </div>
        <label className="flex items-start gap-2 mb-4">
          <input type="checkbox" checked={agree} onChange={e => setAgree(e.target.checked)} className="mt-1" />
          <span className="text-sm">I have read and I agree</span>
        </label>
        <button
          onClick={handleAgree}
          disabled={!agree || saving}
          className="w-full rounded-full py-3 font-semibold"
          style={{ background: agree ? colors.primaryGreen : "#cbd5e1", color: colors.white }}
        >
          {saving ? "Saving..." : "I agree and continue"}
        </button>
      </div>
    </main>
  );
}

export default function ConsentStep1Page() {
  return (
    <Suspense fallback={
      <main className="min-h-screen flex items-center justify-center font-body px-4 phone-lg:px-0" style={{ background: colors.white }}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 mx-auto mb-6" style={{ borderColor: colors.primaryGreen }}></div>
          <div style={{ color: colors.primaryGreen, fontWeight: 600, fontSize: 22 }}>Loading...</div>
        </div>
      </main>
    }>
      <ConsentStep1Content />
    </Suspense>
  );
}


