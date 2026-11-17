import { useContext, useLayoutEffect, useMemo, useRef, useState } from "react";
import Icon from "./Icon";
import { SaveErrorContext } from "./Modal";
import SmartTaskInput from "./SmartTaskInput";
import { recognizeInput } from "./smartInput";
import { priorityNames, repeatNames, type Priority, type Task, type TaskList } from "./types";

export default function QuickComposer({
  today,
  defaultDate,
  busy,
  onAdd,
  onDetails,
  sheetLists,
}: {
  today: string;
  defaultDate: string;
  busy: boolean;
  onAdd: (input: Partial<Task> & { title: string }) => Promise<boolean>;
  onDetails: (input: Partial<Task> & { title: string }) => void;
  sheetLists?: TaskList[];
}) {
  const [text, setText] = useState("");
  const [ignored, setIgnored] = useState<string[]>([]);
  const [date, setDate] = useState<string | null>(null);
  const [listId, setListId] = useState("inbox");
  const [priority, setPriority] = useState<Priority | null>(null);
  const editor = useRef<HTMLDivElement>(null);
  const appendedPreset = useRef(false);
  useLayoutEffect(() => {
    if (!appendedPreset.current || !editor.current) return;
    appendedPreset.current = false;
    editor.current.focus();
    window.getSelection()?.collapse(editor.current, editor.current.childNodes.length);
  }, [text]);
  const parsed = useMemo(
    () => recognizeInput(text, today, ignored),
    [text, today, ignored]
  );
  const effectiveDate =
    date ?? (parsed.date || (!parsed.dateRecognitionDisabled ? defaultDate : ""));
  const input: Partial<Task> & { title: string } = {
    title: parsed.title,
    date: effectiveDate,
    time: effectiveDate ? parsed.time : "",
    repeat: effectiveDate ? parsed.repeat : "none",
    ...(sheetLists ? { listId } : {}),
    priority: priority ?? parsed.priority,
    tags: parsed.tags,
  };
  function clear() {
    setText("");
    setIgnored([]);
    setDate(null);
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
  const titleInput = (
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
      placeholder={sheetLists ? "할 일 이름" : undefined}
    />
  );
  const saveButton = (
    <button
      className="quick-submit"
      type="submit"
      disabled={busy || !parsed.title.trim()}
      aria-label="빠른 추가 저장"
    >
      <Icon name="arrow" size={17} />
    </button>
  );
  function showDetails() {
    onDetails(input);
    clear();
  }
  const presets = (
    <div className="quick-date-presets">
      {["오늘", "내일", "이번 주", "매일", "매주", "수요일"].map((word) => (
        <button type="button" key={word} onClick={() => {
          appendedPreset.current = true;
          setText((current) => `${current.trimEnd()}${current ? " " : ""}${word} `);
        }}>{word}</button>
      ))}
    </div>
  );
  return (
    <form
      className={`quick-add smart-composer ${sheetLists ? "sheet-composer" : ""}`}
      data-priority={sheetLists && input.priority ? input.priority : undefined}
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <div className="quick-input">
        {!sheetLists && <Icon name="plus" size={19} />}
        {titleInput}
        {!sheetLists && saveButton}
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
      {sheetLists ? (
        <>
          <div className="sheet-quick-options">
            <button className="sheet-chip sheet-details" type="button" aria-label="상세 입력"
              title="상세 입력" onClick={showDetails}><Icon name="plus" size={18} /></button>
            <label className="sheet-chip sheet-list-chip">
              <Icon name="list" size={15} />
              <select aria-label="할 일 리스트" value={listId} onChange={(event) => setListId(event.target.value)}>
                <option value="inbox">수집함</option>
                {sheetLists.map((list) => <option key={list.id} value={list.id}>{list.name}</option>)}
              </select>
            </label>
            <label className="sheet-chip sheet-date-chip">
              <Icon name="calendar" size={15} />
              <span>{effectiveDate === today ? "오늘" : effectiveDate ? effectiveDate.slice(5).replace("-", "/") : "날짜"}</span>
              <input type="date" aria-label="빠른 추가 날짜" value={effectiveDate}
                onChange={(event) => setDate(event.target.value)} />
            </label>
            {saveButton}
          </div>
          <div className="sheet-priorities" role="group" aria-label="우선순위">
            <Icon name="flag" size={15} />
            {([1, 2, 3, 4] as const).map((level) => (
              <button key={level} type="button" data-priority={level} aria-label={`우선순위 ${level}`}
                aria-pressed={input.priority === level}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => setPriority(input.priority === level ? (parsed.priority === level ? 0 : null) : level)}>
                {level}
              </button>
            ))}
          </div>
          <details className="sheet-presets">
            <summary>빠른 날짜·반복</summary>
            {presets}
          </details>
        </>
      ) : (
        <>
          <div className="quick-options">
            <label>
              <Icon name="calendar" size={13} />
              <input
                aria-label="빠른 추가 날짜"
                type="date"
                value={date ?? ""}
                onChange={(e) => setDate(e.target.value || null)}
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
              onClick={showDetails}
            >
              상세 입력
            </button>
            <span>Enter로 추가</span>
          </div>
          {presets}
        </>
      )}
    </form>
  );
}

export function QuickAddSheet({ onClose, ...composer }: Parameters<typeof QuickComposer>[0] & {
  onClose: () => void;
  sheetLists: TaskList[];
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const error = useContext(SaveErrorContext);
  useLayoutEffect(() => {
    const sheet = dialog.current;
    if (!sheet) return;
    const viewport = window.visualViewport;
    function position() {
      const inset = viewport ? window.innerHeight - viewport.height - viewport.offsetTop : 0;
      sheet?.style.setProperty("--keyboard-inset", `${Math.max(0, inset)}px`);
      sheet?.style.setProperty("--visible-height", `${viewport?.height ?? window.innerHeight}px`);
    }
    position();
    viewport?.addEventListener("resize", position);
    viewport?.addEventListener("scroll", position);
    if (!sheet.open) sheet.showModal();
    sheet.querySelector<HTMLElement>("[contenteditable]")?.focus();
    return () => {
      viewport?.removeEventListener("resize", position);
      viewport?.removeEventListener("scroll", position);
      sheet.close();
    };
  }, []);

  return (
    <dialog ref={dialog} className="quick-add-sheet" aria-label="할 일 빠른 등록"
      onCancel={(event) => { event.preventDefault(); if (!composer.busy) onClose(); }}
      onClick={(event) => {
        if (event.target !== event.currentTarget || composer.busy) return;
        const rect = event.currentTarget.getBoundingClientRect();
        if (event.clientX < rect.left || event.clientX > rect.right ||
            event.clientY < rect.top || event.clientY > rect.bottom) onClose();
      }}>
      <div className="quick-sheet-header">
        <i aria-hidden="true" />
        <button className="icon-btn" aria-label="빠른 등록 닫기" disabled={composer.busy}
          onClick={onClose}><Icon name="close" size={17} /></button>
      </div>
      {error && <p role="alert" className="error-banner">{error}</p>}
      <QuickComposer {...composer} />
    </dialog>
  );
}
