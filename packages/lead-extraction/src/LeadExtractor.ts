/**
 * @xhi/lead-extraction — LeadExtractor
 *
 * Three-stage pipeline for extracting phone numbers from live stream comments:
 *   1. clean()    → Strip emojis, special chars, normalize whitespace
 *   2. extract()  → Sliding-window regex to find numeric sequences (8–15 digits)
 *   3. validate() → Country-pattern matching with confidence scoring
 *
 * @module LeadExtractor
 */

// ═══════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════

export interface ExtractedNumber {
  /** The raw numeric string found in the comment */
  raw: string;
  /** Cleaned version with only digits */
  digits: string;
  /** Position in the original cleaned string */
  position: number;
}

export interface ValidatedLead {
  /** The phone number (digits only) */
  phoneNumber: string;
  /** ISO country code if matched */
  countryCode: string | null;
  /** Confidence score 0.0 – 1.0 */
  confidenceScore: number;
  /** Which country pattern matched */
  matchedPattern: string | null;
}

export interface ExtractionResult {
  /** Original input */
  originalInput: string;
  /** Cleaned input */
  cleanedInput: string;
  /** All numeric sequences found */
  extracted: ExtractedNumber[];
  /** Validated leads with confidence scores */
  validated: ValidatedLead[];
}

// ═══════════════════════════════════════════════════════════════════════════
// Country Patterns — Extend as needed
// ═══════════════════════════════════════════════════════════════════════════

interface CountryPattern {
  code: string;
  name: string;
  /** Regex applied to the full digit string */
  pattern: RegExp;
  /** Base confidence when pattern matches */
  confidence: number;
}

const COUNTRY_PATTERNS: CountryPattern[] = [
  // Tunisia (+216) — 8 digits after country code
  { code: 'TN', name: 'Tunisia',       pattern: /^(216)?[2-9]\d{7}$/,             confidence: 0.90 },
  // France (+33) — 9 digits after country code
  { code: 'FR', name: 'France',        pattern: /^(33)?[1-9]\d{8}$/,              confidence: 0.85 },
  // Morocco (+212) — 9 digits after country code
  { code: 'MA', name: 'Morocco',       pattern: /^(212)?[5-7]\d{8}$/,             confidence: 0.85 },
  // Algeria (+213) — 9 digits after country code
  { code: 'DZ', name: 'Algeria',       pattern: /^(213)?[5-7]\d{8}$/,             confidence: 0.85 },
  // Saudi Arabia (+966) — 9 digits after country code
  { code: 'SA', name: 'Saudi Arabia',  pattern: /^(966)?5\d{8}$/,                 confidence: 0.85 },
  // UAE (+971) — 9 digits after country code
  { code: 'AE', name: 'UAE',           pattern: /^(971)?5\d{8}$/,                 confidence: 0.85 },
  // Egypt (+20) — 10 digits after country code
  { code: 'EG', name: 'Egypt',         pattern: /^(20)?1[0-2]\d{8}$/,             confidence: 0.85 },
  // US/Canada (+1) — 10 digits
  { code: 'US', name: 'US/Canada',     pattern: /^1?[2-9]\d{2}[2-9]\d{6}$/,       confidence: 0.80 },
  // UK (+44) — 10 digits after country code
  { code: 'GB', name: 'United Kingdom', pattern: /^(44)?7\d{9}$/,                 confidence: 0.85 },
  // Generic international (8–15 digits, starts with non-zero)
  { code: null as unknown as string, name: 'International', pattern: /^[1-9]\d{7,14}$/, confidence: 0.40 },
];

// ═══════════════════════════════════════════════════════════════════════════
// LeadExtractor Class
// ═══════════════════════════════════════════════════════════════════════════

export class LeadExtractor {
  // ─────────────────────────────────────────────────────────────────────────
  // Stage 1: Clean
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Remove emojis, special characters, and normalize whitespace.
   * Preserves digits, letters, periods, plus signs, dashes, and spaces.
   */
  clean(input: string): string {
    if (!input || typeof input !== 'string') return '';

    let result = input;

    // Remove emojis and symbols (covers most Unicode emoji ranges)
    result = result.replace(
      /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{FE00}-\u{FE0F}]|[\u{1F900}-\u{1F9FF}]|[\u{200D}]|[\u{20E3}]|[\u{E0020}-\u{E007F}]/gu,
      ' ',
    );

