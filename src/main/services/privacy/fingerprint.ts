import type { WebContents } from 'electron'

/**
 * Provides browser fingerprint randomization by injecting JavaScript
 * into web pages. This protects against Canvas, WebGL, and AudioContext
 * fingerprinting techniques.
 */
export class FingerprintProtection {
  /**
   * Injects fingerprint protection scripts into the given webContents.
   * Should be called after the page starts loading but before scripts execute,
   * e.g. on 'did-start-navigation' or via webContents.setWindowOpenHandler.
   */
  injectFingerprintProtection(webContents: WebContents): void {
    const noise = this.generateNoise()

    const script = `
      (() => {
        // Idempotency guard: re-injection on the same page must not stack overrides
        if (window.__wiseWanderFpApplied) return;
        window.__wiseWanderFpApplied = true;
        const __fpNoise = ${JSON.stringify(noise)};

        // ─── Canvas Fingerprint Protection ────────────────────────────
        // Intercepts toDataURL, toBlob, and getImageData to inject noise
        const _origToDataURL = HTMLCanvasElement.prototype.toDataURL;
        HTMLCanvasElement.prototype.toDataURL = function (...args) {
          const ctx = this.getContext('2d');
          if (ctx) {
            __fpInjectCanvasNoise(ctx);
          }
          return _origToDataURL.apply(this, args);
        };

        const _origToBlob = HTMLCanvasElement.prototype.toBlob;
        HTMLCanvasElement.prototype.toBlob = function (callback, ...args) {
          const ctx = this.getContext('2d');
          if (ctx) {
            __fpInjectCanvasNoise(ctx);
          }
          return _origToBlob.call(this, callback, ...args);
        };

        const _origGetImageData = CanvasRenderingContext2D.prototype.getImageData;
        CanvasRenderingContext2D.prototype.getImageData = function (...args) {
          const imageData = _origGetImageData.apply(this, args);
          __fpInjectImageDataNoise(imageData);
          return imageData;
        };

        function __fpInjectCanvasNoise(ctx) {
          try {
            const imageData = ctx.getImageData(0, 0, 1, 1);
            __fpInjectImageDataNoise(imageData);
            ctx.putImageData(imageData, 0, 0);
          } catch (_) {
            // Canvas may be tainted; ignore
          }
        }

        function __fpInjectImageDataNoise(imageData) {
          if (!imageData || !imageData.data) return;
          const data = imageData.data;
          const offset = __fpNoise.canvasNoiseOffset % data.length;
          if (offset < data.length) {
            data[offset] = (data[offset] + __fpNoise.canvasNoiseValue) % 256;
          }
        }

        // ─── WebGL Fingerprint Protection ────────────────────────────
        const _origGetParameter = WebGLRenderingContext.prototype.getParameter;
        WebGLRenderingContext.prototype.getParameter = function (param) {
          // UNMASKED_VENDOR_WEBGL
          if (param === 0x9245) {
            return __fpNoise.webglVendor;
          }
          // UNMASKED_RENDERER_WEBGL
          if (param === 0x9246) {
            return __fpNoise.webglRenderer;
          }
          return _origGetParameter.call(this, param);
        };

        // Also cover WebGL2
        if (typeof WebGL2RenderingContext !== 'undefined') {
          const _origGetParameter2 = WebGL2RenderingContext.prototype.getParameter;
          WebGL2RenderingContext.prototype.getParameter = function (param) {
            if (param === 0x9245) {
              return __fpNoise.webglVendor;
            }
            if (param === 0x9246) {
              return __fpNoise.webglRenderer;
            }
            return _origGetParameter2.call(this, param);
          };
        }

        // ─── AudioContext Fingerprint Protection ─────────────────────
        const _origCreateOscillator = (AudioContext.prototype.createOscillator || function () {});
        const _origGetChannelData = AudioBuffer.prototype.getChannelData;

        AudioBuffer.prototype.getChannelData = function (channel) {
          const data = _origGetChannelData.call(this, channel);
          if (data && data.length > 0) {
            // Apply a subtle noise offset that doesn't affect audible quality
            const noiseIndex = __fpNoise.audioNoiseOffset % data.length;
            data[noiseIndex] += __fpNoise.audioNoiseValue;
          }
          return data;
        };

        // ─── Navigator Properties ────────────────────────────────────
        const _origGetHardwareConcurrency = Object.getOwnPropertyDescriptor(
          Navigator.prototype,
          'hardwareConcurrency'
        )?.get;

        if (_origGetHardwareConcurrency) {
          Object.defineProperty(Navigator.prototype, 'hardwareConcurrency', {
            get: function () {
              return __fpNoise.hardwareConcurrency;
            },
            configurable: true,
          });
        }

        const _origGetDeviceMemory = Object.getOwnPropertyDescriptor(
          Navigator.prototype,
          'deviceMemory'
        )?.get;

        if (_origGetDeviceMemory) {
          Object.defineProperty(Navigator.prototype, 'deviceMemory', {
            get: function () {
              return __fpNoise.deviceMemory;
            },
            configurable: true,
          });
        }

        // ─── Screen Properties ───────────────────────────────────────
        if (window.screen) {
          const _origColorDepth = Object.getOwnPropertyDescriptor(
            Screen.prototype,
            'colorDepth'
          )?.get;

          if (_origColorDepth) {
            Object.defineProperty(Screen.prototype, 'colorDepth', {
              get: function () {
                return __fpNoise.screenColorDepth;
              },
              configurable: true,
            });
          }
        }

        // ─── Date/Timezone Protection ────────────────────────────────
        const _origGetTimezoneOffset = Date.prototype.getTimezoneOffset;
        Date.prototype.getTimezoneOffset = function () {
          return _origGetTimezoneOffset.call(this) + __fpNoise.timezoneOffsetNoise;
        };

      })();
    `

    webContents.executeJavaScript(script).catch(() => {
      // Injection may fail on certain pages (e.g., about:blank, chrome://)
      // Silently ignore these errors.
    })
  }

