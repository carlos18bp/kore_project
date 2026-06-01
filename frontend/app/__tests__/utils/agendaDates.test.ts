import { dateKey, startOfWeek, addDays, sessionsByDay } from '@/lib/utils/agendaDates';

describe('agendaDates', () => {
  it('dateKey formats a Date as YYYY-MM-DD in local time', () => {
    expect(dateKey(new Date(2026, 4, 20))).toBe('2026-05-20');
    expect(dateKey(new Date(2026, 0, 3))).toBe('2026-01-03');
  });

  it('startOfWeek returns the Monday of the week', () => {
    // 2026-05-20 is a Wednesday → Monday is 2026-05-18
    expect(dateKey(startOfWeek(new Date(2026, 4, 20)))).toBe('2026-05-18');
    // 2026-05-18 is already Monday
    expect(dateKey(startOfWeek(new Date(2026, 4, 18)))).toBe('2026-05-18');
    // 2026-05-24 is a Sunday → Monday is 2026-05-18
    expect(dateKey(startOfWeek(new Date(2026, 4, 24)))).toBe('2026-05-18');
  });

  it('addDays shifts a date by N days', () => {
    expect(dateKey(addDays(new Date(2026, 4, 20), 7))).toBe('2026-05-27');
    expect(dateKey(addDays(new Date(2026, 4, 20), -1))).toBe('2026-05-19');
  });

  it('sessionsByDay groups sessions by their local date key', () => {
    const sessions = [
      { id: 1, starts_at: '2026-05-20T09:00:00-05:00' },
      { id: 2, starts_at: '2026-05-20T11:00:00-05:00' },
      { id: 3, starts_at: '2026-05-21T08:00:00-05:00' },
    ];
    const map = sessionsByDay(sessions);
    expect(map.get('2026-05-20')?.length).toBe(2);
    expect(map.get('2026-05-21')?.length).toBe(1);
    expect(map.get('2026-05-22')).toBeUndefined();
  });
});
