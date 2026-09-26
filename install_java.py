import os
import sys
import urllib.request
import tarfile

URL = "https://api.adoptium.net/v3/binary/latest/21/ga/linux/x64/jdk/hotspot/normal/eclipse"
DEST = "/tmp/openjdk21.tar.gz"
EXTRACT_DIR = "/jvm"

print("Installing OpenJDK 21...")
if not os.path.exists(EXTRACT_DIR):
    os.makedirs(EXTRACT_DIR)

java_bin = os.path.join(EXTRACT_DIR, "java21/bin/java")

# Check if already installed
if not os.path.exists(java_bin):
    try:
        print("Downloading latest OpenJDK 21 tar.gz from Adoptium (with user-agent)...")
        req = urllib.request.Request(
            URL, 
            headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'}
        )
        with urllib.request.urlopen(req) as response:
            with open(DEST, 'wb') as out_file:
                out_file.write(response.read())
                
        print("Extracting OpenJDK 21...")
        with tarfile.open(DEST, 'r:gz') as tar:
            tar.extractall(path=EXTRACT_DIR)
        
        # Find the extracted folder (it will be like jdk-21.x.x+x)
        folders = [f for f in os.listdir(EXTRACT_DIR) if f.startswith("jdk-")]
        if folders:
            extracted_folder = os.path.join(EXTRACT_DIR, folders[0])
            target_folder = os.path.join(EXTRACT_DIR, "java21")
            os.rename(extracted_folder, target_folder)
            print(f"Java installed successfully at {java_bin}")
        else:
            print("Could not find extracted folder starting with 'jdk-'")
            sys.exit(1)
            
    except Exception as e:
        print(f"Error installing Java: {e}")
        sys.exit(1)
else:
    print(f"Java already installed at {java_bin}")
