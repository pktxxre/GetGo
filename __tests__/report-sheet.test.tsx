import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';

const mockReport = jest.fn().mockResolvedValue(undefined);
jest.mock('../lib/reports', () => ({
  reportPost: (...a: any[]) => mockReport(...a),
  REPORT_REASONS: [
    { value: 'spam', label: 'spam or a scam' },
    { value: 'other', label: 'something else' },
  ],
}));

import { ReportSheet } from '../components/quest/ReportSheet';

const onClose = jest.fn();

beforeEach(() => {
  mockReport.mockClear().mockResolvedValue(undefined);
  onClose.mockClear();
});

describe('ReportSheet', () => {
  it('cannot send until a reason is chosen', () => {
    render(<ReportSheet postId="p1" reporterId="u1" onClose={onClose} />);
    fireEvent.press(screen.getByText('send report'));
    expect(mockReport).not.toHaveBeenCalled();
  });

  it('sends the chosen reason and acknowledges receipt', async () => {
    render(<ReportSheet postId="p1" reporterId="u1" onClose={onClose} />);
    fireEvent.press(screen.getByLabelText('spam or a scam'));
    fireEvent.press(screen.getByText('send report'));
    await waitFor(() => expect(mockReport).toHaveBeenCalledWith('p1', 'u1', 'spam', ''));
    expect(await screen.findByText('thanks — we’ll take a look')).toBeTruthy();
  });

  it('surfaces a duplicate report kindly instead of a raw error', async () => {
    mockReport.mockRejectedValue({ code: '23505' });
    render(<ReportSheet postId="p1" reporterId="u1" onClose={onClose} />);
    fireEvent.press(screen.getByLabelText('something else'));
    fireEvent.press(screen.getByText('send report'));
    expect(await screen.findByText(/already reported this one/)).toBeTruthy();
  });

  it('a generic failure surfaces inline, not as a success', async () => {
    mockReport.mockRejectedValue(new Error('network'));
    render(<ReportSheet postId="p1" reporterId="u1" onClose={onClose} />);
    fireEvent.press(screen.getByLabelText('spam or a scam'));
    fireEvent.press(screen.getByText('send report'));
    expect(await screen.findByText(/couldn’t send that/)).toBeTruthy();
    expect(screen.queryByText('thanks — we’ll take a look')).toBeNull();
  });
});
