docker exec -i supabase-db psql -U postgres -d postgres -c "\d public_holidays" -c "\d official_holidays"
