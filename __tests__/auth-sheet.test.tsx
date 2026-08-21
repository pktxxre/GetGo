import { render, screen, fireEvent } from '@testing-library/react-native';

const mockSendCode = jest.fn().mockResolvedValue(undefined);
const mockVerifyCode = jest.fn().mockResolvedValue(undefined);
jest.mock('../lib/auth', () => ({ useSession: () => ({ sendCode: mockSendCode, verifyCode: mockVerifyCode }) }));

const mockFetchMyHandle = jest.fn();
const mockClaimHandle = jest.fn();
// Keep the real pure validators / error class; only stub the two network calls.
jest.mock('../lib/profile', () => ({
  ...jest.requireActual('../lib/profile'),
  fetchMyHandle: (...a: unknown[]) => mockFetchMyHandle(...a),
  claimHandle: (...a: unknown[]) => mockClaimHandle(...a),
}));

import { AuthSheet } from '../components/auth/AuthSheet';
import { HandleTakenError } from '../lib/profile';

beforeEach(() => {
  mockSendCode.mockClear();
  mockVerifyCode.mockClear();
  mockFetchMyHandle.mockReset().mockResolvedValue('mara'); // default: returning user, has a handle
  mockClaimHandle.mockReset().mockResolvedValue('yourname');
});

async function walkToVerified(code = '123456') {
  fireEvent.changeText(screen.getByLabelText('your email'), 'you@email.com');
  fireEvent.press(screen.getByText('send me a code'));
  const codeField = await screen.findByLabelText('6-digit code');
  fireEvent.changeText(codeField, code);
  fireEvent.press(screen.getByText('let me in'));
}

describe('AuthSheet (email → code → handle)', () => {
  it('a returning user (handle already set) goes straight in after the code', async () => {
    const onAuthed = jest.fn();
    render(<AuthSheet onClose={jest.fn()} onAuthed={onAuthed} />);

    await walkToVerified();
    expect(mockVerifyCode).toHaveBeenCalledWith('you@email.com', '123456');
    // no handle step — flush the awaited handler and assert we're through
    await screen.findByText('let me in');
    expect(onAuthed).toHaveBeenCalled();
    expect(mockClaimHandle).not.toHaveBeenCalled();
  });

  it('surfaces a bad code inline, not as a toast', async () => {
    mockVerifyCode.mockRejectedValueOnce(new Error('nope'));
    render(<AuthSheet onClose={jest.fn()} onAuthed={jest.fn()} />);

    await walkToVerified('000000');
    expect(await screen.findByText(/that code didn’t match/)).toBeTruthy();
  });

  it('a first-time user is asked for a handle, then claims it and goes in', async () => {
    mockFetchMyHandle.mockResolvedValue(null); // brand-new: no handle yet
    const onAuthed = jest.fn();
    render(<AuthSheet onClose={jest.fn()} onAuthed={onAuthed} />);

    await walkToVerified();
    const handleField = await screen.findByLabelText('your handle');
    expect(onAuthed).not.toHaveBeenCalled(); // held at the handle step

    fireEvent.changeText(handleField, 'scenicroute');
    fireEvent.press(screen.getByText('claim it'));
    expect(mockClaimHandle).toHaveBeenCalledWith('scenicroute');
    await screen.findByText('claim it'); // flush
    expect(onAuthed).toHaveBeenCalled();
  });

  it('rejects an invalid handle inline without hitting the server', async () => {
    mockFetchMyHandle.mockResolvedValue(null);
    render(<AuthSheet onClose={jest.fn()} onAuthed={jest.fn()} />);

    await walkToVerified();
    const handleField = await screen.findByLabelText('your handle');
    fireEvent.changeText(handleField, 'ab'); // too short
    fireEvent.press(screen.getByText('claim it'));

    expect(await screen.findByText(/3 characters or more/)).toBeTruthy();
    expect(mockClaimHandle).not.toHaveBeenCalled();
  });

  it('says a taken handle is taken', async () => {
    mockFetchMyHandle.mockResolvedValue(null);
    mockClaimHandle.mockRejectedValueOnce(new HandleTakenError());
    render(<AuthSheet onClose={jest.fn()} onAuthed={jest.fn()} />);

    await walkToVerified();
    const handleField = await screen.findByLabelText('your handle');
    fireEvent.changeText(handleField, 'mara');
    fireEvent.press(screen.getByText('claim it'));

    expect(await screen.findByText(/that one’s taken/)).toBeTruthy();
  });
});
