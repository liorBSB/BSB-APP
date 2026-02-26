"use client";
import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslation } from 'react-i18next';
import { auth, db } from "@/lib/firebase";
import { doc, updateDoc, serverTimestamp } from "firebase/firestore";
import LanguageSwitcher from '@/components/LanguageSwitcher';
import SignatureModal from '@/components/SignatureModal';
import useAuthRedirect from '@/hooks/useAuthRedirect';
import colors from "@/app/colors";

function ConsentStep1Content() {
  const router = useRouter();
  const params = useSearchParams();
  const { t } = useTranslation('register');
  const isReady = useAuthRedirect();
  const role = (params.get("role") || "soldier").toLowerCase();
  const [agree, setAgree] = useState(false);
  const [saving, setSaving] = useState(false);
  const [signature, setSignature] = useState(null);
  const [showSignatureModal, setShowSignatureModal] = useState(false);

  const handleSignatureSave = (signatureData) => {
    setSignature(signatureData);
    setShowSignatureModal(false);
  };

  const handleAgree = async () => {
    if (!agree || !auth.currentUser || !signature) return;
    setSaving(true);
    try {
      await updateDoc(doc(db, "users", auth.currentUser.uid), {
        consentSkipped: false,
        "consents.role": role,
        "consents.doc1": {
          accepted: true,
          acceptedAt: serverTimestamp(),
          userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "",
          lang: typeof window !== "undefined" ? (localStorage.getItem("lang") || "he") : "he",
          statementVersion: "v1",
          signature: signature
        }
      });
      router.push("/home");
    } finally {
      setSaving(false);
    }
  };

  const handleSkip = async () => {
    if (!auth.currentUser) return;
    setSaving(true);
    try {
      await updateDoc(doc(db, "users", auth.currentUser.uid), {
        consentSkipped: true,
      });
      router.push("/home");
    } finally {
      setSaving(false);
    }
  };

  if (!isReady) {
    return (
      <main className="min-h-screen flex items-center justify-center font-body" style={{ background: colors.white }}>
        <div className="animate-spin rounded-full h-16 w-16 border-b-4" style={{ borderColor: colors.primaryGreen }}></div>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center font-body px-4 phone-lg:px-0" style={{ background: colors.white }}>
      <LanguageSwitcher className="absolute top-4 right-4 bg-surface p-2 rounded-full text-white text-xl hover:text-text" />
      <div className="w-full max-w-xs phone-md:max-w-sm phone-lg:max-w-md mx-auto 
        bg-transparent rounded-none shadow-none p-0
        phone-lg:bg-white phone-lg:rounded-[2.5rem] phone-lg:shadow-lg phone-lg:p-[3.5rem_2.2rem]">
        <h1 style={{ fontWeight: 700, fontSize: '2rem', textAlign: 'center', marginBottom: '1.5rem' }}>{t('consent.gym_title')}</h1>
        <div className="h-56 overflow-auto border rounded-lg p-3 text-sm text-gray-700 mb-4">
          <h3 className="font-semibold mb-2">{t('consent.gym_terms_title')}</h3>
          <p className="mb-2">{t('consent.gym_intro')}</p>
          <ul className="list-disc list-inside space-y-1 mb-2">
            <li>{t('consent.gym_rule_1')}</li>
            <li>{t('consent.gym_rule_2')}</li>
            <li>{t('consent.gym_rule_3')}</li>
            <li>{t('consent.gym_rule_4')}</li>
            <li>{t('consent.gym_rule_5')}</li>
            <li>{t('consent.gym_rule_6')}</li>
          </ul>
          <p className="text-xs text-gray-600 mt-2">
            {t('consent.gym_disclaimer')}
          </p>
        </div>
        
        <div className="mb-4">
          <label className="block text-sm font-medium mb-2">{t('consent.digital_signature')}</label>
          {signature ? (
            <div className="border-2 border-gray-300 rounded-lg p-2 bg-white">
              <img 
                src={signature} 
                alt="Signature" 
                className="w-full h-24 object-contain border border-gray-200 rounded"
              />
              <div className="flex justify-between mt-2">
                <button
                  onClick={() => setSignature(null)}
                  className="text-xs px-3 py-1 border border-gray-300 rounded hover:bg-gray-50"
                  style={{ color: colors.primaryGreen, borderColor: colors.primaryGreen }}
                >
                  {t('consent.clear_signature')}
                </button>
                <span className="text-xs text-gray-500">{t('consent.signature_provided')}</span>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowSignatureModal(true)}
              className="w-full border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-gray-400 transition-colors"
              style={{ borderColor: colors.primaryGreen }}
            >
              <div className="text-gray-600 mb-2">
                <svg className="w-8 h-8 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
                <p className="text-sm font-medium">{t('consent.tap_to_sign')}</p>
                <p className="text-xs text-gray-500">{t('consent.signature_required')}</p>
              </div>
            </button>
          )}
        </div>

        <label className="flex items-start gap-2 mb-4">
          <input type="checkbox" checked={agree} onChange={e => setAgree(e.target.checked)} className="mt-1" />
          <span className="text-sm">{t('consent.agree_checkbox')}</span>
        </label>
        <button
          onClick={handleAgree}
          disabled={!agree || !signature || saving}
          className="w-full rounded-full py-3 font-semibold mb-3"
          style={{ background: (agree && signature) ? colors.primaryGreen : "#cbd5e1", color: colors.white }}
        >
          {saving ? t('consent.saving') : t('consent.agree_continue')}
        </button>
        <button
          onClick={handleSkip}
          disabled={saving}
          className="w-full rounded-full py-3 font-semibold"
          style={{ background: 'transparent', color: colors.muted, border: `1.5px solid ${colors.muted}` }}
        >
          {t('consent.skip_for_now')}
        </button>
      </div>
      
      <SignatureModal
        isOpen={showSignatureModal}
        onClose={() => setShowSignatureModal(false)}
        onSave={handleSignatureSave}
        title={t('consent.sign_agreement')}
      />
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


