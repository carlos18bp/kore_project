import { render, screen } from '@testing-library/react';
import SectionLabel from '@/app/components/admin/SectionLabel';

describe('SectionLabel', () => {
  it('renders the title', () => {
    render(<SectionLabel title="Usuarios" />);

    expect(screen.getByText('Usuarios')).toBeInTheDocument();
  });

  it('renders the kicker when provided', () => {
    render(<SectionLabel title="Usuarios" kicker="Gestión" />);

    expect(screen.getByText('Gestión')).toBeInTheDocument();
  });

  it('omits the kicker when not provided', () => {
    render(<SectionLabel title="Usuarios" />);

    expect(screen.queryByText('Gestión')).not.toBeInTheDocument();
  });

  it('renders the hint when provided', () => {
    render(<SectionLabel title="Usuarios" hint="12 activos" />);

    expect(screen.getByText('12 activos')).toBeInTheDocument();
  });

  it('omits the hint when not provided', () => {
    render(<SectionLabel title="Usuarios" />);

    expect(screen.queryByText('12 activos')).not.toBeInTheDocument();
  });

  it('renders the right slot content when provided', () => {
    render(<SectionLabel title="Usuarios" right={<span>Acción</span>} />);

    expect(screen.getByText('Acción')).toBeInTheDocument();
  });

  it('forwards a custom className to the container', () => {
    const { container } = render(<SectionLabel title="Usuarios" className="mb-4" />);

    expect(container.firstChild).toHaveClass('mb-4');
  });
});
