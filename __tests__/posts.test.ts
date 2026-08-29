import { extFromUri, photoObjectKey, poundsToPence, uuidv4 } from '../lib/posts';

describe('extFromUri', () => {
  it('reads a lowercased extension from a file uri', () => {
    expect(extFromUri('file:///tmp/IMG_0042.JPG')).toBe('jpg');
    expect(extFromUri('/data/user/photo.png')).toBe('png');
    expect(extFromUri('https://cdn.test/a/b.webp?token=1')).toBe('webp');
  });

  it('defaults to jpg when there is no usable extension', () => {
    expect(extFromUri('file:///tmp/no-extension-here')).toBe('jpg');
    expect(extFromUri('content://media/external/images/42')).toBe('jpg');
  });
});

describe('photoObjectKey', () => {
  it('puts the owner uuid first so the storage insert policy accepts it (011)', () => {
    const key = photoObjectKey('61616161-6161-6161-6161-616161616161', 'p1', 0, 'jpg');
    expect(key).toBe('61616161-6161-6161-6161-616161616161/p1/0.jpg');
    // the first path segment is what (storage.foldername(name))[1] compares to auth.uid()
    expect(key.split('/')[0]).toBe('61616161-6161-6161-6161-616161616161');
  });
});

describe('poundsToPence', () => {
  it('parses pounds into integer pence', () => {
    expect(poundsToPence('4')).toBe(400);
    expect(poundsToPence('4.20')).toBe(420);
    expect(poundsToPence('4.2')).toBe(420); // "4.2" and "4.20" both land on 420
    expect(poundsToPence('£3.50')).toBe(350); // a stray £ prefix is tolerated
  });

  it('treats free as 0 and empty as unset (null)', () => {
    expect(poundsToPence('0')).toBe(0);
    expect(poundsToPence('')).toBeNull();
    expect(poundsToPence('   ')).toBeNull();
  });

  it('rejects a non-number or negative as unset (null)', () => {
    expect(poundsToPence('free')).toBeNull();
    expect(poundsToPence('-2')).toBeNull();
  });
});

describe('uuidv4', () => {
  it('produces a distinct, v4-shaped id each call', () => {
    const a = uuidv4();
    const b = uuidv4();
    expect(a).not.toBe(b);
    expect(a).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });
});
