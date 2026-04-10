/**
 * Local-storage backed folder management.
 * Folders are stored per-user as a simple map of folder names to arrays of note IDs.
 * This avoids requiring any database schema change.
 */

export interface Folder {
    name: string;
    noteIds: number[];
    createdAt: string;
}

const STORAGE_KEY = 'zemly_folders';

function getStorageKey(userId: string): string {
    return `${STORAGE_KEY}_${userId}`;
}

/** Read all folders for a user */
export function getFolders(userId: string): Folder[] {
    try {
        const raw = localStorage.getItem(getStorageKey(userId));
        if (!raw) return [];
        return JSON.parse(raw) as Folder[];
    } catch {
        return [];
    }
}

/** Save all folders for a user */
function saveFolders(userId: string, folders: Folder[]): void {
    localStorage.setItem(getStorageKey(userId), JSON.stringify(folders));
}

/** Create a new folder */
export function createFolder(userId: string, name: string): Folder {
    const folders = getFolders(userId);
    const existing = folders.find((f) => f.name.toLowerCase() === name.toLowerCase());
    if (existing) throw new Error(`Folder "${name}" already exists`);

    const folder: Folder = { name, noteIds: [], createdAt: new Date().toISOString() };
    folders.push(folder);
    saveFolders(userId, folders);
    return folder;
}

/** Rename a folder */
export function renameFolder(userId: string, oldName: string, newName: string): void {
    const folders = getFolders(userId);
    const folder = folders.find((f) => f.name === oldName);
    if (!folder) return;
    const conflict = folders.find((f) => f.name.toLowerCase() === newName.toLowerCase() && f.name !== oldName);
    if (conflict) throw new Error(`Folder "${newName}" already exists`);
    folder.name = newName;
    saveFolders(userId, folders);
}

/** Delete a folder (notes are NOT deleted, they just become unfiled) */
export function deleteFolder(userId: string, folderName: string): void {
    const folders = getFolders(userId).filter((f) => f.name !== folderName);
    saveFolders(userId, folders);
}

/** Add a note to a folder */
export function addNoteToFolder(userId: string, folderName: string, noteId: number): void {
    const folders = getFolders(userId);
    const folder = folders.find((f) => f.name === folderName);
    if (!folder) return;
    if (!folder.noteIds.includes(noteId)) {
        folder.noteIds.push(noteId);
    }
    saveFolders(userId, folders);
}

/** Remove a note from a folder */
export function removeNoteFromFolder(userId: string, folderName: string, noteId: number): void {
    const folders = getFolders(userId);
    const folder = folders.find((f) => f.name === folderName);
    if (!folder) return;
    folder.noteIds = folder.noteIds.filter((id) => id !== noteId);
    saveFolders(userId, folders);
}

/** Move a note from one folder to another (or out of all folders if targetFolder is null) */
export function moveNoteToFolder(userId: string, noteId: number, targetFolder: string | null): void {
    const folders = getFolders(userId);
    // Remove from all folders first
    for (const folder of folders) {
        folder.noteIds = folder.noteIds.filter((id) => id !== noteId);
    }
    // Add to target folder if specified
    if (targetFolder) {
        const target = folders.find((f) => f.name === targetFolder);
        if (target) {
            target.noteIds.push(noteId);
        }
    }
    saveFolders(userId, folders);
}

/** Get which folder a note belongs to (or null if unfiled) */
export function getNoteFolder(userId: string, noteId: number): string | null {
    const folders = getFolders(userId);
    for (const folder of folders) {
        if (folder.noteIds.includes(noteId)) return folder.name;
    }
    return null;
}
