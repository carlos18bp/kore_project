import { render, screen, act, fireEvent } from '@testing-library/react';
import PostMilestoneMessageSheet from '@/app/components/trainer/PostMilestoneMessageSheet';
import { useTrainerStore } from '@/lib/stores/trainerStore';

jest.mock('@/lib/stores/trainerStore', () => ({ useTrainerStore: jest.fn() }));

const mStore = useTrainerStore as unknown as jest.Mock;
const PLACEHOLDER = 'Escribe tu mensaje...';
const SUGGESTION = '¡Lograste un hito importante! Sigue así.';

function setup(sendTrainerMessage = jest.fn().mockResolvedValue(undefined)) {
  mStore.mockReturnValue({ sendTrainerMessage });
  return { sendTrainerMessage };
}

function renderSheet(props: Partial<React.ComponentProps<typeof PostMilestoneMessageSheet>> = {}) {
  const onClose = props.onClose ?? jest.fn();
  render(
    <PostMilestoneMessageSheet
      customerId={props.customerId ?? 7}
      customerName={props.customerName ?? 'Ana Ruiz'}
      milestoneId={props.milestoneId}
      milestoneLabel={props.milestoneLabel}
      onClose={onClose}
    />,
  );
  return { onClose };
}

describe('PostMilestoneMessageSheet', () => {
  beforeEach(() => jest.clearAllMocks());

  it('renders the customer name', () => {
    setup();
    renderSheet();
    expect(screen.getByText('Ana Ruiz')).toBeInTheDocument();
  });

  it('renders the milestone label when provided', () => {
    setup();
    renderSheet({ milestoneLabel: '10 sesiones completadas' });
    expect(screen.getByText('10 sesiones completadas')).toBeInTheDocument();
  });

  it('omits the milestone label pill when no label is provided', () => {
    setup();
    renderSheet({ milestoneLabel: undefined });
    expect(screen.queryByText('10 sesiones completadas')).not.toBeInTheDocument();
  });

  it('fills the textarea when a quick suggestion is clicked', () => {
    setup();
    renderSheet();
    fireEvent.click(screen.getByRole('button', { name: SUGGESTION }));
    expect(screen.getByPlaceholderText(PLACEHOLDER)).toHaveValue(SUGGESTION);
  });

  it('sends the message with the post_milestone trigger and the milestone id', async () => {
    const { sendTrainerMessage } = setup();
    renderSheet({ milestoneId: 55 });
    fireEvent.change(screen.getByPlaceholderText(PLACEHOLDER), { target: { value: 'Felicidades' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Enviar' }));
    });
    expect(sendTrainerMessage).toHaveBeenCalledWith(7, 'Felicidades', 'post_milestone', 55);
  });

  it('closes the sheet after a successful send', async () => {
    setup();
    const { onClose } = renderSheet();
    fireEvent.change(screen.getByPlaceholderText(PLACEHOLDER), { target: { value: 'Felicidades' } });
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
});
