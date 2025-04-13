# Basic Git Commands

Here's a quick reference to some essential Git commands:

## Configuration

*   **Set your name and email (globally):**

    ```bash
    git config --global user.name "Your Name"
    git config --global user.email "your.email@example.com"
    ```

## Starting a Repository

*   **Initialize a new Git repository:**

    ```bash
    git init
    ```

*   **Clone an existing repository:**

    ```bash
    git clone <repository_url>
    ```

## Basic Workflow

*   **Check the status of your working directory:**

    ```bash
    git status
    ```

*   **Add files to the staging area:**

    ```bash
    git add <file1> <file2> ...
    git add .  # Add all changes in the current directory
    ```

*   **Commit changes with a message:**

    ```bash
    git commit -m "Your descriptive commit message"
    ```

## Branching and Merging

*   **Create a new branch:**

    ```bash
    git branch <branch_name>
    ```

*   **Switch to a branch:**

    ```bash
    git checkout <branch_name>
    ```

*   **Create and switch to a new branch in one command:**

    ```bash
    git checkout -b <new_branch_name>
    ```

*   **List all branches:**

    ```bash
    git branch
    ```

*   **Merge a branch into the current branch:**

    ```bash
    git merge <branch_name>
    ```

## Remote Repositories

*   **Add a remote repository:**

    ```bash
    git remote add origin <repository_url>
    ```

*   **Fetch changes from a remote repository:**

    ```bash
    git fetch origin
    ```

*   **Pull changes from a remote repository (fetch and merge):**

    ```bash
    git pull origin <branch_name>
    ```

*   **Push changes to a remote repository:**

    ```bash
    git push origin <branch_name>
    ```

## Undoing Changes

*   **Discard changes in the working directory (since the last commit):**

    ```bash
    git checkout -- <file_name>
    ```

*   **Remove files from the staging area:**

    ```bash
    git reset HEAD <file_name>
    ```

*   **Revert to a specific commit (creates a new commit):**

    ```bash
    git revert <commit_hash>
    ```

## Viewing History

*   **View commit history:**

    ```bash
    git log
    ```

*   **View commit history for a specific file:**

    ```bash
    git log <file_name>
    ```

## Stashing
*   **Stash your uncommitted changes:**
    ```bash
    git stash
    ```
*   **List stashes:**
    ```bash
    git stash list
    ```
*   **Apply the most recent stash:**
    ```bash
    git stash apply
    ```
*   **Apply a specific stash:**
    ```bash
    git stash apply stash@{index}
    ```
*   **Remove a stash:**
    ```bash
    git stash drop stash@{index}
    ```
*   **Remove all stashes:**
   ```bash
   git stash clear
