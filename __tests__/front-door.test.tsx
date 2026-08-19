import { render, screen, fireEvent } from '@testing-library/react-native';
import QuestList from '../app/index';

describe('QuestList (front door)', () => {
  it('renders the wordmark and London city line', () => {
    render(<QuestList />);
    expect(screen.getByText('getgo')).toBeTruthy();
    // 0 sidequests until the feed is wired up.
    expect(screen.getByText(/LONDON .* 0 SIDEQUESTS/)).toBeTruthy();
  });

  it('shows the quiet empty state, not a spinner', () => {
    render(<QuestList />);
    expect(screen.getByText(/DEVELOPING/)).toBeTruthy();
  });

  it('lets you switch tabs', () => {
    render(<QuestList />);
    // Tapping a tab shouldn't throw; the label stays present after selection.
    fireEvent.press(screen.getByText('rarest'));
    expect(screen.getByText('rarest')).toBeTruthy();
  });
});
