-- Ouroboros: PUBLIC keeps EXECUTE on new functions (per-schema default privileges only add to
-- the global ones), so each function must revoke it explicitly. save_product is security
-- invoker and RLS already blocks anon writes; this closes the door anyway.
revoke execute on function public.save_product(uuid, jsonb, uuid[], uuid[], jsonb) from public, anon;
