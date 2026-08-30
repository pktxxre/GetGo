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
jest.mock('../lib/posts', () => ({
  createPost: (...a: any[]) => mockCreatePost(...a),
  // poundsToPence is pure; use the real one so the cost field maps as it does in the app.
  poundsToPence: jest.requireActual('../lib/posts').poundsToPence,
}));

// captureLocation is thin device glue; stub it so the screen's wiring is what's under test.
const mockCaptureLocation = jest.fn().mockResolvedValue({ lat: 51.5, lon: -0.07, neighbourhood: 'Shoreditch' });
jest.mock('../lib/location', () => ({ captureLocation: (...a: any[]) => mockCaptureLocation(...a) }));

import Compose from '../app/compose';

beforeEach(() => {
  mockParams = {};
  mockReplace.mockClear();
  mockCreatePost.mockClear();
  mockCaptureLocation.mockClear();
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

  it("a fresh post sends the author's classification (016), and leaves unset axes null", async () => {
    mockParams = {};
    render(<Compose />);
    fireEvent.press(screen.getByLabelText('effort high')); // effort → 3
    fireEvent.press(screen.getByLabelText('nerve low')); // nerve → 1
    fireEvent.changeText(screen.getByLabelText('cost in pounds'), '4.50');
    await attachPhotoAndPost();

    const arg = mockCreatePost.mock.calls[0][0];
    expect(arg.effort).toBe(3);
    expect(arg.nerve).toBe(1);
    expect(arg.costPence).toBe(450);
  });

  it('a fresh post attaches captured location when the author adds it (019)', async () => {
    mockParams = {};
    render(<Compose />);
    fireEvent.press(screen.getByLabelText('add location'));
    await screen.findByText('SHOREDITCH'); // the captured neighbourhood shows in the WHERE row
    await attachPhotoAndPost();

    const arg = mockCreatePost.mock.calls[0][0];
    expect(arg.neighbourhood).toBe('Shoreditch');
    expect(arg.lat).toBe(51.5);
    expect(arg.lon).toBe(-0.07);
  });

  it('a fresh post with no location added sends null location', async () => {
    mockParams = {};
    render(<Compose />);
    await attachPhotoAndPost();

    const arg = mockCreatePost.mock.calls[0][0];
    expect(arg.neighbourhood).toBeNull();
    expect(arg.lat).toBeNull();
    expect(mockCaptureLocation).not.toHaveBeenCalled();
  });

  it('a redo classifies nothing — the quest already has its axes', async () => {
    mockParams = { templateId: 't7', questTitle: 'night market crawl' };
    render(<Compose />);

    // no classify UI in redo mode (axes and location both come from the template)
    expect(screen.queryByLabelText('effort high')).toBeNull();
    expect(screen.queryByLabelText('cost in pounds')).toBeNull();
    expect(screen.queryByLabelText('add location')).toBeNull();

    await attachPhotoAndPost();
    const arg = mockCreatePost.mock.calls[0][0];
    expect(arg.effort).toBeNull();
    expect(arg.nerve).toBeNull();
    expect(arg.costPence).toBeNull();
    expect(arg.neighbourhood).toBeNull();
    expect(arg.lat).toBeNull();
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
