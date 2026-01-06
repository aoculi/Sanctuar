import { Plus } from 'lucide-react'

import { useNavigation } from '@/components/hooks/providers/useNavigationProvider'

import Button from '@/components/ui/Button'

import styles from './styles.module.css'

export default function CollectionHeader() {
  const { navigate } = useNavigation()

  return (
    <div className={styles.container}>
      <div className={styles.actionsContainer}>
        <Button
          asIcon={true}
          color='light'
          onClick={() => navigate('/collection')}
          size='sm'
          title='Create a new collection'
        >
          <Plus strokeWidth={2} size={16} />
        </Button>
      </div>
    </div>
  )
}
