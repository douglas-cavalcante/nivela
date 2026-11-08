import { registerSchema } from 'src/features/auth/schemas/register.schema';

const base = {
  name: 'Bia',
  email: 'bia@aluno.com',
  password: 'segredo123',
  password_confirmation: 'segredo123',
};

describe('registerSchema — código da turma', () => {
  it.each([
    [' niv 4k7q ', 'NIV-4K7Q'],
    ['niv4k7q', 'NIV-4K7Q'],
    ['NIV-4K7Q', 'NIV-4K7Q'],
    [' niv-4k7q ', 'NIV-4K7Q'],
  ])('normaliza %j em %j (como a API)', (raw, expected) => {
    expect(registerSchema.parse({ ...base, join_code: raw }).join_code).toBe(expected);
  });
});
