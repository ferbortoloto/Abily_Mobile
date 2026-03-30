import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Modal, Pressable, ActivityIndicator } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { makeShadow } from '../constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useChat } from '../context/ChatContext';
import { AvailabilityGuardProvider, useAvailabilityGuard } from '../context/AvailabilityGuardContext';
import DashboardScreen from '../screens/instructor/DashboardScreen';
import ScheduleScreen from '../screens/instructor/ScheduleScreen';
import StatsScreen from '../screens/instructor/StatsScreen';
import ProfileScreen from '../screens/instructor/ProfileScreen';
import ChatScreen from '../screens/instructor/ChatScreen';

const Tab = createBottomTabNavigator();

const PRIMARY = '#1D4ED8';
const PILL_BG = '#EFF6FF';
const SCHEDULE_INDEX = 1; // índice da aba "Agenda" em TABS

const TABS = [
  { name: 'Dashboard', label: 'Painel',    icon: 'home-outline',        iconActive: 'home'        },
  { name: 'Schedule',  label: 'Agenda',    icon: 'calendar-outline',    iconActive: 'calendar'    },
  { name: 'Stats',     label: 'Relatório', icon: 'bar-chart-outline',   iconActive: 'bar-chart'   },
  { name: 'Chat',      label: 'Chat',      icon: 'chatbubbles-outline', iconActive: 'chatbubbles' },
  { name: 'Profile',   label: 'Perfil',    icon: 'person-outline',      iconActive: 'person'      },
];

