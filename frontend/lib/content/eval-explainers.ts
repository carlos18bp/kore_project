/**
 * Educational copy for evaluation modules — shared between client-facing
 * pages (`my-posturometry`, etc.) and trainer-facing edit pages
 * (`trainer/clients/client/<module>`).
 *
 * The copy is module-level by default. For posturometry the per-region
 * details still live in `my-posturometry/page.tsx`'s REGION_INFO. This
 * file is the "what is / why it matters / next step" generic version
 * that the trainer sees at the top of each module page.
 */

export type EvalExplainer = {
  badge: string;
  heading: string;
  bodyTrainer: string;
  whatIs: string;
  importance: string;
  nextStep: string;
};

export const EVAL_EXPLAINERS: Record<string, EvalExplainer> = {
  anthropometry: {
    badge: 'Antropometría',
    heading: 'Composición corporal',
    bodyTrainer:
      'Mide perímetros, pliegues y peso para estimar masa magra, grasa y asimetrías. Idealmente cada 60–90 días.',
    whatIs:
      'La antropometría compara dimensiones del cuerpo en el tiempo: perímetros (muñeca, brazo, cintura, cadera, muslo), pliegues cutáneos y peso. Con esos datos se calculan índices como BMI, % de grasa estimado, e indicadores de simetría bilateral.',
    importance:
      'Permite identificar si las adaptaciones del cliente al programa son hipertrofia, pérdida de grasa o ambas, y detectar asimetrías que pueden generar riesgo de lesión.',
    nextStep:
      'Toma las medidas con el cliente en la misma hora del día, en ayunas y con la misma cinta. Marca los puntos anatómicos antes de medir.',
  },
  posturometry: {
    badge: 'Posturometría',
    heading: 'Análisis postural',
    bodyTrainer:
      'Evaluación visual desde 4 vistas (anterior, lateral derecha, lateral izquierda, posterior) con segmentos por zona.',
    whatIs:
      'La posturometría revisa la alineación del cuerpo en 19 segmentos (cabeza, hombros, escápulas, columna, pelvis, rodillas, pies). Cada segmento se evalúa como leve, moderado o severo.',
    importance:
      'La postura impacta directamente cómo el cliente distribuye carga en cada ejercicio. Una postura desbalanceada aumenta el riesgo de lesión y limita la calidad del movimiento.',
    nextStep:
      'Toma fotos cuadriculadas de las 4 vistas con el cliente en ropa ajustada. Anota hallazgos por zona y prioriza correctivos en las primeras semanas del programa.',
  },
  physical: {
    badge: 'Evaluación física',
    heading: 'Capacidad funcional',
    bodyTrainer:
      'Cinco tests: sentadillas, flexiones, plancha, caminata 6min y apoyo unipodal — más movilidad por zona.',
    whatIs:
      'La evaluación física combina tests cuantitativos (repeticiones, segundos, distancia) con tests cualitativos de movilidad articular para producir índices de fuerza, resistencia, equilibrio y movilidad.',
    importance:
      'Da la línea base para personalizar el programa y permite medir progresos objetivos cada 60–90 días sin depender de la percepción subjetiva del cliente.',
    nextStep:
      'Realiza los tests en orden ascendente de fatiga: equilibrio → sentadillas → flexiones → plancha → caminata. Anota dolor o compensaciones aunque el cliente complete la repetición.',
  },
  parq: {
    badge: 'PAR-Q+',
    heading: 'Cuestionario de aptitud',
    bodyTrainer:
      'Siete preguntas sí/no que detectan condiciones que requieren autorización médica antes de entrenar.',
    whatIs:
      'El PAR-Q+ es el cuestionario de aptitud para actividad física más usado a nivel internacional. Sus 7 preguntas detectan banderas rojas: cardíaca, dolor de pecho, mareos, condición crónica, medicación, problemas óseos/articulares y supervisión médica.',
    importance:
      'Cualquier respuesta "sí" eleva el riesgo y obliga a consultar con un profesional médico antes de progresar la carga. Es la primera barrera de seguridad del programa.',
    nextStep:
      'Si hay banderas rojas, suspende el aumento de intensidad y solicita autorización médica. Documenta cualquier "sí" con detalle.',
  },
  nutrition: {
    badge: 'Nutrición',
    heading: 'Hábitos alimentarios',
    bodyTrainer:
      'Evaluación cualitativa de hábitos: comidas/día, agua, frutas, verduras, ultraprocesados y patrón de sueño.',
    whatIs:
      'La evaluación de nutrición cualifica los hábitos del cliente en 8 dimensiones para producir un score 0–10 que refleja qué tan saludable es su patrón actual.',
    importance:
      'La nutrición contribuye con ~70% del resultado de composición corporal. Trabajar adherencia diaria de comidas sin entender el hábito base lleva a recaídas.',
    nextStep:
      'Repite la evaluación cada 60–90 días para ver evolución. Si el score es bajo, prioriza una dimensión a la vez (ej. agua o ultraprocesados) en lugar de cambiar todo.',
  },
};
