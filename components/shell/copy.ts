/**
 * Shell copy — the words the state layer says. Lowercase, blunt-but-kind, rarity-as-fact
 * (DESIGN.md → Voice). Centralised so three screens never phrase the same state three ways.
 */

export type StateKind = 'notFound' | 'failed' | 'crashed';

type StateCopy = {
  /** mono micro-label at the top of the block. */
  stamp: string;
  /** Fraunces title — carries the meaning too, never only the 10px stamp (a11y). */
  title: string;
  /** default body sentence; overridable per instance. */
  body: string;
  /** primary action label. */
  primaryLabel: string;
  /** secondary escape label; only where an escape distinct from the primary exists. */
  escapeLabel?: string;
};

export const STATE_COPY: Record<StateKind, StateCopy> = {
  notFound: {
    stamp: 'no such quest',
    title: 'this one isn’t in the archive',
    body: 'the link went cold, or it was never here.',
    primaryLabel: 'browse london',
  },
  failed: {
    stamp: 'didn’t load',
    title: 'taking the scenic route',
    body: 'something got in the way. give it another go.',
    primaryLabel: 'try again',
    escapeLabel: 'browse london',
  },
  crashed: {
    stamp: 'something broke',
    title: 'that’s on us',
    body: 'the app tripped over itself. back to solid ground.',
    primaryLabel: 'back to london',
  },
};

/** Loading, not empty — the two must never say the same thing (S6). */
export const SHELL_COPY = {
  loading: 'developing…',
  emptyFeed: 'nothing here yet',
  emptyFeedBody: 'no sidequests in this corner of london. yet.',
  emptyUser: 'no quests yet',
  emptyUserBody: 'nothing posted here — yet.',
  emptyNearby: 'nothing nearby',
  emptyNearbyBody: 'no sidequests logged around here. be the first.',
  nearbyDenied: 'nearby needs your location',
  nearbyDeniedBody: 'turn on location to see sidequests around you.',
  nearbyError: 'couldn’t load nearby',
  retry: 'try again',
  offline: 'no connection',
} as const;
