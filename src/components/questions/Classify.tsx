import { useState } from 'react';
import type { AccountType, ClassifyAnswer, ClassifyProblem } from '@contracts';
import { itemClass, itemsOf, Mark, TYPE_LABEL, type QuestionInputProps } from './types';

/**
 * Drag each item into a bucket. Keyboard / click alternative: press an item to select it,
 * then press a bucket's "Place here" button. Pressing a placed item returns it to the pool.
 */
export function Classify({
  problem,
  value,
  onChange,
  correctItems,
  wrongItems,
}: QuestionInputProps<ClassifyProblem>) {
  const answers = itemsOf<AccountType | null>(value, problem.items.length, null) as ClassifyAnswer;
  const [selected, setSelected] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState<AccountType | null>(null);

  const place = (i: number, bucket: AccountType | null) => {
    const next = answers.slice();
    next[i] = bucket;
    onChange({ ...value, items: next });
    setSelected(null);
  };

  const chip = (i: number) => {
    const item = problem.items[i]!;
    const placed = answers[i] != null;
    return (
      <button
        key={i}
        type="button"
        className={`chip ${selected === i ? 'selected' : ''} ${itemClass(i, correctItems, wrongItems)}`}
        draggable
        aria-pressed={selected === i}
        aria-label={
          placed ? `${item.label} (in ${TYPE_LABEL[answers[i]!]}; press to select)` : item.label
        }
        onDragStart={(e) => {
          e.dataTransfer.setData('text/plain', String(i));
          e.dataTransfer.effectAllowed = 'move';
        }}
        onClick={() => setSelected(selected === i ? null : i)}
      >
        <Mark i={i} correct={correctItems} wrong={wrongItems} />
        {item.label}
        {item.entityId ? <span className="note"> ({item.entityId})</span> : null}
      </button>
    );
  };

  const unplaced = problem.items.map((_, i) => i).filter((i) => answers[i] == null);

  return (
    <div className="classify">
      <div>
        <h3 id="pool-h">Items to classify</h3>
        <div
          className="pool"
          role="group"
          aria-labelledby="pool-h"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const i = Number(e.dataTransfer.getData('text/plain'));
            if (Number.isInteger(i)) place(i, null);
          }}
        >
          {unplaced.length === 0 && <span className="note">All items placed.</span>}
          {unplaced.map(chip)}
        </div>
        <p className="note" aria-live="polite">
          {selected !== null
            ? `Selected “${problem.items[selected]!.label}”. Choose a bucket below, or drag it.`
            : 'Drag an item into a bucket, or select it and press “Place here”.'}
        </p>
      </div>
      <div className="buckets">
        {problem.buckets.map((b) => {
          const inBucket = problem.items.map((_, i) => i).filter((i) => answers[i] === b);
          return (
            <div
              key={b}
              className={`bucket ${dragOver === b ? 'drop-ready' : ''}`}
              role="group"
              aria-label={`${TYPE_LABEL[b]} bucket`}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(b);
              }}
              onDragLeave={() => setDragOver(null)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(null);
                const i = Number(e.dataTransfer.getData('text/plain'));
                if (Number.isInteger(i)) place(i, b);
              }}
            >
              <div className="bucket-head">
                <span>{TYPE_LABEL[b]}</span>
                <button
                  type="button"
                  disabled={selected === null}
                  onClick={() => selected !== null && place(selected, b)}
                >
                  Place here
                </button>
              </div>
              <div className="bucket-items">{inBucket.map(chip)}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
