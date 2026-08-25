# Vendored libarchive.js

These files are copied from a fork's committed `dist/`. This repo has no build
step, so the fork's `dist/` is vendored directly rather than installed from npm.
Nothing here is generated locally.

| Field | Value |
|---|---|
| Source | `github.com/n-i-x/libarchivejs` (fork of `nika-begiashvili/libarchivejs`) |
| Pinned commit | `7c35a3828c3b419d27063e070a78edb4a0df3f87` |
| Package version | `libarchive.js@2.0.2` |
| libarchive | 3.8.9 |
| Vendored | 2026-08-24 |

## Files

| File | sha256 |
|---|---|
| `libarchive.js` | `73975b2e913f29cf54d07f63661bf77b95156bb3493ce80f414cb332f014345f` |
| `worker-bundle.js` | `dfeb3ac4b29f7f364a52a7dc4bd67ec52a3b41b69b10f2566c67b4451b8b42fc` |
| `libarchive.wasm` | `8a335241c13de819f3d6d77bc87212e9b14f9300334dfbb604a6c057924525d6` |

`LICENSE` is unchanged from upstream and is byte-identical to the version that
shipped with stock 2.0.2.

## Why the fork rather than stock 2.0.2

Stock was replaced on 2026-08-24. Four things it did wrong, all verified against
the stock bundle before the swap rather than taken on trust:

1. **The whole archive was copied into wasm memory before anything was read.**
   Stock's `_loadFile` did `await file.arrayBuffer()` then `HEAPU8.set(...)`, so
   archive size was bounded by the wasm heap. The fork mounts the file with
   WORKERFS and opens it with `archive_read_open_filename`, reading only the
   blocks it needs. This is what lifts the ~2 GB ceiling on browsing and
   scanning archives.

2. **Entry reads could silently return garbage.** Stock ran
   `const p = getFileData(archive, size); if (p < 0) throw ...` and then
   `HEAPU8.slice(p, p + size)`. **The `< 0` guard itself worked** — `cwrap`
   binds `get_filedata` straight to the raw wasm export, and WebAssembly hands
   an `i32` back to JS as *signed*, so the C error branch (`return (void *)
   read_size`) really did arrive as a negative number. Verified empirically,
   not assumed. Two other paths bypassed the guard entirely:

   - **`malloc` was never NULL-checked.** A failed allocation returned 0, which
     is not `< 0`, so the slice read `size` bytes from heap offset 0.
   - **Short reads were ignored.** `archive_read_data` returns how many bytes it
     actually read; stock only tested that for being negative and then sliced
     the full entry size regardless, padding the tail with uninitialized
     `malloc` memory. This one needs no heap pressure at all.

   Either path yields right length, wrong bytes, and no error raised — a
   silently wrong MD5 in a tool whose whole job is checksums. The fork
   NULL-checks the allocation and reads through `readDataChunk` in a loop,
   returning `subarray(0, actual)` when an entry comes up short.

   *(Corrected 2026-08-25. The original note here claimed the pointer was
   unsigned so `p < 0` could never fire. That mechanism was wrong; the
   conclusion was right for the two reasons above.)*

3. **Entry sizes above 2^31 were truncated**, silently corrupting recorded
   metadata for large entries.

4. **libarchive 3.8.9 instead of 3.7.2**, which fixes a RAR4 decode bug that
   issue 2 was masking.

## Upgrading

Replace the three files from the fork's `dist/` at a specific commit, update the
table above, and re-run `npm test`. Keep `LICENSE`. Do not reformat or re-encode
the files: they ship LF and the repo's working tree is otherwise CRLF, so a
careless rewrite converts them (see the editing notes in `VPXS Architecture Map`
in the vault).

The worker and wasm are fetched at fixed, unhashed paths, so both loaders append
a `?v=` cache-busting query built from `APP_VERSION`. **Bump `APP_VERSION` in
`js.src/appVersion.js` whenever these files change** — a browser holding a cached
worker against a new wasm calls exports the binary does not have, and it fails in
a way that looks exactly like a corrupt archive.
