import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { act } from '@testing-library/react';
import TrainerMessageModal from '@/app/components/dashboard/TrainerMessageModal';
import { useAuthStore } from '@/lib/stores/authStore';
import { useProfileStore } from '@/lib/stores/profileStore';
import { api } from '@/lib/services/http';
import Cookies from 'js-cookie';

jest.mock('@/lib/stores/authStore', () => ({ useAuthStore: jest.fn() }));
jest.mock('@/lib/stores/profileStore', () => ({ useProfileStore: jest.fn() }));
jest.mock('@/lib/services/http', () => ({
  api: { get: jest.fn(), post: jest.fn() },
}));
jest.mock('js-cookie', () => ({ get: jest.fn(), set: jest.fn(), remove: jest.fn() }));

const mockedUseAuthStore = useAuthStore as unknown as jest.Mock;
const mockedUseProfileStore = useProfileStore as unknown as jest.Mock;
const mockedApi = api as jest.Mocked<typeof api>;

const MOCK_USER = { id: 1, email: 'user@kore.com', profile_completed: true };
const MOCK_PROFILE = { customer_profile: { profile_completed: true } };

const MOCK_MESSAGE = {
  id: 99,
  trigger_type: 'manual' as const,
  message: '¡Excelente progreso esta semana!',
  created_at: '2026-05-15T09:00:00Z',
  trainer_name: 'Ana López',
};

function setupStores(overrides: {
  auth?: Record<string, unknown>;
  profile?: Record<string, unknown>;
} = {}) {
  mockedUseAuthStore.mockReturnValue({
    user: MOCK_USER,
    hydrated: true,
    ...overrides.auth,
  });
  mockedUseProfileStore.mockReturnValue({
    profile: MOCK_PROFILE,
    todayMood: { mood: 'happy' },
    ...overrides.profile,
  });
}

describe('TrainerMessageModal', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    sessionStorage.clear();
    (Cookies.get as jest.Mock).mockReturnValue('fake-token');
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('renders nothing when hydrated is false', () => {
    setupStores({ auth: { hydrated: false, user: null } });
    const { container } = render(<TrainerMessageModal />);
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when user is null', () => {
    setupStores({ auth: { hydrated: true, user: null } });
    const { container } = render(<TrainerMessageModal />);
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when profile is not fully complete', () => {
    setupStores({ auth: {}, profile: { profile: null, todayMood: null } });
    const { container } = render(<TrainerMessageModal />);
    expect(container.firstChild).toBeNull();
  });

  it('does not fetch when session key is already set', async () => {
    sessionStorage.setItem('kore_trainer_msg_shown', '1');
    setupStores();
    render(<TrainerMessageModal />);

    await act(async () => { jest.advanceTimersByTime(2000); });

    expect(mockedApi.get).not.toHaveBeenCalled();
  });

  it('does not fetch when no auth token is available', async () => {
    (Cookies.get as jest.Mock).mockReturnValue(undefined);
    setupStores();
    render(<TrainerMessageModal />);

    await act(async () => { jest.advanceTimersByTime(2000); });

    expect(mockedApi.get).not.toHaveBeenCalled();
  });

  it('calls GET /my-trainer-messages/ after 1500ms when all conditions are met', async () => {
    setupStores();
    (mockedApi.get as jest.Mock).mockResolvedValueOnce({ data: { messages: [] } });

    render(<TrainerMessageModal />);

    await act(async () => { jest.advanceTimersByTime(1600); });

    expect(mockedApi.get).toHaveBeenCalledWith(
      '/my-trainer-messages/',
      { headers: { Authorization: 'Bearer fake-token' } },
    );
  });

  it('shows the modal with messages when the API returns non-empty messages', async () => {
    setupStores();
    (mockedApi.get as jest.Mock).mockResolvedValueOnce({
      data: { messages: [MOCK_MESSAGE] },
    });

    render(<TrainerMessageModal />);

    await act(async () => { jest.advanceTimersByTime(1600); });

    await waitFor(() => {
      expect(screen.getByText('¡Excelente progreso esta semana!')).toBeInTheDocument();
    });
    expect(screen.getByText('Ana López')).toBeInTheDocument();
    expect(screen.getByText('1 mensaje nuevo')).toBeInTheDocument();
  });

  it('does not show modal when response returns empty messages array', async () => {
    setupStores();
    (mockedApi.get as jest.Mock).mockResolvedValueOnce({ data: { messages: [] } });

    const { container } = render(<TrainerMessageModal />);

    await act(async () => { jest.advanceTimersByTime(1600); });

    await waitFor(() => {
      expect(container.firstChild).toBeNull();
    });
    expect(sessionStorage.getItem('kore_trainer_msg_shown')).toBe('1');
  });

  it('dismiss button calls POST /my-trainer-messages/{id}/dismiss/', async () => {
    setupStores();
    (mockedApi.get as jest.Mock).mockResolvedValueOnce({ data: { messages: [MOCK_MESSAGE] } });
    (mockedApi.post as jest.Mock).mockResolvedValueOnce({});

    render(<TrainerMessageModal />);
    await act(async () => { jest.advanceTimersByTime(1600); });
    await waitFor(() => screen.getByText('¡Excelente progreso esta semana!'));

    fireEvent.click(screen.getByRole('button', { name: 'Marcar como leído' }));

    await waitFor(() => {
      expect(mockedApi.post).toHaveBeenCalledWith(
        '/my-trainer-messages/99/dismiss/',
        undefined,
        expect.anything(),
      );
    });
  });

  it('dismissing the last message hides the modal', async () => {
    setupStores();
    (mockedApi.get as jest.Mock).mockResolvedValueOnce({ data: { messages: [MOCK_MESSAGE] } });
    (mockedApi.post as jest.Mock).mockResolvedValueOnce({});

    const { container } = render(<TrainerMessageModal />);
    await act(async () => { jest.advanceTimersByTime(1600); });
    await waitFor(() => screen.getByText('¡Excelente progreso esta semana!'));

    fireEvent.click(screen.getByRole('button', { name: 'Marcar como leído' }));

    await waitFor(() => {
      expect(container.firstChild).toBeNull();
    });
    expect(sessionStorage.getItem('kore_trainer_msg_shown')).toBe('1');
  });

  it('"Entendido" button closes the modal and sets the session key', async () => {
    setupStores();
    (mockedApi.get as jest.Mock).mockResolvedValueOnce({ data: { messages: [MOCK_MESSAGE] } });

    const { container } = render(<TrainerMessageModal />);
    await act(async () => { jest.advanceTimersByTime(1600); });
    await waitFor(() => screen.getByText('¡Excelente progreso esta semana!'));

    fireEvent.click(screen.getByRole('button', { name: 'Entendido' }));

    expect(container.firstChild).toBeNull();
    expect(sessionStorage.getItem('kore_trainer_msg_shown')).toBe('1');
  });
});
