import Image from "next/image";
export function Avatar({ src, name, size = 44 }: { src: string; name: string; size?: number }) {
  if (!src) return <span className="avatar inline-grid shrink-0 place-items-center rounded-full bg-[#e9ddcf] font-bold text-[var(--ink)]" role="img" aria-label={name} style={{ width: size, height: size }}>{name.split(/\s+/).slice(0, 2).map(part => part[0]?.toUpperCase()).join("")}</span>;
  return <Image unoptimized className="avatar" src={src} alt={name} width={size} height={size} style={{ width: size, height: size }} />;
}
