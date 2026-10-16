/* global globalThis */
import 'react-native';
import {render} from '@testing-library/react-native';
import * as React from 'react';

// The native media module and the network do not exist under Jest.
jest.mock('@amazon-devices/react-native-w3cmedia', () => ({
  VideoPlayer: class {},
  KeplerVideoSurfaceView: () => null,
}));
jest.mock('../src/net/socket', () => ({
  getSocket: () => ({connected: false, on: jest.fn(), off: jest.fn()}),
  pingOnce: jest.fn(),
}));

import {App} from '../src/App';

describe('App', () => {
  beforeEach(() => {
    globalThis.fetch = jest.fn(() => new Promise<never>(() => {}));
  });

  it('shows every diagnostics check while SHOW_DIAGNOSTICS is on', () => {
    const screen = render(<App />);
    expect(screen.getByText('Pip diagnostics')).toBeTruthy();
    for (const label of [
      'SERVER_URL',
      'GET /health',
      'Socket.IO',
      'GET /api/films',
      'Film',
    ]) {
      expect(screen.getByText(label)).toBeTruthy();
    }
  });
});
