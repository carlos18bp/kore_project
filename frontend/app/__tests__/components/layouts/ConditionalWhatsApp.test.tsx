import { render, screen, act } from '@testing-library/react';
import ConditionalWhatsApp from '@/app/components/layouts/ConditionalWhatsApp';

let mockPathname = '/';
jest.mock('next/navigation', () => ({
  usePathname: () => mockPathname,
}));

jest.mock('@/app/components/WhatsAppButton', () => ({
  __esModule: true,
  default: () => <div data-testid="whatsapp-button">WhatsApp</div>,
}));

describe('ConditionalWhatsApp', () => {
  afterEach(() => {
    mockPathname = '/';
  });

  it('renders WhatsAppButton on home route', () => {
    mockPathname = '/';
    render(<ConditionalWhatsApp />);
    expect(screen.getByTestId('whatsapp-button')).toBeInTheDocument();
  });

  it('renders WhatsAppButton on /programs route', () => {
    mockPathname = '/programs';
    render(<ConditionalWhatsApp />);
    expect(screen.getByTestId('whatsapp-button')).toBeInTheDocument();
  });

  it('renders WhatsAppButton on /faq route', () => {
    mockPathname = '/faq';
    render(<ConditionalWhatsApp />);
    expect(screen.getByTestId('whatsapp-button')).toBeInTheDocument();
  });

  it('renders WhatsAppButton on /contact route', () => {
    mockPathname = '/contact';
    render(<ConditionalWhatsApp />);
    expect(screen.getByTestId('whatsapp-button')).toBeInTheDocument();
  });

  it('renders WhatsAppButton on /kore-brand route', () => {
    mockPathname = '/kore-brand';
    render(<ConditionalWhatsApp />);
    expect(screen.getByTestId('whatsapp-button')).toBeInTheDocument();
  });

  it('does not render WhatsAppButton on /login route', () => {
    mockPathname = '/login';
    render(<ConditionalWhatsApp />);
    expect(screen.queryByTestId('whatsapp-button')).toBeNull();
  });

  it('does not render WhatsAppButton on /dashboard route', () => {
    mockPathname = '/dashboard';
    render(<ConditionalWhatsApp />);
    expect(screen.queryByTestId('whatsapp-button')).toBeNull();
  });

  it('does not render WhatsAppButton on /checkout route', () => {
    mockPathname = '/checkout';
    render(<ConditionalWhatsApp />);
    expect(screen.queryByTestId('whatsapp-button')).toBeNull();
  });

  it('hides WhatsAppButton when whatsapp-visibility event fires hidden=true', () => {
    mockPathname = '/';
    render(<ConditionalWhatsApp />);
    expect(screen.getByTestId('whatsapp-button')).toBeInTheDocument();

    act(() => {
      window.dispatchEvent(new CustomEvent('whatsapp-visibility', { detail: { hidden: true } }));
    });

    expect(screen.queryByTestId('whatsapp-button')).toBeNull();
  });

  it('shows WhatsAppButton when whatsapp-visibility event fires hidden=false after being hidden', () => {
    mockPathname = '/';
    render(<ConditionalWhatsApp />);

    act(() => {
      window.dispatchEvent(new CustomEvent('whatsapp-visibility', { detail: { hidden: true } }));
    });
    expect(screen.queryByTestId('whatsapp-button')).toBeNull();

    act(() => {
      window.dispatchEvent(new CustomEvent('whatsapp-visibility', { detail: { hidden: false } }));
    });
    expect(screen.getByTestId('whatsapp-button')).toBeInTheDocument();
  });
});
