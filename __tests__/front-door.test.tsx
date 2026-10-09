import { render, screen, fireEvent } from '@testing-library/react-native';
import type { FeedItem } from '../lib/feed';

// Control the feed state directly — the front door's job is to render the right surface for
// each status, not to fetch. (The fetch/mapping is covered in lib/feed.test.ts; RLS is
// pgTAP's job.) StateScreen reaches for the router on the error branch, so stub it too.
const mockReplace = jest.fn();
const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace, back: jest.fn(), canGoBack: () => false }),
  router: { push: (...a: any[]) => mockPush(...a), replace: mockReplace },
  // The focus refetch is a no-op here — the front door's job is to render the right surface
  // per status, not to re-fetch. (refresh-on-focus behaviour lives with useFeed.)
  useFocusEffect: () => {},
}));

// The "you" door reads the session to decide push-to-profile vs. auth-first; the auth sheet's
// internals aren't the front door's concern, so stand it in.
let mockSession: any;
jest.mock('../lib/auth', () => ({ useSession: () => ({ session: mockSession }) }));
jest.mock('../components/auth/AuthSheet', () => ({ AuthSheet: () => null }));

let mockFeedState: { items: FeedItem[]; status: string; reload: jest.Mock };
const reload = jest.fn();
jest.mock('../hooks/useFeed', () => ({ useFeed: () => mockFeedState }));

// Nearby is layered on the same screen; stub it too (its fetch + location prompt live in the
// hook, tested via lib/feed + pgTAP). Default 'idle' = the pre-select tick.
let mockNearbyState: { items: FeedItem[]; status: string; reload: jest.Mock };
const nearbyReload = jest.fn();
jest.mock('../hooks/useNearby', () => ({ useNearby: () => mockNearbyState }));

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
  mockNearbyState = { items: [], status: 'idle', reload: nearbyReload };
  reload.mockClear();
  nearbyReload.mockClear();
  mockReplace.mockClear();
  mockPush.mockClear();
  mockSession = { user: { id: 'u1' } };
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
    expect(screen.getByText('4TH')).toBeTruthy(); // tile drops the EVER suffix (detail keeps it)
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

  it('the nearby tab shows a location prompt inline (tabs stay reachable), retry wired', () => {
    mockNearbyState = { items: [], status: 'needsLocation', reload: nearbyReload };
    render(<QuestList />);
    fireEvent.press(screen.getByText('nearby'));
    expect(screen.getByText(/NEARBY NEEDS YOUR LOCATION/)).toBeTruthy();
    fireEvent.press(screen.getByText('try again'));
    expect(nearbyReload).toHaveBeenCalled();
    // still inline — the tabs (and the time feed) weren't replaced by a full-screen state
    expect(screen.getByText('what’s new')).toBeTruthy();
  });

  it('the "you" door goes to your profile when signed in', () => {
    render(<QuestList />);
    fireEvent.press(screen.getByLabelText('you'));
    expect(mockPush).toHaveBeenCalledWith('/you');
  });

  it('the "you" door captures identity first for a stranger (no nav yet)', () => {
    mockSession = null;
    render(<QuestList />);
    fireEvent.press(screen.getByLabelText('you'));
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('the nearby tab renders its own distance-sorted tiles when ready', () => {
    mockNearbyState = { items: [item({ id: 'n1', neighbourhood: 'Deptford' })], status: 'ready', reload: nearbyReload };
    render(<QuestList />);
    fireEvent.press(screen.getByText('nearby'));
    expect(screen.getByText('DEPTFORD')).toBeTruthy();
  });
});
