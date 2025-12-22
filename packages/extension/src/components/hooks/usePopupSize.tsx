export default function usePopupSize(size: 'compact' | 'large' = 'compact') {
  useEffect(() => {
    if (size === 'compact') {
      document.body.classList.remove('large')
      if (!document.body.classList.contains('compact')) {
        document.body.classList.add('compact')
      }
    } else {
      document.body.classList.remove('compact')
      if (!document.body.classList.contains('large')) {
        document.body.classList.add('large')
      }
    }
  }, [size])
  return {}
}
