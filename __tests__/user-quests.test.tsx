import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import type { FeedItem } from '../lib/feed';

// The screen's wiring is under test (which surface for which state, the handle titling, and the
// block control), not the real query — the hook is stubbed, as the feed/quest suites stub theirs.
let mockParams: { id?: string; handle?: string };
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn() }),
  useLocalSearchParams: () => mockParams,
}));
// Collapse the loading delay to a pass-through so the loading assertion is deterministic.
jest.mock('../hooks/useDelayedLoading', () => ({ useDelayedLoading: (v: boolean) => v }));

let mockState: { items: FeedItem[]; status: string; reload: jest.Mock };
const reload = jest.fn();
jest.mock('../hooks/useUserPosts', () => ({ useUserPosts: () => mockState }));

// Session + block layer are stubbed: existing tests run signed-out (no block control), the block
// tests inject a session and drive lib/blocks (whose real behaviour is pgTAP's job on 025).
let mockSession: any;
jest.mock('../lib/auth', () => ({ useSession: () => ({ session: mockSession }) }));

const mockFetchIsBlocked = jest.fn().mockResolvedValue(false);
const mockBlockUser = jest.fn().mockResolvedValue(undefined);
const mockUnblockUser = jest.fn().mockResolvedValue(undefined);
jest.mock('../lib/blocks', () => ({
  fetchIsBlocked: (...a: any[]) => mockFetchIsBlocked(...a),
  blockUser: (...a: any[]) => mockBlockUser(...a),
  unblockUser: (...a: any[]) => mockUnblockUser(...a),
}));

import UserQuests from '../app/user/[id]';

const item = (id: string): FeedItem => ({
  id,
  caption: 'did a thing',
  ordinal: 1,
  neighbourhood: 'Peckham',
  handle: 'theo',
  photo: { uri: 'https://x/a.jpg', aspectRatio: 0.8 },
});

beforeEach(() => {
  mockParams = { id: 'u-theo', handle: 'theo' };
  mockSession = null; // signed out by default
  reload.mockClear();
  mockFetchIsBlocked.mockClear().mockResolvedValue(false);
  mockBlockUser.mockClear().mockResolvedValue(undefined);
  mockUnblockUser.mockClear().mockResolvedValue(undefined);
});

describe('UserQuests screen', () => {
  it('titles the page with the @handle when ready', () => {
    mockState = { items: [item('p1'), item('p2')], status: 'ready', reload };
    render(<UserQuests />);
    expect(screen.getByText('@theo')).toBeTruthy();
  });

  it('falls back to a fetched author’s handle when the route omits it (deep link)', () => {
    mockParams = { id: 'u-theo' }; // no handle param
    mockState = { items: [item('p1')], status: 'ready', reload };
    render(<UserQuests />);
    expect(screen.getByText('@theo')).toBeTruthy();
  });

  it('shows an empty state when the user has no quests', () => {
    mockState = { items: [], status: 'ready', reload };
    render(<UserQuests />);
    expect(screen.getByText('NO QUESTS YET')).toBeTruthy();
  });

  it('a failed load offers retry wired to reload', () => {
    mockState = { items: [], status: 'error', reload };
    render(<UserQuests />);
    fireEvent.press(screen.getByText('try again'));
    expect(reload).toHaveBeenCalled();
  });
});

describe('UserQuests block control', () => {
  it('offers no block affordance when signed out', () => {
    mockState = { items: [item('p1')], status: 'ready', reload };
    render(<UserQuests />);
    expect(screen.queryByText('block @theo')).toBeNull();
  });

  it('offers no block affordance on your own profile', () => {
    mockSession = { user: { id: 'u-theo' } }; // me === the profile
    mockState = { items: [item('p1')], status: 'ready', reload };
    render(<UserQuests />);
    expect(screen.queryByText('block @theo')).toBeNull();
    expect(mockFetchIsBlocked).not.toHaveBeenCalled();
  });

  it('lets a signed-in visitor block another user, then shows unblock', async () => {
    mockSession = { user: { id: 'me' } };
    mockState = { items: [item('p1')], status: 'ready', reload };
    render(<UserQuests />);

    fireEvent.press(await screen.findByText('block @theo'));
    fireEvent.press(screen.getByText('block them')); // confirm
    expect(mockBlockUser).toHaveBeenCalledWith('me', 'u-theo');

    expect(await screen.findByText('unblock')).toBeTruthy();
    expect(reload).toHaveBeenCalled();
  });

  it('when already blocked, hides their grid and offers unblock', async () => {
    mockSession = { user: { id: 'me' } };
    mockFetchIsBlocked.mockResolvedValue(true);
    mockState = { items: [item('p1')], status: 'ready', reload };
    render(<UserQuests />);

    expect(await screen.findByText('unblock')).toBeTruthy();
    // the blocked author's grid is deliberately not rendered
    expect(screen.queryByText('did a thing')).toBeNull();

    fireEvent.press(screen.getByText('unblock'));
    expect(mockUnblockUser).toHaveBeenCalledWith('me', 'u-theo');
  });
});
