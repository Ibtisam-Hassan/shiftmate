export const POSITION_SWATCH: Record<string, { cls: string; label: string }> = {
  cashier: { cls: "bg-pos-cashier", label: "Blue" },
  stock: { cls: "bg-pos-stock", label: "Purple" },
  floor: { cls: "bg-pos-floor", label: "Green" },
  supervisor: { cls: "bg-pos-supervisor", label: "Dark" },
};

export function formToRecord(form: FormData) {
  return Object.fromEntries([...form.entries()].map(([k, v]) => [k, String(v)]));
}

export function FieldError({ msg }: { msg?: string }) {
  return msg ? <p className="text-xs text-danger">{msg}</p> : null;
}

