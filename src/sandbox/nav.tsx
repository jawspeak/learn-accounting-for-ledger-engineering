import { createContext, useContext, type ReactNode } from 'react';

/** The three views of the same books. */
export type SandboxView = 'journal' | 'taccounts' | 'grid';

/** Somewhere inside the Sandbox: a view, a party (Journal / Grid), and an element to scroll to. */
export interface SandboxTarget {
  view: SandboxView;
  party?: number;
  /** An element id, e.g. "entry-3". */
  at?: string;
}

/** How the host turns a target into a link (and, optionally, handles the click itself). */
export interface SandboxNav {
  linkTo(target: SandboxTarget): string;
  /** When given, links call this instead of following their href (hosts without URL routing). */
  onNavigate?(target: SandboxTarget): void;
}

const NavContext = createContext<SandboxNav>({ linkTo: () => '#' });
export const SandboxNavProvider = NavContext.Provider;

/** A link to another place in the Sandbox, resolved by the host. */
export function SandboxLink({
  to,
  children,
  ...rest
}: { to: SandboxTarget; children: ReactNode } & Omit<
  React.AnchorHTMLAttributes<HTMLAnchorElement>,
  'href'
>) {
  const nav = useContext(NavContext);
  return (
    <a
      {...rest}
      href={nav.linkTo(to)}
      onClick={
        nav.onNavigate
          ? (e) => {
              e.preventDefault();
              nav.onNavigate!(to);
            }
          : rest.onClick
      }
    >
      {children}
    </a>
  );
}
