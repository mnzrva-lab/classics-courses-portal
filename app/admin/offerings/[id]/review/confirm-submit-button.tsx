'use client'

type Props = {
  children: React.ReactNode
  confirmMessage: string
  className?: string
}

export default function ConfirmSubmitButton({ children, confirmMessage, className = 'button' }: Props) {
  return (
    <button
      className={className}
      type="submit"
      onClick={(event) => {
        if (!window.confirm(confirmMessage)) event.preventDefault()
      }}
    >
      {children}
    </button>
  )
}
