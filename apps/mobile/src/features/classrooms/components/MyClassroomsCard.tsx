import type { ApiMyClassroom } from '@nivela/api-contract';
import { spacing } from '@nivela/design-tokens';
import { useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { AppText } from 'src/components/AppText';
import { Button } from 'src/components/Button';
import { EmptyState } from 'src/components/EmptyState';
import { PenCard } from 'src/components/PenCard';
import { listMyClassroomsAction } from 'src/features/classrooms/api/classrooms.action';
import { JoinClassroomForm } from 'src/features/classrooms/components/JoinClassroomForm';
import { useRemote } from 'src/hooks/useRemote';
import { useTheme } from 'src/lib/theme/useTheme';

/** "Minhas turmas" do aluno + entrada em outra turma pelo código. */
export function MyClassroomsCard() {
  const { colors } = useTheme();
  const { data, error, loading, reload } = useRemote('my-classrooms', (signal) => listMyClassroomsAction(signal));
  const loadError = loading ? null : error; // no "Tentar de novo" volta o indicador de carregamento
  const [joined, setJoined] = useState<ApiMyClassroom[]>([]);
  const [joining, setJoining] = useState(false);
  const [joinedName, setJoinedName] = useState<string | null>(null);

  // Turmas em que a pessoa acabou de entrar aparecem já, sem esperar outra busca.
  const classrooms = data ? [...data.filter((item) => !joined.some((j) => j.id === item.id)), ...joined] : null;

  const handleJoined = (classroom: ApiMyClassroom) => {
    setJoined((current) => [...current.filter((item) => item.id !== classroom.id), classroom]);
    setJoinedName(classroom.name);
    setJoining(false);
  };

  return (
    <View style={styles.wrapper}>
      <PenCard style={styles.card}>
        <AppText variant="heading" size={28} accessibilityRole="header">
          Minhas turmas
        </AppText>
        {loadError ? (
          <View style={styles.card}>
            <AppText accessibilityRole="alert" accessibilityLiveRegion="polite" style={{ color: colors.danger }}>
              {loadError}
            </AppText>
            <Button title="Tentar de novo" variant="outline" onPress={reload} />
          </View>
        ) : classrooms === null ? (
          <ActivityIndicator accessibilityLabel="Carregando turmas" color={colors.primary} />
        ) : classrooms.length === 0 ? (
          <EmptyState title="Você ainda não está em nenhuma turma." />
        ) : (
          classrooms.map((classroom) => (
            <View key={classroom.id} style={styles.item}>
              <AppText variant="bold" size={18}>
                {classroom.name}
              </AppText>
              {classroom.school_year ? <AppText variant="muted">{classroom.school_year}</AppText> : null}
              <AppText variant="muted">{`Prof. ${classroom.teacher.name}`}</AppText>
            </View>
          ))
        )}
        {joinedName ? (
          <AppText
            accessibilityRole="alert"
            accessibilityLiveRegion="polite"
            variant="bold"
            style={{ color: colors.primary }}
          >
            {`Você entrou na turma ${joinedName}!`}
          </AppText>
        ) : null}
      </PenCard>
      {joining ? <JoinClassroomForm onJoined={handleJoined} /> : null}
      {/* Só depois da lista carregar: assim a entrada não disputa com o GET inicial. */}
      {classrooms !== null && !loadError ? (
        <Button
          title={joining ? 'Cancelar' : 'Entrar em outra turma'}
          variant="outline"
          onPress={() => {
            setJoining((value) => !value);
            setJoinedName(null);
          }}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: spacing(4) },
  card: { gap: spacing(2) },
  item: { gap: 2, paddingVertical: spacing(1) },
});
