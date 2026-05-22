import { computeWeekStates } from '@/lib/weekNotes';

describe('computeWeekStates', () => {
  it('semana 1 activa y el resto bloqueado cuando no hay notas', () => {
    const states = computeWeekStates({});
    expect(states).toEqual([
      { week: 1, state: 'active' },
      { week: 2, state: 'locked' },
      { week: 3, state: 'locked' },
      { week: 4, state: 'locked' },
    ]);
  });

  it('al completar la semana 1 se desbloquea la 2', () => {
    const states = computeWeekStates({ 1: 'Nota semana uno' });
    expect(states[0]).toEqual({ week: 1, state: 'done' });
    expect(states[1]).toEqual({ week: 2, state: 'active' });
    expect(states[2]).toEqual({ week: 3, state: 'locked' });
  });

  it('una nota en blanco no cuenta como completada', () => {
    const states = computeWeekStates({ 1: '   ' });
    expect(states[0]).toEqual({ week: 1, state: 'active' });
    expect(states[1]).toEqual({ week: 2, state: 'locked' });
  });

  it('todas las semanas completadas quedan en done', () => {
    const states = computeWeekStates({ 1: 'a', 2: 'b', 3: 'c', 4: 'd' });
    expect(states.every((s) => s.state === 'done')).toBe(true);
  });
});
