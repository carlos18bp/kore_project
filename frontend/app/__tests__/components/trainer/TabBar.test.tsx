import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TabBar from '@/app/components/trainer/TabBar';

const TABS = [
  { id: 'resumen', label: 'Resumen' },
  { id: 'programa', label: 'Programa' },
  { id: 'notas', label: 'Notas' },
];

/** TabBar renderiza dos variantes (strip + rail); las queries se acotan. */
function strip() {
  return within(screen.getByTestId('tabbar-strip'));
}
function rail() {
  return within(screen.getByTestId('tabbar-rail'));
}

// jsdom no implementa scrollIntoView; el strip lo usa para centrar el tab activo.
beforeAll(() => {
  Element.prototype.scrollIntoView = jest.fn();
});

describe('TabBar', () => {
  it('renders both the horizontal strip and the vertical rail', () => {
    render(<TabBar tabs={TABS} activeTab="resumen" onChange={() => {}} />);
    expect(screen.getByTestId('tabbar-strip')).toBeInTheDocument();
    expect(screen.getByTestId('tabbar-rail')).toBeInTheDocument();
  });

  it('renders every tab label in each variant', () => {
    render(<TabBar tabs={TABS} activeTab="resumen" onChange={() => {}} />);
    for (const t of TABS) {
      expect(strip().getByText(t.label)).toBeInTheDocument();
      expect(rail().getByText(t.label)).toBeInTheDocument();
    }
  });

  it('calls onChange with the tab id when a strip tab is clicked', async () => {
    const onChange = jest.fn();
    render(<TabBar tabs={TABS} activeTab="resumen" onChange={onChange} />);
    await userEvent.click(strip().getByText('Programa'));
    expect(onChange).toHaveBeenCalledWith('programa');
  });

  it('calls onChange with the tab id when a rail tab is clicked', async () => {
    const onChange = jest.fn();
    render(<TabBar tabs={TABS} activeTab="resumen" onChange={onChange} />);
    await userEvent.click(rail().getByText('Notas'));
    expect(onChange).toHaveBeenCalledWith('notas');
  });

  it('marks the active tab as font-bold in the rail', () => {
    render(<TabBar tabs={TABS} activeTab="programa" onChange={() => {}} />);
    expect(rail().getByText('Programa')).toHaveClass('font-bold');
    expect(rail().getByText('Resumen')).not.toHaveClass('font-bold');
  });
});
