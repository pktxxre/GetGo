import { render } from '@testing-library/react-native';
import { Image, StyleSheet, View } from 'react-native';
import { GradedImage } from '../components/GradedImage';
import { grade } from '../theme/tokens';

// The photo is the Image carrying the passed uri source; the grain is the other Image.
const photoOf = (r: ReturnType<typeof render>) =>
  r.UNSAFE_getAllByType(Image).find((i) => i.props.source?.uri === 'https://x/a.jpg')!;

describe('GradedImage', () => {
  it('renders the photo and passes image props through', () => {
    const r = render(
      <GradedImage source={{ uri: 'https://x/a.jpg' }} style={{ width: 100, aspectRatio: 0.8 }} accessibilityLabel="a quest" />,
    );
    const img = photoOf(r);
    expect(img.props.accessibilityLabel).toBe('a quest');
    expect(img.props.resizeMode).toBe('cover'); // defaulted
  });

  it('applies the full image grade: −6% saturation, warm overlay, 4% grain (DESIGN)', () => {
    const r = render(<GradedImage source={{ uri: 'https://x/a.jpg' }} style={{ width: 100 }} />);
    // desaturation rides the filter style on the photo itself
    expect(StyleSheet.flatten(photoOf(r).props.style).filter).toEqual([{ saturate: grade.saturate }]);
    // a non-interactive warm wash sits over the photo
    const warm = r.UNSAFE_getAllByType(View).find(
      (v) => StyleSheet.flatten(v.props.style)?.backgroundColor === grade.warmth,
    );
    expect(warm).toBeTruthy();
    expect(warm!.props.pointerEvents).toBe('none');
    // a tiled grain layer at grade.grain opacity
    const grain = r.UNSAFE_getAllByType(Image).find((i) => i.props.resizeMode === 'repeat');
    expect(grain).toBeTruthy();
    expect(StyleSheet.flatten(grain!.props.style).opacity).toBe(grade.grain);
  });
});
