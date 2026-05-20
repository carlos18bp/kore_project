import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TabBar from '@/app/components/trainer/TabBar';

const TABS = [
  { id: 'resumen', label: 'Resumen' },
  { id: 'programa', label: 'Programa' },
  { id: 'notas', label: 'Notas' },
];

function dropdown() {
  return within(screen.getByTestId('tabbar-dropdown'));
}
function rail() {
  return within(screen.getByTestId('tabbar-rail'));
}

describe('TabBar', () => {
  it('renders both the mobile dropdown and the vertical rail', () => {
    render(<TabBar tabs={TABS} activeTab="resumen" onChange={() => {}} />);
    expect(screen.getByTestId('tabbar-dropdown')).toBeInTheDocument();
    expect(screen.getByTestId('tabbar-rail')).toBeInTheDocument();
  });

  it('the dropdown trigger shows the active tab label', () => {
    render(<TabBar tabs={TABS} activeTab="programa" onChange={() => {}} />);
    expect(dropdown().getByRole('button', { expanded: false })).toHaveTextContent('Programa');
  });

  it('renders every tab label in the rail', () => {
    render(<TabBar tabs={TABS} activeTab="resumen" onChange={() => {}} />);
    for (const t of TABS) {
      expect(rail().getByText(t.label)).toBeInTheDocument();
    }
  });

  it('does not show the tab options until the dropdown is opened', () => {
    render(<TabBar tabs={TABS} activeTab="resumen" onChange={() => {}} />);
    // El rail tiene "Notas"; el dropdown cerrado, no.
    expect(dropdown().queryByText('Notas')).not.toBeInTheDocument();
  });

  it('opens the dropdown and selecting a tab calls onChange and closes it', async () => {
    const onChange = jest.fn();
    render(<TabBar tabs={TABS} activeTab="resumen" onChange={onChange} />);
    await userEvent.click(dropdown().getByRole('button', { expanded: false }));
    await userEvent.click(dropdown().getByText('Notas'));
    expect(onChange).toHaveBeenCalledWith('notas');
    // Tras seleccionar, el panel se cierra: "Notas" ya no está en el dropdown.
    expect(dropdown().queryByText('Notas')).not.toBeInTheDocument();
  });

  it('calls onChange with the tab id when a rail tab is clicked', async () => {
    const onChange = jest.fn();
    render(<TabBar tabs={TABS} activeTab="resumen" onChange={onChange} />);
    await userEvent.click(rail().getByText('Programa'));
    expect(onChange).toHaveBeenCalledWith('programa');
  });

  it('marks the active tab as font-bold in the rail', () => {
    render(<TabBar tabs={TABS} activeTab="programa" onChange={() => {}} />);
    expect(rail().getByText('Programa')).toHaveClass('font-bold');
    expect(rail().getByText('Resumen')).not.toHaveClass('font-bold');
  });
});
