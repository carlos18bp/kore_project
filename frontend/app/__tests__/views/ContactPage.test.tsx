import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ContactPage from '@/app/(public)/contact/page';
import { api } from '@/lib/services/http';

jest.mock('@/lib/services/http', () => ({
  api: { get: jest.fn(), post: jest.fn() },
}));

const mockGet = api.get as jest.Mock;
const mockPost = api.post as jest.Mock;

describe('ContactPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGet.mockResolvedValue({ data: null });
  });

  it('renders the hero section with heading', () => {
    render(<ContactPage />);
    expect(screen.getByText('Estamos aquí para ayudarte')).toBeInTheDocument();
  });

  it('renders the contact label', () => {
    render(<ContactPage />);
    expect(screen.getByText('Contacto')).toBeInTheDocument();
  });

  it('renders the description text', () => {
    render(<ContactPage />);
    expect(screen.getByText(/Tienes preguntas sobre nuestros programas/)).toBeInTheDocument();
  });

  it('renders contact info section', () => {
    render(<ContactPage />);
    expect(screen.getByText('Información de contacto')).toBeInTheDocument();
    expect(screen.getByText('Ubicación')).toBeInTheDocument();
    expect(screen.getByText('Horario de atención')).toBeInTheDocument();
    expect(screen.getByText('Email')).toBeInTheDocument();
  });

  it('renders default business hours when settings not loaded', () => {
    render(<ContactPage />);
    expect(screen.getByText('Lunes a Viernes: 6:00 AM - 8:00 PM')).toBeInTheDocument();
  });

  it('renders the contact form with required fields', () => {
    render(<ContactPage />);
    expect(screen.getByLabelText(/Nombre/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Email/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Teléfono/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Mensaje/)).toBeInTheDocument();
  });

  it('renders submit button', () => {
    render(<ContactPage />);
    expect(screen.getByRole('button', { name: /Enviar mensaje/i })).toBeInTheDocument();
  });

  it('displays success message after successful submission', async () => {
    mockPost.mockResolvedValueOnce({ data: {} });
    const user = userEvent.setup();
    render(<ContactPage />);

    await user.type(screen.getByLabelText(/Nombre/), 'Juan');
    await user.type(screen.getByLabelText(/Email/), 'juan@test.com');
    await user.type(screen.getByLabelText(/Mensaje/), 'Hola');
    await user.click(screen.getByRole('button', { name: /Enviar mensaje/i }));

    await waitFor(() => {
      expect(screen.getByText('¡Mensaje enviado!')).toBeInTheDocument();
    });
    expect(mockPost).toHaveBeenCalledWith('/contact-messages/', expect.objectContaining({
      name: 'Juan',
      email: 'juan@test.com',
      message: 'Hola',
    }));
  });

  it('displays error message after failed submission', async () => {
    mockPost.mockRejectedValueOnce(new Error('Server error'));
    const user = userEvent.setup();
    render(<ContactPage />);

    await user.type(screen.getByLabelText(/Nombre/), 'Juan');
    await user.type(screen.getByLabelText(/Email/), 'juan@test.com');
    await user.type(screen.getByLabelText(/Mensaje/), 'Hola');
    await user.click(screen.getByRole('button', { name: /Enviar mensaje/i }));

    await waitFor(() => {
      expect(screen.getByText(/No pudimos enviar tu mensaje/)).toBeInTheDocument();
    });
  });

  it('renders "Enviar otro mensaje" button after success and returns to form', async () => {
    mockPost.mockResolvedValueOnce({ data: {} });
    const user = userEvent.setup();
    render(<ContactPage />);

    await user.type(screen.getByLabelText(/Nombre/), 'Juan');
    await user.type(screen.getByLabelText(/Email/), 'juan@test.com');
    await user.type(screen.getByLabelText(/Mensaje/), 'Hola');
    await user.click(screen.getByRole('button', { name: /Enviar mensaje/i }));

    await waitFor(() => {
      expect(screen.getByText('Enviar otro mensaje')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Enviar otro mensaje'));
    expect(screen.getByRole('button', { name: /Enviar mensaje/i })).toBeInTheDocument();
  });

  it('fetches site settings on mount', () => {
    render(<ContactPage />);
    expect(mockGet).toHaveBeenCalledWith('/site-settings/');
  });

  it('displays phone from site settings when available', async () => {
    mockGet.mockResolvedValueOnce({
      data: {
        id: 1,
        company_name: 'KÓRE',
        email: 'info@kore.com',
        phone: '+573001234567',
        whatsapp: '',
        address: 'Calle 100',
        city: 'Bogotá',
        business_hours: '6AM-9PM',
      },
    });
    render(<ContactPage />);

    await waitFor(() => {
      expect(screen.getByText('+573001234567')).toBeInTheDocument();
    });
  });
});
