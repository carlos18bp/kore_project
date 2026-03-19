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
    setupStores({ profile: { todayMood: { score: 8 } } });
    const { container } = render(<MoodCheckIn />);

    await waitFor(() => {
      expect(container.firstChild).toBeNull();
    });
  });

  it('renders nothing when profile is not completed', async () => {
    setupStores({ auth: { user: { id: '1', profile_completed: false } } });
    const { container } = render(<MoodCheckIn />);

    await waitFor(() => {
      expect(container.firstChild).toBeNull();
    });
  });

  it('renders nothing when mood was dismissed this session', async () => {
    sessionStorage.setItem('kore_mood_dismissed', '1');
    setupStores();
    const { container } = render(<MoodCheckIn />);

    await waitFor(() => {
      expect(container.firstChild).toBeNull();
    });
  });

  it('renders mood check-in modal when eligible', async () => {
    setupStores();
    render(<MoodCheckIn />);

    await waitFor(() => {
      expect(screen.getByText('¿Cómo te sientes hoy?')).toBeInTheDocument();
    });
  });

  it('displays default score label of 7 (Bien)', async () => {
    setupStores();
    render(<MoodCheckIn />);

    await waitFor(() => {
      expect(screen.getByText('Bien')).toBeInTheDocument();
    });
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

    const backdrop = document.querySelector('.bg-black\\/40');
    if (backdrop) fireEvent.click(backdrop);

    expect(screen.queryByText('¿Cómo te sientes hoy?')).not.toBeInTheDocument();
  });

  it('submits mood and shows confirmation', async () => {
    jest.useFakeTimers();
    const { mockSubmitMood } = setupStores();
    render(<MoodCheckIn />);

    await waitFor(() => {
      expect(screen.getByText('¿Cómo te sientes hoy?')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: '9' }));

    const notesInput = screen.getByPlaceholderText('Notas adicionales (opcional)');
    fireEvent.change(notesInput, { target: { value: 'Feeling great' } });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Registrar/i }));
    });

    expect(mockSubmitMood).toHaveBeenCalledWith(9, 'Feeling great');

    await waitFor(() => {
      expect(screen.getByText('Excelente')).toBeInTheDocument();
      expect(screen.getByText('Registrado. ¡Gracias!')).toBeInTheDocument();
    });

    act(() => { jest.advanceTimersByTime(2000); });

    expect(screen.queryByText('Registrado. ¡Gracias!')).not.toBeInTheDocument();
    jest.useRealTimers();
  });

  it('submits mood without notes when notes field is empty', async () => {
    const { mockSubmitMood } = setupStores();
    render(<MoodCheckIn />);

    await waitFor(() => {
      expect(screen.getByText('¿Cómo te sientes hoy?')).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Registrar/i }));
    });

    expect(mockSubmitMood).toHaveBeenCalledWith(7, undefined);
  });

  it('disables submit button while submitting', async () => {
    let resolveSubmit: () => void;
    const submitPromise = new Promise<void>((resolve) => { resolveSubmit = resolve; });
    setupStores({ profile: { submitMood: jest.fn().mockReturnValue(submitPromise) } });

    render(<MoodCheckIn />);

    await waitFor(() => {
      expect(screen.getByText('¿Cómo te sientes hoy?')).toBeInTheDocument();
    });

    const submitBtn = screen.getByRole('button', { name: /Registrar/i });
    await act(async () => { fireEvent.click(submitBtn); });

    expect(screen.getByText('Guardando...')).toBeInTheDocument();
    expect(submitBtn).toBeDisabled();

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
