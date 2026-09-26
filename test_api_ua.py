import urllib.request
import urllib.error
import json

uas = [
    "MinecraftPanel/1.0 (udevi2032@gmail.com)",
    "PaperMC-Downloader/1.0 (contact@papermc.io)",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Safari/537.36",
    "Pterodactyl-Panel/1.0"
]

results = []

for ua in uas:
    req = urllib.request.Request(
        "https://api.papermc.io/v3/projects/paper",
        headers={'User-Agent': ua}
    )
    try:
        with urllib.request.urlopen(req) as response:
            code = response.getcode()
            body = response.read().decode('utf-8')
            results.append({
                "ua": ua,
                "status": "success",
                "code": code,
                "body": body[:200]
            })
    except urllib.error.HTTPError as e:
        results.append({
            "ua": ua,
            "status": "HTTPError",
            "code": e.code,
            "body": e.read().decode('utf-8')[:200]
        })
    except Exception as e:
        results.append({
            "ua": ua,
            "status": "Exception",
            "body": str(e)
        })

with open("ua_output.txt", "w", encoding="utf-8") as f:
    json.dump(results, f, indent=2)

print("Diagnostics complete.")
