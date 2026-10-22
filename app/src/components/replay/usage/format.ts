export const tokens = (value: number | null) =>
  value === null ? "Unavailable" : value.toLocaleString();

export const dollars = (value: number | null) =>
  value === null
    ? "Unavailable"
    : value === 0
      ? "$0.00"
      : value < 0.0001
        ? "<$0.0001"
        : `$${value.toFixed(value < 0.01 ? 6 : 4)}`;
