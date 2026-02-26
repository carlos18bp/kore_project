import { render, screen } from '@testing-library/react';
import MobileSwiper from '@/app/components/MobileSwiper';

describe('MobileSwiper', () => {
  it('renders children inside SwiperSlide wrappers', () => {
    render(
      <MobileSwiper>
        {[<span key="a">Slide A</span>, <span key="b">Slide B</span>]}
      </MobileSwiper>
    );

    expect(screen.getByText('Slide A')).toBeInTheDocument();
    expect(screen.getByText('Slide B')).toBeInTheDocument();
    expect(screen.getAllByTestId('swiper-slide')).toHaveLength(2);
  });

  it('renders the swiper container with default props', () => {
    render(
      <MobileSwiper>
        {[<span key="a">Item</span>]}
      </MobileSwiper>
    );

    const swiper = screen.getByTestId('swiper');
    expect(swiper).toBeInTheDocument();
  });

  it('applies custom className to the outer wrapper', () => {
    const { container } = render(
      <MobileSwiper className="my-custom-class">
        {[<span key="a">Item</span>]}
      </MobileSwiper>
    );

    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.className).toContain('my-custom-class');
  });

  it('renders without className when not provided (uses empty string default)', () => {
    const { container } = render(
      <MobileSwiper>
        {[<span key="a">Item</span>]}
      </MobileSwiper>
    );

    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.className).toContain('md:hidden overflow-hidden ');
  });

  it('renders with autoplay disabled (covers false branch of autoplay ternary)', () => {
    render(
      <MobileSwiper autoplay={false}>
        {[<span key="a">No Autoplay</span>]}
      </MobileSwiper>
    );

    expect(screen.getByText('No Autoplay')).toBeInTheDocument();
    expect(screen.getByTestId('swiper')).toBeInTheDocument();
  });

  it('renders with custom slidesPerView and spaceBetween', () => {
    render(
      <MobileSwiper slidesPerView={2} spaceBetween={24}>
        {[<span key="a">Item A</span>, <span key="b">Item B</span>]}
      </MobileSwiper>
    );

    expect(screen.getAllByTestId('swiper-slide')).toHaveLength(2);
  });

  it('renders with custom autoplayDelay', () => {
    render(
      <MobileSwiper autoplay={true} autoplayDelay={2000}>
        {[<span key="a">Delayed</span>]}
      </MobileSwiper>
    );

    expect(screen.getByText('Delayed')).toBeInTheDocument();
  });
});
