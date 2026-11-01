#!/usr/bin/env node
/**
 * 手書きの暫定カタログを src/catalog/catalog.json に出力する。
 * Rebrickable API キーを用意したら scripts/build-catalog.mjs で本物に置き換えること。
 *
 * ⚠ ここの BrickLink 色ID (bl_id) と「このパーツがこの色で存在するか」は記憶ベースで未検証。
 *   build-catalog.mjs は Rebrickable API の external_ids / elements.csv から正しい値を取る。
 */
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const out = resolve(here, '../src/catalog/catalog.json')

// [rebrickable id, name, name_ja, rgb, is_trans, bricklink id(未検証)]
const COLORS = [
  [4, 'Red', 'あか', 'C91A09', false, 5],
  [1, 'Blue', 'あお', '0055BF', false, 7],
  [14, 'Yellow', 'きいろ', 'F2CD37', false, 3],
  [2, 'Green', 'みどり', '237841', false, 6],
  [10, 'Bright Green', 'あかるいみどり', '4B9F4A', false, 36],
  [27, 'Lime', 'きみどり', 'BBE90B', false, 34],
  [25, 'Orange', 'オレンジ', 'FE8A18', false, 4],
  [15, 'White', 'しろ', 'FFFFFF', false, 1],
  [0, 'Black', 'くろ', '05131D', false, 11],
  [71, 'Light Bluish Gray', 'うすいグレー', 'A0A5A9', false, 86],
  [72, 'Dark Bluish Gray', 'こいグレー', '6C6E68', false, 85],
  [19, 'Tan', 'ベージュ', 'E4CD9E', false, 2],
  [28, 'Dark Tan', 'こいベージュ', '958A73', false, 69],
  [70, 'Reddish Brown', 'ちゃいろ', '582A12', false, 88],
  [84, 'Medium Nougat', 'うすちゃいろ', 'AA7D55', false, 150],
  [272, 'Dark Blue', 'こいあお', '0A3463', false, 63],
  [73, 'Medium Blue', 'みずいろ', '5A93DB', false, 42],
  [321, 'Dark Azure', 'アズール', '078BC9', false, 153],
  [322, 'Medium Azure', 'うすアズール', '36AEBF', false, 156],
  [212, 'Bright Light Blue', 'うすいあお', '9FC3E9', false, 105],
  [288, 'Dark Green', 'こいみどり', '184632', false, 80],
  [320, 'Dark Red', 'こいあか', '720E0F', false, 59],
  [5, 'Dark Pink', 'こいピンク', 'C870A0', false, 47],
  [29, 'Bright Pink', 'ピンク', 'E4ADC8', false, 104],
  [191, 'Bright Light Orange', 'うすいオレンジ', 'F8BB3D', false, 110],
  [226, 'Bright Light Yellow', 'うすいきいろ', 'FFF03A', false, 103],
  [85, 'Dark Purple', 'むらさき', '3F3691', false, 89],
  [47, 'Trans-Clear', 'とうめい', 'FCFCFC', true, 12],
  [36, 'Trans-Red', 'とうめい・あか', 'C91A09', true, 17],
  [41, 'Trans-Light Blue', 'とうめい・みずいろ', 'AEEFEC', true, 15],
  [42, 'Trans-Neon Green', 'とうめい・きみどり', 'F8F184', true, 16],
]

const CATEGORIES = [
  ['brick', 'ブロック', '🧱'],
  ['plate', 'プレート', '▬'],
  ['tile', 'タイル', '◻️'],
  ['slope', 'スロープ', '📐'],
  ['round', 'まるいの', '⚪'],
  ['technic', 'テクニック', '⚙️'],
  ['wheel', 'タイヤ・くるま', '🚗'],
  ['window', 'まど・ドア', '🚪'],
  ['nature', 'はな・き', '🌳'],
  ['minifig', 'ミニフィグ', '🧑'],
  ['special', 'とくべつ', '✨'],
]

const BASIC = [4, 1, 14, 2, 25, 15, 0, 71, 72, 19, 70, 272, 73, 321, 288, 320, 5, 29, 191, 27, 85, 10]
const GRAY = [15, 0, 71, 72, 19, 70]
const TRANS = [47, 36, 41, 42]

