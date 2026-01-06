import usePopupSize from '@/components/hooks/usePopupSize'

import CollectionHeader from '@/components/parts/Collections/CollectionHeader'
import CollectionList from '@/components/parts/Collections/CollectionList'
import Header from '@/components/parts/Header'

import styles from './styles.module.css'

export default function Collections() {
  usePopupSize('compact')

  return (
    <div className={styles.component}>
      <Header title='Collections' canSwitchToVault={true} />
      <div className={styles.content}>
        <CollectionHeader />
        <CollectionList />
      </div>
    </div>
  )
}
