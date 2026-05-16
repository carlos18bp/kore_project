import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MessageComposerCard from '@/app/components/trainer/MessageComposerCard';

describe('MessageComposerCard', () => {
  afterEach(() => jest.clearAllMocks());

  it('renders 3 trigger-type option buttons', () => {
    render(<MessageComposerCard onSubmit={jest.fn()} />);

    expect(screen.getByRole('button', { name: /Manual/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Post sesión/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Post hito/i })).toBeInTheDocument();
  });

  it('has "Manual" as the default active trigger type', () => {
    render(<MessageComposerCard onSubmit={jest.fn()} />);

    const manualBtn = screen.getByRole('button', { name: /Manual/i });
    // Active button has dark background class
    expect(manualBtn.className).toContain('bg-kore-gray-dark');
  });

  it('changes the active trigger type when a different pill is clicked', async () => {
    render(<MessageComposerCard onSubmit={jest.fn()} />);

    await userEvent.click(screen.getByRole('button', { name: /Post sesión/i }));

    const postSesionBtn = screen.getByRole('button', { name: /Post sesión/i });
    expect(postSesionBtn.className).toContain('bg-kore-gray-dark');
  });

  it('updates textarea value when user types', async () => {
    render(<MessageComposerCard onSubmit={jest.fn()} />);

    const textarea = screen.getByPlaceholderText('Escribe un mensaje para este cliente...');
    await userEvent.type(textarea, 'Hola cliente');

    expect(textarea).toHaveValue('Hola cliente');
  });

  it('disables the submit button when textarea is empty', () => {
    render(<MessageComposerCard onSubmit={jest.fn()} />);

    const submitBtn = screen.getByRole('button', { name: 'Enviar mensaje' });
    expect(submitBtn).toBeDisabled();
  });

  it('disables the submit button when textarea contains only whitespace', async () => {
    render(<MessageComposerCard onSubmit={jest.fn()} />);

    const textarea = screen.getByPlaceholderText('Escribe un mensaje para este cliente...');
    await userEvent.type(textarea, '   ');

    const submitBtn = screen.getByRole('button', { name: 'Enviar mensaje' });
    expect(submitBtn).toBeDisabled();
  });

  it('disables the submit button while the submission is in flight', async () => {
    const neverResolves = jest.fn(() => new Promise<void>(() => {}));
    render(<MessageComposerCard onSubmit={neverResolves} />);

    const textarea = screen.getByPlaceholderText('Escribe un mensaje para este cliente...');
    await userEvent.type(textarea, 'Mensaje de prueba');

    await act(async () => {
      await userEvent.click(screen.getByRole('button', { name: 'Enviar mensaje' }));
    });

    expect(screen.getByRole('button', { name: 'Enviando…' })).toBeDisabled();
  });

  it('calls onSubmit with trimmed message text and the selected trigger type', async () => {
    const onSubmit = jest.fn().mockResolvedValue(undefined);
    render(<MessageComposerCard onSubmit={onSubmit} />);

    const textarea = screen.getByPlaceholderText('Escribe un mensaje para este cliente...');
    await userEvent.type(textarea, '  Hola  ');

    await act(async () => {
      await userEvent.click(screen.getByRole('button', { name: 'Enviar mensaje' }));
    });

    expect(onSubmit).toHaveBeenCalledWith('Hola', 'manual');
  });

  it('resets the textarea to empty after successful submit', async () => {
    const onSubmit = jest.fn().mockResolvedValue(undefined);
    render(<MessageComposerCard onSubmit={onSubmit} />);

    const textarea = screen.getByPlaceholderText('Escribe un mensaje para este cliente...');
    await userEvent.type(textarea, 'Un mensaje');

    await act(async () => {
      await userEvent.click(screen.getByRole('button', { name: 'Enviar mensaje' }));
    });

    expect(textarea).toHaveValue('');
  });

  it('resets the trigger type to "manual" after successful submit', async () => {
    const onSubmit = jest.fn().mockResolvedValue(undefined);
    render(<MessageComposerCard onSubmit={onSubmit} />);

    await userEvent.click(screen.getByRole('button', { name: /Post hito/i }));

    const textarea = screen.getByPlaceholderText('Escribe un mensaje para este cliente...');
    await userEvent.type(textarea, 'Mensaje');

    await act(async () => {
      await userEvent.click(screen.getByRole('button', { name: 'Enviar mensaje' }));
    });

    const manualBtn = screen.getByRole('button', { name: /Manual/i });
    expect(manualBtn.className).toContain('bg-kore-gray-dark');
  });
});
