import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import gsap from 'gsap';
import { ExpandableIndicator } from '@/app/components/dashboard/ExpandableIndicator';

function createIndicator(overrides = {}) {
  return {
    key: 'bmi',
    label: 'IMC',
    value: 22.5,
    unit: 'kg/m²',
    category: 'Normal',
    color: 'green',
    whatIs: 'El índice de masa corporal mide peso respecto a talla.',
    meaning: 'Tu peso es adecuado para tu altura.',
    importance: 'Un IMC saludable reduce riesgos cardiovasculares.',
    nextStep: 'Mantén tu peso con ejercicio regular.',
    ...overrides,
  };
}

describe('ExpandableIndicator', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the indicator label', () => {
    render(<ExpandableIndicator ind={createIndicator()} />);
    expect(screen.getByText('IMC')).toBeInTheDocument();
  });

  it('renders the indicator category in the trigger button', () => {
    render(<ExpandableIndicator ind={createIndicator()} />);
    const button = screen.getByRole('button');
    expect(button).toHaveTextContent('Normal');
  });

  it('renders the detail sections after mounting', () => {
    render(<ExpandableIndicator ind={createIndicator()} />);
    expect(screen.getByText('El índice de masa corporal mide peso respecto a talla.')).toBeInTheDocument();
    expect(screen.getByText('Tu peso es adecuado para tu altura.')).toBeInTheDocument();
    expect(screen.getByText('Un IMC saludable reduce riesgos cardiovasculares.')).toBeInTheDocument();
    expect(screen.getByText('Mantén tu peso con ejercicio regular.')).toBeInTheDocument();
  });

  it('content div starts hidden via inline style', () => {
    const { container } = render(<ExpandableIndicator ind={createIndicator()} />);
    const contentDiv = container.querySelector('[style*="display: none"]');
    expect(contentDiv).toBeInTheDocument();
  });

  it('calls gsap.set on the content element when toggle opens the panel', async () => {
    const user = userEvent.setup();
    render(<ExpandableIndicator ind={createIndicator()} />);
    await user.click(screen.getByRole('button'));
    expect(gsap.set).toHaveBeenCalled();
  });

  it('calls gsap.to to animate height open when toggle is clicked', async () => {
    const user = userEvent.setup();
    render(<ExpandableIndicator ind={createIndicator()} />);
    await user.click(screen.getByRole('button'));
    expect(gsap.to).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ height: 'auto', opacity: 1 }),
    );
  });

  it('rotates arrow to 180 when panel opens', async () => {
    const user = userEvent.setup();
    render(<ExpandableIndicator ind={createIndicator()} />);
    await user.click(screen.getByRole('button'));
    expect(gsap.to).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ rotation: 180 }),
    );
  });

  it('calls gsap.to with height 0 when toggle closes the panel', async () => {
    const user = userEvent.setup();
    render(<ExpandableIndicator ind={createIndicator()} />);
    await user.click(screen.getByRole('button'));
    jest.clearAllMocks();
    await user.click(screen.getByRole('button'));
    expect(gsap.to).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ height: 0, opacity: 0 }),
    );
  });

  it('rotates arrow to 0 when panel closes', async () => {
    const user = userEvent.setup();
    render(<ExpandableIndicator ind={createIndicator()} />);
    await user.click(screen.getByRole('button'));
    jest.clearAllMocks();
    await user.click(screen.getByRole('button'));
    expect(gsap.to).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ rotation: 0 }),
    );
  });

  it('does not render formula section when formula is not provided', () => {
    render(<ExpandableIndicator ind={createIndicator()} />);
    expect(screen.queryByText('Cómo se calcula')).not.toBeInTheDocument();
  });

  it('renders formula section when formula is provided', () => {
    render(<ExpandableIndicator ind={createIndicator({ formula: 'Peso / (Talla²)' })} />);
    expect(screen.getByText('Cómo se calcula')).toBeInTheDocument();
    expect(screen.getByText('Peso / (Talla²)')).toBeInTheDocument();
  });

  it('renders the indicator value with unit', () => {
    render(<ExpandableIndicator ind={createIndicator()} />);
    expect(screen.getByText('22.5')).toBeInTheDocument();
    expect(screen.getByText('kg/m²')).toBeInTheDocument();
  });

  it('renders without unit when unit is not provided', () => {
    render(<ExpandableIndicator ind={createIndicator({ unit: undefined })} />);
    expect(screen.getByText('22.5')).toBeInTheDocument();
  });

  it('uses red color token for indicator with color red', () => {
    const { container } = render(<ExpandableIndicator ind={createIndicator({ color: 'red', category: 'Alto riesgo' })} />);
    expect(container.querySelector('.text-red-600')).toBeInTheDocument();
  });

  it('defaults to green color classes for unrecognized color values', () => {
    const { container } = render(<ExpandableIndicator ind={createIndicator({ color: 'unknown' })} />);
    expect(container.querySelector('.text-green-700')).toBeInTheDocument();
  });

  it('defaults dot color to green when color is empty string', () => {
    const { container } = render(<ExpandableIndicator ind={createIndicator({ color: '' })} />);
    expect(container.querySelector('.bg-green-500')).toBeInTheDocument();
  });

  it('invokes onComplete callback to hide content after close animation', async () => {
    const user = userEvent.setup();
    render(<ExpandableIndicator ind={createIndicator()} />);
    await user.click(screen.getByRole('button'));
    jest.clearAllMocks();
    await user.click(screen.getByRole('button'));
    const toMock = gsap.to as jest.Mock;
    const closeCall = toMock.mock.calls.find(
      ([, opts]: [unknown, Record<string, unknown>]) =>
        opts.height === 0 && typeof opts.onComplete === 'function',
    );
    expect(closeCall).toBeDefined();
    (closeCall![1] as { onComplete: () => void }).onComplete();
    expect(gsap.set).toHaveBeenCalledWith(expect.anything(), { display: 'none' });
  });
});
