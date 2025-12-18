import { BackgroundService } from '@/lib/background/backgroundService'

export default defineBackground(() => {
  const service = new BackgroundService()
  service.initialize()
})
