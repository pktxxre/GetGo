import { render, screen, fireEvent } from '@testing-library/react-native';
import type { FeedItem } from '../lib/feed';

// Control the feed state directly — the front door's job is to render the right surface for
// each status, not to fetch. (The fetch/mapping is covered in lib/feed.test.ts; RLS is
// pgTAP's job.) StateScreen reaches for the router on the error branch, so stub it too.
const mockReplace = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace, back: jest.fn(), canGoBack: () => false }),
}));

let mockFeedState: { items: FeedItem[]; status: string; reload: jest.Mock };
const reload = jest.fn();
jest.mock('../hooks/useFeed', () => ({ useFeed: () => mockFeedState }));

// Loading is delay-gated in real life; make it deterministic in the test.
jest.mock('../hooks/useDelayedLoading', () => ({ useDelayedLoading: (isLoading: boolean) => isLoading }));

import QuestList from '../app/index';

const item = (over: Partial<FeedItem> = {}): FeedItem => ({
  id: 'p1',
  caption: 'a warehouse that is just every neon sign london ever threw away.',
  ordinal: 4,
  neighbourhood: 'Walthamstow',
  handle: 'priya',
  photo: { uri: 'https://x/1.jpg', aspectRatio: 0.8 },
  ...over,
});

beforeEach(() => {
  mockFeedState = { items: [], status: 'ready', reload };
  reload.mockClear();
  mockReplace.mockClear();
});

describe('QuestList (front door)', () => {
  it('renders the wordmark and a live count when ready', () => {
    mockFeedState = { items: [item()], status: 'ready', reload };
    render(<QuestList />);
    expect(screen.getByText('getgo')).toBeTruthy();
    expect(screen.getByText(/LONDON .* 1 SIDEQUESTS/)).toBeTruthy();
  });

  it('shows a real tile: caption plus the red rarity fact line', () => {
    mockFeedState = { items: [item()], status: 'ready', reload };
    render(<QuestList />);
    expect(screen.getByText(/every neon sign london/)).toBeTruthy();
    expect(screen.getByText('4TH EVER')).toBeTruthy();
    expect(screen.getByText('WALTHAMSTOW')).toBeTruthy();
  });

  it('loading says developing…, never the empty copy', () => {
    mockFeedState = { items: [], status: 'loading', reload };
    render(<QuestList />);
    expect(screen.getByText('developing…')).toBeTruthy();
    expect(screen.queryByText(/nothing here yet/i)).toBeNull();
  });

  it('empty says nothing here yet, never developing…', () => {
    mockFeedState = { items: [], status: 'ready', reload };
    render(<QuestList />);
    expect(screen.getByText(/NOTHING HERE YET/)).toBeTruthy();
    expect(screen.queryByText('developing…')).toBeNull();
  });

  it('a failed load offers retry, wired to reload', () => {
    mockFeedState = { items: [], status: 'error', reload };
    render(<QuestList />);
    fireEvent.press(screen.getByText('try again'));
    expect(reload).toHaveBeenCalled();
  });

  it('lets you switch tabs', () => {
    mockFeedState = { items: [item()], status: 'ready', reload };
    render(<QuestList />);
    fireEvent.press(screen.getByText('rarest'));
    expect(screen.getByText('rarest')).toBeTruthy();
  });
});
