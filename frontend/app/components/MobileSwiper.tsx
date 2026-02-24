'use client';

import { ReactNode } from 'react';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Autoplay, Pagination } from 'swiper/modules';
import 'swiper/css';
import 'swiper/css/pagination';
import './swiper-overrides.css';

type MobileSwiperProps = {
  children: ReactNode[];
  slidesPerView?: number;
  spaceBetween?: number;
  autoplay?: boolean;
  autoplayDelay?: number;
  className?: string;
};

export default function MobileSwiper({
  children,
  slidesPerView = 1.2,
  spaceBetween = 12,
  autoplay = true,
  autoplayDelay = 4000,
  className = '',
}: MobileSwiperProps) {
  return (
    <div className={`md:hidden overflow-hidden ${className}`}>
      <Swiper
        modules={[Autoplay, Pagination]}
        slidesPerView={slidesPerView}
        spaceBetween={spaceBetween}
        centeredSlides={true}
        autoplay={
          autoplay
            ? { delay: autoplayDelay, disableOnInteraction: false, pauseOnMouseEnter: true }
            : false
        }
        pagination={{ clickable: true }}
        style={{ paddingBottom: '40px' }}
      >
        {children.map((child, index) => (
          <SwiperSlide key={index} style={{ height: 'auto' }}>
            <div className="h-full">{child}</div>
          </SwiperSlide>
        ))}
      </Swiper>
    </div>
  );
}
