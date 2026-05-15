import { AlertCircle } from "lucide-react";

export function AuthFormErrorAlert({ message }: { message: string }) {
  return (
    <div
      role="alert"
      className="flex gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm leading-relaxed text-red-950"
    >
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-700" strokeWidth={2} aria-hidden />
      <span className="min-w-0 font-medium">{message}</span>
    </div>
  );
}
