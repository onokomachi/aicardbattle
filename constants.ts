
import type { CardData } from './types';

export const INITIAL_HP = 20;
export const HAND_SIZE = 5;
export const DECK_SIZE = 20;
export const MAX_DUPLICATES = 4;
export const INITIAL_UNLOCKED_CARDS: number[] = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

// 管理者のメールアドレスリスト。ここにメールアドレスを追加すると、そのユーザーだけがGameMasterボタンを見ることができます。
// 空配列の場合は、ログインしている全てのユーザーにボタンが表示されます（開発用）。
export const ADMIN_EMAILS: string[] = [
    // "your-email@example.com"
];

export const GAMEMASTER_PASSWORD = '215124';


// 注：このアプリを正しく動作させるには、プロジェクトのルートに`public`フォルダを作成し、
// その中に`Image2`という名前のフォルダを配置してください。
// 下の`image`プロパティの値は、そのフォルダ内のファイル名と完全に一致している必要があります。
//
// NOTE: To run this app correctly, create a `public` folder in the project root,
// and place your `Image2` folder inside it. The `image` property values below
// must exactly match the filenames within `/public/Image2/`.

// This catalog contains all possible card DEFINITIONS.
// The `id` property here is the card's definition ID, used for lookups and unlocks.
// It is distinct from the instance ID assigned to each card in a deck during a game.
// FIX: Changed the type of CARD_DEFINITIONS to CardData[] and cast the array literal.
// This ensures the object properties match the CardData type and that the final array is correctly typed.
export const CARD_DEFINITIONS: CardData[] = ([
  // --- Base Cards (Definition IDs 0-9) ---
  {
    name: "エレガントな貴族",
    attack: 7,
    defense: 7,
    image: "1.jpeg",
    description: "非の打ち所がないスタイルを持つ、バランスの取れた戦士。",
    effect: 'NONE',
    attribute: 'passion',
    level: 1,
    unlocks: 10, // Unlocks "至高の貴族"
    baseDefinitionId: 0,
  },
  {
    name: "輝く花嫁",
    attack: 2,
    defense: 6,
    image: "2.jpeg",
    description: "場に出した時、その誓いがあなたのHPを3回復する。",
    effect: 'HEAL_PLAYER',
    effectValue: 3,
    attribute: 'harmony',
    level: 1,
    unlocks: 11, // Unlocks "永遠の花嫁"
    baseDefinitionId: 1,
  },
  {
    name: "ステージアイドル",
    attack: 5,
    defense: 5,
    image: "3.jpeg",
    description: "ステージ上で輝く、万能なパフォーマー。",
    effect: 'NONE',
    attribute: 'harmony',
    level: 1,
    unlocks: 12, // Unlocks "センターアイドル"
    baseDefinitionId: 2,
  },
  {
    name: "バレーのエース",
    attack: 10,
    defense: 1,
    image: "4.jpeg",
    description: "ブロックすることがほぼ不可能な、全力のスパイク。",
    effect: 'NONE',
    attribute: 'passion',
    baseDefinitionId: 3,
  },
  {
    name: "怜悧な探偵",
    attack: 4,
    defense: 4,
    image: "5.jpeg",
    description: "場に出した時、その鋭い知性がカードを1枚引かせる。",
    effect: 'DRAW_CARD',
    effectValue: 1,
    attribute: 'calm',
    baseDefinitionId: 4,
  },
  {
    name: "陽気なマスコット",
    attack: 3,
    defense: 3,
    image: "6.jpeg",
    description: "場に出した時、その元気な応援がHPを2回復する。",
    effect: 'HEAL_PLAYER',
    effectValue: 2,
    attribute: 'harmony',
    baseDefinitionId: 5,
  },
  {
    name: "屈強なチャンピオン",
    attack: 9,
    defense: 4,
    image: "7.jpeg",
    description: "厳しいトレーニングで磨かれた、圧倒的なパワー。",
    effect: 'NONE',
    attribute: 'passion',
    baseDefinitionId: 6,
  },
  {
    name: "サッカーのストライカー",
    attack: 7,
    defense: 2,
    image: "8.jpeg",
    description: "場に出した時、2ダメージのシュートを放つ。",
    effect: 'DIRECT_DAMAGE',
    effectValue: 2,
    attribute: 'passion',
    baseDefinitionId: 7,
  },
  {
    name: "忠実な執事",
    attack: 1,
    defense: 11,
    image: "9.jpeg",
    description: "あらゆる動きを先読みする完璧な防御。",
    effect: 'NONE',
    attribute: 'calm',
    baseDefinitionId: 8,
  },
  {
    name: "マイクドロップ・ラッパー",
    attack: 4,
    defense: 3,
    image: "10.jpeg",
    description: "場に出した時、そのリリックが3ダメージを与える。",
    effect: 'DIRECT_DAMAGE',
    effectValue: 3,
    attribute: 'calm',
    baseDefinitionId: 9,
  },
  // --- Leveled Cards (Definition IDs 10+) ---
  {
    name: "至高の貴族",
    attack: 8,
    defense: 8,
    image: "12.jpeg",
    description: "更に高められた品格。場に出た時、1ダメージを与える。",
    effect: 'DIRECT_DAMAGE',
    effectValue: 1,
    attribute: 'passion',
    level: 2,
    unlocks: 13, // Unlocks "気高き皇帝"
    baseDefinitionId: 0,
  },
  {
    name: "永遠の花嫁",
    attack: 3,
    defense: 8,
    image: "14.jpeg",
    description: "永遠の愛を誓い、HPを5回復する。",
    effect: 'HEAL_PLAYER',
    effectValue: 5,
    attribute: 'harmony',
    level: 2,
    unlocks: 14, // Unlocks "女神の花嫁"
    baseDefinitionId: 1,
  },
  {
    name: "センターアイドル",
    attack: 6,
    defense: 6,
    image: "16.jpeg",
    description: "ファンの声援に応え、カードを1枚引く。",
    effect: 'DRAW_CARD',
    effectValue: 1,
    attribute: 'harmony',
    level: 2,
    unlocks: 15, // Unlocks "伝説のアイドル"
    baseDefinitionId: 2,
  },
  {
    name: "気高き皇帝",
    attack: 10,
    defense: 10,
    image: "13.jpeg",
    description: "絶対的な風格。場に出た時、3ダメージを与える。",
    effect: 'DIRECT_DAMAGE',
    effectValue: 3,
    attribute: 'passion',
    level: 3,
    baseDefinitionId: 0,
  },
  {
    name: "女神の花嫁",
    attack: 5,
    defense: 10,
    image: "15.jpeg",
    description: "女神の祝福がHPを8回復させる。",
    effect: 'HEAL_PLAYER',
    effectValue: 8,
    attribute: 'harmony',
    level: 3,
    baseDefinitionId: 1,
  },
  {
    name: "伝説のアイドル",
    attack: 7,
    defense: 7,
    image: "17.jpeg",
    description: "伝説のステージ。カードを2枚引かせる。",
    effect: 'DRAW_CARD',
    effectValue: 2,
    attribute: 'harmony',
    level: 3,
    baseDefinitionId: 2,
  },
] as Omit<CardData, 'id' | 'definitionId'>[]).map((card, index) => ({ ...card, definitionId: index, id: index }));

export const CardCatalogById = CARD_DEFINITIONS.reduce((acc, card) => {
  acc[card.definitionId] = card;
  return acc;
}, {} as Record<number, CardData>);