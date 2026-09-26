import urllib.request
import urllib.error
import json

headers_combos = [
    {
        "User-Agent": "MinecraftPanel/1.0 (udevi2032@gmail.com)",
        "Accept": "application/json"
    },
    {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
        "Accept": "application/json"
    },
    {
        "User-Agent": "PaperMC-Downloader/1.0",
        "Accept": "application/json",
        "Content-Type": "application/json"
    }
]

results = []

for idx, hdrs in enumerate(headers_combos):
    req = urllib.request.Request(
        "https://api.papermc.io/v3/projects/paper/versions/1.21.1/builds/latest",
        headers=hdrs
    )
    try:
        with urllib.request.urlopen(req) as response:
            code = response.getcode()
            body = response.read().decode('utf-8')
            results.append({
                "headers": hdrs,
                "status": "success",
                "code": code,
                "body": body[:500]
            })
    except urllib.error.HTTPError as e:
        results.append({
            "headers": hdrs,
            "status": "HTTPError",
            "code": e.code,
            "body": e.read().decode('utf-8')[:500]
        })
    except Exception as e:
        results.append({
            "headers": hdrs,
            "status": "Exception",
            "body": str(e)
        })

with open("headers_output.txt", "w", encoding="utf-8") as f:
    json.dump(results, f, indent=2)

print("Diagnostics complete.")