// [num, name, name_ja, category, colors, score]
const PARTS = [
  ['3001', 'Brick 2 x 4', 'ブロック 2×4', 'brick', BASIC, 100],
  ['3003', 'Brick 2 x 2', 'ブロック 2×2', 'brick', BASIC, 95],
  ['3004', 'Brick 1 x 2', 'ブロック 1×2', 'brick', BASIC, 98],
  ['3005', 'Brick 1 x 1', 'ブロック 1×1', 'brick', [...BASIC, ...TRANS], 90],
  ['3010', 'Brick 1 x 4', 'ブロック 1×4', 'brick', BASIC, 92],
  ['3009', 'Brick 1 x 6', 'ブロック 1×6', 'brick', BASIC, 85],
  ['3008', 'Brick 1 x 8', 'ブロック 1×8', 'brick', BASIC, 80],
  ['3002', 'Brick 2 x 3', 'ブロック 2×3', 'brick', BASIC, 82],
  ['2456', 'Brick 2 x 6', 'ブロック 2×6', 'brick', BASIC, 78],
  ['3007', 'Brick 2 x 8', 'ブロック 2×8', 'brick', BASIC, 70],
  ['2357', 'Brick 2 x 2 Corner', 'かどブロック 2×2', 'brick', BASIC, 75],
  ['3245c', 'Brick 1 x 2 x 2', 'たかいブロック 1×2×2', 'brick', BASIC, 60],
  ['3622', 'Brick 1 x 3', 'ブロック 1×3', 'brick', BASIC, 84],
  ['98283', 'Brick 1 x 2 with Masonry Profile', 'レンガもようブロック 1×2', 'brick', BASIC, 65],
  ['30136', 'Brick 1 x 2 Log', 'まるたブロック 1×2', 'brick', [70, 19, 28, 84, 72, 71], 55],
  ['4070', 'Brick 1 x 1 with Headlight', 'ヘッドライトブロック', 'brick', BASIC, 70],
  ['87087', 'Brick 1 x 1 with Stud on Side', 'よこポッチブロック 1×1', 'brick', BASIC, 72],
  ['3020', 'Plate 2 x 4', 'プレート 2×4', 'plate', BASIC, 100],
  ['3021', 'Plate 2 x 3', 'プレート 2×3', 'plate', BASIC, 85],
  ['3022', 'Plate 2 x 2', 'プレート 2×2', 'plate', BASIC, 95],
  ['3023', 'Plate 1 x 2', 'プレート 1×2', 'plate', BASIC, 100],
  ['3024', 'Plate 1 x 1', 'プレート 1×1', 'plate', [...BASIC, ...TRANS], 95],
  ['3623', 'Plate 1 x 3', 'プレート 1×3', 'plate', BASIC, 80],
  ['3710', 'Plate 1 x 4', 'プレート 1×4', 'plate', BASIC, 95],
  ['3666', 'Plate 1 x 6', 'プレート 1×6', 'plate', BASIC, 85],
  ['3460', 'Plate 1 x 8', 'プレート 1×8', 'plate', BASIC, 75],
  ['3795', 'Plate 2 x 6', 'プレート 2×6', 'plate', BASIC, 85],
  ['3034', 'Plate 2 x 8', 'プレート 2×8', 'plate', BASIC, 78],
  ['3832', 'Plate 2 x 10', 'プレート 2×10', 'plate', BASIC, 60],
  ['3031', 'Plate 4 x 4', 'プレート 4×4', 'plate', BASIC, 70],
  ['3032', 'Plate 4 x 6', 'プレート 4×6', 'plate', BASIC, 72],
  ['3035', 'Plate 4 x 8', 'プレート 4×8', 'plate', BASIC, 65],
  ['3958', 'Plate 6 x 6', 'プレート 6×6', 'plate', BASIC, 55],
  ['3036', 'Plate 6 x 8', 'プレート 6×8', 'plate', BASIC, 55],
  ['3033', 'Plate 6 x 10', 'プレート 6×10', 'plate', BASIC, 50],
  ['2420', 'Plate 2 x 2 Corner', 'かどプレート 2×2', 'plate', BASIC, 70],
  ['3176', 'Plate 3 x 2 with Hole', 'あなあきプレート 3×2', 'plate', BASIC, 50],
  ['99780', 'Bracket 1 x 2 - 1 x 2 Inverted', 'ブラケット（L字）', 'plate', BASIC, 65],
  ['3068b', 'Tile 2 x 2', 'タイル 2×2', 'tile', BASIC, 90],
  ['3069b', 'Tile 1 x 2', 'タイル 1×2', 'tile', [...BASIC, ...TRANS], 95],
  ['3070b', 'Tile 1 x 1', 'タイル 1×1', 'tile', [...BASIC, ...TRANS], 90],
  ['2431', 'Tile 1 x 4', 'タイル 1×4', 'tile', BASIC, 85],
  ['6636', 'Tile 1 x 6', 'タイル 1×6', 'tile', BASIC, 75],
  ['4162', 'Tile 1 x 8', 'タイル 1×8', 'tile', BASIC, 65],
  ['2412b', 'Tile 1 x 2 Grille', 'みぞタイル 1×2', 'tile', BASIC, 70],
  ['3794b', 'Plate 1 x 2 with 1 Stud (Jumper)', 'ジャンパープレート 1×2', 'tile', BASIC, 80],
  ['87580', 'Plate 2 x 2 with 1 Stud (Jumper)', 'ジャンパープレート 2×2', 'tile', BASIC, 75],
  ['3040b', 'Slope 45° 2 x 1', 'スロープ 45° 2×1', 'slope', BASIC, 85],
  ['3039', 'Slope 45° 2 x 2', 'スロープ 45° 2×2', 'slope', BASIC, 80],
  ['3298', 'Slope 33° 3 x 2', 'スロープ 33° 3×2', 'slope', BASIC, 65],
  ['3665', 'Slope Inverted 45° 2 x 1', 'さかさスロープ 45° 2×1', 'slope', BASIC, 70],
  ['3660', 'Slope Inverted 45° 2 x 2', 'さかさスロープ 45° 2×2', 'slope', BASIC, 65],
  ['85984', 'Slope 30° 1 x 2 x 2/3', 'ひくいスロープ 1×2', 'slope', BASIC, 85],
  ['54200', 'Slope 30° 1 x 1 x 2/3 (Cheese)', 'チーズスロープ 1×1', 'slope', [...BASIC, ...TRANS], 95],
  ['11477', 'Slope Curved 2 x 1', 'カーブスロープ 2×1', 'slope', BASIC, 90],
  ['15068', 'Slope Curved 2 x 2 x 2/3', 'カーブスロープ 2×2', 'slope', BASIC, 85],
  ['93273', 'Slope Curved 4 x 1 Double', 'カーブスロープ 4×1', 'slope', BASIC, 70],
  ['3062b', 'Brick Round 1 x 1', 'まるブロック 1×1', 'round', [...BASIC, ...TRANS], 85],
  ['3941', 'Brick Round 2 x 2', 'まるブロック 2×2', 'round', BASIC, 70],
  ['4073', 'Plate Round 1 x 1', 'まるプレート 1×1', 'round', [...BASIC, ...TRANS], 95],
  ['4032a', 'Plate Round 2 x 2', 'まるプレート 2×2', 'round', BASIC, 75],
  ['98138', 'Tile Round 1 x 1', 'まるタイル 1×1', 'round', [...BASIC, ...TRANS], 90],
  ['14769', 'Tile Round 2 x 2', 'まるタイル 2×2', 'round', BASIC, 75],
  ['4740', 'Dish 2 x 2 Inverted', 'おさら 2×2', 'round', BASIC, 60],
  ['3942c', 'Cone 2 x 2 x 2', 'コーン 2×2', 'round', BASIC, 55],
  ['4589', 'Cone 1 x 1', 'コーン 1×1', 'round', [...BASIC, ...TRANS], 65],
  ['3700', 'Technic Brick 1 x 2 with Hole', 'テクニックブロック 1×2', 'technic', BASIC, 80],
  ['3701', 'Technic Brick 1 x 4 with Holes', 'テクニックブロック 1×4', 'technic', BASIC, 75],
  ['32316', 'Technic Beam 1 x 5', 'テクニックビーム 5', 'technic', GRAY.concat([4, 1, 14]), 70],
  ['32524', 'Technic Beam 1 x 7', 'テクニックビーム 7', 'technic', GRAY.concat([4, 1, 14]), 65],
  ['3705', 'Technic Axle 4', 'アクスル 4', 'technic', [0, 71, 72], 75],
  ['3706', 'Technic Axle 6', 'アクスル 6', 'technic', [0, 71, 72], 65],
  ['2780', 'Technic Pin with Friction', 'テクニックピン', 'technic', [0, 71], 90],
  ['3673', 'Technic Pin without Friction', 'テクニックピン（ゆるい）', 'technic', [71, 19], 70],
  ['6558', 'Technic Pin Long with Friction', 'ながいピン', 'technic', [1, 0], 65],
  ['3713', 'Technic Bush', 'ブッシュ', 'technic', [71, 72, 14], 60],
  ['3647', 'Technic Gear 8 Tooth', 'ギア 8', 'technic', [72, 71], 55],
  ['3648', 'Technic Gear 24 Tooth', 'ギア 24', 'technic', [72, 71], 50],
  ['4624', 'Wheel 8mm D. x 6mm', 'ホイール（ちいさい）', 'wheel', [71, 15, 14, 0], 70],
  ['3641', 'Tyre 15mm D. x 6mm', 'タイヤ（ちいさい）', 'wheel', [0], 70],
  ['6014b', 'Wheel 11mm D. x 12mm', 'ホイール（ふつう）', 'wheel', [71, 15, 0, 14], 75],
  ['6015', 'Tyre 21mm D. x 12mm', 'タイヤ（ふつう）', 'wheel', [0], 75],
  ['55982', 'Wheel 18mm D. x 14mm', 'ホイール（おおきい）', 'wheel', [71, 15, 0], 60],
  ['30648', 'Tyre 43.2mm D. x 14mm', 'タイヤ（おおきい）', 'wheel', [0], 55],
  ['4600', 'Plate 2 x 2 with Wheel Holders', 'タイヤつけプレート 2×2', 'wheel', [0, 71, 72, 15, 4], 75],
  ['2926', 'Plate 1 x 4 with Wheel Holders', 'タイヤつけプレート 1×4', 'wheel', [0, 71, 72], 60],
  ['3829c01', 'Steering Wheel 1 x 2', 'ハンドル', 'wheel', [0, 71, 72], 65],
  ['60592', 'Window 1 x 2 x 2', 'まどわく 1×2×2', 'window', [15, 19, 0, 70, 71, 72, 4, 1], 70],
  ['60601', 'Glass for Window 1 x 2 x 2', 'まどガラス 1×2×2', 'window', [47, 41], 70],
  ['60593', 'Window 1 x 2 x 3', 'まどわく 1×2×3', 'window', [15, 19, 0, 70, 71, 72], 60],
  ['60602', 'Glass for Window 1 x 2 x 3', 'まどガラス 1×2×3', 'window', [47, 41], 60],
  ['60596', 'Door Frame 1 x 4 x 6', 'ドアわく 1×4×6', 'window', [15, 19, 0, 70, 71, 72], 55],
  ['60623', 'Door 1 x 4 x 6 with Stud Handle', 'ドア 1×4×6', 'window', [15, 19, 0, 70, 4, 1, 72], 55],
  ['3741', 'Plant Flower Stem', 'おはなのくき', 'nature', [2, 10, 288], 70],
  ['3742', 'Plant Flower Small', 'おはな（ちいさい）', 'nature', [4, 14, 15, 29, 1, 5, 25], 70],
  ['2423', 'Plant Leaves 4 x 3', 'はっぱ 4×3', 'nature', [2, 10, 288, 27, 70], 65],
  ['6064', 'Plant Bush', 'しげみ', 'nature', [2, 288, 10], 55],
  ['2417', 'Plant Leaves 6 x 5', 'はっぱ 6×5', 'nature', [2, 288, 10, 70], 55],
  ['33291', 'Plant Flower Plate 1 x 1 Round', 'おはなプレート 1×1', 'nature', [4, 14, 15, 29, 1, 5, 25, 27, 10], 75],
  ['3626b', 'Minifig Head Plain', 'ミニフィグのあたま', 'minifig', [14, 78], 60],
  ['3833', 'Minifig Construction Helmet', 'ヘルメット', 'minifig', [14, 4, 1, 15, 0, 25], 55],
  ['3901', 'Minifig Hair Male', 'かみのけ（みじかい）', 'minifig', [0, 70, 14, 72, 25], 50],
  ['3899', 'Minifig Cup', 'コップ', 'minifig', [15, 4, 1, 14, 2, 47], 60],
  ['3837', 'Minifig Shovel', 'シャベル', 'minifig', [0, 72, 71], 50],
  ['6124', 'Minifig Wand', 'まほうのつえ', 'minifig', [0, 70, 15, 47], 50],
  ['2343', 'Minifig Goblet', 'ゴブレット', 'minifig', [47, 71, 14], 45],
  ['30374', 'Bar 4L (Lightsaber Blade)', 'ライトセーバー', 'minifig', [36, 41, 42, 47], 60],
  ['3957a', 'Antenna 1 x 4', 'アンテナ', 'special', [0, 71, 72, 15, 47], 55],
  ['4081b', 'Plate 1 x 1 with Clip Light', 'クリップつきプレート 1×1', 'special', BASIC, 65],
  ['3937', 'Hinge Brick 1 x 2 Base', 'ヒンジブロック（した）', 'special', BASIC, 60],
  ['3938', 'Hinge Brick 1 x 2 Top', 'ヒンジブロック（うえ）', 'special', BASIC, 60],
  ['3747b', 'Slope Inverted 33° 3 x 2', 'さかさスロープ 33° 3×2', 'slope', BASIC, 50],
  ['2444', 'Plate 2 x 2 with Hole', 'あなあきプレート 2×2', 'special', BASIC, 55],
  ['3794a', 'Plate 1 x 2 with 1 Stud (no groove)', 'ジャンパー（ふるいタイプ）', 'special', BASIC, 40],
  ['3680', 'Turntable 2 x 2 Base', 'ターンテーブル（した）', 'special', [0, 71, 72, 15], 55],
  ['3679', 'Turntable 2 x 2 Top', 'ターンテーブル（うえ）', 'special', [0, 71, 72, 15, 4, 1], 55],
  ['2540', 'Plate 1 x 2 with Handle', 'ハンドルつきプレート', 'special', BASIC, 55],
  ['60470a', 'Plate 1 x 2 with 2 Clips', 'クリップ2つのプレート', 'special', BASIC, 60],
  ['3933', 'Wedge Plate 4 x 2 Left', 'つばさプレート（ひだり）', 'special', BASIC, 55],
  ['3934', 'Wedge Plate 4 x 2 Right', 'つばさプレート（みぎ）', 'special', BASIC, 55],
  ['3822', 'Door 1 x 3 x 1 Left', 'くるまのドア（ひだり）', 'window', BASIC, 45],
  ['3821', 'Door 1 x 3 x 1 Right', 'くるまのドア（みぎ）', 'window', BASIC, 45],
  ['3024', 'Plate 1 x 1', 'プレート 1×1', 'plate', [...BASIC, ...TRANS], 95],
]

const seen = new Set()
const parts = []
for (const [num, name, name_ja, category, colors, score] of PARTS) {
  if (seen.has(num)) continue
  seen.add(num)
  parts.push({
    num,
    name,
    name_ja,
    category,
    bl_id: null, // 未検証。null の場合アプリは part_num を BrickLink ID として使う
    colors: [...new Set(colors)].map((color_id) => ({ color_id, element_id: null })),
    score,
  })
}

const catalog = {
  generated_at: new Date().toISOString(),
  source: 'starter (hand-written, unverified). Run scripts/build-catalog.mjs to replace.',
  colors: COLORS.map(([id, name, name_ja, rgb, is_trans, bl_id]) => ({ id, name, name_ja, rgb, is_trans, bl_id })),
  categories: CATEGORIES.map(([id, name_ja, emoji]) => ({ id, name_ja, emoji })),
  parts,
}

mkdirSync(dirname(out), { recursive: true })
writeFileSync(out, JSON.stringify(catalog, null, 1))
console.log(`wrote ${out}: ${parts.length} parts, ${COLORS.length} colors`)
