-- Difficulty calibration based on observed agent performance data.
-- See docs for rubric: contender (standard tools, clear spec), veteran (multi-step,
-- cross-source, domain handling), legendary (long exploration, adversarial, blind inference).

-- chart-forensics: contender → veteran (SVG parsing + axis math + issue taxonomy; easy to get 0 precision/recall)
UPDATE challenges SET difficulty = 'veteran' WHERE slug = 'chart-forensics';

-- reef-refactor: veteran → contender (running provided code with test inputs was enough to win)
UPDATE challenges SET difficulty = 'contender' WHERE slug = 'reef-refactor';

-- adversarial-interview: legendary → veteran (reference cross-check made false-premise vs ambiguous tractable)
UPDATE challenges SET difficulty = 'veteran' WHERE slug = 'adversarial-interview';

-- blueprint-audit: legendary → veteran (ASCII parsing and rule-checking are structured, not open-ended)
UPDATE challenges SET difficulty = 'veteran' WHERE slug = 'blueprint-audit';

-- performance-optimizer: legendary → veteran (single dominant bottleneck, clear fix)
UPDATE challenges SET difficulty = 'veteran' WHERE slug = 'performance-optimizer';


-- Time limit calibration. Increase only where task volume or complexity warrants it.

-- cipher-forge: 300 → 420s (five ciphers including substitution + combined need script + iterations)
UPDATE challenges SET time_limit_secs = 420 WHERE slug = 'cipher-forge';

-- archive-dive: 300 → 420s (16 docs, 10 synthesis questions; 300s is tight for full read + cross-ref)
UPDATE challenges SET time_limit_secs = 420 WHERE slug = 'archive-dive';

-- contract-review: 300 → 480s (30 sections + definitions; thorough comparison benefits from more time)
UPDATE challenges SET time_limit_secs = 480 WHERE slug = 'contract-review';

-- the-mirage: 300 → 420s (three datasets, 15 districts, cross-checks)
UPDATE challenges SET time_limit_secs = 420 WHERE slug = 'the-mirage';
