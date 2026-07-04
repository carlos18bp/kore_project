import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PhotoViewer from '@/app/components/shared/PhotoViewer';

afterEach(() => {
  jest.useRealTimers();
  jest.clearAllMocks();
  localStorage.clear();
  document.body.style.overflow = '';
});

describe('PhotoViewer', () => {
  const defaultProps = {
    url: '/photos/front.jpg',
    alt: 'Foto frontal',
    onClose: jest.fn(),
  };

  it('renders nothing when url is null', () => {
    const { container } = render(<PhotoViewer {...defaultProps} url={null} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders the image with the given src when url is provided', () => {
    render(<PhotoViewer {...defaultProps} />);
    expect(screen.getByAltText('Foto frontal')).toHaveAttribute('src', '/photos/front.jpg');
  });

  it('uses the default alt text when none is given', () => {
    render(<PhotoViewer url="/photos/front.jpg" onClose={jest.fn()} />);
    expect(screen.getByAltText('Foto')).toBeInTheDocument();
  });

  it('renders a modal dialog', () => {
    render(<PhotoViewer {...defaultProps} />);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('calls onClose when the close button is clicked', async () => {
    const onClose = jest.fn();
    const user = userEvent.setup();
    render(<PhotoViewer {...defaultProps} onClose={onClose} />);
    await user.click(screen.getByRole('button', { name: 'Cerrar' }));
    expect(onClose).toHaveBeenCalled();
  });

  it('calls onClose when the backdrop is clicked', () => {
    const onClose = jest.fn();
    render(<PhotoViewer {...defaultProps} onClose={onClose} />);
    fireEvent.click(screen.getByRole('dialog'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not call onClose when the image itself is clicked', () => {
    const onClose = jest.fn();
    render(<PhotoViewer {...defaultProps} onClose={onClose} />);
    fireEvent.click(screen.getByAltText('Foto frontal'));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('calls onClose when the Escape key is pressed', () => {
    const onClose = jest.fn();
    render(<PhotoViewer {...defaultProps} onClose={onClose} />);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not call onClose when a non-Escape key is pressed', () => {
    const onClose = jest.fn();
    render(<PhotoViewer {...defaultProps} onClose={onClose} />);
    fireEvent.keyDown(window, { key: 'Enter' });
    expect(onClose).not.toHaveBeenCalled();
  });

  it('sets document body overflow to hidden while open', () => {
    render(<PhotoViewer {...defaultProps} />);
    expect(document.body.style.overflow).toBe('hidden');
  });

  it('restores document body overflow on unmount', () => {
    document.body.style.overflow = 'scroll';
    const { unmount } = render(<PhotoViewer {...defaultProps} />);
    unmount();
    expect(document.body.style.overflow).toBe('scroll');
  });

  it('does not attach the Escape listener when url is null', () => {
    const onClose = jest.fn();
    render(<PhotoViewer {...defaultProps} url={null} onClose={onClose} />);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).not.toHaveBeenCalled();
  });
});
