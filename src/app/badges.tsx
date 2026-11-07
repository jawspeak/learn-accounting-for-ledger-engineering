import type { Problem, ProblemRole } from '@contracts';

export const KIND_LABEL: Record<Problem['kind'], string> = {
  booking: 'Booking',
  classify: 'Classify',
  'dr-cr-predict': 'Dr / Cr',
  'equation-fill': 'Equation',
  'statement-fill': 'Statement',
  'multiple-choice': 'Multiple choice',
  'coa-design': 'Chart of accounts',
};

export const ROLE_LABEL: Record<ProblemRole, string> = {
  worked: 'Worked example',
  faded: 'Faded example',
  practice: 'Practice',
  review: 'Review',
};

export const ROLE_ORDER: ProblemRole[] = ['worked', 'faded', 'practice', 'review'];

export const ROLE_BLURB: Record<ProblemRole, string> = {
  worked: 'The full solution is shown, step by step. Read it, then try the next one.',
  faded: 'Part of the answer is filled in. You finish it.',
  practice: 'Your turn. Hints are available any time.',
  review: 'Mixed problems that revisit earlier ideas.',
};

export function KindBadge({ kind }: { kind: Problem['kind'] }) {
  return <span className="badge">{KIND_LABEL[kind]}</span>;
}

export function DifficultyBadge({ level }: { level: 1 | 2 | 3 }) {
  const words = ['Easy', 'Medium', 'Hard'];
  return (
    <span className="badge" title={`Difficulty ${level} of 3`}>
      <span aria-hidden="true">
        {'●'.repeat(level)}
        {'○'.repeat(3 - level)}
      </span>{' '}
      {words[level - 1]}
    </span>
  );
}
