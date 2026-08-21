import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

let mockPathname = '/a';
const mockReplace = jest.fn();
jest.mock('expo-router', () => ({
  usePathname: () => mockPathname,
  useRouter: () => ({ replace: mockReplace, back: jest.fn(), canGoBack: () => false }),
}));

import { ErrorBoundary } from '../../components/shell/ErrorBoundary';

function Boom(): React.ReactElement {
  throw new Error('kaboom');
}

describe('ErrorBoundary', () => {
  let spy: jest.SpyInstance;
  beforeEach(() => {
    mockPathname = '/a';
    spy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => spy.mockRestore());

  it('renders the crashed state when a child throws', () => {
    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
    );
    expect(screen.getByText('that’s on us')).toBeTruthy();
  });

  it('resets on route change so the next screen renders normally', () => {
    const { rerender } = render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
    );
    expect(screen.getByText('that’s on us')).toBeTruthy();

    // Navigate away: pathname changes and the child no longer throws.
    mockPathname = '/b';
    rerender(
      <ErrorBoundary>
        <Text>front door</Text>
      </ErrorBoundary>,
    );
    expect(screen.getByText('front door')).toBeTruthy();
    expect(screen.queryByText('that’s on us')).toBeNull();
  });
});
