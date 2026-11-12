export const MIN_FUNCTION_DRAWER_WIDTH = 210;

export function sidebarWidthForFunctionDrawer(
  currentSidebarWidth: number,
  currentDrawerWidth: number,
  maximumSidebarWidth: number,
  minimumDrawerWidth = MIN_FUNCTION_DRAWER_WIDTH
): number {
  const missingWidth = Math.max(0, minimumDrawerWidth - currentDrawerWidth);
  return Math.min(maximumSidebarWidth, Math.max(currentSidebarWidth, currentSidebarWidth + missingWidth));
}
