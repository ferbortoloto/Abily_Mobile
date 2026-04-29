import React, { useState, useEffect, useMemo } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, TextInput, Modal, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AvailabilityViewer from '../../components/user/AvailabilityViewer';
import Avatar from '../../components/shared/Avatar';
import LeafletMapView from '../../components/shared/LeafletMapView';
import { usePlans } from '../../context/PlansContext';
import { useAuth } from '../../hooks/useAuth';
import { useSchedule } from '../../context/ScheduleContext';
import { useChat } from '../../context/ChatContext';
import { getReviews, createReview, toAppInstructor } from '../../services/instructors.service';
import { supabase } from '../../lib/supabase';
import { logger } from '../../utils/logger';
import { MeetingPointType } from '../../data/scheduleData';
import { geocodeAddress } from '../../utils/geocoding';
import { useCurrentLocation } from '../../hooks/useCurrentLocation';
import { makeShadow } from '../../constants/theme';
import { toast } from '../../utils/toast';

const PRIMARY = '#1D4ED8';

const CLASS_TYPE_ICON = {
  'Aula Prática': 'car-outline',
  'Misto':        'grid-outline',
};

const VEHICLE_TYPE_LABEL = {
  manual:    'Manual',
  automatic: 'Automático',
  electric:  'Elétrico',
};

const VEHICLE_TYPE_ICON = {
  manual:    'car-outline',
  automatic: 'car-sport-outline',
  electric:  'flash-outline',
};


function StarRow({ rating, size = 14, color = '#EAB308' }) {
  return (
    <View style={{ flexDirection: 'row', gap: 2 }}>
      {Array.from({ length: 5 }).map((_, i) => (
        <Ionicons
          key={i}
          name={i < Math.floor(rating) ? 'star' : i < rating ? 'star-half' : 'star-outline'}
          size={size}
          color={color}
        />
      ))}
    </View>
  );
}

