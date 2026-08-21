import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';

// Compose leans on the picker, auth, the supabase client and createPost — all stubbed so this
// suite proves the screen's wiring (fresh vs redo → what it hands createPost), not the real
// upload/RPC round-trip (that's the e2e script + pgTAP).
let mockParams: { templateId?: string; questTitle?: string };
const mockReplace = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace, back: jest.fn(), canGoBack: () => false }),
  router: { replace: (...a: any[]) => mockReplace(...a), push: jest.fn() },
  useLocalSearchParams: () => mockParams,
}));

jest.mock('expo-image-picker', () => ({
  requestMediaLibraryPermissionsAsync: jest.fn().mockResolvedValue({ granted: true }),
  requestCameraPermissionsAsync: jest.fn().mockResolvedValue({ granted: true }),
  launchImageLibraryAsync: jest
    .fn()
    .mockResolvedValue({ canceled: false, assets: [{ uri: 'file:///x.jpg', mimeType: 'image/jpeg', width: 800, height: 1000 }] }),
  launchCameraAsync: jest.fn(),
}));

jest.mock('../lib/auth', () => ({ useSession: () => ({ session: { user: { id: 'u1' } } }) }));
jest.mock('../lib/supabase', () => ({
  supabase: { auth: { getSession: jest.fn().mockResolvedValue({ data: { session: { user: { id: 'u1' } } } }) } },
}));

const mockCreatePost = jest.fn().mockResolvedValue({ post: { id: 'new1' }, xp_total: 50, level: 2, leveled_up: true });
jest.mock('../lib/posts', () => ({ createPost: (...a: any[]) => mockCreatePost(...a) }));

import Compose from '../app/compose';

beforeEach(() => {
  mockParams = {};
  mockReplace.mockClear();
  mockCreatePost.mockClear();
});

async function attachPhotoAndPost() {
  fireEvent.press(screen.getByText('choose a photo'));
  await screen.findByText('replace photo'); // photo landed
  fireEvent.press(screen.getByText('post it'));
  await waitFor(() => expect(mockCreatePost).toHaveBeenCalled());
}

describe('Compose', () => {
  it('a fresh post sends the typed quest name and no template', async () => {
    mockParams = {};
    render(<Compose />);
    fireEvent.changeText(screen.getByLabelText('quest name'), 'swim the ponds at dawn');
    await attachPhotoAndPost();

    expect(mockCreatePost).toHaveBeenCalledTimes(1);
    const arg = mockCreatePost.mock.calls[0][0];
    expect(arg.title).toBe('swim the ponds at dawn');
    expect(arg.templateId).toBeNull();
    expect(mockReplace).toHaveBeenCalledWith('/quest/new1');
  });

  it('a redo carries the template and drops the name (the template already names it)', async () => {
    mockParams = { templateId: 't7', questTitle: 'night market crawl' };
    render(<Compose />);

    expect(screen.getByText('you did this too')).toBeTruthy();
    expect(screen.getByText('night market crawl')).toBeTruthy();
    expect(screen.queryByLabelText('quest name')).toBeNull(); // no naming in redo mode

    await attachPhotoAndPost();
    const arg = mockCreatePost.mock.calls[0][0];
    expect(arg.templateId).toBe('t7');
    expect(arg.title).toBeNull();
  });
});
