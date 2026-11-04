import type { Metadata } from 'next';
import { Manrope } from 'next/font/google';
import './globals.css';

const manrope = Manrope({ subsets: ['latin', 'cyrillic'], variable: '--font-manrope' });

export const metadata: Metadata = {
  title: { default: 'OpenLumo', template: '%s · OpenLumo' },
  description: 'Open source marketing workspace for your brand.',
  icons: {
    icon: [
      { url: '/brand/logo/favicon.svg', type: 'image/svg+xml' },
      { url: '/brand/logo/favicon-32.png', sizes: '32x32', type: 'image/png' },
    ],
    apple: { url: '/brand/logo/icon-512.png', sizes: '512x512', type: 'image/png' },
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={manrope.variable}>
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
