import { NAME_MAX_LENGTH } from '../constants'

interface Props {
  name: string
  onChange: (name: string) => void
}

/**
 * Optional bill title. Styled as a heading rather than a form field so a
 * screenshot of a named bill reads as a title; an empty one stays unobtrusive.
 */
export function BillNameInput({ name, onChange }: Props) {
  return (
    <div className="mb-6">
      <input
        type="text"
        value={name}
        onChange={e => onChange(e.target.value)}
        maxLength={NAME_MAX_LENGTH}
        placeholder="Bill name"
        aria-label="Bill name"
        autoComplete="off"
        className="w-full text-xl font-semibold text-gray-900 placeholder-gray-400 bg-transparent border-0 border-b border-transparent hover:border-gray-200 focus:border-blue-500 focus:outline-none px-0 py-1 min-h-[44px] rounded-none"
      />
    </div>
  )
}
