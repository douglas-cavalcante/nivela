import { describe, expect, it } from 'vitest';
import { resolveAssetUrl } from '../resolveAssetUrl';

describe('resolveAssetUrl', () => {
  it('junta o caminho relativo à origem da API (ignora o prefixo /api/v1)', () => {
    expect(resolveAssetUrl('http://10.0.2.2:8000/api/v1', '/uploads/questions/1-a.png')).toBe(
      'http://10.0.2.2:8000/uploads/questions/1-a.png',
    );
    expect(resolveAssetUrl('https://api.nivela.app/api/v1/', '/uploads/questions/1-a.png')).toBe(
      'https://api.nivela.app/uploads/questions/1-a.png',
    );
  });

  it('aceita base sem caminho e caminho sem a barra inicial', () => {
    expect(resolveAssetUrl('http://localhost:8000', 'uploads/x.png')).toBe('http://localhost:8000/uploads/x.png');
  });

  it('devolve null quando não há caminho', () => {
    expect(resolveAssetUrl('http://localhost:8000/api/v1', null)).toBeNull();
  });

  it('mantém URLs que já são absolutas', () => {
    expect(resolveAssetUrl('http://localhost:8000/api/v1', 'https://cdn.nivela.app/a.png')).toBe(
      'https://cdn.nivela.app/a.png',
    );
    expect(resolveAssetUrl('http://localhost:8000/api/v1', 'blob:http://localhost:5173/abc')).toBe(
      'blob:http://localhost:5173/abc',
    );
  });

  it('base relativa (proxy no mesmo host) devolve o caminho relativo à raiz', () => {
    expect(resolveAssetUrl('/api/v1', '/uploads/x.png')).toBe('/uploads/x.png');
  });
});
