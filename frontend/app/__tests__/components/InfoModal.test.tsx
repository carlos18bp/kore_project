import { render, screen, fireEvent } from '@testing-library/react';
import InfoModal from '@/app/components/dashboard/InfoModal';

describe('InfoModal', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('renders the title as a heading', () => {
    render(
      <InfoModal title="Racha" onClose={jest.fn()}>
        <p>Explicación</p>
      </InfoModal>,
    );

    expect(screen.getByRole('heading', { name: 'Racha' })).toBeInTheDocument();
  });

  it('renders the provided children content', () => {
    render(
      <InfoModal title="Racha" onClose={jest.fn()}>
        <p>Días consecutivos entrenando</p>
      </InfoModal>,
    );

    expect(screen.getByText('Días consecutivos entrenando')).toBeInTheDocument();
  });

  it('calls onClose when the close button is clicked', () => {
    const onClose = jest.fn();
    render(
      <InfoModal title="Racha" onClose={onClose}>
        <p>contenido</p>
      </InfoModal>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when the Escape key is pressed', () => {
    const onClose = jest.fn();
    render(
      <InfoModal title="Racha" onClose={onClose}>
        <p>contenido</p>
      </InfoModal>,
    );

    fireEvent.keyDown(window, { key: 'Escape' });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not call onClose when a non-Escape key is pressed', () => {
    const onClose = jest.fn();
    render(
      <InfoModal title="Racha" onClose={onClose}>
        <p>contenido</p>
      </InfoModal>,
    );

    fireEvent.keyDown(window, { key: 'Enter' });

    expect(onClose).not.toHaveBeenCalled();
  });

  it('calls onClose when the backdrop is clicked', () => {
    const onClose = jest.fn();
    render(
      <InfoModal title="Racha" onClose={onClose}>
        <p>contenido</p>
      </InfoModal>,
    );

    const backdrop = screen.getByRole('dialog').parentElement as HTMLElement;
    fireEvent.click(backdrop);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not call onClose when the dialog panel itself is clicked', () => {
    const onClose = jest.fn();
    render(
      <InfoModal title="Racha" onClose={onClose}>
        <p>contenido</p>
      </InfoModal>,
    );

    fireEvent.click(screen.getByRole('dialog'));

    expect(onClose).not.toHaveBeenCalled();
  });
});
