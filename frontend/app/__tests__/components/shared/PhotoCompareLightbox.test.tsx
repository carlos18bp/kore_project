import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PhotoCompareLightbox, { type LightboxPhoto } from '@/app/components/shared/PhotoCompareLightbox';

describe('PhotoCompareLightbox', () => {
  const photos: LightboxPhoto[] = [
    { src: '/photos/initial.jpg', label: 'Inicial', sublabel: '11 de abr de 2026' },
    { src: '/photos/latest.jpg', label: 'Última', sublabel: '7 de jun de 2026' },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    document.body.style.overflow = '';
  });

  afterEach(() => {
    document.body.style.overflow = '';
  });

  it('renders both photos with their labels and sublabels', () => {
    render(<PhotoCompareLightbox photos={photos} title="Vista anterior" onClose={jest.fn()} />);
    expect(screen.getByAltText('Inicial')).toHaveAttribute('src', '/photos/initial.jpg');
    expect(screen.getByAltText('Última')).toHaveAttribute('src', '/photos/latest.jpg');
    expect(screen.getByText('Inicial')).toBeInTheDocument();
    expect(screen.getByText('7 de jun de 2026')).toBeInTheDocument();
  });

  it('renders the title and the zoom hint', () => {
    render(<PhotoCompareLightbox photos={photos} title="Vista anterior" onClose={jest.fn()} />);
    expect(screen.getByRole('heading', { name: 'Vista anterior' })).toBeInTheDocument();
    expect(screen.getByText(/Toca una foto para acercar/i)).toBeInTheDocument();
  });

  it('renders nothing when there are no photos', () => {
    const { container } = render(<PhotoCompareLightbox photos={[]} onClose={jest.fn()} />);
    expect(container.firstChild).toBeNull();
  });

  it('calls onClose when the close button is clicked', async () => {
    const onClose = jest.fn();
    const user = userEvent.setup();
    render(<PhotoCompareLightbox photos={photos} onClose={onClose} />);
    await user.click(screen.getByRole('button', { name: 'Cerrar' }));
    expect(onClose).toHaveBeenCalled();
  });

  it('calls onClose when the backdrop is clicked', () => {
    const onClose = jest.fn();
    render(<PhotoCompareLightbox photos={photos} onClose={onClose} />);
    fireEvent.click(screen.getByRole('dialog'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not close when a photo is clicked — it toggles zoom instead', () => {
    const onClose = jest.fn();
    render(<PhotoCompareLightbox photos={photos} onClose={onClose} />);
    const img = screen.getByAltText('Última');
    expect(img).toHaveStyle({ cursor: 'zoom-in' });
    fireEvent.click(img);
    expect(onClose).not.toHaveBeenCalled();
    expect(img).toHaveStyle({ cursor: 'zoom-out' });
    fireEvent.click(img);
    expect(img).toHaveStyle({ cursor: 'zoom-in' });
  });

  it('calls onClose when Escape is pressed', () => {
    const onClose = jest.fn();
    render(<PhotoCompareLightbox photos={photos} onClose={onClose} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('locks body scroll while open and restores it on unmount', () => {
    const { unmount } = render(<PhotoCompareLightbox photos={photos} onClose={jest.fn()} />);
    expect(document.body.style.overflow).toBe('hidden');
    unmount();
    expect(document.body.style.overflow).toBe('');
  });
});
