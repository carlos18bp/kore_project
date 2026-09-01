import { render, screen } from '@testing-library/react';
import RatingsSummaryCard from '@/app/components/trainer/RatingsSummaryCard';
import { useSessionRatingStore } from '@/lib/stores/sessionRatingStore';

jest.mock('@/lib/stores/sessionRatingStore', () => ({
  useSessionRatingStore: jest.fn(),
}));

const mocked = useSessionRatingStore as unknown as jest.Mock;

type StoreState = { summary: unknown; fetchSummary: jest.Mock };

function mockStore(state: StoreState) {
  mocked.mockImplementation((selector: (s: StoreState) => unknown) => selector(state));
}

const SUMMARY = {
  count: 3,
  average: 4.5,
  recent: [
    { score: 5, comment: 'Excelente sesión', customer_name: 'Ana' },
    { score: 4, comment: '', customer_name: 'Luis' },
  ],
};

it('renders the average, the session count and only commented reviews', () => {
  mockStore({ summary: SUMMARY, fetchSummary: jest.fn() });

  render(<RatingsSummaryCard />);

  expect(screen.getByTestId('ratings-summary')).toBeInTheDocument();
  expect(screen.getByText('4.5')).toBeInTheDocument();
  expect(screen.getByText('3 sesión(es)')).toBeInTheDocument();
  expect(screen.getByText(/Excelente sesión/)).toBeInTheDocument();
  expect(screen.queryByText(/Luis/)).not.toBeInTheDocument();
});

it('renders the empty state when there is no average yet', () => {
  mockStore({ summary: { count: 0, average: null, recent: [] }, fetchSummary: jest.fn() });

  render(<RatingsSummaryCard />);

  expect(screen.getByText('Todavía no hay calificaciones.')).toBeInTheDocument();
  expect(screen.getByText('0 sesión(es)')).toBeInTheDocument();
});

it('renders the zero count when the summary has not loaded', () => {
  mockStore({ summary: null, fetchSummary: jest.fn() });

  render(<RatingsSummaryCard />);

  expect(screen.getByText('0 sesión(es)')).toBeInTheDocument();
  expect(screen.getByText('Todavía no hay calificaciones.')).toBeInTheDocument();
});

it('fetches the global summary on mount', () => {
  const fetchSummary = jest.fn();
  mockStore({ summary: null, fetchSummary });

  render(<RatingsSummaryCard />);

  expect(fetchSummary).toHaveBeenCalledWith(undefined);
});

it('scopes to a client: fetches with the id and uses the client test id', () => {
  const fetchSummary = jest.fn();
  mockStore({ summary: SUMMARY, fetchSummary });

  render(<RatingsSummaryCard customerId={7} />);

  expect(fetchSummary).toHaveBeenCalledWith(7);
  expect(screen.getByTestId('client-ratings')).toBeInTheDocument();
});
