import { useEffect, useId } from 'react'

interface ResetModalProps {
  // Whether there is anything for each partial option to clear. An option
  // with nothing to clear is shown but disabled, so the list never changes
  // shape under a finger.
  hasParticipants: boolean
  hasItems: boolean
  onClearParticipants: () => void
  onClearItems: () => void
  onResetAll: () => void
  onCancel: () => void
}

interface ResetOption {
  label: string
  description: string
  onSelect: () => void
  disabled: boolean
  // Reset all is the most destructive choice, so only it is filled red.
  emphasis: 'outline' | 'solid'
}

/**
 * Lets the person clear part of the bill or all of it. Each option acts in one
 * tap: opening the modal is the first step, and each option says what it
 * clears and what it keeps. Focus starts on Cancel so a stray Enter or tap on
 * open clears nothing.
 */
export function ResetModal({
  hasParticipants,
  hasItems,
  onClearParticipants,
  onClearItems,
  onResetAll,
  onCancel,
}: ResetModalProps) {
  const titleId = useId()
  const descriptionPrefix = useId()

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onCancel])

  const options: ResetOption[] = [
    {
      label: 'Clear participants',
      description: 'Removes everyone. Your items, the bill name, tax, tip, and fees are kept for the next people you add.',
      onSelect: onClearParticipants,
      disabled: !hasParticipants,
      emphasis: 'outline',
    },
    {
      label: 'Clear items',
      description: 'Removes every item and the bill name. Participants, tax, tip, and fees stay.',
      onSelect: onClearItems,
      disabled: !hasItems,
      emphasis: 'outline',
    },
    {
      label: 'Reset all',
      description: 'Clears the whole bill, including its name, and starts over.',
      onSelect: onResetAll,
      disabled: false,
      emphasis: 'solid',
    },
  ]

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      aria-modal="true"
      role="dialog"
      aria-labelledby={titleId}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40"
        onClick={onCancel}
        aria-hidden="true"
      />

      {/* Dialog */}
      <div className="relative bg-white rounded-xl shadow-lg w-full max-w-sm p-6">
        <h2 id={titleId} className="text-base font-semibold text-gray-900 mb-1">
          Reset bill
        </h2>
        <p className="text-sm text-gray-500 mb-4">Choose what to clear. This can't be undone.</p>
        <ul className="flex flex-col gap-4 mb-6">
          {options.map((option, index) => {
            const descriptionId = `${descriptionPrefix}-${index}`
            return (
              <li key={option.label}>
                <button
                  onClick={option.onSelect}
                  disabled={option.disabled}
                  aria-describedby={descriptionId}
                  className={
                    option.emphasis === 'solid'
                      ? 'w-full min-h-[44px] px-4 py-2 text-sm font-medium text-white bg-red-500 hover:bg-red-600 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed'
                      : 'w-full min-h-[44px] px-4 py-2 text-sm font-medium text-red-600 border border-red-200 hover:border-red-300 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent'
                  }
                >
                  {option.label}
                </button>
                <p id={descriptionId} className="mt-1 text-xs text-gray-500">
                  {option.description}
                </p>
              </li>
            )
          })}
        </ul>
        <div className="flex justify-end">
          <button
            onClick={onCancel}
            autoFocus
            className="min-h-[44px] px-4 py-2 text-sm text-gray-600 hover:text-gray-800 border border-gray-200 hover:border-gray-300 rounded-lg transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
