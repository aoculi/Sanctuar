import { useAuthSession } from '@/components/hooks/providers/useAuthSessionProvider'
import { STORAGE_KEYS } from '@/lib/constants'
import { getStorageItem } from '@/lib/storage'
import { ManifestV1 } from '@/lib/types'

import Header from '@/components/parts/Header'
import Button from '@/components/ui/Button'

import styles from './styles.module.css'

export default function Bookmarks() {
  const { clearSession } = useAuthSession()

  const getManifest = async () => {
    const manifest = await getStorageItem<ManifestV1>(STORAGE_KEYS.MANIFEST)
    console.log('get manifest', manifest)
  }
  getManifest()

  return (
    <div className={styles.component}>
      <Header displaySwitchToBookmarks={true} />
      <Button onClick={() => clearSession()}>Logout</Button>
    </div>
  )
}
