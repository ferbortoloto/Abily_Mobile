import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, TextInput, Modal, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AvailabilityViewer from '../../components/user/AvailabilityViewer';
import Avatar from '../../components/shared/Avatar';
import { usePlans } from '../../context/PlansContext';
import { useAuth } from '../../hooks/useAuth';
import { useSchedule } from '../../context/ScheduleContext';
import { getReviews, createReview } from '../../services/instructors.service';
import { logger } from '../../utils/logger';
import { MeetingPointType } from '../../data/scheduleData';
import { geocodeAddress } from '../../utils/geocoding';
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
  const { instructor } = route.params;
  const { getActivePlans, getUserPurchases } = usePlans();
  const { user } = useAuth();
  const { addRequest, events } = useSchedule();
  const [selectedSlots, setSelectedSlots] = useState([]);
  const [selectedDate, setSelectedDate] = useState(null);
  const [carChoice, setCarChoice] = useState(
    instructor.carOptions === 'student' ? 'student' : 'instructor',
  );
  const [meetingType, setMeetingType] = useState(
    user?.address ? MeetingPointType.STUDENT_HOME : MeetingPointType.INSTRUCTOR_LOCATION
  );
  const [customAddress, setCustomAddress] = useState('');
  const [customCoordinates, setCustomCoordinates] = useState(null);
  const [geocoding, setGeocoding] = useState(false);
  const [reviews, setReviews] = useState([]);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [reviewSubmitting, setReviewSubmitting] = useState(false);

  useEffect(() => {
    getReviews(instructor.id)
      .then(data => setReviews(data))
      .catch(e => logger.error('Erro ao carregar avaliações:', e.message));
  }, [instructor.id]);

  const hasCompletedClass = events.some(
    e => (e.type === 'class' || e.type === 'CLASS') &&
         e.instructorId === instructor.id &&
         e.status === 'completed'
  );
  const alreadyReviewed = reviews.some(r => r.student_id === user?.id);
  const canReview = hasCompletedClass && !alreadyReviewed;

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

  const catColor = instructor.licenseCategory === 'A' ? '#EA580C' : '#2563EB';

  const getMeetingPointLabel = () => {
    if (meetingType === MeetingPointType.STUDENT_HOME) return user?.address || 'Minha casa';
    if (meetingType === MeetingPointType.INSTRUCTOR_LOCATION) return instructor.location || 'Local do instrutor';
    return customAddress || 'Local personalizado';
  };

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

  const handleSchedule = async () => {
    if (selectedSlots.length === 0) {
      toast.error('Selecione pelo menos um horário disponível.');
      return;
    }
    if (meetingType === MeetingPointType.CUSTOM && !customAddress.trim()) {
      toast.error('Informe o endereço do local de encontro.');
      return;
    }

    const meetingAddress = getMeetingPointLabel();
    const meetingCoordinates =
      meetingType === MeetingPointType.STUDENT_HOME ? user?.coordinates ?? null
      : meetingType === MeetingPointType.INSTRUCTOR_LOCATION ? instructor.coordinates ?? null
      : customCoordinates;

    try {
      const requestData = {
        instructor_id: instructor.id,
        type: 'Aula Prática',
        car_option: carChoice,
        meeting_point: {
          type: meetingType,
          address: meetingAddress,
          coordinates: meetingCoordinates,
        },
        requested_slots: selectedSlots,
        requested_date: selectedDate ? selectedDate.toISOString().split('T')[0] : null,
        ...(activePurchase?.id ? { purchase_id: activePurchase.id } : {}),
      };

      await addRequest(requestData);
      toast.success(`Solicitação enviada para ${instructor.name}! Aguarde a confirmação.`);
      navigation.goBack();
    } catch (e) {
      logger.error('Erro ao criar solicitação:', e.message);
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
        <View style={{ width: 38 }} />
      </View>

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Hero section */}
        <View style={styles.hero}>
          <Avatar uri={instructor.photo} name={instructor.name} size={80} style={styles.heroPhotoFlex} />
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
              <View style={[styles.catBadge, { backgroundColor: `${catColor}20` }]}>
                <Text style={[styles.catText, { color: catColor }]}>Categoria {instructor.licenseCategory}</Text>
              </View>
              <View style={styles.locationRow}>
                <Ionicons name="location-outline" size={12} color="#9CA3AF" />
                <Text style={styles.locationText} numberOfLines={1}>{instructor.location}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Price + Car card */}
        <View style={styles.infoGrid}>
          <View style={styles.infoItem}>
            <Ionicons name="cash-outline" size={20} color={PRIMARY} />
            <Text style={styles.infoValue}>R$ {instructor.pricePerHour}</Text>
            <Text style={styles.infoLabel}>por hora</Text>
          </View>
          <View style={styles.infoDivider} />
          <View style={styles.infoItem}>
            {instructor.carOptions === 'student' ? (
              <>
                <Ionicons name="car-sport-outline" size={20} color="#2563EB" />
                <Text style={[styles.infoValue, { color: '#2563EB' }]} numberOfLines={1}>Carro do aluno</Text>
                <Text style={styles.infoLabel}>veículo</Text>
              </>
            ) : (
              <>
                <Ionicons name="car-outline" size={20} color="#2563EB" />
                <Text style={styles.infoValue} numberOfLines={1}>
                  {[instructor.carModel, instructor.carYear].filter(Boolean).join(' ') || '—'}
                </Text>
                <Text style={styles.infoLabel}>veículo</Text>
              </>
            )}
          </View>
          <View style={styles.infoDivider} />
          <View style={styles.infoItem}>
            <Ionicons name="star" size={20} color="#EAB308" />
            <Text style={styles.infoValue}>{instructor.rating.toFixed(1)}</Text>
            <Text style={styles.infoLabel}>avaliação</Text>
          </View>
        </View>

        {/* Vehicle type badge */}
        {instructor.vehicleType && (
          <View style={styles.vehicleTypeBadge}>
            <Ionicons
              name={VEHICLE_TYPE_ICON[instructor.vehicleType] || 'car-outline'}
              size={14}
              color={PRIMARY}
            />
            <Text style={styles.vehicleTypeText}>
              Câmbio {VEHICLE_TYPE_LABEL[instructor.vehicleType] || instructor.vehicleType}
            </Text>
          </View>
        )}

        {/* Bio */}
        {instructor.bio && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Sobre o Instrutor</Text>
            <Text style={styles.bioText}>{instructor.bio}</Text>
          </View>
        )}

        {/* Banner: plano ativo do aluno com este instrutor */}
        {activePurchase && (
          <View style={styles.activePlanBanner}>
            <View style={styles.activePlanLeft}>
              <View style={styles.activePlanIconBox}>
                <Ionicons name="layers" size={22} color="#7C3AED" />
              </View>
              <View>
                <Text style={styles.activePlanTitle}>
                  {activePurchase.plans?.name || 'Seu Plano Ativo'}
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
            <View style={styles.activePlanProgress}>
              <View style={styles.activePlanProgressBar}>
                <View style={[styles.activePlanProgressFill, {
                  width: `${((activePurchase.classes_total - activePurchase.classes_remaining) / activePurchase.classes_total) * 100}%`
                }]} />
              </View>
              <Text style={styles.activePlanProgressText}>
                {activePurchase.classes_total - activePurchase.classes_remaining}/{activePurchase.classes_total} usadas
              </Text>
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
                      <Ionicons name="layers-outline" size={11} color="#EA580C" />
                      <Text style={[styles.planChipText, { color: '#EA580C' }]}>{plan.classType}</Text>
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
          <Text style={styles.sectionTitle}>
            {activePurchase ? 'Agendar aula do plano' : 'Solicitar aula avulsa'}
          </Text>
          <Text style={styles.sectionSub}>
            {activePurchase
              ? `Usando seu plano — ${activePurchase.classes_remaining} aula${activePurchase.classes_remaining !== 1 ? 's' : ''} disponível${activePurchase.classes_remaining !== 1 ? 'is' : ''}`
              : 'Selecione a data e os horários para solicitar uma aula'}
          </Text>

          {/* Car selector */}
          {instructor.carOptions === 'both' ? (
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
            <View style={styles.carInfoRow}>
              <Ionicons name="car-outline" size={13} color={PRIMARY} />
              <Text style={styles.carInfoText}>
                {instructor.carOptions === 'student'
                  ? 'Aula realizada no seu próprio carro'
                  : `Aula no veículo do instrutor${instructor.carModel ? ` (${[instructor.carModel, instructor.carYear].filter(Boolean).join(' ')})` : ''}`}
              </Text>
            </View>
          )}

          {/* Meeting point selector */}
          <View style={styles.meetingSection}>
            <Text style={styles.carSelectorLabel}>Local de encontro</Text>
            <View style={styles.meetingChipRow}>
              {[
                {
                  v: MeetingPointType.STUDENT_HOME,
                  label: 'Minha casa',
                  icon: 'home-outline',
                  disabled: !user?.address,
                },
                {
                  v: MeetingPointType.INSTRUCTOR_LOCATION,
                  label: 'Local do instrutor',
                  icon: 'location-outline',
                  disabled: false,
                },
                {
                  v: MeetingPointType.CUSTOM,
                  label: 'Outro local',
                  icon: 'map-outline',
                  disabled: false,
                },
              ].map(opt => (
                <TouchableOpacity
                  key={opt.v}
                  style={[
                    styles.carChip,
                    meetingType === opt.v && styles.carChipActive,
                    opt.disabled && styles.carChipDisabled,
                  ]}
                  onPress={() => !opt.disabled && setMeetingType(opt.v)}
                  activeOpacity={opt.disabled ? 1 : 0.8}
                >
                  <Ionicons
                    name={opt.icon}
                    size={13}
                    color={
                      opt.disabled ? '#D1D5DB' :
                      meetingType === opt.v ? '#FFF' : '#6B7280'
                    }
                  />
                  <Text style={[
                    styles.carChipText,
                    meetingType === opt.v && styles.carChipTextActive,
                    opt.disabled && styles.carChipTextDisabled,
                  ]}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Show address hint or custom input */}
            {meetingType === MeetingPointType.STUDENT_HOME && user?.address ? (
              <View style={styles.meetingAddressRow}>
                <Ionicons name="location-outline" size={13} color={PRIMARY} />
                <Text style={styles.meetingAddressText} numberOfLines={2}>{user.address}</Text>
              </View>
            ) : meetingType === MeetingPointType.STUDENT_HOME && !user?.address ? (
              <View style={styles.meetingAddressRow}>
                <Ionicons name="information-circle-outline" size={13} color="#9CA3AF" />
                <Text style={[styles.meetingAddressText, { color: '#9CA3AF' }]}>
                  Cadastre seu endereço no perfil para usar esta opção
                </Text>
              </View>
            ) : meetingType === MeetingPointType.INSTRUCTOR_LOCATION ? (
              <View style={styles.meetingAddressRow}>
                <Ionicons name="location-outline" size={13} color={PRIMARY} />
                <Text style={styles.meetingAddressText} numberOfLines={2}>
                  {instructor.location || 'Local informado pelo instrutor'}
                </Text>
              </View>
            ) : (
              <View>
                <View style={styles.meetingCustomRow}>
                  <TextInput
                    style={styles.meetingCustomInput}
                    placeholder="Digite o endereço do local de encontro"
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
          <View style={styles.footerInfo}>
            <Text style={styles.footerPrice}>R$ {instructor.pricePerHour}/h</Text>
            <Text style={styles.footerSlots}>
              {selectedSlots.length > 0
                ? `${selectedSlots.length} horário${selectedSlots.length > 1 ? 's' : ''} selecionado${selectedSlots.length > 1 ? 's' : ''}`
                : 'Selecione horários'}
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.scheduleBtn, selectedSlots.length === 0 && styles.scheduleBtnDisabled]}
            onPress={handleSchedule}
            activeOpacity={0.85}
          >
            <Ionicons name="calendar-outline" size={18} color="#FFF" />
            <Text style={styles.scheduleBtnText}>Solicitar Aula</Text>
          </TouchableOpacity>
        </View>
      )}
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
  vehicleTypeBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    alignSelf: 'center', marginTop: 10, marginBottom: 2,
    backgroundColor: '#EFF6FF', borderRadius: 20,
    paddingHorizontal: 12, paddingVertical: 5,
    borderWidth: 1, borderColor: '#BFDBFE',
  },
  vehicleTypeText: { fontSize: 12, fontWeight: '600', color: PRIMARY },

  section: {
    backgroundColor: '#FFF', marginHorizontal: 16, marginTop: 12, borderRadius: 16,
    padding: 16,
    ...makeShadow('#000', 2, 0.06, 6, 3),
  },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: '#111827', marginBottom: 4 },
  sectionSub: { fontSize: 12, color: '#9CA3AF', marginBottom: 12 },
  bioText: { fontSize: 14, color: '#374151', lineHeight: 21 },

  // Active plan banner
  activePlanBanner: {
    marginHorizontal: 16, marginBottom: 16,
    backgroundColor: '#FAF5FF',
    borderRadius: 16, padding: 16,
    borderWidth: 1.5, borderColor: '#DDD6FE',
  },
  activePlanLeft: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 12 },
  activePlanIconBox: {
    width: 44, height: 44, borderRadius: 12,
    backgroundColor: '#EDE9FE', alignItems: 'center', justifyContent: 'center',
  },
  activePlanTitle: { fontSize: 15, fontWeight: '800', color: '#5B21B6', marginBottom: 6 },
  activePlanRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  activePlanChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#DCFCE7', borderRadius: 8,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  activePlanChipText: { fontSize: 12, fontWeight: '700', color: '#16A34A' },
  activePlanSub: { fontSize: 12, color: '#7C3AED' },
  activePlanProgress: { gap: 4 },
  activePlanProgressBar: {
    height: 6, borderRadius: 3, backgroundColor: '#EDE9FE', overflow: 'hidden',
  },
  activePlanProgressFill: {
    height: '100%', backgroundColor: '#7C3AED', borderRadius: 3,
  },
  activePlanProgressText: { fontSize: 11, color: '#7C3AED', fontWeight: '600' },

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
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 14,
    paddingBottom: Platform.OS === 'ios' ? 14 : 14,
    backgroundColor: '#FFF', borderTopWidth: 1, borderTopColor: '#F3F4F6',
    ...makeShadow('#000', -2, 0.06, 8, 8),
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
  scheduleBtnText: { color: '#FFF', fontSize: 15, fontWeight: '700' },
  footerPaused: { gap: 10, justifyContent: 'center' },
  footerPausedText: { flex: 1, fontSize: 13, color: '#6B7280', lineHeight: 18 },
});
