import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';

// The screen's wiring is under test: which controls it shows, and that sign-out / delete fire
// the right calls and navigate. The RPC/teardown itself is account.test + pgTAP's job.
const mockReplace = jest.fn();
const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  router: { replace: (...a: any[]) => mockReplace(...a), push: (...a: any[]) => mockPush(...a) },
  useRouter: () => ({ replace: mockReplace, push: mockPush, back: jest.fn(), canGoBack: () => false }),
}));

const mockContactSupport = jest.fn();
jest.mock('../lib/support', () => ({
  contactSupport: (...a: any[]) => mockContactSupport(...a),
  SUPPORT_EMAIL: 'hello@getgo.app',
}));

let mockSession: any;
const mockSignOut = jest.fn().mockResolvedValue(undefined);
jest.mock('../lib/auth', () => ({ useSession: () => ({ session: mockSession, signOut: mockSignOut }) }));

jest.mock('../lib/profile', () => ({ fetchMyHandle: jest.fn().mockResolvedValue('scenic_route') }));

const mockDeleteAccount = jest.fn().mockResolvedValue(undefined);
jest.mock('../lib/account', () => ({ deleteAccount: (...a: any[]) => mockDeleteAccount(...a) }));

import SettingsScreen from '../app/settings';

beforeEach(() => {
  mockSession = { user: { id: 'u1', email: 'me@example.com' } };
  mockReplace.mockClear();
  mockPush.mockClear();
  mockContactSupport.mockClear();
  mockSignOut.mockClear();
  mockDeleteAccount.mockClear().mockResolvedValue(undefined);
});

describe('SettingsScreen', () => {
  it('shows the signed-in identity (handle + email)', async () => {
    render(<SettingsScreen />);
    expect(await screen.findByText('@scenic_route')).toBeTruthy();
    expect(screen.getByText('me@example.com')).toBeTruthy();
  });

  it('signs out and returns to the feed', async () => {
    render(<SettingsScreen />);
    fireEvent.press(screen.getByText('sign out'));
    await waitFor(() => expect(mockSignOut).toHaveBeenCalled());
    expect(mockReplace).toHaveBeenCalledWith('/');
  });

  it('delete is behind a confirm — one tap only reveals the warning, it does not delete', () => {
    render(<SettingsScreen />);
    fireEvent.press(screen.getByText('delete account'));
    expect(screen.getByText('delete your account?')).toBeTruthy();
    expect(mockDeleteAccount).not.toHaveBeenCalled();
  });

  it('confirming deletes the account and returns to the feed', async () => {
    render(<SettingsScreen />);
    fireEvent.press(screen.getByText('delete account'));
    fireEvent.press(screen.getByText('delete it for good'));
    await waitFor(() => expect(mockDeleteAccount).toHaveBeenCalled());
    expect(mockReplace).toHaveBeenCalledWith('/');
  });

  it('"keep it" backs out of the confirm without deleting', () => {
    render(<SettingsScreen />);
    fireEvent.press(screen.getByText('delete account'));
    fireEvent.press(screen.getByText('keep it'));
    expect(screen.queryByText('delete your account?')).toBeNull();
    expect(mockDeleteAccount).not.toHaveBeenCalled();
  });

  it('a failed delete surfaces inline and keeps you signed in (no navigation)', async () => {
    mockDeleteAccount.mockRejectedValue(new Error('nope'));
    render(<SettingsScreen />);
    fireEvent.press(screen.getByText('delete account'));
    fireEvent.press(screen.getByText('delete it for good'));
    expect(await screen.findByText(/couldn’t delete your account/)).toBeTruthy();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('signed-out (cold deep link) is bounced to the feed', () => {
    mockSession = null;
    render(<SettingsScreen />);
    expect(mockReplace).toHaveBeenCalledWith('/');
  });

  it('links to the community guidelines (Guideline 1.2 policy)', () => {
    render(<SettingsScreen />);
    fireEvent.press(screen.getByText('community guidelines'));
    expect(mockPush).toHaveBeenCalledWith('/guidelines');
  });

  it('contact us opens the published support contact', () => {
    render(<SettingsScreen />);
    fireEvent.press(screen.getByText('contact us'));
    expect(mockContactSupport).toHaveBeenCalled();
  });
});
