'use client';
import { connectorsForWallets } from '@rainbow-me/rainbowkit';
import {
  coinbaseWallet,
  rainbowWallet,
  safeWallet,
  walletConnectWallet,
  metaMaskWallet,
  injectedWallet,
} from '@rainbow-me/rainbowkit/wallets';
import { useMemo } from 'react';
import { http, createConfig } from 'wagmi';
import { avalanche } from 'wagmi/chains';
import { NEXT_PUBLIC_WC_PROJECT_ID } from './config';

export function useWagmiConfig() {
  const projectId = NEXT_PUBLIC_WC_PROJECT_ID ?? '';
  if (!projectId) {
    const providerErrMessage =
      'To connect to all Wallets you need to provide a NEXT_PUBLIC_WC_PROJECT_ID env variable';
    throw new Error(providerErrMessage);
  }

  return useMemo(() => {
    const connectors = connectorsForWallets(
      [
        {
          groupName: 'Recommended Wallets',
          wallets: [
            walletConnectWallet,
            coinbaseWallet,
            safeWallet,
            metaMaskWallet,
          ],
        },
        {
          groupName: 'Other Wallets',
          wallets: [rainbowWallet, injectedWallet],
        },
      ],
      {
        appName: 'onchainkit',
        projectId,
      },
    );

    const wagmiConfig = createConfig({
      chains: [avalanche],
      // enable injected provider discovery so injected wallets (eg. Core Wallet)
      // are detected and available in the modal
      multiInjectedProviderDiscovery: true,
      connectors,
      ssr: true,
      transports: {
        [avalanche.id]: http(),
      },
    });

    return wagmiConfig;
  }, [projectId]);
}
