/**
 * IDENTIFICAPIX - ICON SYSTEM (REFACTORED V3)
 * Modularized barrel file for all application icons.
 * Each module is guaranteed to be under 200 lines.
 */

export { BaseIcon } from './icons/BaseIcon';

// Re-exporting modules
export * from './icons/NavigationIcons';
export * from './icons/ActionIcons';
export * from './icons/BusinessIcons';

// Aliases and specific re-exports for backward compatibility
import { MagnifyingGlassIcon } from './icons/ActionIcons';
export const SearchIcon = MagnifyingGlassIcon;
