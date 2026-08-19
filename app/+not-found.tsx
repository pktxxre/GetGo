import { StateScreen } from '../components/shell/StateScreen';

/**
 * The catch-all route for any unmatched path. Without this file, expo-router serves its own
 * unstyled system-font white page — on the exact bone surface the funnel gate depends on.
 */
export default function NotFound() {
  return <StateScreen kind="notFound" />;
}
