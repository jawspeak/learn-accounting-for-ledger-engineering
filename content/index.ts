/**
 * Content registry. Auto-discovers entity and section modules — no need to edit this file when adding content.
 *  - content/entities/<id>.ts       default-exports EntityCoA
 *  - content/sections/<id>/index.ts default-exports SectionModule
 *  - content/review/index.ts        default-exports SectionModule (section id 'review')
 */
import type { EntityCoA, Problem, Section, SectionModule } from '@contracts';

const entityModules = import.meta.glob<{ default: EntityCoA }>('./entities/*.ts', { eager: true });
const sectionModules = import.meta.glob<{ default: SectionModule }>(
  ['./sections/*/index.ts', './review/index.ts'],
  { eager: true },
);

export const entities: Record<string, EntityCoA> = Object.fromEntries(
  Object.values(entityModules).map((m) => [m.default.id, m.default]),
);

export const sections: Section[] = Object.values(sectionModules)
  .map((m) => m.default.section)
  .sort((a, b) => a.number - b.number);

export const problems: Record<string, Problem> = Object.fromEntries(
  Object.values(sectionModules).flatMap((m) => m.default.problems.map((p) => [p.id, p])),
);

export function sectionProblems(section: Section): Problem[] {
  return section.problemIds.map((id) => problems[id]).filter((p): p is Problem => !!p);
}
