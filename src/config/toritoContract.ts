
import { abi as TORITO } from '../../toritoabi.json' assert { type: 'json' };
// Configuración del contrato Torito en Base Sepolia
export const TORITO_CONTRACT_ADDRESS = '0x67CB4Eb13df5507300a2acbA069A7F5aDD364511' as `0x${string}`;
export const BASE_SEPOLIA_CHAIN_ID = 84532;
 
// Importar el ABI desde el archivo JSON


// Dirección del token USDC de prueba en Base Sepolia
// Este es un token ERC20 de prueba que puedes usar para testing
// Puedes obtener tokens desde https://faucet.circle.com/
export const TORITO_ABI = TORITO;
export const USDC_TOKEN_ADDRESS = '0x8964c51116010B33F5C3f2Dc1D8A62749E432566' as `0x${string}`;
// Helper para convertir string a bytes32 (para currency)
export function stringToBytes32(text: string): `0x${string}` {
  // Convertir texto a hex y pad a 32 bytes
  const hex = text
    .split('')
    .map((c) => c.charCodeAt(0).toString(16).padStart(2, '0'))
    .join('');
  return `0x${hex.padEnd(64, '0')}` as `0x${string}`;
}

// Helper para convertir bytes32 a string
export function bytes32ToString(bytes: string): string {
  const hex = bytes.replace('0x', '');
  let str = '';
  for (let i = 0; i < hex.length; i += 2) {
    const code = Number.parseInt(hex.slice(i, i + 2), 16);
    if (code === 0) break;
    str += String.fromCharCode(code);
  }
  return str;
}
