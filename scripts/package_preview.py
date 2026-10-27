# SPDX-License-Identifier: MPL-2.0
"""Export only individually reviewed files; no Git history, no deletion, no upload."""
import datetime
import argparse
import hashlib
import json
import pathlib
import shutil
import subprocess
import zipfile

ROOT = pathlib.Path(__file__).resolve().parent.parent
parser = argparse.ArgumentParser(description='Export reviewed community files locally; never upload.')
parser.add_argument('--upload', action='store_true', help='Name this export as a local upload candidate.')
args = parser.parse_args()
subprocess.run(['node', str(ROOT / 'scripts/check.mjs')], cwd=ROOT, check=True)
files = json.loads((ROOT / 'scripts/release-files.json').read_text())
stamp = datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%S%fZ')
kind = 'upload' if args.upload else 'preview'
name = f'jusuo-community-{kind}-{stamp}'
output = ROOT / 'dist' / name
output.mkdir(parents=True, exist_ok=False)
manifest = []
for relative in files:
    source = ROOT / relative
    destination = output / relative
    destination.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(source, destination)
    manifest.append({'file': relative, 'sha256': hashlib.sha256(destination.read_bytes()).hexdigest(), 'bytes': destination.stat().st_size})
archive = ROOT / 'dist' / f'{name}.zip'
with zipfile.ZipFile(archive, 'x', compression=zipfile.ZIP_DEFLATED) as bundle:
    for relative in files:
        bundle.write(output / relative, f'{name}/{relative}')
with zipfile.ZipFile(archive) as bundle:
    assert bundle.testzip() is None
    assert len(bundle.namelist()) == len(files)
    for entry in manifest:
        assert hashlib.sha256(bundle.read(f"{name}/{entry['file']}")).hexdigest() == entry['sha256']
(ROOT / 'dist' / f'{name}.manifest.json').write_text(json.dumps({'status':f'local-{kind}-not-published','license':'MPL-2.0','files':manifest}, ensure_ascii=False, indent=2)+'\n')
print(f'Local {kind} folder: {output}\nBackup ZIP: {archive}\nVerified {len(files)} files. MPL-2.0 included. No upload or publication performed.')
