import { readFileSync } from 'fs';
import { join } from 'path';
import { render } from '@testing-library/react-native';
import { Placeholder } from '../../components/shell/Placeholder';

describe('Placeholder', () => {
  it('imports no animation — shimmer is banned (DESIGN.md → Motion)', () => {
    const src = readFileSync(join(__dirname, '../../components/shell/Placeholder.tsx'), 'utf8');
    expect(src).not.toMatch(/\bAnimated\b/);
    expect(src).not.toMatch(/react-native-reanimated/);
  });

  it('is hidden from screen readers (loading is announced as text, not empty views)', () => {
    const { UNSAFE_root } = render(<Placeholder height={100} />);
    const view = UNSAFE_root.findAllByType(require('react-native').View)[0];
    expect(view.props.accessibilityElementsHidden).toBe(true);
    expect(view.props.importantForAccessibility).toBe('no-hide-descendants');
  });
});
