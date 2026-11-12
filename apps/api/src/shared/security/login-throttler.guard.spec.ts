import { Reflector } from '@nestjs/core';
import { LoginThrottlerGuard } from 'src/shared/security/login-throttler.guard';

type Req = { ip?: string; body?: unknown };

function trackerFor(req: Req): Promise<string> {
  const guard = new LoginThrottlerGuard(
    { throttlers: [] },
    {} as never,
    new Reflector(),
  );
  return guard['getTracker'](req);
}

describe('LoginThrottlerGuard (chave)', () => {
  it('combina o ip com o e-mail normalizado (trim e minúsculas)', async () => {
    const a = await trackerFor({
      ip: '10.0.0.1',
      body: { email: '  Aluno@Escola.COM ' },
    });
    const b = await trackerFor({
      ip: '10.0.0.1',
      body: { email: 'aluno@escola.com' },
    });
    expect(a).toBe(b);
    expect(a).toBe('10.0.0.1:aluno@escola.com');
  });

  it('separa e-mails diferentes do mesmo ip', async () => {
    const a = await trackerFor({ ip: '10.0.0.1', body: { email: 'a@x.com' } });
    const b = await trackerFor({ ip: '10.0.0.1', body: { email: 'b@x.com' } });
    expect(a).not.toBe(b);
  });

  it('cai só no ip sem e-mail utilizável', async () => {
    const ip = '10.0.0.1';
    expect(await trackerFor({ ip })).toBe(ip);
    expect(await trackerFor({ ip, body: {} })).toBe(ip);
    expect(await trackerFor({ ip, body: { email: 42 } })).toBe(ip);
    expect(await trackerFor({ ip, body: { email: '   ' } })).toBe(ip);
    expect(await trackerFor({ ip, body: 'texto' })).toBe(ip);
  });
});
