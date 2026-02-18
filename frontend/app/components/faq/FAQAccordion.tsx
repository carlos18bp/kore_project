'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';

interface FAQItem {
  id: number;
  question: string;
  answer: string;
  category?: number | null;
  category_name?: string | null;
}

interface FAQCategory {
  id: number;
  name: string;
  slug: string;
  order: number;
}

interface FAQGroup {
  category: FAQCategory | null;
  items: FAQItem[];
}

interface FAQAccordionProps {
  groups: FAQGroup[];
}

function AccordionItem({ item, isOpen, onToggle }: { 
  item: FAQItem; 
  isOpen: boolean; 
  onToggle: () => void;
}) {
  return (
    <div className="border-b border-kore-gray-light/50 last:border-b-0">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between py-5 px-4 text-left hover:bg-kore-gray-light/20 transition-colors duration-200"
        aria-expanded={isOpen}
      >
        <span className="text-lg font-medium text-kore-gray-dark pr-4">
          {item.question}
        </span>
        <ChevronDown
          className={`w-5 h-5 text-kore-red flex-shrink-0 transition-transform duration-300 ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>
      <div
        className={`overflow-hidden transition-all duration-300 ease-in-out ${
          isOpen ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
        }`}
      >
        <div className="px-4 pb-5 text-kore-gray-dark/70 leading-relaxed">
          {item.answer}
        </div>
      </div>
    </div>
  );
}

export default function FAQAccordion({ groups }: FAQAccordionProps) {
  const [openItems, setOpenItems] = useState<Set<number>>(new Set());

  const toggleItem = (id: number) => {
    setOpenItems((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  if (groups.length === 0) {
    return (
      <div className="text-center py-12 text-kore-gray-dark/60">
        No hay preguntas frecuentes disponibles en este momento.
      </div>
    );
  }

  return (
    <div className="space-y-10">
      {groups.map((group, groupIndex) => (
        <div key={group.category?.id ?? `uncategorized-${groupIndex}`}>
          {group.category && (
            <h3 className="text-xl md:text-2xl text-kore-wine-dark mb-4">
              {group.category.name}
            </h3>
          )}
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            {group.items.map((item) => (
              <AccordionItem
                key={item.id}
                item={item}
                isOpen={openItems.has(item.id)}
                onToggle={() => toggleItem(item.id)}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
