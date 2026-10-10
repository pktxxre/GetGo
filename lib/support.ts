import { Linking } from 'react-native';

/**
 * The published support/contact address. App Store Guideline 1.2 requires a UGC app to publish a
 * way for users to reach the developer (alongside report + block + a content policy). It's a
 * single constant so the guidelines screen and settings never drift.
 *
 * Reviewers (and users flagging abuse) email this, so it must stay a real, monitored inbox.
 */
export const SUPPORT_EMAIL = 'atloexo@gmail.com';

/** Open the user's mail client to contact support. Returns the openURL promise for the caller. */
export function contactSupport(): Promise<unknown> {
  return Linking.openURL(`mailto:${SUPPORT_EMAIL}`);
}
