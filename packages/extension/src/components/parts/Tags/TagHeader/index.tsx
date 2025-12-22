import { Tag } from 'lucide-react'

import { useNavigation } from '@/components/hooks/providers/useNavigationProvider'

import Button from '@/components/ui/Button'

import styles from './styles.module.css'

export default function TagHeader() {
  const { navigate } = useNavigation()
  return (
    <div className={styles.header}>
      <Button
        onClick={() => navigate('/tag')}
        asIcon={true}
        size='sm'
        color='primary'
        variant='solid'
      >
        <Tag strokeWidth={1} size={18} />
      </Button>
    </div>
  )
}
