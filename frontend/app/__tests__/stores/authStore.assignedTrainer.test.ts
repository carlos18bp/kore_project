import { mapUser } from '@/lib/stores/authStore';

describe('authStore mapUser assigned_trainer', () => {
  const raw = { id: 1, email: 'c@kore.com', first_name: 'C', last_name: 'One', phone: '', role: 'customer' };

  it('defaults assigned_trainer to null', () => {
    expect(mapUser(raw as any).assigned_trainer).toBeNull();
  });

  it('passes assigned_trainer through from extra', () => {
    const at = { id: 3, first_name: 'T', last_name: 'A', location: 'Studio', session_duration_minutes: 60 };
    expect(mapUser(raw as any, { assigned_trainer: at }).assigned_trainer).toEqual(at);
  });
});
