'use client';

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-kore-wine-dark">
      {/* Hero */}
      <section className="pt-32 pb-16 px-6 md:px-10 lg:px-16">
        <div className="max-w-4xl mx-auto text-center">
          <span className="inline-block text-white/60 text-sm font-medium tracking-widest uppercase mb-4">
            Documento Legal
          </span>
          <h1 className="text-3xl md:text-4xl lg:text-5xl font-heading mb-6" style={{ color: 'white' }}>
            Términos y Condiciones
          </h1>
          <p className="text-white/70 text-lg leading-relaxed">
            Al reservar cualquier programa de entrenamiento con KÓRE, aceptas los siguientes términos y condiciones de prestación de servicios.
          </p>
        </div>
      </section>

      {/* Contract Content */}
      <section className="pb-24 px-6 md:px-10 lg:px-16">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-8 md:p-12 border border-white/10">
            <div className="prose prose-invert prose-sm max-w-none">
              
              {/* Intro */}
              <p className="text-white/80 leading-relaxed mb-8">
                El presente documento establece los términos y condiciones del contrato de prestación de servicios de entrenamiento personalizado entre <strong className="text-white">KÓRE</strong> y el usuario (en adelante, el "AFILIADO"). Al aceptar estos términos, el afiliado reconoce haber leído, comprendido y aceptado todas las cláusulas aquí descritas.
              </p>

              {/* Cláusula 1 */}
              <div className="mb-8">
                <h2 className="font-heading text-xl mb-4" style={{ color: 'white' }}>PRIMERA — OBJETO</h2>
                <p className="text-white/80 leading-relaxed">
                  KÓRE, debidamente calificado y con los conocimientos idóneos de las ciencias del deporte, se compromete a diseñar, dirigir, controlar y supervisar un plan integral de entrenamiento individualizado, acorde a las características del AFILIADO, con el fin de mejorar su condición de salud teniendo en cuenta los resultados de una valoración física previa y sus objetivos de entrenamiento.
                </p>
              </div>

              {/* Cláusula 2 */}
              <div className="mb-8">
                <h2 className="font-heading text-xl mb-4" style={{ color: 'white' }}>SEGUNDA — DEFINICIONES</h2>
                <p className="text-white/80 leading-relaxed">
                  Se entiende por entrenamiento personal, el servicio prestado por un profesional o técnico en educación física, recreación y deporte con titulación como entrenador personal profesional certificado en diversos énfasis y modalidades de entrenamiento, el cual ejecuta un plan de ejercicios apropiados y seguros para entrenar a sus clientes de forma individual con el objeto de incrementar aptitudes físicas y de salud.
                </p>
              </div>

              {/* Cláusula 3 */}
              <div className="mb-8">
                <h2 className="font-heading text-xl mb-4" style={{ color: 'white' }}>TERCERA — DURACIÓN DEL CONTRATO</h2>
                <p className="text-white/80 leading-relaxed">
                  La duración del presente contrato corresponde al plan adquirido por el AFILIADO, ya sea mensual (30 días contados a partir de la fecha de inicio) o por número de sesiones según el paquete seleccionado. Transcurrido este plazo, se entenderán ejecutadas todas las sesiones incluidas en el plan.
                </p>
                <p className="text-white/60 text-sm mt-4 italic">
                  Parágrafo: Durante el término de duración, el entrenador personalizado dirigirá al afiliado las sesiones correspondientes al plan adquirido, en horario establecido previamente y de común acuerdo.
                </p>
              </div>

              {/* Cláusula 4 */}
              <div className="mb-8">
                <h2 className="font-heading text-xl mb-4" style={{ color: 'white' }}>CUARTA — PRECIO Y FORMA DE PAGO</h2>
                <p className="text-white/80 leading-relaxed">
                  El valor de los servicios corresponde al precio del plan seleccionado por el AFILIADO en el momento de la reserva. El pago deberá realizarse de manera anticipada antes del inicio del programa.
                </p>
                <p className="text-white/60 text-sm mt-4 italic">
                  Parágrafo: En caso que el afiliado no pueda asistir a alguna de las sesiones, deberá cancelarla con anticipación mínima de 8 horas y reprogramarla. De lo contrario, se entenderá como sesión tomada.
                </p>
              </div>

              {/* Cláusula 5 */}
              <div className="mb-8">
                <h2 className="font-heading text-xl mb-4" style={{ color: 'white' }}>QUINTA — INCUMPLIMIENTO EN LAS SESIONES</h2>
                <ul className="text-white/80 space-y-2">
                  <li>• Si el entrenador incumple en la sesión pactada sin previo aviso, deberá reprogramarla.</li>
                  <li>• Si el afiliado incumple en la sesión pactada sin previo aviso, esta se pierde y se da por realizada.</li>
                </ul>
              </div>

              {/* Cláusula 6 */}
              <div className="mb-8">
                <h2 className="font-heading text-xl mb-4" style={{ color: 'white' }}>SEXTA — DURACIÓN DE CADA SESIÓN</h2>
                <p className="text-white/80 leading-relaxed">
                  Cada sesión tendrá la duración estipulada según el plan adquirido. Si el afiliado llega tarde a su sesión, se dictará el tiempo restante del tiempo pactado. Si el entrenador llega tarde, se dictará el tiempo completo pactado.
                </p>
              </div>

              {/* Cláusula 7 */}
              <div className="mb-8">
                <h2 className="font-heading text-xl mb-4" style={{ color: 'white' }}>SÉPTIMA — OBLIGACIONES DE KÓRE</h2>
                <ol className="text-white/80 space-y-2 list-decimal list-inside">
                  <li>Verificar que el afiliado haya asistido a valoración con fisioterapia y/o medicina del deporte, de acuerdo a necesidad del afiliado antes de iniciar plan de entrenamiento.</li>
                  <li>Verificar que el afiliado se realice valoración de seguimiento después de 3 meses de entrenamiento.</li>
                  <li>Mantener comunicación constante respecto a condiciones de salud.</li>
                  <li>Diseñar un programa de entrenamiento individualizado siguiendo las indicaciones y contraindicaciones médicas, orientado a lograr los objetivos del afiliado y mejorar su estado físico.</li>
                  <li>Realizar acompañamiento constante al afiliado en las fechas y horas programadas.</li>
                  <li>Realizar seguimiento de los resultados del plan de entrenamiento.</li>
                  <li>Avisar con tiempo ausencias o reprogramación de sesiones de entrenamiento.</li>
                  <li>Brindar trato amable, cordial y respetuoso.</li>
                  <li>Ser honesto con el afiliado respecto a cuánto se tarda en lograr el objetivo del entrenamiento propuesto sin crear falsas expectativas.</li>
                </ol>
              </div>

              {/* Cláusula 8 */}
              <div className="mb-8">
                <h2 className="font-heading text-xl mb-4" style={{ color: 'white' }}>OCTAVA — OBLIGACIONES DEL AFILIADO</h2>
                <ol className="text-white/80 space-y-2 list-decimal list-inside">
                  <li>Antes de empezar el plan de entrenamiento, realizar valoración médica según su necesidad. Realizarse valoración de seguimiento cada 3 meses.</li>
                  <li>Asistir a estudio de valoración con el entrenador personal.</li>
                  <li>Seguir de manera puntual las indicaciones y recomendaciones del entrenador personal.</li>
                  <li>Vestir de manera adecuada para el entrenamiento y tener hidratación necesaria para el desarrollo del entrenamiento.</li>
                  <li>Informar todos los datos clínicos y antecedentes relevantes que sean requeridos para el desarrollo del entrenamiento (anamnesis).</li>
                  <li>Pagar oportunamente el valor establecido del plan seleccionado.</li>
                  <li>Informar al entrenador personalizado cualquier ausencia con ocho (8) horas de anticipación.</li>
                  <li>Estar afiliado a una EPS y/o Medicina prepagada.</li>
                  <li>Confirmar asistencia a las sesiones programadas.</li>
                  <li>Asistir a todas las sesiones programadas.</li>
                </ol>
              </div>

              {/* Cláusula 9 */}
              <div className="mb-8">
                <h2 className="font-heading text-xl mb-4" style={{ color: 'white' }}>NOVENA — DEVOLUCIONES</h2>
                <p className="text-white/80 leading-relaxed">
                  El afiliado reconoce que la única variable de devolución será por incapacidad médica debidamente certificada que cubra el periodo que le falta para cubrir el tiempo programado de entrenamiento.
                </p>
              </div>

              {/* Cláusula 10 */}
              <div className="mb-8">
                <h2 className="font-heading text-xl mb-4" style={{ color: 'white' }}>DÉCIMA — CAUSALES DE TERMINACIÓN</h2>
                <p className="text-white/80 leading-relaxed mb-4">Podrá terminarse por:</p>
                <ol className="text-white/80 space-y-2 list-decimal list-inside">
                  <li>Incumplimiento de alguna de las partes de las obligaciones señaladas.</li>
                  <li>Por mutuo acuerdo.</li>
                  <li>Vencimiento del plazo previsto.</li>
                  <li>Por omisión por parte del afiliado de condiciones médicas, antecedentes médicos o incapacidades médicas que deban ser conocidos por el entrenador personal para el desarrollo del presente contrato.</li>
                </ol>
                <p className="text-white/60 text-sm mt-4 italic">
                  Parágrafo: Ninguna de las causales anteriores dará lugar a indemnización o devolución del dinero.
                </p>
              </div>

              {/* Cláusula 11 */}
              <div className="mb-8">
                <h2 className="font-heading text-xl mb-4" style={{ color: 'white' }}>DÉCIMA PRIMERA — RESULTADOS</h2>
                <p className="text-white/80 leading-relaxed">
                  El afiliado declara y acepta que los servicios de entrenamiento personalizado y las actividades prestadas por el cumplimiento del mismo son de medio y no de resultado. En caso de que el objetivo no se obtenga, no será responsabilidad del entrenador y no dará lugar a devoluciones de dinero ni indemnización.
                </p>
              </div>

              {/* Cláusula 12 */}
              <div className="mb-8">
                <h2 className="font-heading text-xl mb-4" style={{ color: 'white' }}>DÉCIMA SEGUNDA — CONSENTIMIENTO</h2>
                <p className="text-white/80 leading-relaxed">
                  El afiliado admite que conoce y ha sido informado de todos los beneficios y riesgos que puedan generarse a través de la práctica de este programa de ejercicio físico. Declara que se le ha explicado y ha podido plantear las preguntas que han resuelto sus inquietudes. Por tal motivo, entiende, acepta y exonera de toda responsabilidad a quienes dirigen, lideran y controlan el plan de ejercicio del cual es partícipe, asumiendo la responsabilidad de cualquier tipo de inconveniente que se genere por su participación.
                </p>
              </div>

              {/* Cláusula 13 */}
              <div className="mb-8">
                <h2 className="font-heading text-xl mb-4" style={{ color: 'white' }}>DÉCIMA TERCERA — RESPONSABILIDAD</h2>
                <p className="text-white/80 leading-relaxed">
                  El afiliado deberá atender todas las recomendaciones de su médico y su entrenador personal. Por tanto, reconoce y acepta que KÓRE no se hace responsable de ningún accidente que le ocurra por auto-indicación de los ejercicios realizados en el entrenamiento, y por lo tanto reconoce y acepta que KÓRE no se hará responsable de lesiones personales o cualquier daño o perjuicio ocasionado hacia el afiliado.
                </p>
              </div>

              {/* Acceptance */}
              <div className="mt-12 pt-8 border-t border-white/20">
                <p className="text-white font-medium text-center">
                  Al reservar cualquier programa de KÓRE, el usuario declara haber leído, comprendido y aceptado íntegramente los presentes Términos y Condiciones.
                </p>
              </div>

            </div>
          </div>

          {/* Back link */}
          <div className="text-center mt-12">
            <a
              href="/programs"
              className="inline-flex items-center gap-2 text-white/60 hover:text-white transition-colors text-sm"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
              </svg>
              Volver a Programas
            </a>
          </div>
        </div>
      </section>
    </main>
  );
}
