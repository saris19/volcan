const timeFormatter = new Intl.DateTimeFormat('es-CO', {
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
});

export function formatTime(epochMs: number | bigint): string {
  return timeFormatter.format(new Date(Number(epochMs)));
}

export function formatNumber(value: number, fractionDigits = 1): string {
  return value.toLocaleString('es-CO', { minimumFractionDigits: fractionDigits, maximumFractionDigits: fractionDigits });
}

export function formatInteger(value: number): string {
  return value.toLocaleString('es-CO');
}
