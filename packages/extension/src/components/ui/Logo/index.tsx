import { Library } from 'lucide-react'

import Text from '@/components/ui/Text'

import styles from './styles.module.css'

export default function Logo() {
  return (
    <div className={styles.logo}>
      <Library strokeWidth={2} size={24} />
      <Text as='span' size='3' weight='medium' color='text'>
        LockMark
      </Text>
    </div>
  )
}
