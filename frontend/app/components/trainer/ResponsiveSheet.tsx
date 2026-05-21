'use client';

import type { ReactNode } from 'react';

type Props = {
  onClose: () => void;
  children: ReactNode;
};

/**
 * Contenedor overlay responsive. En `<xl` se ancla abajo como bottom sheet
 * full-width; en `xl+` se centra como modal angosto. El click en el backdrop
 * cierra. El handle de arrastre sólo se ve en móvil.
 */
export default function ResponsiveSheet({ onClose, children }: Props) {
  return (
    <>
      <div
        data-testid="sheet-backdrop"
        className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="pointer-events-none fixed inset-0 z-50 flex flex-col justify-end xl:items-center xl:justify-center xl:p-4">
        <div className="pointer-events-auto flex max-h-[90dvh] w-full flex-col rounded-t-3xl bg-white shadow-2xl xl:w-full xl:max-w-md xl:rounded-3xl">
          <div data-testid="sheet-handle" className="flex justify-center pt-3 pb-1 xl:hidden">
            <div className="h-1 w-10 rounded-full bg-kore-wine-dark/15" />
          </div>
          {children}
        </div>
      </div>
    </>
  );
}
