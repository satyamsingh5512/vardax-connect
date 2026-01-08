
import subprocess
import os

def run_command(command, check=True):
    try:
        result = subprocess.run(command, shell=True, check=check, capture_output=True, text=True)
        return result.stdout.strip()
    except subprocess.CalledProcessError as e:
        print(f"Error running command: {command}")
        print(f"Stdout: {e.stdout}")
        print(f"Stderr: {e.stderr}")
        if check:
            raise e
        return None

def main():
    # Get status
    status_output = run_command("git status --porcelain")
    if not status_output:
        print("No changes to commit.")
        return

    lines = status_output.split('\n')
    commit_count = 1
    
    # Filter lines to get files
    # XY Path
    # X: index status, Y: worktree status
    # We want to commit everything.
    
    for line in lines:
        if not line.strip():
            continue
            
        # Parse the line carefully. 
        # Porcelain format is: XY PATH or XY "PATH" (if spaces)
        # However, usually just splitting by space and taking the rest is risky if filenames have spaces, 
        # but git status --porcelain usually handles this.
        # Let's simple split.
        parts = line.split()
        if len(parts) < 2:
            continue
            
        # The filename is everything after the first token (XY)
        # But wait, porcelain fixed format is 2 columns chars then space then path.
        # Unless it's a rename (R), then it's FROM -> TO.
        # Assuming simple modified/new-files for now based on previous git status.
        
        # safely extract filename. substring from index 3 to end seems robust for standard porcelain
        filename = line[3:]
        # handle quoted filenames if any (git does this for weird chars)
        if filename.startswith('"') and filename.endswith('"'):
           filename = filename[1:-1]

        print(f"Processing file {commit_count}: {filename}")
        
        try:
            # Add file
            run_command(f'git add "{filename}"')
            
            # Commit
            commit_msg = f"Commit {commit_count}: {filename}"
            run_command(f'git commit -m "{commit_msg}"')
            
            # Push
            print(f"Pushing commit {commit_count}...")
            run_command("git push")
            
            commit_count += 1
            
        except Exception as e:
            print(f"Failed to process {filename}: {e}")
            # Decide whether to continue or stop. Let's continue to attempt others.
            continue

if __name__ == "__main__":
    main()
