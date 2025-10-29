import './global.css';
import '@coinbase/onchainkit/styles.css';
import '@rainbow-me/rainbowkit/styles.css';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { NEXT_PUBLIC_URL } from '../config';
import OnchainProviders from 'src/components/OnchainProviders';

export const viewport = {
  width: 'device-width',
  initialScale: 1.0,
};

export const metadata: Metadata = {
  title: 'Torito - Préstamos con Cripto',
  description: 'Deposita USDC y obtén préstamos en tu moneda local',
  openGraph: {
    title: 'Torito - Préstamos con Cripto',
    description: 'Deposita USDC y obtén préstamos en tu moneda local',
    images: [`${NEXT_PUBLIC_URL}/vibes/vibes-19.png`],
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="flex items-center justify-center">
        <OnchainProviders>{children}</OnchainProviders>
      </body>
    </html>
  );
}
