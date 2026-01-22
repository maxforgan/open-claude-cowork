#!/bin/bash

echo "🧪 Testing Exa List Generator Backend"
echo "======================================"
echo ""

# Test 1: Health check
echo "1. Health Check:"
HEALTH=$(curl -s http://localhost:3001/api/health)
if [ $? -eq 0 ]; then
  echo "✓ Backend is responding"
  echo "  Response: $HEALTH"
else
  echo "✗ Backend is not responding"
  exit 1
fi
echo ""

# Test 2: Export formats
echo "2. Available Export Formats:"
FORMATS=$(curl -s http://localhost:3001/api/export/formats)
echo "$FORMATS" | python3 -m json.tool
echo ""

# Test 3: Sample list generation (requires API keys)
echo "3. Test List Generation:"
echo "   Sending request: 'List 3 example tech companies'"
echo ""

# Create a test chat request
curl -N -X POST http://localhost:3001/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "List 3 example tech companies",
    "chatId": "test-'$(date +%s)'"
  }' 2>/dev/null | while IFS= read -r line; do
    if [[ $line == data:* ]]; then
      # Extract the JSON after "data: "
      json="${line#data: }"
      # Parse and display
      type=$(echo "$json" | python3 -c "import sys, json; print(json.loads(sys.stdin.read()).get('type', ''))" 2>/dev/null)

      if [ "$type" == "text" ]; then
        content=$(echo "$json" | python3 -c "import sys, json; print(json.loads(sys.stdin.read()).get('content', ''))" 2>/dev/null)
        echo -n "$content"
      elif [ "$type" == "error" ]; then
        echo ""
        echo "⚠️  Error: $(echo "$json" | python3 -c "import sys, json; print(json.loads(sys.stdin.read()).get('content', ''))" 2>/dev/null)"
      elif [ "$type" == "list_generated" ]; then
        echo ""
        echo "✓ List generated successfully!"
      fi
    fi
  done

echo ""
echo ""
echo "======================================"
echo "Test complete!"
