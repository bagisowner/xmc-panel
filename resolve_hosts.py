import socket

subdomains = [
    "api.papermc.io",
    "api-data.papermc.io",
    "downloads.papermc.io",
    "downloads-data.papermc.io",
    "papermc.io"
]

results = {}

for sub in subdomains:
    try:
        ip = socket.gethostbyname(sub)
        results[sub] = {"status": "success", "ip": ip}
    except Exception as e:
        results[sub] = {"status": "error", "error": str(e)}

with open("dns_output.txt", "w", encoding="utf-8") as f:
    import json
    json.dump(results, f, indent=2)

print("DNS checks complete.")
