\pset format unaligned
\pset tuples_only on
select 'F|'||p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace left join pg_depend d on d.objid=p.oid and d.deptype='e' where n.nspname='public' and d.objid is null group by p.proname;
select 'T|'||table_name from information_schema.tables where table_schema='public';
select 'B|'||id from storage.buckets;
