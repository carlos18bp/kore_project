import { render, screen } from '@testing-library/react';
import PublicLayout from '@/app/(public)/layout';

jest.mock('next/image', () => ({
  __esModule: true,
  default: (props: React.ImgHTMLAttributes<HTMLImageElement>) => <img {...props} />,
}));

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href, ...rest }: { children: React.ReactNode; href: string }) => (
    <a href={href} {...rest}>{children}</a>
  ),
}));

let mockPathname = '/';
jest.mock('next/navigation', () => ({
  usePathname: () => mockPathname,
}));

describe('PublicLayout', () => {
  it('renders Navbar, children and Footer', () => {
    render(
      <PublicLayout>
        <div data-testid="child-content">Child content</div>
      </PublicLayout>
    );

    // Navbar renders brand
    expect(screen.getByAltText('KÓRE')).toBeInTheDocument();

    // Children rendered
    expect(screen.getByTestId('child-content')).toBeInTheDocument();

    // Footer renders nav links
    expect(screen.getAllByText('Inicio').length).toBeGreaterThanOrEqual(1);
  });
});
