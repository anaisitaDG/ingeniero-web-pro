import { Logo } from "@/components/Logo";
import { siteConfig } from "@/lib/site-config";

export function Footer() {
  return (
    <footer style={{ background: "#000", borderTop: "1px solid #111" }}>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 px-[clamp(24px,8vw,120px)] py-10">
        <Logo size="sm" />
        <p
          className="font-light text-right"
          style={{ fontSize: "12px", color: "#333" }}
        >
          © {new Date().getFullYear()} {siteConfig.name} —{" "}
          {siteConfig.tagline}
        </p>
      </div>
    </footer>
  );
}
