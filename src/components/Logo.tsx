import Image from "next/image";

interface LogoProps {
  size?: "sm" | "md" | "lg" | "hero";
  className?: string;
}

const sizes = {
  sm:   { width: 120, height: 48  },
  md:   { width: 180, height: 72  },
  lg:   { width: 260, height: 104 },
  hero: { width: 480, height: 192 },
};

export function Logo({ size = "md", className }: LogoProps) {
  const s = sizes[size];
  return (
    <Image
      src="/logo-impulsa.png"
      alt="IMPULSA — Alquimistas del Marketing"
      width={s.width}
      height={s.height}
      className={`select-none ${className ?? ""}`}
      priority={size === "hero"}
    />
  );
}
