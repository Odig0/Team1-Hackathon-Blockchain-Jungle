/**
 * Formatea un número con el locale especificado
 * @param value - El número a formatear
 * @param locale - El locale a usar (por defecto "en-US")
 * @param decimals - Número de decimales a mostrar (por defecto 2)
 * @returns String formateado del número
 */
export const fmt = (value: number, locale: string = "en-US", decimals: number = 2): string => {
  if (isNaN(value)) return "0";
  
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
};
