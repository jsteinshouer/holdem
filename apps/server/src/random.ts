import { randomBytes } from "node:crypto";
import { type Card, type CardRank, type CardSuit } from "@friendly-holdem/shared";

export function createDeck(): Card[] {
  const suits: CardSuit[] = ["clubs", "diamonds", "hearts", "spades"];
  const ranks: CardRank[] = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"];

  return suits.flatMap((suit) => ranks.map((rank) => ({ rank, suit })));
}

export function shuffleDeck(deck: Card[]): Card[] {
  const shuffled = [...deck];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const randomIndex = randomInt(index + 1);
    const currentCard = shuffled[index];
    const randomCard = shuffled[randomIndex];

    if (!currentCard || !randomCard) {
      throw new Error("Deck shuffle attempted to read outside the deck.");
    }

    shuffled[index] = randomCard;
    shuffled[randomIndex] = currentCard;
  }

  return shuffled;
}

export function randomInt(exclusiveMax: number): number {
  const randomLimit = Math.floor(0x100000000 / exclusiveMax) * exclusiveMax;
  let value = randomBytes(4).readUInt32BE(0);

  while (value >= randomLimit) {
    value = randomBytes(4).readUInt32BE(0);
  }

  return value % exclusiveMax;
}

export function drawCard(deck: Card[]): Card {
  const card = deck.pop();

  if (!card) {
    throw new Error("The deck is empty.");
  }

  return card;
}

export function randomToken(byteLength: number): string {
  return randomBytes(byteLength).toString("base64url");
}
