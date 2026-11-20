import { createContext, useContext } from 'react';
import type { Account, SandboxEntity } from '@contracts';

/**
 * Entity codes and GL account numbers are optional and purely for organising. One Sandbox-wide toggle shows them
 * (and their edit fields) in every view — Journal, T-accounts, Grid, the chart of accounts — or hides them all.
 */
export const ShowCodes = createContext(false);
export const useShowCodes = () => useContext(ShowCodes);

/** "1010 Cash: Operating" when codes are shown and the account has a number; else just the name. */
export const accountLabel = (a: Pick<Account, 'name' | 'number'>, show: boolean) =>
  show && a.number?.trim() ? `${a.number.trim()} ${a.name}` : a.name;

/** "1000 Zap" when codes are shown and the entity has a code; else just the name. */
export const entityLabel = (
  e: Pick<SandboxEntity, 'name' | 'code'>,
  show: boolean,
  fallback = '',
) => (show && e.code?.trim() ? `${e.code.trim()} ${e.name || fallback}` : e.name || fallback);
