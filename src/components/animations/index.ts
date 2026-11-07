import type { ComponentType } from 'react';
import { createElement } from 'react';
import { animationDefs } from './definitions';
import { LedgerAnimation } from './LedgerStage';

export interface AnimationEntry {
  title: string;
  component: ComponentType;
}

/**
 * Registry of step-through animations, by id:
 * cash-to-checking, bank-view-deposit, loan-creates-deposit, daily-accrual, fbo-gross-up.
 */
export const animations: Record<string, AnimationEntry> = Object.fromEntries(
  animationDefs.map((def) => {
    const component = () => createElement(LedgerAnimation, { def });
    component.displayName = `Animation(${def.id})`;
    return [def.id, { title: def.title, component }];
  }),
);

export { animationDefs } from './definitions';
export { StepAnimation, usePrefersReducedMotion } from './StepAnimation';
export type { StepAnimationProps, StageContext } from './StepAnimation';
export { LedgerAnimation } from './LedgerStage';
export { AnimationGallery } from './AnimationGallery';
export type * from './model';
