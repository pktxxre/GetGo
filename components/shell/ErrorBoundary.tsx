import { Component, type ReactNode } from 'react';
import { usePathname } from 'expo-router';
import { StateScreen } from './StateScreen';

type Props = { children: ReactNode; resetKey?: string };
type State = { hasError: boolean };

/**
 * Catches render errors below it and shows the `crashed` state instead of a white screen.
 * A class component because only class lifecycles (getDerivedStateFromError /
 * componentDidCatch) can catch render errors — hooks cannot.
 *
 * `resetKey` change → the boundary resets, so navigating away from a broken screen (via
 * `back to london`) yields a working front door rather than a stuck boundary. The functional
 * wrapper below feeds the current pathname as that key.
 */
class ErrorBoundaryInner extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidUpdate(prev: Props) {
    // A route change clears a prior error so the destination renders normally.
    if (this.state.hasError && prev.resetKey !== this.props.resetKey) {
      this.setState({ hasError: false });
    }
  }

  componentDidCatch(error: unknown) {
    // Console for now; a real sink (Sentry) is picked at the TestFlight gate (SHELL_SPEC).
    console.error('[ErrorBoundary] render error:', error);
  }

  render() {
    if (this.state.hasError) return <StateScreen kind="crashed" />;
    return this.props.children;
  }
}

export function ErrorBoundary({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return <ErrorBoundaryInner resetKey={pathname}>{children}</ErrorBoundaryInner>;
}
