import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import Cookies from 'js-cookie';
import TrainerMessageBanner from '@/app/components/dashboard/TrainerMessageBanner';
import { api } from '@/lib/services/http';

jest.mock('js-cookie', () => ({
  get: jest.fn(),
  set: jest.fn(),
  remove: jest.fn(),
}));

jest.mock('@/lib/services/http', () => ({
  api: {
    get: jest.fn(),
    post: jest.fn(),
  },
}));

const mockedCookies = Cookies as jest.Mocked<typeof Cookies>;
const mockedApi = api as jest.Mocked<typeof api>;

function makeMsg(id: number, trigger_type: 'manual' | 'post_session' | 'post_milestone', message = 'Hola!') {
  return {
    id,
    trigger_type,
    message,
    created_at: '2026-05-01T10:00:00Z',
    trainer_name: 'Carlos Pérez',
    seen_by_customer: false,
  };
}

describe('TrainerMessageBanner', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (mockedCookies.get as jest.Mock).mockReturnValue('fake-token');
  });

  it('renders nothing when API returns an empty messages array', async () => {
    mockedApi.get.mockResolvedValueOnce({ data: { messages: [] } });

    const { container } = render(<TrainerMessageBanner />);
    await waitFor(() => expect(mockedApi.get).toHaveBeenCalled());

    expect(container.firstChild).toBeNull();
  });

  it('does not call API when no auth token cookie is set', async () => {
    (mockedCookies.get as jest.Mock).mockReturnValue(undefined);

    render(<TrainerMessageBanner />);
    await act(async () => {});

    expect(mockedApi.get).not.toHaveBeenCalled();
  });

  it('renders message text and trainer name on successful fetch', async () => {
    mockedApi.get.mockResolvedValueOnce({ data: { messages: [makeMsg(1, 'manual')] } });

    render(<TrainerMessageBanner />);

    expect(await screen.findByText('Hola!')).toBeInTheDocument();
    expect(await screen.findByText(/Carlos Pérez/)).toBeInTheDocument();
  });

  it('renders the manual trigger label', async () => {
    mockedApi.get.mockResolvedValueOnce({ data: { messages: [makeMsg(1, 'manual')] } });

    render(<TrainerMessageBanner />);

    expect(await screen.findByText('Mensaje de tu entrenador')).toBeInTheDocument();
  });

  it('renders the post_session trigger label', async () => {
    mockedApi.get.mockResolvedValueOnce({ data: { messages: [makeMsg(1, 'post_session')] } });

    render(<TrainerMessageBanner />);

    expect(await screen.findByText('Después de tu sesión')).toBeInTheDocument();
  });

  it('renders the post_milestone trigger label', async () => {
    mockedApi.get.mockResolvedValueOnce({ data: { messages: [makeMsg(1, 'post_milestone')] } });

    render(<TrainerMessageBanner />);

    expect(await screen.findByText('🏆 Tu entrenador te felicita')).toBeInTheDocument();
  });

  it('shows at most 2 messages when API returns 3', async () => {
    mockedApi.get.mockResolvedValueOnce({
      data: {
        messages: [makeMsg(1, 'manual', 'Msg A'), makeMsg(2, 'manual', 'Msg B'), makeMsg(3, 'manual', 'Msg C')],
      },
    });

    render(<TrainerMessageBanner />);
    await screen.findByText('Msg A');

    expect(screen.getByText('Msg A')).toBeInTheDocument();
    expect(screen.getByText('Msg B')).toBeInTheDocument();
    expect(screen.queryByText('Msg C')).not.toBeInTheDocument();
  });

  it('filters out messages where the message field is falsy', async () => {
    mockedApi.get.mockResolvedValueOnce({
      data: { messages: [{ ...makeMsg(1, 'manual'), message: '' }, makeMsg(2, 'manual', 'Visible')] },
    });

    render(<TrainerMessageBanner />);

    expect(await screen.findByText('Visible')).toBeInTheDocument();
    // Only 1 dismiss button because the empty-message entry was filtered
    const buttons = screen.getAllByRole('button', { name: 'Marcar como leído' });
    expect(buttons).toHaveLength(1);
  });

  it('dismiss button renders with text Marcar como leído', async () => {
    mockedApi.get.mockResolvedValueOnce({ data: { messages: [makeMsg(1, 'manual')] } });

    render(<TrainerMessageBanner />);

    expect(await screen.findByRole('button', { name: 'Marcar como leído' })).toBeInTheDocument();
  });

  it('clicking dismiss calls POST to the correct dismiss endpoint', async () => {
    mockedApi.get.mockResolvedValueOnce({ data: { messages: [makeMsg(1, 'manual')] } });
    mockedApi.post.mockResolvedValueOnce({});

    render(<TrainerMessageBanner />);
    const btn = await screen.findByRole('button', { name: 'Marcar como leído' });
    await act(async () => { fireEvent.click(btn); });

    expect(mockedApi.post).toHaveBeenCalledWith(
      '/my-trainer-messages/1/dismiss/',
      undefined,
      expect.any(Object),
    );
  });

  it('dismissed message is removed from the DOM on successful dismiss', async () => {
    mockedApi.get.mockResolvedValueOnce({ data: { messages: [makeMsg(1, 'manual')] } });
    mockedApi.post.mockResolvedValueOnce({});

    render(<TrainerMessageBanner />);
    const btn = await screen.findByRole('button', { name: 'Marcar como leído' });
    await act(async () => { fireEvent.click(btn); });

    await waitFor(() => expect(screen.queryByText('Hola!')).not.toBeInTheDocument());
  });

  it('message remains visible when dismiss API call fails', async () => {
    mockedApi.get.mockResolvedValueOnce({ data: { messages: [makeMsg(1, 'manual')] } });
    mockedApi.post.mockRejectedValueOnce(new Error('fail'));

    render(<TrainerMessageBanner />);
    const btn = await screen.findByRole('button', { name: 'Marcar como leído' });
    await act(async () => { fireEvent.click(btn); });

    expect(await screen.findByText('Hola!')).toBeInTheDocument();
  });
});
