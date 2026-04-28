// ── CPF ───────────────────────────────────────────────────────────────────────
export function validateCPF(value) {
  const d = value.replace(/\D/g, '');
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  const calc = (len) => {
    let sum = 0;
    for (let i = 0; i < len; i++) sum += parseInt(d[i]) * (len + 1 - i);
    const rem = (sum * 10) % 11;
    return rem >= 10 ? 0 : rem;
  };
  return calc(9) === parseInt(d[9]) && calc(10) === parseInt(d[10]);
}

// ── CNPJ ──────────────────────────────────────────────────────────────────────
export function validateCNPJ(value) {
  const d = value.replace(/\D/g, '');
  if (d.length !== 14 || /^(\d)\1{13}$/.test(d)) return false;
  const calc = (weights) =>
    weights.reduce((acc, w, i) => acc + parseInt(d[i]) * w, 0) % 11;
  const rem1 = calc([5,4,3,2,9,8,7,6,5,4,3,2]);
  if ((rem1 < 2 ? 0 : 11 - rem1) !== parseInt(d[12])) return false;
  const rem2 = calc([6,5,4,3,2,9,8,7,6,5,4,3,2]);
  return (rem2 < 2 ? 0 : 11 - rem2) === parseInt(d[13]);
}

// ── CPF ou CNPJ ───────────────────────────────────────────────────────────────
export function validateCpfCnpj(value) {
  const d = value.replace(/\D/g, '');
  if (d.length <= 11) return validateCPF(d);
  return validateCNPJ(d);
}

// ── Validade do cartão (MM/AA) ─────────────────────────────────────────────────
export function isExpiryValid(expiry) {
  const [month, yr] = (expiry || '').split('/');
  if (!month || !yr || yr.length !== 2) return false;
  const m = parseInt(month, 10);
  const y = 2000 + parseInt(yr, 10);
  if (m < 1 || m > 12) return false;
  const now = new Date();
  const curY = now.getFullYear();
  const curM = now.getMonth() + 1;
  if (y < curY) return false;
  if (y === curY && m < curM) return false;
  return true;
}
