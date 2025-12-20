import Header from '@/components/parts/Header'

const useSession = () => {
  return {
    hasValidSession: true
  }
}

export default function Root() {
  const { hasValidSession } = useSession()

  return (
    <div>
      <Header />
      <div>content</div>
    </div>
  )
}
