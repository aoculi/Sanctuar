import { BookOpenText, Library, Settings2 } from 'lucide-react'

import Button from '@/components/ui/Button'
import Text from '@/components/ui/Text'

import styles from './styles.module.css'

export default function Header() {
  // const {hasSession} = useSession()

  const ToggleSizeAction = () => {
    if (document.body.classList.contains('large')) {
      document.body.classList.remove('large')
      document.body.classList.add('compact')
    } else {
      document.body.classList.add('large')
      document.body.classList.remove('compact')
    }
  }

  return (
    <div className={styles.component}>
      <div className={styles.content}>
        <div className={styles.left}>
          <div className={styles.leftIcon}>
            <Library strokeWidth={2} size={20} color='orange' />
          </div>

          <Text as='h1' size='2' weight='medium'>
            LockMark
          </Text>
        </div>

        <div className={styles.right}>
          <Button onClick={ToggleSizeAction} variant='ghost'>
            <BookOpenText strokeWidth={2} size={18} color='white' />
          </Button>
          <Button variant='ghost'>
            <Settings2 strokeWidth={2} size={18} color='white' />
          </Button>
        </div>
      </div>
    </div>
  )
}
