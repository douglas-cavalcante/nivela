import CalculateIcon from '@mui/icons-material/Calculate';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import PaletteIcon from '@mui/icons-material/Palette';
import PublicIcon from '@mui/icons-material/Public';
import ScienceIcon from '@mui/icons-material/Science';
import TranslateIcon from '@mui/icons-material/Translate';
import type { SvgIconProps } from '@mui/material';
import type { SubjectIconKey } from '@nivela/design-tokens';

const icons = {
  calculator: CalculateIcon,
  book: MenuBookIcon,
  flask: ScienceIcon,
  globe: PublicIcon,
  palette: PaletteIcon,
  language: TranslateIcon,
} satisfies Record<SubjectIconKey, unknown>;

/** Nome das opções do seletor de ícone, em português. */
export const subjectIconLabels: Record<SubjectIconKey, string> = {
  calculator: 'Calculadora',
  book: 'Livro',
  flask: 'Ciência',
  globe: 'Globo',
  palette: 'Paleta',
  language: 'Idiomas',
};

/** Ícone MUI de uma disciplina (decorativo por padrão). */
export function SubjectIcon({ icon, ...props }: { icon: SubjectIconKey } & SvgIconProps) {
  const Icon = icons[icon];
  return <Icon aria-hidden {...props} />;
}
