import { render, screen } from '@testing-library/react';
import WhatsAppButton from '@/app/components/WhatsAppButton';

describe('WhatsAppButton', () => {
  it('renders a link to WhatsApp', () => {
    render(<WhatsAppButton />);
    const link = screen.getByRole('link', { name: /WhatsApp/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute(
      'href',
      'https://api.whatsapp.com/send/?phone=%2B573014645272&text&type=phone_number&app_absent=0',
    );
  });

  it('opens in a new tab with noopener noreferrer', () => {
    render(<WhatsAppButton />);
    const link = screen.getByRole('link', { name: /WhatsApp/i });
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('has accessible aria-label', () => {
    render(<WhatsAppButton />);
    expect(screen.getByLabelText('Contáctanos por WhatsApp')).toBeInTheDocument();
  });

  it('renders screen reader text', () => {
    render(<WhatsAppButton />);
    expect(screen.getByText('Chatea con nosotros por WhatsApp')).toBeInTheDocument();
  });
});
