// شعار «وَتيرة» — تدرّج ليموني ← أزرق (من هوية التصميم)

export default function Logo({
  size = 34,
  id = "wateeraGrad",
}: {
  size?: number;
  id?: string;
}) {
  return (
    <svg
      width={size}
      height={(size * 64) / 74}
      viewBox="0 0 74 64"
      aria-hidden
      className="shrink-0"
    >
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#cfff00" />
          <stop offset=".38" stopColor="#58ed32" />
          <stop offset=".68" stopColor="#20cbd0" />
          <stop offset="1" stopColor="#2874f0" />
        </linearGradient>
      </defs>
      <g
        fill="none"
        stroke={`url(#${id})`}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="6"
      >
        <path d="M14 18.5h10.5c9.5 0 7.2-10.5 18.8-10.5 12.7 0 17.1 11.9 11.6 22.3-4.2 8-15.1 7.4-20.4 13.8-5 6.1-1 13.2 7.1 13.2 7.6 0 11.2-5.4 12.5-10.7" />
        <path d="M14 32h10.2c10.3 0 9.2-12.1 20.1-12.1 8.8 0 11.8 7.7 6.5 13.1-4.5 4.6-11.6 4.2-14.3 10.2" />
        <path d="M14 45.5h10.4c9.1 0 9.7-8.7 17.3-10.8 7.8-2.1 10.1 8.6 16.4 3.6 2.1-1.7 2.8-4.3 2.9-6.5" />
        <path d="M62.2 24.4c4.3.2 7.3 2.7 8.1 6.1" />
        <path d="M70.2 38.3c-.9 3.7-3.8 6.2-8.1 6.4" />
      </g>
      <g fill={`url(#${id})`}>
        <circle cx="6.5" cy="18.5" r="3.8" />
        <circle cx="6.5" cy="32" r="3.8" />
        <circle cx="6.5" cy="45.5" r="3.8" />
        <circle cx="60.5" cy="34.5" r="5.2" />
      </g>
    </svg>
  );
}
