function clampByte(value: number) {
  return Math.max(0, Math.min(255, Math.round(value)));
}

export function withAlpha(color: string, opacity: number): string {
  const normalizedOpacity = Math.max(0, Math.min(1, opacity));
  const trimmed = color.trim();

  if (trimmed.startsWith('#')) {
    const hex = trimmed.slice(1);
    const fullHex = hex.length === 3
      ? hex.split('').map((char) => `${char}${char}`).join('')
      : hex;
    if (fullHex.length !== 6) return color;
    const r = parseInt(fullHex.slice(0, 2), 16);
    const g = parseInt(fullHex.slice(2, 4), 16);
    const b = parseInt(fullHex.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${normalizedOpacity})`;
  }

  if (trimmed.startsWith('rgb(')) {
    const values = trimmed
      .slice(4, -1)
      .split(',')
      .map((part) => clampByte(Number(part.trim())));
    if (values.length !== 3) return color;
    return `rgba(${values[0]}, ${values[1]}, ${values[2]}, ${normalizedOpacity})`;
  }

  if (trimmed.startsWith('rgba(')) {
    const values = trimmed
      .slice(5, -1)
      .split(',')
      .map((part) => part.trim());
    if (values.length < 3) return color;
    return `rgba(${values[0]}, ${values[1]}, ${values[2]}, ${normalizedOpacity})`;
  }

  return color;
}
