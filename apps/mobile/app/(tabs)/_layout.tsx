import { radius, spacing } from '@nivela/design-tokens';
import { Tabs } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { TabIcon } from 'src/components/TabIcon';
import type { TabIconName } from 'src/components/TabIcon';
import { useTheme } from 'src/lib/theme/useTheme';

const screens: { name: string; title: string; icon: TabIconName }[] = [
  { name: 'index', title: 'Início', icon: 'home' },
  { name: 'study', title: 'Estudar', icon: 'study' },
  { name: 'store', title: 'Loja', icon: 'store' },
  { name: 'profile', title: 'Perfil', icon: 'profile' },
];

export default function TabsLayout() {
  const { colors, fonts } = useTheme();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.text,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: { fontFamily: fonts.bodyBold, fontSize: 12 },
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          borderTopWidth: 2,
          height: 68,
          paddingTop: spacing(1),
        },
        tabBarItemStyle: { minHeight: 44 },
      }}
    >
      {screens.map(({ name, title, icon }) => (
        <Tabs.Screen
          key={name}
          name={name}
          options={{
            title,
            tabBarLabel: title,
            // a aba ativa ganha o marca-texto, como o item do fichário na web
            tabBarIcon: ({ focused }) => (
              <View style={[styles.icon, focused ? { backgroundColor: colors.highlight } : null]}>
                <TabIcon name={icon} color={focused ? colors.onHighlight : colors.textMuted} />
              </View>
            ),
          }}
        />
      ))}
    </Tabs>
  );
}

const styles = StyleSheet.create({
  icon: { paddingHorizontal: spacing(3), paddingVertical: spacing(0.5), borderRadius: radius.pill },
});
