import { radius, spacing } from '@nivela/design-tokens';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { AppText } from 'src/components/AppText';
import { Button } from 'src/components/Button';
import { PaperBackground } from 'src/components/PaperBackground';
import { PenCard } from 'src/components/PenCard';
import { MyClassroomsCard } from 'src/features/classrooms';
import { useAuth } from 'src/lib/auth/AuthContext';
import { useTheme } from 'src/lib/theme/useTheme';
import type { Role } from '@nivela/api-contract';

const ROLE_LABEL: Record<Role, string> = {
  admin: 'Administrador',
  teacher: 'Professor',
  student: 'Aluno',
};

export function Profile() {
  const { user, signOut } = useAuth();
  const { colors } = useTheme();
  const [leaving, setLeaving] = useState(false);

  if (!user) return null;

  const leave = async () => {
    setLeaving(true);
    try {
      // sem usuário, as rotas protegidas levam de volta às boas-vindas
      await signOut();
    } finally {
      setLeaving(false);
    }
  };

  return (
    <PaperBackground>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <AppText variant="heading" size={40}>
          Perfil
        </AppText>
        <PenCard style={styles.card}>
          <View style={[styles.avatar, { backgroundColor: colors.highlight, borderColor: colors.border }]}>
            <AppText variant="heading" size={44} style={{ color: colors.onHighlight }} accessible={false}>
              {user.name.trim().charAt(0).toUpperCase()}
            </AppText>
          </View>
          <AppText variant="bold" size={22} style={styles.center}>
            {user.name}
          </AppText>
          <AppText variant="muted" style={styles.center}>
            {user.email}
          </AppText>
          <View style={[styles.badge, { backgroundColor: colors.background, borderColor: colors.border }]}>
            <AppText variant="bold" size={14}>
              {ROLE_LABEL[user.role]}
            </AppText>
          </View>
        </PenCard>
        {user.role === 'student' ? <MyClassroomsCard /> : null}
        <Button title={leaving ? 'Saindo…' : 'Sair'} variant="outline" loading={leaving} onPress={leave} />
      </ScrollView>
    </PaperBackground>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing(5), padding: spacing(5) },
  card: { alignItems: 'center', gap: spacing(2) },
  center: { textAlign: 'center' },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: radius.pill,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: { borderWidth: 2, borderRadius: radius.pill, paddingHorizontal: spacing(3), paddingVertical: spacing(1) },
});
