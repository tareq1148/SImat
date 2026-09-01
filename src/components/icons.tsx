// أيقونات التطبيقات — SVG مضمّنة (بدون طلبات خارجية)

export function GmailIcon({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <rect x="2" y="4" width="20" height="16" rx="2" fill="#fff" />
      <path d="M2 6l10 7L22 6v-.5A1.5 1.5 0 0 0 20.5 4h-17A1.5 1.5 0 0 0 2 5.5V6z" fill="#EA4335" />
      <path d="M2 6v12.5A1.5 1.5 0 0 0 3.5 20H5V8.5L2 6z" fill="#4285F4" />
      <path d="M22 6v12.5a1.5 1.5 0 0 1-1.5 1.5H19V8.5L22 6z" fill="#34A853" />
      <path d="M5 8.5 2 6v3l3 2.2V8.5zM19 8.5 22 6v3l-3 2.2V8.5z" fill="#C5221F" />
      <path d="M5 8.5v3.7l7 5.1 7-5.1V8.5l-7 5.1-7-5.1z" fill="#EA4335" opacity="0.15" />
    </svg>
  );
}

export function SheetsIcon({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M6 2h9l5 5v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z" fill="#0F9D58" />
      <path d="M15 2l5 5h-5V2z" fill="#87CEAC" />
      <rect x="7" y="10" width="10" height="8" rx="0.5" fill="#fff" />
      <path d="M7 12.6h10M7 15.3h10M10.3 10v8M13.7 10v8" stroke="#0F9D58" strokeWidth="0.9" />
    </svg>
  );
}

export function DriveIcon({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M8.6 3h6.8l6.3 11h-6.8L8.6 3z" fill="#FFCF48" />
      <path d="M2.3 14 8.6 3l3.4 5.9-6.3 11L2.3 14z" fill="#11A861" />
      <path d="M21.7 14l-3.4 6H7.1l3.4-6h11.2z" fill="#4688F4" />
    </svg>
  );
}

export function OpenAIIcon({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path
        d="M21.55 10.004a5.416 5.416 0 0 0-.478-4.501c-1.217-2.09-3.662-3.166-6.05-2.66A5.59 5.59 0 0 0 10.831 1C8.39.995 6.224 2.546 5.473 4.838A5.553 5.553 0 0 0 1.76 7.496a5.487 5.487 0 0 0 .691 6.5 5.416 5.416 0 0 0 .477 4.502c1.217 2.09 3.662 3.165 6.05 2.66A5.586 5.586 0 0 0 13.168 23c2.443.006 4.61-1.546 5.361-3.84a5.553 5.553 0 0 0 3.715-2.66 5.488 5.488 0 0 0-.693-6.497v.001zm-8.381 11.558a4.199 4.199 0 0 1-2.675-.954c.034-.018.093-.05.132-.074l4.44-2.53a.71.71 0 0 0 .364-.623v-6.176l1.877 1.069c.02.01.033.029.036.05v5.115c-.003 2.274-1.87 4.118-4.174 4.123zM4.192 17.78a4.059 4.059 0 0 1-.498-2.763c.032.02.09.055.131.078l4.44 2.53c.225.13.504.13.73 0l5.42-3.088v2.138a.068.068 0 0 1-.027.057L9.9 19.288c-1.999 1.136-4.552.46-5.707-1.51h-.001zM3.023 8.216A4.15 4.15 0 0 1 5.198 6.41l-.002.151v5.06a.711.711 0 0 0 .364.624l5.42 3.087-1.876 1.07a.067.067 0 0 1-.063.005l-4.489-2.559c-1.995-1.14-2.679-3.658-1.53-5.63h.001zm15.417 3.54-5.42-3.088L14.896 7.6a.067.067 0 0 1 .063-.006l4.489 2.557c1.998 1.14 2.683 3.662 1.529 5.633a4.163 4.163 0 0 1-2.174 1.807V12.38a.71.71 0 0 0-.363-.623zm1.867-2.773a6.04 6.04 0 0 0-.132-.078l-4.44-2.53a.731.731 0 0 0-.729 0l-5.42 3.088V7.325a.068.068 0 0 1 .027-.057L14.1 4.713c2-1.137 4.555-.46 5.707 1.513.487.833.664 1.809.5 2.757h.001zm-11.741 3.81-1.877-1.068a.065.065 0 0 1-.036-.051V6.559c.001-2.277 1.873-4.122 4.181-4.12.976 0 1.92.338 2.671.954-.034.018-.092.05-.131.073l-4.44 2.53a.71.71 0 0 0-.365.623l-.003 6.173v.001zm1.02-2.168L12 9.25l2.414 1.375v2.75L12 14.75l-2.415-1.375v-2.75z"
        fill="#fff"
      />
    </svg>
  );
}

