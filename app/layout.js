import './globals.css';

export const metadata = {
  title: 'Plac Caffe – evidenca ur',
  description: 'Evidenca ur, dopusta in bolniške za zaposlene',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    title: 'Plac Caffe',
    statusBarStyle: 'black-translucent',
  },
  formatDetection: { telephone: false },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#0f172a',
};

export default function RootLayout({ children }) {
  return (
    <html lang="sl">
      <body>{children}</body>
    </html>
  );
}
