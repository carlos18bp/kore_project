import { render, screen } from '@testing-library/react';
import ProjectionWidget from '@/app/components/program/ProjectionWidget';
import type { Projection } from '@/lib/stores/progressStore';

function makeProjection(overrides: Partial<Projection> = {}): Projection {
  return {
    projected_final_adherence: 0.75,
    weight_projection: null,
    trend: 'improving',
    confidence: 'high',
    recommendation: 'Seguí así, vas por buen camino.',
    days_elapsed: 12,
    days_remaining: 18,
    ...overrides,
  };
}

describe('ProjectionWidget', () => {
  it('renders the projected adherence as a rounded percentage', () => {
    render(<ProjectionWidget projection={makeProjection({ projected_final_adherence: 0.756 })} />);

    expect(screen.getByText('76%')).toBeInTheDocument();
  });

  it('renders the improving trend label', () => {
    render(<ProjectionWidget projection={makeProjection({ trend: 'improving' })} />);

    expect(screen.getByText(/Mejorando/)).toBeInTheDocument();
  });

  it('renders the declining trend label', () => {
    render(<ProjectionWidget projection={makeProjection({ trend: 'declining' })} />);

    expect(screen.getByText(/Bajando/)).toBeInTheDocument();
  });

  it('renders the confidence label', () => {
    render(<ProjectionWidget projection={makeProjection({ confidence: 'low' })} />);

    expect(screen.getByText(/Pocos datos aún/)).toBeInTheDocument();
  });

  it('renders the recommendation text', () => {
    render(<ProjectionWidget projection={makeProjection({ recommendation: 'Aumentá la intensidad.' })} />);

    expect(screen.getByText('Aumentá la intensidad.')).toBeInTheDocument();
  });

  it('renders the elapsed days count', () => {
    render(<ProjectionWidget projection={makeProjection({ days_elapsed: 12 })} />);

    expect(screen.getByText('12 días registrados')).toBeInTheDocument();
  });

  it('renders the remaining days count', () => {
    render(<ProjectionWidget projection={makeProjection({ days_remaining: 18 })} />);

    expect(screen.getByText('18 días restantes')).toBeInTheDocument();
  });

  it('renders the weight projection when present', () => {
    render(<ProjectionWidget projection={makeProjection({ weight_projection: 74 })} />);

    expect(screen.getByText('74 kg proyectado')).toBeInTheDocument();
  });

  it('omits the weight projection when null', () => {
    render(<ProjectionWidget projection={makeProjection({ weight_projection: null })} />);

    expect(screen.queryByText(/proyectado/)).not.toBeInTheDocument();
  });
});
