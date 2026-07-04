import { render, screen } from '@testing-library/react';
import ExplainerCard from '@/app/components/shared/ExplainerCard';

afterEach(() => {
  jest.useRealTimers();
  jest.clearAllMocks();
  localStorage.clear();
});

describe('ExplainerCard', () => {
  it('renders the title when provided', () => {
    render(<ExplainerCard title="Índice KORE" />);
    expect(screen.getByText('Índice KORE')).toBeInTheDocument();
  });

  it('renders the whatIs content under the Qué es label', () => {
    render(<ExplainerCard whatIs="Una medida de tu salud" />);
    expect(screen.getByText('Qué es')).toBeInTheDocument();
    expect(screen.getByText('Una medida de tu salud')).toBeInTheDocument();
  });

  it('renders the importance content under the Por qué importa label', () => {
    render(<ExplainerCard importance="Guía tu progreso" />);
    expect(screen.getByText('Por qué importa')).toBeInTheDocument();
    expect(screen.getByText('Guía tu progreso')).toBeInTheDocument();
  });

  it('renders the nextStep content under the Próximo paso label', () => {
    render(<ExplainerCard nextStep="Agenda tu evaluación" />);
    expect(screen.getByText('Próximo paso')).toBeInTheDocument();
    expect(screen.getByText('Agenda tu evaluación')).toBeInTheDocument();
  });

  it('does not render the Qué es label when whatIs is absent', () => {
    render(<ExplainerCard title="Solo título" />);
    expect(screen.queryByText('Qué es')).not.toBeInTheDocument();
  });

  it('does not render a title when none is provided', () => {
    render(<ExplainerCard whatIs="Contenido" />);
    expect(screen.queryByText('Solo título')).not.toBeInTheDocument();
  });
});
