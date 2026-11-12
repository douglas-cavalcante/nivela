import { useState } from 'react';
import { Pressable } from 'react-native';
import { AppText } from 'src/components/AppText';
import { ServerUrlSheet } from 'src/components/ServerUrlSheet';
import { formatServerUrl, useServerUrl } from 'src/lib/server-url';
import { useTheme } from 'src/lib/theme/useTheme';

/** Linha discreta "Servidor: 192.168.0.10:8000 · Alterar" que abre a folha de troca. */
export function ServerUrlLine() {
  const { url } = useServerUrl();
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Alterar o endereço do servidor"
        onPress={() => setOpen(true)}
        style={{ minHeight: 44, flexDirection: 'row', justifyContent: 'center', alignItems: 'center' }}
      >
        <AppText variant="muted" size={14}>{`Servidor: ${formatServerUrl(url)}`}</AppText>
        <AppText variant="bold" size={14} style={{ color: colors.primary }}>
          {' · Alterar'}
        </AppText>
      </Pressable>
      <ServerUrlSheet visible={open} onClose={() => setOpen(false)} />
    </>
  );
}
