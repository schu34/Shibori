// Add custom Jest matchers for asserting on DOM nodes
require('@testing-library/jest-dom');

// JSDOM does not implement canvas contexts. Individual canvas unit tests mock
// the behavior they need; the default prevents noisy "not implemented" errors
// from unrelated component and capability checks.
Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
    configurable: true,
    value: jest.fn(() => null),
});
