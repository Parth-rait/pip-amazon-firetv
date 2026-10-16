import { describe, expect, it } from 'vitest';
import { actionLabel, parseCommand } from './commands';

describe('parseCommand', () => {
  it('understands play and pause in everyday words', () => {
    expect(parseCommand('Pause')).toEqual({ type: 'media.pause' });
    expect(parseCommand('hold on a sec')).toEqual({ type: 'media.pause' });
    expect(parseCommand('play')).toEqual({ type: 'media.play' });
    expect(parseCommand('ok resume it')).toEqual({ type: 'media.play' });
  });

  it('seeks back or forward by what was said, 10 s by default', () => {
    expect(parseCommand('go back')).toEqual({ type: 'media.seekRelative', seconds: -10 });
    expect(parseCommand('back 30 seconds')).toEqual({ type: 'media.seekRelative', seconds: -30 });
    expect(parseCommand('skip ahead twenty')).toEqual({ type: 'media.seekRelative', seconds: 20 });
    expect(parseCommand('forward 1 minute')).toEqual({ type: 'media.seekRelative', seconds: 60 });
  });

  it('changes the volume and the brightness', () => {
    expect(parseCommand('louder please')).toEqual({ type: 'media.volumeDelta', delta: 0.1 });
    expect(parseCommand('turn it up a lot')).toEqual({ type: 'media.volumeDelta', delta: 0.3 });
    expect(parseCommand("it's too loud")).toEqual({ type: 'media.volumeDelta', delta: -0.1 });
    expect(parseCommand('mute')).toEqual({ type: 'media.volumeDelta', delta: -1 });
    expect(parseCommand('dim it')).toEqual({ type: 'media.brightnessDelta', delta: -0.15 });
    expect(parseCommand('a bit brighter')).toEqual({ type: 'media.brightnessDelta', delta: 0.15 });
  });

  it('sets the light scene', () => {
    expect(parseCommand('movie lights')).toEqual({ type: 'ambient.set', scene: 'movie' });
    expect(parseCommand('lights off')).toEqual({ type: 'ambient.set', scene: 'off' });
    expect(parseCommand('lights on')).toEqual({ type: 'ambient.set', scene: 'bright' });
  });

  it('leaves questions for Pip, even with a command word in them', () => {
    expect(parseCommand('why did he stop')).toBeNull();
    expect(parseCommand('who is that')).toBeNull();
    expect(parseCommand('what just happened')).toBeNull();
    expect(parseCommand('tell me about the dragon')).toBeNull();
  });

  it('calls Pip by name', () => {
    expect(parseCommand('Hey Pip')).toEqual({ type: 'pip.invoke' });
  });
});

describe('actionLabel', () => {
  it('says what the server did in plain words', () => {
    expect(actionLabel('pause')).toBe('Paused');
    expect(actionLabel('seek -10')).toBe('Back 10 s');
    expect(actionLabel('seek +30')).toBe('Forward 30 s');
    expect(actionLabel('volume 90%')).toBe('Volume 90%');
    expect(actionLabel('ambient.movie')).toBe('Movie lights');
  });
});
