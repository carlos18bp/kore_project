import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import AdminUsersNewPage from '@/app/admin-platform/users/new/page';
import { useAdminUserStore } from '@/lib/stores/adminUserStore';

const mockPush = jest.fn();
const mockUsePathname = jest.fn();
jest.mock('next/navigation', () => ({
  usePathname: () => mockUsePathname(),
  useRouter: () => ({ push: mockPush }),
}));

jest.mock('next/link', () => {
  const MockLink = ({
    href,
    children,
    ...props
  }: {
    href: string;
    children: React.ReactNode;
    [key: string]: unknown;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  );
  MockLink.displayName = 'MockLink';
  return MockLink;
});

const mockUser = {
  id: '1',
  email: 'admin@example.com',
  first_name: 'Ana',
  last_name: 'García',
  role: 'ADMIN',
  name: 'Ana García',
};

jest.mock('@/lib/stores/authStore', () => ({
  useAuthStore: (selector?: (state: { user: typeof mockUser; logout: () => void }) => unknown) => {
    const state = { user: mockUser, logout: jest.fn() };
    return typeof selector === 'function' ? selector(state) : state;
  },
}));

jest.mock('@/lib/stores/adminUserStore', () => ({
  useAdminUserStore: jest.fn(),
}));

const mockedStore = useAdminUserStore as unknown as jest.Mock;
const mockCreateUser = jest.fn();

function setStore(overrides: Record<string, unknown> = {}) {
  mockedStore.mockReturnValue({
    actionLoading: false,
    createUser: mockCreateUser,
    ...overrides,
  });
}

beforeEach(() => {
  mockUsePathname.mockReturnValue('/admin-platform/users/new');
  setStore();
});

afterEach(() => {
  jest.clearAllMocks();
});

function fillValidForm() {
  fireEvent.change(screen.getByPlaceholderText('usuario@ejemplo.com'), {
    target: { value: 'nuevo@example.com' },
  });
  fireEvent.change(screen.getByPlaceholderText('Ana'), { target: { value: 'Nuevo' } });
  fireEvent.change(screen.getByPlaceholderText('Martínez'), { target: { value: 'Usuario' } });
}

describe('AdminUserNewPage', () => {
  it('renders the enrollment heading', () => {
    render(<AdminUsersNewPage />);
    expect(screen.getByRole('heading', { name: 'Inscribir nuevo usuario' })).toBeInTheDocument();
  });

  it('renders the email field', () => {
    render(<AdminUsersNewPage />);
    expect(screen.getByPlaceholderText('usuario@ejemplo.com')).toBeInTheDocument();
  });

  it('renders both selectable role cards', () => {
    render(<AdminUsersNewPage />);
    expect(screen.getByRole('button', { name: /Cliente/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Entrenador/ })).toBeInTheDocument();
  });

  it('shows validation errors when submitting an empty form', async () => {
    render(<AdminUsersNewPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Crear y enviar credenciales' }));
    expect(await screen.findAllByText('Requerido')).toHaveLength(3);
    expect(mockCreateUser).not.toHaveBeenCalled();
  });

  it('shows the success screen after a user is created', async () => {
    mockCreateUser.mockResolvedValue({ ok: true });
    render(<AdminUsersNewPage />);
    fillValidForm();
    fireEvent.click(screen.getByRole('button', { name: 'Crear y enviar credenciales' }));
    expect(await screen.findByRole('heading', { name: 'Usuario inscrito' })).toBeInTheDocument();
  });

  it('shows a server error when creation fails', async () => {
    mockCreateUser.mockResolvedValue({ ok: false, errors: { email: ['Ya existe un usuario con ese email.'] } });
    render(<AdminUsersNewPage />);
    fillValidForm();
    fireEvent.click(screen.getByRole('button', { name: 'Crear y enviar credenciales' }));
    expect(await screen.findByText('Ya existe un usuario con ese email.')).toBeInTheDocument();
  });

  it('calls createUser with the entered email when the form is valid', async () => {
    mockCreateUser.mockResolvedValue({ ok: true });
    render(<AdminUsersNewPage />);
    fillValidForm();
    fireEvent.click(screen.getByRole('button', { name: 'Crear y enviar credenciales' }));
    await waitFor(() =>
      expect(mockCreateUser).toHaveBeenCalledWith(
        expect.objectContaining({ email: 'nuevo@example.com' }),
      ),
    );
  });
});
