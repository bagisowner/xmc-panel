import urllib.request
import json

query = """
query {
  projects {
    id
    name
  }
}
"""

req = urllib.request.Request(
    "https://api.papermc.io/graphql",
    data=json.dumps({"query": query}).encode('utf-8'),
    headers={
        "User-Agent": "MinecraftPanel/1.0 (udevi2032@gmail.com)",
        "Content-Type": "application/json",
        "Accept": "application/json"
    }
)

try:
    with urllib.request.urlopen(req) as response:
        print("GraphQL Success:", response.read().decode('utf-8'))
except Exception as e:
    if hasattr(e, 'read'):
        print("GraphQL HTTPError:", e.read().decode('utf-8'))
    else:
        print("GraphQL Error:", e)
