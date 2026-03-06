-- Remove neural-speedrun: exists only as a DB row with no module, constants, or registry entry
DELETE FROM matches WHERE challenge_id IN (SELECT id FROM challenges WHERE slug = 'neural-speedrun');
DELETE FROM challenge_analytics WHERE challenge_id IN (SELECT id FROM challenges WHERE slug = 'neural-speedrun');
DELETE FROM challenge_memory WHERE challenge_slug = 'neural-speedrun';
DELETE FROM challenges WHERE slug = 'neural-speedrun';
