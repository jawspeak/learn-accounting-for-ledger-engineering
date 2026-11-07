import type { SectionModule } from '@contracts';

/** Phase-0 skeleton. Owned by C2. */
const mod: SectionModule = {
  section: {
    id: 'review',
    number: 99,
    title: 'Mixed Review',
    summary: 'Interleaved problems from every section.',
    primer: 'Problems from every section, mixed together.',
    problemIds: [],
  },
  problems: [],
};
export default mod;
