import { statusColor } from '../../lib/format'

interface Props {
  status: string
  label?: string
}

export default function Badge({ status, label }: Props) {
  return (
    <span className={statusColor(status)}>
      {label ?? status.replace('_', ' ')}
    </span>
  )
}
