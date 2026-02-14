import { render } from '@testing-library/react';
import CalendarioPage from '@/app/(app)/calendario/page';

const mockReplace = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mockReplace }),
}));

describe('CalendarioPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders a loading spinner while redirecting', () => {
    const { container } = render(<CalendarioPage />);
    expect(container.querySelector('.animate-spin')).toBeInTheDocument();
  });

  it('redirects to /book-session on mount', () => {
    render(<CalendarioPage />);
    expect(mockReplace).toHaveBeenCalledWith('/book-session');
  });
});
