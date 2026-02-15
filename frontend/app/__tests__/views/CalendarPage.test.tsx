import { render } from '@testing-library/react';
import CalendarPage from '@/app/(app)/calendar/page';

const mockReplace = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mockReplace }),
}));

describe('CalendarPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders a loading spinner while redirecting', () => {
    const { container } = render(<CalendarPage />);
    expect(container.querySelector('.animate-spin')).toBeInTheDocument();
  });

  it('redirects to /book-session on mount', () => {
    render(<CalendarPage />);
    expect(mockReplace).toHaveBeenCalledWith('/book-session');
  });
});
