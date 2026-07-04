import { render, screen, fireEvent } from '@testing-library/react';
import Modal from '@/app/components/admin/Modal';

function renderModal(overrides: Partial<React.ComponentProps<typeof Modal>> = {}) {
  const props = {
    title: 'Eliminar usuario',
    body: 'Esta accion es permanente',
    confirmLabel: 'Eliminar',
    onClose: jest.fn(),
    onConfirm: jest.fn(),
    ...overrides,
  };
  render(<Modal {...props} />);
  return props;
}

afterEach(() => {
  jest.clearAllMocks();
});

describe('Modal', () => {
  it('renders the title heading', () => {
    renderModal();
    expect(screen.getByRole('heading', { name: 'Eliminar usuario' })).toBeInTheDocument();
  });

  it('renders the body content', () => {
    renderModal();
    expect(screen.getByText('Esta accion es permanente')).toBeInTheDocument();
  });

  it('renders the confirm button with the confirmLabel', () => {
    renderModal();
    expect(screen.getByRole('button', { name: 'Eliminar' })).toBeInTheDocument();
  });

  it('renders the default cancel label when none is provided', () => {
    renderModal();
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeInTheDocument();
  });

  it('calls onConfirm when the confirm button is clicked', () => {
    const props = renderModal();
    fireEvent.click(screen.getByRole('button', { name: 'Eliminar' }));
    expect(props.onConfirm).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when the cancel button is clicked', () => {
    const props = renderModal();
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when the Escape key is pressed', () => {
    const props = renderModal();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when the overlay is clicked', () => {
    const props = renderModal();
    fireEvent.click(screen.getByRole('dialog'));
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });

  it('shows the processing label on the confirm button while loading', () => {
    renderModal({ loading: true });
    expect(screen.getByRole('button', { name: 'Procesando…' })).toBeInTheDocument();
  });

  it('disables the confirm button while loading', () => {
    renderModal({ loading: true });
    expect(screen.getByRole('button', { name: 'Procesando…' })).toBeDisabled();
  });
});
