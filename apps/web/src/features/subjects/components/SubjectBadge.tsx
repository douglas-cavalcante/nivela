import { Box } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { subjectColors } from '@nivela/design-tokens';
import type { SubjectColorKey } from '@nivela/design-tokens';
import { useColorMode } from 'src/lib/theme/ColorModeProvider';

export const subjectColorLabels: Record<SubjectColorKey, string> = {
  teal: 'Turquesa',
  coral: 'Coral',
  violet: 'Violeta',
  sky: 'Céu',
  amber: 'Âmbar',
  rose: 'Rosa',
};

/** Nome da disciplina sobre a cor dela, como um marca-texto. */
export function SubjectBadge({ subject }: { subject: { name: string; color: SubjectColorKey } }) {
  const { mode } = useColorMode();
  const color = subjectColors[mode][subject.color];
  return (
    <Box
      component="span"
      sx={{
        display: 'inline-block',
        px: 1,
        py: 0.25,
        borderRadius: 1,
        fontWeight: 700,
        backgroundColor: color.background,
        color: color.foreground,
        border: `1px solid ${alpha(color.foreground, 0.35)}`,
      }}
    >
      {subject.name}
    </Box>
  );
}