export default function InstructorDetailScreen({ route, navigation }) {
  const [instructor, setInstructor] = useState(route.params.instructor);
  const { getActivePlans, getUserPurchases } = usePlans();
  const { user, updateProfile, goalCategories } = useAuth();
  const { addRequest, events } = useSchedule();
  const { startChatWith } = useChat();
  const { location: currentLocation } = useCurrentLocation();
  const [selectedSlots, setSelectedSlots] = useState([]);
  const [selectedDate, setSelectedDate] = useState(null);
  const [carChoice, setCarChoice] = useState(
    instructor.carOptions === 'student' ? 'student' : 'instructor',
  );
  const [meetingType, setMeetingType] = useState(MeetingPointType.GPS_LOCATION);
  const [customAddress, setCustomAddress] = useState('');
  const [customCoordinates, setCustomCoordinates] = useState(null);
  const [geocoding, setGeocoding] = useState(false);
  const [usePlan, setUsePlan] = useState(true); // true = usa plano, false = aula avulsa
  const [reviews, setReviews] = useState([]);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [reviewSubmitting, setReviewSubmitting] = useState(false);

  // Categorias que o instrutor ensina E o aluno quer cursar
  const instructorCats = React.useMemo(() => {
    const ic = instructor.licenseCategory || '';
    if (ic.includes('+') || ic === 'AB') return ['A', 'B'];
    return ic ? [ic] : [];
  }, [instructor.licenseCategory]);

  const matchingCats = React.useMemo(
    () => instructorCats.filter(c => goalCategories.some(gc => gc.category === c)),
    [instructorCats, goalCategories],
  );

  // Se só há uma categoria em comum, pré-seleciona; senão o aluno escolhe
  const [selectedCategory, setSelectedCategory] = useState(() =>
    matchingCats.length === 1 ? matchingCats[0] : (instructorCats[0] ?? null)
  );

  // Modal de RENACH — exibido quando aluno tenta agendar sem ter preenchido
  const [showRenachModal, setShowRenachModal] = useState(false);
  const [renachInput, setRenachInput] = useState('');
  const [renachError, setRenachError] = useState('');
  const [renachSaving, setRenachSaving] = useState(false);
  const [pendingScheduleAfterRenach, setPendingScheduleAfterRenach] = useState(false);

  useEffect(() => {
    getReviews(instructor.id)
      .then(data => setReviews(data))
      .catch(e => logger.error('Erro ao carregar avaliações:', e.message));
  }, [instructor.id]);

  // Realtime: atualiza dados do instrutor em tempo real enquanto a tela está aberta
  useEffect(() => {
    const channel = supabase
      .channel(`instructor_profile_${instructor.id}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'profiles',
        filter: `id=eq.${instructor.id}`,
      }, (payload) => {
        setInstructor(prev => toAppInstructor({ ...payload.new }));
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [instructor.id]);

  const completedClasses = events.filter(
    e => (e.type === 'class' || e.type === 'CLASS') &&
         e.instructorId === instructor.id &&
         e.status === 'completed'
  );
  const hasCompletedClass = completedClasses.length > 0;
  const lastCompletedClass = completedClasses.sort(
    (a, b) => new Date(b.endDateTime) - new Date(a.endDateTime)
  )[0];
  const within7Days = lastCompletedClass
    ? (Date.now() - new Date(lastCompletedClass.endDateTime).getTime()) < 7 * 24 * 60 * 60 * 1000
    : false;
  const alreadyReviewed = reviews.some(r => r.student_id === user?.id);
  const canReview = hasCompletedClass && !alreadyReviewed && within7Days;

  const handleSubmitReview = async () => {
    setReviewSubmitting(true);
    try {
      await createReview({
        instructorId: instructor.id,
        studentId: user.id,
        eventId: null,
        rating: reviewRating,
        comment: reviewComment.trim() || null,
      });
      const updated = await getReviews(instructor.id);
      setReviews(updated);
      setShowReviewModal(false);
      setReviewComment('');
      setReviewRating(5);
      toast.success('Avaliação enviada! Obrigado pelo seu feedback.');
    } catch (e) {
      logger.error('Erro ao enviar avaliação:', e.message);
      toast.error('Não foi possível enviar sua avaliação. Tente novamente.');
    } finally {
      setReviewSubmitting(false);
    }
  };

  const plans = getActivePlans(instructor.id);

  // Verifica se o aluno tem um plano ativo com este instrutor
  const allPurchases = getUserPurchases() || [];
  const activePurchase = allPurchases.find(
    p => p.instructor_id === instructor.id && p.status === 'active' && (p.classes_remaining ?? 0) > 0
  );

  const instructorCategories = React.useMemo(() => {
    const ic = instructor.licenseCategory || '';
    if (ic.includes('+') || ic === 'AB' || ic === 'A+B') return ['A', 'B'];
    return ic ? [ic] : [];
  }, [instructor.licenseCategory]);

  const catColor = instructorCategories.includes('A') && !instructorCategories.includes('B')
    ? '#7C3AED'
    : instructorCategories.includes('A') && instructorCategories.includes('B')
      ? '#059669'
      : '#2563EB';

  const handleOpenChat = async () => {
    await startChatWith(instructor.id);
    navigation.navigate('MensagensTab');
  };

  const meetingPreviewCoords = useMemo(() => {
    if (meetingType === MeetingPointType.GPS_LOCATION) return currentLocation ?? null;
    if (meetingType === MeetingPointType.CUSTOM) return customCoordinates;
    return null;
  }, [meetingType, currentLocation, customCoordinates]);

  const handleGeocodeCustom = async () => {
    if (!customAddress.trim()) return;
    setGeocoding(true);
    try {
      const coords = await geocodeAddress(customAddress);
      if (coords) {
        setCustomCoordinates({ latitude: coords.latitude, longitude: coords.longitude });
        toast.success(`Endereço encontrado: ${coords.displayName.split(',').slice(0, 2).join(',')}`);
      } else {
        toast.error('Endereço não encontrado. Tente ser mais específico.');
      }
    } catch {
      toast.error('Não foi possível buscar o endereço. Verifique sua conexão.');
    } finally {
      setGeocoding(false);
    }
  };

  const handleSaveRenach = async () => {
    const value = renachInput.trim().toUpperCase();
    if (!/^[A-Z]{2}\d{9}$/.test(value)) {
      setRenachError('Formato inválido. Use 2 letras (UF) + 9 dígitos (ex: SP123456789).');
      return;
    }
    setRenachError('');
    setRenachSaving(true);
    try {
      await updateProfile({ renach: value });
      setShowRenachModal(false);
      setRenachInput('');
      if (pendingScheduleAfterRenach) {
        setPendingScheduleAfterRenach(false);
        // Chama handleSchedule novamente agora que RENACH foi salvo
        handleSchedule();
      }
    } catch {
      setRenachError('Não foi possível salvar. Tente novamente.');
    } finally {
      setRenachSaving(false);
    }
  };

  const handleSchedule = async () => {
    if (selectedSlots.length === 0) {
      toast.error('Selecione pelo menos um horário disponível.');
      return;
    }
    if (meetingType === MeetingPointType.GPS_LOCATION && !currentLocation) {
      toast.error('Aguarde — obtendo sua localização atual...');
      return;
    }
    if (meetingType === MeetingPointType.CUSTOM && !customAddress.trim()) {
      toast.error('Informe o endereço do local combinado.');
      return;
    }

    // Bloqueia agendamento se aluno não tem RENACH cadastrado
    if (!user?.renach) {
      setPendingScheduleAfterRenach(true);
      setShowRenachModal(true);
      return;
    }

    const meetingAddress =
      meetingType === MeetingPointType.GPS_LOCATION ? 'Localização atual do aluno' : customAddress;
    const meetingCoordinates =
      meetingType === MeetingPointType.GPS_LOCATION ? currentLocation ?? null : customCoordinates;

    try {
      const localDate = selectedDate
        ? `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}-${String(selectedDate.getDate()).padStart(2, '0')}`
        : null;

      const tzOffset = -new Date().getTimezoneOffset();
      const tzSign = tzOffset >= 0 ? '+' : '-';
      const tzHH = String(Math.floor(Math.abs(tzOffset) / 60)).padStart(2, '0');
      const tzMM = String(Math.abs(tzOffset) % 60).padStart(2, '0');
      const tzSuffix = `${tzSign}${tzHH}:${tzMM}`;

      const toSlotTimestamp = (slot) => localDate && slot ? `${localDate}T${slot}:00${tzSuffix}` : null;

      const sortedSlots = [...selectedSlots].sort();
      const firstSlot = sortedSlots[0] ?? null;
      const lastSlot = sortedSlots[sortedSlots.length - 1] ?? null;

      const requestedStart = toSlotTimestamp(firstSlot);

      // requested_end = último slot + 30 min
      let requestedEnd = null;
      if (localDate && lastSlot) {
        const [h, m] = lastSlot.split(':').map(Number);
        const totalMin = h * 60 + m + 30;
        const endH = String(Math.floor(totalMin / 60) % 24).padStart(2, '0');
        const endM = String(totalMin % 60).padStart(2, '0');
        requestedEnd = `${localDate}T${endH}:${endM}:00${tzSuffix}`;
      }

      const requestData = {
        instructor_id: instructor.id,
        type: 'Aula Prática',
        status: 'pending',
        price: instructor.pricePerHour ?? 0,
        car_option: carChoice,
        meeting_point: {
          type: meetingType,
          address: meetingAddress,
          coordinates: meetingCoordinates,
        },
        requested_slots: selectedSlots,
        requested_date: localDate,
        requested_start: requestedStart,
        requested_end: requestedEnd,
        ...(activePurchase?.id && usePlan ? { purchase_id: activePurchase.id } : {}),
        ...(selectedCategory ? { license_category: selectedCategory } : {}),
      };

      // Aula avulsa: exige pagamento antes de enviar a solicitação
      if (!usePlan || !activePurchase) {
        navigation.navigate('AvulsaCheckout', {
          instructor,
          requestData: { ...requestData, student_id: user.id },
        });
        return;
      }

      await addRequest(requestData);
      toast.success(`Solicitação enviada para ${instructor.name}! Aguarde a confirmação.`);
      navigation.goBack();
    } catch (e) {
      logger.error('Erro ao criar solicitação:', e);
      toast.error('Não foi possível enviar a solicitação. Tente novamente.');
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#374151" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Instrutor</Text>
        <TouchableOpacity style={styles.headerChatBtn} onPress={handleOpenChat} activeOpacity={0.8}>
          <Ionicons name="chatbubble-ellipses" size={18} color="#FFF" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Hero section */}
        <View style={styles.hero}>
          <Avatar uri={instructor.avatar_url} name={instructor.name} size={80} style={styles.heroPhotoFlex} />
          <View style={styles.heroInfo}>
            <View style={styles.heroNameRow}>
              <Text style={styles.heroName}>{instructor.name}</Text>
              {instructor.isVerified && (
                <View style={styles.verifiedBadge}>
                  <Ionicons name="checkmark-circle" size={14} color="#16A34A" />
                  <Text style={styles.verifiedText}>Verificado</Text>
                </View>
              )}
            </View>

            <View style={styles.heroRatingRow}>
              <StarRow rating={instructor.rating} />
              <Text style={styles.heroRating}>{instructor.rating.toFixed(1)}</Text>
              <Text style={styles.heroReviews}>({instructor.reviewsCount} avaliações)</Text>
            </View>

            <View style={styles.heroMeta}>
              <View style={{ flexDirection: 'row', gap: 6 }}>
                {instructorCategories.map(cat => (
                  <View
                    key={cat}
                    style={[styles.catBadge, { backgroundColor: cat === 'A' ? '#7C3AED20' : '#2563EB20' }]}
                  >
                    <Ionicons
                      name={cat === 'A' ? 'bicycle-outline' : 'car-outline'}
                      size={11}
                      color={cat === 'A' ? '#7C3AED' : '#2563EB'}
                    />
                    <Text style={[styles.catText, { color: cat === 'A' ? '#7C3AED' : '#2563EB' }]}>
                      Cat. {cat}
                    </Text>
                  </View>
                ))}
              </View>
              <View style={styles.locationRow}>
                <Ionicons name="location-outline" size={12} color="#9CA3AF" />
                <Text style={styles.locationText} numberOfLines={1}>{instructor.location}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Price + Rating card */}
        <View style={styles.infoGrid}>
          <View style={styles.infoItem}>
            <Ionicons name="cash-outline" size={20} color={PRIMARY} />
            <Text style={styles.infoValue}>R$ {instructor.pricePerHour}</Text>
            <Text style={styles.infoLabel}>por hora {instructorCategories.includes('B') ? '(carro)' : ''}</Text>
          </View>
          {instructorCategories.includes('A') && instructor.pricePerHourMoto ? (
            <>
              <View style={styles.infoDivider} />
              <View style={styles.infoItem}>
                <Ionicons name="cash-outline" size={20} color="#7C3AED" />
                <Text style={[styles.infoValue, { color: '#7C3AED' }]}>R$ {instructor.pricePerHourMoto}</Text>
                <Text style={styles.infoLabel}>por hora (moto)</Text>
              </View>
            </>
          ) : null}
          <View style={styles.infoDivider} />
          <View style={styles.infoItem}>
            <Ionicons name="star" size={20} color="#EAB308" />
            <Text style={styles.infoValue}>{instructor.rating.toFixed(1)}</Text>
            <Text style={styles.infoLabel}>avaliação</Text>
          </View>
        </View>

        {/* Veículos — card único compacto */}
        {(instructorCategories.includes('A') || instructorCategories.includes('B')) && (
          <View style={styles.vehicleSection}>
            {instructorCategories.includes('B') && (
              <View style={[styles.vehicleCol, instructorCategories.includes('A') && { flex: 1 }]}>
                <View style={styles.vehicleColHeader}>
                  <Ionicons name="car-outline" size={13} color="#2563EB" />
                  <Text style={[styles.vehicleColTitle, { color: '#2563EB' }]}>Carro · Cat. B</Text>
                  {instructor.vehicleType ? (
                    <View style={styles.vehicleTypePill}>
                      <Text style={styles.vehicleTypePillText}>{VEHICLE_TYPE_LABEL[instructor.vehicleType]}</Text>
                    </View>
                  ) : null}
                </View>
                <Text style={styles.vehicleColMain} numberOfLines={1}>
                  {instructor.carOptions === 'student'
                    ? 'Carro do aluno'
                    : [instructor.carModel, instructor.carYear].filter(Boolean).join(' ') || '—'}
                </Text>
                {(instructor.carColor || instructor.carPlate) ? (
                  <Text style={styles.vehicleColSub}>
                    {[instructor.carColor, instructor.carPlate].filter(Boolean).join(' · ')}
                  </Text>
                ) : null}
              </View>
            )}
            {instructorCategories.includes('A') && instructorCategories.includes('B') && (
              <View style={styles.vehicleColDivider} />
            )}
            {instructorCategories.includes('A') && (
              <View style={[styles.vehicleCol, instructorCategories.includes('B') && { flex: 1 }]}>
                <View style={styles.vehicleColHeader}>
                  <Ionicons name="bicycle-outline" size={13} color="#7C3AED" />
                  <Text style={[styles.vehicleColTitle, { color: '#7C3AED' }]}>Moto · Cat. A</Text>
                </View>
                <Text style={styles.vehicleColMain} numberOfLines={1}>
                  {[instructor.motoModel, instructor.motoYear].filter(Boolean).join(' ') || '—'}
                </Text>
                {(instructor.motoColor || instructor.motoPlate) ? (
                  <Text style={styles.vehicleColSub}>
                    {[instructor.motoColor, instructor.motoPlate].filter(Boolean).join(' · ')}
                  </Text>
                ) : null}
              </View>
            )}
          </View>
        )}

        {/* Bio */}
        {instructor.bio && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Sobre o Instrutor</Text>
            <Text style={styles.bioText}>{instructor.bio}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 }}>
              <Ionicons name="person-outline" size={14} color="#9CA3AF" />
              <Text style={{ fontSize: 13, color: '#6B7280' }}>
                {instructor.gender === 'male' ? 'Masculino' : instructor.gender === 'female' ? 'Feminino' : 'Não declarado'}
              </Text>
            </View>
          </View>
        )}

        {/* Banner: plano ativo do aluno com este instrutor */}
        {activePurchase && (
          <View style={styles.activePlanSection}>
            <View style={styles.activePlanSectionHeader}>
              <Ionicons name="layers" size={14} color="#7C3AED" />
              <Text style={styles.activePlanSectionLabel}>Seu Plano Ativo</Text>
            </View>
            <View style={styles.activePlanBanner}>
              {/* Topo: nome do plano + aulas */}
              <View style={styles.activePlanTop}>
                <View style={styles.activePlanIconBox}>
                  <Ionicons name="layers" size={20} color="#7C3AED" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.activePlanTitle}>
                    {activePurchase.plans?.name || 'Plano Ativo'}
                  </Text>
                  <View style={styles.activePlanRow}>
                    <View style={styles.activePlanChip}>
                      <Ionicons name="checkmark-circle" size={12} color="#16A34A" />
                      <Text style={styles.activePlanChipText}>
                        {activePurchase.classes_remaining} aula{activePurchase.classes_remaining !== 1 ? 's' : ''} restante{activePurchase.classes_remaining !== 1 ? 's' : ''}
                      </Text>
                    </View>
                    <Text style={styles.activePlanSub}>
                      de {activePurchase.classes_total} no total
                    </Text>
                  </View>
                </View>
              </View>
              {/* Barra de progresso */}
              <View style={styles.activePlanProgress}>
                <View style={styles.activePlanProgressBar}>
                  <View style={[styles.activePlanProgressFill, {
                    width: `${((activePurchase.classes_total - activePurchase.classes_remaining) / activePurchase.classes_total) * 100}%`
                  }]} />
                </View>
                <Text style={styles.activePlanProgressText}>
                  {activePurchase.classes_total - activePurchase.classes_remaining}/{activePurchase.classes_total} aulas usadas
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Plans */}
        {plans.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Planos disponíveis</Text>
            <Text style={styles.sectionSub}>Economize contratando um pacote de aulas</Text>
            {plans.map(plan => {
              const originalTotal = instructor.pricePerHour * plan.classCount;
              const savings = originalTotal - plan.price;
              const discountPct = Math.round((savings / originalTotal) * 100);
              const pricePerClass = (plan.price / plan.classCount).toFixed(0);
              return (
                <View key={plan.id} style={styles.planCard}>
                  <View style={styles.planCardTop}>
                    <View style={styles.planIconBox}>
                      <Ionicons name={CLASS_TYPE_ICON[plan.classType] || 'layers-outline'} size={20} color={PRIMARY} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.planName}>{plan.name}</Text>
                      <Text style={styles.planDesc} numberOfLines={2}>{plan.description}</Text>
                    </View>
                    {discountPct > 0 && (
                      <View style={styles.discountBadge}>
                        <Text style={styles.discountBadgeText}>-{discountPct}%</Text>
                      </View>
                    )}
                  </View>

                  <View style={styles.planChipsRow}>
                    <View style={styles.planChip}>
                      <Ionicons name="school-outline" size={11} color={PRIMARY} />
                      <Text style={styles.planChipText}>{plan.classCount} aulas</Text>
                    </View>
                    <View style={[styles.planChip, { backgroundColor: '#EFF6FF' }]}>
                      <Ionicons name="time-outline" size={11} color="#2563EB" />
                      <Text style={[styles.planChipText, { color: '#2563EB' }]}>{plan.validityDays} dias</Text>
                    </View>
                    <View style={[styles.planChip, { backgroundColor: '#FFF7ED' }]}>
                      <Ionicons name="layers-outline" size={11} color="#7C3AED" />
                      <Text style={[styles.planChipText, { color: '#7C3AED' }]}>{plan.classType}</Text>
                    </View>
                  </View>

                  <View style={styles.planFooter}>
                    <View>
                      <Text style={styles.planPrice}>R$ {plan.price}</Text>
                      <Text style={styles.planPriceSub}>R$ {pricePerClass}/aula</Text>
                    </View>
                    <TouchableOpacity
                      style={styles.planContractBtn}
                      onPress={() => navigation.navigate('PlanCheckout', { plan, instructor })}
                      activeOpacity={0.85}
                    >
                      <Ionicons name="bag-outline" size={14} color="#FFF" />
                      <Text style={styles.planContractBtnText}>Contratar</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* Availability */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Agendar aula</Text>

          {/* Toggle: plano vs avulsa — só aparece quando há plano ativo */}
          {activePurchase && (
            <View style={styles.classTypeSelector}>
              <TouchableOpacity
                style={[styles.classTypeOption, usePlan && styles.classTypeOptionActive]}
                onPress={() => setUsePlan(true)}
                activeOpacity={0.8}
              >
                <Ionicons name="layers" size={14} color={usePlan ? '#7C3AED' : '#6B7280'} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.classTypeLabel, usePlan && styles.classTypeLabelActive]}>
                    Usar plano
                  </Text>
                  <Text style={[styles.classTypeSub, usePlan && styles.classTypeSubActive]}>
                    {activePurchase.classes_remaining} aula{activePurchase.classes_remaining !== 1 ? 's' : ''} disponíve{activePurchase.classes_remaining !== 1 ? 'is' : 'l'}
                  </Text>
                </View>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.classTypeOption, !usePlan && styles.classTypeOptionAvulsa]}
                onPress={() => setUsePlan(false)}
                activeOpacity={0.8}
              >
                <Ionicons name="cash-outline" size={14} color={!usePlan ? PRIMARY : '#6B7280'} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.classTypeLabel, !usePlan && styles.classTypeLabelAvulsa]}>
                    Aula avulsa
                  </Text>
                  <Text style={[styles.classTypeSub, !usePlan && styles.classTypeSubAvulsa]}>
                    R$ {instructor.pricePerHour}/h
                  </Text>
                </View>
              </TouchableOpacity>
            </View>
          )}

          {!activePurchase && (
            <Text style={styles.sectionSub}>Selecione a data e os horários para solicitar uma aula</Text>
          )}

          {/* Seletor de categoria — cards grandes quando instrutor ensina A e B */}
          {instructorCats.length > 1 && (
            <View style={styles.catPickerSection}>
              <Text style={styles.catPickerSectionLabel}>Tipo de aula</Text>
              <View style={styles.catPickerCards}>
                {instructorCats.map(c => {
                  const isMoto = c === 'A';
                  const active = selectedCategory === c;
                  const price = isMoto ? instructor.pricePerHourMoto : instructor.pricePerHour;
                  const color = isMoto ? '#7C3AED' : PRIMARY;
                  return (
                    <TouchableOpacity
                      key={c}
                      style={[styles.catPickerCard, active && { borderColor: color, backgroundColor: isMoto ? '#F5F3FF' : '#EFF6FF' }]}
                      onPress={() => setSelectedCategory(c)}
                      activeOpacity={0.8}
                    >
                      <Ionicons name={isMoto ? 'bicycle-outline' : 'car-outline'} size={24} color={active ? color : '#9CA3AF'} />
                      <Text style={[styles.catPickerCardLabel, active && { color }]}>
                        {isMoto ? 'Moto' : 'Carro'}
                      </Text>
                      <Text style={styles.catPickerCardCat}>Cat. {c}</Text>
                      {price ? (
                        <Text style={[styles.catPickerCardPrice, active && { color }]}>R$ {price}/h</Text>
                      ) : null}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}

          {/* Car selector — só aparece quando a aula é de carro (Cat. B) */}
          {(selectedCategory !== 'A') && instructor.carOptions === 'both' ? (
            <View style={styles.carSelector}>
              <Text style={styles.carSelectorLabel}>Qual carro será usado?</Text>
              <View style={styles.carChipRow}>
                {[
                  { v: 'instructor', label: 'Carro do instrutor', icon: 'car-outline' },
                  { v: 'student',    label: 'Meu carro',          icon: 'car-sport-outline' },
                ].map(opt => (
                  <TouchableOpacity
                    key={opt.v}
                    style={[styles.carChip, carChoice === opt.v && styles.carChipActive]}
                    onPress={() => setCarChoice(opt.v)}
                    activeOpacity={0.8}
                  >
                    <Ionicons
                      name={opt.icon}
                      size={14}
                      color={carChoice === opt.v ? '#FFF' : '#6B7280'}
                    />
                    <Text style={[styles.carChipText, carChoice === opt.v && styles.carChipTextActive]}>
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          ) : (
            (selectedCategory !== 'A') && (
              <View style={styles.carInfoRow}>
                <Ionicons name="car-outline" size={13} color={PRIMARY} />
                <Text style={styles.carInfoText}>
                  {instructor.carOptions === 'student'
                    ? 'Aula realizada no seu próprio carro'
                    : `Aula no veículo do instrutor${instructor.carModel ? ` (${[instructor.carModel, instructor.carYear].filter(Boolean).join(' ')})` : ''}`}
                </Text>
              </View>
            )
          )}

          {/* Meeting point selector */}
          <View style={styles.meetingSection}>
            <Text style={styles.carSelectorLabel}>Local de encontro</Text>
            <View style={styles.meetingChipRow}>
              {[
                { v: MeetingPointType.GPS_LOCATION, label: 'Localização atual', icon: 'navigate-outline' },
                { v: MeetingPointType.CUSTOM,       label: 'Local combinado',   icon: 'map-outline' },
              ].map(opt => (
                <TouchableOpacity
                  key={opt.v}
                  style={[styles.carChip, meetingType === opt.v && styles.carChipActive]}
                  onPress={() => setMeetingType(opt.v)}
                  activeOpacity={0.8}
                >
                  <Ionicons
                    name={opt.icon}
                    size={13}
                    color={meetingType === opt.v ? '#FFF' : '#6B7280'}
                  />
                  <Text style={[styles.carChipText, meetingType === opt.v && styles.carChipTextActive]}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Info / input por tipo */}
            {meetingType === MeetingPointType.GPS_LOCATION ? (
              <View style={styles.meetingAddressRow}>
                <Ionicons
                  name={currentLocation ? 'navigate' : 'navigate-outline'}
                  size={13}
                  color={currentLocation ? PRIMARY : '#9CA3AF'}
                />
                <Text style={[styles.meetingAddressText, !currentLocation && { color: '#9CA3AF' }]}>
                  {currentLocation ? 'Localização obtida — compartilhada com o instrutor' : 'Obtendo localização...'}
                </Text>
              </View>
            ) : (
              <View>
                <View style={styles.meetingCustomRow}>
                  <TextInput
                    style={styles.meetingCustomInput}
                    placeholder="Rua, número, bairro — local combinado"
                    placeholderTextColor="#9CA3AF"
                    value={customAddress}
                    onChangeText={text => { setCustomAddress(text); setCustomCoordinates(null); }}
                  />
                  <TouchableOpacity
                    style={[styles.geocodeBtn, geocoding && { opacity: 0.6 }]}
                    onPress={handleGeocodeCustom}
                    disabled={geocoding || !customAddress.trim()}
                    activeOpacity={0.8}
                  >
                    <Ionicons name={geocoding ? 'hourglass-outline' : 'search-outline'} size={16} color="#FFF" />
                  </TouchableOpacity>
                </View>
                {customCoordinates && (
                  <View style={styles.geocodeSuccess}>
                    <Ionicons name="checkmark-circle" size={13} color="#16A34A" />
                    <Text style={styles.geocodeSuccessText}>Localização confirmada</Text>
                  </View>
                )}
              </View>
            )}

            {/* Mapa preview do ponto de encontro */}
            {meetingPreviewCoords && (
              <View style={styles.meetingMapPreview}>
                <LeafletMapView
                  center={{ lat: meetingPreviewCoords.latitude, lng: meetingPreviewCoords.longitude }}
                  zoom={15}
                  markers={[
                    {
                      id: 'meeting',
                      latitude: meetingPreviewCoords.latitude,
                      longitude: meetingPreviewCoords.longitude,
                      label: 'Encontro',
                      color: PRIMARY,
                      type: 'default',
                    },
                    ...(instructor?.coordinates ? [{
                      id: 'instructor',
                      latitude: instructor.coordinates.latitude,
                      longitude: instructor.coordinates.longitude,
                      label: instructor.name?.split(' ')[0] ?? 'Instrutor',
                      color: '#7C3AED',
                      type: 'default',
                    }] : []),
                  ]}
                />
              </View>
            )}
          </View>

          <AvailabilityViewer
            instructorId={instructor.id}
            onSlotsSelected={(slots, date) => {
              setSelectedSlots(slots);
              setSelectedDate(date);
            }}
          />
        </View>

        {/* Reviews */}
        {(reviews.length > 0 || canReview) && (
          <View style={styles.section}>
            <View style={styles.reviewsSectionHeader}>
              <Text style={styles.sectionTitle}>Avaliações</Text>
              {canReview && (
                <TouchableOpacity style={styles.reviewBtn} onPress={() => setShowReviewModal(true)}>
                  <Ionicons name="star-outline" size={14} color="#FFF" />
                  <Text style={styles.reviewBtnText}>Avaliar</Text>
                </TouchableOpacity>
              )}
            </View>
            {reviews.map(review => {
              const authorName = review.profiles?.name || 'Aluno';
              const dateStr = new Date(review.created_at).toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' });
              return (
                <View key={review.id} style={styles.reviewCard}>
                  <View style={styles.reviewHeader}>
                    <View style={styles.reviewAvatar}>
                      <Text style={styles.reviewAvatarText}>{authorName.charAt(0)}</Text>
                    </View>
                    <View style={styles.reviewInfo}>
                      <Text style={styles.reviewAuthor}>{authorName}</Text>
                      <View style={styles.reviewMeta}>
                        <StarRow rating={review.rating} size={12} />
                        <Text style={styles.reviewDate}>{dateStr}</Text>
                      </View>
                    </View>
                  </View>
                  {review.comment ? <Text style={styles.reviewText}>{review.comment}</Text> : null}
                </View>
              );
            })}
          </View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Modal de avaliação */}
      <Modal
        visible={showReviewModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowReviewModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Avaliar instrutor</Text>
              <TouchableOpacity onPress={() => setShowReviewModal(false)}>
                <Ionicons name="close" size={22} color="#6B7280" />
              </TouchableOpacity>
            </View>
            <Text style={styles.modalInstructorName}>{instructor.name}</Text>

            {/* Star selector */}
            <View style={styles.starSelector}>
              {[1, 2, 3, 4, 5].map(star => (
                <TouchableOpacity key={star} onPress={() => setReviewRating(star)} activeOpacity={0.7}>
                  <Ionicons
                    name={star <= reviewRating ? 'star' : 'star-outline'}
                    size={36}
                    color="#EAB308"
                  />
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.ratingLabel}>
              {['', 'Ruim', 'Regular', 'Bom', 'Muito bom', 'Excelente'][reviewRating]}
            </Text>

            {/* Comment */}
            <TextInput
              style={styles.commentInput}
              placeholder="Deixe um comentário (opcional)"
              placeholderTextColor="#9CA3AF"
              value={reviewComment}
              onChangeText={setReviewComment}
              multiline
              numberOfLines={3}
              maxLength={300}
            />

            <TouchableOpacity
              style={[styles.submitBtn, reviewSubmitting && { opacity: 0.6 }]}
              onPress={handleSubmitReview}
              disabled={reviewSubmitting}
              activeOpacity={0.85}
            >
              <Ionicons name="checkmark-circle-outline" size={18} color="#FFF" />
              <Text style={styles.submitBtnText}>
                {reviewSubmitting ? 'Enviando...' : 'Enviar avaliação'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Schedule CTA */}
      {instructor.isAcceptingRequests === false ? (
        <View style={[styles.footer, styles.footerPaused]}>
          <Ionicons name="pause-circle-outline" size={20} color="#9CA3AF" />
          <Text style={styles.footerPausedText}>
            Este instrutor não está aceitando novos pedidos no momento.
          </Text>
        </View>
      ) : (
        <View style={styles.footer}>
          <View style={styles.footerBottom}>
            <View style={styles.footerInfo}>
              {activePurchase && usePlan ? (
                <>
                  <View style={styles.footerPlanBadge}>
                    <Ionicons name="layers" size={11} color="#7C3AED" />
                    <Text style={styles.footerPlanBadgeText}>Plano</Text>
                  </View>
                  <Text style={styles.footerSlots}>
                    {selectedSlots.length > 0
                      ? `${selectedSlots.length} horário${selectedSlots.length > 1 ? 's' : ''} • ${activePurchase.classes_remaining - 1 >= 0 ? activePurchase.classes_remaining - 1 : 0} aulas restam`
                      : `${activePurchase.classes_remaining} aulas disponíveis`}
                  </Text>
                </>
              ) : (
                <>
                  <Text style={styles.footerPrice}>R$ {instructor.pricePerHour}/h</Text>
                  <Text style={styles.footerSlots}>
                    {selectedSlots.length > 0
                      ? `${selectedSlots.length} horário${selectedSlots.length > 1 ? 's' : ''} selecionado${selectedSlots.length > 1 ? 's' : ''}`
                      : 'Selecione horários'}
                  </Text>
                </>
              )}
            </View>

            <TouchableOpacity
              style={[
                styles.scheduleBtn,
                selectedSlots.length === 0 && styles.scheduleBtnDisabled,
                activePurchase && usePlan && styles.scheduleBtnPlan,
              ]}
              onPress={handleSchedule}
              activeOpacity={0.85}
            >
              <Ionicons name="calendar-outline" size={18} color="#FFF" />
              <Text style={styles.scheduleBtnText}>
                {activePurchase && usePlan ? 'Agendar pelo Plano' : 'Solicitar Aula'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* ── Modal RENACH ── */}
      <Modal
        visible={showRenachModal}
        animationType="fade"
        transparent
        onRequestClose={() => { setShowRenachModal(false); setPendingScheduleAfterRenach(false); }}
      >
        <View style={styles.renachOverlay}>
          <View style={styles.renachModal}>
            <View style={styles.renachModalHeader}>
              <Ionicons name="document-text-outline" size={28} color={PRIMARY} />
              <Text style={styles.renachModalTitle}>Código RENACH necessário</Text>
            </View>
            <Text style={styles.renachModalDesc}>
              Para agendar aulas práticas você precisa ter concluído as aulas teóricas no CNH Brasil e informar o seu código RENACH.
            </Text>
            <Text style={styles.renachModalLabel}>RENACH</Text>
            <TextInput
              style={[styles.renachInput, renachError ? { borderColor: '#EF4444' } : {}]}
              placeholder="Ex: SP123456789"
              placeholderTextColor="#9CA3AF"
              value={renachInput}
              onChangeText={v => { setRenachInput(v.toUpperCase()); setRenachError(''); }}
              autoCapitalize="characters"
              maxLength={11}
            />
            {renachError ? (
              <Text style={styles.renachInputError}>{renachError}</Text>
            ) : (
              <Text style={styles.renachInputHint}>2 letras (UF) + 9 dígitos. Ex: SP123456789</Text>
            )}
            <View style={styles.renachModalActions}>
              <TouchableOpacity
                style={styles.renachCancelBtn}
                onPress={() => { setShowRenachModal(false); setPendingScheduleAfterRenach(false); setRenachInput(''); setRenachError(''); }}
                activeOpacity={0.8}
              >
                <Text style={styles.renachCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.renachConfirmBtn, renachSaving && { opacity: 0.7 }]}
                onPress={handleSaveRenach}
                disabled={renachSaving}
                activeOpacity={0.85}
              >
                <Text style={styles.renachConfirmText}>
                  {renachSaving ? 'Salvando...' : 'Confirmar'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F9FAFB' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
  },
  backBtn: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '800', color: '#111827' },

  scroll: { flex: 1 },

  hero: {
    backgroundColor: '#FFF', padding: 20,
    flexDirection: 'row', alignItems: 'flex-start', gap: 14,
    borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
  },
  heroPhotoFlex: { flexShrink: 0 },
  heroInfo: { flex: 1, gap: 6 },
  heroNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  heroName: { fontSize: 20, fontWeight: '800', color: '#111827' },
  verifiedBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#F0FDF4', borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2 },
  verifiedText: { fontSize: 11, fontWeight: '700', color: '#16A34A' },
  heroRatingRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  heroRating: { fontSize: 14, fontWeight: '700', color: '#374151' },
  heroReviews: { fontSize: 12, color: '#9CA3AF' },
  heroMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  catBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  catText: { fontSize: 11, fontWeight: '700' },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 3, flex: 1 },
  locationText: { fontSize: 11, color: '#9CA3AF', flex: 1 },

  infoGrid: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#FFF', marginHorizontal: 16, marginTop: 12, borderRadius: 16, padding: 16,
    ...makeShadow('#000', 2, 0.06, 6, 3),
  },
  infoItem: { flex: 1, alignItems: 'center', gap: 3 },
  infoValue: { fontSize: 14, fontWeight: '800', color: '#111827', textAlign: 'center' },
  infoLabel: { fontSize: 10, color: '#9CA3AF', fontWeight: '600' },
  infoDivider: { width: 1, height: 36, backgroundColor: '#E5E7EB' },
  headerChatBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: '#16A34A',
    alignItems: 'center', justifyContent: 'center',
  },

  vehicleTypeBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    alignSelf: 'center', marginTop: 10, marginBottom: 2,
    backgroundColor: '#EFF6FF', borderRadius: 20,
    paddingHorizontal: 12, paddingVertical: 5,
    borderWidth: 1, borderColor: '#BFDBFE',
  },
  vehicleTypeText: { fontSize: 12, fontWeight: '600', color: PRIMARY },

  // Veículos — card único compacto
  vehicleSection: {
    flexDirection: 'row', backgroundColor: '#FFF',
    marginHorizontal: 16, marginTop: 10, borderRadius: 14,
    padding: 14, gap: 0,
    ...makeShadow('#000', 2, 0.05, 5, 2),
  },
  vehicleCol: { flex: 1, gap: 3 },
  vehicleColHeader: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 4 },
  vehicleColTitle: { fontSize: 12, fontWeight: '700', color: '#374151' },
  vehicleColMain: { fontSize: 14, fontWeight: '700', color: '#111827' },
  vehicleColSub: { fontSize: 11, color: '#9CA3AF' },
  vehicleColDivider: { width: 1, backgroundColor: '#E5E7EB', marginHorizontal: 14 },
  vehicleTypePill: {
    backgroundColor: '#EFF6FF', borderRadius: 6,
    paddingHorizontal: 6, paddingVertical: 1,
  },
  vehicleTypePillText: { fontSize: 10, fontWeight: '600', color: PRIMARY },

  // Seletor de categoria — cards grandes dentro do "Agendar aula"
  catPickerSection: { marginBottom: 16 },
  catPickerSectionLabel: { fontSize: 13, fontWeight: '700', color: '#374151', marginBottom: 10 },
  catPickerCards: { flexDirection: 'row', gap: 10 },
  catPickerCard: {
    flex: 1, alignItems: 'center', gap: 4,
    backgroundColor: '#F9FAFB', borderRadius: 14, padding: 16,
    borderWidth: 2, borderColor: '#E5E7EB',
  },
  catPickerCardLabel: { fontSize: 15, fontWeight: '800', color: '#6B7280' },
  catPickerCardCat: { fontSize: 11, color: '#9CA3AF', fontWeight: '600' },
  catPickerCardPrice: { fontSize: 13, fontWeight: '700', color: '#9CA3AF', marginTop: 2 },

  section: {
    backgroundColor: '#FFF', marginHorizontal: 16, marginTop: 12, borderRadius: 16,
    padding: 16,
    ...makeShadow('#000', 2, 0.06, 6, 3),
  },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: '#111827', marginBottom: 4 },
  sectionSub: { fontSize: 12, color: '#9CA3AF', marginBottom: 12 },

  // Class type toggle (plano vs avulsa)
  classTypeSelector: {
    flexDirection: 'row', gap: 8, marginBottom: 16, marginTop: 8,
  },
  classTypeOption: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#F3F4F6', borderRadius: 12, padding: 12,
    borderWidth: 1.5, borderColor: 'transparent',
  },
  classTypeOptionActive: {
    backgroundColor: '#FAF5FF', borderColor: '#DDD6FE',
  },
  classTypeOptionAvulsa: {
    backgroundColor: '#EFF6FF', borderColor: '#BFDBFE',
  },
  classTypeLabel: { fontSize: 13, fontWeight: '700', color: '#6B7280' },
  classTypeLabelActive: { color: '#5B21B6' },
  classTypeLabelAvulsa: { color: PRIMARY },
  classTypeSub: { fontSize: 11, color: '#9CA3AF', marginTop: 1 },
  classTypeSubActive: { color: '#7C3AED' },
  classTypeSubAvulsa: { color: '#2563EB' },
  bioText: { fontSize: 14, color: '#374151', lineHeight: 21 },

  // Active plan section
  activePlanSection: {
    marginHorizontal: 16, marginTop: 20, marginBottom: 4,
  },
  activePlanSectionHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 8,
  },
  activePlanSectionLabel: {
    fontSize: 12, fontWeight: '700', color: '#7C3AED',
    textTransform: 'uppercase', letterSpacing: 0.5,
  },
  activePlanBanner: {
    backgroundColor: '#FAF5FF',
    borderRadius: 16, padding: 16, gap: 14,
    borderWidth: 1.5, borderColor: '#DDD6FE',
  },
  activePlanTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  activePlanIconBox: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: '#EDE9FE', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  activePlanTitle: { fontSize: 14, fontWeight: '800', color: '#5B21B6', marginBottom: 6 },
  activePlanRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  activePlanChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#DCFCE7', borderRadius: 8,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  activePlanChipText: { fontSize: 12, fontWeight: '700', color: '#16A34A' },
  activePlanSub: { fontSize: 12, color: '#7C3AED' },
  activePlanProgress: { gap: 6 },
  activePlanProgressBar: {
    height: 6, borderRadius: 3, backgroundColor: '#EDE9FE', overflow: 'hidden',
  },
  activePlanProgressFill: {
    height: '100%', backgroundColor: '#7C3AED', borderRadius: 3,
  },
  activePlanProgressText: { fontSize: 11, color: '#7C3AED', fontWeight: '600', textAlign: 'right' },

  // Plans
  planCard: {
    borderTopWidth: 1, borderTopColor: '#F3F4F6', paddingTop: 14, marginTop: 14, gap: 10,
  },
  planCardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  planIconBox: {
    width: 40, height: 40, borderRadius: 12, backgroundColor: `#1D4ED815`,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  planName: { fontSize: 14, fontWeight: '800', color: '#111827' },
  planDesc: { fontSize: 12, color: '#6B7280', lineHeight: 17, marginTop: 2 },
  discountBadge: { backgroundColor: '#16A34A', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, alignSelf: 'flex-start' },
  discountBadgeText: { fontSize: 11, fontWeight: '800', color: '#FFF' },
  planChipsRow: { flexDirection: 'row', gap: 6 },
  planChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#EFF6FF', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4,
  },
  planChipText: { fontSize: 11, fontWeight: '700', color: '#1D4ED8' },
  planFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 },
  planPrice: { fontSize: 18, fontWeight: '800', color: '#111827' },
  planPriceSub: { fontSize: 11, color: '#9CA3AF', marginTop: 1 },
  planContractBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#1D4ED8', borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 10,
    ...makeShadow('#1D4ED8', 3, 0.25, 6, 4),
  },
  planContractBtnText: { color: '#FFF', fontSize: 13, fontWeight: '700' },

  // Car selector
  carSelector: { marginBottom: 14 },
  carSelectorLabel: { fontSize: 12, fontWeight: '700', color: '#374151', marginBottom: 8 },
  carChipRow: { flexDirection: 'row', gap: 8 },
  carChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderWidth: 1.5, borderColor: '#E5E7EB', borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 8, backgroundColor: '#F9FAFB',
  },
  carChipActive: { backgroundColor: PRIMARY, borderColor: PRIMARY },
  carChipText: { fontSize: 12, fontWeight: '600', color: '#6B7280' },
  carChipTextActive: { color: '#FFF' },
  carInfoRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#EFF6FF', borderRadius: 10, padding: 10, marginBottom: 14,
  },
  carInfoText: { fontSize: 12, color: PRIMARY, fontWeight: '600', flex: 1 },

  meetingSection: { marginBottom: 14 },
  meetingChipRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginBottom: 8 },
  carChipDisabled: { backgroundColor: '#F3F4F6', borderColor: '#E5E7EB', opacity: 0.6 },
  carChipTextDisabled: { color: '#D1D5DB' },
  meetingAddressRow: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 6,
    backgroundColor: '#EFF6FF', borderRadius: 10, padding: 10,
  },
  meetingAddressText: { fontSize: 12, color: PRIMARY, fontWeight: '500', flex: 1, lineHeight: 18 },
  meetingCustomRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  meetingCustomInput: {
    flex: 1, borderWidth: 1.5, borderColor: '#E5E7EB', borderRadius: 10, padding: 10,
    fontSize: 13, color: '#111827',
  },
  geocodeBtn: {
    backgroundColor: PRIMARY, borderRadius: 10, width: 38, height: 38,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  geocodeSuccess: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    marginTop: 6, paddingHorizontal: 4,
  },
  geocodeSuccessText: { fontSize: 12, fontWeight: '600', color: '#16A34A' },
  meetingMapPreview: { height: 160, borderRadius: 12, overflow: 'hidden', marginTop: 12 },

  reviewsSectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  reviewBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: PRIMARY, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 6,
  },
  reviewBtnText: { fontSize: 12, fontWeight: '700', color: '#FFF' },

  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalBox: {
    backgroundColor: '#FFF', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, paddingBottom: 40,
  },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  modalTitle: { fontSize: 18, fontWeight: '800', color: '#111827' },
  modalInstructorName: { fontSize: 13, color: '#6B7280', marginBottom: 20 },
  starSelector: { flexDirection: 'row', gap: 8, justifyContent: 'center', marginBottom: 8 },
  ratingLabel: { textAlign: 'center', fontSize: 14, fontWeight: '700', color: '#374151', marginBottom: 20, height: 20 },
  commentInput: {
    borderWidth: 1.5, borderColor: '#E5E7EB', borderRadius: 12,
    padding: 12, fontSize: 14, color: '#111827',
    minHeight: 80, textAlignVertical: 'top', marginBottom: 16,
  },
  submitBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: PRIMARY, borderRadius: 14, paddingVertical: 14,
    ...makeShadow(PRIMARY, 4, 0.25, 8, 6),
  },
  submitBtnText: { fontSize: 15, fontWeight: '700', color: '#FFF' },

  reviewCard: {
    borderTopWidth: 1, borderTopColor: '#F3F4F6', paddingTop: 12, marginTop: 12,
  },
  reviewHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  reviewAvatar: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: `${PRIMARY}20`, alignItems: 'center', justifyContent: 'center',
  },
  reviewAvatarText: { fontSize: 16, fontWeight: '800', color: PRIMARY },
  reviewInfo: { flex: 1 },
  reviewAuthor: { fontSize: 14, fontWeight: '700', color: '#111827' },
  reviewMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 },
  reviewDate: { fontSize: 11, color: '#9CA3AF' },
  reviewText: { fontSize: 13, color: '#6B7280', lineHeight: 19 },

  footer: {
    flexDirection: 'column',
    paddingHorizontal: 20, paddingTop: 12, paddingBottom: Platform.OS === 'ios' ? 14 : 14,
    backgroundColor: '#FFF', borderTopWidth: 1, borderTopColor: '#F3F4F6',
    ...makeShadow('#000', -2, 0.06, 8, 8),
  },
  footerBottom: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  footerInfo: { flex: 1 },
  footerPrice: { fontSize: 20, fontWeight: '800', color: PRIMARY },
  footerSlots: { fontSize: 12, color: '#9CA3AF', marginTop: 2 },
  scheduleBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: PRIMARY, borderRadius: 14,
    paddingHorizontal: 20, paddingVertical: 14,
    ...makeShadow(PRIMARY, 4, 0.3, 8, 6),
  },
  scheduleBtnDisabled: { opacity: 0.5 },
  scheduleBtnPlan: { backgroundColor: '#7C3AED' },
  catPickerRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 4, marginBottom: 10, flexWrap: 'wrap', minHeight: 32,
  },
  catPickerLabel: { fontSize: 12, fontWeight: '700', color: '#6B7280' },
  catPickerChip: {
    paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20,
    borderWidth: 1.5, borderColor: '#BFDBFE', backgroundColor: '#EFF6FF',
  },
  catPickerChipActive: { backgroundColor: PRIMARY, borderColor: PRIMARY },
  catPickerChipText: { fontSize: 13, fontWeight: '700', color: PRIMARY },
  scheduleBtnText: { color: '#FFF', fontSize: 15, fontWeight: '700' },
  footerPlanBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#EDE9FE', borderRadius: 6,
    paddingHorizontal: 7, paddingVertical: 2, alignSelf: 'flex-start', marginBottom: 4,
  },
  footerPlanBadgeText: { fontSize: 10, fontWeight: '700', color: '#7C3AED' },
  footerPaused: { flexDirection: 'row', alignItems: 'center', gap: 10, justifyContent: 'center' },
  footerPausedText: { flex: 1, fontSize: 13, color: '#6B7280', lineHeight: 18 },

  // Modal RENACH
  renachOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center', alignItems: 'center', padding: 24,
  },
  renachModal: {
    backgroundColor: '#FFF', borderRadius: 20, padding: 24, width: '100%', maxWidth: 400,
    ...makeShadow('#000', 20, 0.15, 24, 8),
  },
  renachModalHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  renachModalTitle: { fontSize: 17, fontWeight: '800', color: '#111827', flex: 1 },
  renachModalDesc: { fontSize: 14, color: '#6B7280', lineHeight: 21, marginBottom: 20 },
  renachModalLabel: { fontSize: 13, fontWeight: '700', color: '#374151', marginBottom: 6 },
  renachInput: {
    borderWidth: 1.5, borderColor: '#E5E7EB', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 10,
    fontSize: 15, color: '#111827', fontWeight: '600', letterSpacing: 1,
  },
  renachInputError: { fontSize: 12, color: '#EF4444', marginTop: 6 },
  renachInputHint: { fontSize: 12, color: '#9CA3AF', marginTop: 6 },
  renachModalActions: { flexDirection: 'row', gap: 10, marginTop: 24 },
  renachCancelBtn: {
    flex: 1, paddingVertical: 13, borderRadius: 12,
    borderWidth: 1.5, borderColor: '#E5E7EB',
    alignItems: 'center',
  },
  renachCancelText: { fontSize: 14, fontWeight: '700', color: '#6B7280' },
  renachConfirmBtn: {
    flex: 1, paddingVertical: 13, borderRadius: 12,
    backgroundColor: PRIMARY, alignItems: 'center',
  },
  renachConfirmText: { fontSize: 14, fontWeight: '700', color: '#FFF' },
});
