/* Initials avatar circle. Hairline border, paper-sunken fill, ink-2 initials.
 * No photographs anywhere in the brand; initials carry identity. */

type AvatarProps = {
  name: string;
  size?: number;
  className?: string;
};

export function Avatar({ name, size = 28, className }: AvatarProps) {
  const initials = name
    .split(" ")
    .map((s) => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div
      className={`inline-flex items-center justify-center rounded-full bg-paper-sunken border border-rule text-ink-2 font-medium shrink-0 ${className ?? ""}`}
      style={{ width: size, height: size, fontSize: size * 0.42 }}
    >
      {initials}
    </div>
  );
}
