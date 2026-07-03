import { render, screen, fireEvent } from '@testing-library/react';
import NextSessionRow from '@/app/components/dashboard/NextSessionRow';

describe('NextSessionRow', () => {
  it('shows the session summary and fires onShowUpcoming', () => {
    const onShow = jest.fn();
    render(<NextSessionRow formattedDate="vie 10 jul" formattedTime="10:00 a.m." onShowUpcoming={onShow} />);
    expect(screen.getByText(/Próxima sesión/)).toBeInTheDocument();
    expect(screen.getByText(/vie 10 jul/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Ver mis sesiones' }));
    expect(onShow).toHaveBeenCalled();
  });

  it('shows the empty state when there is no session and still opens the modal', () => {
    const onShow = jest.fn();
    render(<NextSessionRow formattedDate={null} formattedTime="" onShowUpcoming={onShow} />);
    expect(screen.getByText('Próxima sesión')).toBeInTheDocument();
    expect(screen.getByText('Sin sesiones próximas')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Ver mis sesiones' }));
    expect(onShow).toHaveBeenCalled();
  });
});
