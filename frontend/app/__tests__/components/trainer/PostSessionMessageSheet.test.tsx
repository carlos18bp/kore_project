import { render, screen, act, fireEvent } from '@testing-library/react';
import PostSessionMessageSheet from '@/app/components/trainer/PostSessionMessageSheet';
import { useTrainerStore } from '@/lib/stores/trainerStore';

jest.mock('@/lib/stores/trainerStore', () => ({ useTrainerStore: jest.fn() }));

const mStore = useTrainerStore as unknown as jest.Mock;
const PLACEHOLDER = 'Escribe tu mensaje...';
const SUGGESTION = '¡Buen trabajo en la sesión de hoy!';

function setup(sendTrainerMessage = jest.fn().mockResolvedValue(undefined)) {
  mStore.mockReturnValue({ sendTrainerMessage });
  return { sendTrainerMessage };
}

function renderSheet(onClose = jest.fn()) {
  render(
    <PostSessionMessageSheet customerId={7} customerName="Ana Ruiz" sessionId={99} onClose={onClose} />,
  );
  return { onClose };
}

describe('PostSessionMessageSheet', () => {
  beforeEach(() => jest.clearAllMocks());

  it('renders the customer name', () => {
    setup();
    renderSheet();
    expect(screen.getByText('Ana Ruiz')).toBeInTheDocument();
  });

  it('fills the textarea when a quick suggestion is clicked', () => {
    setup();
    renderSheet();
    fireEvent.click(screen.getByRole('button', { name: SUGGESTION }));
    expect(screen.getByPlaceholderText(PLACEHOLDER)).toHaveValue(SUGGESTION);
  });

  it('disables the send button when the message is empty', () => {
    setup();
    renderSheet();
    expect(screen.getByRole('button', { name: 'Enviar' })).toBeDisabled();
  });

  it('sends the message with the post_session trigger and the session id', async () => {
    const { sendTrainerMessage } = setup();
    renderSheet();
    fireEvent.change(screen.getByPlaceholderText(PLACEHOLDER), { target: { value: 'Excelente' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Enviar' }));
    });
    expect(sendTrainerMessage).toHaveBeenCalledWith(7, 'Excelente', 'post_session', 99);
  });

  it('closes the sheet after a successful send', async () => {
    setup();
    const { onClose } = renderSheet();
    fireEvent.change(screen.getByPlaceholderText(PLACEHOLDER), { target: { value: 'Excelente' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Enviar' }));
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes the sheet when the cancel button is clicked', () => {
    setup();
    const { onClose } = renderSheet();
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes the sheet when the backdrop is clicked', () => {
    setup();
    const { onClose } = renderSheet();
    fireEvent.click(screen.getByTestId('sheet-backdrop'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
