// pickNeighbourhood is pure; expo-location is only imported for its types, so an empty mock
// keeps the module importable in Jest without pulling the native module.
jest.mock('expo-location', () => ({}));
import { pickNeighbourhood } from '../lib/location';

const addr = (over: any = {}) => ({ district: null, subregion: null, city: null, name: null, ...over });

describe('pickNeighbourhood', () => {
  it('prefers the most local label, then falls outward toward the city', () => {
    expect(pickNeighbourhood([addr({ district: 'Shoreditch', subregion: 'Hackney', city: 'London' })])).toBe('Shoreditch');
    expect(pickNeighbourhood([addr({ subregion: 'Hackney', city: 'London' })])).toBe('Hackney');
    expect(pickNeighbourhood([addr({ city: 'London' })])).toBe('London');
    expect(pickNeighbourhood([addr({ name: 'Somewhere' })])).toBe('Somewhere');
  });

  it('returns null when there is nothing usable', () => {
    expect(pickNeighbourhood([])).toBeNull();
    expect(pickNeighbourhood([addr({ district: '   ' })])).toBeNull();
  });

  it('caps the name to a fact-line label length', () => {
    expect(pickNeighbourhood([addr({ district: 'x'.repeat(80) })])?.length).toBe(60);
  });
});
