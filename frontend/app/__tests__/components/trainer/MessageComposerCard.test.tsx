import { render, screen, act, fireEvent } from '@testing-library/react';
import MessageComposerCard from '@/app/components/trainer/MessageComposerCard';

const PLACEHOLDER = 'Escribe un mensaje para este cliente...';

describe('MessageComposerCard', () => {
  it('disables the send button when the message is empty', () => {
    render(<MessageComposerCard onSubmit={jest.fn().mockResolvedValue(undefined)} />);
    expect(screen.getByRole('button', { name: 'Enviar mensaje' })).toBeDisabled();
  });

  it('enables the send button once a non-empty message is typed', () => {
    render(<MessageComposerCard onSubmit={jest.fn().mockResolvedValue(undefined)} />);
    fireEvent.change(screen.getByPlaceholderText(PLACEHOLDER), { target: { value: 'Hola' } });
    expect(screen.getByRole('button', { name: 'Enviar mensaje' })).toBeEnabled();
  });

  it('submits the trimmed message with the default manual trigger type', async () => {
    const onSubmit = jest.fn().mockResolvedValue(undefined);
    render(<MessageComposerCard onSubmit={onSubmit} />);
    fireEvent.change(screen.getByPlaceholderText(PLACEHOLDER), { target: { value: '  Buen trabajo  ' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Enviar mensaje' }));
    });
    expect(onSubmit).toHaveBeenCalledWith('Buen trabajo', 'manual');
  });

  it('submits with the post_session trigger type when that chip is selected', async () => {
    const onSubmit = jest.fn().mockResolvedValue(undefined);
    render(<MessageComposerCard onSubmit={onSubmit} />);
    fireEvent.click(screen.getByRole('button', { name: 'Post sesión' }));
    fireEvent.change(screen.getByPlaceholderText(PLACEHOLDER), { target: { value: 'Listo' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Enviar mensaje' }));
    });
    expect(onSubmit).toHaveBeenCalledWith('Listo', 'post_session');
  });

  it('clears the textarea after a successful submission', async () => {
    const onSubmit = jest.fn().mockResolvedValue(undefined);
    render(<MessageComposerCard onSubmit={onSubmit} />);
    const textarea = screen.getByPlaceholderText(PLACEHOLDER);
    fireEvent.change(textarea, { target: { value: 'Mensaje' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Enviar mensaje' }));
    });
    expect(textarea).toHaveValue('');
  });

  it('does not call onSubmit when the message is only whitespace', async () => {
    const onSubmit = jest.fn().mockResolvedValue(undefined);
    render(<MessageComposerCard onSubmit={onSubmit} />);
    fireEvent.change(screen.getByPlaceholderText(PLACEHOLDER), { target: { value: '   ' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Enviar mensaje' }));
    });
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
