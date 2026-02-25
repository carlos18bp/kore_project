const React = require('react');

const Swiper = function ({ children }) {
  return React.createElement('div', { 'data-testid': 'swiper' }, children);
};

const SwiperSlide = function ({ children }) {
  return React.createElement('div', { 'data-testid': 'swiper-slide' }, children);
};

module.exports = {
  __esModule: true,
  Swiper,
  SwiperSlide,
};
