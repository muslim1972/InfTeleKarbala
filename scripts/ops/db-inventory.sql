\pset format unaligned
\pset tuples_only on
select case when n.nspname = 'public' then 'F|'||p.proname else 'F|'||n.nspname||'.'||p.proname end
from pg_proc p 
join pg_namespace n on n.oid=p.pronamespace 
left join pg_depend d on d.objid=p.oid and d.deptype='e' 
where n.nspname in ('public', 'itpc') and d.objid is null 
group by n.nspname, p.proname;

select case when table_schema = 'public' then 'T|'||table_name else 'T|'||table_schema||'.'||table_name end
from information_schema.tables 
where table_schema in ('public', 'itpc');

select 'B|'||id from storage.buckets;
