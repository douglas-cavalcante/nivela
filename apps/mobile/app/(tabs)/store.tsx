import { spacing } from '@nivela/design-tokens';
import { StyleSheet, View } from 'react-native';
import { AppText } from 'src/components/AppText';
import { EmptyState } from 'src/components/EmptyState';
import { PaperBackground } from 'src/components/PaperBackground';

export default function StoreScreen() {
  return (
    <PaperBackground>
      <View style={styles.content}>
        <AppText variant="heading" size={40}>
          Loja
        </AppText>
        <EmptyState title="Em breve" description="Aqui você vai trocar moedas por recompensas." />
      </View>
    </PaperBackground>
  );
}

const styles = StyleSheet.create({ content: { flex: 1, gap: spacing(4), padding: spacing(5) } });
