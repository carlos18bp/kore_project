import { render, screen } from '@testing-library/react';
import SectionLabel from '@/app/components/shared/SectionLabel';

afterEach(() => {
  jest.useRealTimers();
  jest.clearAllMocks();
  localStorage.clear();
});

describe('SectionLabel', () => {
  it('renders the children text with the default tone', () => {
    render(<SectionLabel>Qué es</SectionLabel>);
    expect(screen.getByText('Qué es')).toBeInTheDocument();
  });

  it('renders the children text with the dark tone', () => {
    render(<SectionLabel tone="dark">Detalle</SectionLabel>);
    expect(screen.getByText('Detalle')).toBeInTheDocument();
  });
});
