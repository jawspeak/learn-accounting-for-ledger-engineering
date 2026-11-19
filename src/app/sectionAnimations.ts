/** Which step-through "Watch it" animations appear on which section page (VISION-2 §9). Also indexed by search. */
export const SECTION_ANIMATIONS: Record<string, string[]> = {
  '03-t-accounts': ['cash-to-checking'],
  '04-perspectives': ['bank-view-deposit'],
  '06-loans': ['loan-creates-deposit'],
  '08-accruals': ['daily-accrual'],
  '11-fintech': ['fbo-gross-up'],
};

/** Element ids on the section page, so `#/s/<id>?at=…` (and search results) can jump to a block. */
export const watchAnchor = (animationId: string) => `watch-${animationId}`;
export const calloutAnchor = (index: number) => `callout-${index + 1}`;
export const LENS_ANCHOR = 'lens';
