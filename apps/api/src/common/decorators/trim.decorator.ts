import { Transform } from 'class-transformer';

/** Remove espaços do início e do fim de textos (outros tipos passam intactos). */
export const Trim = () =>
  Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  );
