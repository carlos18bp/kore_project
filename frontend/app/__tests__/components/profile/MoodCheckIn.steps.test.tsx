import { render, screen, fireEvent, waitFor } from '@testing-library/react';

jest.mock('js-cookie', () => ({ get: jest.fn(() => 'tok'), set: jest.fn(), remove: jest.fn() }));
jest.mock('@/lib/services/http', () => ({
  api: { get: jest.fn(), post: jest.fn(), patch: jest.fn(), delete: jest.fn(), put: jest.fn() },
  getWithRetry: jest.fn(),
  extractApiError: jest.fn((_e: unknown, fb: string) => fb),
}));
jest.mock('next/image', () => ({ __esModule: true, default: () => null }));

import { api } from '@/lib/services/http';
import { useAuthStore } from '@/lib/stores/authStore';
import { useProfileStore } from '@/lib/stores/profileStore';
import { useCreditValuesStore } from '@/lib/stores/creditValuesStore';
import MoodCheckIn from '@/app/components/profile/MoodCheckIn';

describe('MoodCheckIn 4-step flow', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    sessionStorage.clear();
    useAuthStore.setState({ hydrated: true, user: { id: 1, profile_completed: true } } as never);
    useProfileStore.setState({
      todayMood: null, moodModalOpen: true,
      profile: { customer_profile: { profile_completed: true } },
      fetchProfile: async () => {},
    } as never);
    useCreditValuesStore.setState({
      actionValues: { checkin: 5 }, loaded: true, fetchValues: async () => {},
    } as never);
  });

  it('walks the 4 steps and submits score + extras', async () => {
    (api.post as jest.Mock).mockResolvedValue({ data: { score: 8, notes: '', date: 'x', energy_level: 4, pain: false, ready_to_train: true } });
    render(<MoodCheckIn />);
    expect(screen.getByText(/\+5 créditos/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '8' }));
    await screen.findByText('¿Cuánta energía tienes?');
    fireEvent.click(screen.getByRole('button', { name: /Bien/ }));
    await screen.findByText('¿Tienes algún dolor o molestia?');
    fireEvent.click(screen.getByRole('button', { name: 'Sin dolor' }));
    await screen.findByText('¿Listo para entrenar hoy?');
    fireEvent.click(screen.getByRole('button', { name: '¡Listo para entrenar!' }));

    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/auth/mood/', {
      score: 8, energy_level: 4, pain: false, ready_to_train: true,
    }, expect.any(Object)));
  });
});
