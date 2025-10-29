# Integración del Contrato Torito 🐂

## ⚠️ Pasos Pendientes para Completar la Integración

### 1. Obtener la Dirección del Contrato

Necesitas obtener la dirección del contrato desplegado en Base Sepolia desde BaseScan:

1. Ve a https://sepolia.basescan.org/
2. Busca la transacción: `0x17b31cb7e8f549c543f0647c987ed55ebd45749c7b0dbba6ac7d1e370a88fb15`
3. Copia la dirección del contrato (Contract Address)

### 2. Actualizar la Configuración

Abre el archivo `src/config/toritoContract.ts` y actualiza:

```typescript
// Reemplaza '0x...' con la dirección real del contrato
export const TORITO_CONTRACT_ADDRESS = '0xTU_DIRECCION_AQUI' as `0x${string}`;

// Reemplaza con la dirección del token USDC en Base Sepolia
export const USDC_TOKEN_ADDRESS = '0xTU_DIRECCION_USDC_AQUI' as `0x${string}`;
```

### 3. Encontrar el Token USDC en Base Sepolia

Busca la dirección del token USDC de prueba en Base Sepolia:
- Puedes usar tokens de prueba de Aave o Compound en Base Sepolia
- O buscar en la documentación oficial de Base

### 4. Verificar la Red

El proyecto está configurado para Base Sepolia (Chain ID: 84532).
Asegúrate de que tu wallet esté conectada a esta red.

## Archivos Modificados

### Hooks Actualizados (ahora usan el contrato real):

1. **`src/hooks/torito/useSupplyBalance.ts`**
   - Lee el balance del usuario desde el contrato
   - Usa `readContract` con la función `supplies`

2. **`src/hooks/torito/useSupply.ts`**
   - Maneja aprobación del token USDC
   - Ejecuta el depósito en el contrato

3. **`src/hooks/torito/useBorrow.ts`**
   - Ejecuta la solicitud de préstamo
   - Convierte el nombre de la moneda a bytes32

### Archivo de Configuración Creado:

- **`src/config/toritoContract.ts`**
  - Contiene el ABI del contrato
  - Direcciones de contratos (pendientes de completar)
  - Funciones helper para conversión bytes32

## Funciones del Contrato

El contrato Torito incluye:

### Funciones de Lectura (view):
- `supplies(address, address)` - Ver balance depositado
- `borrows(address, bytes32)` - Ver información de préstamo
- `convertCurrencyToUSD(bytes32, uint256)` - Convertir moneda a USD
- `convertUSDCoCurrency(bytes32, uint256)` - Convertir USD a moneda
- `dynamicBorrowRate(bytes32)` - Obtener tasa de interés dinámica

### Funciones de Escritura (transacciones):
- `supply(address, uint256)` - Depositar USDC
- `borrow(address, uint256, bytes32)` - Solicitar préstamo
- `repayLoan(bytes32, uint256)` - Pagar préstamo

## Próximos Pasos

1. [ ] Completar direcciones de contratos en `toritoContract.ts`
2. [ ] Probar la aprobación de USDC
3. [ ] Probar el depósito (supply)
4. [ ] Probar la solicitud de préstamo (borrow)
5. [ ] Implementar la función de pago de préstamo
6. [ ] Actualizar la página de deuda para usar datos reales del contrato

## Notas Técnicas

- **USDC decimales**: 6 (no 18 como ETH)
- **Currency encoding**: Se usa `stringToBytes32()` para convertir nombres de monedas
- **Wagmi hooks**: `useReadContract`, `useWriteContract`, `useWaitForTransactionReceipt`
- **Chain**: Base Sepolia (testnet)

## Testing

Para probar:
1. Conecta tu wallet a Base Sepolia
2. Obtén tokens USDC de prueba
3. Aprueba el gasto de USDC al contrato Torito
4. Realiza un depósito
5. Verifica que el balance se actualice

## Recursos

- Base Sepolia Explorer: https://sepolia.basescan.org/
- Base Docs: https://docs.base.org/
- Wagmi Docs: https://wagmi.sh/
