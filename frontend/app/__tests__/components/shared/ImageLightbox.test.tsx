import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ImageLightbox from '@/app/components/shared/ImageLightbox';

jest.mock('next/image', () => ({
  __esModule: true,
  default: ({ src, alt }: { src: string; alt: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} />
  ),
}));

describe('ImageLightbox', () => {
  const defaultProps = {
    src: '/photos/posture-front.jpg',
    alt: 'Posture front view',
    isOpen: true,
    onClose: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    document.body.style.overflow = '';
  });

  afterEach(() => {
    document.body.style.overflow = '';
  });

  it('renders nothing when isOpen is false', () => {
    const { container } = render(<ImageLightbox {...defaultProps} isOpen={false} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders the image with correct src when isOpen is true', () => {
    render(<ImageLightbox {...defaultProps} />);
    expect(screen.getByAltText('Posture front view')).toHaveAttribute('src', '/photos/posture-front.jpg');
  });

  it('renders the close button with aria-label Cerrar', () => {
    render(<ImageLightbox {...defaultProps} />);
    expect(screen.getByRole('button', { name: 'Cerrar' })).toBeInTheDocument();
  });

  it('renders instruction text when open', () => {
    render(<ImageLightbox {...defaultProps} />);
    expect(screen.getByText(/Click fuera de la imagen/i)).toBeInTheDocument();
  });

  it('calls onClose when close button is clicked', async () => {
    const onClose = jest.fn();
    const user = userEvent.setup();
    render(<ImageLightbox {...defaultProps} onClose={onClose} />);
    await user.click(screen.getByRole('button', { name: 'Cerrar' }));
    expect(onClose).toHaveBeenCalled();
  });

  it('calls onClose when the backdrop is clicked', () => {
    const onClose = jest.fn();
    const { container } = render(<ImageLightbox {...defaultProps} onClose={onClose} />);
    fireEvent.click(container.firstChild as HTMLElement);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when Escape key is pressed while open', () => {
    const onClose = jest.fn();
    render(<ImageLightbox {...defaultProps} onClose={onClose} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not call onClose when a non-Escape key is pressed', () => {
    const onClose = jest.fn();
    render(<ImageLightbox {...defaultProps} onClose={onClose} />);
    fireEvent.keyDown(document, { key: 'Enter' });
    expect(onClose).not.toHaveBeenCalled();
  });

  it('does not attach keydown listener when isOpen is false', () => {
    const onClose = jest.fn();
    render(<ImageLightbox {...defaultProps} isOpen={false} onClose={onClose} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).not.toHaveBeenCalled();
  });

  it('does not call onClose when the image container is clicked', () => {
    const onClose = jest.fn();
    render(<ImageLightbox {...defaultProps} onClose={onClose} />);
    const img = screen.getByAltText('Posture front view');
    fireEvent.click(img);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('sets document.body overflow to hidden when isOpen is true', () => {
    render(<ImageLightbox {...defaultProps} />);
    expect(document.body.style.overflow).toBe('hidden');
  });

  it('resets document.body overflow to unset on unmount', () => {
    const { unmount } = render(<ImageLightbox {...defaultProps} />);
    unmount();
    expect(document.body.style.overflow).toBe('unset');
  });

  it('removes the keydown listener after unmount', () => {
    const onClose = jest.fn();
    const { unmount } = render(<ImageLightbox {...defaultProps} onClose={onClose} />);
    unmount();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).not.toHaveBeenCalled();
  });
});
