export type IconName =
  | "rank"
  | "tasks"
  | "calendar"
  | "matrix"
  | "focus"
  | "habit"
  | "settings"
  | "sun"
  | "inbox"
  | "week"
  | "star"
  | "check"
  | "plus"
  | "search"
  | "left"
  | "right"
  | "close"
  | "trash"
  | "list"
  | "board"
  | "sort"
  | "flag"
  | "tag"
  | "repeat"
  | "clock"
  | "more"
  | "chevron"
  | "play"
  | "pause"
  | "reset"
  | "download"
  | "upload"
  | "menu"
  | "moon"
  | "bell"
  | "briefcase"
  | "user"
  | "heart"
  | "book"
  | "drop"
  | "walk"
  | "arrow"
  | "leaf"
  | "edit"
  | "refresh";
const paths: Record<IconName, string> = {
  rank: "M12 2 4 6v7c0 4 4 7 8 9 4-2 8-5 8-9V6zM8 10l3 3 5-6",
  tasks: "M8 5h12M8 12h12M8 19h12M3 5h.01M3 12h.01M3 19h.01",
  calendar: "M5 5h14v15H5zM8 3v4m8-4v4M5 10h14",
  matrix: "M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z",
  focus: "M9 2h6m-3 0v3m6 1 2-2M20 13a8 8 0 1 1-16 0 8 8 0 0 1 16 0M12 9v5l3 2",
  habit: "M4 12v8h16V9M4 12l5-5 4 4 7-8M16 3h4v4",
  settings:
    "M9 3h6l1 3 3 1 2 5-2 5-3 1-1 3H9l-1-3-3-1-2-5 2-5 3-1zM15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0",
  sun: "M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1 1m12 12 1 1m0-14-1 1M6 18l-1 1M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0",
  inbox: "M5 4h14l3 11v5H2v-5zM2 15h6l2 2h4l2-2h6",
  week: "M4 5h16v15H4zM8 3v4m8-4v4M4 10h16M8 14h2m4 0h2M8 17h2",
  star: "m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9z",
  check: "m5 12 4 4L19 6",
  plus: "M12 5v14M5 12h14",
  search: "m16 16 5 5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0",
  left: "m15 5-7 7 7 7",
  right: "m9 5 7 7-7 7",
  close: "m6 6 12 12M6 18 18 6",
  trash: "M4 6h16M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7m4-7v7",
  list: "M4 5h16M4 12h16M4 19h16",
  board: "M3 4h18v16H3zM9 4v16M15 4v16",
  sort: "M8 3v18m-4-4 4 4 4-4M15 4h6m-6 5h4m-4 5h2",
  flag: "M5 21V3m0 1c5-3 9 3 15 0v10c-6 3-10-3-15 0",
  tag: "M3 3h8l10 10-8 8L3 11zM7 7h.01",
  repeat: "m17 2 4 4-4 4M3 11V6h18M7 22l-4-4 4-4m14-1v5H3",
  clock: "M12 7v5l4 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0",
  more: "M5 12h.01M12 12h.01M19 12h.01",
  chevron: "m6 9 6 6 6-6",
  play: "m8 4 12 8-12 8z",
  pause: "M8 4v16M16 4v16",
  reset: "M3 4v6h6M3 10a9 9 0 1 1 0 5",
  download: "M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5",
  upload: "M12 16V4m-5 5 5-5 5 5M4 16v5h16v-5",
  menu: "M4 5h16M4 12h16M4 19h16",
  moon: "M20 14A9 9 0 0 1 10 3a9 9 0 1 0 10 11",
  bell: "M5 17h14l-2-4V9a5 5 0 0 0-10 0v4zM10 20h4",
  briefcase: "M3 7h18v13H3zM8 7V3h8v4M3 12c6 3 12 3 18 0M12 12v4",
  user: "M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0M4 21v-2a8 8 0 0 1 16 0v2",
  heart: "M12 21 3 12C-3 5 7-1 12 6c5-7 15-1 9 6z",
  book: "M12 5v16M3 3c4 0 6 1 9 3 3-2 5-3 9-3v15c-4 0-6 1-9 3-3-2-5-3-9-3z",
  drop: "M12 2S4 11 4 15a8 8 0 0 0 16 0C20 11 12 2 12 2",
  walk: "M14 5a2 2 0 1 1 0-4 2 2 0 0 1 0 4M8 21l4-8-2-3-4 4M10 10l3-3 3 5h4M12 13l5 3v5",
  arrow: "M5 12h14m-6-6 6 6-6 6",
  leaf: "M5 19c-5-8 1-15 15-15 0 14-7 20-15 15Zm0 0L15 9",
  edit: "m15 4 5 5M4 20l1-6L16 3l5 5-11 11z",
  refresh: "M20 4v6h-6M4 20v-6h6M20 10a8 8 0 0 0-14-6M4 14a8 8 0 0 0 14 6",
};
export default function Icon({
  name,
  size = 20,
  flagNumber,
}: {
  name: string;
  size?: number;
  flagNumber?: number;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.65"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[name as IconName] || paths.list} />
      {name === "flag" && flagNumber && (
        <text x="12.5" y="11.8" textAnchor="middle" fontSize="10" fontWeight="800"
          stroke="none" fill="currentColor" fillOpacity="1">{flagNumber}</text>
      )}
    </svg>
  );
}
