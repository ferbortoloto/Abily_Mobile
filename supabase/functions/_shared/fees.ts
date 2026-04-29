/**
 * Taxa da plataforma degradante: R$80→20%, −1% a cada R$10, mínimo 10%.
 * Fonte única de verdade — importada por todas as Edge Functions e espelhada
 * no ProfileScreen.jsx e na migration 053.
 */
export function getPlatformFeePct(pricePerHour: number): number {
  return Math.max(0.10, 0.20 - Math.floor((pricePerHour - 80) / 10) * 0.01);
}

/**
 * Calcula platformFee e netAmount dado o preço bruto.
 * minFee é calculado pela função chamadora conforme o contexto (método de
 * pagamento, parcelas, etc.).
 */
export function calcInstructorNet(
  grossAmount: number,
  feePct: number,
  minFee: number,
): { platformFee: number; netAmount: number } {
  const platformFee = Math.max(Math.round(grossAmount * feePct * 100) / 100, minFee);
  const netAmount   = Math.round((grossAmount - platformFee) * 100) / 100;
  return { platformFee, netAmount };
}
