import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import MoodCheckIn from '@/app/components/profile/MoodCheckIn';
import { useAuthStore } from '@/lib/stores/authStore';
import { useProfileStore } from '@/lib/stores/profileStore';

jest.mock('next/image', () => ({
  __esModule: true,
  default: (props: React.ImgHTMLAttributes<HTMLImageElement>) => <img {...props} />,
}));

jest.mock('@/lib/stores/authStore', () => ({
  useAuthStore: jest.fn(),
}));

jest.mock('@/lib/stores/profileStore', () => ({
  useProfileStore: jest.fn(),
}));

jest.mock('@/lib/stores/creditValuesStore', () => ({
  useCreditValuesStore: () => ({ value: () => 5, fetchValues: jest.fn() }),
}));

const mockedUseAuthStore = useAuthStore as unknown as jest.Mock;
const mockedUseProfileStore = useProfileStore as unknown as jest.Mock;

function setupStores(overrides: {
  auth?: Record<string, unknown>;
  profile?: Record<string, unknown>;
} = {}) {
  const mockFetchProfile = jest.fn().mockResolvedValue(undefined);
  const mockSubmitMood = jest.fn().mockResolvedValue(undefined);

  mockedUseAuthStore.mockReturnValue({
    user: { id: '1', email: 'test@kore.com', profile_completed: true },
    hydrated: true,
    ...overrides.auth,
  });

  mockedUseProfileStore.mockReturnValue({
    profile: { customer_profile: { profile_completed: true } },
    todayMood: null,
    fetchProfile: mockFetchProfile,
    submitMood: mockSubmitMood,
    ...overrides.profile,
  });

  return { mockFetchProfile, mockSubmitMood };
}

