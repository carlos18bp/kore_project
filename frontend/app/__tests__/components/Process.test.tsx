import { render, screen } from '@testing-library/react';
import Process from '@/app/components/Process';

jest.mock('next/image', () => ({
  __esModule: true,
  default: (props: React.ImgHTMLAttributes<HTMLImageElement>) => <img {...props} />,
}));

describe('Process', () => {
  beforeEach(() => {
    render(<Process />);
  });

  it('renders the section header', () => {
    expect(screen.getByText('Cómo funciona')).toBeInTheDocument();
    expect(screen.getByText('El proceso KÓRE')).toBeInTheDocument();
  });

  it('renders all six steps with their numbers', () => {
    expect(screen.getByText('01')).toBeInTheDocument();
    expect(screen.getByText('02')).toBeInTheDocument();
    expect(screen.getByText('03')).toBeInTheDocument();
    expect(screen.getByText('04')).toBeInTheDocument();
    expect(screen.getByText('05')).toBeInTheDocument();
    expect(screen.getByText('06')).toBeInTheDocument();
  });

  it('renders step titles', () => {
    expect(screen.getByText('Primer contacto')).toBeInTheDocument();
    expect(screen.getByText('Diagnóstico inicial')).toBeInTheDocument();
    expect(screen.getByText('Evaluación completa')).toBeInTheDocument();
    expect(screen.getByText('Tu programa')).toBeInTheDocument();
    expect(screen.getByText('Sesiones guiadas')).toBeInTheDocument();
    expect(screen.getByText('Seguimiento continuo')).toBeInTheDocument();
  });

  it('renders step descriptions', () => {
    expect(screen.getByText(/Nos escribes por la web o WhatsApp/)).toBeInTheDocument();
    expect(screen.getByText(/Anamnesis completa/)).toBeInTheDocument();
  });

  it('renders the process image', () => {
    expect(screen.getByAltText('Proceso KÓRE - estudio anatómico')).toBeInTheDocument();
  });
});
