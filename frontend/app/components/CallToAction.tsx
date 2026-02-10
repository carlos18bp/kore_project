import Image from 'next/image';

export default function CallToAction() {
  return (
    <section className="relative bg-kore-wine-dark py-16 lg:py-20 overflow-hidden">
      {/* Background decorative image */}
      <div className="absolute right-0 top-0 bottom-0 w-1/3 opacity-10">
        <Image
          src="/images/pose.webp"
          alt=""
          fill
          className="object-cover object-left"
          aria-hidden="true"
        />
      </div>

      <div className="relative z-10 w-full px-6 md:px-10 lg:px-16">
        <div className="max-w-3xl">
          <span className="inline-block text-kore-red-lightest text-sm font-medium tracking-widest uppercase mb-4">
            Comienza tu proceso
          </span>
          <h2 className="font-heading font-semibold text-3xl md:text-4xl lg:text-5xl text-white mb-6 leading-tight">
            Tu diagnóstico inicial es gratuito y sin compromiso
          </h2>
          <p className="text-lg text-white/70 leading-relaxed mb-10 max-w-xl">
            El primer paso es conocerte. Conversemos sobre tus objetivos, tu
            historia y lo que necesitas. A partir de ahí, construimos juntos tu
            camino.
          </p>

          <div className="flex flex-wrap gap-4">
            <a
              href="#diagnostico"
              className="inline-flex items-center justify-center bg-kore-red hover:bg-kore-red-dark text-white font-medium px-10 py-4 rounded-lg transition-colors duration-200 text-lg"
            >
              Agendar diagnóstico gratuito
            </a>
            <a
              href="https://wa.me/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center border-2 border-white/30 text-white hover:bg-white/10 font-medium px-10 py-4 rounded-lg transition-colors duration-200"
            >
              Escríbenos por WhatsApp
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
