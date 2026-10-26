import { useWindowDimensions } from 'react-native';

export interface ResponsiveInfo {
  width: number;
  height: number;
  /** True si el ancho o alto mínimo es >= 600dp (estándar para tablets de 7" o más) */
  isTablet: boolean;
  /** True si la orientación actual es apaisada / horizontal */
  isLandscape: boolean;
  /** Helper que devuelve tabletValue si es tablet, o phoneValue si es móvil */
  resp: <T>(phoneValue: T, tabletValue: T) => T;
}

/**
 * Hook para adaptar dimensiones, tamaños de fuente, padding y componentes
 * según si el dispositivo es un teléfono o una tablet / pantalla grande.
 */
export function useResponsive(): ResponsiveInfo {
  const { width, height } = useWindowDimensions();
  const minDimension = Math.min(width, height);

  // Breakpoint estándar: tablets (7", 8", 10", 12", iPad, Galaxy Tab, etc.)
  // tienen al menos 600dp en su dimensión más corta.
  const isTablet = minDimension >= 600;
  const isLandscape = width > height;

  const resp = <T>(phoneValue: T, tabletValue: T): T => {
    return isTablet ? tabletValue : phoneValue;
  };

  return {
    width,
    height,
    isTablet,
    isLandscape,
    resp,
  };
}
