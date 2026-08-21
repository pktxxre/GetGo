import { render, screen, fireEvent } from '@testing-library/react-native';

const mockSendCode = jest.fn().mockResolvedValue(undefined);
const mockVerifyCode = jest.fn().mockResolvedValue(undefined);
jest.mock('../lib/auth', () => ({ useSession: () => ({ sendCode: mockSendCode, verifyCode: mockVerifyCode }) }));

import { AuthSheet } from '../components/auth/AuthSheet';

beforeEach(() => {
  mockSendCode.mockClear();
  mockVerifyCode.mockClear();
});

describe('AuthSheet (email → code)', () => {
  it('walks email → code and calls verify, then onAuthed', async () => {
    const onAuthed = jest.fn();
    render(<AuthSheet onClose={jest.fn()} onAuthed={onAuthed} />);

    fireEvent.changeText(screen.getByLabelText('your email'), 'you@email.com');
    fireEvent.press(screen.getByText('send me a code'));
    expect(mockSendCode).toHaveBeenCalledWith('you@email.com');

    const codeField = await screen.findByLabelText('6-digit code');
    fireEvent.changeText(codeField, '123456');
    fireEvent.press(screen.getByText('let me in'));
    expect(mockVerifyCode).toHaveBeenCalledWith('you@email.com', '123456');
    await screen.findByText('let me in'); // flush the awaited handler
    expect(onAuthed).toHaveBeenCalled();
  });

  it('surfaces a bad code inline, not as a toast', async () => {
    mockVerifyCode.mockRejectedValueOnce(new Error('nope'));
    render(<AuthSheet onClose={jest.fn()} onAuthed={jest.fn()} />);

    fireEvent.changeText(screen.getByLabelText('your email'), 'you@email.com');
    fireEvent.press(screen.getByText('send me a code'));
    const codeField = await screen.findByLabelText('6-digit code');
    fireEvent.changeText(codeField, '000000');
    fireEvent.press(screen.getByText('let me in'));

    expect(await screen.findByText(/that code didn’t match/)).toBeTruthy();
  });
});
