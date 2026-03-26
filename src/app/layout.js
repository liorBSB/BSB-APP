import './globals.css';
import { cookies } from 'next/headers';
import I18nProvider from '@/components/I18nProvider';
import AuthProvider from '@/components/AuthProvider';

export const metadata = {
  title: 'House Efficiency',
  description: 'Smart Living, Streamlined',
  manifest: '/manifest.webmanifest',
};

export default async function RootLayout({ children }) {
  const cookieStore = await cookies();
  const raw = cookieStore.get('lang')?.value;
  const initialLang = raw === 'he' ? 'he' : 'en';
  const isRtl = initialLang === 'he';

  return (
    <html lang={initialLang} dir={isRtl ? 'rtl' : 'ltr'}>
      <body className="min-h-screen">
        <I18nProvider initialLang={initialLang}>
          <AuthProvider>{children}</AuthProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
