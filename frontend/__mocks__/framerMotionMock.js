const React = require('react');

const motion = new Proxy(
  {},
  {
    get: (_target, tag) => {
      return React.forwardRef(function MotionComponent({ children, ...props }, ref) {
        return React.createElement(tag, { ...props, ref }, children);
      });
    },
  }
);

const AnimatePresence = function ({ children }) {
  return children;
};

module.exports = {
  __esModule: true,
  motion,
  AnimatePresence,
  useAnimation: () => ({ start: jest.fn(), stop: jest.fn(), set: jest.fn() }),
  useInView: () => false,
  useMotionValue: (initial) => ({ get: () => initial, set: jest.fn() }),
  useTransform: (_mv, _input, output) => ({ get: () => output[0], set: jest.fn() }),
};
