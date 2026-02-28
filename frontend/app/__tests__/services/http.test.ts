describe('http service', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('creates axios instance with default baseURL', async () => {
    delete process.env.NEXT_PUBLIC_API_BASE_URL;
    const { api } = await import('@/lib/services/http');
    expect(api.defaults.baseURL).toBe('/api');
  });

  it('uses NEXT_PUBLIC_API_BASE_URL env variable when set', async () => {
    process.env.NEXT_PUBLIC_API_BASE_URL = 'https://api.kore.co';
    const { api } = await import('@/lib/services/http');
    expect(api.defaults.baseURL).toBe('https://api.kore.co');
  });
});
