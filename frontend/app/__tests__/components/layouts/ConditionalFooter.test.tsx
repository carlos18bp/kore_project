import { render, screen } from '@testing-library/react';
import ConditionalFooter from '@/app/components/layouts/ConditionalFooter';

let mockPathname = '/';
jest.mock('next/navigation', () => ({
  usePathname: () => mockPathname,
}));

jest.mock('@/app/components/layouts/Footer', () => ({
  __esModule: true,
  default: () => <footer data-testid="footer">Footer</footer>,
}));

describe('ConditionalFooter', () => {
  beforeEach(() => {
    mockPathname = '/';
  });

  it('renders Footer when pathname is a public route', () => {
    render(<ConditionalFooter />);
    expect(screen.getByTestId('footer')).toBeInTheDocument();
  });

  it('renders nothing when pathname starts with /login', () => {
    mockPathname = '/login';
    const { container } = render(<ConditionalFooter />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing when pathname starts with /register', () => {
    mockPathname = '/register';
    const { container } = render(<ConditionalFooter />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing when pathname starts with /checkout', () => {
    mockPathname = '/checkout';
    const { container } = render(<ConditionalFooter />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing when pathname is a nested checkout path', () => {
    mockPathname = '/checkout/summary';
    const { container } = render(<ConditionalFooter />);
    expect(container).toBeEmptyDOMElement();
  });
});
