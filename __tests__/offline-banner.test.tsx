import { render, screen, act } from '@testing-library/react-native';

// Capture the netinfo listener so the test can drive connection changes directly (native module
// is null under Jest). We assert the S7 contract: debounced by 2s, null-safe, flap-suppressed.
// The holder is `mock`-prefixed so the hoisted jest.mock factory may reference it.
const mockNet: { listener: (state: any) => void; unsub: jest.Mock } = { listener: () => {}, unsub: jest.fn() };
jest.mock('@react-native-community/netinfo', () => ({
  __esModule: true,
  default: {
    addEventListener: (cb: (state: any) => void) => {
      mockNet.listener = cb;
      return mockNet.unsub;
    },
  },
}));

import { OfflineBanner } from '../components/shell/OfflineBanner';

const listener = (state: any) => mockNet.listener(state);

beforeEach(() => {
  jest.useFakeTimers();
  mockNet.unsub.mockClear();
});
afterEach(() => {
  jest.useRealTimers();
});

const BANNER = 'NO CONNECTION';

describe('OfflineBanner (S7)', () => {
  it('renders nothing while connected', () => {
    render(<OfflineBanner />);
    expect(screen.queryByText(BANNER)).toBeNull();
  });

  it('shows the strip only after 2s offline (debounced, not instant)', () => {
    render(<OfflineBanner />);
    act(() => listener({ isConnected: false }));
    act(() => jest.advanceTimersByTime(1999));
    expect(screen.queryByText(BANNER)).toBeNull(); // still within the debounce window
    act(() => jest.advanceTimersByTime(1));
    expect(screen.getByText(BANNER)).toBeTruthy();
  });

  it('a brief flap (offline→online inside 2s) never flashes the banner', () => {
    render(<OfflineBanner />);
    act(() => listener({ isConnected: false }));
    act(() => jest.advanceTimersByTime(1000)); // half-way through the debounce
    act(() => listener({ isConnected: true })); // signal comes back
    act(() => jest.advanceTimersByTime(2000));
    expect(screen.queryByText(BANNER)).toBeNull();
  });

  it('treats an unknown (null) state as connected — never cries wolf', () => {
    render(<OfflineBanner />);
    act(() => listener({ isConnected: null }));
    act(() => jest.advanceTimersByTime(2000));
    expect(screen.queryByText(BANNER)).toBeNull();
  });

  it('unsubscribes on unmount', () => {
    const view = render(<OfflineBanner />);
    view.unmount();
    expect(mockNet.unsub).toHaveBeenCalled();
  });
});
