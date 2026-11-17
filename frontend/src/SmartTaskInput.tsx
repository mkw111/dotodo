import { useLayoutEffect, useMemo, useRef } from "react";
import { recognizeInput } from "./smartInput";

function offset(root: HTMLElement) {
  const selection = window.getSelection();
  if (!selection?.rangeCount || !root.contains(selection.anchorNode))
    return null;
  const range = selection.getRangeAt(0).cloneRange();
  range.selectNodeContents(root);
  range.setEnd(selection.anchorNode!, selection.anchorOffset);
  return range.toString().length;
}
function restore(root: HTMLElement, position: number) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let current: Node | null;
  let left = position;
  const range = document.createRange();
  while ((current = walker.nextNode())) {
    const length = current.textContent?.length || 0;
    if (left <= length) {
      const chip = current.parentElement?.closest("[data-smart-key]");
      if (chip) range.setStartAfter(chip);
      else range.setStart(current, left);
      range.collapse(true);
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
      return;
    }
    left -= length;
  }
  range.selectNodeContents(root);
  range.collapse(false);
  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
}
export default function SmartTaskInput({
  value,
  ignored,
  today,
  onChange,
  onIgnore,
  onSubmit,
  editorRef,
  placeholder = "할 일 입력 · 오늘, 매일, 수요일, #태그",
}: {
  value: string;
  ignored: string[];
  today: string;
  onChange: (text: string) => void;
  onIgnore: (key: string) => void;
  onSubmit: () => void;
  editorRef: React.RefObject<HTMLDivElement | null>;
  placeholder?: string;
}) {
  const composing = useRef(false);
  const caret = useRef<number | null>(null);
  const parsed = useMemo(
    () => recognizeInput(value, today, ignored),
    [value, today, ignored]
  );
  function sync() {
    const root = editorRef.current;
    if (!root || composing.current) return;
    caret.current = offset(root);
    onChange((root.textContent || "").replace(/[\r\n]/g, " ").slice(0, 300));
  }
  useLayoutEffect(() => {
    const root = editorRef.current;
    if (!root || composing.current) return;
    const focused = document.activeElement === root;
    const position = caret.current ?? (focused ? offset(root) : null);
    const fragment = document.createDocumentFragment();
    let cursor = 0;
    for (const token of parsed.tokens) {
      fragment.append(
        document.createTextNode(value.slice(cursor, token.start))
      );
      if (token.ignored) fragment.append(document.createTextNode(token.text));
      else {
        const chip = document.createElement("span");
        chip.textContent = token.text;
        chip.className = `smart-inline-token ${token.kind}`;
        chip.contentEditable = "false";
        chip.dataset.smartKey = token.key;
        chip.setAttribute("role", "button");
        chip.setAttribute("tabindex", "0");
        chip.setAttribute("aria-label", `${token.text} 인식 취소`);
        chip.title = `${token.description} · 누르면 일반 텍스트로 전환`;
        fragment.append(chip);
      }
      cursor = token.end;
    }
    fragment.append(document.createTextNode(value.slice(cursor)));
    root.replaceChildren(fragment);
    if (focused && position !== null) restore(root, position);
    caret.current = null;
  }, [value, parsed, editorRef]);
  function cancel(target: EventTarget | null) {
    const element =
      target instanceof Element
        ? target.closest<HTMLElement>("[data-smart-key]")
        : null;
    if (!element?.dataset.smartKey) return false;
    const token = parsed.tokens.find((t) => t.key === element.dataset.smartKey);
    caret.current = token?.end ?? value.length;
    onIgnore(element.dataset.smartKey);
    editorRef.current?.focus();
    return true;
  }
  function cancelPreviousChip() {
    const root = editorRef.current;
    if (!root || !window.getSelection()?.isCollapsed) return false;
    const position = offset(root);
    if (position === null) return false;
    const token = parsed.tokens.find((item) => !item.ignored && item.end === position);
    if (!token) return false;
    caret.current = position;
    onIgnore(token.key);
    return true;
  }
  useLayoutEffect(() => {
    const root = editorRef.current;
    const beforeInput = (event: InputEvent) => {
      if (event.inputType === "deleteContentBackward" && event.cancelable &&
          !event.isComposing && !composing.current && cancelPreviousChip()) {
        event.preventDefault();
      }
    };
    root?.addEventListener("beforeinput", beforeInput);
    return () => root?.removeEventListener("beforeinput", beforeInput);
  });
  return (
    <div
      ref={editorRef}
      className="smart-textbox"
      role="textbox"
      aria-label="빠른 할 일 추가"
      aria-multiline="false"
      data-placeholder={placeholder}
      enterKeyHint="done"
      contentEditable
      suppressContentEditableWarning
      spellCheck={false}
      onInput={sync}
      onCompositionStart={() => {
        composing.current = true;
      }}
      onCompositionEnd={() => {
        composing.current = false;
        sync();
      }}
      onClick={(e) => cancel(e.target)}
      onKeyDown={(e) => {
        if (composing.current || e.nativeEvent.isComposing || e.keyCode === 229)
          return;
        if (
          (e.key === "Enter" || e.key === " ") &&
          e.target !== editorRef.current &&
          cancel(e.target)
        ) {
          e.preventDefault();
          return;
        }
        if (e.key === "Backspace" && cancelPreviousChip()) {
          e.preventDefault();
          return;
        }
        if (e.key === "Enter") {
          e.preventDefault();
          onSubmit();
        }
      }}
      onPaste={(e) => {
        e.preventDefault();
        const text = e.clipboardData
          .getData("text/plain")
          .replace(/[\r\n]+/g, " ");
        const selection = window.getSelection();
        if (!selection?.rangeCount) return;
        const range = selection.getRangeAt(0);
        range.deleteContents();
        const node = document.createTextNode(text);
        range.insertNode(node);
        range.setStartAfter(node);
        range.collapse(true);
        selection.removeAllRanges();
        selection.addRange(range);
        sync();
      }}
    />
  );
}
