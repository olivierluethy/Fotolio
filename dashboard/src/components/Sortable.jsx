import { useState } from 'react';

/**
 * Minimal drag-to-reorder list using native HTML5 DnD.
 * `items` must have stable `id`. Calls onReorder(newItems) after a drop.
 * `render(item, dragHandleProps)` renders each row/cell.
 */
export function Sortable({ items, onReorder, render, className = '', itemClassName = '' }) {
  const [dragId, setDragId] = useState(null);
  const [overId, setOverId] = useState(null);

  const handleDrop = () => {
    if (dragId == null || overId == null || dragId === overId) {
      setDragId(null); setOverId(null);
      return;
    }
    const from = items.findIndex((i) => i.id === dragId);
    const to = items.findIndex((i) => i.id === overId);
    const next = items.slice();
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    setDragId(null); setOverId(null);
    onReorder(next);
  };

  return (
    <div className={className}>
      {items.map((item) => (
        <div
          key={item.id}
          draggable
          onDragStart={() => setDragId(item.id)}
          onDragEnter={() => setOverId(item.id)}
          onDragOver={(e) => e.preventDefault()}
          onDragEnd={handleDrop}
          onDrop={handleDrop}
          className={itemClassName}
          style={{
            opacity: dragId === item.id ? 0.4 : 1,
            outline: overId === item.id && dragId !== item.id ? '2px dashed var(--accent)' : 'none',
            outlineOffset: 2,
            borderRadius: 12,
            transition: 'opacity .15s',
          }}
        >
          {render(item)}
        </div>
      ))}
    </div>
  );
}
