import urllib.request
import urllib.error
import json

endpoints = [
    "https://api.papermc.io/v2/projects/paper/versions/1.21.1",
    "https://api.papermc.io/v3/projects/paper",
    "https://api.papermc.io/v2/projects/paper/versions/1.21.1/builds",
    "https://api.papermc.io/v3/projects/paper/versions/1.21.1",
    "https://api.papermc.io/v3/projects/paper/versions/1.21.1/builds"
]

results = []

for ep in endpoints:
    req = urllib.request.Request(
        ep,
        headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'}
    )
    try:
        with urllib.request.urlopen(req) as response:
            code = response.getcode()
            body = response.read().decode('utf-8')
            results.append({
                "endpoint": ep,
                "status": "success",
                "code": code,
                "body": body[:500] # first 500 chars
            })
    except urllib.error.HTTPError as e:
        results.append({
            "endpoint": ep,
            "status": "HTTPError",
            "code": e.code,
            "body": e.read().decode('utf-8')[:500]
        })
    except Exception as e:
        results.append({
            "endpoint": ep,
            "status": "Exception",
            "body": str(e)
        })

with open("test_output.txt", "w", encoding="utf-8") as f:
    json.dump(results, f, indent=2)

print("Diagnostics complete.")
