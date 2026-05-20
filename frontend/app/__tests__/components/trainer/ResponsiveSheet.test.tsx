import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ResponsiveSheet from '@/app/components/trainer/ResponsiveSheet';

describe('ResponsiveSheet', () => {
  it('renders its children', () => {
    render(
      <ResponsiveSheet onClose={() => {}}>
        <p>contenido del sheet</p>
      </ResponsiveSheet>,
    );
    expect(screen.getByText('contenido del sheet')).toBeInTheDocument();
  });

  it('calls onClose when the backdrop is clicked', async () => {
    const onClose = jest.fn();
    render(
      <ResponsiveSheet onClose={onClose}>
        <p>cuerpo</p>
      </ResponsiveSheet>,
    );
    await userEvent.click(screen.getByTestId('sheet-backdrop'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not call onClose when the panel body is clicked', async () => {
    const onClose = jest.fn();
    render(
      <ResponsiveSheet onClose={onClose}>
        <p>cuerpo</p>
      </ResponsiveSheet>,
    );
    await userEvent.click(screen.getByText('cuerpo'));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('renders a drag handle hidden on desktop (xl:hidden)', () => {
    render(
      <ResponsiveSheet onClose={() => {}}>
        <p>cuerpo</p>
      </ResponsiveSheet>,
    );
    expect(screen.getByTestId('sheet-handle')).toHaveClass('xl:hidden');
  });
});
