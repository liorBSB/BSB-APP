import './globals.css';
export const metadata = {
  title: 'House Efficiency',
  description: 'Smart Living, Streamlined',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
