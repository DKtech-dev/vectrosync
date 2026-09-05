import os
import glob
import subprocess
import sys

def find_latest_audio():
    search_dirs = ["/home/dk/Documents/main", "/home/dk/Downloads"]
    candidates = []
    for d in search_dirs:
        for ext in ["*.mp3", "*.wav"]:
            for f in glob.glob(os.path.join(d, ext)):
                # Exclude old narration or video files
                candidates.append((os.path.getmtime(f), f))
    if not candidates:
        print("No audio files found in ~/Documents/main or ~/Downloads.")
        return None
    candidates.sort(reverse=True)
    return candidates[0][1]

def main():
    if len(sys.argv) > 1:
        audio_file = sys.argv[1]
    else:
        audio_file = find_latest_audio()

    if not audio_file or not os.path.exists(audio_file):
        print("Please provide a valid audio file path.")
        sys.exit(1)

    print(f"Using audio file: {audio_file} (Modified: {os.path.getmtime(audio_file)})")
    cmd = [
        "/home/dk/Documents/main/.venv/bin/python3",
        "/home/dk/Documents/main/scripts/record_and_sync.py",
        "--audio", audio_file,
        "--name", "VectroSync_Winning_Demo"
    ]
    subprocess.run(cmd, check=True)

if __name__ == "__main__":
    main()
