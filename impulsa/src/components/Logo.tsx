interface LogoProps {
  size?: "sm" | "md" | "lg" | "hero";
  className?: string;
}

const sizes = {
  sm:   { main: "text-2xl",  sub: "text-[9px]" },
  md:   { main: "text-4xl",  sub: "text-[11px]" },
  lg:   { main: "text-6xl",  sub: "text-[13px]" },
  hero: { main: "text-[clamp(72px,18vw,220px)]", sub: "text-[clamp(10px,1.4vw,18px)]" },
};

export function Logo({ size = "md", className }: LogoProps) {
  const s = sizes[size];
  return (
    <div className={`inline-flex flex-col items-center select-none ${className ?? ""}`}>
      <div
        className={`font-black leading-none tracking-[-0.05em] ${s.main}`}
        aria-label="IMPULSA"
      >
        <span style={{ color: "#E8522B" }}>im</span>
        <span style={{ color: "#7DC9CA" }}>pulsa</span>
      </div>
      {size === "hero" && (
        <div
          className={`font-medium tracking-[0.18em] uppercase mt-[0.25em] ${s.sub}`}
          style={{ color: "#E8522B" }}
        >
          Alquimistas del Marketing
        </div>
      )}
    </div>
  );
}
