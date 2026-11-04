import type { Metadata } from 'next';
import { Manrope } from 'next/font/google';
import './globals.css';

const manrope = Manrope({ subsets: ['latin', 'cyrillic'], variable: '--font-manrope' });

export const metadata: Metadata = {
  title: { default: 'OpenLumo', template: '%s · OpenLumo' },
  description: 'Open source marketing workspace for your brand.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={manrope.variable}>
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
