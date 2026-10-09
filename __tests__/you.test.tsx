import { render, screen, fireEvent } from '@testing-library/react-native';
import type { FeedItem } from '../lib/feed';

// The self-profile's wiring: the grid for your own posts, the settings door, and the
// signed-out fallback. The query + RLS are lib/feed + pgTAP's job; the hook is stubbed.
const mockPush = jest.fn();
const mockReplace = jest.fn();
jest.mock('expo-router', () => ({
  router: { push: (...a: any[]) => mockPush(...a), replace: (...a: any[]) => mockReplace(...a) },
  useRouter: () => ({ push: mockPush, replace: mockReplace, back: jest.fn(), canGoBack: () => false }),
}));

let mockSession: any;
jest.mock('../lib/auth', () => ({ useSession: () => ({ session: mockSession }) }));
jest.mock('../lib/profile', () => ({ fetchMyHandle: jest.fn().mockResolvedValue('scenic_route') }));
jest.mock('../hooks/useDelayedLoading', () => ({ useDelayedLoading: (v: boolean) => v }));

let mockState: { items: FeedItem[]; status: string; reload: jest.Mock };
const reload = jest.fn();
jest.mock('../hooks/useUserPosts', () => ({ useUserPosts: () => mockState }));

let mockSaved: { items: FeedItem[]; status: string; reload: jest.Mock };
const savedReload = jest.fn();
jest.mock('../hooks/useSavedQuests', () => ({ useSavedQuests: () => mockSaved }));

// Stand in for the auth sheet so the signed-out branch is identifiable without its internals.
jest.mock('../components/auth/AuthSheet', () => ({ AuthSheet: () => null }));

import YouScreen from '../app/you';

const item = (id: string): FeedItem => ({
  id,
  caption: 'did a thing',
  ordinal: 1,
  neighbourhood: 'Peckham',
  handle: 'scenic_route',
  photo: { uri: 'https://x/a.jpg', aspectRatio: 0.8 },
});

beforeEach(() => {
  mockSession = { user: { id: 'u1' } };
  mockState = { items: [item('p1')], status: 'ready', reload };
  mockSaved = { items: [], status: 'idle', reload: savedReload };
  mockPush.mockClear();
  mockReplace.mockClear();
  reload.mockClear();
  savedReload.mockClear();
});

describe('YouScreen (self profile)', () => {
  it('titles the page with your handle', async () => {
    render(<YouScreen />);
    expect(await screen.findByText('@scenic_route')).toBeTruthy();
  });

  it('the settings link opens the account surface', () => {
    render(<YouScreen />);
    fireEvent.press(screen.getByLabelText('settings'));
    expect(mockPush).toHaveBeenCalledWith('/settings');
  });

  it('shows a self-specific empty state when you have no quests', () => {
    mockState = { items: [], status: 'ready', reload };
    render(<YouScreen />);
    expect(screen.getByText('YOUR LOG IS EMPTY')).toBeTruthy();
  });

  it('a failed load offers retry wired to reload', () => {
    mockState = { items: [], status: 'error', reload };
    render(<YouScreen />);
    fireEvent.press(screen.getByText('try again'));
    expect(reload).toHaveBeenCalled();
  });

  it('the saved tab shows the saved collection, not your posts', () => {
    mockSaved = {
      items: [{ ...item('s1'), caption: 'swim the serpentine', ordinal: null }],
      status: 'ready',
      reload: savedReload,
    };
    render(<YouScreen />);
    fireEvent.press(screen.getByText('saved'));
    expect(screen.getByText('swim the serpentine')).toBeTruthy();
  });

  it('the saved tab has its own empty copy', () => {
    mockSaved = { items: [], status: 'ready', reload: savedReload };
    render(<YouScreen />);
    fireEvent.press(screen.getByText('saved'));
    expect(screen.getByText('NOTHING SAVED YET')).toBeTruthy();
  });

  it('signed-out renders the auth sheet, not the grid', () => {
    mockSession = null;
    render(<YouScreen />);
    expect(screen.queryByText('did a thing')).toBeNull();
  });
});
