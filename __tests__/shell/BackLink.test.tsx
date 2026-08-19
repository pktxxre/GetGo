import { render, screen, fireEvent } from '@testing-library/react-native';

const mockBack = jest.fn();
const mockReplace = jest.fn();
let mockCanGoBack = true;
jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockBack, replace: mockReplace, canGoBack: () => mockCanGoBack }),
}));

import { BackLink } from '../../components/shell/BackLink';

describe('BackLink', () => {
  beforeEach(() => {
    mockBack.mockClear();
    mockReplace.mockClear();
  });

  it('pops history when there is history', () => {
    mockCanGoBack = true;
    render(<BackLink />);
    fireEvent.press(screen.getByLabelText('go back'));
    expect(mockBack).toHaveBeenCalledTimes(1);
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('replaces to the fallback when there is no history (deep-link arrival)', () => {
    mockCanGoBack = false;
    render(<BackLink fallback="/" />);
    fireEvent.press(screen.getByLabelText('go back'));
    expect(mockReplace).toHaveBeenCalledWith('/');
    expect(mockBack).not.toHaveBeenCalled();
  });

  it('renders the mono ← BACK label', () => {
    mockCanGoBack = true;
    render(<BackLink />);
    expect(screen.getByText('← BACK')).toBeTruthy();
  });
});
