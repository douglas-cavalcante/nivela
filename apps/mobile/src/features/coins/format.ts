/** ISO completo vira "10/11/2026" no fuso do aparelho. */
export function formatDate(iso: string): string {
  const date = new Date(iso);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${day}/${month}/${date.getFullYear()}`;
}

/** "+50" para créditos e "−50" (sinal de menos de verdade) para débitos. */
export function formatAmount(amount: number): string {
  return amount < 0 ? `−${Math.abs(amount)}` : `+${amount}`;
}
