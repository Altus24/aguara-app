import { CheckCircle2, Phone } from "lucide-react";
import Image from "next/image";

export function PhonePreview() {
  return (
    <div className="relative mx-auto w-full max-w-[320px]">
      <div
        aria-hidden="true"
        className="absolute -inset-8 -z-10 rounded-[40%] bg-[radial-gradient(circle_at_center,rgba(243,112,33,0.28),transparent_68%)]"
      />
      <div className="overflow-hidden rounded-[2rem] border-[6px] border-aguara-ink bg-white shadow-[0_30px_80px_-28px_rgba(26,19,17,0.55)]">
        <div className="bg-aguara-orange px-5 pb-10 pt-5 text-white">
          <div className="mx-auto mb-4 h-1.5 w-16 rounded-full bg-white/35" />
          <div className="flex items-center gap-3">
            <Image
              src="/logo.png"
              alt=""
              width={36}
              height={36}
              className="size-9 rounded-full object-cover ring-2 ring-white/40"
            />
            <div>
              <p className="text-xs text-white/80">Perfil Aguará</p>
              <p className="text-sm font-semibold">Max</p>
            </div>
          </div>
        </div>

        <div className="-mt-6 space-y-3 px-4 pb-5">
          <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-stone-200">
            <div className="mx-auto grid size-20 place-items-center rounded-full bg-aguara-cream text-2xl font-semibold text-aguara-orange">
              M
            </div>
            <p className="mt-3 text-center text-lg font-semibold text-aguara-ink">Max</p>
            <p className="text-center text-sm text-stone-500">Golden Retriever · 3 años</p>
            <button
              type="button"
              tabIndex={-1}
              className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-full bg-emerald-600 text-sm font-medium text-white"
            >
              Contactar por WhatsApp
            </button>
          </div>

          <div className="flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            <CheckCircle2 className="size-4 shrink-0" aria-hidden="true" />
            Estado de salud: al día
          </div>

          <div className="rounded-xl bg-stone-50 px-3 py-3 text-sm">
            <p className="font-medium text-aguara-ink">Dueño: Laura Gómez</p>
            <p className="mt-1 flex items-center gap-1.5 text-stone-500">
              <Phone className="size-3.5" aria-hidden="true" />
              +54 9 11 5555-1212
            </p>
          </div>

          <div className="rounded-xl border border-stone-200 px-3 py-3 text-sm">
            <p className="font-medium text-aguara-ink">Historial reciente</p>
            <p className="mt-1 text-stone-500">Vacunación · Control anual</p>
          </div>
        </div>
      </div>
    </div>
  );
}
