import { spacing } from '@nivela/design-tokens';
import { StyleSheet, View } from 'react-native';
import { AppText } from 'src/components/AppText';
import { EmptyState } from 'src/components/EmptyState';
import { PaperBackground } from 'src/components/PaperBackground';

export default function ProfileScreen() {
  return (
    <PaperBackground>
      <View style={styles.content}>
        <AppText variant="heading" size={40}>
          Perfil
        </AppText>
        <EmptyState title="Em breve" description="Seus dados e conquistas chegam nas próximas etapas." />
      </View>
    </PaperBackground>
  );
}

const styles = StyleSheet.create({ content: { flex: 1, gap: spacing(4), padding: spacing(5) } });
