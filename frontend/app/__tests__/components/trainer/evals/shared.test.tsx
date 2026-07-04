import { render, screen, fireEvent } from '@testing-library/react';
import {
  FormHero, FormSection, Field, ChipSelect, RatingScale, YesNoToggle,
  ComputedCard, NotesField, EvalEmptyState, EvalSectionHeader, StickyFooter,
} from '@/app/components/trainer/evals/shared';

describe('shared/FormHero', () => {
  it('renders the title and kicker', () => {
    render(<FormHero kicker="Módulo 4" title="PAR-Q+" />);
    expect(screen.getByText('PAR-Q+')).toBeInTheDocument();
    expect(screen.getByText('Módulo 4')).toBeInTheDocument();
  });

  it('renders the last-evaluation date when provided', () => {
    render(<FormHero kicker="k" title="t" lastEval="10 mar 2026" />);
    expect(screen.getByText('10 mar 2026')).toBeInTheDocument();
  });

  it('shows the no-evaluations note when there is no last evaluation', () => {
    render(<FormHero kicker="k" title="t" lastEval={null} />);
    expect(screen.getByText('Sin evaluaciones registradas')).toBeInTheDocument();
  });

  it('renders the score when a score value is passed', () => {
    render(<FormHero kicker="k" title="t" score={7} scoreLabel="respuestas" />);
    expect(screen.getByText('7')).toBeInTheDocument();
    expect(screen.getByText('respuestas')).toBeInTheDocument();
  });
});

describe('shared/FormSection', () => {
  it('renders the section title and its children', () => {
    render(<FormSection title="Resultados"><span>hijo</span></FormSection>);
    expect(screen.getByText('Resultados')).toBeInTheDocument();
    expect(screen.getByText('hijo')).toBeInTheDocument();
  });
});

describe('shared/Field', () => {
  it('emits the typed value through onChange', () => {
    const onChange = jest.fn();
    render(<Field label="Peso" placeholder="kg" onChange={onChange} />);
    fireEvent.change(screen.getByPlaceholderText('kg'), { target: { value: '82' } });
    expect(onChange).toHaveBeenCalledWith('82');
  });
});

describe('shared/ChipSelect', () => {
  it('emits the option through onChange when a chip is clicked', () => {
    const onChange = jest.fn();
    render(<ChipSelect label="Nivel" options={['Bajo', 'Alto']} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Alto' }));
    expect(onChange).toHaveBeenCalledWith('Alto');
  });
});

describe('shared/RatingScale', () => {
  it('emits the selected number through onChange', () => {
    const onChange = jest.fn();
    render(<RatingScale label="Esfuerzo" max={5} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: '4' }));
    expect(onChange).toHaveBeenCalledWith(4);
  });
});

describe('shared/YesNoToggle', () => {
  it('emits the opposite value through onChange when editable', () => {
    const onChange = jest.fn();
    render(<YesNoToggle value onChange={onChange} />);
    fireEvent.click(screen.getByText('No'));
    expect(onChange).toHaveBeenCalledWith(false);
  });

  it('does not emit through onChange when readonly', () => {
    const onChange = jest.fn();
    render(<YesNoToggle value readonly onChange={onChange} />);
    fireEvent.click(screen.getByText('No'));
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe('shared/ComputedCard', () => {
  it('renders the label and value', () => {
    render(<ComputedCard label="IMC" value="24.5" />);
    expect(screen.getByText('IMC')).toBeInTheDocument();
    expect(screen.getByText('24.5')).toBeInTheDocument();
  });

  it('renders an em dash when the value is null', () => {
    render(<ComputedCard label="IMC" value={null} />);
    expect(screen.getByText('—')).toBeInTheDocument();
  });
});

describe('shared/NotesField', () => {
  it('emits the typed value through onChange', () => {
    const onChange = jest.fn();
    render(<NotesField label="Notas" placeholder="Escribe" onChange={onChange} />);
    fireEvent.change(screen.getByPlaceholderText('Escribe'), { target: { value: 'ok' } });
    expect(onChange).toHaveBeenCalledWith('ok');
  });
});

describe('shared/EvalEmptyState', () => {
  it('renders the empty-state message', () => {
    render(<EvalEmptyState message="Sin registros" />);
    expect(screen.getByText('Sin registros')).toBeInTheDocument();
  });

  it('calls onNew when the register-first button is clicked', () => {
    const onNew = jest.fn();
    render(<EvalEmptyState message="Sin registros" onNew={onNew} />);
    fireEvent.click(screen.getByRole('button', { name: 'Registrar primera evaluación' }));
    expect(onNew).toHaveBeenCalledTimes(1);
  });
});

describe('shared/EvalSectionHeader', () => {
  it('calls onNew when the new button is clicked', () => {
    const onNew = jest.fn();
    render(<EvalSectionHeader title="Historial" onNew={onNew} />);
    fireEvent.click(screen.getByRole('button', { name: '+ Nueva' }));
    expect(onNew).toHaveBeenCalledTimes(1);
  });
});

describe('shared/StickyFooter', () => {
  it('calls onSave when the save button is clicked', () => {
    const onSave = jest.fn();
    render(<StickyFooter onSave={onSave} onCancel={jest.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Guardar evaluación' }));
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it('calls onCancel when the cancel button is clicked', () => {
    const onCancel = jest.fn();
    render(<StickyFooter onSave={jest.fn()} onCancel={onCancel} />);
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('disables the save button while saving', () => {
    render(<StickyFooter onSave={jest.fn()} onCancel={jest.fn()} saving />);
    expect(screen.getByRole('button', { name: 'Guardando…' })).toBeDisabled();
  });
});
