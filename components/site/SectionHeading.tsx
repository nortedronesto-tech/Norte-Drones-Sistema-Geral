export function SectionHeading({
  eyebrow,
  title,
  description,
  align = "left",
  light = false,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  align?: "left" | "center";
  light?: boolean;
}) {
  return (
    <div
      className={`max-w-2xl ${align === "center" ? "mx-auto text-center" : ""}`}
    >
      {eyebrow && (
        <p
          className={`mb-3 text-sm font-semibold uppercase tracking-wide ${
            light ? "text-nd-green-lime" : "text-nd-green"
          }`}
        >
          {eyebrow}
        </p>
      )}
      <h2
        className={`text-3xl font-extrabold leading-tight sm:text-4xl ${
          light ? "text-white" : "text-nd-green-dark"
        }`}
      >
        {title}
      </h2>
      {description && (
        <p
          className={`mt-4 text-base leading-relaxed sm:text-lg ${
            light ? "text-white/80" : "text-nd-graphite/80"
          }`}
        >
          {description}
        </p>
      )}
    </div>
  );
}
