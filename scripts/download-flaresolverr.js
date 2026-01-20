
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import https from 'https';
import AdmZip from 'adm-zip';

// Get current directory equivalent to __dirname in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PROJECT_ROOT = path.resolve(__dirname, '..');
const BINARIES_DIR = path.join(PROJECT_ROOT, 'src-tauri', 'binaries');
const FLARESOLVERR_EXE = path.join(BINARIES_DIR, 'flaresolverr-x86_64-pc-windows-msvc.exe');
const VERSION = 'v3.3.21';
const DOWNLOAD_URL = `https://github.com/FlareSolverr/FlareSolverr/releases/download/${VERSION}/flaresolverr_windows_x64.zip`;
const ZIP_FILE_PATH = path.join(BINARIES_DIR, 'flaresolverr.zip');

async function downloadFile(url, dest) {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(dest);
        https.get(url, (response) => {
            if (response.statusCode === 302 || response.statusCode === 301) {
                downloadFile(response.headers.location, dest).then(resolve).catch(reject);
                return;
            }
            if (response.statusCode !== 200) {
                reject(new Error(`Failed to download: ${response.statusCode}`));
                return;
            }
            response.pipe(file);
            file.on('finish', () => {
                file.close();
                resolve();
            });
        }).on('error', (err) => {
            fs.unlink(dest, () => { }); // Delete the file async. (But we don't check the result)
            reject(err);
        });
    });
}

async function main() {
    if (fs.existsSync(FLARESOLVERR_EXE)) {
        console.log('✅ FlareSolverr binary already exists. Skipping download.');
        return;
    }

    console.log('⬇️  FlareSolverr binary missing. Downloading...');

    if (!fs.existsSync(BINARIES_DIR)) {
        fs.mkdirSync(BINARIES_DIR, { recursive: true });
    }

    try {
        console.log(`Downloading from ${DOWNLOAD_URL}...`);
        await downloadFile(DOWNLOAD_URL, ZIP_FILE_PATH);
        console.log('📦 Download complete. Extracting...');

        const zip = new AdmZip(ZIP_FILE_PATH);
        const zipEntries = zip.getEntries();

        // We want to extract contents of the inner folder directly to BINARIES_DIR
        // The zip usually contains a folder like "flaresolverr/" at the root.

        zipEntries.forEach((entry) => {
            if (entry.isDirectory) return;

            // Remove the top-level directory from the path if it exists
            // e.g. "flaresolverr/flaresolverr.exe" -> "flaresolverr.exe"
            let entryName = entry.entryName;
            const parts = entryName.split('/');
            if (parts.length > 1) {
                parts.shift(); // Remove the first folder
                entryName = parts.join('/');
            }

            if (!entryName) return;

            // If it was just a folder entry, we might have emptied it, but we filtered isDirectory above.
            // Wait, if parts.length was 1 (file at root), we keep it. 
            // If "flaresolverr/foo.txt" -> "foo.txt". 

            const targetPath = path.join(BINARIES_DIR, entryName);
            const targetDir = path.dirname(targetPath);

            if (!fs.existsSync(targetDir)) {
                fs.mkdirSync(targetDir, { recursive: true });
            }

            fs.writeFileSync(targetPath, entry.getData());
        });

        console.log('🧹 Cleaning up zip file...');
        fs.unlinkSync(ZIP_FILE_PATH);

        // Rename usage of incorrect name if necessary, specifically looking for the exact exe name we expect
        // The zip usually has "flaresolverr.exe". usage requires "flaresolverr-x86_64-pc-windows-msvc.exe"?
        // Let's check what came out.

        // Tauri expects the binary to be named with the target triple.
        // If we just extracted "flaresolverr.exe", we must rename it.

        const extractedExe = path.join(BINARIES_DIR, 'flaresolverr.exe');
        if (fs.existsSync(extractedExe) && !fs.existsSync(FLARESOLVERR_EXE)) {
            console.log('🔄 Renaming executable for Tauri compatibility...');
            fs.renameSync(extractedExe, FLARESOLVERR_EXE);
        }

        console.log('✅ FlareSolverr setup complete!');

    } catch (error) {
        console.error('❌ Error setting up FlareSolverr:', error);
        process.exit(1);
    }
}

main();
