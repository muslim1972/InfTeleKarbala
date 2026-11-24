#!/bin/bash
echo "=== 1. Docker containers ==="
docker ps --format "table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}"

echo -e "\n=== 2. Looking for band or capacities in nginx / caddy / web servers ==="
docker ps | grep -iE 'nginx|caddy|proxy|web'
find /etc -type f -name "*nginx*.conf" -o -name "*caddy*" 2>/dev/null | xargs grep -rn "band" 2>/dev/null

echo -e "\n=== 3. Search for directory or files named 'band' ==="
find /home/muslim -maxdepth 3 -name "*band*" 2>/dev/null
find /var/www -maxdepth 3 2>/dev/null

echo -e "\n=== 4. Search in Supabase DB for table payments columns ==="
CONTAINER=$(docker ps -q -f name=db | head -n1)
if [ -z "$CONTAINER" ]; then
    CONTAINER=$(docker ps -q -f name=postgres | head -n1)
fi

echo "DB Container: $CONTAINER"
if [ -n "$CONTAINER" ]; then
    docker exec -i "$CONTAINER" psql -U postgres -d postgres -c "
        SELECT table_schema, table_name, column_name, data_type, is_nullable
        FROM information_schema.columns 
        WHERE table_name = 'payments'
        ORDER BY ordinal_position;
    "
fi

echo -e "\n=== 5. Search for any table with official_book or payments in DB ==="
if [ -n "$CONTAINER" ]; then
    docker exec -i "$CONTAINER" psql -U postgres -d postgres -c "
        SELECT table_schema, table_name, column_name 
        FROM information_schema.columns 
        WHERE column_name LIKE '%official%' OR column_name LIKE '%book%' OR table_name LIKE '%payment%';
    "
fi
