import { useEffect, useRef, type ReactNode } from "react";

/** Modal dialog. Closes with Escape, the close button, or a click on the backdrop. */
export function Dialog({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const el = ref.current;
    el?.showModal();
    return () => el?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className="experience-dialog"
      aria-labelledby="dialog-title"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        // Clicks on the backdrop target the <dialog> itself but land outside its box.
        if (e.target !== e.currentTarget) return;
        const box = e.currentTarget.getBoundingClientRect();
        const inside =
          e.clientX >= box.left && e.clientX <= box.right && e.clientY >= box.top && e.clientY <= box.bottom;
        if (!inside) onClose();
      }}
    >
      <div className="dialog-heading">
        <h2 id="dialog-title">{title}</h2>
        <button className="dialog-close" onClick={onClose} aria-label="Close">
          ×
        </button>
      </div>
      {children}
    </dialog>
  );
}
