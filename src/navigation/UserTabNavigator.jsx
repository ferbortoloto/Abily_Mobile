import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { makeShadow } from '../constants/theme';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useChat } from '../context/ChatContext';
import { usePlans } from '../context/PlansContext';
import UserDashboardScreen from '../screens/user/UserDashboardScreen';
import InstructorDetailScreen from '../screens/user/InstructorDetailScreen';
import PlanCheckoutScreen from '../screens/user/PlanCheckoutScreen';
import BatchScheduleScreen from '../screens/user/BatchScheduleScreen';
import MyPlansScreen from '../screens/user/MyPlansScreen';
import ChatScreen from '../screens/instructor/ChatScreen';
import UserProfileScreen from '../screens/user/UserProfileScreen';

const PRIMARY = '#1D4ED8';
const PILL_BG = '#EFF6FF';
const Tab = createBottomTabNavigator();
const MapStack = createNativeStackNavigator();
const PlansStack = createNativeStackNavigator();

const TABS = [
  { name: 'MapaTab',       label: 'Mapa',      icon: 'map-outline',         iconActive: 'map'         },
  { name: 'PlanoTab',      label: 'Planos',    icon: 'layers-outline',      iconActive: 'layers'      },
  { name: 'MensagensTab',  label: 'Mensagens', icon: 'chatbubbles-outline', iconActive: 'chatbubbles' },
  { name: 'PerfilTab',     label: 'Perfil',    icon: 'person-outline',      iconActive: 'person'      },
];

function MapStackNavigator() {
  return (
    <MapStack.Navigator screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <MapStack.Screen name="UserDashboard" component={UserDashboardScreen} />
      <MapStack.Screen name="InstructorDetail" component={InstructorDetailScreen} />
      <MapStack.Screen name="PlanCheckout" component={PlanCheckoutScreen} />
      <MapStack.Screen name="BatchSchedule" component={BatchScheduleScreen} />
    </MapStack.Navigator>
  );
}

function PlansStackNavigator() {
  return (
    <PlansStack.Navigator screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <PlansStack.Screen name="MyPlans" component={MyPlansScreen} />
      <PlansStack.Screen name="InstructorDetail" component={InstructorDetailScreen} />
      <PlansStack.Screen name="PlanCheckout" component={PlanCheckoutScreen} />
      <PlansStack.Screen name="BatchSchedule" component={BatchScheduleScreen} />
    </PlansStack.Navigator>
  );
}

function CustomTabBar({ state, navigation }) {
  const { conversations, getUnreadCount } = useChat();
  const { purchases } = usePlans();
  const totalUnread = conversations.reduce((acc, conv) => acc + getUnreadCount(conv.id), 0);
  const activePlansCount = purchases.filter(p => p.status === 'active').length;
  const insets = useSafeAreaInsets();

  return (
    <View style={{
      flexDirection: 'row',
      backgroundColor: '#FFFFFF',
      borderTopWidth: 1,
      borderTopColor: '#F1F5F9',
      paddingHorizontal: 4,
      paddingTop: 8,
      paddingBottom: Math.max(insets.bottom, 10),
      alignItems: 'center',
      ...makeShadow('#000', -2, 0.06, 8, 8),
    }}>
      {state.routes.map((route, index) => {
        const tab = TABS[index];
        const focused = state.index === index;
        const isChatTab = tab.name === 'MensagensTab';
        const isPlansTab = tab.name === 'PlanoTab';
        const hasBadge = (isChatTab && totalUnread > 0) || (isPlansTab && activePlansCount > 0);
        const badgeCount = isChatTab ? totalUnread : activePlansCount;

        return (
          <TouchableOpacity
            key={route.key}
            onPress={() => {
              if (tab.name === 'MapaTab') {
                navigation.navigate('MapaTab', { screen: 'UserDashboard' });
              } else if (tab.name === 'PlanoTab') {
                navigation.navigate('PlanoTab', { screen: 'MyPlans' });
              } else {
                navigation.navigate(route.name);
              }
            }}
            activeOpacity={0.75}
            style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
          >
            {focused ? (
              /* Aba ativa: vertical — ícone + label empilhados com fundo pill */
              <View style={{
                alignItems: 'center',
                backgroundColor: PILL_BG,
                paddingHorizontal: 14,
                paddingVertical: 6,
                borderRadius: 16,
                gap: 2,
                minWidth: 60,
              }}>
                <Ionicons name={tab.iconActive} size={19} color={PRIMARY} />
                <Text style={{ color: PRIMARY, fontSize: 10, fontWeight: '700', letterSpacing: 0.1 }}>
                  {tab.label}
                </Text>
              </View>
            ) : (
              <View style={{ padding: 8, position: 'relative' }}>
                <Ionicons name={tab.icon} size={22} color="#94A3B8" />
                {hasBadge && (
                  <View style={{
                    position: 'absolute', top: 4, right: 4,
                    backgroundColor: '#DC2626', borderRadius: 7,
                    minWidth: 14, height: 14,
                    justifyContent: 'center', alignItems: 'center',
                    paddingHorizontal: 2, borderWidth: 1.5, borderColor: '#FFF',
                  }}>
                    <Text style={{ color: '#FFF', fontSize: 9, fontWeight: '800' }}>
                      {badgeCount > 9 ? '9+' : badgeCount}
                    </Text>
                  </View>
                )}
              </View>
            )}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

export default function UserTabNavigator() {
  return (
    <Tab.Navigator
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tab.Screen name="MapaTab"      component={MapStackNavigator} />
      <Tab.Screen name="PlanoTab"     component={PlansStackNavigator} />
      <Tab.Screen name="MensagensTab" component={ChatScreen} />
      <Tab.Screen name="PerfilTab"    component={UserProfileScreen} />
    </Tab.Navigator>
  );
}
