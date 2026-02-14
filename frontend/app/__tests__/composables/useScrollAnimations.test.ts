import { renderHook } from '@testing-library/react';
import gsap from 'gsap';
import { useTextReveal, useHeroAnimation } from '@/app/composables/useScrollAnimations';

describe('useScrollAnimations', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('useTextReveal', () => {
    it('calls gsap.context with the container ref', () => {
      const div = document.createElement('div');
      const ref = { current: div };

      renderHook(() => useTextReveal(ref));

      expect(gsap.context).toHaveBeenCalledWith(expect.any(Function), ref);
    });

    it('does not call gsap.context when ref is null', () => {
      const ref = { current: null };

      renderHook(() => useTextReveal(ref));

      expect(gsap.context).not.toHaveBeenCalled();
    });

    it('calls ctx.revert on unmount (cleanup)', () => {
      const div = document.createElement('div');
      const ref = { current: div };
      const revertMock = jest.fn();
      (gsap.context as jest.Mock).mockReturnValueOnce({ revert: revertMock });

      const { unmount } = renderHook(() => useTextReveal(ref));
      unmount();

      expect(revertMock).toHaveBeenCalled();
    });
  });

  describe('useHeroAnimation', () => {
    it('calls gsap.context with the container ref', () => {
      const div = document.createElement('div');
      const ref = { current: div };

      renderHook(() => useHeroAnimation(ref));

      expect(gsap.context).toHaveBeenCalledWith(expect.any(Function), ref);
    });

    it('does not call gsap.context when ref is null', () => {
      const ref = { current: null };

      renderHook(() => useHeroAnimation(ref));

      expect(gsap.context).not.toHaveBeenCalled();
    });

    it('calls ctx.revert on unmount (cleanup)', () => {
      const div = document.createElement('div');
      const ref = { current: div };
      const revertMock = jest.fn();
      (gsap.context as jest.Mock).mockReturnValueOnce({ revert: revertMock });

      const { unmount } = renderHook(() => useHeroAnimation(ref));
      unmount();

      expect(revertMock).toHaveBeenCalled();
    });
  });
});
