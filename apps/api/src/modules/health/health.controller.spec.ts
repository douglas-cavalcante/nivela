import { HealthController } from 'src/modules/health/health.controller';

describe('HealthController', () => {
  it('responde status ok', () => {
    expect(new HealthController().check()).toEqual({ status: 'ok' });
  });
});
