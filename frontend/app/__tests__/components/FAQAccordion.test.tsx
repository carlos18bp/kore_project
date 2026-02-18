import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import FAQAccordion from '@/app/components/faq/FAQAccordion';

type FAQCategory = {
  id: number;
  name: string;
  slug: string;
  order: number;
};

type FAQItem = {
  id: number;
  question: string;
  answer: string;
  category?: number | null;
  category_name?: string | null;
};

describe('FAQAccordion', () => {
  const category: FAQCategory = {
    id: 1,
    name: 'General',
    slug: 'general',
    order: 1,
  };

  const groups = [
    {
      category,
      items: [
        {
          id: 10,
          question: '¿Qué es KÓRE?',
          answer: 'Respuesta principal.',
          category: 1,
          category_name: 'General',
        },
      ] as FAQItem[],
    },
    {
      category: null,
      items: [
        {
          id: 11,
          question: '¿Cómo reservo?',
          answer: 'Puedes agendar desde tu panel.',
          category: null,
          category_name: null,
        },
      ] as FAQItem[],
    },
  ];

  it('renders empty state when there are no FAQ groups', () => {
    render(<FAQAccordion groups={[]} />);
    expect(screen.getByText('No hay preguntas frecuentes disponibles en este momento.')).toBeInTheDocument();
  });

  it('renders categories and allows toggling items', async () => {
    const user = userEvent.setup();
    render(<FAQAccordion groups={groups} />);

    const headings = screen.getAllByRole('heading', { level: 3 });
    expect(headings).toHaveLength(1);
    expect(screen.getByText('General')).toBeInTheDocument();

    const answer = screen.getByText('Respuesta principal.');
    const answerContainer = answer.parentElement;
    expect(answerContainer).toHaveClass('max-h-0');

    const questionButton = screen.getByRole('button', { name: '¿Qué es KÓRE?' });
    await user.click(questionButton);
    expect(answerContainer).toHaveClass('max-h-96');

    await user.click(questionButton);
    expect(answerContainer).toHaveClass('max-h-0');
  });

  it('renders uncategorized items without a category heading', () => {
    render(<FAQAccordion groups={groups} />);

    expect(screen.getByText('¿Cómo reservo?')).toBeInTheDocument();
    const headings = screen.getAllByRole('heading', { level: 3 });
    expect(headings).toHaveLength(1);
  });
});
