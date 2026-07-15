-- Permite a fase 'third_place' (disputa de 3º lugar) em matches.phase.
-- O check constraint original não a incluía, então o insert do jogo de 3º
-- lugar pelo admin falhava com 400 vindo do PostgREST.

alter table matches drop constraint matches_phase_check;

alter table matches add constraint matches_phase_check
  check (phase = any (array['groups', 'r32', 'r16', 'qf', 'sf', 'third_place', 'final']::text[]));