describe('MoodCheckIn', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    sessionStorage.clear();
  });

  it('renders nothing when user is not hydrated', () => {
    setupStores({ auth: { hydrated: false, user: null } });
    const { container } = render(<MoodCheckIn />);
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when user is null', () => {
    setupStores({ auth: { user: null } });
    const { container } = render(<MoodCheckIn />);
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when todayMood already exists', async () => {
    const { mockFetchProfile } = setupStores({ profile: { todayMood: { score: 8 } } });
    const { container } = render(<MoodCheckIn />);

    await waitFor(() => expect(mockFetchProfile).toHaveBeenCalled());
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when profile is not completed', async () => {
    const { mockFetchProfile } = setupStores({ auth: { user: { id: '1', profile_completed: false } } });
    const { container } = render(<MoodCheckIn />);

    await waitFor(() => expect(mockFetchProfile).toHaveBeenCalled());
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when customer_profile is incomplete even if user.profile_completed is true', async () => {
    const { mockFetchProfile } = setupStores({
      profile: { profile: { customer_profile: { profile_completed: false } } },
    });
    const { container } = render(<MoodCheckIn />);

    await waitFor(() => expect(mockFetchProfile).toHaveBeenCalled());
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when mood was dismissed this session', async () => {
    sessionStorage.setItem('kore_mood_dismissed', '1');
    const { mockFetchProfile } = setupStores();
    const { container } = render(<MoodCheckIn />);

    await waitFor(() => expect(mockFetchProfile).toHaveBeenCalled());
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(container.firstChild).toBeNull();
  });

  it('renders mood check-in modal when eligible', async () => {
    setupStores();
    render(<MoodCheckIn />);

    await waitFor(() => {
      expect(screen.getByText('¿Cómo te sientes hoy?')).toBeInTheDocument();
    });
  });

  it('shows the credit chip and no score label before picking', async () => {
    setupStores();
    render(<MoodCheckIn />);

    await waitFor(() => {
      expect(screen.getByText('Check-in de hoy · +5 créditos')).toBeInTheDocument();
    });
    // No score selected yet → no label under the selector
    expect(screen.queryByText('Bien')).not.toBeInTheDocument();
  });

  it('updates score label when a score button is clicked', async () => {
    setupStores();
    render(<MoodCheckIn />);

    await waitFor(() => {
      expect(screen.getByText('¿Cómo te sientes hoy?')).toBeInTheDocument();
    });

    const scoreBtn = screen.getByRole('button', { name: '10' });
    fireEvent.click(scoreBtn);

    expect(screen.getByText('Increíble')).toBeInTheDocument();
  });

  it('selects low score and shows correct label', async () => {
    setupStores();
    render(<MoodCheckIn />);

    await waitFor(() => {
      expect(screen.getByText('¿Cómo te sientes hoy?')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: '2' }));
    expect(screen.getByText('Mal')).toBeInTheDocument();
  });

  it('dismisses modal when "Ahora no" is clicked', async () => {
    setupStores();
    render(<MoodCheckIn />);

    await waitFor(() => {
      expect(screen.getByText('¿Cómo te sientes hoy?')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Ahora no/i }));

    expect(screen.queryByText('¿Cómo te sientes hoy?')).not.toBeInTheDocument();
    expect(sessionStorage.getItem('kore_mood_dismissed')).toBe('1');
  });

  it('dismisses modal when backdrop is clicked', async () => {
    setupStores();
    render(<MoodCheckIn />);

    await waitFor(() => {
      expect(screen.getByText('¿Cómo te sientes hoy?')).toBeInTheDocument();
    });

    const backdrop = document.querySelector('.bg-white\\/40');
    if (backdrop) fireEvent.click(backdrop);

    expect(screen.queryByText('¿Cómo te sientes hoy?')).not.toBeInTheDocument();
  });

  async function walkToReadyStep(opts: { score?: string; energy?: RegExp; pain?: string } = {}) {
    const { score = '9', energy = /A tope/, pain = 'Sin dolor' } = opts;
    fireEvent.click(screen.getByRole('button', { name: score }));
    await screen.findByText('¿Cuánta energía tienes?');
    fireEvent.click(screen.getByRole('button', { name: energy }));
    await screen.findByText('¿Tienes algún dolor o molestia?');
    fireEvent.click(screen.getByRole('button', { name: pain }));
    await screen.findByText('¿Listo para entrenar hoy?');
  }

  it('submits the 4-step check-in and shows confirmation', async () => {
    const { mockSubmitMood } = setupStores();
    render(<MoodCheckIn />);

    await waitFor(() => {
      expect(screen.getByText('¿Cómo te sientes hoy?')).toBeInTheDocument();
    });

    await walkToReadyStep({ score: '9', energy: /A tope/, pain: 'Sin dolor' });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '¡Listo para entrenar!' }));
    });

    expect(mockSubmitMood).toHaveBeenCalledWith(9, undefined, {
      energy_level: 5, pain: false, ready_to_train: true,
    });

    await waitFor(() => {
      expect(screen.getByText('Excelente')).toBeInTheDocument();
      expect(screen.getByText('Registrado. ¡Gracias!')).toBeInTheDocument();
    });
  });

  it('pain path shows the trainer note field and submits it with Hoy no', async () => {
    const { mockSubmitMood } = setupStores();
    render(<MoodCheckIn />);

    await waitFor(() => {
      expect(screen.getByText('¿Cómo te sientes hoy?')).toBeInTheDocument();
    });

    await walkToReadyStep({ score: '4', energy: /Bajo/, pain: 'Tengo dolor' });
    const notesInput = screen.getByPlaceholderText('Cuéntale a tu entrenador dónde te duele (opcional)');
    fireEvent.change(notesInput, { target: { value: 'Rodilla derecha' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Hoy no' }));
    });

    expect(mockSubmitMood).toHaveBeenCalledWith(4, 'Rodilla derecha', {
      energy_level: 2, pain: true, ready_to_train: false,
    });
  });

  it('disables submit buttons while submitting', async () => {
    let resolveSubmit: () => void;
    const submitPromise = new Promise<void>((resolve) => { resolveSubmit = resolve; });
    setupStores({ profile: { submitMood: jest.fn().mockReturnValue(submitPromise) } });

    render(<MoodCheckIn />);

    await waitFor(() => {
      expect(screen.getByText('¿Cómo te sientes hoy?')).toBeInTheDocument();
    });

    await walkToReadyStep();
    const submitBtn = screen.getByRole('button', { name: '¡Listo para entrenar!' });
    await act(async () => { fireEvent.click(submitBtn); });

    expect(screen.getByText('Guardando...')).toBeInTheDocument();
    expect(submitBtn).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Hoy no' })).toBeDisabled();

    await act(async () => { resolveSubmit!(); });
  });

  it('calls fetchProfile on mount', async () => {
    const { mockFetchProfile } = setupStores();
    render(<MoodCheckIn />);

    await waitFor(() => {
      expect(mockFetchProfile).toHaveBeenCalled();
    });
  });

  it('renders all 10 score buttons', async () => {
    setupStores();
    render(<MoodCheckIn />);

    await waitFor(() => {
      expect(screen.getByText('¿Cómo te sientes hoy?')).toBeInTheDocument();
    });

    for (let i = 1; i <= 10; i++) {
      expect(screen.getByRole('button', { name: String(i) })).toBeInTheDocument();
    }
  });
});
