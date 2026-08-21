import { render, screen, fireEvent } from '@testing-library/react-native';
import type { QuestDetail } from '../lib/quest';

const mockReplace = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace, back: jest.fn(), canGoBack: () => false }),
  useLocalSearchParams: () => ({ id: 'p1' }),
}));

let mockQuestState: { quest: QuestDetail | null; status: string; reload: jest.Mock };
const reload = jest.fn();
jest.mock('../hooks/useQuest', () => ({ useQuest: () => mockQuestState }));

// Auth + saves are stubbed: this suite tests the screen's wiring (which surface for which
// state), not the real OTP/RLS round-trip (that's the e2e script + pgTAP).
let mockSession: any;
jest.mock('../lib/auth', () => ({ useSession: () => mockSession }));

const mockSaveQuest = jest.fn().mockResolvedValue(undefined);
const mockIsSaved = jest.fn().mockResolvedValue(false);
jest.mock('../lib/saves', () => ({
  saveQuest: (...a: any[]) => mockSaveQuest(...a),
  isSaved: (...a: any[]) => mockIsSaved(...a),
}));

import QuestDetailScreen from '../app/quest/[id]';

const quest = (over: Partial<QuestDetail> = {}): QuestDetail => ({
  id: 'p1',
  templateId: 't1',
  title: 'find the herons in kyoto garden',
  caption: 'the herons do not care about you',
  ordinal: 212,
  handle: 'theo',
  neighbourhood: 'Holland Park',
  effort: 1,
  nerve: 2,
  costPence: 0,
  photos: [{ uri: 'https://x/a.jpg', aspectRatio: 0.8 }],
  awesome: 2,
  couldBeCooler: 1,
  ...over,
});

const signedOut = { session: null, initializing: false, sendCode: jest.fn(), verifyCode: jest.fn(), signOut: jest.fn() };
const signedIn = { ...signedOut, session: { user: { id: 'u1' } } };

beforeEach(() => {
  reload.mockClear();
  mockReplace.mockClear();
  mockSaveQuest.mockClear();
  mockIsSaved.mockClear();
  mockSession = signedOut;
});

describe('QuestDetail screen', () => {
  it('renders title, stamp values, byline and reception when ready', () => {
    mockQuestState = { quest: quest(), status: 'ready', reload };
    render(<QuestDetailScreen />);
    expect(screen.getByText('find the herons in kyoto garden')).toBeTruthy();
    expect(screen.getByText('212TH')).toBeTruthy();
    expect(screen.getByText('free')).toBeTruthy();
    expect(screen.getByText('low')).toBeTruthy();
    expect(screen.getByText('@theo')).toBeTruthy();
    expect(screen.getByText('2 said awesome. 1 said could be cooler.')).toBeTruthy();
  });

  it('a signed-out save opens the auth sheet, does not persist yet', () => {
    mockQuestState = { quest: quest(), status: 'ready', reload };
    render(<QuestDetailScreen />);
    fireEvent.press(screen.getByText('save it'));
    expect(screen.getByText('save it to your log')).toBeTruthy(); // AuthSheet
    expect(mockSaveQuest).not.toHaveBeenCalled();
  });

  it('a signed-in save persists and lands the stamp', async () => {
    mockSession = signedIn;
    mockQuestState = { quest: quest(), status: 'ready', reload };
    render(<QuestDetailScreen />);
    fireEvent.press(screen.getByText('save it'));
    expect(await screen.findByText('saved')).toBeTruthy(); // button resting state
    expect(mockSaveQuest).toHaveBeenCalledWith('u1', 't1');
    expect(screen.getByText(/^SAVED · /)).toBeTruthy(); // the stamp landed
  });

  it('a missing/invisible post is notFound, not an error', () => {
    mockQuestState = { quest: null, status: 'notFound', reload };
    render(<QuestDetailScreen />);
    expect(screen.getByText('this one isn’t in the archive')).toBeTruthy();
  });

  it('a network failure offers retry wired to reload', () => {
    mockQuestState = { quest: null, status: 'error', reload };
    render(<QuestDetailScreen />);
    fireEvent.press(screen.getByText('try again'));
    expect(reload).toHaveBeenCalled();
  });
});
