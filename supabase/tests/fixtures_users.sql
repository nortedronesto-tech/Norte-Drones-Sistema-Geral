-- Usuários de teste (equivalem a linhas de auth.users do Supabase).
insert into auth.users (id, email) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'nortedronesto@gmail.com'),  -- vira admin (bootstrap)
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'richiteradm@gmail.com'),    -- sócio em partners
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'fin@exemplo.com'),
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'ler@exemplo.com'),
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'ninguem@exemplo.com'),
  ('ffffffff-ffff-ffff-ffff-ffffffffffff', 'desligado@exemplo.com');
