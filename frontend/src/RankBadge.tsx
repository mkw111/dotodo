export default function RankBadge({
  color = "#8c929e",
  size = 80,
  level = 0,
}: {
  color?: string;
  size?: number;
  level?: number;
}) {
  return (
    <svg
      className="rank-badge"
      width={size}
      height={size}
      viewBox="0 0 120 120"
      fill="none"
      aria-hidden="true"
      style={{ color }}
    >
      <path
        d="M30 49 9 38l9 29 18 9M90 49l21-11-9 29-18 9"
        fill="currentColor"
        opacity=".18"
      />
      <path
        d="m27 58-12-7 7 21 15 9m56-23 12-7-7 21-15 9"
        stroke="currentColor"
        strokeWidth="2"
        opacity=".5"
      />
      <path
        d="m60 15 30 14v30c0 21-12 36-30 47-18-11-30-26-30-47V29z"
        fill="currentColor"
        fillOpacity=".1"
        stroke="currentColor"
        strokeWidth="2.5"
      />
      <path
        d="m60 26 21 10v23c0 16-8 28-21 37-13-9-21-21-21-37V36z"
        stroke="currentColor"
        strokeWidth="1"
        opacity=".35"
      />
      <path d="m60 35 16 23-16 26-16-26z" fill="currentColor" opacity=".8" />
      <path d="m60 35 3 23-3 26-16-26z" fill="white" opacity=".22" />
      <path d="m44 58 16-4 16 4-16 7z" fill="white" opacity=".25" />
      {level >= 3 && (
        <path
          d="m44 17 4-10 12 6 12-6 4 10"
          stroke="currentColor"
          strokeWidth="2"
        />
      )}
      {level >= 7 && (
        <path
          d="m60 2 3 5-3 5-3-5zM19 34l-2-8 9 3m75 5 2-8-9 3"
          fill="currentColor"
        />
      )}
    </svg>
  );
}
