import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import MealPhotoUpload from '@/app/components/nutrition-daily/MealPhotoUpload';
import { compressImage } from '@/lib/utils/compressImage';
import { useIsMobileDevice } from '@/lib/utils/isMobileDevice';

jest.mock('@/lib/utils/compressImage', () => ({
  compressImage: jest.fn(),
}));

jest.mock('@/lib/utils/isMobileDevice', () => ({
  useIsMobileDevice: jest.fn(),
}));

const mockedCompressImage = compressImage as jest.Mock;
const mockedUseIsMobileDevice = useIsMobileDevice as jest.Mock;

describe('MealPhotoUpload', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedUseIsMobileDevice.mockReturnValue(true);
  });

  it('shows the take-photo prompt on a mobile device without a photo', () => {
    render(<MealPhotoUpload photoUrl={null} onUpload={jest.fn()} />);

    expect(screen.getByRole('button', { name: 'Tomar foto' })).toBeInTheDocument();
  });

  it('shows the phone-only prompt on a non-mobile device', () => {
    mockedUseIsMobileDevice.mockReturnValue(false);
    render(<MealPhotoUpload photoUrl={null} onUpload={jest.fn()} />);

    expect(screen.getByRole('button', { name: 'Solo desde el teléfono' })).toBeInTheDocument();
  });

  it('disables the capture button on a non-mobile device', () => {
    mockedUseIsMobileDevice.mockReturnValue(false);
    render(<MealPhotoUpload photoUrl={null} onUpload={jest.fn()} />);

    expect(screen.getByRole('button', { name: 'Solo desde el teléfono' })).toBeDisabled();
  });

  it('renders the existing meal photo when a photo url is provided', () => {
    render(<MealPhotoUpload photoUrl="https://cdn.kore/meal.jpg" onUpload={jest.fn()} />);

    expect(screen.getByRole('img', { name: 'Foto de comida' })).toBeInTheDocument();
  });

  it('disables the capture button when the disabled prop is set', () => {
    render(<MealPhotoUpload photoUrl={null} onUpload={jest.fn()} disabled />);

    expect(screen.getByRole('button', { name: 'Tomar foto' })).toBeDisabled();
  });

  it('uploads the compressed file when a photo is selected', async () => {
    const compressed = new File(['small'], 'compressed.jpg', { type: 'image/jpeg' });
    mockedCompressImage.mockResolvedValue(compressed);
    const onUpload = jest.fn().mockResolvedValue(undefined);
    const { container } = render(<MealPhotoUpload photoUrl={null} onUpload={onUpload} />);
    // quality: allow-fragile-selector (hidden file input has no role/testid; matches repo convention)
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const picked = new File(['raw'], 'raw.jpg', { type: 'image/jpeg' });

    fireEvent.change(input, { target: { files: [picked] } });

    await waitFor(() => expect(onUpload).toHaveBeenCalledWith(compressed));
  });

  it('does not upload when the file selection is empty', () => {
    const onUpload = jest.fn().mockResolvedValue(undefined);
    const { container } = render(<MealPhotoUpload photoUrl={null} onUpload={onUpload} />);
    // quality: allow-fragile-selector (hidden file input has no role/testid; matches repo convention)
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;

    fireEvent.change(input, { target: { files: [] } });

    expect(onUpload).not.toHaveBeenCalled();
  });
});
