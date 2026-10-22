cat /tmp/fix_core_resolve_approval_chain.sql | docker exec -i supabase-db psql -U supabase_admin -d postgres
docker exec -i supabase-db psql -U supabase_admin -d postgres -c "SELECT * FROM public.core_resolve_approval_chain('d2c4eef8-72cc-4dd1-a734-00d5ebe94f6d');"
