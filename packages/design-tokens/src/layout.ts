export const radius = { sm: 8, md: 12, lg: 16, pill: 999 } as const;

/** Escala de 4 px: `spacing(2)` = 8. */
export const spacing = (n: number): number => n * 4;

/** Borda de 2 px + sombra sólida deslocada 3 px 3 px, como traço de caneta. */
export const penShadow = { offset: 3, width: 2 } as const;
