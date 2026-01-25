import { Loader2 } from 'lucide-react'

import styles from './styles.module.css'

interface LoadingScreenProps {
  /** Size of the spinner icon (default: 32) */
  size?: number
}

export default function LoadingScreen({ size = 32 }: LoadingScreenProps) {
  return (
    <div className={styles.container}>
      <Loader2 size={size} className={styles.spinner} />
    </div>
  )
}
