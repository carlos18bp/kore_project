import { render, screen } from '@testing-library/react';
import TermsPage from '@/app/(public)/terms/page';

describe('TermsPage', () => {
  beforeEach(() => {
    render(<TermsPage />);
  });

  it('renders the legal document label', () => {
    expect(screen.getByText('Documento Legal')).toBeInTheDocument();
  });

  it('renders the main heading', () => {
    expect(screen.getByText('Términos y Condiciones')).toBeInTheDocument();
  });

  it('renders the intro paragraph', () => {
    expect(screen.getByText(/Al reservar cualquier programa de entrenamiento con KÓRE/)).toBeInTheDocument();
  });

  it('renders all contract clause headings', () => {
    const clauses = [
      'PRIMERA — OBJETO',
      'SEGUNDA — DEFINICIONES',
      'TERCERA — DURACIÓN DEL CONTRATO',
      'CUARTA — PRECIO Y FORMA DE PAGO',
      'QUINTA — INCUMPLIMIENTO EN LAS SESIONES',
      'SEXTA — DURACIÓN DE CADA SESIÓN',
      'SÉPTIMA — OBLIGACIONES DE KÓRE',
      'OCTAVA — OBLIGACIONES DEL AFILIADO',
      'NOVENA — DEVOLUCIONES',
      'DÉCIMA — CAUSALES DE TERMINACIÓN',
      'DÉCIMA PRIMERA — RESULTADOS',
      'DÉCIMA SEGUNDA — CONSENTIMIENTO',
      'DÉCIMA TERCERA — RESPONSABILIDAD',
    ];
    clauses.forEach(clause => {
      expect(screen.getByText(clause)).toBeInTheDocument();
    });
  });

  it('renders the acceptance footer', () => {
    expect(screen.getByText(/declara haber leído, comprendido y aceptado íntegramente/)).toBeInTheDocument();
  });

  it('renders back link to programs page', () => {
    const link = screen.getByRole('link', { name: /Volver a Programas/i });
    expect(link).toHaveAttribute('href', '/programs');
  });
});
