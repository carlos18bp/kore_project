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
    expect(screen.getAllByText('01').length).toBeGreaterThan(0);
    expect(screen.getAllByText('02').length).toBeGreaterThan(0);
    expect(screen.getAllByText('03').length).toBeGreaterThan(0);
    expect(screen.getAllByText('04').length).toBeGreaterThan(0);
    expect(screen.getAllByText('05').length).toBeGreaterThan(0);
    expect(screen.getAllByText('06').length).toBeGreaterThan(0);
  });

  it('renders step titles', () => {
    expect(screen.getAllByText('Primer contacto').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Diagnóstico inicial').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Evaluación completa').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Tu programa').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Sesiones guiadas').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Seguimiento continuo').length).toBeGreaterThan(0);
  });

  it('renders step descriptions', () => {
    expect(screen.getAllByText(/Nos escribes por la web o WhatsApp/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Anamnesis completa/).length).toBeGreaterThan(0);
  });

  it('renders the process image', () => {
    expect(screen.getByAltText('Proceso KÓRE - estudio anatómico')).toBeInTheDocument();
  });
});