export function TelegramIcon({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" fill="#29A9EB" />
      <path
        d="M17.4 7.2 15.6 16c-.13.6-.5.74-1 .46l-2.77-2.05-1.34 1.3c-.15.14-.27.27-.56.27l.2-2.83 5.15-4.66c.22-.2-.05-.31-.35-.11l-6.37 4.01-2.74-.86c-.6-.19-.6-.6.12-.88l10.7-4.13c.5-.18.93.12.86.68z"
        fill="#fff"
      />
    </svg>
  );
}

export function SlackIcon({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M8.9 2.5a1.9 1.9 0 1 0 0 3.8h1.9V4.4a1.9 1.9 0 0 0-1.9-1.9zM8.9 8.2H4.4a1.9 1.9 0 1 0 0 3.8h4.5a1.9 1.9 0 1 0 0-3.8z" fill="#36C5F0" />
      <path d="M21.5 10.1a1.9 1.9 0 1 0-3.8 0V12h1.9a1.9 1.9 0 0 0 1.9-1.9zM15.8 10.1V5.6a1.9 1.9 0 1 0-3.8 0v4.5a1.9 1.9 0 1 0 3.8 0z" fill="#2EB67D" />
      <path d="M15.1 21.5a1.9 1.9 0 1 0 0-3.8h-1.9v1.9a1.9 1.9 0 0 0 1.9 1.9zM15.1 15.8h4.5a1.9 1.9 0 1 0 0-3.8h-4.5a1.9 1.9 0 1 0 0 3.8z" fill="#ECB22E" />
      <path d="M2.5 13.9a1.9 1.9 0 1 0 3.8 0V12H4.4a1.9 1.9 0 0 0-1.9 1.9zM8.2 13.9v4.5a1.9 1.9 0 1 0 3.8 0v-4.5a1.9 1.9 0 1 0-3.8 0z" fill="#E01E5A" />
    </svg>
  );
}

export function InstagramIcon({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <defs>
        <linearGradient id="igGrad" x1="0" y1="24" x2="24" y2="0">
          <stop offset="0%" stopColor="#FD5" />
          <stop offset="50%" stopColor="#FF543E" />
          <stop offset="100%" stopColor="#C837AB" />
        </linearGradient>
      </defs>
      <rect x="2" y="2" width="20" height="20" rx="6" fill="url(#igGrad)" />
      <circle cx="12" cy="12" r="4.5" stroke="#fff" strokeWidth="1.8" fill="none" />
      <circle cx="17.2" cy="6.8" r="1.3" fill="#fff" />
    </svg>
  );
}

export function TikTokIcon({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <rect x="1" y="1" width="22" height="22" rx="5" fill="#010101" />
      <path
        d="M16.6 5.82C15.91 5.03 15.53 4.02 15.53 3h-3.09v12.4a2.59 2.59 0 0 1-2.59 2.5 2.6 2.6 0 0 1-2.6-2.6 2.6 2.6 0 0 1 2.6-2.6c.27 0 .53.04.78.12v-3.15a5.76 5.76 0 0 0-.78-.05 5.74 5.74 0 0 0-5.74 5.73 5.74 5.74 0 0 0 5.74 5.74 5.74 5.74 0 0 0 5.74-5.74V9.01a7.35 7.35 0 0 0 4.3 1.38V7.3a4.24 4.24 0 0 1-3.29-1.48z"
        fill="#EE1D52"
        transform="translate(0.6,0.6)"
      />
      <path
        d="M16.6 5.82C15.91 5.03 15.53 4.02 15.53 3h-3.09v12.4a2.59 2.59 0 0 1-2.59 2.5 2.6 2.6 0 0 1-2.6-2.6 2.6 2.6 0 0 1 2.6-2.6c.27 0 .53.04.78.12v-3.15a5.76 5.76 0 0 0-.78-.05 5.74 5.74 0 0 0-5.74 5.73 5.74 5.74 0 0 0 5.74 5.74 5.74 5.74 0 0 0 5.74-5.74V9.01a7.35 7.35 0 0 0 4.3 1.38V7.3a4.24 4.24 0 0 1-3.29-1.48z"
        fill="#69C9D0"
        transform="translate(-0.4,-0.4)"
      />
      <path
        d="M16.6 5.82C15.91 5.03 15.53 4.02 15.53 3h-3.09v12.4a2.59 2.59 0 0 1-2.59 2.5 2.6 2.6 0 0 1-2.6-2.6 2.6 2.6 0 0 1 2.6-2.6c.27 0 .53.04.78.12v-3.15a5.76 5.76 0 0 0-.78-.05 5.74 5.74 0 0 0-5.74 5.73 5.74 5.74 0 0 0 5.74 5.74 5.74 5.74 0 0 0 5.74-5.74V9.01a7.35 7.35 0 0 0 4.3 1.38V7.3a4.24 4.24 0 0 1-3.29-1.48z"
        fill="#fff"
      />
    </svg>
  );
}

