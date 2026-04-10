export function isDefined<T>(value: T | null | undefined): value is T {
  return value !== undefined && value !== null;
}

export function shouldBeUnreachable(value: never) {
  return value;
}

export function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function clearObject(obj: Record<string, unknown> | object) {
  return Object.fromEntries(
    Object.entries(obj).filter(([_, v]) => {
      if (!isDefined(v)) {
        return false;
      }

      if (v === '') {
        return false;
      }

      if (Array.isArray(v)) {
        return v.length > 0;
      }

      return true;
    }),
  );
}

export function toRange(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
