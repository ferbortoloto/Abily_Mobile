import { supabase } from '../lib/supabase';

/**
 * Cria um pagamento Asaas para um plano e retorna os dados do pagamento
 * (QR code PIX, linha digitável do boleto, etc.) junto com a purchase criada.
 *
 * @param {object} params
 * @param {string} params.planId
 * @param {string} params.instructorId
 * @param {string} params.studentId
 * @param {'pix'|'boleto'|'credit_card'} params.paymentMethod
 * @returns {{ purchase: object, payment: object }}
 */
export async function createPayment({ planId, instructorId, studentId, paymentMethod, creditCardData }) {
  const { data, error } = await supabase.functions.invoke('create-payment', {
    body: {
      plan_id:          planId,
      instructor_id:    instructorId,
      student_id:       studentId,
      payment_method:   paymentMethod,
      credit_card_data: creditCardData || undefined,
    },
  });

  if (error) throw error;
  if (data?.error) throw new Error(data.error);

  return data; // { purchase, payment }
}
