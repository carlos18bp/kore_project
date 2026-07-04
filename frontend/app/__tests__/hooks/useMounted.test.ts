import { renderHook } from '@testing-library/react';
import { useMounted } from '@/lib/hooks/useMounted';

describe('useMounted', () => {
  it('returns true after the mount effect has run', () => {
    const { result } = renderHook(() => useMounted());

    expect(result.current).toBe(true);
  });

  it('stays true across rerenders', () => {
    const { result, rerender } = renderHook(() => useMounted());

    rerender();

    expect(result.current).toBe(true);
  });
});
