/**
 * パーツ画像が無い／読めないときに出す簡易イラスト。カテゴリごとに形を変え、色はカタログの RGB。
 * 公開版では Rebrickable の画像が上に重なり、読み込めた時点でこちらは隠れる。
 */
interface Props {
  category: string
  rgb: string
  isTrans?: boolean
  label?: string
}

export function PartGlyph({ category, rgb, isTrans, label }: Props) {
  const fill = `#${rgb}`
  const dark = luminance(rgb) < 0.35
  const stroke = dark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.35)'
  const opacity = isTrans ? 0.55 : 1
  const stud = (x: number, y: number) => <ellipse key={`${x},${y}`} cx={x} cy={y} rx={8} ry={4} fill={fill} stroke={stroke} strokeWidth={2} />
  let body: React.ReactNode
  switch (category) {
    case 'small-plate':
    case 'basic-plate':
      body = (
        <>
          <path d="M14 62 L50 48 L86 62 L50 76 Z" fill={fill} stroke={stroke} strokeWidth={2} />
          <path d="M14 62 L50 76 L50 86 L14 72 Z" fill={fill} stroke={stroke} strokeWidth={2} style={{ filter: 'brightness(0.8)' }} />
          <path d="M86 62 L50 76 L50 86 L86 72 Z" fill={fill} stroke={stroke} strokeWidth={2} style={{ filter: 'brightness(0.65)' }} />
          {stud(32, 55)}
          {stud(50, 48)}
          {stud(68, 55)}
        </>
      )
      break
    case 'small-tile':
      body = (
        <>
          <path d="M14 60 L50 44 L86 60 L50 76 Z" fill={fill} stroke={stroke} strokeWidth={2} />
          <path d="M14 60 L50 76 L50 84 L14 68 Z" fill={fill} stroke={stroke} strokeWidth={2} style={{ filter: 'brightness(0.8)' }} />
          <path d="M86 60 L50 76 L50 84 L86 68 Z" fill={fill} stroke={stroke} strokeWidth={2} style={{ filter: 'brightness(0.65)' }} />
        </>
      )
      break
    case 'round':
      body = (
        <>
          <ellipse cx={50} cy={62} rx={30} ry={14} fill={fill} stroke={stroke} strokeWidth={2} style={{ filter: 'brightness(0.75)' }} />
          <rect x={20} y={40} width={60} height={22} fill={fill} />
          <ellipse cx={50} cy={40} rx={30} ry={14} fill={fill} stroke={stroke} strokeWidth={2} />
          {stud(50, 36)}
        </>
      )
      break
    case 'joint':
      body = (
        <>
          <path d="M18 70 L50 56 L82 70 L50 84 Z" fill={fill} stroke={stroke} strokeWidth={2} />
          <rect x={44} y={34} width={12} height={26} fill={fill} stroke={stroke} strokeWidth={2} />
          <circle cx={50} cy={30} r={13} fill={fill} stroke={stroke} strokeWidth={2} />
          <circle cx={46} cy={26} r={4} fill="rgba(255,255,255,0.45)" />
        </>
      )
      break
    case 'clip':
      body = (
        <>
          <path d="M18 70 L50 56 L82 70 L50 84 Z" fill={fill} stroke={stroke} strokeWidth={2} />
          <path d="M36 56 V32 a14 14 0 0 1 28 0 V56" fill="none" stroke={fill} strokeWidth={9} strokeLinecap="round" />
          <path d="M36 56 V32 a14 14 0 0 1 28 0 V56" fill="none" stroke={stroke} strokeWidth={2} />
        </>
      )
      break
    case 'hinge':
      body = (
        <>
          <path d="M12 72 L46 58 L58 64 L24 78 Z" fill={fill} stroke={stroke} strokeWidth={2} />
          <path d="M54 62 L54 24 L66 24 L66 66 Z" fill={fill} stroke={stroke} strokeWidth={2} style={{ filter: 'brightness(0.85)' }} />
          <circle cx={56} cy={62} r={5} fill={stroke} />
        </>
      )
      break
    case 'snot':
      body = (
        <>
          <path d="M28 34 h36 v40 h-36 z" fill={fill} stroke={stroke} strokeWidth={2} />
          <path d="M64 34 l14 -8 v40 l-14 8 z" fill={fill} stroke={stroke} strokeWidth={2} style={{ filter: 'brightness(0.7)' }} />
          <ellipse cx={46} cy={54} rx={9} ry={9} fill={fill} stroke={stroke} strokeWidth={2} style={{ filter: 'brightness(0.9)' }} />
          {stud(46, 34)}
        </>
      )
      break
    case 'technic':
      body = (
        <>
          <path d="M14 56 L50 40 L86 56 L50 72 Z" fill={fill} stroke={stroke} strokeWidth={2} />
          <path d="M14 56 L50 72 L50 84 L14 68 Z" fill={fill} stroke={stroke} strokeWidth={2} style={{ filter: 'brightness(0.8)' }} />
          <path d="M86 56 L50 72 L50 84 L86 68 Z" fill={fill} stroke={stroke} strokeWidth={2} style={{ filter: 'brightness(0.65)' }} />
          <ellipse cx={32} cy={70} rx={6} ry={5} fill="rgba(0,0,0,0.5)" />
          <ellipse cx={68} cy={70} rx={6} ry={5} fill="rgba(0,0,0,0.5)" />
        </>
      )
      break
    case 'wheel':
      body = (
        <>
          <ellipse cx={50} cy={56} rx={30} ry={30} fill="#222" stroke="rgba(255,255,255,0.3)" strokeWidth={2} />
          <circle cx={50} cy={56} r={16} fill={fill} stroke={stroke} strokeWidth={2} />
          <circle cx={50} cy={56} r={5} fill="rgba(0,0,0,0.4)" />
        </>
      )
      break
    case 'robot':
      body = (
        <>
          <path d="M30 78 L30 40 L42 40 L42 56 L70 56 L70 68 L42 68 L42 78 Z" fill={fill} stroke={stroke} strokeWidth={2} />
          <circle cx={36} cy={32} r={9} fill={fill} stroke={stroke} strokeWidth={2} />
        </>
      )
      break
    default:
      body = (
        <>
          <path d="M14 50 L50 34 L86 50 L50 66 Z" fill={fill} stroke={stroke} strokeWidth={2} />
          <path d="M14 50 L50 66 L50 88 L14 72 Z" fill={fill} stroke={stroke} strokeWidth={2} style={{ filter: 'brightness(0.8)' }} />
          <path d="M86 50 L50 66 L50 88 L86 72 Z" fill={fill} stroke={stroke} strokeWidth={2} style={{ filter: 'brightness(0.65)' }} />
          {stud(32, 43)}
          {stud(50, 35)}
          {stud(68, 43)}
          {stud(50, 51)}
        </>
      )
  }
  return (
    <svg viewBox="0 0 100 100" className="part-glyph" aria-hidden="true" style={{ opacity }}>
      {body}
      {label && (
        <text x={50} y={97} textAnchor="middle" fontSize={9} fill="rgba(0,0,0,0.5)">
          {label}
        </text>
      )}
    </svg>
  )
}

function luminance(hex: string): number {
  const n = parseInt(hex.slice(0, 6), 16)
  if (Number.isNaN(n)) return 1
  const r = (n >> 16) & 255
  const g = (n >> 8) & 255
  const b = n & 255
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255
}
