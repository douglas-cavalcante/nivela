import type { brand } from './colors';

type BrandKey = keyof typeof brand;

export interface MascotShape {
  d: string;
  fill: BrandKey | 'none';
  stroke?: BrandKey;
}

const eye = (cx: number, cy: number): string =>
  `M${cx - 1.4} ${cy}a1.4 1.4 0 1 0 2.8 0a1.4 1.4 0 1 0 -2.8 0Z`;

/** "Rabisco": lápis original na diagonal, ponta para baixo à esquerda. */
export const mascot: { viewBox: '0 0 64 64'; shapes: MascotShape[] } = {
  viewBox: '0 0 64 64',
  shapes: [
    { d: 'M41 13L51 3L61 13L51 23Z', fill: 'coral', stroke: 'ink' }, // borracha
    { d: 'M15 39L41 13L51 23L25 49Z', fill: 'highlighter', stroke: 'ink' }, // corpo
    { d: 'M15 39L25 49L7 57Z', fill: 'paper', stroke: 'ink' }, // ponta de madeira
    { d: 'M7 57L9.5 51L13 54.5Z', fill: 'ink' }, // grafite
    { d: eye(32.5, 26.5), fill: 'ink' },
    { d: eye(37.5, 31.5), fill: 'ink' },
    { d: 'M28.5 30.5Q28 36 33.5 35.5', fill: 'none', stroke: 'ink' }, // sorriso
  ],
};
