import { renderHook } from '@testing-library/react';
import gsap from 'gsap';
import { useTextReveal, useHeroAnimation } from '@/app/composables/useScrollAnimations';

function buildTextRevealContainer() {
  const container = document.createElement('div');

  ['fade-up', 'fade-up-slow', 'fade-left', 'fade-right', 'scale-in', 'split-text'].forEach((mode) => {
    const element = document.createElement('div');
    element.setAttribute('data-animate', mode);
    container.appendChild(element);
  });

  const staggerElement = document.createElement('div');
  staggerElement.setAttribute('data-animate', 'stagger-children');
  staggerElement.appendChild(document.createElement('span'));
  container.appendChild(staggerElement);

  return container;
}

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

    it('exercises animation branches including fade-up-slow via gsap.context callback', () => {
      const ref = { current: buildTextRevealContainer() };

      // Capture the callback passed to gsap.context and invoke it
      let contextCallback: (() => void) | null = null;
      (gsap.context as jest.Mock).mockImplementationOnce((cb: () => void) => {
        contextCallback = cb;
        return { revert: jest.fn() };
      });

      renderHook(() => useTextReveal(ref));

      expect(contextCallback).not.toBeNull();
      // Execute the callback to cover all switch branches
      contextCallback!();

      // gsap.set and gsap.to should have been called for each element
      expect(gsap.set).toHaveBeenCalled();
      expect(gsap.to).toHaveBeenCalled();
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

    it('animates all hero elements with timeline steps', () => {
      const container = document.createElement('div');
      const badge = document.createElement('div');
      badge.setAttribute('data-hero', 'badge');
      const heading = document.createElement('div');
      heading.setAttribute('data-hero', 'heading');
      const subtitle = document.createElement('div');
      subtitle.setAttribute('data-hero', 'subtitle');
      const body = document.createElement('div');
      body.setAttribute('data-hero', 'body');
      const cta = document.createElement('div');
      cta.setAttribute('data-hero', 'cta');
      const stats = document.createElement('div');
      stats.setAttribute('data-hero', 'stats');
      const image = document.createElement('div');
      image.setAttribute('data-hero', 'image');

      container.appendChild(badge);
      container.appendChild(heading);
      container.appendChild(subtitle);
      container.appendChild(body);
      container.appendChild(cta);
      container.appendChild(stats);
      container.appendChild(image);

      const ref = { current: container };

      renderHook(() => useHeroAnimation(ref));

      expect(gsap.timeline).toHaveBeenCalledWith({ defaults: { ease: 'power3.out' } });
      const timeline = (gsap.timeline as jest.Mock).mock.results[0].value;
      const targets = timeline.from.mock.calls.map((call: unknown[]) => call[0]);
      expect(targets).toEqual(expect.arrayContaining([
        badge,
        heading,
        subtitle,
        body,
        cta,
        stats,
        image,
      ]));
      expect(timeline.from).toHaveBeenCalledTimes(7);
    });

    it('omits position offset when heading renders without badge', () => {
      const container = document.createElement('div');
      const heading = document.createElement('div');
      heading.setAttribute('data-hero', 'heading');
      container.appendChild(heading);

      const ref = { current: container };

      renderHook(() => useHeroAnimation(ref));

      const timeline = (gsap.timeline as jest.Mock).mock.results[0].value;
      expect(timeline.from).toHaveBeenCalledTimes(1);
      expect(timeline.from).toHaveBeenCalledWith(
        heading,
        expect.objectContaining({ opacity: 0, y: 40, duration: 0.8 }),
        undefined,
      );
    });
  });
});
