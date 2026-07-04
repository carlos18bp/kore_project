import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import CameraCapture from '@/app/components/nutrition-daily/CameraCapture';

function setMediaDevices(getUserMedia: unknown) {
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: getUserMedia === undefined ? undefined : { getUserMedia },
  });
}

function fakeStream() {
  return { getTracks: () => [{ stop: jest.fn() }] } as unknown as MediaStream;
}

async function renderReadyCapture(onCapture = jest.fn().mockResolvedValue(undefined), onClose = jest.fn()) {
  const utils = render(
    <CameraCapture
      facingMode="environment"
      title="Escaneá tu comida"
      hint="Encuadrá el plato"
      onCapture={onCapture}
      onClose={onClose}
    />,
  );
  await waitFor(() => expect(screen.getByRole('button', { name: 'Capturar' })).toBeEnabled());
  return { ...utils, onCapture, onClose };
}

describe('CameraCapture', () => {
  beforeEach(() => {
    Object.assign(URL, {
      createObjectURL: jest.fn(() => 'blob:preview'),
      revokeObjectURL: jest.fn(),
    });
    jest.spyOn(window.HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
    jest.spyOn(window.HTMLVideoElement.prototype, 'videoWidth', 'get').mockReturnValue(640);
    jest.spyOn(window.HTMLVideoElement.prototype, 'videoHeight', 'get').mockReturnValue(480);
    jest
      .spyOn(window.HTMLCanvasElement.prototype, 'getContext')
      .mockReturnValue({ translate: jest.fn(), scale: jest.fn(), drawImage: jest.fn() } as unknown as CanvasRenderingContext2D);
    jest
      .spyOn(window.HTMLCanvasElement.prototype, 'toBlob')
      .mockImplementation((cb) => (cb as BlobCallback)(new Blob(['img'], { type: 'image/jpeg' })));
  });

  afterEach(() => {
    jest.restoreAllMocks();
    setMediaDevices(undefined);
  });

  it('labels the modal dialog with the given title', () => {
    setMediaDevices(jest.fn().mockResolvedValue(fakeStream()));
    render(<CameraCapture facingMode="environment" title="Escaneá tu comida" onCapture={jest.fn()} onClose={jest.fn()} />);

    expect(screen.getByRole('dialog', { name: 'Escaneá tu comida' })).toBeInTheDocument();
  });

  it('renders the framing hint', () => {
    setMediaDevices(jest.fn().mockResolvedValue(fakeStream()));
    render(
      <CameraCapture facingMode="environment" title="Comida" hint="Encuadrá el plato" onCapture={jest.fn()} onClose={jest.fn()} />,
    );

    expect(screen.getByText('Encuadrá el plato')).toBeInTheDocument();
  });

  it('shows an error when the device exposes no camera api', async () => {
    setMediaDevices(undefined);
    render(<CameraCapture facingMode="environment" title="Comida" onCapture={jest.fn()} onClose={jest.fn()} />);

    expect(await screen.findByText('Este dispositivo no expone una cámara accesible.')).toBeInTheDocument();
  });

  it('shows a permission error when access is denied', async () => {
    setMediaDevices(jest.fn().mockRejectedValue(new DOMException('denied', 'NotAllowedError')));
    render(<CameraCapture facingMode="environment" title="Comida" onCapture={jest.fn()} onClose={jest.fn()} />);

    expect(
      await screen.findByText('Permiso de cámara denegado. Activalo en los ajustes del navegador.'),
    ).toBeInTheDocument();
  });

  it('shows a not-found error when no camera is detected', async () => {
    setMediaDevices(jest.fn().mockRejectedValue(new DOMException('none', 'NotFoundError')));
    render(<CameraCapture facingMode="environment" title="Comida" onCapture={jest.fn()} onClose={jest.fn()} />);

    expect(await screen.findByText('No se detectó una cámara en este dispositivo.')).toBeInTheDocument();
  });

  it('calls onClose when the header close button is clicked', () => {
    setMediaDevices(jest.fn().mockResolvedValue(fakeStream()));
    const onClose = jest.fn();
    render(<CameraCapture facingMode="environment" title="Comida" onCapture={jest.fn()} onClose={onClose} />);

    fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('shows the captured preview after snapping a frame', async () => {
    setMediaDevices(jest.fn().mockResolvedValue(fakeStream()));
    await renderReadyCapture();

    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Capturar' }));
    });

    expect(await screen.findByRole('button', { name: /Usar foto/ })).toBeInTheDocument();
  });

  it('passes the captured file to onCapture when the photo is accepted', async () => {
    setMediaDevices(jest.fn().mockResolvedValue(fakeStream()));
    const { onCapture } = await renderReadyCapture();

    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Capturar' }));
    });
    fireEvent.click(await screen.findByRole('button', { name: /Usar foto/ }));

    await waitFor(() => expect(onCapture).toHaveBeenCalledWith(expect.any(File)));
  });

  it('returns to the capture control after retaking the photo', async () => {
    setMediaDevices(jest.fn().mockResolvedValue(fakeStream()));
    await renderReadyCapture();

    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Capturar' }));
    });
    fireEvent.click(await screen.findByRole('button', { name: /Repetir/ }));

    expect(screen.getByRole('button', { name: 'Capturar' })).toBeInTheDocument();
  });
});
