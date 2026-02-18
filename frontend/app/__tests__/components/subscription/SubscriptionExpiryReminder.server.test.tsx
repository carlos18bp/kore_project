/** @jest-environment node */
import { renderToString } from 'react-dom/server';
import SubscriptionExpiryReminder from '@/app/components/subscription/SubscriptionExpiryReminder';
import { useSubscriptionStore } from '@/lib/stores/subscriptionStore';
import { useAuthStore } from '@/lib/stores/authStore';

jest.mock('@/lib/stores/subscriptionStore', () => ({
  useSubscriptionStore: jest.fn(),
}));

jest.mock('@/lib/stores/authStore', () => ({
  useAuthStore: jest.fn(),
}));

const mockedUseSubscriptionStore = useSubscriptionStore as jest.Mock;
const mockedUseAuthStore = useAuthStore as jest.Mock;

describe('SubscriptionExpiryReminder (server)', () => {
  it('renders safely when window is undefined', () => {
    mockedUseAuthStore.mockReturnValue({
      justLoggedIn: false,
      clearJustLoggedIn: jest.fn(),
    });
    mockedUseSubscriptionStore.mockReturnValue({
      expiryReminder: null,
      fetchExpiryReminder: jest.fn(),
      acknowledgeExpiryReminder: jest.fn(),
    });

    const html = renderToString(<SubscriptionExpiryReminder />);

    expect(html).toBe('');
  });
});
