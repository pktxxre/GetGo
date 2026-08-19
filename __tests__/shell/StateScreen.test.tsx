import { render, screen, fireEvent } from '@testing-library/react-native';

const mockReplace = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace, back: jest.fn(), canGoBack: () => false }),
}));

import { StateScreen } from '../../components/shell/StateScreen';

describe('StateScreen', () => {
  beforeEach(() => mockReplace.mockClear());

  it('renders all three kinds with their titles', () => {
    const { rerender } = render(<StateScreen kind="notFound" />);
    expect(screen.getByText('this one isn’t in the archive')).toBeTruthy();
    rerender(<StateScreen kind="failed" />);
    expect(screen.getByText('taking the scenic route')).toBeTruthy();
    rerender(<StateScreen kind="crashed" />);
    expect(screen.getByText('that’s on us')).toBeTruthy();
  });

  it('offers retry ONLY on failed', () => {
    const onPrimary = jest.fn();

    // failed: primary IS the retry
    render(<StateScreen kind="failed" onPrimary={onPrimary} />);
    fireEvent.press(screen.getByText('try again'));
    expect(onPrimary).toHaveBeenCalledTimes(1);
    expect(mockReplace).not.toHaveBeenCalled();
    // and it still has a distinct escape to the front door
    expect(screen.getByText('browse london')).toBeTruthy();
  });

  it('notFound has no retry — its primary goes home, not to onPrimary', () => {
    const onPrimary = jest.fn();
    render(<StateScreen kind="notFound" onPrimary={onPrimary} />);
    fireEvent.press(screen.getByText('browse london'));
    expect(onPrimary).not.toHaveBeenCalled();
    expect(mockReplace).toHaveBeenCalledWith('/');
  });

  it('crashed has no retry — its primary goes home', () => {
    const onPrimary = jest.fn();
    render(<StateScreen kind="crashed" onPrimary={onPrimary} />);
    fireEvent.press(screen.getByText('back to london'));
    expect(onPrimary).not.toHaveBeenCalled();
    expect(mockReplace).toHaveBeenCalledWith('/');
  });
});
