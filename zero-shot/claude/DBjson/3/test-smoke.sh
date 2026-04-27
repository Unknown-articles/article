#!/usr/bin/env bash
set -e
DB=/tmp/smoke-test-$$.json
echo '{"_users":[],"_teams":[]}' > "$DB"

PORT=3099 DB_PATH="$DB" node src/index.js &
PID=$!
sleep 2

BASE="http://localhost:3099"
H="Content-Type: application/json"

echo "--- Register admin (alice) ---"
curl -sf -X POST "$BASE/auth/register" -H "$H" -d '{"username":"alice","password":"pass"}' | python3 -m json.tool

echo "--- Register user (bob) ---"
curl -sf -X POST "$BASE/auth/register" -H "$H" -d '{"username":"bob","password":"pass"}' | python3 -m json.tool

echo "--- Login alice ---"
ALICE_TOKEN=$(curl -sf -X POST "$BASE/auth/login" -H "$H" -d '{"username":"alice","password":"pass"}' | python3 -c "import sys,json; print(json.load(sys.stdin)['token'])")
BOB_TOKEN=$(curl -sf -X POST "$BASE/auth/login" -H "$H" -d '{"username":"bob","password":"pass"}' | python3 -c "import sys,json; print(json.load(sys.stdin)['token'])")
echo "Tokens acquired"

echo "--- Me ---"
curl -sf "$BASE/auth/me" -H "Authorization: Bearer $ALICE_TOKEN" | python3 -m json.tool

echo "--- POST /products ---"
ITEM=$(curl -sf -X POST "$BASE/products" -H "Authorization: Bearer $ALICE_TOKEN" -H "$H" -d '{"name":"Widget","price":9.99}')
echo $ITEM | python3 -m json.tool
ITEM_ID=$(echo $ITEM | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")

echo "--- GET /products ---"
curl -sf "$BASE/products" -H "Authorization: Bearer $ALICE_TOKEN" | python3 -m json.tool

echo "--- PATCH /products/$ITEM_ID ---"
curl -sf -X PATCH "$BASE/products/$ITEM_ID" -H "Authorization: Bearer $ALICE_TOKEN" -H "$H" -d '{"price":14.99}' | python3 -m json.tool

echo "--- Bob cannot see alice's product ---"
curl -s "$BASE/products" -H "Authorization: Bearer $BOB_TOKEN"
echo ""

echo "--- Share with bob (read) ---"
ALICE_ID=$(curl -sf "$BASE/auth/me" -H "Authorization: Bearer $ALICE_TOKEN" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")
BOB_ID=$(curl -sf "$BASE/auth/me" -H "Authorization: Bearer $BOB_TOKEN" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")
curl -sf -X PATCH "$BASE/products/$ITEM_ID" -H "Authorization: Bearer $ALICE_TOKEN" -H "$H" \
  -d "{\"sharedWith\":[{\"userId\":\"$BOB_ID\",\"access\":\"read\"}]}" | python3 -m json.tool

echo "--- Bob can now see shared product ---"
curl -sf "$BASE/products" -H "Authorization: Bearer $BOB_TOKEN" | python3 -m json.tool

echo "--- Querying with filters ---"
for i in 1 2 3 4 5; do
  curl -sf -X POST "$BASE/scores" -H "Authorization: Bearer $ALICE_TOKEN" -H "$H" -d "{\"value\":$((i*10))}" > /dev/null
done
curl -sf "$BASE/scores?value__gte=30&_sort=value&_order=desc" -H "Authorization: Bearer $ALICE_TOKEN" | python3 -m json.tool

echo "--- Pagination ---"
curl -sf "$BASE/scores?_limit=2&_offset=1&_sort=value" -H "Authorization: Bearer $ALICE_TOKEN" | python3 -m json.tool

echo "--- Reserved collection blocked ---"
curl -s -X POST "$BASE/_users" -H "Authorization: Bearer $ALICE_TOKEN" -H "$H" -d '{"x":1}'
echo ""

echo "--- 20 concurrent POSTs ---"
for i in $(seq 1 20); do
  curl -sf -X POST "$BASE/concurrent" \
    -H "Authorization: Bearer $ALICE_TOKEN" -H "$H" -d "{\"n\":$i}" > /dev/null &
done
wait
COUNT=$(curl -sf "$BASE/concurrent" -H "Authorization: Bearer $ALICE_TOKEN" | python3 -c "import sys,json; items=json.load(sys.stdin); ids=set(i['id'] for i in items); print(f'items={len(items)} unique_ids={len(ids)}')")
echo "Concurrency result: $COUNT"

echo "--- DELETE ---"
curl -sf -X DELETE "$BASE/products/$ITEM_ID" -H "Authorization: Bearer $ALICE_TOKEN"
echo ""
curl -sf "$BASE/products" -H "Authorization: Bearer $ALICE_TOKEN"
echo ""

kill $PID 2>/dev/null
echo "=== DONE ==="
