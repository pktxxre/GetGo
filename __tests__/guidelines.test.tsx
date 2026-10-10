import { render, screen, fireEvent } from '@testing-library/react-native';

// The content policy screen (App Store Guideline 1.2). Static content — the test locks that the
// review-critical pieces are present: the no-tolerance stance, the prohibited-content list, the
// report + block pointers, and a tappable published contact.
jest.mock('expo-router', () => ({ useRouter: () => ({ back: jest.fn(), canGoBack: () => true }) }));

const mockContactSupport = jest.fn();
jest.mock('../lib/support', () => ({
  contactSupport: (...a: any[]) => mockContactSupport(...a),
  SUPPORT_EMAIL: 'hello@getgo.app',
}));

import GuidelinesScreen from '../app/guidelines';

beforeEach(() => mockContactSupport.mockClear());

describe('GuidelinesScreen', () => {
  it('states the zero-tolerance policy', () => {
    render(<GuidelinesScreen />);
    expect(screen.getByText(/zero tolerance for objectionable content/)).toBeTruthy();
  });

  it('lists prohibited content', () => {
    render(<GuidelinesScreen />);
    expect(screen.getByText(/nudity or sexual content/)).toBeTruthy();
    expect(screen.getByText(/hate or harassment/)).toBeTruthy();
  });

  it('points to the report and block mechanisms', () => {
    render(<GuidelinesScreen />);
    expect(screen.getByText('report this quest')).toBeTruthy();
    expect(screen.getByText('block')).toBeTruthy();
  });

  it('publishes a contact that opens mail when tapped', () => {
    render(<GuidelinesScreen />);
    fireEvent.press(screen.getByText('hello@getgo.app'));
    expect(mockContactSupport).toHaveBeenCalled();
  });
});
