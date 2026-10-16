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
  sendHello: jest.fn(),
  setHelloPlayback: jest.fn(),
  pingOnce: jest.fn(),
}));

import {App} from '../src/App';

describe('App', () => {
  it('shows a sleeping Pip and "Connecting" before the first view', () => {
    const screen = render(<App />);
    expect(screen.getByText('Connecting')).toBeTruthy();
    expect(screen.getByLabelText('Pip is sleep')).toBeTruthy();
  });
});
