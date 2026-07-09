import { Parser } from 'expr-eval';

const parserCache = new Map<string, any>();

export function evaluateMath(rawValue: number, equation?: string | null): number {
    if (!equation) return rawValue;
    // Remove common whitespace quirks
    const cleanEq = equation.trim();
    if (!cleanEq || cleanEq === 'X' || cleanEq === '1.0*X') return rawValue;

    let parser = parserCache.get(cleanEq);
    if (!parser) {
        try {
            parser = new Parser().parse(cleanEq);
            parserCache.set(cleanEq, parser);
        } catch (err) {
            console.error(`Failed to parse equation "${cleanEq}":`, err);
            return rawValue; // fallback
        }
    }
    try {
        return parser.evaluate({ X: rawValue });
    } catch (err) {
        console.error(`Failed to evaluate equation "${cleanEq}" with X=${rawValue}:`, err);
        return rawValue;
    }
}