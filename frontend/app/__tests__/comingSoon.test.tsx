import { render, screen } from '@testing-library/react';

import ComingSoonPage from '../page';

describe('ComingSoonPage', () => {
  it('renders brand heading', () => {
    render(<ComingSoonPage />);
    expect(screen.getByRole('heading', { name: 'KÓRE' })).toBeInTheDocument();
  });
});
