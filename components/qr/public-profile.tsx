import { CheckCircle2, Phone } from "lucide-react";
import Link from "next/link";

import { Avatar } from "@/components/patients/avatar";
import { primaryButtonClass, secondaryButtonClass } from "@/components/ui/form";
import { formatAge, formatWeight } from "@/lib/format";
import type { PublicPetProfile } from "@/lib/types";

export function PublicProfile({ pet }: { pet: PublicPetProfile }) {
  const phone = pet.owner?.phone?.replace(/\D/g, "") ?? "";
  const whatsappHref = phone
    ? `https://wa.me/${phone}?text=${encodeURIComponent(`Hola, encontré a ${pet.name}.`)}`
    : null;

  return (
    <article className="overflow-hidden rounded-3xl border border-stone-200 bg-white shadow-[0_24px_60px_-36px_rgba(26,19,17,0.45)]">
      <div className="bg-aguara-orange px-6 py-8 text-white">
        <p className="text-sm text-white/80">Perfil Aguará</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">{pet.name}</h1>
        <p className="mt-2 text-sm text-white/85">
          {pet.species}
          {pet.breed ? ` · ${pet.breed}` : ""}
          {pet.sex ? ` · ${pet.sex}` : ""}
        </p>
      </div>

      <div className="space-y-4 px-6 py-6">
        <div className="flex items-center gap-4">
          <Avatar name={pet.name} photoUrl={pet.photo_url} size="lg" />
          <div>
            <p className="text-sm text-stone-500">{formatAge(pet.birth_date)}</p>
            <p className="mt-1 text-sm text-stone-500">{formatWeight(pet.weight_kg)}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          <CheckCircle2 className="size-4 shrink-0" aria-hidden="true" />
          Perfil activo · código {pet.qr_code}
        </div>

        {pet.owner ? (
          <div className="rounded-2xl bg-aguara-mist px-4 py-4">
            <p className="text-sm font-medium text-aguara-ink">Tutor: {pet.owner.full_name}</p>
            {pet.owner.phone ? (
              <p className="mt-2 flex items-center gap-2 text-sm text-stone-600">
                <Phone className="size-4" aria-hidden="true" />
                {pet.owner.phone}
              </p>
            ) : null}
            {pet.owner.email ? (
              <p className="mt-1 text-sm text-stone-600">{pet.owner.email}</p>
            ) : null}
          </div>
        ) : null}

        <div className="flex flex-col gap-3 sm:flex-row">
          {whatsappHref ? (
            <a
              href={whatsappHref}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-emerald-600 px-5 text-sm font-medium text-white transition hover:bg-emerald-700"
            >
              Contactar por WhatsApp
            </a>
          ) : null}
          {pet.owner?.phone ? (
            <a href={`tel:${pet.owner.phone}`} className={secondaryButtonClass}>
              Llamar
            </a>
          ) : null}
        </div>

        <Link href="/" className={`${primaryButtonClass} w-full sm:w-auto`}>
          Ir a Aguará App
        </Link>
      </div>
    </article>
  );
}
