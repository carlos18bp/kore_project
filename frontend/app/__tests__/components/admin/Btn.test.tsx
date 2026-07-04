import { render, screen, fireEvent } from '@testing-library/react';
import Btn from '@/app/components/admin/Btn';

afterEach(() => {
  jest.clearAllMocks();
});

describe('Btn', () => {
  it('renders its children as the accessible button label', () => {
    render(<Btn>Guardar</Btn>);
    expect(screen.getByRole('button', { name: 'Guardar' })).toBeInTheDocument();
  });

  it.each(['primary', 'ghost', 'dark', 'danger'] as const)(
    'renders an accessible button for the %s variant',
    (variant) => {
      render(<Btn variant={variant}>Accion</Btn>);
      expect(screen.getByRole('button', { name: 'Accion' })).toBeInTheDocument();
    },
  );

  it.each(['sm', 'md'] as const)('renders an accessible button for the %s size', (size) => {
    render(<Btn size={size}>Tamano</Btn>);
    expect(screen.getByRole('button', { name: 'Tamano' })).toBeInTheDocument();
  });

  it('calls onClick when an enabled button is clicked', () => {
    const onClick = jest.fn();
    render(<Btn onClick={onClick}>Enviar</Btn>);
    fireEvent.click(screen.getByRole('button', { name: 'Enviar' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('marks the button as disabled when the disabled prop is set', () => {
    render(<Btn disabled>Enviar</Btn>);
    expect(screen.getByRole('button', { name: 'Enviar' })).toBeDisabled();
  });

  it('does not call onClick when a disabled button is clicked', () => {
    const onClick = jest.fn();
    render(
      <Btn disabled onClick={onClick}>
        Enviar
      </Btn>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Enviar' }));
    expect(onClick).not.toHaveBeenCalled();
  });
});