    // Keep digits, letters, plus, dash, period, and whitespace
    result = result.replace(/[^\d\w+\-.\s]/g, ' ');

    // Normalize multiple spaces to single space
    result = result.replace(/\s+/g, ' ').trim();

    return result;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Stage 2: Extract
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Sliding-window regex to find numeric sequences of 8–15 digits.
   * Handles numbers separated by dots, dashes, spaces, or mixed with letters.
   *
   * Examples:
   *   "t4255678984"        → extracts "4255678984"
   *   "55678984t42"        → extracts "55678984" and "42"
   *   "25.654*322"         → extracts "25654322"
   *   "+216 55 678 984"    → extracts "21655678984"
   */
  extract(input: string): ExtractedNumber[] {
    if (!input || typeof input !== 'string') return [];

    const results: ExtractedNumber[] = [];
    const cleaned = this.clean(input);

    // ── Pattern 1: Numbers with separators (dots, dashes, spaces) ──
    // Matches sequences like "25.654.322" or "55 678 984" or "+216-55-678"
    const separatorPattern = /(?:\+?\d[\d.\-\s]{6,18}\d)/g;
    let match: RegExpExecArray | null;

    while ((match = separatorPattern.exec(cleaned)) !== null) {
      const raw = match[0];
      const digits = raw.replace(/\D/g, '');
      if (digits.length >= 8 && digits.length <= 15) {
        results.push({
          raw,
          digits,
          position: match.index,
        });
      }
    }

    // ── Pattern 2: Digits embedded in/around letters ──
    // Extracts digit-runs from strings like "t4255678984" → "4255678984"
    const embeddedPattern = /(?<!\d)\d{8,15}(?!\d)/g;
    const searchStr = cleaned;

    while ((match = embeddedPattern.exec(searchStr)) !== null) {
      const digits = match[0];
      // Avoid duplicates from Pattern 1
      const isDuplicate = results.some((r) => r.digits === digits);
      if (!isDuplicate) {
        results.push({
          raw: match[0],
          digits,
          position: match.index,
        });
      }
    }

    return results;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Stage 3: Validate
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Check a numeric string against country-specific patterns and assign
   * a confidence_score (0.0 – 1.0).
   *
   * The confidence score is determined by:
   *   - Base score from the matching country pattern
   *   - Bonus for having a recognizable country code prefix
   *   - Penalty for very short or very long numbers
   */
  validate(number: string): ValidatedLead {
    const digits = number.replace(/\D/g, '');

    // Reject obviously invalid numbers
    if (digits.length < 8 || digits.length > 15 || /^0+$/.test(digits)) {
      return {
        phoneNumber: digits,
        countryCode: null,
        confidenceScore: 0,
        matchedPattern: null,
      };
    }

    let bestMatch: ValidatedLead = {
      phoneNumber: digits,
      countryCode: null,
      confidenceScore: 0,
      matchedPattern: null,
    };

    for (const pattern of COUNTRY_PATTERNS) {
      if (pattern.pattern.test(digits)) {
        let score = pattern.confidence;

        // Bonus: number length is in the sweet spot (8–12 digits)
        if (digits.length >= 8 && digits.length <= 12) {
          score = Math.min(1.0, score + 0.05);
        }

        // Bonus: starts with a known country code prefix
        const hasCountryPrefix = /^(1|20|33|44|212|213|216|966|971)/.test(digits);
        if (hasCountryPrefix && pattern.code) {
          score = Math.min(1.0, score + 0.05);
        }

        if (score > bestMatch.confidenceScore) {
          bestMatch = {
            phoneNumber: digits,
            countryCode: pattern.code || null,
            confidenceScore: Math.round(score * 100) / 100,
            matchedPattern: pattern.name,
          };
        }
      }
    }

    return bestMatch;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Full Pipeline
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Run the full extraction pipeline on an input string.
   * Returns all extracted numbers with their validation results.
   */
  process(input: string): ExtractionResult {
    const cleanedInput = this.clean(input);
    const extracted = this.extract(input);
    const validated = extracted.map((e) => this.validate(e.digits));

    return {
      originalInput: input,
      cleanedInput,
      extracted,
      validated,
    };
  }
}

export default LeadExtractor;
