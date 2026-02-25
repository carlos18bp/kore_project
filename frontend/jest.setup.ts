import '@testing-library/jest-dom';

/* ─── Suppress known React DOM warnings from next/image boolean attrs ─── */
const _origError = console.error.bind(console);
beforeAll(() => {
  jest.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
    const msg = args.map(String).join(' ');
    if (
      (msg.includes('non-boolean attribute') &&
        (msg.includes('fill') || msg.includes('priority'))) ||
      msg.includes('was not wrapped in act(') ||
      msg.includes('Not implemented: navigation')
    ) {
      return;
    }
    _origError(...args);
  });
});
afterAll(() => {
  jest.restoreAllMocks();
});

/* ─── GSAP mock ─── */
const gsapMock = {
  registerPlugin: jest.fn(),
  context: jest.fn((_fn: unknown, _ref: unknown) => {
    if (typeof _fn === 'function') _fn();
    return { revert: jest.fn() };
  }),
  set: jest.fn(),
  to: jest.fn(),
  from: jest.fn(),
  timeline: jest.fn(() => ({
    from: jest.fn().mockReturnThis(),
    to: jest.fn().mockReturnThis(),
  })),
};

jest.mock('gsap', () => ({
  __esModule: true,
  default: gsapMock,
  gsap: gsapMock,
}));

jest.mock('gsap/ScrollTrigger', () => ({
  __esModule: true,
  ScrollTrigger: { defaults: jest.fn(), create: jest.fn() },
}));

