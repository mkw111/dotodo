import { useMemo, useRef, useState } from "react";
import Icon from "./Icon";
import SmartTaskInput from "./SmartTaskInput";
import { recognizeInput } from "./smartInput";
import { priorityNames, repeatNames, type Priority, type Task } from "./types";

export default function QuickComposer({
  today,
  defaultDate,
  busy,
  onAdd,
  onDetails,
}: {
  today: string;
  defaultDate: string;
  busy: boolean;
  onAdd: (input: Partial<Task> & { title: string }) => Promise<boolean>;
  onDetails: (input: Partial<Task> & { title: string }) => void;
}) {
  const [text, setText] = useState("");
  const [ignored, setIgnored] = useState<string[]>([]);
  const [date, setDate] = useState("");
  const [priority, setPriority] = useState<Priority | null>(null);
  const editor = useRef<HTMLDivElement>(null);
  const parsed = useMemo(
    () => recognizeInput(text, today, ignored),
    [text, today, ignored]
  );
  const effectiveDate =
    date || parsed.date || (!parsed.dateRecognitionDisabled ? defaultDate : "");
  const input = {
    title: parsed.title,
    date: effectiveDate,
    time: effectiveDate ? parsed.time : "",
    repeat: parsed.repeat,
    priority: priority ?? parsed.priority,
    tags: parsed.tags,
  };
  function clear() {
    setText("");
    setIgnored([]);
    setDate("");
    setPriority(null);
  }
  async function submit() {
    if (!input.title.trim() || busy) return;
    if (await onAdd(input)) {
      clear();
      editor.current?.focus();
    }
  }
  const active = parsed.tokens.filter((t) => !t.ignored);
  return (
    <form
      className="quick-add smart-composer"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <div className="quick-input">
        <Icon name="plus" size={19} />
        <SmartTaskInput
          value={text}
          ignored={ignored}
          today={today}
          onChange={(value) => {
            setText(value);
            const available = new Set(
              recognizeInput(value, today).tokens.map((t) => t.key)
            );
            setIgnored((keys) => keys.filter((key) => available.has(key)));
          }}
          onIgnore={(key) => setIgnored((keys) => [...new Set([...keys, key])])}
          onSubmit={submit}
          editorRef={editor}
        />
        <button
          className="quick-submit"
          type="submit"
          disabled={busy || !parsed.title.trim()}
          aria-label="빠른 추가 저장"
        >
          <Icon name="arrow" size={17} />
        </button>
      </div>
      {(active.length > 0 || ignored.length > 0) && (
        <div className="recognition-preview" aria-live="polite">
          {effectiveDate && (
            <span>
              <Icon name="calendar" size={12} />
              {effectiveDate}{" "}
              {new Date(`${effectiveDate}T12:00:00`).toLocaleDateString(
                "ko-KR",
                { weekday: "short" }
              )}
            </span>
          )}
          {parsed.time && (
            <span>
              <Icon name="clock" size={12} />
              {parsed.time}
              {!effectiveDate && <small> · 날짜 선택 후 적용</small>}
            </span>
          )}
          {parsed.repeat !== "none" && (
            <span>
              <Icon name="repeat" size={12} />
              {repeatNames[parsed.repeat]}
            </span>
          )}
          <small>강조된 단어를 누르면 일반 텍스트로 바뀝니다</small>
          {ignored.length > 0 && (
            <button
              type="button"
              className="text-btn"
              onClick={() => setIgnored([])}
            >
              다시 인식
            </button>
          )}
        </div>
      )}
      <div className="quick-options">
        <label>
          <Icon name="calendar" size={13} />
          <input
            aria-label="빠른 추가 날짜"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </label>
        <label>
          <Icon name="flag" size={13} />
          <select
            aria-label="빠른 추가 우선순위"
            value={priority ?? ""}
            onChange={(e) =>
              setPriority(
                e.target.value === ""
                  ? null
                  : (Number(e.target.value) as Priority)
              )
            }
          >
            <option value="">우선순위 자동 인식</option>
            {priorityNames.map((name, i) => (
              <option value={i} key={i}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className="text-btn"
          onClick={() => {
            onDetails(input);
            clear();
          }}
        >
          상세 입력
        </button>
        <span>Enter로 추가</span>
      </div>
      <div className="quick-date-presets">
        <span>빠르게</span>
        {["오늘", "내일", "이번 주", "매일", "수요일"].map((word) => (
          <button
            type="button"
            key={word}
            onClick={() => {
              setText(
                (current) => `${current.trimEnd()}${current ? " " : ""}${word} `
              );
              editor.current?.focus();
            }}
          >
            {word}
          </button>
        ))}
      </div>
    </form>
  );
}
