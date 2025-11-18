/**
 * RNG Abstraction
 * 
 * Pluggable random number generation system supporting:
 * - Deterministic seeded RNG for replay/testing
 * - Override RNG for controlled scenarios ("next draw is X")
 * - True random RNG for production
 */

import seedrandom from 'seedrandom';

/**
 * RNG interface - all implementations must provide these methods
 */
export interface RNG {
  /**
   * Returns a random number in [0, 1)
   */
  next(): number;

  /**
   * Shuffles an array in place using Fisher-Yates algorithm
   */
  shuffle<T>(array: T[]): T[];

  /**
   * Picks a random element from an array
   */
  pick<T>(array: T[]): T;

  /**
   * Returns a copy of this RNG (for state preservation)
   */
  clone(): RNG;
}

/**
 * Seeded RNG - deterministic random number generation
 */
export class SeededRNG implements RNG {
  private prng: seedrandom.PRNG;
  private seed: string;

  constructor(seed: string) {
    this.seed = seed;
    this.prng = seedrandom(seed);
  }

  next(): number {
    return this.prng();
  }

  shuffle<T>(array: T[]): T[] {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  pick<T>(array: T[]): T {
    if (array.length === 0) {
      throw new Error('Cannot pick from empty array');
    }
    const index = Math.floor(this.next() * array.length);
    return array[index];
  }

  clone(): RNG {
    return new SeededRNG(this.seed);
  }
}

/**
 * Override RNG - returns predetermined values for controlled testing
 * 
 * Usage: const rng = new OverrideRNG([0.5, 0.3, 0.8]);
 * Subsequent calls to next() return 0.5, 0.3, 0.8, then throw
 */
export class OverrideRNG implements RNG {
  private values: number[];
  private index: number = 0;

  constructor(values: number[]) {
    this.values = values;
  }

  next(): number {
    if (this.index >= this.values.length) {
      throw new Error('OverrideRNG exhausted all predetermined values');
    }
    return this.values[this.index++];
  }

  shuffle<T>(array: T[]): T[] {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  pick<T>(array: T[]): T {
    if (array.length === 0) {
      throw new Error('Cannot pick from empty array');
    }
    const index = Math.floor(this.next() * array.length);
    return array[index];
  }

  clone(): RNG {
    const cloned = new OverrideRNG([...this.values]);
    cloned.index = this.index;
    return cloned;
  }
}

/**
 * Random RNG - uses crypto.getRandomValues for true randomness
 */
export class RandomRNG implements RNG {
  next(): number {
    const buffer = new Uint32Array(1);
    globalThis.crypto.getRandomValues(buffer);
    return buffer[0] / 0xffffffff;
  }

  shuffle<T>(array: T[]): T[] {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  pick<T>(array: T[]): T {
    if (array.length === 0) {
      throw new Error('Cannot pick from empty array');
    }
    const index = Math.floor(this.next() * array.length);
    return array[index];
  }

  clone(): RNG {
    // RandomRNG has no state to clone
    return new RandomRNG();
  }
}
