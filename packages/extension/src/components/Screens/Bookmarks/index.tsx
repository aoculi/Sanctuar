import usePopupSize from '@/components/hooks/usePopupSize'
import { STORAGE_KEYS } from '@/lib/constants'
import { getStorageItem } from '@/lib/storage'
import { ManifestV1 } from '@/lib/types'

import Header from '@/components/parts/Header'

import styles from './styles.module.css'

export default function Bookmarks() {
  usePopupSize('large')

  const getManifest = async () => {
    const manifest = await getStorageItem<ManifestV1>(STORAGE_KEYS.MANIFEST)

    if (manifest) {
      manifest.items.forEach((item) => {
        console.log('item', item)
      })
    }
  }
  getManifest()

  return (
    <div className={styles.component}>
      <Header canSwitchToBookmark={true} />
      <div>BOOKMARKS LIST</div>
    </div>
  )
}
