import { render, screen } from '@testing-library/react';
import Card from '@/app/components/admin/Card';

afterEach(() => {
  jest.clearAllMocks();
});

describe('Card', () => {
  it('renders its children by default', () => {
    render(
      <Card>
        <span data-testid="card-child">Contenido</span>
      </Card>,
    );
    expect(screen.getByTestId('card-child')).toBeInTheDocument();
  });

  it('renders the wrapper as the element named in the as prop', () => {
    render(
      <Card as="nav">
        <span>Menu</span>
      </Card>,
    );
    expect(screen.getByRole('navigation')).toBeInTheDocument();
  });

  it('renders children inside the element chosen by the as prop', () => {
    render(
      <Card as="nav">
        <span data-testid="nav-child">Menu</span>
      </Card>,
    );
    expect(screen.getByRole('navigation')).toContainElement(screen.getByTestId('nav-child'));
  });
});
