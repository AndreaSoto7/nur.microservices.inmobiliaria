import { memo } from 'react'
import { STEP_LABELS, WIZARD_STEPS, type WizardStep } from '../propertyWizard'

interface WizardStepsProps {
  current: WizardStep
  /** Hasta qué paso se puede saltar (índice). */
  reachable: number
  onSelect: (step: WizardStep) => void
}

/** Dumb: los pasos del asistente como una barra segmentada. Los ya alcanzados se pueden tocar. */
export const WizardSteps = memo(function WizardSteps({
  current,
  reachable,
  onSelect,
}: WizardStepsProps) {
  const currentIndex = WIZARD_STEPS.indexOf(current)
  return (
    <nav className="wizard-steps" aria-label="Pasos">
      <p className="wizard-steps__caption" aria-hidden="true">
        Paso {currentIndex + 1} de {WIZARD_STEPS.length} · {STEP_LABELS[current]}
      </p>
      <ol className="wizard-steps__list">
        {WIZARD_STEPS.map((step, index) => {
          const state = index < currentIndex ? 'done' : index === currentIndex ? 'current' : 'next'
          return (
            <li key={step} className={`wizard-steps__item is-${state}`}>
              <button
                type="button"
                className="wizard-steps__button"
                aria-current={state === 'current' ? 'step' : undefined}
                disabled={index > reachable}
                onClick={() => onSelect(step)}
              >
                <span className="wizard-steps__bar" aria-hidden="true" />
                <span className="wizard-steps__label">
                  <span className="wizard-steps__number">{index + 1}.</span> {STEP_LABELS[step]}
                </span>
              </button>
            </li>
          )
        })}
      </ol>
    </nav>
  )
})
