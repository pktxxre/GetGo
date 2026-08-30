// Jest global setup.
//
// AsyncStorage is a native module (null under Jest's node runtime), so any test that imports
// lib/supabase — directly or transitively — would fail at import. The library ships an
// official in-memory mock for exactly this; wire it in once, globally, so the Supabase client
// constructs cleanly in tests. This mocks storage only; it doesn't change what the tests prove.
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
