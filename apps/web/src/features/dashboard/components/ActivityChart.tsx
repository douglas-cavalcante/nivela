import { Box, Typography } from '@mui/material';
import type { ApiActivityDay } from '@nivela/api-contract';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useNivelaColors } from 'src/lib/theme/useNivelaColors';
import { formatDay } from 'src/utils/format';

const FINISHED_LABEL = 'Questões terminadas';
const CORRECT_LABEL = 'Acertos';

const shortDay = (day: string) => formatDay(day).slice(0, 5);

/** Barras de questões terminadas e de acertos por dia de estudo (Fortaleza), com resumo em texto para leitores de tela. */
export function ActivityChart({ days }: { days: ApiActivityDay[] }) {
  const colors = useNivelaColors();
  const finished = days.reduce((sum, day) => sum + day.answered, 0);
  const correct = days.reduce((sum, day) => sum + day.correct, 0);

  if (finished === 0) {
    return (
      <Typography color="text.secondary">
        Ainda não há questões terminadas nos últimos {days.length || 14} dias.
      </Typography>
    );
  }

  return (
    <Box
      role="img"
      aria-label={`Atividade dos últimos ${days.length} dias: ${finished} questões terminadas e ${correct} acertos.`}
      sx={{ width: '100%', height: 260 }}
    >
      <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 600, height: 260 }}>
        <BarChart data={days} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
          <CartesianGrid vertical={false} stroke={colors.rule} />
          <XAxis dataKey="day" tickFormatter={shortDay} stroke={colors.textMuted} tick={{ fill: colors.textMuted }} />
          <YAxis allowDecimals={false} stroke={colors.textMuted} tick={{ fill: colors.textMuted }} />
          <Tooltip
            labelFormatter={(label) => formatDay(String(label))}
            contentStyle={{ backgroundColor: colors.surface, border: `1px solid ${colors.border}`, color: colors.text }}
            cursor={{ fill: colors.rule }}
          />
          <Legend />
          <Bar dataKey="answered" name={FINISHED_LABEL} fill={colors.primary} radius={[3, 3, 0, 0]} />
          <Bar dataKey="correct" name={CORRECT_LABEL} fill={colors.success} radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </Box>
  );
}
