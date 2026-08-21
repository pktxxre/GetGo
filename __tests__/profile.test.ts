import { normalizeHandle, validateHandle } from '../lib/profile';

describe('normalizeHandle', () => {
  it('lowercases, trims, and drops a leading @', () => {
    expect(normalizeHandle('  @Mara ')).toBe('mara');
    expect(normalizeHandle('@@Scenic_Route')).toBe('scenic_route');
    expect(normalizeHandle('theo')).toBe('theo');
  });
});

describe('validateHandle', () => {
  it('accepts 3–20 lowercase letters, digits and underscores', () => {
    expect(validateHandle('mara')).toBeNull();
    expect(validateHandle('scenic_route7')).toBeNull();
    expect(validateHandle('@Mara')).toBeNull(); // normalised before checking
  });

  it('rejects too short / too long', () => {
    expect(validateHandle('ab')).toMatch(/3 characters or more/);
    expect(validateHandle('a'.repeat(21))).toMatch(/20 characters max/);
  });

  it('rejects punctuation and spaces', () => {
    expect(validateHandle('has-dash')).toMatch(/letters, numbers and underscores/);
    expect(validateHandle('has space')).toMatch(/letters, numbers and underscores/);
  });
});
