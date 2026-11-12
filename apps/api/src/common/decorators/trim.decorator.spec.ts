import { plainToInstance } from 'class-transformer';
import { Trim } from 'src/common/decorators/trim.decorator';

class Sample {
  @Trim()
  name?: unknown;

  @Trim({ emptyAsNull: true })
  note?: unknown;
}

const make = (plain: Record<string, unknown>) => plainToInstance(Sample, plain);

describe('@Trim', () => {
  it('tira os espaços das pontas e deixa outros tipos intactos', () => {
    expect(make({ name: '  9º A  ' }).name).toBe('9º A');
    expect(make({ name: '   ' }).name).toBe('');
    expect(make({ name: 3 }).name).toBe(3);
  });

  it('com emptyAsNull, texto vazio (ou só espaços) vira null', () => {
    expect(make({ note: '  9º ano ' }).note).toBe('9º ano');
    expect(make({ note: '   ' }).note).toBeNull();
    expect(make({ note: null }).note).toBeNull();
    expect(make({ note: 5 }).note).toBe(5);
  });
});
