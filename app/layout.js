import './globals.css';

export const metadata = {
  title: 'Evidenca delovnih ur',
  description: 'Evidenca ur, dopusta in bolniške za zaposlene',
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#1f2937',
};

export default function RootLayout({ children }) {
  return (
    <html lang="sl">
      <body>{children}</body>
    </html>
  );
}
