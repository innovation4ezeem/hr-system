export function currentOperationalYear() {
  return new Date().getFullYear();
}

export function isArchivedYear(year: number) {
  return year < currentOperationalYear();
}

export function assertWritableYear(year: number) {
  if (isArchivedYear(year)) {
    throw new Error(`Year ${year} is archived and read-only`);
  }
}
