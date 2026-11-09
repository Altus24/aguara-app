import Image from "next/image";
import Link from "next/link";

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2.5 text-[15px] font-semibold tracking-tight text-aguara-ink">
      <Image
        src="/logo.png"
        alt=""
        width={40}
        height={40}
        className="size-9 rounded-xl object-cover shadow-sm ring-1 ring-black/10"
        priority
      />
      {compact ? (
        <span className="sr-only">Aguará App</span>
      ) : (
        <span>
          Aguará <span className="font-medium text-stone-500">App</span>
        </span>
      )}
    </span>
  );
}

export function LogoLink({
  href = "/",
  compact = false,
}: {
  href?: "/" | "/pacientes" | "/registrar";
  compact?: boolean;
}) {
  return (
    <Link
      href={href}
      className="rounded-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-aguara-orange"
    >
      <Logo compact={compact} />
    </Link>
  );
}
