import { render, screen, waitFor } from '@testing-library/react';
import FAQPage from '@/app/(public)/faq/page';
import { api } from '@/lib/services/http';

jest.mock('@/lib/services/http', () => ({
  api: { get: jest.fn(), post: jest.fn() },
}));

jest.mock('@/app/components/faq/FAQAccordion', () => ({
  __esModule: true,
  default: ({ groups }: { groups: Array<{ category: { name: string } | null; items: Array<{ question: string }> }> }) => (
    <div data-testid="faq-accordion">
      {groups.map((g, i) => (
        <div key={i}>
          {g.category && <span>{g.category.name}</span>}
          {g.items.map((item, j) => (
            <span key={j}>{item.question}</span>
          ))}
        </div>
      ))}
    </div>
  ),
}));

const mockGet = api.get as jest.Mock;

const MOCK_GROUPS = [
  {
    category: { id: 1, name: 'General', slug: 'general', order: 1 },
    items: [
      { id: 1, question: '¿Qué es KÓRE?', answer: 'Un espacio de entrenamiento', category: 1, category_name: 'General' },
    ],
  },
  {
    category: { id: 2, name: 'Pagos', slug: 'pagos', order: 2 },
    items: [
      { id: 2, question: '¿Qué métodos de pago aceptan?', answer: 'Tarjeta, Nequi, PSE', category: 2, category_name: 'Pagos' },
    ],
  },
];

describe('FAQPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the hero section with heading', async () => {
    mockGet.mockResolvedValueOnce({ data: [] });
    render(<FAQPage />);
    expect(screen.getByText('¿Tienes dudas? Aquí te ayudamos')).toBeInTheDocument();
  });

  it('renders the FAQ label', async () => {
    mockGet.mockResolvedValueOnce({ data: [] });
    render(<FAQPage />);
    expect(screen.getByText('Preguntas Frecuentes')).toBeInTheDocument();
  });

  it('renders the description text', async () => {
    mockGet.mockResolvedValueOnce({ data: [] });
    render(<FAQPage />);
    expect(screen.getByText(/Encuentra respuestas a las preguntas más comunes/)).toBeInTheDocument();
  });

  it('shows loading spinner initially', () => {
    mockGet.mockReturnValue(new Promise(() => {}));
    render(<FAQPage />);
    expect(screen.getByRole('status', { name: /Cargando/i })).toBeInTheDocument();
  });

  it('renders FAQ accordion with loaded data', async () => {
    mockGet.mockResolvedValueOnce({ data: MOCK_GROUPS });
    render(<FAQPage />);

    await waitFor(() => {
      expect(screen.getByTestId('faq-accordion')).toBeInTheDocument();
    });
    expect(screen.getByText('General')).toBeInTheDocument();
    expect(screen.getByText('¿Qué es KÓRE?')).toBeInTheDocument();
    expect(screen.getByText('Pagos')).toBeInTheDocument();
    expect(screen.getByText('¿Qué métodos de pago aceptan?')).toBeInTheDocument();
  });

  it('displays error message when API fails', async () => {
    mockGet.mockRejectedValueOnce(new Error('Network error'));
    render(<FAQPage />);

    await waitFor(() => {
      expect(screen.getByText(/No pudimos cargar las preguntas frecuentes/)).toBeInTheDocument();
    });
  });

  it('renders retry button on error state', async () => {
    mockGet.mockRejectedValueOnce(new Error('Network error'));
    render(<FAQPage />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Reintentar/i })).toBeInTheDocument();
    });
  });

  it('fetches FAQs from public endpoint on mount', () => {
    mockGet.mockResolvedValueOnce({ data: [] });
    render(<FAQPage />);
    expect(mockGet).toHaveBeenCalledWith('/faqs/public/');
  });
});
