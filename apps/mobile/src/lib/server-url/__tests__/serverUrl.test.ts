import { formatServerUrl, normalizeServerUrl } from 'src/lib/server-url/serverUrl';

describe('normalizeServerUrl', () => {
  it.each([
    ['192.168.0.10:8000', 'http://192.168.0.10:8000/api/v1'],
    ['http://10.0.2.2:8000/', 'http://10.0.2.2:8000/api/v1'],
    ['https://x.com/api/v1/', 'https://x.com/api/v1'],
    ['  https://x.com  ', 'https://x.com/api/v1'],
    ['http://x.com/api/v1', 'http://x.com/api/v1'],
  ])('normaliza %j para %j', (input, expected) => {
    expect(normalizeServerUrl(input)).toBe(expected);
  });

  it.each(['', '   ', 'ftp://x', 'http://', 'dois palavras', '://x'])('rejeita %j', (input) => {
    expect(normalizeServerUrl(input)).toBeNull();
  });
});

describe('formatServerUrl', () => {
  it('mostra só host e porta', () => {
    expect(formatServerUrl('http://192.168.0.10:8000/api/v1')).toBe('192.168.0.10:8000');
    expect(formatServerUrl('https://x.com/api/v1')).toBe('x.com');
  });
});
