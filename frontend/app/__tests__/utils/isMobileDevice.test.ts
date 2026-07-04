import { isMobileDevice } from '@/lib/utils/isMobileDevice';

function setNavigator(userAgent: string, maxTouchPoints: number) {
  Object.defineProperty(navigator, 'userAgent', {
    value: userAgent,
    configurable: true,
  });
  Object.defineProperty(navigator, 'maxTouchPoints', {
    value: maxTouchPoints,
    configurable: true,
  });
}

describe('isMobileDevice', () => {
  it('returns true for an iPhone user agent', () => {
    setNavigator('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)', 5);

    expect(isMobileDevice()).toBe(true);
  });

  it('returns true for an Android phone user agent', () => {
    setNavigator('Mozilla/5.0 (Linux; Android 14; Pixel 8)', 5);

    expect(isMobileDevice()).toBe(true);
  });

  it('returns true for a legacy iPad user agent', () => {
    setNavigator('Mozilla/5.0 (iPad; CPU OS 15_0 like Mac OS X)', 5);

    expect(isMobileDevice()).toBe(true);
  });

  it('returns true for a BlackBerry user agent', () => {
    setNavigator('Mozilla/5.0 (BlackBerry; U; BlackBerry 9900)', 0);

    expect(isMobileDevice()).toBe(true);
  });

  it('returns true for an Opera Mini user agent', () => {
    setNavigator('Opera/9.80 (J2ME/MIDP; Opera Mini/9.80)', 0);

    expect(isMobileDevice()).toBe(true);
  });

  it('returns false for a Windows desktop user agent', () => {
    setNavigator('Mozilla/5.0 (Windows NT 10.0; Win64; x64)', 0);

    expect(isMobileDevice()).toBe(false);
  });

  it('returns false for a Macintosh without touch support', () => {
    setNavigator('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 0);

    expect(isMobileDevice()).toBe(false);
  });

  it('returns false for a Linux desktop user agent', () => {
    setNavigator('Mozilla/5.0 (X11; Linux x86_64)', 0);

    expect(isMobileDevice()).toBe(false);
  });

  it('returns true for iPadOS reporting as Macintosh with multi-touch', () => {
    setNavigator('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 5);

    expect(isMobileDevice()).toBe(true);
  });
});
