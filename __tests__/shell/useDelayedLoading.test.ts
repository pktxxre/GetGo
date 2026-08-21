import { renderHook, act } from '@testing-library/react-native';
import { useDelayedLoading } from '../../hooks/useDelayedLoading';

describe('useDelayedLoading', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('does not show before the 150ms delay, then shows', () => {
    const { result } = renderHook(() => useDelayedLoading(true));
    expect(result.current).toBe(false);
    act(() => { jest.advanceTimersByTime(149); });
    expect(result.current).toBe(false);
    act(() => { jest.advanceTimersByTime(1); });
    expect(result.current).toBe(true);
  });

  it('never shows for a load that finishes under the delay', () => {
    const { result, rerender } = renderHook(
      ({ loading }: { loading: boolean }) => useDelayedLoading(loading),
      { initialProps: { loading: true } },
    );
    act(() => { jest.advanceTimersByTime(100); });
    rerender({ loading: false });
    act(() => { jest.advanceTimersByTime(500); });
    expect(result.current).toBe(false);
  });

  it('once shown, holds for the 300ms minimum even if loading ends immediately', () => {
    const { result, rerender } = renderHook(
      ({ loading }: { loading: boolean }) => useDelayedLoading(loading),
      { initialProps: { loading: true } },
    );
    act(() => { jest.advanceTimersByTime(150); });   // now visible
    expect(result.current).toBe(true);
    rerender({ loading: false });                     // finished right away
    act(() => { jest.advanceTimersByTime(200); });    // < 300ms held
    expect(result.current).toBe(true);
    act(() => { jest.advanceTimersByTime(120); });    // past the minimum
    expect(result.current).toBe(false);
  });
});
