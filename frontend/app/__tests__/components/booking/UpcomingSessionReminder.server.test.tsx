/** @jest-environment node */
import { renderToString } from 'react-dom/server';
import UpcomingSessionReminder from '@/app/components/booking/UpcomingSessionReminder';
import { useBookingStore } from '@/lib/stores/bookingStore';
import { useAuthStore } from '@/lib/stores/authStore';

jest.mock('@/lib/stores/bookingStore', () => ({
  useBookingStore: jest.fn(),
}));

jest.mock('@/lib/stores/authStore', () => ({
  useAuthStore: jest.fn(),
}));

const mockedUseBookingStore = useBookingStore as jest.Mock;
const mockedUseAuthStore = useAuthStore as jest.Mock;

describe('UpcomingSessionReminder (server)', () => {
  it('renders safely when window is undefined', () => {
    mockedUseAuthStore.mockReturnValue({
      justLoggedIn: false,
      clearJustLoggedIn: jest.fn(),
    });
    mockedUseBookingStore.mockReturnValue({
      upcomingReminder: null,
      fetchUpcomingReminder: jest.fn(),
    });

    const html = renderToString(<UpcomingSessionReminder />);

    expect(html).toBe('');
  });
});
