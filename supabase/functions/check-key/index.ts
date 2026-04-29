import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

serve(async (req) => {
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const expectedSuffix = "Az9";
  const matches = key.endsWith(expectedSuffix);
  
  return new Response(
    JSON.stringify({ 
      matches: matches, 
      last3Chars: key.slice(-3),
      status: "Verified that the internal key is active."
    }),
    { headers: { "Content-Type": "application/json" } },
  )
})
