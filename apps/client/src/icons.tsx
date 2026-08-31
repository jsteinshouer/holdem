// Authored icon set. One family, 24px box, 1.75 stroke, currentColor, round
// caps — drawn rather than borrowed from a font or a unicode glyph so the whole
// set stays consistent at every size and inherits ink from its context.

type IconProps = { className?: string | undefined };

function Icon({ children, className }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      focusable="false"
      height="20"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.75"
      viewBox="0 0 24 24"
      width="20"
    >
      {children}
    </svg>
  );
}

export function SunIcon({ className }: IconProps) {
  return (
    <Icon className={className}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </Icon>
  );
}

export function MoonIcon({ className }: IconProps) {
  return (
    <Icon className={className}>
      <path d="M20 14.5A8.2 8.2 0 0 1 9.5 4a8.3 8.3 0 1 0 10.5 10.5Z" />
    </Icon>
  );
}

export function CopyIcon({ className }: IconProps) {
  return (
    <Icon className={className}>
      <rect height="12" rx="2" width="12" x="8" y="8" />
      <path d="M5 15.5A2 2 0 0 1 4 14V5a2 2 0 0 1 2-2h9a2 2 0 0 1 1.5.7" />
    </Icon>
  );
}

export function CheckIcon({ className }: IconProps) {
  return (
    <Icon className={className}>
      <path d="m4 12.5 5.2 5L20 6.5" />
    </Icon>
  );
}

export function CloseIcon({ className }: IconProps) {
  return (
    <Icon className={className}>
      <path d="m6 6 12 12M18 6 6 18" />
    </Icon>
  );
}

export function SendIcon({ className }: IconProps) {
  return (
    <Icon className={className}>
      <path d="M4.5 12 20 4.5 15 20l-3.4-6.1L4.5 12Z" />
    </Icon>
  );
}

export function HelpIcon({ className }: IconProps) {
  return (
    <Icon className={className}>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.5 9.5a2.6 2.6 0 0 1 5 .8c0 1.8-2.5 2.1-2.5 3.9" />
      <path d="M12 17.4h.01" />
    </Icon>
  );
}

export function DealerIcon({ className }: IconProps) {
  return (
    <Icon className={className}>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.5 8.2h2.2a3.8 3.8 0 0 1 0 7.6H9.5Z" />
    </Icon>
  );
}
