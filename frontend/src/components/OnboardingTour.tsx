import { useEffect, useRef, useState, type CSSProperties } from 'react';
import type { TourStep } from '../config/tourSteps';

interface Props {
  open: boolean;
  stepIndex: number;
  steps: TourStep[];
  onNext: () => void;
  onBack: () => void;
  onSkip: () => void;
}

interface TourLayout {
  top: number;
  left: number;
  width: number;
  height: number;
  cardTop: number;
  cardLeft: number;
  transform: string;
}

const CARD_WIDTH = 360;
const CARD_HEIGHT = 240;
const SPOTLIGHT_PADDING = 8;

function measureLayout(target: DOMRect, position: TourStep['position']): TourLayout {
  const width = target.width + SPOTLIGHT_PADDING * 2;
  const height = target.height + SPOTLIGHT_PADDING * 2;
  const top = target.top - SPOTLIGHT_PADDING;
  const left = target.left - SPOTLIGHT_PADDING;
  const gap = 16;
  const isNarrow = window.innerWidth < 600;
  let cardTop = 0;
  let cardLeft = 0;
  let transform = '';

  if (isNarrow || position === 'bottom') {
    cardLeft = (window.innerWidth - CARD_WIDTH) / 2;
    cardTop = target.bottom + gap;
    transform = 'translateY(0)';
  } else if (position === 'top') {
    cardLeft = target.left + target.width / 2;
    cardTop = target.top - gap;
    transform = 'translate(-50%, -100%)';
  } else if (position === 'left') {
    cardLeft = target.left - gap;
    cardTop = target.top + target.height / 2;
    transform = 'translate(-100%, -50%)';
  } else {
    cardLeft = target.right + gap;
    cardTop = target.top + target.height / 2;
    transform = 'translateY(-50%)';
  }

  cardLeft = Math.min(Math.max(12, cardLeft), Math.max(12, window.innerWidth - CARD_WIDTH - 12));
  cardTop = Math.min(Math.max(12, cardTop), Math.max(12, window.innerHeight - CARD_HEIGHT - 12));

  return { top, left, width, height, cardTop, cardLeft, transform };
}

export default function OnboardingTour({ open, stepIndex, steps, onNext, onBack, onSkip }: Props) {
  const [layout, setLayout] = useState<TourLayout | null>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const step = steps[stepIndex];

  useEffect(() => {
    if (!open || !step) {
      setLayout(null);
      return;
    }

    let frame = 0;
    let attempts = 0;
    let observer: ResizeObserver | undefined;
    let target: Element | null = null;

    const updateLayout = () => {
      target = document.querySelector(step.element);
      if (!target) {
        if (attempts++ < 10) frame = window.requestAnimationFrame(updateLayout);
        return;
      }
      const rect = target.getBoundingClientRect();
      setLayout(measureLayout(rect, step.position));
    };

    frame = window.requestAnimationFrame(() => {
      target = document.querySelector(step.element);
      target?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
      updateLayout();
      if (target && 'ResizeObserver' in window) {
        observer = new ResizeObserver(updateLayout);
        observer.observe(target);
      }
    });

    window.addEventListener('resize', updateLayout);
    window.addEventListener('scroll', updateLayout, true);
    return () => {
      window.cancelAnimationFrame(frame);
      observer?.disconnect();
      window.removeEventListener('resize', updateLayout);
      window.removeEventListener('scroll', updateLayout, true);
    };
  }, [open, step]);

  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onSkip();
      if (event.key === 'Tab') {
        const buttons = dialogRef.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)');
        if (!buttons?.length) return;
        const first = buttons[0];
        const last = buttons[buttons.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    dialogRef.current?.querySelector('button')?.focus();
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [open, onSkip]);

  if (!open || !step) return null;

  const cardStyle: CSSProperties | undefined = layout
    ? {
      top: layout.cardTop,
      left: layout.cardLeft,
      transform: layout.transform,
    }
    : undefined;

  return (
    <div className="onboarding-tour" role="presentation">
      <svg className="onboarding-tour-dim" aria-hidden="true" focusable="false">
        <defs>
          <mask id="onboarding-tour-mask" maskUnits="userSpaceOnUse" maskContentUnits="userSpaceOnUse">
            <rect width="100%" height="100%" fill="white" />
            {layout && <rect x={layout.left} y={layout.top} width={layout.width} height={layout.height} rx="12" fill="black" />}
          </mask>
        </defs>
        <rect width="100%" height="100%" fill="rgba(9, 20, 15, .78)" mask="url(#onboarding-tour-mask)" />
      </svg>
      {layout && (
        <div
          className="onboarding-tour-spotlight"
          aria-hidden="true"
          style={{ top: layout.top, left: layout.left, width: layout.width, height: layout.height }}
        />
      )}
      <section ref={dialogRef} className="onboarding-tour-card" style={cardStyle} role="dialog" aria-modal="true" aria-labelledby="onboarding-tour-title">
        <p className="onboarding-tour-kicker">STUDY HUB TOUR · {stepIndex + 1} OF {steps.length}</p>
        <h2 id="onboarding-tour-title">{step.title}</h2>
        <p>{step.description}</p>
        <div className="onboarding-tour-progress" role="progressbar" aria-label="Tour progress" aria-valuemin={1} aria-valuemax={steps.length} aria-valuenow={stepIndex + 1}>
          {steps.map((item, index) => <span key={item.element} className={index <= stepIndex ? 'is-complete' : ''} />)}
        </div>
        <div className="onboarding-tour-actions">
          <button type="button" className="onboarding-tour-skip" onClick={onSkip}>Skip</button>
          {stepIndex > 0 && <button type="button" className="onboarding-tour-back" onClick={onBack}>Back</button>}
          <button type="button" className="onboarding-tour-next" onClick={onNext}>
            {stepIndex === steps.length - 1 ? 'Finish & open AI tutor' : 'Next'}
          </button>
        </div>
      </section>
    </div>
  );
}
