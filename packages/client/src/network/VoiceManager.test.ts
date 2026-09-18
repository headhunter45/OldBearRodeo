import { describe, it, before } from 'node:test';
import assert from 'node:assert';

// Polyfill minimal browser globals for testing VoiceManager in Node
before(() => {
  const store: Record<string, string> = {};
  (globalThis as any).localStorage = {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, val: string) => {
      store[key] = val;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      for (const k in store) delete store[k];
    },
  };

  (globalThis as any).window = {
    addEventListener: () => {},
    removeEventListener: () => {},
    setInterval: () => 1,
    clearInterval: () => {},
    setTimeout: () => 1,
    clearTimeout: () => {},
  };

  Object.defineProperty(globalThis, 'navigator', {
    value: {
      mediaDevices: {
        addEventListener: () => {},
        removeEventListener: () => {},
        enumerateDevices: async () => [],
      },
    },
    configurable: true,
    writable: true,
  });
});

describe('VoiceManager State & Transmission Logic', async () => {
  const { VoiceManager } = await import('./VoiceManager.js');

  it('initializes with default transmission settings', () => {
    const vm = new VoiceManager();
    assert.strictEqual(vm.state.isMuted, true);
    assert.strictEqual(vm.state.isDeafened, false);
    assert.strictEqual(vm.state.isForceMuted, false);
    assert.strictEqual(vm.state.transmissionMode, 'open');
    assert.strictEqual(vm.state.pttKey, 'KeyV');
    vm.destroy();
  });

  it('handles mute and deafen toggles', () => {
    const vm = new VoiceManager();
    assert.strictEqual(vm.state.isMuted, true);
    vm.toggleMute();
    assert.strictEqual(vm.state.isMuted, false);
    vm.toggleMute();
    assert.strictEqual(vm.state.isMuted, true);

    vm.toggleDeafen();
    assert.strictEqual(vm.state.isDeafened, true);
    vm.toggleDeafen();
    assert.strictEqual(vm.state.isDeafened, false);
    vm.destroy();
  });

  it('handles GM force mute', () => {
    const vm = new VoiceManager();
    vm.handleForceMuted();
    assert.strictEqual(vm.state.isForceMuted, true);
    assert.strictEqual(vm.state.isMuted, true);

    // Toggle mute while force-muted should not unmute
    vm.toggleMute();
    assert.strictEqual(vm.state.isMuted, true);

    vm.clearForceMute();
    assert.strictEqual(vm.state.isForceMuted, false);
    vm.destroy();
  });

  it('manages transmission modes and push-to-talk activation', () => {
    const vm = new VoiceManager();
    vm.setTransmissionMode('ptt');
    assert.strictEqual(vm.state.transmissionMode, 'ptt');

    vm.setPttKey('Space', 'SPACE');
    assert.strictEqual(vm.state.pttKey, 'Space');
    assert.strictEqual(vm.state.pttKeyDisplay, 'SPACE');

    vm.setPttActive(true);
    assert.strictEqual(vm.state.isPttActive, true);
    vm.setPttActive(false);
    assert.strictEqual(vm.state.isPttActive, false);
    vm.destroy();
  });

  it('handles relative peer volume adjustments and bounds', () => {
    const vm = new VoiceManager();
    vm.setPeerVolume('peer-wizard', 1.5);
    assert.strictEqual(vm.getPeerVolume('peer-wizard'), 1.5);

    // Volume should clamp between 0 and 2
    vm.setPeerVolume('peer-rogue', 3.0);
    assert.strictEqual(vm.getPeerVolume('peer-rogue'), 2.0);

    vm.setPeerVolume('peer-fighter', -0.5);
    assert.strictEqual(vm.getPeerVolume('peer-fighter'), 0);
    vm.destroy();
  });
});
