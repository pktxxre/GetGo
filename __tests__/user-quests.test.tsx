import { render, screen, fireEvent } from '@testing-library/react-native';
import type { FeedItem } from '../lib/feed';

// The screen's wiring is under test (which surface for which state, and the handle titling),
// not the real query — the hook is stubbed, as the feed/quest suites stub theirs.
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
  reload.mockClear();
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
