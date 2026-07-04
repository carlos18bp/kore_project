import { renderHook, act } from '@testing-library/react';
import { useSplashGate } from '@/lib/hooks/useSplashGate';
import { SPLASH_SHOWN_KEY } from '@/lib/stores/authStore';

describe('useSplashGate', () => {
  afterEach(() => {
    sessionStorage.clear();
    jest.clearAllMocks();
  });

  it('starts with splashDone false when the splash was never shown', () => {
    const { result } = renderHook(() => useSplashGate());

    expect(result.current.splashDone).toBe(false);
  });

  it('starts with splashDone true when the splash flag is already set', () => {
    sessionStorage.setItem(SPLASH_SHOWN_KEY, '1');

    const { result } = renderHook(() => useSplashGate());

    expect(result.current.splashDone).toBe(true);
  });

  it('sets splashDone true after handleSplashDone is called', () => {
    const { result } = renderHook(() => useSplashGate());

    act(() => {
      result.current.handleSplashDone();
    });

    expect(result.current.splashDone).toBe(true);
  });

  it('persists the splash flag to sessionStorage after handleSplashDone', () => {
    const { result } = renderHook(() => useSplashGate());

    act(() => {
      result.current.handleSplashDone();
    });

    expect(sessionStorage.getItem(SPLASH_SHOWN_KEY)).toBe('1');
  });
});