function CustomTabBar({ state, navigation }) {
  const { getTotalUnreadCount } = useChat();
  const { isDirty, saveRef } = useAvailabilityGuard();
  const unreadCount = getTotalUnreadCount();
  const insets = useSafeAreaInsets();

  const [pendingRoute, setPendingRoute] = useState(null);
  const [saving, setSaving] = useState(false);

  const handlePress = (route, index) => {
    const leavingSchedule = state.index === SCHEDULE_INDEX && index !== SCHEDULE_INDEX;
    if (leavingSchedule && isDirty) {
      setPendingRoute(route);
      return;
    }
    navigation.navigate(route.name);
  };

  const handleSaveAndLeave = async () => {
    setSaving(true);
    try {
      await saveRef.current?.();
    } finally {
      setSaving(false);
    }
    navigation.navigate(pendingRoute.name);
    setPendingRoute(null);
  };

  const handleDiscardAndLeave = () => {
    navigation.navigate(pendingRoute.name);
    setPendingRoute(null);
  };

  return (
    <>
      <View style={{
        flexDirection: 'row',
        backgroundColor: '#FFFFFF',
        borderTopWidth: 1,
        borderTopColor: '#F0F0F0',
        paddingHorizontal: 4,
        paddingTop: 8,
        paddingBottom: Math.max(insets.bottom, 10),
        alignItems: 'center',
        ...makeShadow('#000', -2, 0.06, 8, 8),
      }}>
        {state.routes.map((route, index) => {
          const tab = TABS[index];
          const focused = state.index === index;
          const isChatTab = tab.name === 'Chat';
          const hasBadge = isChatTab && unreadCount > 0;

          return (
            <TouchableOpacity
              key={route.key}
              onPress={() => handlePress(route, index)}
              activeOpacity={0.75}
              style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
            >
              {focused ? (
                <View style={{
                  alignItems: 'center',
                  backgroundColor: PILL_BG,
                  paddingHorizontal: 10,
                  paddingVertical: 6,
                  borderRadius: 16,
                  gap: 2,
                  minWidth: 52,
                }}>
                  <Ionicons name={tab.iconActive} size={19} color={PRIMARY} />
                  <Text style={{ color: PRIMARY, fontSize: 10, fontWeight: '700', letterSpacing: 0.1 }}>
                    {tab.label}
                  </Text>
                </View>
              ) : (
                <View style={{ padding: 8, position: 'relative' }}>
                  <Ionicons name={tab.icon} size={22} color="#9CA3AF" />
                  {hasBadge && (
                    <View style={{
                      position: 'absolute', top: 4, right: 4,
                      backgroundColor: '#EF4444', borderRadius: 7,
                      minWidth: 14, height: 14,
                      justifyContent: 'center', alignItems: 'center',
                      paddingHorizontal: 2, borderWidth: 1.5, borderColor: '#FFF',
                    }}>
                      <Text style={{ color: '#FFF', fontSize: 9, fontWeight: '800' }}>
                        {unreadCount > 9 ? '9+' : unreadCount}
                      </Text>
                    </View>
                  )}
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Modal de alterações não salvas */}
      <Modal
        visible={!!pendingRoute}
        transparent
        animationType="fade"
        onRequestClose={() => !saving && setPendingRoute(null)}
      >
        <Pressable
          style={modalStyles.overlay}
          onPress={() => !saving && setPendingRoute(null)}
        >
          <Pressable style={modalStyles.card} onPress={() => {}}>
            <View style={modalStyles.iconWrap}>
              <Ionicons name="warning" size={32} color="#F59E0B" />
            </View>
            <Text style={modalStyles.title}>Alterações não salvas</Text>
            <Text style={modalStyles.body}>
              Você modificou sua disponibilidade mas ainda não salvou.{'\n'}O que deseja fazer?
            </Text>
            <TouchableOpacity
              style={[modalStyles.btnSave, saving && { opacity: 0.7 }]}
              onPress={handleSaveAndLeave}
              disabled={saving}
            >
              {saving
                ? <ActivityIndicator color="#FFF" size="small" />
                : <Ionicons name="checkmark-circle-outline" size={18} color="#FFF" />
              }
              <Text style={modalStyles.btnSaveText}>
                {saving ? 'Salvando...' : 'Salvar e sair'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={modalStyles.btnDiscard}
              onPress={handleDiscardAndLeave}
              disabled={saving}
            >
              <Text style={modalStyles.btnDiscardText}>Sair sem salvar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={modalStyles.btnCancel}
              onPress={() => setPendingRoute(null)}
              disabled={saving}
            >
              <Text style={modalStyles.btnCancelText}>Cancelar</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

function Navigator() {
  return (
    <Tab.Navigator
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tab.Screen name="Dashboard" component={DashboardScreen} />
      <Tab.Screen name="Schedule"  component={ScheduleScreen} />
      <Tab.Screen name="Stats"     component={StatsScreen} />
      <Tab.Screen name="Chat"      component={ChatScreen} />
      <Tab.Screen name="Profile"   component={ProfileScreen} />
    </Tab.Navigator>
  );
}

export default function InstructorTabNavigator() {
  return (
    <AvailabilityGuardProvider>
      <Navigator />
    </AvailabilityGuardProvider>
  );
}

const modalStyles = {
  overlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center', alignItems: 'center', padding: 24,
  },
  card: {
    backgroundColor: '#FFF', borderRadius: 20, padding: 28,
    width: '100%', alignItems: 'center',
    ...makeShadow('#000', 20, 0.15, 24, 8),
  },
  iconWrap: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: '#FFFBEB', alignItems: 'center', justifyContent: 'center',
    marginBottom: 16,
  },
  title: { fontSize: 18, fontWeight: '800', color: '#111827', marginBottom: 10 },
  body: {
    fontSize: 14, color: '#4B5563', textAlign: 'center',
    lineHeight: 22, marginBottom: 24,
  },
  btnSave: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    width: '100%', paddingVertical: 14, borderRadius: 12,
    backgroundColor: PRIMARY, marginBottom: 10,
    ...makeShadow(PRIMARY, 4, 0.25, 8, 4),
  },
  btnSaveText: { fontSize: 15, fontWeight: '700', color: '#FFF' },
  btnDiscard: {
    width: '100%', paddingVertical: 13, borderRadius: 12,
    borderWidth: 1.5, borderColor: '#FCA5A5',
    alignItems: 'center', marginBottom: 8,
  },
  btnDiscardText: { fontSize: 14, fontWeight: '700', color: '#EF4444' },
  btnCancel: {
    width: '100%', paddingVertical: 11, alignItems: 'center',
  },
  btnCancelText: { fontSize: 14, fontWeight: '600', color: '#9CA3AF' },
};