export function LogicIcon({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="1.6">
      <path d="M12 3l9 9-9 9-9-9 9-9z" />
      <path d="M9 12h6" />
    </svg>
  );
}

export function ShieldIcon({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#fbbf24" strokeWidth="1.7">
      <path d="M12 2l8 3v6c0 5-3.5 9.3-8 11-4.5-1.7-8-6-8-11V5l8-3z" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  );
}

export function PlayIcon({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#22d3ee" strokeWidth="1.7">
      <circle cx="12" cy="12" r="9" />
      <path d="M10 8.5l6 3.5-6 3.5v-7z" fill="#22d3ee" stroke="none" />
    </svg>
  );
}

export function FlagIcon({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="1.7">
      <circle cx="12" cy="12" r="9" />
      <path d="M8.5 12.5l2.5 2.5 5-5.5" />
    </svg>
  );
}

export function DocsIcon({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M6 2h7l5 5v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z" fill="#4285F4" />
      <path d="M13 2l5 5h-5V2z" fill="#A1C2FA" />
      <rect x="7.5" y="11" width="9" height="1.4" rx="0.7" fill="#fff" />
      <rect x="7.5" y="14" width="9" height="1.4" rx="0.7" fill="#fff" />
      <rect x="7.5" y="17" width="6" height="1.4" rx="0.7" fill="#fff" />
    </svg>
  );
}

export function SlidesIcon({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M6 2h7l5 5v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z" fill="#F4B400" />
      <path d="M13 2l5 5h-5V2z" fill="#FADA80" />
      <rect x="7.5" y="11" width="9" height="6" rx="1" fill="#fff" />
    </svg>
  );
}

export function CalendarIcon({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <rect x="3" y="4.5" width="18" height="16" rx="2.5" fill="#fff" stroke="#DADCE0" />
      <path d="M3 7a2.5 2.5 0 0 1 2.5-2.5h13A2.5 2.5 0 0 1 21 7v1.5H3V7z" fill="#4285F4" />
      <rect x="7" y="2.5" width="1.8" height="4" rx="0.9" fill="#4285F4" />
      <rect x="15.2" y="2.5" width="1.8" height="4" rx="0.9" fill="#4285F4" />
      <text
        x="12"
        y="17.6"
        textAnchor="middle"
        fontSize="8"
        fontWeight="700"
        fill="#4285F4"
        fontFamily="Arial, sans-serif"
      >
        31
      </text>
    </svg>
  );
}

export function RemoveBgIcon({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <defs>
        <pattern id="rbCheck" width="6" height="6" patternUnits="userSpaceOnUse">
          <rect width="6" height="6" fill="#fff" />
          <rect width="3" height="3" fill="#D7DBE0" />
          <rect x="3" y="3" width="3" height="3" fill="#D7DBE0" />
        </pattern>
      </defs>
      <rect x="2.5" y="2.5" width="19" height="19" rx="4" fill="url(#rbCheck)" stroke="#C2C7CE" />
      <circle cx="12" cy="9.6" r="3.1" fill="#54B583" />
      <path d="M5.8 19c1.2-3.4 3.5-5.1 6.2-5.1s5 1.7 6.2 5.1H5.8z" fill="#54B583" />
    </svg>
  );
}

export function providerIcon(type: string, size = 22) {
  switch (type) {
    case "gmail":
      return <GmailIcon size={size} />;
    case "google_sheets":
      return <SheetsIcon size={size} />;
    case "google_drive":
      return <DriveIcon size={size} />;
    case "google_docs":
      return <DocsIcon size={size} />;
    case "google_slides":
      return <SlidesIcon size={size} />;
    case "google_calendar":
      return <CalendarIcon size={size} />;
    case "openai":
      return <OpenAIIcon size={size} />;
    case "telegram":
      return <TelegramIcon size={size} />;
    case "slack":
      return <SlackIcon size={size} />;
    case "instagram":
      return <InstagramIcon size={size} />;
    case "tiktok":
      return <TikTokIcon size={size} />;
    case "removebg":
      return <RemoveBgIcon size={size} />;
    case "condition":
      return <LogicIcon size={size} />;
    case "approval":
      return <ShieldIcon size={size} />;
    case "trigger":
      return <PlayIcon size={size} />;
    case "output":
      return <FlagIcon size={size} />;
    default:
      return <LogicIcon size={size} />;
  }
}
