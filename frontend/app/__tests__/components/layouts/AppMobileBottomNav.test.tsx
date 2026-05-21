import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AppMobileBottomNav, {
  type MobileNavMoreItem,
  type MobileNavTab,
} from '@/app/components/layouts/AppMobileBottomNav';
import { useAuthStore } from '@/lib/stores/authStore';

let mockPathname = '/uno';

jest.mock('next/navigation', () => ({
  usePathname: () => mockPathname,
}));

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({
    children,
    href,
    prefetch: _prefetch,
    ...rest
  }: {
    children: React.ReactNode;
    href: string;
    prefetch?: boolean;
  }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const Icon = <svg data-testid="icon" />;

const tabs: MobileNavTab[] = [
  { key: 't1', label: 'Uno', href: '/uno', icon: Icon, match: (p) => p === '/uno' },
];

describe('AppMobileBottomNav — disabled more-items', () => {
  beforeEach(() => {
    mockPathname = '/uno';
    useAuthStore.setState({ logout: jest.fn() });
  });

  it('renders a disabled more-item as inert with a "Pronto" tag', async () => {
    const disabledItem: MobileNavMoreItem = {
      key: 'rep',
      label: 'Reportes',
      icon: Icon,
      disabled: true,
    };
    render(<AppMobileBottomNav tabs={tabs} moreItems={[disabledItem]} />);

    await userEvent.click(screen.getByText('Más'));

    const label = screen.getByText('Reportes');
    expect(label).toBeInTheDocument();
    expect(screen.getByText('Pronto')).toBeInTheDocument();
    expect(label.closest('a')).toBeNull();
    expect(label.closest('button')).toBeNull();
    expect(label.closest('[aria-disabled="true"]')).not.toBeNull();
  });

  it('still renders an enabled more-item as a clickable button', async () => {
    const onClick = jest.fn();
    const item: MobileNavMoreItem = { key: 'x', label: 'Activo', icon: Icon, onClick };
    render(<AppMobileBottomNav tabs={tabs} moreItems={[item]} />);

    await userEvent.click(screen.getByText('Más'));
    const btn = screen.getByText('Activo').closest('button');
    expect(btn).not.toBeNull();
    await userEvent.click(btn as HTMLButtonElement);
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
