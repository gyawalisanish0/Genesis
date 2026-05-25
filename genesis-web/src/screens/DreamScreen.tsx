import { useScreen }            from '../navigation/useScreen'
import { SCREEN_IDS }           from '../navigation/screenRegistry'
import { VisualNovelCanvas }    from '../components/VisualNovelCanvas'

export function DreamScreen() {
  const { navigateTo } = useScreen()
  return (
    <VisualNovelCanvas
      scriptId="opening"
      onComplete={() => navigateTo(SCREEN_IDS.MAIN_MENU)}
    />
  )
}