  /**
   * Generates a set of random noise values used to perturb fingerprint signals.
   * Called once per protection injection so each session has unique noise.
   */
  generateNoise(): FingerprintNoise {
    const randInt = (min: number, max: number): number =>
      Math.floor(Math.random() * (max - min + 1)) + min

    const randFloat = (min: number, max: number): number =>
      Math.random() * (max - min) + min

    const webglVendors = [
      'Google Inc. (Intel)',
      'Google Inc. (NVIDIA)',
      'Google Inc. (AMD)',
      'Google Inc.',
    ]

    const webglRenderers = [
      'ANGLE (Intel, Intel(R) UHD Graphics 630, OpenGL 4.5)',
      'ANGLE (NVIDIA, NVIDIA GeForce GTX 1060, OpenGL 4.6)',
      'ANGLE (AMD, AMD Radeon RX 580, OpenGL 4.5)',
      'ANGLE (Intel, Intel(R) Iris(R) Xe Graphics, OpenGL 4.5)',
    ]

    return {
      // Canvas noise
      canvasNoiseOffset: randInt(0, 255),
      canvasNoiseValue: randInt(1, 10),

      // WebGL overrides
      webglVendor: webglVendors[randInt(0, webglVendors.length - 1)],
      webglRenderer: webglRenderers[randInt(0, webglRenderers.length - 1)],

      // Audio fingerprint noise
      audioNoiseOffset: randInt(0, 100),
      audioNoiseValue: randFloat(-0.0001, 0.0001),

      // Hardware noise
      hardwareConcurrency: randInt(2, 8),
      deviceMemory: [2, 4, 8, 16][randInt(0, 3)],

      // Screen noise
      screenColorDepth: [24, 30, 32][randInt(0, 2)],

      // Timezone noise (small offset to vary the result)
      timezoneOffsetNoise: randInt(-1, 1),
    }
  }
}

export interface FingerprintNoise {
  /** Pixel offset in imageData array to perturb for canvas noise */
  canvasNoiseOffset: number
  /** Value to add to the pixel at canvasNoiseOffset */
  canvasNoiseValue: number
  /** Fake WebGL vendor string */
  webglVendor: string
  /** Fake WebGL renderer string */
  webglRenderer: string
  /** Sample offset in audio buffer to perturb */
  audioNoiseOffset: number
  /** Tiny value added to an audio sample */
  audioNoiseValue: number
  /** Fake navigator.hardwareConcurrency value */
  hardwareConcurrency: number
  /** Fake navigator.deviceMemory value */
  deviceMemory: number
  /** Fake screen.colorDepth value */
  screenColorDepth: number
  /** Small offset added to getTimezoneOffset result */
  timezoneOffsetNoise: number
}
