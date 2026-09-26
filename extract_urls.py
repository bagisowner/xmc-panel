import re

with open("docs.html", "r", encoding="utf-8") as f:
    html = f.read()

urls = re.findall(r'https://[a-zA-Z0-9.-]+\.papermc\.io/[a-zA-Z0-9./_-]+', html)
urls = sorted(list(set(urls)))

with open("raw_urls.txt", "w", encoding="utf-8") as f:
    for url in urls:
        f.write(url + "\n")

print("URLs extracted.")
